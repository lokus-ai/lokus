use std::fs;
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, TransactionBehavior};

use super::identity::normalized_path_key;
use super::journal::read_journal_record;
use super::sequence::allocate_client_sequence;
use super::store::NoteStore;
use super::writer::{atomic_replace, sync_directory};

#[derive(Debug, Default, PartialEq, Eq)]
pub struct RecoveryReport {
    pub recovered: usize,
    pub requires_attention: usize,
}

pub fn recover_pending_mutations(
    store: &NoteStore,
    workspace_path: &Path,
) -> Result<RecoveryReport, String> {
    #[allow(clippy::type_complexity)]
    let pending: Vec<(
        String,
        String,
        String,
        String,
        Option<i64>,
        String,
        String,
        String,
        String,
        String,
        String,
    )> = store.with_blocking(|conn| {
        let mut statement = conn.prepare(
            "SELECT intent.op_id, intent.note_id, intent.target_relative_path,
                        intent.journal_relative_path,
                        intent.expected_local_generation, intent.state,
                        note.scope_kind, note.scope_id,
                        intent.mutation_kind, note.relative_path, intent.source
                   FROM mutation_intents intent
                   JOIN local_notes note ON note.note_id=intent.note_id
                  WHERE intent.state IN ('prepared', 'file_applied')
                  ORDER BY intent.created_at_ms",
        )?;
        let rows = statement
            .query_map([], |row| {
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
                ))
            })?
            .collect();
        rows
    })?;

    let mut report = RecoveryReport::default();
    for (
        op_id,
        note_id,
        target_relative_path,
        journal_relative_path,
        expected_generation,
        state,
        scope_kind,
        scope_id,
        mutation_kind,
        original_relative_path,
        source,
    ) in pending
    {
        let journal_path = workspace_path.join(".lokus").join(&journal_relative_path);
        let record = match read_journal_record(&journal_path) {
            Ok(record)
                if record.header.op_id == op_id
                    && record.header.note_id == note_id
                    && record.header.target_relative_path == target_relative_path
                    && record.header.expected_local_generation == expected_generation =>
            {
                record
            }
            _ => {
                mark_recovery_required(store, &op_id, &note_id)?;
                report.requires_attention += 1;
                continue;
            }
        };
        let expected_generation_value = expected_generation.unwrap_or(0);
        let relative = safe_relative_path(&target_relative_path)?;
        let target_path = workspace_path.join(&relative);
        let current_generation: i64 = store.with_blocking({
            let note_id = note_id.clone();
            move |conn| {
                conn.query_row(
                    "SELECT local_generation FROM note_heads WHERE note_id=?1",
                    [note_id],
                    |row| row.get(0),
                )
            }
        })?;
        if current_generation != expected_generation_value
            && current_generation != expected_generation_value + 1
        {
            mark_recovery_required(store, &op_id, &note_id)?;
            report.requires_attention += 1;
            continue;
        }

        let is_relocation = matches!(mutation_kind.as_str(), "rename" | "move");
        let is_delete = mutation_kind == "delete";
        let mut applied_path = target_path.clone();
        if state == "prepared" && current_generation == expected_generation_value {
            if is_delete {
                applied_path =
                    recover_deleted_file(workspace_path, &note_id, &op_id, &target_path)?;
            } else if is_relocation {
                let original = safe_relative_path(&original_relative_path)?;
                let original_path = workspace_path.join(original);
                let target_exists = target_path.exists();
                let original_exists = original_path.exists();
                let paths_are_same_file = if target_exists && original_exists {
                    matches!(
                        (
                            fs::canonicalize(&target_path),
                            fs::canonicalize(&original_path)
                        ),
                        (Ok(target), Ok(original)) if target == original
                    )
                } else {
                    false
                };
                if original_exists && !target_exists {
                    if let Some(parent) = target_path.parent() {
                        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                    }
                    fs::rename(&original_path, &target_path).map_err(|error| error.to_string())?;
                    if let Some(parent) = original_path.parent() {
                        sync_directory(parent)?;
                    }
                    if target_path.parent() != original_path.parent() {
                        if let Some(parent) = target_path.parent() {
                            sync_directory(parent)?;
                        }
                    }
                } else if !(target_exists && (!original_exists || paths_are_same_file)) {
                    mark_recovery_required(store, &op_id, &note_id)?;
                    report.requires_attention += 1;
                    continue;
                }
            } else {
                atomic_replace(&target_path, &record.payload, &op_id)?;
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
        }

        if is_delete && !applied_path.exists() {
            applied_path = recover_deleted_file(workspace_path, &note_id, &op_id, &target_path)?;
        }
        let metadata = fs::metadata(&applied_path).map_err(|error| error.to_string())?;
        let local_hash = blake3::hash(&record.payload).to_hex().to_string();
        let now_ms = unix_ms();
        let queued =
            scope_kind != "local_only" && !matches!(source.as_str(), "personal-sync" | "team-sync");
        let outbox_relative_path = format!("outbox/{op_id}.payload");
        if queued {
            let outbox_dir = workspace_path.join(".lokus").join("outbox");
            fs::create_dir_all(&outbox_dir).map_err(|error| error.to_string())?;
            atomic_replace(
                &workspace_path.join(".lokus").join(&outbox_relative_path),
                &record.payload,
                &op_id,
            )?;
        }

        store.with_blocking({
            let op_id = op_id.clone();
            let note_id = note_id.clone();
            let target_relative_path = target_relative_path.clone();
            let mutation_kind = mutation_kind.clone();
            move |conn| {
                let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
                let generation: i64 = tx.query_row(
                    "SELECT local_generation FROM note_heads WHERE note_id=?1",
                    [&note_id],
                    |row| row.get(0),
                )?;
                if generation == expected_generation_value {
                    tx.execute(
                        "UPDATE note_heads
                            SET local_generation=?2, local_hash=?3, updated_at_ms=?4
                          WHERE note_id=?1",
                        params![note_id, expected_generation_value + 1, local_hash, now_ms],
                    )?;
                    if mutation_kind == "delete" {
                        tx.execute(
                            "UPDATE local_notes
                                SET status='tombstoned', updated_at_ms=?2
                              WHERE note_id=?1",
                            params![note_id, now_ms],
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
                                expected_generation_value + 1,
                                now_ms + 30 * 24 * 60 * 60 * 1000_i64,
                                now_ms
                            ],
                        )?;
                    } else if matches!(mutation_kind.as_str(), "rename" | "move") {
                        let target_key = normalized_path_key(Path::new(&target_relative_path));
                        tx.execute(
                            "UPDATE local_notes
                                SET relative_path=?2, normalized_path_key=?3,
                                    file_size=?4, file_mtime_ns=?5,
                                    updated_at_ms=?6, status='active',
                                    missing_since_ms=NULL
                              WHERE note_id=?1",
                            params![
                                note_id,
                                target_relative_path,
                                target_key,
                                metadata.len() as i64,
                                modified_ns(&metadata),
                                now_ms
                            ],
                        )?;
                        tx.execute(
                            "INSERT INTO note_path_history (
                               note_id, relative_path, normalized_path_key,
                               reason, first_seen_at_ms, last_seen_at_ms
                             ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                            params![
                                note_id,
                                target_relative_path,
                                target_key,
                                mutation_kind,
                                now_ms
                            ],
                        )?;
                    } else {
                        tx.execute(
                            "UPDATE local_notes
                                SET file_size=?2, file_mtime_ns=?3,
                                    updated_at_ms=?4, status='active',
                                    missing_since_ms=NULL
                              WHERE note_id=?1",
                            params![
                                note_id,
                                metadata.len() as i64,
                                modified_ns(&metadata),
                                now_ms
                            ],
                        )?;
                        if mutation_kind == "restore" {
                            tx.execute(
                                "UPDATE local_tombstones SET restored_at_ms=?2
                                  WHERE note_id=?1",
                                params![note_id, now_ms],
                            )?;
                        }
                    }
                }
                if queued {
                    let sequence = allocate_client_sequence(&tx, &scope_kind, &scope_id, now_ms)?;
                    let base_revision_id: Option<String> = tx.query_row(
                        "SELECT base_revision_id FROM note_heads WHERE note_id=?1",
                        [&note_id],
                        |row| row.get(0),
                    )?;
                    tx.execute(
                        "INSERT OR IGNORE INTO outbox_operations (
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
        fs::remove_file(&journal_path).map_err(|error| error.to_string())?;
        report.recovered += 1;
    }
    Ok(report)
}

fn recover_deleted_file(
    workspace_path: &Path,
    note_id: &str,
    op_id: &str,
    source_path: &Path,
) -> Result<std::path::PathBuf, String> {
    let filename = source_path
        .file_name()
        .ok_or_else(|| "deleted note has no filename".to_string())?;
    let trash_dir = workspace_path.join(".lokus").join("trash").join(note_id);
    fs::create_dir_all(&trash_dir).map_err(|error| error.to_string())?;
    let exact = trash_dir.join(filename);
    let operation_path = trash_dir.join(format!("{op_id}-{}", filename.to_string_lossy()));
    if source_path.exists() {
        let destination = if exact.exists() {
            operation_path
        } else {
            exact
        };
        fs::rename(source_path, &destination).map_err(|error| error.to_string())?;
        if let Some(parent) = source_path.parent() {
            sync_directory(parent)?;
        }
        sync_directory(&trash_dir)?;
        return Ok(destination);
    }
    if exact.is_file() {
        return Ok(exact);
    }
    if operation_path.is_file() {
        return Ok(operation_path);
    }
    Err("deleted note is missing from both workspace and trash".to_string())
}

fn mark_recovery_required(store: &NoteStore, op_id: &str, note_id: &str) -> Result<(), String> {
    let op_id = op_id.to_string();
    let note_id = note_id.to_string();
    store.with_blocking(move |conn| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute(
            "UPDATE mutation_intents
                SET state='recovery_required', error_code='journal_invalid'
              WHERE op_id=?1",
            [&op_id],
        )?;
        tx.execute(
            "DELETE FROM note_mutation_locks WHERE note_id=?1 AND op_id=?2",
            params![note_id, op_id],
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

#[cfg(test)]
mod tests {
    use std::fs;

    use rusqlite::params;

    use super::super::backfill::backfill_workspace;
    use super::super::journal::{write_journal_record, JournalHeader};
    use super::*;

    #[test]
    fn recovery_replays_prepared_write_and_commits_metadata() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let note_id: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        let path = write_journal_record(
            &workspace.path().join(".lokus"),
            JournalHeader {
                version: 1,
                op_id: "op-recover".to_string(),
                note_id: note_id.clone(),
                mutation_kind: "write".to_string(),
                target_relative_path: "note.md".to_string(),
                expected_local_generation: Some(0),
                payload_len: 0,
                payload_sha256: String::new(),
            },
            b"after",
        )
        .unwrap();
        store
            .with_blocking(move |conn| {
                conn.execute(
                    "INSERT INTO mutation_intents (
                       op_id, note_id, mutation_kind, source,
                       expected_local_generation, target_relative_path,
                       journal_relative_path, payload_size, payload_sha256,
                       state, created_at_ms
                     ) VALUES (
                       'op-recover', ?1, 'write', 'recovery-test', 0, 'note.md',
                       'note-journal/op-recover.pending', 5, 'ignored',
                       'prepared', 1
                     )",
                    [&note_id],
                )?;
                conn.execute(
                    "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                     VALUES (?1, 'op-recover', 1)",
                    [&note_id],
                )?;
                Ok(())
            })
            .unwrap();

        let report = recover_pending_mutations(&store, workspace.path()).unwrap();

        assert_eq!(report.recovered, 1);
        assert_eq!(
            fs::read(workspace.path().join("note.md")).unwrap(),
            b"after"
        );
        assert!(!path.exists());
        let (generation, state, locks): (i64, String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT local_generation FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row(
                        "SELECT state FROM mutation_intents WHERE op_id='op-recover'",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT count(*) FROM note_mutation_locks", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(generation, 1);
        assert_eq!(state, "committed");
        assert_eq!(locks, 0);
    }

    #[test]
    fn corrupted_journal_becomes_recovery_required_without_overwrite() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let note_id: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        let path = write_journal_record(
            &workspace.path().join(".lokus"),
            JournalHeader {
                version: 1,
                op_id: "op-corrupt".to_string(),
                note_id: note_id.clone(),
                mutation_kind: "write".to_string(),
                target_relative_path: "note.md".to_string(),
                expected_local_generation: Some(0),
                payload_len: 0,
                payload_sha256: String::new(),
            },
            b"after",
        )
        .unwrap();
        fs::write(&path, b"corrupt").unwrap();
        store
            .with_blocking(move |conn| {
                conn.execute(
                    "INSERT INTO mutation_intents (
                       op_id, note_id, mutation_kind, source,
                       expected_local_generation, target_relative_path,
                       journal_relative_path, payload_size, payload_sha256,
                       state, created_at_ms
                     ) VALUES (
                       'op-corrupt', ?1, 'write', 'recovery-test', 0, 'note.md',
                       'note-journal/op-corrupt.pending', 5, 'ignored',
                       'prepared', 1
                     )",
                    params![note_id],
                )?;
                conn.execute(
                    "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                     VALUES (?1, 'op-corrupt', 1)",
                    params![note_id],
                )?;
                Ok(())
            })
            .unwrap();

        let report = recover_pending_mutations(&store, workspace.path()).unwrap();

        assert_eq!(report.requires_attention, 1);
        assert_eq!(
            fs::read(workspace.path().join("note.md")).unwrap(),
            b"before"
        );
        let (state, locks): (String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row(
                        "SELECT state FROM mutation_intents WHERE op_id='op-corrupt'",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row("SELECT count(*) FROM note_mutation_locks", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(state, "recovery_required");
        assert_eq!(locks, 0);
    }

    #[test]
    fn recovery_finishes_a_relocation_after_the_filesystem_rename() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "content").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let note_id: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        write_journal_record(
            &workspace.path().join(".lokus"),
            JournalHeader {
                version: 1,
                op_id: "op-move".to_string(),
                note_id: note_id.clone(),
                mutation_kind: "move".to_string(),
                target_relative_path: "Archive/note.md".to_string(),
                expected_local_generation: Some(0),
                payload_len: 0,
                payload_sha256: String::new(),
            },
            b"content",
        )
        .unwrap();
        store
            .with_blocking(move |conn| {
                conn.execute(
                    "INSERT INTO mutation_intents (
                       op_id, note_id, mutation_kind, source,
                       expected_local_generation, target_relative_path,
                       journal_relative_path, payload_size, payload_sha256,
                       state, created_at_ms
                     ) VALUES (
                       'op-move', ?1, 'move', 'recovery-test', 0, 'Archive/note.md',
                       'note-journal/op-move.pending', 7, 'ignored',
                       'prepared', 1
                     )",
                    [&note_id],
                )?;
                conn.execute(
                    "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                     VALUES (?1, 'op-move', 1)",
                    [&note_id],
                )?;
                Ok(())
            })
            .unwrap();
        fs::create_dir_all(workspace.path().join("Archive")).unwrap();
        fs::rename(
            workspace.path().join("note.md"),
            workspace.path().join("Archive/note.md"),
        )
        .unwrap();

        let report = recover_pending_mutations(&store, workspace.path()).unwrap();

        assert_eq!(report.recovered, 1);
        assert!(!workspace.path().join("note.md").exists());
        let relative: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT relative_path FROM local_notes", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(relative, "Archive/note.md");
    }

    #[test]
    fn recovery_never_echoes_an_incoming_team_write_to_the_outbox() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let note_id: String = store
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
        write_journal_record(
            &workspace.path().join(".lokus"),
            JournalHeader {
                version: 1,
                op_id: "op-incoming".to_string(),
                note_id: note_id.clone(),
                mutation_kind: "write".to_string(),
                target_relative_path: "note.md".to_string(),
                expected_local_generation: Some(0),
                payload_len: 0,
                payload_sha256: String::new(),
            },
            b"remote",
        )
        .unwrap();
        store
            .with_blocking(move |conn| {
                conn.execute(
                    "INSERT INTO mutation_intents (
                       op_id, note_id, mutation_kind, source,
                       expected_local_generation, target_relative_path,
                       journal_relative_path, payload_size, payload_sha256,
                       state, created_at_ms
                     ) VALUES (
                       'op-incoming', ?1, 'write', 'team-sync', 0, 'note.md',
                       'note-journal/op-incoming.pending', 6, 'ignored',
                       'prepared', 1
                     )",
                    [&note_id],
                )?;
                conn.execute(
                    "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                     VALUES (?1, 'op-incoming', 1)",
                    [&note_id],
                )?;
                Ok(())
            })
            .unwrap();

        recover_pending_mutations(&store, workspace.path()).unwrap();

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
    fn recovery_finishes_a_prepared_create_with_null_expected_generation() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let note_id = "20000000-0000-7000-8000-000000009001";
        write_journal_record(
            &workspace.path().join(".lokus"),
            JournalHeader {
                version: 1,
                op_id: "op-create-crash".to_string(),
                note_id: note_id.to_string(),
                mutation_kind: "create".to_string(),
                target_relative_path: "created.md".to_string(),
                expected_local_generation: None,
                payload_len: 0,
                payload_sha256: String::new(),
            },
            b"created",
        )
        .unwrap();
        store
            .with_blocking(move |conn| {
                conn.execute(
                    "INSERT INTO sync_scopes (
                       scope_kind, scope_id, status, created_at_ms, updated_at_ms
                     ) VALUES ('local_only', 'workspace', 'active', 1, 1)",
                    [],
                )?;
                conn.execute(
                    "INSERT INTO local_notes (
                       note_id, relative_path, normalized_path_key, note_kind,
                       status, scope_kind, scope_id, file_size, file_mtime_ns,
                       created_at_ms, updated_at_ms
                     ) VALUES (
                       ?1, 'created.md', 'created.md', 'markdown', 'active',
                       'local_only', 'workspace', 0, 0, 1, 1
                     )",
                    [note_id],
                )?;
                conn.execute(
                    "INSERT INTO note_heads (note_id, local_generation, updated_at_ms)
                     VALUES (?1, 0, 1)",
                    [note_id],
                )?;
                conn.execute(
                    "INSERT INTO mutation_intents (
                       op_id, note_id, mutation_kind, source,
                       expected_local_generation, target_relative_path,
                       journal_relative_path, payload_size, payload_sha256,
                       state, created_at_ms
                     ) VALUES (
                       'op-create-crash', ?1, 'create', 'test', NULL, 'created.md',
                       'note-journal/op-create-crash.pending', 7, 'ignored',
                       'prepared', 1
                     )",
                    [note_id],
                )?;
                conn.execute(
                    "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                     VALUES (?1, 'op-create-crash', 1)",
                    [note_id],
                )?;
                Ok(())
            })
            .unwrap();

        let report = recover_pending_mutations(&store, workspace.path()).unwrap();

        assert_eq!(report.recovered, 1);
        assert_eq!(
            fs::read_to_string(workspace.path().join("created.md")).unwrap(),
            "created"
        );
    }

    #[test]
    fn recovery_keeps_a_prepared_delete_tombstoned() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("note.md"), "content").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let note_id: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        write_journal_record(
            &workspace.path().join(".lokus"),
            JournalHeader {
                version: 1,
                op_id: "op-delete-crash".to_string(),
                note_id: note_id.clone(),
                mutation_kind: "delete".to_string(),
                target_relative_path: "note.md".to_string(),
                expected_local_generation: Some(0),
                payload_len: 0,
                payload_sha256: String::new(),
            },
            b"content",
        )
        .unwrap();
        store
            .with_blocking({
                let note_id = note_id.clone();
                move |conn| {
                    conn.execute(
                        "INSERT INTO mutation_intents (
                           op_id, note_id, mutation_kind, source,
                           expected_local_generation, target_relative_path,
                           journal_relative_path, payload_size, payload_sha256,
                           state, created_at_ms
                         ) VALUES (
                           'op-delete-crash', ?1, 'delete', 'test', 0, 'note.md',
                           'note-journal/op-delete-crash.pending', 7, 'ignored',
                           'prepared', 1
                         )",
                        [&note_id],
                    )?;
                    conn.execute(
                        "INSERT INTO note_mutation_locks (note_id, op_id, acquired_at_ms)
                         VALUES (?1, 'op-delete-crash', 1)",
                        [&note_id],
                    )?;
                    Ok(())
                }
            })
            .unwrap();
        let trash = workspace.path().join(".lokus").join("trash").join(&note_id);
        fs::create_dir_all(&trash).unwrap();
        fs::rename(workspace.path().join("note.md"), trash.join("note.md")).unwrap();

        recover_pending_mutations(&store, workspace.path()).unwrap();

        let status: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT status FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();
        assert_eq!(status, "tombstoned");
        assert!(!workspace.path().join("note.md").exists());
    }
}
