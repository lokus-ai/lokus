use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use parking_lot::Mutex;
use rusqlite::OptionalExtension;

use super::backfill::{backfill_workspace, BackfillReport};
use super::identity::normalized_path_key;
use super::mutation::{
    apply_remote_write, commit_create, commit_relocate, commit_restore, commit_tombstone,
    commit_write, WriteCommit,
};
use super::reconcile::{
    reconcile_external_changes, reconcile_startup_changes, ExternalChange, NormalizedChange,
};
use super::recovery::recover_pending_mutations;
use super::sequence::set_team_sequence_high_water;
use super::store::NoteStore;
use super::team_sync::{
    apply_team_membership_hint, apply_team_remote_action, claim_next_team_outbox,
    claim_team_outbox, complete_team_push, configure_note_team_scope, finalize_team_conflict,
    get_team_conflict_snapshots, queue_team_space_move, resolve_local_recovery,
    resolve_team_conflict, rollback_rejected_team_share, stage_team_conflict_snapshots,
    stage_team_outbox_ciphertext, team_outbox_status, team_sync_checkpoint,
    unresolved_team_conflict_note_ids, upsert_team_sync_scope, TeamApplyOutcome,
    TeamConflictSnapshot, TeamOutboxEntry, TeamOutboxStatus, TeamRemoteAction, TeamScopeKey,
};

#[derive(Default)]
pub struct NoteEngineRegistry {
    stores: Mutex<HashMap<PathBuf, NoteStore>>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct NoteIdentity {
    pub note_id: String,
    pub local_generation: i64,
    pub scope_kind: String,
    pub scope_id: String,
}

impl NoteEngineRegistry {
    pub fn initialize(&self, workspace_path: &Path) -> Result<BackfillReport, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = {
            let mut stores = self.stores.lock();
            if let Some(store) = stores.get(&workspace_path) {
                store.clone()
            } else {
                let store = NoteStore::open(workspace_path.clone())?;
                stores.insert(workspace_path.clone(), store.clone());
                store
            }
        };
        let recovery = recover_pending_mutations(&store, &workspace_path)?;
        let mut report = backfill_workspace(&store, &workspace_path)?;
        reconcile_startup_changes(&store, &workspace_path)?;
        report.recovered_mutations = recovery.recovered;
        report.recovery_required = recovery.requires_attention;
        Ok(report)
    }

    pub fn is_initialized(&self, workspace_path: &Path) -> bool {
        let Ok(workspace_path) = std::fs::canonicalize(workspace_path) else {
            return false;
        };
        self.stores.lock().contains_key(&workspace_path)
    }

    pub fn write_note(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        payload: &[u8],
        expected_local_generation: i64,
        source: &str,
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        commit_write(
            &store,
            &workspace_path,
            relative_path,
            payload,
            expected_local_generation,
            source,
        )
    }

