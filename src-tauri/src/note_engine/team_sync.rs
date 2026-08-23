use std::fs;
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use sha2::{Digest, Sha256};

use super::identity::{new_note_id, normalized_path_key};
use super::mutation::{
    apply_remote_write, commit_create_with_note_id, commit_relocate, commit_restore,
    commit_tombstone,
};
use super::sequence::allocate_client_sequence;
use super::store::NoteStore;
use super::writer::atomic_replace;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct TeamOutboxEntry {
    pub op_id: String,
    pub note_id: String,
    pub team_id: String,
    pub space_id: String,
    pub permission_epoch: i64,
    pub key_epoch: i64,
    pub client_sequence: i64,
    pub base_revision_id: Option<String>,
    pub relative_path: String,
    pub operation_kind: String,
    pub content: String,
    pub encrypted_payload_base64: Option<String>,
    pub claim_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamRemoteAction {
    pub action_id: String,
    pub action_sequence: i64,
    pub action_type: String,
    pub note_id: String,
    pub revision_id: Option<String>,
    pub team_id: String,
    pub space_id: String,
    pub permission_epoch: i64,
    pub key_epoch: i64,
    pub relative_path: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct TeamApplyOutcome {
    pub status: String,
    pub relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct TeamScopeKey {
    pub space_id: String,
    pub key_epoch: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct TeamConflictSnapshot {
    pub kind: String,
    pub content: String,
    pub base_revision_id: Option<String>,
    pub remote_revision_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct TeamOutboxStatus {
    pub state: String,
    pub last_error_code: Option<String>,
}

pub fn configure_note_team_scope(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    team_id: &str,
    space_id: &str,
    permission_epoch: i64,
    key_epoch: i64,
) -> Result<String, String> {
    if team_id.is_empty() || space_id.is_empty() || permission_epoch < 1 || key_epoch < 1 {
        return Err("invalid team scope".to_string());
    }
    let relative = safe_relative_path(relative_path)?;
    let path_key = normalized_path_key(&relative);
    let target = workspace_path.join(&relative);
    let payload = fs::read(&target).map_err(|error| error.to_string())?;
    let (mut note_id, current_scope, current_scope_id, pending_count): (
        String,
        String,
        String,
        i64,
    ) = store.with_blocking({
        let path_key = path_key.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.note_id, note.scope_kind, note.scope_id,
                        (SELECT count(*) FROM outbox_operations outbox
                          WHERE outbox.note_id=note.note_id
                            AND outbox.state IN ('pending', 'in_flight'))
                   FROM local_notes note
                  WHERE note.normalized_path_key=?1 AND note.status='active'",
                [path_key],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
        }
    })?;
    if !matches!(current_scope.as_str(), "local_only" | "personal") {
        return Err("note is already owned by a team scope".to_string());
    }
    if pending_count != 0 {
        return Err("note has unsynchronized operations".to_string());
    }
    if matches!(current_scope.as_str(), "personal" | "local_only") {
        let identity_scope = if current_scope == "personal" {
            current_scope_id.as_str()
        } else {
            "local-path"
        };
        let promoted_id = promoted_team_note_id(team_id, identity_scope, &path_key);
        if promoted_id != note_id {
            adopt_personal_note_identity(store, &note_id, &promoted_id)?;
            note_id = promoted_id;
        }
    }

    let op_id = new_note_id();
    let payload_relative_path = format!("outbox/{op_id}.payload");
    let metadata_dir = workspace_path.join(".lokus");
    fs::create_dir_all(metadata_dir.join("outbox")).map_err(|error| error.to_string())?;
    atomic_replace(&metadata_dir.join(&payload_relative_path), &payload, &op_id)?;
    let now = now_ms();
    let payload_size = payload.len() as i64;
    let payload_sha256 = hex::encode(Sha256::digest(&payload));
    let relative_path = relative.to_string_lossy().replace('\\', "/");
    let transition_source = format!("team-share|{current_scope}|{current_scope_id}");
    let result = store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let team_id = team_id.to_string();
        let space_id = space_id.to_string();
        let payload_relative_path = payload_relative_path.clone();
        let transition_source = transition_source.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "INSERT INTO sync_scopes (
                   scope_kind, scope_id, team_id, permission_epoch, key_epoch,
                   status, created_at_ms, updated_at_ms
                 ) VALUES ('team', ?1, ?2, ?3, ?4, 'active', ?5, ?5)
                 ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
                   team_id=excluded.team_id,
                   permission_epoch=max(
                     sync_scopes.permission_epoch,
                     excluded.permission_epoch
                   ),
                   key_epoch=max(sync_scopes.key_epoch, excluded.key_epoch),
                   status='active',
                   updated_at_ms=excluded.updated_at_ms",
                params![space_id, team_id, permission_epoch, key_epoch, now],
            )?;
            tx.execute(
                "UPDATE local_notes SET scope_kind='team', scope_id=?2, updated_at_ms=?3
                  WHERE note_id=?1",
                params![note_id, space_id, now],
            )?;
            if current_scope == "personal" {
                tx.execute(
                    "UPDATE note_heads
                        SET remote_revision_id=NULL, remote_sequence=NULL,
                            remote_space_id=NULL, base_revision_id=NULL, base_hash=NULL,
                            updated_at_ms=?2
                      WHERE note_id=?1",
                    params![note_id, now],
                )?;
            }
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms, file_applied_at_ms, committed_at_ms
                 ) VALUES (
                   ?1, ?2, 'write', ?3, ?4, ?5, ?6, ?7,
                   'committed', ?8, ?8, ?8
                 )",
                params![
                    op_id,
                    note_id,
                    transition_source,
                    relative_path,
                    format!("scope/{op_id}.none"),
                    payload_size,
                    payload_sha256,
                    now
                ],
            )?;
            let sequence = allocate_client_sequence(&tx, "team", &space_id, now)?;
            let base_revision_id: Option<String> = tx.query_row(
                "SELECT base_revision_id FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            tx.execute(
                "INSERT INTO outbox_operations (
                   op_id, note_id, scope_kind, scope_id, client_sequence,
                   base_revision_id, payload_relative_path, state,
                   created_at_ms, updated_at_ms
                 ) VALUES (?1, ?2, 'team', ?3, ?4, ?5, ?6, 'pending', ?7, ?7)",
                params![
                    op_id,
                    note_id,
                    space_id,
                    sequence,
                    base_revision_id,
                    payload_relative_path,
                    now
                ],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = result {
        let _ = fs::remove_file(metadata_dir.join(payload_relative_path));
        return Err(error);
    }
    Ok(op_id)
}

pub fn queue_team_space_move(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    team_id: &str,
    target_space_id: &str,
    permission_epoch: i64,
    key_epoch: i64,
) -> Result<String, String> {
    if team_id.is_empty() || target_space_id.is_empty() || permission_epoch < 1 || key_epoch < 1 {
        return Err("invalid target team scope".to_string());
    }
    let relative = safe_relative_path(relative_path)?;
    let path_key = normalized_path_key(&relative);
    let payload = fs::read(workspace_path.join(&relative)).map_err(|error| error.to_string())?;
    let (note_id, current_scope, current_team, pending): (String, String, String, i64) = store
        .with_blocking(move |conn| {
            conn.query_row(
                "SELECT note.note_id, note.scope_id, scope.team_id,
                        (SELECT count(*) FROM outbox_operations outbox
                          WHERE outbox.note_id=note.note_id
                            AND outbox.state IN ('pending', 'in_flight'))
                   FROM local_notes note
                   JOIN sync_scopes scope
                     ON scope.scope_kind=note.scope_kind
                    AND scope.scope_id=note.scope_id
                  WHERE note.normalized_path_key=?1
                    AND note.scope_kind='team'
                    AND note.status='active'",
                [path_key],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
        })?;
    if current_team != team_id {
        return Err("cross-team note moves are forbidden".to_string());
    }
    if current_scope == target_space_id {
        return Err("note is already in the target space".to_string());
    }
    if pending != 0 {
        return Err("note has unsynchronized operations".to_string());
    }

    let op_id = new_note_id();
    let payload_relative_path = format!("outbox/{op_id}.payload");
    let metadata_dir = workspace_path.join(".lokus");
    fs::create_dir_all(metadata_dir.join("outbox")).map_err(|error| error.to_string())?;
    atomic_replace(&metadata_dir.join(&payload_relative_path), &payload, &op_id)?;
    let now = now_ms();
    let payload_hash = hex::encode(Sha256::digest(&payload));
    let target_relative_path = relative.to_string_lossy().replace('\\', "/");
    let result = store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let team_id = team_id.to_string();
        let target_space_id = target_space_id.to_string();
        let payload_relative_path = payload_relative_path.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "INSERT INTO sync_scopes (
                   scope_kind, scope_id, team_id, permission_epoch, key_epoch,
                   status, created_at_ms, updated_at_ms
                 ) VALUES ('team', ?1, ?2, ?3, ?4, 'active', ?5, ?5)
                 ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
                   team_id=excluded.team_id,
                   permission_epoch=max(
                     sync_scopes.permission_epoch,
                     excluded.permission_epoch
                   ),
                   key_epoch=max(sync_scopes.key_epoch, excluded.key_epoch),
                   status='active',
                   updated_at_ms=excluded.updated_at_ms",
                params![target_space_id, team_id, permission_epoch, key_epoch, now],
            )?;
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms, file_applied_at_ms, committed_at_ms
                 ) VALUES (
                   ?1, ?2, 'move', 'team-space-move', ?3, ?4, ?5, ?6,
                   'committed', ?7, ?7, ?7
                 )",
                params![
                    op_id,
                    note_id,
                    target_relative_path,
                    format!("space-move/{op_id}.none"),
                    payload.len() as i64,
                    payload_hash,
                    now
                ],
            )?;
            let updated = tx.execute(
                "UPDATE local_notes
                    SET pending_scope_id=?2, updated_at_ms=?3
                  WHERE note_id=?1 AND pending_scope_id IS NULL",
                params![note_id, target_space_id, now],
            )?;
            if updated != 1 {
                return Err(rusqlite::Error::InvalidParameterName(
                    "note already has a pending move".to_string(),
                ));
            }
            let sequence = allocate_client_sequence(&tx, "team", &target_space_id, now)?;
            let base_revision_id: Option<String> = tx.query_row(
                "SELECT base_revision_id FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            tx.execute(
                "INSERT INTO outbox_operations (
                   op_id, note_id, scope_kind, scope_id, client_sequence,
                   base_revision_id, payload_relative_path, move_source_scope_id, state,
                   created_at_ms, updated_at_ms
                 ) VALUES (
                   ?1, ?2, 'team', ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8
                 )",
                params![
                    op_id,
                    note_id,
                    target_space_id,
                    sequence,
                    base_revision_id,
                    payload_relative_path,
                    current_scope,
                    now
                ],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = result {
        let _ = fs::remove_file(metadata_dir.join(payload_relative_path));
        return Err(error);
    }
    Ok(op_id)
}

pub fn claim_team_outbox(
    store: &NoteStore,
    workspace_path: &Path,
    space_id: &str,
    limit: usize,
) -> Result<Vec<TeamOutboxEntry>, String> {
    claim_team_outbox_filtered(store, workspace_path, Some(space_id), limit)
}

pub fn claim_next_team_outbox(
    store: &NoteStore,
    workspace_path: &Path,
    limit: usize,
) -> Result<Vec<TeamOutboxEntry>, String> {
    claim_team_outbox_filtered(store, workspace_path, None, limit)
}

