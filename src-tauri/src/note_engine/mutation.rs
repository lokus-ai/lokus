use std::fs;
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, TransactionBehavior};
use sha2::{Digest, Sha256};

use super::identity::is_supported_note_path;
use super::identity::{new_note_id, normalized_path_key, rename_path_case_safe};
use super::journal::{write_journal_record, JournalHeader};
use super::sequence::allocate_client_sequence;
use super::store::NoteStore;
use super::writer::{atomic_replace, sync_directory};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct WriteCommit {
    pub op_id: String,
    pub note_id: String,
    pub local_generation: i64,
    pub queued_for_sync: bool,
    pub scope_kind: Option<String>,
    pub scope_id: Option<String>,
}

pub fn commit_write(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    payload: &[u8],
    expected_local_generation: i64,
    source: &str,
) -> Result<WriteCommit, String> {
    commit_write_as(
        store,
        workspace_path,
        relative_path,
        payload,
        expected_local_generation,
        source,
        "write",
    )
}

#[allow(clippy::too_many_arguments)]
fn commit_write_as(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    payload: &[u8],
    expected_local_generation: i64,
    source: &str,
    mutation_kind: &str,
) -> Result<WriteCommit, String> {
    if !matches!(mutation_kind, "write" | "restore") {
        return Err("invalid write mutation kind".to_string());
    }
    let relative = safe_relative_path(relative_path)?;
    ensure_no_symlink_components(workspace_path, &relative)?;
    let normalized_key = normalized_path_key(&relative);
    let note: (String, i64, String, String, Option<String>) = store.with_blocking({
        let normalized_key = normalized_key.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.note_id, head.local_generation,
                        note.scope_kind, note.scope_id, note.pending_scope_id
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.normalized_path_key=?1",
                [normalized_key],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
        }
    })?;
    let (note_id, observed_generation, scope_kind, scope_id, pending_scope_id) = note;
    if pending_scope_id.is_some() {
        return Err("note move is pending".to_string());
    }
    if observed_generation != expected_local_generation {
        return Err(format!(
            "stale local generation: expected {expected_local_generation}, current {observed_generation}"
        ));
    }

    let op_id = new_note_id();
    let metadata_dir = workspace_path.join(".lokus");
    let journal_path = write_journal_record(
        &metadata_dir,
        JournalHeader {
            version: 1,
            op_id: op_id.clone(),
            note_id: note_id.clone(),
            mutation_kind: mutation_kind.to_string(),
            target_relative_path: slash_path(&relative),
            expected_local_generation: Some(expected_local_generation),
            payload_len: 0,
            payload_sha256: String::new(),
        },
        payload,
    )?;
    let journal_relative_path = format!("note-journal/{op_id}.pending");
    let target_relative_path = slash_path(&relative);
    let payload_size = payload.len() as i64;
    let payload_sha256 = hex::encode(Sha256::digest(payload));
    let now_ms = unix_ms();

    let prepare_result = store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let source = source.to_string();
        let mutation_kind = mutation_kind.to_string();
        let journal_relative_path = journal_relative_path.clone();
        let target_relative_path = target_relative_path.clone();
        let payload_sha256 = payload_sha256.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current_generation: i64 = tx.query_row(
                "SELECT local_generation FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            if current_generation != expected_local_generation {
                return Err(rusqlite::Error::InvalidParameterName(format!(
                    "stale:{current_generation}"
                )));
            }
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source,
                   expected_local_generation, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'prepared', ?10)",
                params![
                    op_id,
                    note_id,
                    mutation_kind,
                    source,
                    expected_local_generation,
                    target_relative_path,
                    journal_relative_path,
                    payload_size,
                    payload_sha256,
                    now_ms,
                ],
            )?;
            tx.execute(
                "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                 VALUES (?1, ?2, ?3)",
                params![note_id, op_id, now_ms],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = prepare_result {
        let _ = fs::remove_file(&journal_path);
        return Err(error);
    }

    let target_path = workspace_path.join(&relative);
    if let Err(error) = atomic_replace(&target_path, payload, &op_id) {
        return Err(error);
    }
    let file_metadata = fs::metadata(&target_path).map_err(|error| error.to_string())?;
    let (file_device, file_inode) = file_identity(&file_metadata);
    let file_mtime_ns = modified_ns(&file_metadata);
    let local_hash = blake3::hash(payload).to_hex().to_string();
    let file_size = file_metadata.len() as i64;

    store.with_blocking({
        let op_id = op_id.clone();
        move |conn| {
            conn.execute(
                "UPDATE mutation_intents
                    SET state='file_applied', file_applied_at_ms=?2
                  WHERE op_id=?1 AND state='prepared'",
                params![op_id, unix_ms()],
            )?;
            Ok(())
        }
    })?;

    let queued_for_sync = scope_kind != "local_only" && source != "team-sync";
    let outbox_relative_path = format!("outbox/{op_id}.payload");
    if queued_for_sync {
        let outbox_dir = metadata_dir.join("outbox");
        fs::create_dir_all(&outbox_dir).map_err(|error| error.to_string())?;
        atomic_replace(&metadata_dir.join(&outbox_relative_path), payload, &op_id)?;
    }

    let next_generation = expected_local_generation + 1;
    store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let normalized_key = normalized_key.clone();
        let scope_kind = scope_kind.clone();
        let scope_id = scope_id.clone();
        let outbox_relative_path = outbox_relative_path.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current_generation: i64 = tx.query_row(
                "SELECT local_generation FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            if current_generation != expected_local_generation {
                return Err(rusqlite::Error::InvalidParameterName(format!(
                    "stale:{current_generation}"
                )));
            }
            tx.execute(
                "UPDATE local_notes
                    SET file_device=?2, file_inode=?3, file_size=?4,
                        file_mtime_ns=?5, updated_at_ms=?6, status='active',
                        missing_since_ms=NULL
                  WHERE note_id=?1 AND normalized_path_key=?7",
                params![
                    note_id,
                    file_device,
                    file_inode,
                    file_size,
                    file_mtime_ns,
                    now_ms,
                    normalized_key,
                ],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET local_generation=?2, local_hash=?3, updated_at_ms=?4
                  WHERE note_id=?1",
                params![note_id, next_generation, local_hash, now_ms],
            )?;
            if queued_for_sync {
                let client_sequence =
                    allocate_client_sequence(&tx, &scope_kind, &scope_id, now_ms)?;
                let base_revision_id: Option<String> = tx
                    .query_row(
                        "SELECT base_revision_id FROM note_heads WHERE note_id=?1",
                        [&note_id],
                        |row| row.get(0),
                    )
                    .optional()?
                    .flatten();
                tx.execute(
                    "INSERT INTO outbox_operations (
                       op_id, note_id, scope_kind, scope_id, client_sequence,
                       base_revision_id, payload_relative_path, state,
                       created_at_ms, updated_at_ms
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8)",
                    params![
                        op_id,
                        note_id,
                        scope_kind,
                        scope_id,
                        client_sequence,
                        base_revision_id,
                        outbox_relative_path,
                        now_ms,
                    ],
                )?;
            }
            tx.execute(
                "UPDATE mutation_intents
                    SET state='committed', committed_at_ms=?2
                  WHERE op_id=?1 AND state='file_applied'",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "DELETE FROM note_mutation_locks WHERE note_id=?1 AND op_id=?2",
                params![note_id, op_id],
            )?;
            tx.commit()
        }
    })?;

    fs::remove_file(&journal_path).map_err(|error| error.to_string())?;

    Ok(WriteCommit {
        op_id,
        note_id,
        local_generation: next_generation,
        queued_for_sync,
        scope_kind: Some(scope_kind),
        scope_id: Some(scope_id),
    })
}