    pub fn identity_for_path(
        &self,
        workspace_path: &Path,
        relative_path: &str,
    ) -> Result<NoteIdentity, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        let path_key = normalized_path_key(Path::new(relative_path));
        store.with_blocking(move |conn| {
            conn.query_row(
                "SELECT note.note_id, head.local_generation,
                        note.scope_kind, note.scope_id
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.normalized_path_key=?1",
                [path_key],
                |row| {
                    Ok(NoteIdentity {
                        note_id: row.get(0)?,
                        local_generation: row.get(1)?,
                        scope_kind: row.get(2)?,
                        scope_id: row.get(3)?,
                    })
                },
            )
        })
    }

    pub fn team_note_paths(&self, workspace_path: &Path) -> Result<Vec<String>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        store.with_blocking(|conn| {
            let mut statement = conn.prepare(
                "SELECT relative_path FROM local_notes
                  WHERE scope_kind='team' AND status IN ('active', 'missing')",
            )?;
            let values = statement
                .query_map([], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?;
            Ok(values)
        })
    }

    pub fn note_path_by_id(
        &self,
        workspace_path: &Path,
        note_id: &str,
    ) -> Result<Option<String>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        let note_id = note_id.to_string();
        store.with_blocking(move |conn| {
            conn.query_row(
                "SELECT relative_path FROM local_notes WHERE note_id=?1",
                [note_id],
                |row| row.get(0),
            )
            .optional()
        })
    }

    pub fn create_note(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        payload: &[u8],
        source: &str,
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        commit_create(&store, &workspace_path, relative_path, payload, source)
    }

    pub fn apply_remote_note(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        payload: &[u8],
        personal_scope_id: &str,
        remote_revision_id: &str,
        remote_sequence: Option<i64>,
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        let scope_id = personal_scope_id.to_string();
        let path_key = normalized_path_key(Path::new(relative_path));
        let existing = store.with_blocking({
            let path_key = path_key.clone();
            move |conn| {
                let existing: Option<(String, String)> = conn
                    .query_row(
                        "SELECT scope_kind, status FROM local_notes
                          WHERE normalized_path_key=?1",
                        [&path_key],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .optional()?;
                if existing.as_ref().map(|value| value.0.as_str()) == Some("team") {
                    return Err(rusqlite::Error::InvalidParameterName(
                        "personal sync cannot own team note".to_string(),
                    ));
                }
                Ok(existing)
            }
        })?;
        if remote_revision_id.is_empty() {
            return Err("remote revision id is required".to_string());
        }

        let commit = if existing.is_some() {
            apply_remote_write(
                &store,
                &workspace_path,
                relative_path,
                payload,
                remote_revision_id,
                remote_sequence,
            )?
        } else {
            commit_create(
                &store,
                &workspace_path,
                relative_path,
                payload,
                "personal-sync",
            )?
        };
        let note_id = commit.note_id.clone();
        let remote_revision_id = remote_revision_id.to_string();
        store.with_blocking(move |conn| {
            let tx = conn.transaction()?;
            tx.execute(
                "INSERT INTO sync_scopes (
                   scope_kind, scope_id, status, created_at_ms, updated_at_ms
                 ) VALUES ('personal', ?1, 'active', 0, 0)
                 ON CONFLICT (scope_kind, scope_id) DO NOTHING",
                [&scope_id],
            )?;
            tx.execute(
                "UPDATE local_notes
                    SET scope_kind='personal', scope_id=?2
                  WHERE note_id=?1",
                rusqlite::params![note_id, scope_id],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET remote_revision_id=?2, remote_sequence=?3,
                        base_revision_id=?2, base_hash=local_hash
                  WHERE note_id=?1",
                rusqlite::params![note_id, remote_revision_id, remote_sequence],
            )?;
            tx.commit()?;
            Ok(())
        })?;
        Ok(commit)
    }

    pub fn reconcile_external(
        &self,
        workspace_path: &Path,
        changes: &[ExternalChange],
        dirty_path_keys: &HashSet<String>,
    ) -> Result<Vec<NormalizedChange>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        reconcile_external_changes(&store, &workspace_path, changes, dirty_path_keys)
    }

    pub fn acknowledge_personal_sync(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        personal_scope_id: &str,
        remote_revision_id: &str,
    ) -> Result<usize, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        let path_key = normalized_path_key(Path::new(relative_path));
        let personal_scope_id = personal_scope_id.to_string();
        let remote_revision_id = remote_revision_id.to_string();
        let metadata_dir = workspace_path.join(".lokus");
        let payloads: Vec<String> = store.with_blocking(move |conn| {
            let tx = conn.transaction()?;
            let (note_id, scope_kind, mut scope_id): (String, String, String) = tx.query_row(
                "SELECT note_id, scope_kind, scope_id
                   FROM local_notes WHERE normalized_path_key=?1",
                [path_key],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )?;
            if scope_kind == "team" {
                tx.commit()?;
                return Ok(Vec::new());
            }
            if scope_kind == "local_only" {
                tx.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('personal', ?1, 'active', ?2, ?2)
                     ON CONFLICT (scope_kind, scope_id) DO NOTHING",
                    rusqlite::params![personal_scope_id, now_ms()],
                )?;
                tx.execute(
                    "UPDATE local_notes
                        SET scope_kind='personal', scope_id=?2, updated_at_ms=?3
                      WHERE note_id=?1 AND scope_kind='local_only'",
                    rusqlite::params![note_id, personal_scope_id, now_ms()],
                )?;
                scope_id = personal_scope_id;
            }
            let mut statement = tx.prepare(
                "SELECT payload_relative_path
                   FROM outbox_operations
                  WHERE note_id=?1
                    AND scope_kind='personal' AND scope_id=?2
                    AND state IN ('pending', 'in_flight')",
            )?;
            let payloads: Vec<String> = statement
                .query_map(rusqlite::params![note_id, scope_id], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?;
            drop(statement);
            tx.execute(
                "UPDATE outbox_operations
                    SET state='accepted', accepted_revision_id=?2,
                        updated_at_ms=?3
                  WHERE note_id=?1
                    AND scope_kind='personal' AND scope_id=?4
                    AND state IN ('pending', 'in_flight')",
                rusqlite::params![note_id, remote_revision_id, now_ms(), scope_id],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET remote_revision_id=?2, base_revision_id=?2,
                        base_hash=local_hash, updated_at_ms=?3
                  WHERE note_id=?1",
                rusqlite::params![note_id, remote_revision_id, now_ms()],
            )?;
            tx.commit()?;
            Ok(payloads)
        })?;
        for relative in &payloads {
            let _ = std::fs::remove_file(metadata_dir.join(relative));
        }
        Ok(payloads.len())
    }

    pub fn tombstone_note(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        source: &str,
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        commit_tombstone(&store, &workspace_path, relative_path, source)
    }

    pub fn relocate_note(
        &self,
        workspace_path: &Path,
        source_relative_path: &str,
        target_relative_path: &str,
        mutation_kind: &str,
        source: &str,
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        commit_relocate(
            &store,
            &workspace_path,
            source_relative_path,
            target_relative_path,
            mutation_kind,
            source,
        )
    }

    pub fn restore_note(
        &self,
        workspace_path: &Path,
        note_id: &str,
        source: &str,
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        let note_id_owned = note_id.to_string();
        let relative_path: String = store.with_blocking(move |conn| {
            conn.query_row(
                "SELECT relative_path FROM local_notes
                  WHERE note_id=?1 AND status='tombstoned'",
                [note_id_owned],
                |row| row.get(0),
            )
        })?;
        let trash_dir = workspace_path.join(".lokus").join("trash").join(note_id);
        let expected_name = Path::new(&relative_path)
            .file_name()
            .ok_or_else(|| "tombstoned note has no filename".to_string())?;
        let expected_path = trash_dir.join(expected_name);
        let payload_path = if expected_path.is_file() {
            expected_path
        } else {
            std::fs::read_dir(&trash_dir)
                .map_err(|error| error.to_string())?
                .filter_map(Result::ok)
                .filter(|entry| entry.path().is_file())
                .max_by_key(|entry| {
                    entry
                        .metadata()
                        .and_then(|metadata| metadata.modified())
                        .ok()
                })
                .map(|entry| entry.path())
                .ok_or_else(|| "tombstoned note payload is missing".to_string())?
        };
        let payload = std::fs::read(payload_path).map_err(|error| error.to_string())?;
        commit_restore(
            &store,
            &workspace_path,
            note_id,
            &relative_path,
            &payload,
            source,
        )
    }

    pub fn configure_team_scope(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        team_id: &str,
        space_id: &str,
        permission_epoch: i64,
        key_epoch: i64,
    ) -> Result<String, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        configure_note_team_scope(
            &store,
            &workspace_path,
            relative_path,
            team_id,
            space_id,
            permission_epoch,
            key_epoch,
        )
    }

    pub fn claim_team_outbox(
        &self,
        workspace_path: &Path,
        space_id: &str,
        limit: usize,
    ) -> Result<Vec<TeamOutboxEntry>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        claim_team_outbox(&store, &workspace_path, space_id, limit)
    }

    pub fn claim_next_team_outbox(
        &self,
        workspace_path: &Path,
        limit: usize,
    ) -> Result<Vec<TeamOutboxEntry>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        claim_next_team_outbox(&store, &workspace_path, limit)
    }

    pub fn stage_team_ciphertext(
        &self,
        workspace_path: &Path,
        op_id: &str,
        key_epoch: i64,
        claim_token: &str,
        ciphertext: &[u8],
    ) -> Result<String, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        stage_team_outbox_ciphertext(
            &store,
            &workspace_path,
            op_id,
            key_epoch,
            claim_token,
            ciphertext,
        )
    }

    pub fn queue_team_move(
        &self,
        workspace_path: &Path,
        relative_path: &str,
        team_id: &str,
        target_space_id: &str,
        permission_epoch: i64,
        key_epoch: i64,
    ) -> Result<String, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        queue_team_space_move(
            &store,
            &workspace_path,
            relative_path,
            team_id,
            target_space_id,
            permission_epoch,
            key_epoch,
        )
    }

    pub fn complete_team_push(
        &self,
        workspace_path: &Path,
        op_id: &str,
        claim_token: &str,
        result: &str,
        revision_id: Option<&str>,
        action_sequence: Option<i64>,
    ) -> Result<(), String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        complete_team_push(
            &store,
            &workspace_path,
            op_id,
            claim_token,
            result,
            revision_id,
            action_sequence,
        )
    }

    pub fn finalize_team_conflict(
        &self,
        workspace_path: &Path,
        op_id: &str,
        claim_token: &str,
    ) -> Result<(), String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        finalize_team_conflict(&store, &workspace_path, op_id, claim_token)
    }

    pub fn rollback_rejected_team_share(
        &self,
        workspace_path: &Path,
        op_id: &str,
    ) -> Result<(), String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        rollback_rejected_team_share(&store, op_id)
    }

    pub fn team_outbox_status(
        &self,
        workspace_path: &Path,
        op_id: &str,
    ) -> Result<TeamOutboxStatus, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        team_outbox_status(&store, op_id)
    }

    pub fn team_checkpoint(&self, workspace_path: &Path, space_id: &str) -> Result<i64, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        team_sync_checkpoint(&store, space_id)
    }

    pub fn apply_team_action(
        &self,
        workspace_path: &Path,
        action: &TeamRemoteAction,
    ) -> Result<TeamApplyOutcome, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        apply_team_remote_action(&store, &workspace_path, action)
    }

    pub fn apply_team_membership(
        &self,
        workspace_path: &Path,
        team_id: &str,
        membership_status: &str,
        permission_epoch: i64,
    ) -> Result<Vec<TeamScopeKey>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        apply_team_membership_hint(&store, team_id, membership_status, permission_epoch)
    }

    pub fn refresh_team_scope(
        &self,
        workspace_path: &Path,
        team_id: &str,
        space_id: &str,
        permission_epoch: i64,
        key_epoch: i64,
    ) -> Result<(), String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        upsert_team_sync_scope(&store, team_id, space_id, permission_epoch, key_epoch)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn stage_team_conflict(
        &self,
        workspace_path: &Path,
        note_id: &str,
        base_revision_id: Option<&str>,
        base_content: &[u8],
        remote_revision_id: &str,
        remote_content: &[u8],
    ) -> Result<(), String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        stage_team_conflict_snapshots(
            &store,
            &workspace_path,
            note_id,
            base_revision_id,
            base_content,
            remote_revision_id,
            remote_content,
        )
    }

    pub fn set_team_sequence_floor(
        &self,
        workspace_path: &Path,
        finalized_sequence: i64,
    ) -> Result<i64, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        set_team_sequence_high_water(&store, finalized_sequence, now_ms())
    }

    pub fn team_conflict_snapshots(
        &self,
        workspace_path: &Path,
        note_id: &str,
    ) -> Result<Vec<TeamConflictSnapshot>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        get_team_conflict_snapshots(&store, &workspace_path, note_id)
    }

    pub fn resolve_team_conflict(
        &self,
        workspace_path: &Path,
        note_id: &str,
        resolution_content: &[u8],
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        resolve_team_conflict(&store, &workspace_path, note_id, resolution_content)
    }

    pub fn resolve_local_recovery(
        &self,
        workspace_path: &Path,
        note_id: &str,
        kind: &str,
        resolution_content: &[u8],
    ) -> Result<WriteCommit, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        resolve_local_recovery(&store, &workspace_path, note_id, kind, resolution_content)
    }

    pub fn unresolved_team_conflicts(&self, workspace_path: &Path) -> Result<Vec<String>, String> {
        let workspace_path =
            std::fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
        let store = self
            .stores
            .lock()
            .get(&workspace_path)
            .cloned()
            .ok_or_else(|| "note engine is not initialized for workspace".to_string())?;
        unresolved_team_conflict_note_ids(&store)
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn initialize_reuses_one_engine_per_workspace_and_backfills_idempotently() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "note").unwrap();
        let registry = NoteEngineRegistry::default();

        let first = registry.initialize(workspace.path()).unwrap();
        let second = registry.initialize(workspace.path()).unwrap();

        assert_eq!(first.created, 1);
        assert_eq!(second.reused, 1);
        assert!(registry.is_initialized(workspace.path()));
    }

    #[test]
    fn identity_lookup_returns_stable_id_and_generation() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "note").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();

        let identity = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();

        assert!(!identity.note_id.is_empty());
        assert_eq!(identity.local_generation, 0);
    }

    #[test]
    fn remote_apply_can_create_a_new_personal_note_without_outbox_echo() {
        let workspace = tempfile::tempdir().unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();

        let commit = registry
            .apply_remote_note(
                workspace.path(),
                "remote.md",
                b"remote",
                "workspace-1",
                "remote-hash",
                None,
            )
            .unwrap();

        assert_eq!(commit.local_generation, 1);
        assert!(!commit.queued_for_sync);
        assert_eq!(
            fs::read(workspace.path().join("remote.md")).unwrap(),
            b"remote"
        );
    }

    #[test]
    fn personal_sync_acknowledgement_advances_base_and_closes_outbox() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();
        registry
            .apply_remote_note(
                workspace.path(),
                "note.md",
                b"before",
                "workspace-1",
                "base-1",
                None,
            )
            .unwrap();
        registry
            .write_note(workspace.path(), "note.md", b"after", 1, "test")
            .unwrap();

        let acknowledged = registry
            .acknowledge_personal_sync(workspace.path(), "note.md", "workspace-1", "remote-2")
            .unwrap();

        assert_eq!(acknowledged, 1);
        let identity = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();
        assert_eq!(identity.local_generation, 2);
    }

    #[test]
    fn startup_reconciliation_queues_team_edits_made_while_closed() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();
        let canonical = fs::canonicalize(workspace.path()).unwrap();
        let store = registry.stores.lock().get(&canonical).cloned().unwrap();
        store
            .with_blocking(|conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, team_id, permission_epoch, key_epoch,
                       status, created_at_ms, updated_at_ms
                     ) VALUES ('team', 'space-1', 'team-1', 1, 1, 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "UPDATE local_notes SET scope_kind='team', scope_id='space-1'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();
        fs::write(workspace.path().join("note.md"), "offline edit").unwrap();

        registry.initialize(workspace.path()).unwrap();

        let (generation, pending): (i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT local_generation FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row(
                        "SELECT count(*) FROM outbox_operations WHERE state='pending'",
                        [],
                        |row| row.get(0),
                    )?,
                ))
            })
            .unwrap();
        assert_eq!((generation, pending), (1, 1));
    }

    #[test]
    fn delayed_personal_ack_never_accepts_a_promoted_team_outbox() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();
        registry
            .apply_remote_note(
                workspace.path(),
                "note.md",
                b"before",
                "personal-1",
                "manifest-hash",
                None,
            )
            .unwrap();
        let canonical = fs::canonicalize(workspace.path()).unwrap();
        let store = registry.stores.lock().get(&canonical).cloned().unwrap();
        super::super::team_sync::configure_note_team_scope(
            &store,
            workspace.path(),
            "note.md",
            "team-1",
            "space-1",
            1,
            1,
        )
        .unwrap();

        let acknowledged = registry
            .acknowledge_personal_sync(
                workspace.path(),
                "note.md",
                "personal-1",
                "late-manifest-hash",
            )
            .unwrap();

        assert_eq!(acknowledged, 0);
        let (state, base): (String, Option<String>) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row(
                        "SELECT state FROM outbox_operations WHERE scope_kind='team'",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT base_revision_id FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(state, "pending");
        assert_eq!(base, None);
    }

    #[test]
    fn first_personal_upload_marks_original_local_note_as_personal() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "content").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();

        registry
            .acknowledge_personal_sync(
                workspace.path(),
                "note.md",
                "shared-personal-workspace",
                "manifest-hash",
            )
            .unwrap();

        let identity = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();
        assert_eq!(identity.scope_kind, "personal");
        assert_eq!(identity.scope_id, "shared-personal-workspace");
    }

    #[test]
    fn remote_apply_reactivates_indexed_missing_personal_identity() {
        let workspace = tempfile::tempdir().unwrap();
        let path = workspace.path().join("note.md");
        fs::write(&path, "local").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();
        let original = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();
        fs::remove_file(&path).unwrap();
        registry
            .reconcile_external(
                workspace.path(),
                &[ExternalChange {
                    kind: "remove".to_string(),
                    paths: vec![path.to_string_lossy().to_string()],
                }],
                &HashSet::new(),
            )
            .unwrap();

        let commit = registry
            .apply_remote_note(
                workspace.path(),
                "note.md",
                b"remote",
                "personal-1",
                "remote-1",
                Some(9),
            )
            .unwrap();

        let identity = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();
        assert_eq!(commit.note_id, original.note_id);
        assert_eq!(identity.note_id, original.note_id);
        assert_eq!(identity.scope_kind, "personal");
        assert_eq!(identity.scope_id, "personal-1");
        assert_eq!(fs::read(&path).unwrap(), b"remote");
        let canonical = fs::canonicalize(workspace.path()).unwrap();
        let store = registry.stores.lock().get(&canonical).cloned().unwrap();
        let (status, remote_revision, remote_sequence, outbox): (String, String, i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT status FROM local_notes", [], |row| row.get(0))?,
                    conn.query_row("SELECT remote_revision_id FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT remote_sequence FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT count(*) FROM outbox_operations", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(status, "active");
        assert_eq!(remote_revision, "remote-1");
        assert_eq!(remote_sequence, 9);
        assert_eq!(outbox, 0);
    }

    #[test]
    fn remote_apply_failure_does_not_partially_claim_local_note() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "local").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();

        let error = registry
            .apply_remote_note(
                workspace.path(),
                "note.md",
                b"remote",
                "personal-1",
                "",
                None,
            )
            .unwrap_err();

        assert!(error.contains("remote revision id"));
        let identity = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();
        assert_eq!(identity.scope_kind, "local_only");
        assert_eq!(identity.scope_id, "workspace");
        let canonical = fs::canonicalize(workspace.path()).unwrap();
        let store = registry.stores.lock().get(&canonical).cloned().unwrap();
        let personal_scopes: i64 = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT count(*) FROM sync_scopes WHERE scope_kind='personal'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(personal_scopes, 0);
    }

    #[test]
    fn personal_remote_apply_never_claims_a_missing_team_identity() {
        let workspace = tempfile::tempdir().unwrap();
        let path = workspace.path().join("note.md");
        fs::write(&path, "team").unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();
        let canonical = fs::canonicalize(workspace.path()).unwrap();
        let store = registry.stores.lock().get(&canonical).cloned().unwrap();
        store
            .with_blocking(|conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, team_id, permission_epoch, key_epoch,
                       status, created_at_ms, updated_at_ms
                     ) VALUES ('team', 'space-1', 'team-1', 1, 1, 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "UPDATE local_notes SET scope_kind='team', scope_id='space-1'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();
        fs::remove_file(&path).unwrap();
        registry
            .reconcile_external(
                workspace.path(),
                &[ExternalChange {
                    kind: "remove".to_string(),
                    paths: vec![path.to_string_lossy().to_string()],
                }],
                &HashSet::new(),
            )
            .unwrap();

        let error = registry
            .apply_remote_note(
                workspace.path(),
                "note.md",
                b"personal",
                "personal-1",
                "remote-1",
                None,
            )
            .unwrap_err();

        assert!(error.contains("personal sync cannot own team note"));
        let identity = registry
            .identity_for_path(workspace.path(), "note.md")
            .unwrap();
        assert_eq!(identity.scope_kind, "team");
        assert_eq!(identity.scope_id, "space-1");
        assert!(!path.exists());
    }

    #[test]
    fn direct_create_rejects_an_unindexed_existing_file_without_overwriting_it() {
        let workspace = tempfile::tempdir().unwrap();
        let registry = NoteEngineRegistry::default();
        registry.initialize(workspace.path()).unwrap();
        let path = workspace.path().join("finder-drop.md");
        fs::write(&path, "original finder content").unwrap();

        let identity_error = registry
            .identity_for_path(workspace.path(), "finder-drop.md")
            .unwrap_err();
        let create_error = registry
            .create_note(
                workspace.path(),
                "finder-drop.md",
                b"replacement content",
                "editor-save",
            )
            .unwrap_err();

        assert!(identity_error
            .to_lowercase()
            .contains("query returned no rows"));
        assert!(create_error.contains("note already exists"));
        assert_eq!(fs::read_to_string(path).unwrap(), "original finder content");
    }
}