fn claim_team_outbox_filtered(
    store: &NoteStore,
    workspace_path: &Path,
    space_id: Option<&str>,
    limit: usize,
) -> Result<Vec<TeamOutboxEntry>, String> {
    if limit == 0 || limit > 100 {
        return Err("team outbox claim limit must be between 1 and 100".to_string());
    }
    let claim_token = new_note_id();
    #[allow(clippy::type_complexity)]
    let rows: Vec<(
        String,
        String,
        String,
        String,
        i64,
        i64,
        i64,
        Option<String>,
        String,
        String,
        String,
        Option<String>,
    )> = store.with_blocking({
        let space_id = space_id.map(str::to_string);
        let claim_token = claim_token.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let mut statement = tx.prepare(
                "SELECT outbox.op_id, outbox.note_id, scope.team_id, outbox.scope_id,
                        scope.permission_epoch, scope.key_epoch, outbox.client_sequence,
                        outbox.base_revision_id, note.relative_path,
                        CASE intent.mutation_kind
                          WHEN 'delete' THEN 'tombstone'
                          WHEN 'restore' THEN 'restore'
                          WHEN 'move' THEN
                            CASE WHEN intent.source='team-space-move'
                              THEN 'move' ELSE 'write' END
                          ELSE 'write'
                        END,
                        outbox.payload_relative_path,
                        CASE
                          WHEN outbox.encrypted_payload_key_epoch=scope.key_epoch
                            THEN outbox.encrypted_payload_relative_path
                          ELSE NULL
                        END
                   FROM outbox_operations outbox
                   JOIN local_notes note ON note.note_id=outbox.note_id
                   JOIN sync_scopes scope
                     ON scope.scope_kind=outbox.scope_kind
                    AND scope.scope_id=outbox.scope_id
                   JOIN mutation_intents intent ON intent.op_id=outbox.op_id
                  WHERE outbox.scope_kind='team'
                    AND (?1 IS NULL OR outbox.scope_id=?1)
                    AND (
                      (outbox.state='pending' AND outbox.claim_token IS NULL)
                      OR (
                        outbox.state='in_flight'
                        AND (
                          outbox.claim_token IS NULL
                          OR outbox.claim_expires_at_ms <= ?3
                        )
                      )
                    )
                    AND (
                      outbox.retry_after_ms IS NULL
                      OR outbox.retry_after_ms <= ?3
                    )
                    AND scope.status='active'
                  ORDER BY outbox.client_sequence
                  LIMIT ?2",
            )?;
            let rows: Vec<_> = statement
                .query_map(params![space_id, limit as i64, now_ms()], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                        row.get(8)?,
                        row.get(9)?,
                        row.get(10)?,
                        row.get(11)?,
                    ))
                })?
                .collect::<rusqlite::Result<_>>()?;
            drop(statement);
            for row in &rows {
                tx.execute(
                    "UPDATE outbox_operations
                        SET state='in_flight', attempt_count=attempt_count + 1,
                            claim_token=?2, claim_expires_at_ms=?3,
                            updated_at_ms=?4
                      WHERE op_id=?1",
                    params![row.0, claim_token, now_ms() + 60_000, now_ms()],
                )?;
            }
            tx.commit()?;
            Ok(rows)
        }
    })?;
    rows.into_iter()
        .map(
            |(
                op_id,
                note_id,
                team_id,
                space_id,
                permission_epoch,
                key_epoch,
                client_sequence,
                base_revision_id,
                relative_path,
                operation_kind,
                payload_relative_path,
                encrypted_payload_relative_path,
            )| {
                let payload = fs::read(workspace_path.join(".lokus").join(&payload_relative_path))
                    .map_err(|error| error.to_string())?;
                let content = String::from_utf8(payload)
                    .map_err(|_| "team note payload is not valid UTF-8".to_string())?;
                let encrypted_payload_base64 = encrypted_payload_relative_path
                    .map(|relative| {
                        fs::read(workspace_path.join(".lokus").join(relative))
                            .map(|bytes| BASE64.encode(bytes))
                            .map_err(|error| error.to_string())
                    })
                    .transpose()?;
                Ok(TeamOutboxEntry {
                    op_id,
                    note_id,
                    team_id,
                    space_id,
                    permission_epoch,
                    key_epoch,
                    client_sequence,
                    base_revision_id,
                    relative_path,
                    operation_kind,
                    content,
                    encrypted_payload_base64,
                    claim_token: claim_token.clone(),
                })
            },
        )
        .collect()
}

pub fn stage_team_outbox_ciphertext(
    store: &NoteStore,
    workspace_path: &Path,
    op_id: &str,
    key_epoch: i64,
    claim_token: &str,
    ciphertext: &[u8],
) -> Result<String, String> {
    if ciphertext.is_empty() || key_epoch < 1 {
        return Err("team ciphertext cannot be empty".to_string());
    }
    let op_id_owned = op_id.to_string();
    let claim_token_owned = claim_token.to_string();
    let existing: Option<String> = store.with_blocking({
        let op_id = op_id_owned.clone();
        let claim_token = claim_token_owned.clone();
        move |conn| {
            conn.query_row(
                "SELECT encrypted_payload_relative_path
                   FROM outbox_operations
                  WHERE op_id=?1 AND encrypted_payload_key_epoch=?2
                    AND claim_token=?3",
                params![op_id, key_epoch, claim_token],
                |row| row.get(0),
            )
            .optional()
            .map(|value| value.flatten())
        }
    })?;
    if let Some(relative_path) = existing {
        let bytes = fs::read(workspace_path.join(".lokus").join(relative_path))
            .map_err(|error| error.to_string())?;
        return Ok(BASE64.encode(bytes));
    }

    let relative_path = format!("team-outbox/{op_id}.cipher");
    let target = workspace_path.join(".lokus").join(&relative_path);
    fs::create_dir_all(
        target
            .parent()
            .ok_or_else(|| "team ciphertext has no parent".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    atomic_replace(&target, ciphertext, op_id)?;
    let hash = hex::encode(Sha256::digest(ciphertext));
    let ciphertext_size = ciphertext.len() as i64;
    let updated = store.with_blocking({
        let op_id = op_id_owned;
        let claim_token = claim_token_owned;
        let relative_path = relative_path.clone();
        move |conn| {
            conn.execute(
                "UPDATE outbox_operations
                    SET encrypted_payload_relative_path=?2,
                        encrypted_payload_sha256=?3,
                        encrypted_payload_size=?4,
                        encrypted_payload_key_epoch=?5,
                        updated_at_ms=?6
                  WHERE op_id=?1
                    AND claim_token=?7
                    AND state IN ('pending', 'in_flight')
                    AND (
                      encrypted_payload_relative_path IS NULL
                      OR encrypted_payload_key_epoch<>?5
                    )",
                params![
                    op_id,
                    relative_path,
                    hash,
                    ciphertext_size,
                    key_epoch,
                    now_ms(),
                    claim_token
                ],
            )
        }
    })?;
    if updated != 1 {
        let _ = fs::remove_file(target);
        return Err("team outbox operation cannot stage ciphertext".to_string());
    }
    Ok(BASE64.encode(ciphertext))
}

pub fn complete_team_push(
    store: &NoteStore,
    workspace_path: &Path,
    op_id: &str,
    claim_token: &str,
    result: &str,
    revision_id: Option<&str>,
    action_sequence: Option<i64>,
) -> Result<(), String> {
    if !matches!(
        result,
        "accepted" | "conflict" | "retry_predecessor" | "rejected_access" | "rejected_epoch"
    ) {
        return Err("unsupported team push result".to_string());
    }
    if result == "accepted" && (revision_id.is_none() || action_sequence.is_none()) {
        return Err("accepted push requires revision and action sequence".to_string());
    }
    let op_id_owned = op_id.to_string();
    let claim_token_owned = claim_token.to_string();
    let result_owned = result.to_string();
    let revision_owned = revision_id.map(str::to_string);
    let branch_id = new_note_id();
    let now = now_ms();
    let (payload_relative_path, encrypted_relative_path): (String, Option<String>) = store
        .with_blocking(move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let (
                note_id,
                payload_path,
                payload_sha256,
                scope_id,
                operation_source,
                encrypted_path,
                previous_base_revision,
                client_sequence,
                move_source_scope_id,
            ): (
                String,
                String,
                String,
                String,
                String,
                Option<String>,
                Option<String>,
                i64,
                Option<String>,
            ) = tx.query_row(
                "SELECT outbox.note_id, outbox.payload_relative_path,
                        intent.payload_sha256, outbox.scope_id, intent.source,
                        outbox.encrypted_payload_relative_path,
                        outbox.base_revision_id, outbox.client_sequence,
                        outbox.move_source_scope_id
                   FROM outbox_operations outbox
                   JOIN mutation_intents intent ON intent.op_id=outbox.op_id
                  WHERE outbox.op_id=?1
                    AND outbox.claim_token=?2
                    AND outbox.state IN ('pending', 'in_flight')",
                params![op_id_owned, claim_token_owned],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                        row.get(8)?,
                    ))
                },
            )?;
            match result_owned.as_str() {
                "accepted" => {
                    tx.execute(
                        "UPDATE outbox_operations
                        SET state='accepted', accepted_revision_id=?2,
                            accepted_action_sequence=?3,
                            claim_token=NULL, claim_expires_at_ms=NULL,
                            updated_at_ms=?4
                      WHERE op_id=?1",
                        params![op_id_owned, revision_owned, action_sequence, now],
                    )?;
                    let move_can_finalize = if operation_source == "team-space-move" {
                        tx.query_row(
                            "SELECT EXISTS(
                               SELECT 1 FROM local_notes
                                WHERE note_id=?1
                                  AND scope_id IS ?2
                                  AND pending_scope_id=?3
                             )",
                            params![note_id, move_source_scope_id, scope_id],
                            |row| row.get::<_, bool>(0),
                        )?
                    } else {
                        true
                    };
                    let head_updated = tx.execute(
                        "UPDATE note_heads
                        SET remote_revision_id=?2, remote_sequence=?3,
                            remote_space_id=?6,
                            base_revision_id=?2, base_hash=local_hash,
                            updated_at_ms=?4
                      WHERE note_id=?1
                        AND (
                          (
                            ?5='team-space-move'
                            AND (
                              ?7=1
                              AND (
                                remote_space_id IS NULL
                                OR remote_space_id<>?6
                                OR remote_sequence<=?3
                                OR remote_revision_id=?2
                              )
                            )
                          )
                          OR (
                            ?5<>'team-space-move'
                            AND (
                              remote_space_id IS NULL
                              OR (
                                remote_space_id=?6
                                AND remote_sequence<=?3
                              )
                              OR remote_revision_id=?2
                            )
                          )
                        )",
                        params![
                            note_id,
                            revision_owned,
                            action_sequence,
                            now,
                            operation_source,
                            scope_id,
                            if move_can_finalize { 1 } else { 0 }
                        ],
                    )?;
                    if operation_source == "team-space-move" && move_can_finalize {
                        tx.execute(
                            "UPDATE local_notes
                            SET scope_kind='team', scope_id=?2,
                                pending_scope_id=NULL, updated_at_ms=?3
                          WHERE note_id=?1",
                            params![note_id, scope_id, now],
                        )?;
                    }
                    if head_updated > 0 {
                        tx.execute(
                            "UPDATE outbox_operations
                        SET base_revision_id=?2, updated_at_ms=?3
                      WHERE note_id=?1
                        AND client_sequence>?4
                        AND state IN ('pending', 'in_flight')
                        AND base_revision_id IS ?5",
                            params![
                                note_id,
                                revision_owned,
                                now,
                                client_sequence,
                                previous_base_revision
                            ],
                        )?;
                    }
                }
                "retry_predecessor" => {
                    tx.execute(
                        "UPDATE outbox_operations
                        SET state='pending', retry_after_ms=?2,
                            claim_token=NULL, claim_expires_at_ms=NULL,
                            last_error_code='retry_predecessor', updated_at_ms=?3
                      WHERE op_id=?1",
                        params![op_id_owned, now + 1_000, now],
                    )?;
                }
                "conflict" | "rejected_access" | "rejected_epoch" => {
                    let state = if result_owned == "conflict" {
                        "in_flight"
                    } else {
                        "rejected"
                    };
                    tx.execute(
                        "UPDATE outbox_operations
                        SET state=?2, accepted_revision_id=?3,
                            retry_after_ms=?4, last_error_code=?5, updated_at_ms=?6
                      WHERE op_id=?1",
                        params![
                            op_id_owned,
                            state,
                            revision_owned,
                            if result_owned == "conflict" {
                                Some(now + 1_000)
                            } else {
                                None
                            },
                            if result_owned == "conflict" {
                                "conflict_materialization_pending"
                            } else {
                                result_owned.as_str()
                            },
                            now
                        ],
                    )?;
                    tx.execute(
                        "INSERT OR IGNORE INTO recovery_branches (
                       id, note_id, kind, payload_relative_path, payload_sha256,
                       base_revision_id, remote_revision_id, source_op_id, created_at_ms
                     ) VALUES (?1, ?2, ?3, ?4, ?5,
                               (SELECT base_revision_id FROM note_heads WHERE note_id=?2),
                               ?6, ?7, ?8)",
                        params![
                            branch_id,
                            note_id,
                            if result_owned == "conflict" {
                                "local"
                            } else {
                                "rejected"
                            },
                            payload_path,
                            payload_sha256,
                            revision_owned,
                            op_id_owned,
                            now
                        ],
                    )?;
                    if operation_source == "team-space-move" {
                        tx.execute(
                            "UPDATE local_notes SET pending_scope_id=NULL, updated_at_ms=?2
                          WHERE note_id=?1",
                            params![note_id, now],
                        )?;
                    }
                    if result_owned == "rejected_access" {
                        tx.execute(
                            "UPDATE sync_scopes SET status='suspended', updated_at_ms=?2
                          WHERE scope_kind='team' AND scope_id=?1",
                            params![scope_id, now],
                        )?;
                    } else if result_owned == "rejected_epoch" {
                        tx.execute(
                            "UPDATE sync_scopes SET status='key_pending', updated_at_ms=?2
                          WHERE scope_kind='team' AND scope_id=?1",
                            params![scope_id, now],
                        )?;
                    }
                    if result_owned != "conflict" {
                        tx.execute(
                            "UPDATE outbox_operations
                            SET claim_token=NULL, claim_expires_at_ms=NULL
                          WHERE op_id=?1",
                            [&op_id_owned],
                        )?;
                    }
                }
                _ => unreachable!(),
            }
            tx.commit()?;
            Ok((payload_path, encrypted_path))
        })?;
    if result == "accepted" {
        fs::remove_file(workspace_path.join(".lokus").join(payload_relative_path))
            .map_err(|error| error.to_string())?;
    }
    if matches!(result, "accepted" | "rejected_access" | "rejected_epoch") {
        if let Some(relative_path) = encrypted_relative_path {
            let _ = fs::remove_file(workspace_path.join(".lokus").join(relative_path));
        }
    }
    Ok(())
}