pub fn commit_create(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    payload: &[u8],
    source: &str,
) -> Result<WriteCommit, String> {
    commit_create_with_note_id(
        store,
        workspace_path,
        relative_path,
        payload,
        source,
        &new_note_id(),
    )
}

pub(crate) fn commit_create_with_note_id(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    payload: &[u8],
    source: &str,
    requested_note_id: &str,
) -> Result<WriteCommit, String> {
    uuid::Uuid::parse_str(requested_note_id).map_err(|_| "note id must be a UUID".to_string())?;
    let relative = safe_relative_path(relative_path)?;
    ensure_no_symlink_components(workspace_path, &relative)?;
    if !is_supported_note_path(&relative) {
        return Err("unsupported note path".to_string());
    }
    let target_path = workspace_path.join(&relative);
    if target_path.exists() {
        return Err("note already exists".to_string());
    }
    let parent = target_path
        .parent()
        .ok_or_else(|| "note path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let normalized_key = normalized_path_key(&relative);
    let already_indexed: bool = store.with_blocking({
        let normalized_key = normalized_key.clone();
        move |conn| {
            conn.query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM local_notes WHERE normalized_path_key=?1
                 )",
                [normalized_key],
                |row| row.get(0),
            )
        }
    })?;
    if already_indexed {
        return Err("note path already has an identity".to_string());
    }

    let note_id = requested_note_id.to_string();
    let op_id = new_note_id();
    let metadata_dir = workspace_path.join(".lokus");
    let target_relative_path = slash_path(&relative);
    let journal_relative_path = format!("note-journal/{op_id}.pending");
    let payload_size = payload.len() as i64;
    let payload_sha256 = hex::encode(Sha256::digest(payload));
    let journal_path = write_journal_record(
        &metadata_dir,
        JournalHeader {
            version: 1,
            op_id: op_id.clone(),
            note_id: note_id.clone(),
            mutation_kind: "create".to_string(),
            target_relative_path: target_relative_path.clone(),
            expected_local_generation: None,
            payload_len: 0,
            payload_sha256: String::new(),
        },
        payload,
    )?;
    let now_ms = unix_ms();
    let note_kind = if relative
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
    {
        "plain_text"
    } else {
        "markdown"
    };
    let prepare = store.with_blocking({
        let note_id = note_id.clone();
        let op_id = op_id.clone();
        let source = source.to_string();
        let normalized_key = normalized_key.clone();
        let payload_sha256 = payload_sha256.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "INSERT OR IGNORE INTO sync_scopes (
                   scope_kind, scope_id, status, created_at_ms, updated_at_ms
                 ) VALUES ('local_only', 'workspace', 'active', ?1, ?1)",
                [now_ms],
            )?;
            tx.execute(
                "INSERT INTO local_notes (
                   note_id, relative_path, normalized_path_key, note_kind, status,
                   scope_kind, scope_id, file_size, file_mtime_ns,
                   created_at_ms, updated_at_ms
                 ) VALUES (
                   ?1, ?2, ?3, ?4, 'active', 'local_only', 'workspace',
                   0, 0, ?5, ?5
                 )",
                params![
                    note_id,
                    target_relative_path,
                    normalized_key,
                    note_kind,
                    now_ms
                ],
            )?;
            tx.execute(
                "INSERT INTO note_heads (
                   note_id, local_generation, updated_at_ms
                 ) VALUES (?1, 0, ?2)",
                params![note_id, now_ms],
            )?;
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source,
                   target_relative_path, journal_relative_path,
                   payload_size, payload_sha256, state, created_at_ms
                 ) VALUES (
                   ?1, ?2, 'create', ?3, ?4, ?5, ?6, ?7, 'prepared', ?8
                 )",
                params![
                    op_id,
                    note_id,
                    source,
                    target_relative_path,
                    journal_relative_path,
                    payload_size,
                    payload_sha256,
                    now_ms
                ],
            )?;
            tx.execute(
                "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                 VALUES (?1, ?2, ?3)",
                params![note_id, op_id, now_ms],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = prepare {
        let _ = fs::remove_file(&journal_path);
        return Err(error);
    }

    atomic_replace(&target_path, payload, &op_id)?;
    let metadata = fs::metadata(&target_path).map_err(|error| error.to_string())?;
    let (file_device, file_inode) = file_identity(&metadata);
    let local_hash = blake3::hash(payload).to_hex().to_string();
    store.with_blocking({
        let note_id = note_id.clone();
        let op_id = op_id.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "UPDATE mutation_intents
                    SET state='file_applied', file_applied_at_ms=?2
                  WHERE op_id=?1",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "UPDATE local_notes
                    SET file_device=?2, file_inode=?3, file_size=?4,
                        file_mtime_ns=?5, updated_at_ms=?6
                  WHERE note_id=?1",
                params![
                    note_id,
                    file_device,
                    file_inode,
                    metadata.len() as i64,
                    modified_ns(&metadata),
                    now_ms
                ],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET local_generation=1, local_hash=?2, updated_at_ms=?3
                  WHERE note_id=?1",
                params![note_id, local_hash, now_ms],
            )?;
            tx.execute(
                "UPDATE mutation_intents
                    SET state='committed', committed_at_ms=?2
                  WHERE op_id=?1",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "DELETE FROM note_mutation_locks WHERE note_id=?1 AND op_id=?2",
                params![note_id, op_id],
            )?;
            tx.commit()
        }
    })?;
    fs::remove_file(journal_path).map_err(|error| error.to_string())?;

    Ok(WriteCommit {
        op_id,
        note_id,
        local_generation: 1,
        queued_for_sync: false,
        scope_kind: Some("local_only".to_string()),
        scope_id: Some("workspace".to_string()),
    })
}

pub fn apply_remote_write(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    payload: &[u8],
    remote_revision_id: &str,
    remote_sequence: Option<i64>,
) -> Result<WriteCommit, String> {
    if remote_revision_id.is_empty() {
        return Err("remote revision id is required".to_string());
    }
    let relative = safe_relative_path(relative_path)?;
    let path_key = normalized_path_key(&relative);
    let (note_id, generation): (String, i64) = store.with_blocking({
        let path_key = path_key.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.note_id, head.local_generation
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.normalized_path_key=?1",
                [path_key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
        }
    })?;

    let op_id = new_note_id();
    let metadata_dir = workspace_path.join(".lokus");
    let target_relative_path = slash_path(&relative);
    let journal_relative_path = format!("note-journal/{op_id}.pending");
    let payload_size = payload.len() as i64;
    let payload_sha256 = hex::encode(Sha256::digest(payload));
    let journal_path = write_journal_record(
        &metadata_dir,
        JournalHeader {
            version: 1,
            op_id: op_id.clone(),
            note_id: note_id.clone(),
            mutation_kind: "apply_remote".to_string(),
            target_relative_path: target_relative_path.clone(),
            expected_local_generation: Some(generation),
            payload_len: 0,
            payload_sha256: String::new(),
        },
        payload,
    )?;
    let now_ms = unix_ms();
    let prepare = store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let payload_sha256 = payload_sha256.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source,
                   expected_local_generation, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms
                 ) VALUES (
                   ?1, ?2, 'apply_remote', 'personal-sync', ?3, ?4, ?5,
                   ?6, ?7, 'prepared', ?8
                 )",
                params![
                    op_id,
                    note_id,
                    generation,
                    target_relative_path,
                    journal_relative_path,
                    payload_size,
                    payload_sha256,
                    now_ms
                ],
            )?;
            tx.execute(
                "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                 VALUES (?1, ?2, ?3)",
                params![note_id, op_id, now_ms],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = prepare {
        let _ = fs::remove_file(&journal_path);
        return Err(error);
    }

    let target_path = workspace_path.join(&relative);
    atomic_replace(&target_path, payload, &op_id)?;
    let metadata = fs::metadata(&target_path).map_err(|error| error.to_string())?;
    let (file_device, file_inode) = file_identity(&metadata);
    let local_hash = blake3::hash(payload).to_hex().to_string();
    let next_generation = generation + 1;
    store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let remote_revision_id = remote_revision_id.to_string();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current_generation: i64 = tx.query_row(
                "SELECT local_generation FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            if current_generation != generation {
                return Err(rusqlite::Error::InvalidParameterName(
                    "local generation changed during remote apply".to_string(),
                ));
            }
            tx.execute(
                "UPDATE mutation_intents
                    SET state='file_applied', file_applied_at_ms=?2
                  WHERE op_id=?1",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "UPDATE local_notes
                    SET file_device=?2, file_inode=?3, file_size=?4,
                        file_mtime_ns=?5, updated_at_ms=?6, status='active',
                        missing_since_ms=NULL
                  WHERE note_id=?1",
                params![
                    note_id,
                    file_device,
                    file_inode,
                    metadata.len() as i64,
                    modified_ns(&metadata),
                    now_ms
                ],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET local_generation=?2, local_hash=?3,
                        remote_revision_id=?4, remote_sequence=?5,
                        base_revision_id=?4, base_hash=?3, updated_at_ms=?6
                  WHERE note_id=?1",
                params![
                    note_id,
                    next_generation,
                    local_hash,
                    remote_revision_id,
                    remote_sequence,
                    now_ms
                ],
            )?;
            tx.execute(
                "UPDATE mutation_intents
                    SET state='committed', committed_at_ms=?2
                  WHERE op_id=?1",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "DELETE FROM note_mutation_locks WHERE note_id=?1 AND op_id=?2",
                params![note_id, op_id],
            )?;
            tx.commit()
        }
    })?;
    fs::remove_file(journal_path).map_err(|error| error.to_string())?;

    Ok(WriteCommit {
        op_id,
        note_id,
        local_generation: next_generation,
        queued_for_sync: false,
        scope_kind: None,
        scope_id: None,
    })
}