pub fn finalize_team_conflict(
    store: &NoteStore,
    workspace_path: &Path,
    op_id: &str,
    claim_token: &str,
) -> Result<(), String> {
    let op_id = op_id.to_string();
    let claim_token = claim_token.to_string();
    let encrypted_path: Option<String> = store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let encrypted_path: Option<String> = tx.query_row(
            "SELECT encrypted_payload_relative_path
               FROM outbox_operations
              WHERE op_id=?1
                AND claim_token=?2
                AND state='in_flight'
                AND last_error_code='conflict_materialization_pending'",
            params![op_id, claim_token],
            |row| row.get(0),
        )?;
        tx.execute(
            "UPDATE outbox_operations
                SET state='conflicted', retry_after_ms=NULL,
                    claim_token=NULL, claim_expires_at_ms=NULL,
                    last_error_code='stale_head', updated_at_ms=?2
              WHERE op_id=?1",
            params![op_id, now_ms()],
        )?;
        tx.commit()?;
        Ok(encrypted_path)
    })?;
    if let Some(relative_path) = encrypted_path {
        let _ = fs::remove_file(workspace_path.join(".lokus").join(relative_path));
    }
    Ok(())
}

pub fn team_outbox_status(store: &NoteStore, op_id: &str) -> Result<TeamOutboxStatus, String> {
    let op_id = op_id.to_string();
    store.with_blocking(move |conn| {
        conn.query_row(
            "SELECT state, last_error_code FROM outbox_operations WHERE op_id=?1",
            [op_id],
            |row| {
                Ok(TeamOutboxStatus {
                    state: row.get(0)?,
                    last_error_code: row.get(1)?,
                })
            },
        )
    })
}

pub fn rollback_rejected_team_share(store: &NoteStore, op_id: &str) -> Result<(), String> {
    let op_id = op_id.to_string();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let (note_id, source): (String, String) = tx.query_row(
            "SELECT outbox.note_id, intent.source
               FROM outbox_operations outbox
               JOIN mutation_intents intent ON intent.op_id=outbox.op_id
              WHERE outbox.op_id=?1 AND outbox.state='rejected'",
            [&op_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let mut parts = source.splitn(3, '|');
        if parts.next() != Some("team-share") {
            return Err(rusqlite::Error::InvalidParameterName(
                "operation is not a rejected team share".to_string(),
            ));
        }
        let scope_kind = parts.next().ok_or_else(|| {
            rusqlite::Error::InvalidParameterName(
                "team share is missing previous scope".to_string(),
            )
        })?;
        let scope_id = parts.next().ok_or_else(|| {
            rusqlite::Error::InvalidParameterName(
                "team share is missing previous scope id".to_string(),
            )
        })?;
        tx.execute(
            "UPDATE local_notes
                SET scope_kind=?2, scope_id=?3, pending_scope_id=NULL,
                    updated_at_ms=?4
              WHERE note_id=?1",
            params![note_id, scope_kind, scope_id, now_ms()],
        )?;
        tx.execute(
            "UPDATE recovery_branches SET resolved_at_ms=?2
              WHERE source_op_id=?1 AND kind='rejected' AND resolved_at_ms IS NULL",
            params![op_id, now_ms()],
        )?;
        tx.commit()
    })
}

pub fn apply_team_remote_action(
    store: &NoteStore,
    workspace_path: &Path,
    action: &TeamRemoteAction,
) -> Result<TeamApplyOutcome, String> {
    let is_moved_out = action.action_type == "note_moved_out";
    if action.action_sequence < 1
        || action.permission_epoch < 1
        || (!is_moved_out && action.key_epoch < 1)
        || action.team_id.is_empty()
        || action.space_id.is_empty()
    {
        return Err("invalid remote team action".to_string());
    }
    let checkpoint: i64 = store.with_blocking({
        let space_id = action.space_id.clone();
        move |conn| {
            Ok(conn
                .query_row(
                    "SELECT last_applied_sequence FROM sync_checkpoints
                      WHERE scope_kind='team' AND scope_id=?1",
                    [space_id],
                    |row| row.get(0),
                )
                .optional()?
                .unwrap_or(0))
        }
    })?;
    if action.action_sequence <= checkpoint {
        return Ok(TeamApplyOutcome {
            status: "already_applied".to_string(),
            relative_path: action.relative_path.clone(),
        });
    }
    if action.action_sequence != checkpoint + 1 {
        return Err(format!(
            "team action gap: expected {}, received {}",
            checkpoint + 1,
            action.action_sequence
        ));
    }
    prepare_inbox_action(store, action)?;
    if action.action_type != "note_moved_in" && action.action_type != "note_moved_out" {
        let current_scope: Option<String> = store.with_blocking({
            let note_id = action.note_id.clone();
            move |conn| {
                conn.query_row(
                    "SELECT scope_id FROM local_notes
                      WHERE note_id=?1 AND scope_kind='team'",
                    [note_id],
                    |row| row.get(0),
                )
                .optional()
            }
        })?;
        if current_scope
            .as_deref()
            .is_some_and(|scope_id| scope_id != action.space_id)
        {
            record_moved_out_checkpoint(store, action)?;
            return Ok(TeamApplyOutcome {
                status: "already_moved".to_string(),
                relative_path: action.relative_path.clone(),
            });
        }
    }
    if is_moved_out {
        return apply_moved_out_action(store, workspace_path, action);
    }
    if !matches!(
        action.action_type.as_str(),
        "note_created"
            | "revision_accepted"
            | "note_tombstoned"
            | "note_restored"
            | "note_moved_in"
    ) {
        return Err(format!(
            "unsupported team action type: {}",
            action.action_type
        ));
    }
    let revision_id = action
        .revision_id
        .as_deref()
        .ok_or_else(|| "remote revision id is required".to_string())?;
    let content = action
        .content
        .as_deref()
        .ok_or_else(|| "remote revision content is required".to_string())?;
    let requested_relative = safe_relative_path(&action.relative_path)?;
    let requested_path_key = normalized_path_key(&requested_relative);
    let existing: Option<(String, String, i64, Option<String>)> = store.with_blocking({
        let note_id = action.note_id.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.relative_path, note.status,
                        (SELECT count(*) FROM outbox_operations outbox
                          WHERE outbox.note_id=note.note_id
                            AND outbox.state <> 'accepted'),
                        head.remote_revision_id
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.note_id=?1",
                [note_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()
        }
    })?;

    let is_tombstone = action.action_type == "note_tombstoned";
    let is_restore = action.action_type == "note_restored";
    let is_moved_in = action.action_type == "note_moved_in";
    let (status, applied_relative) =
        if let Some((relative_path, note_status, pending, remote_revision)) = existing {
            if remote_revision.as_deref() == Some(revision_id)
                || (is_tombstone && note_status == "tombstoned")
                || (is_restore && note_status == "active")
            {
                record_applied_action(store, action, revision_id, "applied")?;
                return Ok(TeamApplyOutcome {
                    status: "already_applied".to_string(),
                    relative_path,
                });
            }
            if is_restore && note_status != "tombstoned" {
                return Err("remote restore targets a non-tombstoned local note".to_string());
            }
            let missing_remote_write = note_status == "missing"
                && matches!(
                    action.action_type.as_str(),
                    "note_created" | "revision_accepted"
                );
            if !is_restore && !is_moved_in && note_status != "active" && !missing_remote_write {
                return Err("remote action targets a non-active local note".to_string());
            }
            if is_moved_in && !matches!(note_status.as_str(), "active" | "tombstoned") {
                return Err("remote move targets an unavailable local note".to_string());
            }
            if pending > 0 {
                stage_remote_recovery(store, workspace_path, action, content)?;
                ("conflict".to_string(), relative_path)
            } else if is_restore || (is_moved_in && note_status == "tombstoned") {
                commit_restore(
                    store,
                    workspace_path,
                    &action.note_id,
                    &relative_path,
                    content.as_bytes(),
                    "team-sync",
                )?;
                ("applied".to_string(), relative_path)
            } else if is_tombstone {
                commit_tombstone(store, workspace_path, &relative_path, "team-sync")?;
                ("applied".to_string(), relative_path)
            } else {
                let current_key = normalized_path_key(Path::new(&relative_path));
                if current_key != requested_path_key || relative_path != action.relative_path {
                    let target_key = requested_path_key.clone();
                    let note_id = action.note_id.clone();
                    let path_is_owned: bool = store.with_blocking(move |conn| {
                        conn.query_row(
                            "SELECT EXISTS(
                           SELECT 1 FROM local_notes
                            WHERE normalized_path_key=?1 AND note_id<>?2
                         )",
                            params![target_key, note_id],
                            |row| row.get(0),
                        )
                    })?;
                    let target_exists = workspace_path.join(&requested_relative).exists()
                        && current_key != requested_path_key;
                    if path_is_owned || target_exists {
                        stage_remote_recovery(store, workspace_path, action, content)?;
                        ("conflict".to_string(), relative_path)
                    } else {
                        commit_relocate(
                            store,
                            workspace_path,
                            &relative_path,
                            &action.relative_path,
                            "move",
                            "team-sync",
                        )?;
                        apply_remote_write(
                            store,
                            workspace_path,
                            &action.relative_path,
                            content.as_bytes(),
                            revision_id,
                            Some(action.action_sequence),
                        )?;
                        ("applied".to_string(), action.relative_path.clone())
                    }
                } else {
                    apply_remote_write(
                        store,
                        workspace_path,
                        &relative_path,
                        content.as_bytes(),
                        revision_id,
                        Some(action.action_sequence),
                    )?;
                    ("applied".to_string(), relative_path)
                }
            }
        } else {
            if is_tombstone || is_restore {
                return Err("remote lifecycle action targets an unknown local note".to_string());
            }
            let path_owner: Option<(String, String, String, i64)> =
                store.with_blocking(move |conn| {
                    conn.query_row(
                        "SELECT note.note_id, note.scope_kind, note.scope_id,
                            (SELECT count(*) FROM outbox_operations outbox
                              WHERE outbox.note_id=note.note_id
                                AND outbox.state IN ('pending', 'in_flight'))
                       FROM local_notes note
                      WHERE note.normalized_path_key=?1",
                        [requested_path_key],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                    )
                    .optional()
                })?;
            if let Some((personal_note_id, scope_kind, scope_id, pending)) = path_owner {
                if action.action_type == "note_created"
                    && matches!(scope_kind.as_str(), "personal" | "local_only")
                    && pending == 0
                {
                    let identity_scope = if scope_kind == "personal" {
                        scope_id.as_str()
                    } else {
                        "local-path"
                    };
                    let expected_note_id = promoted_team_note_id(
                        &action.team_id,
                        identity_scope,
                        &normalized_path_key(&requested_relative),
                    );
                    if action.note_id != expected_note_id {
                        let conflict_path = team_collision_path(action)?;
                        commit_create_with_note_id(
                            store,
                            workspace_path,
                            &conflict_path,
                            content.as_bytes(),
                            "team-sync",
                            &action.note_id,
                        )?;
                        ("applied".to_string(), conflict_path)
                    } else {
                        let local_content =
                            fs::read_to_string(workspace_path.join(&requested_relative))
                                .map_err(|error| error.to_string())?;
                        adopt_personal_note_identity(store, &personal_note_id, &action.note_id)?;
                        if local_content != content {
                            stage_local_recovery_content(
                                store,
                                workspace_path,
                                action,
                                &local_content,
                            )?;
                            stage_remote_recovery(store, workspace_path, action, content)?;
                            ("conflict".to_string(), action.relative_path.clone())
                        } else {
                            apply_remote_write(
                                store,
                                workspace_path,
                                &action.relative_path,
                                content.as_bytes(),
                                revision_id,
                                Some(action.action_sequence),
                            )?;
                            ("applied".to_string(), action.relative_path.clone())
                        }
                    }
                } else {
                    return Err("remote team note path collides with a local note".to_string());
                }
            } else if workspace_path.join(&requested_relative).exists() {
                return Err("remote team note path collides with a local note".to_string());
            } else {
                commit_create_with_note_id(
                    store,
                    workspace_path,
                    &action.relative_path,
                    content.as_bytes(),
                    "team-sync",
                    &action.note_id,
                )?;
                ("applied".to_string(), action.relative_path.clone())
            }
        };

    record_applied_action(store, action, revision_id, &status)?;
    Ok(TeamApplyOutcome {
        status,
        relative_path: applied_relative,
    })
}

fn adopt_personal_note_identity(
    store: &NoteStore,
    personal_note_id: &str,
    team_note_id: &str,
) -> Result<(), String> {
    uuid::Uuid::parse_str(team_note_id).map_err(|_| "team note id must be a UUID".to_string())?;
    let personal_note_id = personal_note_id.to_string();
    let team_note_id = team_note_id.to_string();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.pragma_update(None, "defer_foreign_keys", "ON")?;
        tx.execute(
            "UPDATE local_notes SET note_id=?2
              WHERE note_id=?1 AND scope_kind IN ('personal', 'local_only')",
            params![personal_note_id, team_note_id],
        )?;
        for table in [
            "note_heads",
            "note_path_history",
            "mutation_intents",
            "outbox_operations",
            "local_tombstones",
            "recovery_branches",
            "note_mutation_locks",
            "inbox_actions",
        ] {
            tx.execute(
                &format!("UPDATE {table} SET note_id=?2 WHERE note_id=?1"),
                params![personal_note_id, team_note_id],
            )?;
        }
        tx.commit()
    })
}

pub fn team_sync_checkpoint(store: &NoteStore, space_id: &str) -> Result<i64, String> {
    let space_id = space_id.to_string();
    store.with_blocking(move |conn| {
        Ok(conn
            .query_row(
                "SELECT last_applied_sequence FROM sync_checkpoints
                  WHERE scope_kind='team' AND scope_id=?1",
                [space_id],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(0))
    })
}

fn prepare_inbox_action(store: &NoteStore, action: &TeamRemoteAction) -> Result<(), String> {
    let action = action.clone();
    store.with_blocking(move |conn| {
        conn.execute(
            "INSERT INTO inbox_actions (
               action_id, scope_id, action_sequence, action_type,
               note_id, revision_id, state, received_at_ms,
               team_id, permission_epoch, key_epoch, relative_path
             ) VALUES (
               ?1, ?2, ?3, ?4, ?5, ?6, 'received', ?7,
               ?8, ?9, ?10, ?11
             )
             ON CONFLICT (action_id) DO NOTHING",
            params![
                action.action_id,
                action.space_id,
                action.action_sequence,
                action.action_type,
                action.note_id,
                action.revision_id,
                now_ms(),
                action.team_id,
                action.permission_epoch,
                action.key_epoch,
                action.relative_path
            ],
        )?;
        Ok(())
    })
}

fn apply_moved_out_action(
    store: &NoteStore,
    workspace_path: &Path,
    action: &TeamRemoteAction,
) -> Result<TeamApplyOutcome, String> {
    let existing: Option<(String, String, String, i64)> = store.with_blocking({
        let note_id = action.note_id.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.relative_path, note.status, note.scope_id,
                        (SELECT count(*) FROM outbox_operations outbox
                          WHERE outbox.note_id=note.note_id
                            AND outbox.state IN ('pending', 'in_flight'))
                   FROM local_notes note
                  WHERE note.note_id=?1",
                [note_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()
        }
    })?;
    let (status, relative_path) = match existing {
        None => ("already_absent".to_string(), String::new()),
        Some((relative_path, _, current_scope, _)) if current_scope != action.space_id => {
            ("already_moved".to_string(), relative_path)
        }
        Some((relative_path, note_status, _, pending)) if note_status == "active" => {
            if pending > 0 {
                preserve_moved_out_operations(store, &action.note_id)?;
            }
            commit_tombstone(store, workspace_path, &relative_path, "team-sync")?;
            (
                if pending > 0 { "conflict" } else { "applied" }.to_string(),
                relative_path,
            )
        }
        Some((relative_path, _, _, _)) => ("already_absent".to_string(), relative_path),
    };
    record_moved_out_checkpoint(store, action)?;
    Ok(TeamApplyOutcome {
        status,
        relative_path,
    })
}

fn preserve_moved_out_operations(store: &NoteStore, note_id: &str) -> Result<(), String> {
    let note_id = note_id.to_string();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut statement = tx.prepare(
            "SELECT outbox.op_id, outbox.payload_relative_path,
                    intent.payload_sha256, outbox.base_revision_id
               FROM outbox_operations outbox
               JOIN mutation_intents intent ON intent.op_id=outbox.op_id
              WHERE outbox.note_id=?1
                AND outbox.state IN ('pending', 'in_flight')",
        )?;
        let operations: Vec<(String, String, String, Option<String>)> = statement
            .query_map([&note_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })?
            .collect::<rusqlite::Result<_>>()?;
        drop(statement);
        for (op_id, payload_path, payload_hash, base_revision_id) in operations {
            tx.execute(
                "INSERT OR IGNORE INTO recovery_branches (
                   id, note_id, kind, payload_relative_path, payload_sha256,
                   base_revision_id, source_op_id, created_at_ms
                 ) VALUES (?1, ?2, 'local', ?3, ?4, ?5, ?6, ?7)",
                params![
                    new_note_id(),
                    note_id,
                    payload_path,
                    payload_hash,
                    base_revision_id,
                    op_id,
                    now_ms()
                ],
            )?;
        }
        tx.execute(
            "UPDATE outbox_operations
                SET state='conflicted', last_error_code='note_moved_out',
                    updated_at_ms=?2
              WHERE note_id=?1 AND state IN ('pending', 'in_flight')",
            params![note_id, now_ms()],
        )?;
        tx.commit()
    })
}

fn record_moved_out_checkpoint(store: &NoteStore, action: &TeamRemoteAction) -> Result<(), String> {
    let action = action.clone();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        if action.key_epoch > 0 {
            tx.execute(
                "INSERT INTO sync_scopes (
                   scope_kind, scope_id, team_id, permission_epoch, key_epoch,
                   status, created_at_ms, updated_at_ms
                 ) VALUES ('team', ?1, ?2, ?3, ?4, 'active', ?5, ?5)
                 ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
                   permission_epoch=max(
                     sync_scopes.permission_epoch,
                     excluded.permission_epoch
                   ),
                   key_epoch=max(sync_scopes.key_epoch, excluded.key_epoch),
                   updated_at_ms=excluded.updated_at_ms",
                params![
                    action.space_id,
                    action.team_id,
                    action.permission_epoch,
                    action.key_epoch,
                    now_ms()
                ],
            )?;
        }
        tx.execute(
            "INSERT INTO inbox_actions (
               action_id, scope_id, action_sequence, action_type,
               note_id, state, received_at_ms, applied_at_ms
             ) VALUES (?1, ?2, ?3, ?4, ?5, 'applied', ?6, ?6)
             ON CONFLICT (action_id) DO UPDATE SET
               state='applied',
               applied_at_ms=excluded.applied_at_ms,
               error_code=NULL",
            params![
                action.action_id,
                action.space_id,
                action.action_sequence,
                action.action_type,
                action.note_id,
                now_ms()
            ],
        )?;
        tx.execute(
            "INSERT INTO sync_checkpoints (
               scope_kind, scope_id, last_applied_sequence, updated_at_ms
             ) VALUES ('team', ?1, ?2, ?3)
             ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
               last_applied_sequence=excluded.last_applied_sequence,
               updated_at_ms=excluded.updated_at_ms",
            params![action.space_id, action.action_sequence, now_ms()],
        )?;
        tx.commit()
    })
}