pub fn commit_tombstone(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &str,
    source: &str,
) -> Result<WriteCommit, String> {
    let relative = safe_relative_path(relative_path)?;
    let target_path = workspace_path.join(&relative);
    if !target_path.is_file() {
        return Err("note file does not exist".to_string());
    }
    let path_key = normalized_path_key(&relative);
    let (note_id, generation, scope_kind, scope_id, pending_scope_id): (
        String,
        i64,
        String,
        String,
        Option<String>,
    ) = store.with_blocking(move |conn| {
        conn.query_row(
            "SELECT note.note_id, head.local_generation,
                        note.scope_kind, note.scope_id, note.pending_scope_id
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.normalized_path_key=?1 AND note.status='active'",
            [path_key],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
    })?;
    if pending_scope_id.is_some() {
        return Err("note move is pending".to_string());
    }
    let payload = fs::read(&target_path).map_err(|error| error.to_string())?;
    let op_id = new_note_id();
    let metadata_dir = workspace_path.join(".lokus");
    let target_relative_path = slash_path(&relative);
    let journal_relative_path = format!("note-journal/{op_id}.pending");
    let payload_size = payload.len() as i64;
    let payload_sha256 = hex::encode(Sha256::digest(&payload));
    let journal_path = write_journal_record(
        &metadata_dir,
        JournalHeader {
            version: 1,
            op_id: op_id.clone(),
            note_id: note_id.clone(),
            mutation_kind: "delete".to_string(),
            target_relative_path: target_relative_path.clone(),
            expected_local_generation: Some(generation),
            payload_len: 0,
            payload_sha256: String::new(),
        },
        &payload,
    )?;
    let now_ms = unix_ms();
    let prepare = store.with_blocking({
        let note_id = note_id.clone();
        let op_id = op_id.clone();
        let source = source.to_string();
        let payload_sha256 = payload_sha256.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current: i64 = tx.query_row(
                "SELECT local_generation FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            if current != generation {
                return Err(rusqlite::Error::InvalidParameterName(
                    "stale delete generation".to_string(),
                ));
            }
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source,
                   expected_local_generation, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms
                 ) VALUES (
                   ?1, ?2, 'delete', ?3, ?4, ?5, ?6, ?7, ?8,
                   'prepared', ?9
                 )",
                params![
                    op_id,
                    note_id,
                    source,
                    generation,
                    target_relative_path,
                    journal_relative_path,
                    payload_size,
                    payload_sha256,
                    now_ms
                ],
            )?;
            tx.execute(
                "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                 VALUES (?1, ?2, ?3)",
                params![note_id, op_id, now_ms],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = prepare {
        let _ = fs::remove_file(&journal_path);
        return Err(error);
    }

    let trash_dir = metadata_dir.join("trash").join(&note_id);
    fs::create_dir_all(&trash_dir).map_err(|error| error.to_string())?;
    let filename = relative
        .file_name()
        .ok_or_else(|| "note path has no filename".to_string())?;
    let mut trash_path = trash_dir.join(filename);
    if trash_path.exists() {
        trash_path = trash_dir.join(format!("{op_id}-{}", filename.to_string_lossy()));
    }
    fs::rename(&target_path, &trash_path).map_err(|error| error.to_string())?;
    sync_directory(
        target_path
            .parent()
            .ok_or_else(|| "note path has no parent".to_string())?,
    )?;
    sync_directory(&trash_dir)?;

    let queued = scope_kind != "local_only" && source != "team-sync";
    let outbox_relative_path = format!("outbox/{op_id}.payload");
    if queued {
        let outbox_path = metadata_dir.join(&outbox_relative_path);
        fs::create_dir_all(
            outbox_path
                .parent()
                .ok_or_else(|| "outbox path has no parent".to_string())?,
        )
        .map_err(|error| error.to_string())?;
        atomic_replace(&outbox_path, &payload, &op_id)?;
    }
    let next_generation = generation + 1;
    let commit_scope_kind = scope_kind.clone();
    let commit_scope_id = scope_id.clone();
    store.with_blocking({
        let note_id = note_id.clone();
        let op_id = op_id.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "UPDATE local_notes
                    SET status='tombstoned', updated_at_ms=?2
                  WHERE note_id=?1",
                params![note_id, now_ms],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET local_generation=?2, updated_at_ms=?3
                  WHERE note_id=?1",
                params![note_id, next_generation, now_ms],
            )?;
            tx.execute(
                "INSERT INTO local_tombstones (
                   note_id, op_id, local_generation,
                   retention_expires_at_ms, created_at_ms
                 ) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT (note_id) DO UPDATE SET
                   op_id=excluded.op_id,
                   local_generation=excluded.local_generation,
                   retention_expires_at_ms=excluded.retention_expires_at_ms,
                   restored_at_ms=NULL,
                   created_at_ms=excluded.created_at_ms",
                params![
                    note_id,
                    op_id,
                    next_generation,
                    now_ms + 30 * 24 * 60 * 60 * 1000_i64,
                    now_ms
                ],
            )?;
            if queued {
                let sequence = allocate_client_sequence(&tx, &scope_kind, &scope_id, now_ms)?;
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
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8)",
                    params![
                        op_id,
                        note_id,
                        scope_kind,
                        scope_id,
                        sequence,
                        base_revision_id,
                        outbox_relative_path,
                        now_ms
                    ],
                )?;
            }
            tx.execute(
                "UPDATE mutation_intents
                    SET state='committed', file_applied_at_ms=?2,
                        committed_at_ms=?2
                  WHERE op_id=?1",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "DELETE FROM note_mutation_locks WHERE note_id=?1 AND op_id=?2",
                params![note_id, op_id],
            )?;
            tx.commit()
        }
    })?;
    fs::remove_file(journal_path).map_err(|error| error.to_string())?;

    Ok(WriteCommit {
        op_id,
        note_id,
        local_generation: next_generation,
        queued_for_sync: queued,
        scope_kind: Some(commit_scope_kind),
        scope_id: Some(commit_scope_id),
    })
}

pub fn commit_relocate(
    store: &NoteStore,
    workspace_path: &Path,
    source_relative_path: &str,
    target_relative_path: &str,
    mutation_kind: &str,
    source: &str,
) -> Result<WriteCommit, String> {
    if !matches!(mutation_kind, "rename" | "move") {
        return Err("note relocation must be rename or move".to_string());
    }
    let source_relative = safe_relative_path(source_relative_path)?;
    let target_relative = safe_relative_path(target_relative_path)?;
    ensure_no_symlink_components(workspace_path, &target_relative)?;
    if !is_supported_note_path(&source_relative) || !is_supported_note_path(&target_relative) {
        return Err("unsupported note path".to_string());
    }
    let source_path = workspace_path.join(&source_relative);
    let target_path = workspace_path.join(&target_relative);
    if !source_path.is_file() {
        return Err("source note does not exist".to_string());
    }
    let source_key = normalized_path_key(&source_relative);
    let target_key = normalized_path_key(&target_relative);
    if target_path.exists() && source_key != target_key {
        return Err("destination note already exists".to_string());
    }
    let (note_id, generation, scope_kind, scope_id, pending_scope_id): (
        String,
        i64,
        String,
        String,
        Option<String>,
    ) = store.with_blocking({
        let source_key = source_key.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.note_id, head.local_generation,
                            note.scope_kind, note.scope_id, note.pending_scope_id
                       FROM local_notes note
                       JOIN note_heads head ON head.note_id=note.note_id
                      WHERE note.normalized_path_key=?1 AND note.status='active'",
                [source_key],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
        }
    })?;
    if pending_scope_id.is_some() {
        return Err("note move is pending".to_string());
    }
    let payload = fs::read(&source_path).map_err(|error| error.to_string())?;
    let op_id = new_note_id();
    let metadata_dir = workspace_path.join(".lokus");
    let target_relative_string = slash_path(&target_relative);
    let journal_relative_path = format!("note-journal/{op_id}.pending");
    let payload_size = payload.len() as i64;
    let payload_sha256 = hex::encode(Sha256::digest(&payload));
    let journal_path = write_journal_record(
        &metadata_dir,
        JournalHeader {
            version: 1,
            op_id: op_id.clone(),
            note_id: note_id.clone(),
            mutation_kind: mutation_kind.to_string(),
            target_relative_path: target_relative_string.clone(),
            expected_local_generation: Some(generation),
            payload_len: 0,
            payload_sha256: String::new(),
        },
        &payload,
    )?;
    let now_ms = unix_ms();
    let prepare = store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let source = source.to_string();
        let mutation_kind = mutation_kind.to_string();
        let target_relative_string = target_relative_string.clone();
        let journal_relative_path = journal_relative_path.clone();
        let payload_sha256 = payload_sha256.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current: i64 = tx.query_row(
                "SELECT local_generation FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            if current != generation {
                return Err(rusqlite::Error::InvalidParameterName(
                    "stale relocation generation".to_string(),
                ));
            }
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source,
                   expected_local_generation, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'prepared', ?10)",
                params![
                    op_id,
                    note_id,
                    mutation_kind,
                    source,
                    generation,
                    target_relative_string,
                    journal_relative_path,
                    payload_size,
                    payload_sha256,
                    now_ms
                ],
            )?;
            tx.execute(
                "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                 VALUES (?1, ?2, ?3)",
                params![note_id, op_id, now_ms],
            )?;
            tx.commit()
        }
    });
    if let Err(error) = prepare {
        let _ = fs::remove_file(&journal_path);
        return Err(error);
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let same_parent = source_path.parent() == target_path.parent();
    if source_key == target_key && same_parent && source_path != target_path {
        let target_name = target_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "destination note name is invalid".to_string())?;
        rename_path_case_safe(&source_path, target_name)?;
    } else {
        fs::rename(&source_path, &target_path).map_err(|error| error.to_string())?;
        if let Some(parent) = source_path.parent() {
            sync_directory(parent)?;
        }
        if target_path.parent() != source_path.parent() {
            if let Some(parent) = target_path.parent() {
                sync_directory(parent)?;
            }
        }
    }
    store.with_blocking({
        let op_id = op_id.clone();
        move |conn| {
            conn.execute(
                "UPDATE mutation_intents
                    SET state='file_applied', file_applied_at_ms=?2
                  WHERE op_id=?1 AND state='prepared'",
                params![op_id, unix_ms()],
            )?;
            Ok(())
        }
    })?;

    let metadata = fs::metadata(&target_path).map_err(|error| error.to_string())?;
    let (file_device, file_inode) = file_identity(&metadata);
    let local_hash = blake3::hash(&payload).to_hex().to_string();
    let queued = scope_kind != "local_only" && source != "team-sync";
    let outbox_relative_path = format!("outbox/{op_id}.payload");
    if queued {
        fs::create_dir_all(metadata_dir.join("outbox")).map_err(|error| error.to_string())?;
        atomic_replace(&metadata_dir.join(&outbox_relative_path), &payload, &op_id)?;
    }
    let next_generation = generation + 1;
    let commit_scope_kind = scope_kind.clone();
    let commit_scope_id = scope_id.clone();
    store.with_blocking({
        let op_id = op_id.clone();
        let note_id = note_id.clone();
        let target_relative_string = target_relative_string.clone();
        let target_key = target_key.clone();
        let mutation_kind = mutation_kind.to_string();
        let outbox_relative_path = outbox_relative_path.clone();
        move |conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current: i64 = tx.query_row(
                "SELECT local_generation FROM note_heads WHERE note_id=?1",
                [&note_id],
                |row| row.get(0),
            )?;
            if current != generation {
                return Err(rusqlite::Error::InvalidParameterName(
                    "relocation generation changed".to_string(),
                ));
            }
            tx.execute(
                "UPDATE local_notes
                    SET relative_path=?2, normalized_path_key=?3,
                        file_device=?4, file_inode=?5, file_size=?6,
                        file_mtime_ns=?7, status='active', missing_since_ms=NULL,
                        updated_at_ms=?8
                  WHERE note_id=?1",
                params![
                    note_id,
                    target_relative_string,
                    target_key,
                    file_device,
                    file_inode,
                    metadata.len() as i64,
                    modified_ns(&metadata),
                    now_ms
                ],
            )?;
            tx.execute(
                "INSERT INTO note_path_history (
                   note_id, relative_path, normalized_path_key, reason,
                   first_seen_at_ms, last_seen_at_ms
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![
                    note_id,
                    target_relative_string,
                    target_key,
                    mutation_kind,
                    now_ms
                ],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET local_generation=?2, local_hash=?3, updated_at_ms=?4
                  WHERE note_id=?1",
                params![note_id, next_generation, local_hash, now_ms],
            )?;
            if queued {
                let sequence = allocate_client_sequence(&tx, &scope_kind, &scope_id, now_ms)?;
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
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8)",
                    params![
                        op_id,
                        note_id,
                        scope_kind,
                        scope_id,
                        sequence,
                        base_revision_id,
                        outbox_relative_path,
                        now_ms
                    ],
                )?;
            }
            tx.execute(
                "UPDATE mutation_intents
                    SET state='committed', committed_at_ms=?2
                  WHERE op_id=?1 AND state='file_applied'",
                params![op_id, now_ms],
            )?;
            tx.execute(
                "DELETE FROM note_mutation_locks WHERE note_id=?1 AND op_id=?2",
                params![note_id, op_id],
            )?;
            tx.commit()
        }
    })?;
    fs::remove_file(journal_path).map_err(|error| error.to_string())?;
    Ok(WriteCommit {
        op_id,
        note_id,
        local_generation: next_generation,
        queued_for_sync: queued,
        scope_kind: Some(commit_scope_kind),
        scope_id: Some(commit_scope_id),
    })
}