pub fn apply_team_membership_hint(
    store: &NoteStore,
    team_id: &str,
    membership_status: &str,
    permission_epoch: i64,
) -> Result<Vec<TeamScopeKey>, String> {
    if team_id.is_empty()
        || permission_epoch < 1
        || !matches!(
            membership_status,
            "active" | "key_pending" | "suspended" | "removed"
        )
    {
        return Err("invalid team membership hint".to_string());
    }
    let team_id = team_id.to_string();
    let membership_status = membership_status.to_string();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut scope_statement = tx.prepare(
            "SELECT scope_id, key_epoch
               FROM sync_scopes
              WHERE scope_kind='team' AND team_id=?1
              ORDER BY scope_id",
        )?;
        let scopes: Vec<TeamScopeKey> = scope_statement
            .query_map([&team_id], |row| {
                Ok(TeamScopeKey {
                    space_id: row.get(0)?,
                    key_epoch: row.get(1)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        drop(scope_statement);

        tx.execute(
            "UPDATE sync_scopes
                SET permission_epoch=?2, status=?3, updated_at_ms=?4
              WHERE scope_kind='team' AND team_id=?1",
            params![team_id, permission_epoch, membership_status, now_ms()],
        )?;

        if matches!(membership_status.as_str(), "removed" | "suspended") {
            let mut outbox_statement = tx.prepare(
                "SELECT outbox.op_id, outbox.note_id,
                        outbox.payload_relative_path, intent.payload_sha256,
                        outbox.base_revision_id
                   FROM outbox_operations outbox
                   JOIN local_notes note ON note.note_id=outbox.note_id
                   JOIN sync_scopes scope
                     ON scope.scope_kind=outbox.scope_kind
                    AND scope.scope_id=outbox.scope_id
                   JOIN mutation_intents intent ON intent.op_id=outbox.op_id
                  WHERE outbox.scope_kind='team'
                    AND scope.team_id=?1
                    AND outbox.state IN ('pending', 'in_flight')",
            )?;
            let operations: Vec<(String, String, String, String, Option<String>)> =
                outbox_statement
                    .query_map([&team_id], |row| {
                        Ok((
                            row.get(0)?,
                            row.get(1)?,
                            row.get(2)?,
                            row.get(3)?,
                            row.get(4)?,
                        ))
                    })?
                    .collect::<rusqlite::Result<_>>()?;
            drop(outbox_statement);
            for (op_id, note_id, payload_path, payload_hash, base_revision_id) in operations {
                tx.execute(
                    "INSERT OR IGNORE INTO recovery_branches (
                       id, note_id, kind, payload_relative_path, payload_sha256,
                       base_revision_id, source_op_id, created_at_ms
                     ) VALUES (?1, ?2, 'rejected', ?3, ?4, ?5, ?6, ?7)",
                    params![
                        new_note_id(),
                        note_id,
                        payload_path,
                        payload_hash,
                        base_revision_id,
                        op_id,
                        now_ms()
                    ],
                )?;
            }
            tx.execute(
                "UPDATE outbox_operations
                    SET state='rejected', last_error_code=?2, updated_at_ms=?3
                  WHERE scope_kind='team'
                    AND scope_id IN (
                      SELECT scope_id FROM sync_scopes
                       WHERE scope_kind='team' AND team_id=?1
                    )
                    AND state IN ('pending', 'in_flight')",
                params![team_id, format!("membership_{membership_status}"), now_ms()],
            )?;
        }
        tx.commit()?;
        Ok(scopes)
    })
}

pub fn upsert_team_sync_scope(
    store: &NoteStore,
    team_id: &str,
    space_id: &str,
    permission_epoch: i64,
    key_epoch: i64,
) -> Result<(), String> {
    if team_id.is_empty() || space_id.is_empty() || permission_epoch < 1 || key_epoch < 1 {
        return Err("invalid team sync scope".to_string());
    }
    let team_id = team_id.to_string();
    let space_id = space_id.to_string();
    store.with_blocking(move |conn| {
        conn.execute(
            "INSERT INTO sync_scopes (
               scope_kind, scope_id, team_id, permission_epoch, key_epoch,
               status, created_at_ms, updated_at_ms
             ) VALUES ('team', ?1, ?2, ?3, ?4, 'active', ?5, ?5)
             ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
               team_id=excluded.team_id,
               permission_epoch=max(
                 sync_scopes.permission_epoch,
                 excluded.permission_epoch
               ),
               key_epoch=max(sync_scopes.key_epoch, excluded.key_epoch),
               status='active',
               updated_at_ms=excluded.updated_at_ms",
            params![space_id, team_id, permission_epoch, key_epoch, now_ms()],
        )?;
        Ok(())
    })
}

pub fn stage_team_conflict_snapshots(
    store: &NoteStore,
    workspace_path: &Path,
    note_id: &str,
    base_revision_id: Option<&str>,
    base_content: &[u8],
    remote_revision_id: &str,
    remote_content: &[u8],
) -> Result<(), String> {
    if note_id.is_empty() || remote_revision_id.is_empty() {
        return Err("conflict note and remote revision are required".to_string());
    }
    let note_exists: bool = store.with_blocking({
        let note_id = note_id.to_string();
        move |conn| {
            conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM local_notes WHERE note_id=?1)",
                [note_id],
                |row| row.get(0),
            )
        }
    })?;
    if !note_exists {
        return Err("conflict note identity is unknown".to_string());
    }

    let snapshots = [
        ("base", base_revision_id, base_content),
        ("remote", Some(remote_revision_id), remote_content),
    ];
    let mut staged = Vec::new();
    for (kind, revision_id, content) in snapshots {
        let already_staged: bool = store.with_blocking({
            let note_id = note_id.to_string();
            let kind = kind.to_string();
            let revision_id = revision_id.map(str::to_string);
            move |conn| {
                conn.query_row(
                    "SELECT EXISTS(
                       SELECT 1 FROM recovery_branches
                        WHERE note_id=?1 AND kind=?2 AND resolved_at_ms IS NULL
                          AND (
                            (?2='base' AND base_revision_id IS ?3)
                            OR (?2='remote' AND remote_revision_id IS ?3)
                          )
                     )",
                    params![note_id, kind, revision_id],
                    |row| row.get(0),
                )
            }
        })?;
        if already_staged {
            continue;
        }
        let branch_id = new_note_id();
        let relative_path = format!("recovery/{branch_id}.payload");
        let path = workspace_path.join(".lokus").join(&relative_path);
        fs::create_dir_all(
            path.parent()
                .ok_or_else(|| "conflict payload has no parent".to_string())?,
        )
        .map_err(|error| error.to_string())?;
        atomic_replace(&path, content, &branch_id)?;
        staged.push((
            branch_id,
            kind.to_string(),
            revision_id.map(str::to_string),
            relative_path,
            hex::encode(Sha256::digest(content)),
            path,
        ));
    }
    let result = store.with_blocking({
        let note_id = note_id.to_string();
        let inserts = staged.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            for (id, kind, revision_id, relative_path, hash, _) in inserts {
                tx.execute(
                    "INSERT INTO recovery_branches (
                       id, note_id, kind, payload_relative_path, payload_sha256,
                       base_revision_id, remote_revision_id, created_at_ms
                     ) VALUES (
                       ?1, ?2, ?3, ?4, ?5,
                       CASE WHEN ?3='base' THEN ?6 ELSE NULL END,
                       CASE WHEN ?3='remote' THEN ?6 ELSE NULL END,
                       ?7
                     )",
                    params![
                        id,
                        note_id,
                        kind,
                        relative_path,
                        hash,
                        revision_id,
                        now_ms()
                    ],
                )?;
            }
            tx.commit()
        }
    });
    if let Err(error) = result {
        for (_, _, _, _, _, path) in staged {
            let _ = fs::remove_file(path);
        }
        return Err(error);
    }
    Ok(())
}

pub fn resolve_team_conflict(
    store: &NoteStore,
    workspace_path: &Path,
    note_id: &str,
    resolution_content: &[u8],
) -> Result<super::mutation::WriteCommit, String> {
    let note_id_owned = note_id.to_string();
    let (relative_path, remote_payload_path, remote_revision_id): (String, String, String) = store
        .with_blocking(move |conn| {
            conn.query_row(
                "SELECT note.relative_path, branch.payload_relative_path,
                        branch.remote_revision_id
                   FROM local_notes note
                   JOIN recovery_branches branch ON branch.note_id=note.note_id
                  WHERE note.note_id=?1
                    AND branch.kind='remote'
                    AND branch.resolved_at_ms IS NULL
                  ORDER BY branch.created_at_ms DESC
                  LIMIT 1",
                [note_id_owned],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
        })?;
    let remote_content = fs::read(workspace_path.join(".lokus").join(remote_payload_path))
        .map_err(|error| error.to_string())?;
    let remote_commit = apply_remote_write(
        store,
        workspace_path,
        &relative_path,
        &remote_content,
        &remote_revision_id,
        None,
    )?;
    let resolution = if resolution_content == remote_content {
        remote_commit
    } else {
        super::mutation::commit_write(
            store,
            workspace_path,
            &relative_path,
            resolution_content,
            remote_commit.local_generation,
            "conflict-resolution",
        )?
    };
    let note_id = note_id.to_string();
    store.with_blocking(move |conn| {
        conn.execute(
            "UPDATE recovery_branches SET resolved_at_ms=?2
              WHERE note_id=?1 AND resolved_at_ms IS NULL",
            params![note_id, now_ms()],
        )?;
        Ok(())
    })?;
    Ok(resolution)
}

pub fn resolve_local_recovery(
    store: &NoteStore,
    workspace_path: &Path,
    note_id: &str,
    kind: &str,
    resolution_content: &[u8],
) -> Result<super::mutation::WriteCommit, String> {
    if !matches!(kind, "external" | "rejected") {
        return Err("unsupported local recovery kind".to_string());
    }
    let note_id_owned = note_id.to_string();
    let kind_owned = kind.to_string();
    let (relative_path, generation): (String, i64) = store.with_blocking({
        let note_id = note_id_owned.clone();
        let kind = kind_owned.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.relative_path, head.local_generation
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.note_id=?1
                    AND EXISTS (
                      SELECT 1 FROM recovery_branches branch
                       WHERE branch.note_id=note.note_id
                         AND branch.kind=?2
                         AND branch.resolved_at_ms IS NULL
                    )",
                params![note_id, kind],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
        }
    })?;
    if kind == "rejected" {
        store.with_blocking({
            let note_id = note_id_owned.clone();
            move |conn| {
                let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
                tx.execute(
                    "INSERT OR IGNORE INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('local_only', 'workspace', 'active', ?1, ?1)",
                    [now_ms()],
                )?;
                tx.execute(
                    "UPDATE local_notes
                        SET scope_kind='local_only', scope_id='workspace',
                            pending_scope_id=NULL, updated_at_ms=?2
                      WHERE note_id=?1",
                    params![note_id, now_ms()],
                )?;
                tx.commit()
            }
        })?;
    }
    let commit = super::mutation::commit_write(
        store,
        workspace_path,
        &relative_path,
        resolution_content,
        generation,
        "recovery-resolution",
    )?;
    store.with_blocking(move |conn| {
        conn.execute(
            "UPDATE recovery_branches SET resolved_at_ms=?3
              WHERE note_id=?1 AND kind=?2 AND resolved_at_ms IS NULL",
            params![note_id_owned, kind_owned, now_ms()],
        )?;
        Ok(())
    })?;
    Ok(commit)
}

pub fn get_team_conflict_snapshots(
    store: &NoteStore,
    workspace_path: &Path,
    note_id: &str,
) -> Result<Vec<TeamConflictSnapshot>, String> {
    let note_id = note_id.to_string();
    let rows: Vec<(String, String, Option<String>, Option<String>)> =
        store.with_blocking(move |conn| {
            let mut statement = conn.prepare(
                "WITH ranked AS (
                   SELECT kind, payload_relative_path,
                          base_revision_id, remote_revision_id,
                          row_number() OVER (
                            PARTITION BY kind
                            ORDER BY created_at_ms DESC, id DESC
                          ) AS rank
                     FROM recovery_branches
                    WHERE note_id=?1
                      AND resolved_at_ms IS NULL
                      AND kind IN ('base', 'local', 'remote', 'external', 'rejected')
                 )
                 SELECT kind, payload_relative_path,
                        base_revision_id, remote_revision_id
                   FROM ranked
                  WHERE rank=1
                  ORDER BY kind",
            )?;
            let values = statement
                .query_map([note_id], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })?
                .collect::<rusqlite::Result<_>>()?;
            Ok(values)
        })?;
    rows.into_iter()
        .map(
            |(kind, payload_relative_path, base_revision_id, remote_revision_id)| {
                let bytes = fs::read(workspace_path.join(".lokus").join(payload_relative_path))
                    .map_err(|error| error.to_string())?;
                let content = String::from_utf8(bytes)
                    .map_err(|_| "conflict snapshot is not valid UTF-8".to_string())?;
                Ok(TeamConflictSnapshot {
                    kind,
                    content,
                    base_revision_id,
                    remote_revision_id,
                })
            },
        )
        .collect()
}

pub fn unresolved_team_conflict_note_ids(store: &NoteStore) -> Result<Vec<String>, String> {
    store.with_blocking(|conn| {
        let mut statement = conn.prepare(
            "SELECT note_id
               FROM recovery_branches
              WHERE resolved_at_ms IS NULL
                AND kind IN ('local', 'remote', 'external', 'rejected')
              GROUP BY note_id
             HAVING sum(CASE WHEN kind IN ('external', 'rejected') THEN 1 ELSE 0 END) > 0
                 OR count(DISTINCT CASE WHEN kind IN ('local', 'remote') THEN kind END) = 2
              ORDER BY min(created_at_ms)",
        )?;
        let values = statement
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(values)
    })
}

fn stage_remote_recovery(
    store: &NoteStore,
    workspace_path: &Path,
    action: &TeamRemoteAction,
    content: &str,
) -> Result<(), String> {
    let branch_id = new_note_id();
    let payload_relative_path = format!("recovery/{branch_id}.payload");
    let target = workspace_path.join(".lokus").join(&payload_relative_path);
    fs::create_dir_all(
        target
            .parent()
            .ok_or_else(|| "recovery payload has no parent".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    atomic_replace(&target, content.as_bytes(), &branch_id)?;
    let hash = hex::encode(Sha256::digest(content.as_bytes()));
    let note_id = action.note_id.clone();
    let revision_id = action.revision_id.clone();
    let source_op_id = action.action_id.clone();
    let result = store.with_blocking({
        let branch_id = branch_id.clone();
        let payload_relative_path = payload_relative_path.clone();
        move |conn| {
            conn.execute(
                "INSERT INTO recovery_branches (
                   id, note_id, kind, payload_relative_path, payload_sha256,
                   remote_revision_id, source_op_id, created_at_ms
                 ) VALUES (?1, ?2, 'remote', ?3, ?4, ?5, ?6, ?7)",
                params![
                    branch_id,
                    note_id,
                    payload_relative_path,
                    hash,
                    revision_id,
                    source_op_id,
                    now_ms()
                ],
            )?;
            Ok(())
        }
    });
    if let Err(error) = result {
        let _ = fs::remove_file(target);
        return Err(error);
    }
    Ok(())
}

fn stage_local_recovery_content(
    store: &NoteStore,
    workspace_path: &Path,
    action: &TeamRemoteAction,
    content: &str,
) -> Result<(), String> {
    let branch_id = new_note_id();
    let payload_relative_path = format!("recovery/{branch_id}.payload");
    let target = workspace_path.join(".lokus").join(&payload_relative_path);
    fs::create_dir_all(
        target
            .parent()
            .ok_or_else(|| "recovery payload has no parent".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    atomic_replace(&target, content.as_bytes(), &branch_id)?;
    let hash = hex::encode(Sha256::digest(content.as_bytes()));
    let note_id = action.note_id.clone();
    let remote_revision_id = action.revision_id.clone();
    let source_action_id = action.action_id.clone();
    let result = store.with_blocking({
        let branch_id = branch_id.clone();
        let payload_relative_path = payload_relative_path.clone();
        move |conn| {
            conn.execute(
                "INSERT INTO recovery_branches (
                   id, note_id, kind, payload_relative_path, payload_sha256,
                   remote_revision_id, source_op_id, created_at_ms
                 ) VALUES (?1, ?2, 'local', ?3, ?4, ?5, ?6, ?7)",
                params![
                    branch_id,
                    note_id,
                    payload_relative_path,
                    hash,
                    remote_revision_id,
                    source_action_id,
                    now_ms()
                ],
            )?;
            Ok(())
        }
    });
    if let Err(error) = result {
        let _ = fs::remove_file(target);
        return Err(error);
    }
    Ok(())
}

fn record_applied_action(
    store: &NoteStore,
    action: &TeamRemoteAction,
    revision_id: &str,
    apply_status: &str,
) -> Result<(), String> {
    let action = action.clone();
    let revision_id = revision_id.to_string();
    let apply_status = apply_status.to_string();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute(
            "INSERT INTO sync_scopes (
               scope_kind, scope_id, team_id, permission_epoch, key_epoch,
               status, created_at_ms, updated_at_ms
             ) VALUES ('team', ?1, ?2, ?3, ?4, 'active', ?5, ?5)
             ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
               team_id=excluded.team_id,
               permission_epoch=max(
                 sync_scopes.permission_epoch,
                 excluded.permission_epoch
               ),
               key_epoch=max(sync_scopes.key_epoch, excluded.key_epoch),
               status='active',
               updated_at_ms=excluded.updated_at_ms",
            params![
                action.space_id,
                action.team_id,
                action.permission_epoch,
                action.key_epoch,
                now_ms()
            ],
        )?;
        tx.execute(
            "UPDATE local_notes
                SET scope_kind='team', scope_id=?2,
                    pending_scope_id=CASE
                      WHEN ?4='note_moved_in' THEN NULL
                      ELSE pending_scope_id
                    END,
                    updated_at_ms=?3
              WHERE note_id=?1",
            params![
                action.note_id,
                action.space_id,
                now_ms(),
                action.action_type
            ],
        )?;
        if apply_status == "conflict" {
            tx.execute(
                "UPDATE note_heads
                    SET remote_revision_id=?2, remote_sequence=?3,
                        remote_space_id=?4, updated_at_ms=?5
                  WHERE note_id=?1",
                params![
                    action.note_id,
                    revision_id,
                    action.action_sequence,
                    action.space_id,
                    now_ms()
                ],
            )?;
        } else {
            tx.execute(
                "UPDATE note_heads
                    SET remote_revision_id=?2, remote_sequence=?3,
                        remote_space_id=?4,
                        base_revision_id=?2, base_hash=local_hash,
                        updated_at_ms=?5
                  WHERE note_id=?1",
                params![
                    action.note_id,
                    revision_id,
                    action.action_sequence,
                    action.space_id,
                    now_ms()
                ],
            )?;
        }
        tx.execute(
            "INSERT INTO inbox_actions (
               action_id, scope_id, action_sequence, action_type,
               note_id, revision_id, state, received_at_ms, applied_at_ms
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'applied', ?7, ?7)
             ON CONFLICT (action_id) DO UPDATE SET
               state='applied',
               applied_at_ms=excluded.applied_at_ms,
               error_code=NULL",
            params![
                action.action_id,
                action.space_id,
                action.action_sequence,
                action.action_type,
                action.note_id,
                revision_id,
                now_ms()
            ],
        )?;
        tx.execute(
            "INSERT INTO sync_checkpoints (
               scope_kind, scope_id, last_applied_sequence, updated_at_ms
             ) VALUES ('team', ?1, ?2, ?3)
             ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
               last_applied_sequence=excluded.last_applied_sequence,
               updated_at_ms=excluded.updated_at_ms",
            params![action.space_id, action.action_sequence, now_ms()],
        )?;
        tx.commit()
    })
}

fn safe_relative_path(value: &str) -> Result<std::path::PathBuf, String> {
    let path = Path::new(value);
    if value.is_empty()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("invalid relative note path".to_string());
    }
    Ok(path.to_path_buf())
}

fn promoted_team_note_id(team_id: &str, identity_scope: &str, normalized_path: &str) -> String {
    let team_namespace = uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_OID, team_id.as_bytes());
    uuid::Uuid::new_v5(
        &team_namespace,
        format!("{identity_scope}\0{normalized_path}").as_bytes(),
    )
    .to_string()
}