pub fn commit_restore(
    store: &NoteStore,
    workspace_path: &Path,
    note_id: &str,
    target_relative_path: &str,
    payload: &[u8],
    source: &str,
) -> Result<WriteCommit, String> {
    let requested = safe_relative_path(target_relative_path)?;
    let note_id_owned = note_id.to_string();
    let (stored_relative, generation, status): (String, i64, String) = store.with_blocking({
        let note_id = note_id_owned.clone();
        move |conn| {
            conn.query_row(
                "SELECT note.relative_path, head.local_generation, note.status
                   FROM local_notes note
                   JOIN note_heads head ON head.note_id=note.note_id
                  WHERE note.note_id=?1",
                [note_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
        }
    })?;
    if status != "tombstoned" {
        return Err("only a tombstoned note can be restored".to_string());
    }
    if normalized_path_key(&requested) != normalized_path_key(Path::new(&stored_relative)) {
        return Err("restore path must match the tombstoned note path".to_string());
    }
    let commit = commit_write_as(
        store,
        workspace_path,
        &stored_relative,
        payload,
        generation,
        source,
        "restore",
    )?;
    store.with_blocking(move |conn| {
        conn.execute(
            "UPDATE local_tombstones SET restored_at_ms=?2 WHERE note_id=?1",
            params![note_id_owned, unix_ms()],
        )?;
        Ok(())
    })?;
    Ok(commit)
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

fn ensure_no_symlink_components(workspace_path: &Path, relative_path: &Path) -> Result<(), String> {
    let mut current = workspace_path.to_path_buf();
    for component in relative_path.components() {
        let Component::Normal(segment) = component else {
            return Err("invalid relative note path".to_string());
        };
        current.push(segment);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("note path contains a symbolic link".to_string());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}

fn slash_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

fn modified_ns(metadata: &fs::Metadata) -> i64 {
    metadata
        .modified()
        .unwrap_or(UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .min(i64::MAX as u128) as i64
}

#[cfg(unix)]
fn file_identity(metadata: &fs::Metadata) -> (Option<u64>, Option<u64>) {
    use std::os::unix::fs::MetadataExt;
    (Some(metadata.dev()), Some(metadata.ino()))
}

#[cfg(not(unix))]
fn file_identity(_metadata: &fs::Metadata) -> (Option<u64>, Option<u64>) {
    (None, None)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::super::backfill::backfill_workspace;
    use super::*;

    #[test]
    fn write_commit_is_durable_and_cleans_the_journal() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();

        let commit =
            commit_write(&store, workspace.path(), "note.md", b"after", 0, "editor").unwrap();

        assert_eq!(
            fs::read(workspace.path().join("note.md")).unwrap(),
            b"after"
        );
        assert_eq!(commit.local_generation, 1);
        assert!(!commit.queued_for_sync);
        let (generation, state, lock_count): (i64, String, i64) = store
            .with_blocking({
                let op_id = commit.op_id.clone();
                let note_id = commit.note_id.clone();
                move |conn| {
                    Ok((
                        conn.query_row(
                            "SELECT local_generation FROM note_heads WHERE note_id=?1",
                            [&note_id],
                            |row| row.get(0),
                        )?,
                        conn.query_row(
                            "SELECT state FROM mutation_intents WHERE op_id=?1",
                            [&op_id],
                            |row| row.get(0),
                        )?,
                        conn.query_row(
                            "SELECT count(*) FROM note_mutation_locks WHERE note_id=?1",
                            [&note_id],
                            |row| row.get(0),
                        )?,
                    ))
                }
            })
            .unwrap();
        assert_eq!(generation, 1);
        assert_eq!(state, "committed");
        assert_eq!(lock_count, 0);
        assert!(!workspace
            .path()
            .join(".lokus")
            .join("note-journal")
            .join(format!("{}.pending", commit.op_id))
            .exists());
    }

    #[test]
    fn stale_generation_never_overwrites_the_file() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();

        let result = commit_write(&store, workspace.path(), "note.md", b"stale", 99, "editor");

        assert!(result.is_err());
        assert_eq!(
            fs::read(workspace.path().join("note.md")).unwrap(),
            b"before"
        );
    }

    #[test]
    fn team_scoped_write_enters_the_durable_outbox() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
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
                    "UPDATE local_notes
                        SET scope_kind='team', scope_id='space-1'
                      WHERE normalized_path_key='note.md'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();

        let commit =
            commit_write(&store, workspace.path(), "note.md", b"after", 0, "editor").unwrap();

        assert!(commit.queued_for_sync);
        let outbox_state: String = store
            .with_blocking({
                let op_id = commit.op_id.clone();
                move |conn| {
                    conn.query_row(
                        "SELECT state FROM outbox_operations WHERE op_id=?1",
                        [&op_id],
                        |row| row.get(0),
                    )
                }
            })
            .unwrap();
        assert_eq!(outbox_state, "pending");
    }

    #[test]
    fn client_sequences_are_monotonic_across_team_spaces() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("personal.md"), "personal").unwrap();
        fs::write(workspace.path().join("one.md"), "one").unwrap();
        fs::write(workspace.path().join("two.md"), "two").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        store
            .with_blocking(|conn| {
                conn.execute_batch(
                    r#"
INSERT INTO sync_scopes (
  scope_kind, scope_id, team_id, permission_epoch, key_epoch,
  status, created_at_ms, updated_at_ms
) VALUES
  ('personal', 'workspace-1', NULL, NULL, NULL, 'active', 1, 1),
  ('team', 'space-1', 'team-1', 1, 1, 'active', 1, 1),
  ('team', 'space-2', 'team-1', 1, 1, 'active', 1, 1);
UPDATE local_notes SET scope_kind='team', scope_id='space-1'
 WHERE normalized_path_key='one.md';
UPDATE local_notes SET scope_kind='team', scope_id='space-2'
 WHERE normalized_path_key='two.md';
UPDATE local_notes SET scope_kind='personal', scope_id='workspace-1'
 WHERE normalized_path_key='personal.md';
"#,
                )?;
                Ok(())
            })
            .unwrap();

        commit_write(
            &store,
            workspace.path(),
            "personal.md",
            b"personal edit",
            0,
            "editor",
        )
        .unwrap();
        commit_write(&store, workspace.path(), "one.md", b"one edit", 0, "editor").unwrap();
        commit_write(&store, workspace.path(), "two.md", b"two edit", 0, "editor").unwrap();

        let sequences: Vec<i64> = store
            .with_blocking(|conn| {
                let mut statement = conn.prepare(
                    "SELECT client_sequence FROM outbox_operations
                      WHERE scope_kind='team' ORDER BY client_sequence",
                )?;
                let values = statement
                    .query_map([], |row| row.get(0))?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(values)
            })
            .unwrap();
        assert_eq!(sequences, vec![1, 2]);
    }

    #[test]
    fn create_commit_allocates_identity_and_persists_new_file() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();

        let commit = commit_create(
            &store,
            workspace.path(),
            "Daily Notes/2026-08-22.md",
            b"# Today",
            "daily-note",
        )
        .unwrap();

        assert_eq!(commit.local_generation, 1);
        assert_eq!(
            fs::read(workspace.path().join("Daily Notes/2026-08-22.md")).unwrap(),
            b"# Today"
        );
        let stored_id: String = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT note_id FROM local_notes
                     WHERE relative_path='Daily Notes/2026-08-22.md'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(stored_id, commit.note_id);
    }

    #[test]
    fn remote_apply_updates_three_heads_without_echoing_to_outbox() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        store
            .with_blocking(|conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('personal', 'workspace-1', 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "UPDATE local_notes
                        SET scope_kind='personal', scope_id='workspace-1'",
                    [],
                )?;
                Ok(())
            })
            .unwrap();

        let commit = apply_remote_write(
            &store,
            workspace.path(),
            "note.md",
            b"remote",
            "remote-hash",
            Some(7),
        )
        .unwrap();

        assert_eq!(
            fs::read(workspace.path().join("note.md")).unwrap(),
            b"remote"
        );
        assert!(!commit.queued_for_sync);
        let (remote, base, sequence, outbox): (String, String, i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT remote_revision_id FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT base_revision_id FROM note_heads", [], |row| {
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
        assert_eq!(remote, "remote-hash");
        assert_eq!(base, "remote-hash");
        assert_eq!(sequence, 7);
        assert_eq!(outbox, 0);
    }

    #[test]
    fn tombstone_moves_file_to_trash_and_never_infers_delete_from_absence() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "content").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();

        let commit =
            commit_tombstone(&store, workspace.path(), "note.md", "file-tree-delete").unwrap();

        assert!(!workspace.path().join("note.md").exists());
        assert!(workspace
            .path()
            .join(".lokus")
            .join("trash")
            .join(&commit.note_id)
            .join("note.md")
            .exists());
        let (status, tombstones): (String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT status FROM local_notes", [], |row| row.get(0))?,
                    conn.query_row("SELECT count(*) FROM local_tombstones", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(status, "tombstoned");
        assert_eq!(tombstones, 1);
    }

    #[test]
    fn team_note_relocation_preserves_identity_and_queues_the_new_path_snapshot() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "content").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let original_id: String = store
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
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();

        let commit = commit_relocate(
            &store,
            workspace.path(),
            "note.md",
            "Archive/Renamed.md",
            "move",
            "file-tree-move",
        )
        .unwrap();

        assert_eq!(commit.note_id, original_id);
        assert!(!workspace.path().join("note.md").exists());
        assert_eq!(
            fs::read_to_string(workspace.path().join("Archive/Renamed.md")).unwrap(),
            "content"
        );
        let (relative_path, kind, outbox): (String, String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT relative_path FROM local_notes", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT mutation_kind FROM mutation_intents", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT count(*) FROM outbox_operations", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(relative_path, "Archive/Renamed.md");
        assert_eq!(kind, "move");
        assert_eq!(outbox, 1);
    }

    #[test]
    fn remote_restore_reactivates_the_same_identity_without_echo() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
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
        let tombstone = commit_tombstone(&store, workspace.path(), "note.md", "team-sync").unwrap();

        let restore = commit_restore(
            &store,
            workspace.path(),
            &tombstone.note_id,
            "note.md",
            b"restored",
            "team-sync",
        )
        .unwrap();

        assert_eq!(restore.note_id, tombstone.note_id);
        assert!(!restore.queued_for_sync);
        assert_eq!(
            fs::read_to_string(workspace.path().join("note.md")).unwrap(),
            "restored"
        );
        let (status, outbox): (String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT status FROM local_notes", [], |row| row.get(0))?,
                    conn.query_row("SELECT count(*) FROM outbox_operations", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(status, "active");
        assert_eq!(outbox, 0);
    }

    #[test]
    fn local_team_restore_queues_the_restore_lifecycle_operation() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
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
        let tombstone = commit_tombstone(&store, workspace.path(), "note.md", "team-sync").unwrap();

        let restore = commit_restore(
            &store,
            workspace.path(),
            &tombstone.note_id,
            "note.md",
            b"restored",
            "user-restore",
        )
        .unwrap();

        assert!(restore.queued_for_sync);
        let kind: String = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT intent.mutation_kind
                       FROM mutation_intents intent
                       JOIN outbox_operations outbox ON outbox.op_id=intent.op_id",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(kind, "restore");
    }

    #[cfg(unix)]
    #[test]
    fn note_creation_refuses_symlinked_workspace_parents() {
        use std::os::unix::fs::symlink;

        let workspace = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        symlink(outside.path(), workspace.path().join("Linked")).unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();

        let error = commit_create(
            &store,
            workspace.path(),
            "Linked/planted.md",
            b"blocked",
            "team-sync",
        )
        .unwrap_err();

        assert!(error.contains("symbolic link"));
        assert!(!outside.path().join("planted.md").exists());
    }
}