fn team_collision_path(action: &TeamRemoteAction) -> Result<String, String> {
    let requested = safe_relative_path(&action.relative_path)?;
    let filename = requested
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "team note has no filename".to_string())?;
    let (stem, extension) = filename
        .rsplit_once('.')
        .map(|(stem, extension)| (stem, extension))
        .unwrap_or((filename, "md"));
    let short_id = action.note_id.chars().take(8).collect::<String>();
    Ok(format!(
        "Lokus Conflicts/{stem} (team {short_id}).{extension}"
    ))
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::super::backfill::backfill_workspace;
    use super::*;

    fn setup() -> (tempfile::TempDir, NoteStore) {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "team draft").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        (workspace, store)
    }

    #[test]
    fn sharing_a_note_creates_a_durable_team_outbox_snapshot() {
        let (workspace, store) = setup();

        configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entries = claim_team_outbox(&store, workspace.path(), "space-1", 10).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].content, "team draft");
        assert_eq!(entries[0].team_id, "team-1");
        assert_eq!(entries[0].operation_kind, "write");
        assert_eq!(entries[0].client_sequence, 1);

        stage_team_outbox_ciphertext(
            &store,
            workspace.path(),
            &entries[0].op_id,
            1,
            &entries[0].claim_token,
            b"stable ciphertext",
        )
        .unwrap();
        store
            .with_blocking(|conn| {
                conn.execute("UPDATE outbox_operations SET claim_expires_at_ms=0", [])?;
                Ok(())
            })
            .unwrap();
        let retried = claim_team_outbox(&store, workspace.path(), "space-1", 10).unwrap();
        let expected_ciphertext = BASE64.encode(b"stable ciphertext");
        assert_eq!(
            retried[0].encrypted_payload_base64.as_deref(),
            Some(expected_ciphertext.as_str())
        );
        upsert_team_sync_scope(&store, "team-1", "space-1", 2, 2).unwrap();
        store
            .with_blocking(|conn| {
                conn.execute("UPDATE outbox_operations SET claim_expires_at_ms=0", [])?;
                Ok(())
            })
            .unwrap();
        let rotated = claim_team_outbox(&store, workspace.path(), "space-1", 10).unwrap();
        assert_eq!(rotated[0].key_epoch, 2);
        assert_eq!(rotated[0].encrypted_payload_base64, None);
    }

    #[test]
    fn expired_claim_cannot_complete_after_a_new_worker_takes_over() {
        let (workspace, store) = setup();
        configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let first = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        assert!(claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .is_empty());
        store
            .with_blocking(|conn| {
                conn.execute("UPDATE outbox_operations SET claim_expires_at_ms=0", [])?;
                Ok(())
            })
            .unwrap();
        let replacement = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        assert_ne!(first.claim_token, replacement.claim_token);

        assert!(complete_team_push(
            &store,
            workspace.path(),
            &first.op_id,
            &first.claim_token,
            "accepted",
            Some("stale-revision"),
            Some(1),
        )
        .is_err());
        complete_team_push(
            &store,
            workspace.path(),
            &replacement.op_id,
            &replacement.claim_token,
            "accepted",
            Some("current-revision"),
            Some(1),
        )
        .unwrap();
        let remote: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT remote_revision_id FROM note_heads", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(remote, "current-revision");
    }

    #[test]
    fn personal_note_handoff_clears_non_uuid_heads_before_team_share() {
        let (workspace, store) = setup();
        store
            .with_blocking(|conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('personal', 'personal-workspace', 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "UPDATE local_notes
                        SET scope_kind='personal', scope_id='personal-workspace'",
                    [],
                )?;
                conn.execute(
                    "UPDATE note_heads
                        SET remote_revision_id='manifest-hash',
                            base_revision_id='manifest-hash'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();

        configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entry = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);

        assert_eq!(entry.base_revision_id, None);
        let scope: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT scope_kind FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(scope, "team");
    }

    #[test]
    fn personal_promotions_use_the_same_cross_device_team_identity() {
        let (workspace_a, store_a) = setup();
        let (workspace_b, store_b) = setup();
        for store in [&store_a, &store_b] {
            store
                .with_blocking(|conn| {
                    conn.execute(
                        "INSERT INTO sync_scopes (
                           scope_kind, scope_id, status, created_at_ms, updated_at_ms
                         ) VALUES ('personal', 'personal-workspace', 'active', 1, 1)",
                        [],
                    )?;
                    conn.execute(
                        "UPDATE local_notes
                            SET scope_kind='personal', scope_id='personal-workspace'",
                        [],
                    )?;
                    Ok(())
                })
                .unwrap();
        }

        configure_note_team_scope(
            &store_a,
            workspace_a.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        configure_note_team_scope(
            &store_b,
            workspace_b.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let id_a: String = store_a
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        let id_b: String = store_b
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(id_a, id_b);
    }

    #[test]
    fn accepted_cross_space_move_switches_scope_only_after_server_cas() {
        let (workspace, store) = setup();
        configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let first = claim_team_outbox(&store, workspace.path(), "space-1", 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &first.op_id,
            &first.claim_token,
            "accepted",
            Some("revision-1"),
            Some(1),
        )
        .unwrap();

        let move_op = queue_team_space_move(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-2",
            1,
            4,
        )
        .unwrap();
        let move_entry = claim_team_outbox(&store, workspace.path(), "space-2", 1)
            .unwrap()
            .remove(0);
        assert_eq!(move_entry.operation_kind, "move");
        let before: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT scope_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(before, "space-1");
        assert!(super::super::mutation::commit_write(
            &store,
            workspace.path(),
            "note.md",
            b"blocked edit",
            0,
            "editor",
        )
        .unwrap_err()
        .contains("move is pending"));

        complete_team_push(
            &store,
            workspace.path(),
            &move_op,
            &move_entry.claim_token,
            "accepted",
            Some("revision-2"),
            Some(1),
        )
        .unwrap();

        let after: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT scope_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(after, "space-2");
    }

    #[test]
    fn accepted_push_advances_the_remote_base_and_removes_payload() {
        let (workspace, store) = setup();
        let op_id = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entry = claim_team_outbox(&store, workspace.path(), "space-1", 1)
            .unwrap()
            .remove(0);
        let payload_path = workspace
            .path()
            .join(".lokus")
            .join("outbox")
            .join(format!("{}.payload", entry.op_id));
        assert!(payload_path.exists());

        complete_team_push(
            &store,
            workspace.path(),
            &op_id,
            &entry.claim_token,
            "accepted",
            Some("revision-1"),
            Some(7),
        )
        .unwrap();

        assert!(!payload_path.exists());
        let (state, base, sequence): (String, String, i64) = store
            .with_blocking(move |conn| {
                Ok((
                    conn.query_row(
                        "SELECT state FROM outbox_operations WHERE op_id=?1",
                        [&op_id],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT base_revision_id FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT remote_sequence FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(state, "accepted");
        assert_eq!(base, "revision-1");
        assert_eq!(sequence, 7);
    }

    #[test]
    fn accepted_offline_edit_rebases_the_next_same_note_operation() {
        let (workspace, store) = setup();
        let share = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let shared_entry = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &share,
            &shared_entry.claim_token,
            "accepted",
            Some("revision-1"),
            Some(1),
        )
        .unwrap();
        super::super::mutation::commit_write(
            &store,
            workspace.path(),
            "note.md",
            b"offline one",
            0,
            "editor",
        )
        .unwrap();
        super::super::mutation::commit_write(
            &store,
            workspace.path(),
            "note.md",
            b"offline two",
            1,
            "editor",
        )
        .unwrap();
        let first = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        assert_eq!(first.base_revision_id.as_deref(), Some("revision-1"));
        complete_team_push(
            &store,
            workspace.path(),
            &first.op_id,
            &first.claim_token,
            "accepted",
            Some("revision-2"),
            Some(2),
        )
        .unwrap();

        let second = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        assert_eq!(second.base_revision_id.as_deref(), Some("revision-2"));
    }

    #[test]
    fn delayed_completion_never_regresses_a_newer_pulled_head() {
        let (workspace, store) = setup();
        let share = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let initial = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &share,
            &initial.claim_token,
            "accepted",
            Some("revision-1"),
            Some(1),
        )
        .unwrap();
        super::super::mutation::commit_write(
            &store,
            workspace.path(),
            "note.md",
            b"local delayed",
            0,
            "editor",
        )
        .unwrap();
        let delayed = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        super::super::mutation::apply_remote_write(
            &store,
            workspace.path(),
            "note.md",
            b"newer remote",
            "revision-3",
            Some(3),
        )
        .unwrap();
        store
            .with_blocking(|conn| {
                conn.execute("UPDATE note_heads SET remote_space_id='space-1'", [])?;
                Ok(())
            })
            .unwrap();

        complete_team_push(
            &store,
            workspace.path(),
            &delayed.op_id,
            &delayed.claim_token,
            "accepted",
            Some("revision-2"),
            Some(2),
        )
        .unwrap();

        let remote: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT remote_revision_id FROM note_heads", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(remote, "revision-3");
    }

    #[test]
    fn delayed_move_completion_cannot_override_a_subsequent_move() {
        let (workspace, store) = setup();
        let share = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let initial = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &share,
            &initial.claim_token,
            "accepted",
            Some("revision-1"),
            Some(1),
        )
        .unwrap();
        let move_op = queue_team_space_move(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-2",
            1,
            1,
        )
        .unwrap();
        let delayed = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        record_applied_action(
            &store,
            &TeamRemoteAction {
                action_id: "20000000-0000-7000-8000-000000009501".to_string(),
                action_sequence: 1,
                action_type: "note_moved_in".to_string(),
                note_id: delayed.note_id.clone(),
                revision_id: Some("revision-3".to_string()),
                team_id: "team-1".to_string(),
                space_id: "space-3".to_string(),
                permission_epoch: 2,
                key_epoch: 2,
                relative_path: "note.md".to_string(),
                content: Some("newer target".to_string()),
            },
            "revision-3",
            "applied",
        )
        .unwrap();
        let before_complete: (String, Option<String>, String) = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT note.scope_id, note.pending_scope_id,
                            head.remote_revision_id
                       FROM local_notes note
                       JOIN note_heads head ON head.note_id=note.note_id",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
            })
            .unwrap();
        assert_eq!(
            before_complete,
            ("space-3".to_string(), None, "revision-3".to_string())
        );

        complete_team_push(
            &store,
            workspace.path(),
            &move_op,
            &delayed.claim_token,
            "accepted",
            Some("revision-2"),
            Some(1),
        )
        .unwrap();

        let (scope, remote): (String, String) = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT note.scope_id, head.remote_revision_id
                       FROM local_notes note
                       JOIN note_heads head ON head.note_id=note.note_id",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
            })
            .unwrap();
        assert_eq!(scope, "space-3");
        assert_eq!(remote, "revision-3");
    }

    #[test]
    fn conflict_preserves_the_local_snapshot_as_a_recovery_branch() {
        let (workspace, store) = setup();
        let op_id = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entry = claim_team_outbox(&store, workspace.path(), "space-1", 1)
            .unwrap()
            .remove(0);

        complete_team_push(
            &store,
            workspace.path(),
            &op_id,
            &entry.claim_token,
            "conflict",
            Some("remote-head"),
            None,
        )
        .unwrap();
        let pending_state: String = store
            .with_blocking({
                let op_id = op_id.clone();
                move |conn| {
                    conn.query_row(
                        "SELECT state FROM outbox_operations WHERE op_id=?1",
                        [op_id],
                        |row| row.get(0),
                    )
                }
            })
            .unwrap();
        assert_eq!(pending_state, "in_flight");
        finalize_team_conflict(&store, workspace.path(), &op_id, &entry.claim_token).unwrap();

        let (state, branches): (String, i64) = store
            .with_blocking(move |conn| {
                Ok((
                    conn.query_row(
                        "SELECT state FROM outbox_operations WHERE op_id=?1",
                        [&op_id],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT count(*) FROM recovery_branches", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(state, "conflicted");
        assert_eq!(branches, 1);
    }

    #[test]
    fn rejected_initial_share_restores_previous_local_scope() {
        let (workspace, store) = setup();
        let op_id = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entry = claim_next_team_outbox(&store, workspace.path(), 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &op_id,
            &entry.claim_token,
            "rejected_access",
            None,
            None,
        )
        .unwrap();

        rollback_rejected_team_share(&store, &op_id).unwrap();

        let scope: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT scope_kind FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(scope, "local_only");
    }

    #[test]
    fn conflict_materialization_keeps_local_base_and_remote_snapshots() {
        let (workspace, store) = setup();
        let op_id = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entry = claim_team_outbox(&store, workspace.path(), "space-1", 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &op_id,
            &entry.claim_token,
            "conflict",
            Some("remote-2"),
            None,
        )
        .unwrap();

        stage_team_conflict_snapshots(
            &store,
            workspace.path(),
            &entry.note_id,
            Some("base-1"),
            b"base",
            "remote-2",
            b"remote",
        )
        .unwrap();
        finalize_team_conflict(&store, workspace.path(), &op_id, &entry.claim_token).unwrap();

        let snapshots =
            get_team_conflict_snapshots(&store, workspace.path(), &entry.note_id).unwrap();
        assert_eq!(
            snapshots
                .iter()
                .map(|snapshot| (snapshot.kind.as_str(), snapshot.content.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("base", "base"),
                ("local", "team draft"),
                ("remote", "remote")
            ]
        );
        assert_eq!(
            unresolved_team_conflict_note_ids(&store).unwrap(),
            vec![entry.note_id.clone()]
        );
        let kinds: Vec<String> = store
            .with_blocking(|conn| {
                let mut statement =
                    conn.prepare("SELECT kind FROM recovery_branches ORDER BY kind")?;
                let values = statement
                    .query_map([], |row| row.get(0))?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(values)
            })
            .unwrap();
        assert_eq!(kinds, vec!["base", "local", "remote"]);
    }

    #[test]
    fn merged_conflict_rebases_on_remote_head_and_queues_one_resolution() {
        let (workspace, store) = setup();
        let share = configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();
        let entry = claim_team_outbox(&store, workspace.path(), "space-1", 1)
            .unwrap()
            .remove(0);
        complete_team_push(
            &store,
            workspace.path(),
            &share,
            &entry.claim_token,
            "conflict",
            Some("remote-2"),
            None,
        )
        .unwrap();
        stage_team_conflict_snapshots(
            &store,
            workspace.path(),
            &entry.note_id,
            None,
            b"",
            "remote-2",
            b"remote",
        )
        .unwrap();
        finalize_team_conflict(&store, workspace.path(), &share, &entry.claim_token).unwrap();

        let resolution =
            resolve_team_conflict(&store, workspace.path(), &entry.note_id, b"merged").unwrap();

        assert!(resolution.queued_for_sync);
        assert_eq!(
            fs::read_to_string(workspace.path().join("note.md")).unwrap(),
            "merged"
        );
        let (base, pending, unresolved): (String, i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT base_revision_id FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row(
                        "SELECT count(*) FROM outbox_operations
                          WHERE state='pending' AND base_revision_id='remote-2'",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row(
                        "SELECT count(*) FROM recovery_branches
                          WHERE resolved_at_ms IS NULL",
                        [],
                        |row| row.get(0),
                    )?,
                ))
            })
            .unwrap();
        assert_eq!(base, "remote-2");
        assert_eq!(pending, 1);
        assert_eq!(unresolved, 0);
    }

    #[test]
    fn remote_create_preserves_cloud_identity_and_advances_checkpoint() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let action = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000301".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000000302".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000303".to_string()),
            team_id: "20000000-0000-7000-8000-000000000304".to_string(),
            space_id: "20000000-0000-7000-8000-000000000305".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "Shared/remote.md".to_string(),
            content: Some("remote body".to_string()),
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &action).unwrap();

        assert_eq!(outcome.status, "applied");
        assert_eq!(
            fs::read_to_string(workspace.path().join("Shared/remote.md")).unwrap(),
            "remote body"
        );
        let (note_id, checkpoint, outbox): (String, i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))?,
                    conn.query_row(
                        "SELECT last_applied_sequence FROM sync_checkpoints",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT count(*) FROM outbox_operations", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(note_id, action.note_id);
        assert_eq!(checkpoint, 1);
        assert_eq!(outbox, 0);
    }

    #[test]
    fn remote_team_create_adopts_identity_but_preserves_divergent_personal_content() {
        let (workspace, store) = setup();
        store
            .with_blocking(|conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('personal', 'personal-1', 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "UPDATE local_notes
                        SET scope_kind='personal', scope_id='personal-1'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();
        let action = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009301".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: promoted_team_note_id(
                "20000000-0000-7000-8000-000000009304",
                "personal-1",
                "note.md",
            ),
            revision_id: Some("20000000-0000-7000-8000-000000009303".to_string()),
            team_id: "20000000-0000-7000-8000-000000009304".to_string(),
            space_id: "20000000-0000-7000-8000-000000009305".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "note.md".to_string(),
            content: Some("team content".to_string()),
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &action).unwrap();

        let (note_id, scope): (String, String) = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id, scope_kind FROM local_notes", [], |row| {
                    Ok((row.get(0)?, row.get(1)?))
                })
            })
            .unwrap();
        assert_eq!(note_id, action.note_id);
        assert_eq!(scope, "team");
        assert_eq!(outcome.status, "conflict");
        assert_eq!(
            fs::read_to_string(workspace.path().join("note.md")).unwrap(),
            "team draft"
        );
        assert_eq!(
            unresolved_team_conflict_note_ids(&store).unwrap(),
            vec![action.note_id]
        );
    }

    #[test]
    fn arbitrary_team_id_cannot_adopt_a_private_local_path() {
        let (workspace, store) = setup();
        store
            .with_blocking(|conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('personal', 'personal-1', 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "UPDATE local_notes SET scope_kind='personal', scope_id='personal-1'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();
        let action = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009311".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000009312".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000009313".to_string()),
            team_id: "20000000-0000-7000-8000-000000009314".to_string(),
            space_id: "20000000-0000-7000-8000-000000009315".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "note.md".to_string(),
            content: Some("team content".to_string()),
        };

        apply_team_remote_action(&store, workspace.path(), &action).unwrap();

        assert_eq!(
            fs::read_to_string(workspace.path().join("note.md")).unwrap(),
            "team draft"
        );
        assert!(workspace
            .path()
            .join("Lokus Conflicts")
            .join("note (team 20000000).md")
            .exists());
        let private_scope: String = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT scope_kind FROM local_notes WHERE relative_path='note.md'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(private_scope, "personal");
    }

    #[test]
    fn remote_revision_never_overwrites_a_pending_local_snapshot() {
        let (workspace, store) = setup();
        configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "20000000-0000-7000-8000-000000000311",
            "20000000-0000-7000-8000-000000000312",
            1,
            1,
        )
        .unwrap();
        let note_id: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        let action = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000313".to_string(),
            action_sequence: 1,
            action_type: "revision_accepted".to_string(),
            note_id,
            revision_id: Some("20000000-0000-7000-8000-000000000314".to_string()),
            team_id: "20000000-0000-7000-8000-000000000311".to_string(),
            space_id: "20000000-0000-7000-8000-000000000312".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "note.md".to_string(),
            content: Some("remote edit".to_string()),
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &action).unwrap();

        assert_eq!(outcome.status, "conflict");
        assert_eq!(
            fs::read_to_string(workspace.path().join("note.md")).unwrap(),
            "team draft"
        );
        let branches: i64 = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT count(*) FROM recovery_branches WHERE kind='remote'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(branches, 1);
    }

    #[test]
    fn remote_tombstone_is_durable_without_echoing_to_the_outbox() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let create = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000321".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000000322".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000323".to_string()),
            team_id: "20000000-0000-7000-8000-000000000324".to_string(),
            space_id: "20000000-0000-7000-8000-000000000325".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "Shared/deleted.md".to_string(),
            content: Some("delete me".to_string()),
        };
        apply_team_remote_action(&store, workspace.path(), &create).unwrap();
        let tombstone = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000326".to_string(),
            action_sequence: 2,
            action_type: "note_tombstoned".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000327".to_string()),
            content: Some("delete me".to_string()),
            ..create
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &tombstone).unwrap();

        assert_eq!(outcome.status, "applied");
        assert!(!workspace.path().join("Shared/deleted.md").exists());
        let (status, checkpoint, outbox): (String, i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT status FROM local_notes", [], |row| row.get(0))?,
                    conn.query_row(
                        "SELECT last_applied_sequence FROM sync_checkpoints",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT count(*) FROM outbox_operations", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(status, "tombstoned");
        assert_eq!(checkpoint, 2);
        assert_eq!(outbox, 0);
    }

    #[test]
    fn replay_finalizes_a_tombstone_applied_before_checkpoint_commit() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let create = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009101".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000009102".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000009103".to_string()),
            team_id: "20000000-0000-7000-8000-000000009104".to_string(),
            space_id: "20000000-0000-7000-8000-000000009105".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "Shared/crash-delete.md".to_string(),
            content: Some("delete".to_string()),
        };
        apply_team_remote_action(&store, workspace.path(), &create).unwrap();
        let tombstone = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009106".to_string(),
            action_sequence: 2,
            action_type: "note_tombstoned".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000009107".to_string()),
            ..create
        };
        prepare_inbox_action(&store, &tombstone).unwrap();
        commit_tombstone(
            &store,
            workspace.path(),
            "Shared/crash-delete.md",
            "team-sync",
        )
        .unwrap();

        let outcome = apply_team_remote_action(&store, workspace.path(), &tombstone).unwrap();

        assert_eq!(outcome.status, "already_applied");
        assert_eq!(
            team_sync_checkpoint(&store, &tombstone.space_id).unwrap(),
            2
        );
    }

    #[test]
    fn remote_restore_reactivates_a_tombstoned_team_note() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let create = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000341".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000000342".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000343".to_string()),
            team_id: "20000000-0000-7000-8000-000000000344".to_string(),
            space_id: "20000000-0000-7000-8000-000000000345".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "Shared/restored.md".to_string(),
            content: Some("first".to_string()),
        };
        apply_team_remote_action(&store, workspace.path(), &create).unwrap();
        let tombstone = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000346".to_string(),
            action_sequence: 2,
            action_type: "note_tombstoned".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000347".to_string()),
            ..create.clone()
        };
        apply_team_remote_action(&store, workspace.path(), &tombstone).unwrap();
        let restore = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000348".to_string(),
            action_sequence: 3,
            action_type: "note_restored".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000349".to_string()),
            content: Some("restored".to_string()),
            ..create
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &restore).unwrap();

        assert_eq!(outcome.status, "applied");
        assert_eq!(
            fs::read_to_string(workspace.path().join("Shared/restored.md")).unwrap(),
            "restored"
        );
        let status: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT status FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(status, "active");
    }

    #[test]
    fn remote_revision_relocates_the_stable_note_without_echo() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let create = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000331".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000000332".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000333".to_string()),
            team_id: "20000000-0000-7000-8000-000000000334".to_string(),
            space_id: "20000000-0000-7000-8000-000000000335".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "Shared/old.md".to_string(),
            content: Some("old".to_string()),
        };
        apply_team_remote_action(&store, workspace.path(), &create).unwrap();
        let update = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000336".to_string(),
            action_sequence: 2,
            action_type: "revision_accepted".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000337".to_string()),
            relative_path: "Archive/new.md".to_string(),
            content: Some("new".to_string()),
            ..create
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &update).unwrap();

        assert_eq!(outcome.relative_path, "Archive/new.md");
        assert!(!workspace.path().join("Shared/old.md").exists());
        assert_eq!(
            fs::read_to_string(workspace.path().join("Archive/new.md")).unwrap(),
            "new"
        );
        let outbox: i64 = store
            .with_blocking(|conn| {
                conn.query_row("SELECT count(*) FROM outbox_operations", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(outbox, 0);
    }

    #[test]
    fn out_of_order_cross_space_hints_never_remove_an_already_moved_note() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let create = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000351".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            note_id: "20000000-0000-7000-8000-000000000352".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000353".to_string()),
            team_id: "20000000-0000-7000-8000-000000000354".to_string(),
            space_id: "20000000-0000-7000-8000-000000000355".to_string(),
            permission_epoch: 1,
            key_epoch: 1,
            relative_path: "Shared/moved.md".to_string(),
            content: Some("source".to_string()),
        };
        apply_team_remote_action(&store, workspace.path(), &create).unwrap();
        let moved_in = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000356".to_string(),
            action_sequence: 1,
            action_type: "note_moved_in".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000000357".to_string()),
            space_id: "20000000-0000-7000-8000-000000000358".to_string(),
            key_epoch: 2,
            content: Some("target".to_string()),
            ..create.clone()
        };
        apply_team_remote_action(&store, workspace.path(), &moved_in).unwrap();
        let moved_out = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000000359".to_string(),
            action_sequence: 2,
            action_type: "note_moved_out".to_string(),
            revision_id: None,
            key_epoch: 0,
            relative_path: String::new(),
            content: None,
            ..create
        };

        let outcome = apply_team_remote_action(&store, workspace.path(), &moved_out).unwrap();

        assert_eq!(outcome.status, "already_moved");
        assert_eq!(
            fs::read_to_string(workspace.path().join("Shared/moved.md")).unwrap(),
            "target"
        );
        let (scope, status): (String, String) = store
            .with_blocking(|conn| {
                conn.query_row("SELECT scope_id, status FROM local_notes", [], |row| {
                    Ok((row.get(0)?, row.get(1)?))
                })
            })
            .unwrap();
        assert_eq!(scope, "20000000-0000-7000-8000-000000000358");
        assert_eq!(status, "active");
    }

    #[test]
    fn target_move_in_before_source_backlog_keeps_target_authoritative() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let moved_in = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009401".to_string(),
            action_sequence: 1,
            action_type: "note_moved_in".to_string(),
            note_id: "20000000-0000-7000-8000-000000009402".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000009403".to_string()),
            team_id: "20000000-0000-7000-8000-000000009404".to_string(),
            space_id: "20000000-0000-7000-8000-000000009405".to_string(),
            permission_epoch: 2,
            key_epoch: 2,
            relative_path: "Shared/target.md".to_string(),
            content: Some("target content".to_string()),
        };
        apply_team_remote_action(&store, workspace.path(), &moved_in).unwrap();
        let source_create = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009406".to_string(),
            action_sequence: 1,
            action_type: "note_created".to_string(),
            revision_id: Some("20000000-0000-7000-8000-000000009407".to_string()),
            space_id: "20000000-0000-7000-8000-000000009408".to_string(),
            key_epoch: 1,
            content: Some("stale source".to_string()),
            ..moved_in.clone()
        };
        let source_out = TeamRemoteAction {
            action_id: "20000000-0000-7000-8000-000000009409".to_string(),
            action_sequence: 2,
            action_type: "note_moved_out".to_string(),
            revision_id: None,
            key_epoch: 0,
            relative_path: String::new(),
            content: None,
            ..source_create.clone()
        };

        assert_eq!(
            apply_team_remote_action(&store, workspace.path(), &source_create)
                .unwrap()
                .status,
            "already_moved"
        );
        assert_eq!(
            apply_team_remote_action(&store, workspace.path(), &source_out)
                .unwrap()
                .status,
            "already_moved"
        );
        let scope: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT scope_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(scope, moved_in.space_id);
        assert_eq!(
            fs::read_to_string(workspace.path().join("Shared/target.md")).unwrap(),
            "target content"
        );
    }

    #[test]
    fn removal_suspends_team_scopes_and_preserves_pending_snapshots() {
        let (workspace, store) = setup();
        configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            3,
        )
        .unwrap();

        let keys = apply_team_membership_hint(&store, "team-1", "removed", 2).unwrap();

        assert_eq!(
            keys,
            vec![TeamScopeKey {
                space_id: "space-1".to_string(),
                key_epoch: 3,
            }]
        );
        let (scope, outbox, branches): (String, String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row(
                        "SELECT status FROM sync_scopes WHERE scope_kind='team'",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT state FROM outbox_operations", [], |row| row.get(0))?,
                    conn.query_row(
                        "SELECT count(*) FROM recovery_branches WHERE kind='rejected'",
                        [],
                        |row| row.get(0),
                    )?,
                ))
            })
            .unwrap();
        assert_eq!(scope, "removed");
        assert_eq!(outbox, "rejected");
        assert_eq!(branches, 1);
    }

    #[test]
    fn active_scope_refresh_advances_the_local_space_key_epoch() {
        let (_workspace, store) = setup();
        upsert_team_sync_scope(&store, "team-1", "space-1", 2, 4).unwrap();
        upsert_team_sync_scope(&store, "team-1", "space-1", 3, 5).unwrap();
        record_applied_action(
            &store,
            &TeamRemoteAction {
                action_id: "20000000-0000-7000-8000-000000009201".to_string(),
                action_sequence: 1,
                action_type: "note_created".to_string(),
                note_id: store
                    .with_blocking(|conn| {
                        conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
                    })
                    .unwrap(),
                revision_id: Some("20000000-0000-7000-8000-000000009202".to_string()),
                team_id: "team-1".to_string(),
                space_id: "space-1".to_string(),
                permission_epoch: 1,
                key_epoch: 1,
                relative_path: "note.md".to_string(),
                content: Some("content".to_string()),
            },
            "20000000-0000-7000-8000-000000009202",
            "applied",
        )
        .unwrap();

        let (permission, key): (i64, i64) = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT permission_epoch, key_epoch FROM sync_scopes
                      WHERE scope_kind='team' AND scope_id='space-1'",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
            })
            .unwrap();
        assert_eq!((permission, key), (3, 5));
    }
}
