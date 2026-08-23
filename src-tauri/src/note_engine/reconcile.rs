use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, TransactionBehavior};
use sha2::{Digest, Sha256};

use super::backfill::backfill_workspace;
use super::identity::{is_supported_note_path, new_note_id, normalized_path_key};
use super::journal::{write_journal_record, JournalHeader};
use super::sequence::allocate_client_sequence;
use super::store::NoteStore;
use super::writer::atomic_replace;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ExternalChange {
    pub kind: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct NormalizedChange {
    pub note_id: String,
    pub kind: String,
    pub path: String,
    pub local_generation: i64,
}

pub fn reconcile_startup_changes(
    store: &NoteStore,
    workspace_path: &Path,
) -> Result<Vec<NormalizedChange>, String> {
    let notes: Vec<(String, String)> = store.with_blocking(|conn| {
        let mut statement = conn.prepare(
            "SELECT note.relative_path, COALESCE(head.local_hash, '')
               FROM local_notes note
               JOIN note_heads head ON head.note_id=note.note_id
              WHERE note.status IN ('active', 'missing')",
        )?;
        let values = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(values)
    })?;
    let mut changes = Vec::new();
    for (relative_path, expected_hash) in notes {
        let absolute_path = workspace_path.join(&relative_path);
        if !absolute_path.exists() {
            changes.push(ExternalChange {
                kind: "remove".to_string(),
                paths: vec![absolute_path.to_string_lossy().to_string()],
            });
            continue;
        }
        let payload = fs::read(&absolute_path).map_err(|error| error.to_string())?;
        if blake3::hash(&payload).to_hex().as_str() != expected_hash {
            changes.push(ExternalChange {
                kind: "modify".to_string(),
                paths: vec![absolute_path.to_string_lossy().to_string()],
            });
        }
    }
    reconcile_external_changes(store, workspace_path, &changes, &HashSet::new())
}

pub fn reconcile_external_changes(
    store: &NoteStore,
    workspace_path: &Path,
    changes: &[ExternalChange],
    dirty_path_keys: &HashSet<String>,
) -> Result<Vec<NormalizedChange>, String> {
    let workspace_path = fs::canonicalize(workspace_path).map_err(|error| error.to_string())?;
    let mut normalized = Vec::new();
    let mut needs_backfill = false;

    for change in changes {
        if matches!(change.kind.as_str(), "create" | "rename") {
            needs_backfill = true;
        }
        for raw_path in &change.paths {
            let Some((absolute_path, relative_path)) =
                event_paths(&workspace_path, Path::new(raw_path))?
            else {
                continue;
            };
            if !is_supported_note_path(&relative_path) {
                continue;
            }
            let path_key = normalized_path_key(&relative_path);
            let existing: Option<(String, i64, String, String, String)> = store.with_blocking({
                let path_key = path_key.clone();
                move |conn| {
                    conn.query_row(
                        "SELECT note.note_id, head.local_generation,
                                    head.local_hash, note.scope_kind, note.scope_id
                               FROM local_notes note
                               JOIN note_heads head ON head.note_id=note.note_id
                              WHERE note.normalized_path_key=?1",
                        [path_key],
                        |row| {
                            Ok((
                                row.get(0)?,
                                row.get(1)?,
                                row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                                row.get(3)?,
                                row.get(4)?,
                            ))
                        },
                    )
                    .optional()
                }
            })?;

            if change.kind == "remove" || !absolute_path.exists() {
                if let Some((note_id, generation, _, _, _)) = existing {
                    let now_ms = unix_ms();
                    store.with_blocking({
                        let note_id = note_id.clone();
                        move |conn| {
                            conn.execute(
                                "UPDATE local_notes
                                    SET status='missing',
                                        missing_since_ms=COALESCE(missing_since_ms, ?2),
                                        updated_at_ms=?2
                                  WHERE note_id=?1",
                                params![note_id, now_ms],
                            )?;
                            Ok(())
                        }
                    })?;
                    normalized.push(NormalizedChange {
                        note_id,
                        kind: "missing".to_string(),
                        path: slash_path(&relative_path),
                        local_generation: generation,
                    });
                }
                continue;
            }

            let Some((note_id, generation, previous_hash, scope_kind, scope_id)) = existing else {
                needs_backfill = true;
                continue;
            };
            if !matches!(change.kind.as_str(), "modify" | "other") {
                continue;
            }
            let payload = fs::read(&absolute_path).map_err(|error| error.to_string())?;
            let local_hash = blake3::hash(&payload).to_hex().to_string();
            if local_hash == previous_hash {
                continue;
            }

            if dirty_path_keys.contains(&path_key) {
                let recovery_id = new_note_id();
                let recovery_relative_path = format!("recovery/{recovery_id}.external");
                let recovery_path = workspace_path.join(".lokus").join(&recovery_relative_path);
                fs::create_dir_all(
                    recovery_path
                        .parent()
                        .ok_or_else(|| "recovery path has no parent".to_string())?,
                )
                .map_err(|error| error.to_string())?;
                atomic_replace(&recovery_path, &payload, &recovery_id)?;
                let payload_sha256 = hex::encode(Sha256::digest(&payload));
                store.with_blocking({
                    let note_id = note_id.clone();
                    move |conn| {
                        conn.execute(
                            "INSERT INTO recovery_branches (
                               id, note_id, kind, payload_relative_path,
                               payload_sha256, created_at_ms
                             ) VALUES (?1, ?2, 'external', ?3, ?4, ?5)",
                            params![
                                recovery_id,
                                note_id,
                                recovery_relative_path,
                                payload_sha256,
                                unix_ms()
                            ],
                        )?;
                        Ok(())
                    }
                })?;
                normalized.push(NormalizedChange {
                    note_id,
                    kind: "recovery_required".to_string(),
                    path: slash_path(&relative_path),
                    local_generation: generation,
                });
                continue;
            }

            let op_id = new_note_id();
            let target_relative_path = slash_path(&relative_path);
            let journal_relative_path = format!("note-journal/{op_id}.pending");
            let journal_path = write_journal_record(
                &workspace_path.join(".lokus"),
                JournalHeader {
                    version: 1,
                    op_id: op_id.clone(),
                    note_id: note_id.clone(),
                    mutation_kind: "reconcile_external".to_string(),
                    target_relative_path: target_relative_path.clone(),
                    expected_local_generation: Some(generation),
                    payload_len: 0,
                    payload_sha256: String::new(),
                },
                &payload,
            )?;
            let metadata = fs::metadata(&absolute_path).map_err(|error| error.to_string())?;
            let now_ms = unix_ms();
            let queued = scope_kind != "local_only";
            let outbox_relative_path = format!("outbox/{op_id}.payload");
            if queued {
                let outbox_path = workspace_path.join(".lokus").join(&outbox_relative_path);
                fs::create_dir_all(
                    outbox_path
                        .parent()
                        .ok_or_else(|| "outbox path has no parent".to_string())?,
                )
                .map_err(|error| error.to_string())?;
                atomic_replace(&outbox_path, &payload, &op_id)?;
            }
            store.with_blocking({
                let note_id = note_id.clone();
                let op_id = op_id.clone();
                let payload_sha256 = hex::encode(Sha256::digest(&payload));
                move |conn| {
                    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
                    let current_generation: i64 = tx.query_row(
                        "SELECT local_generation FROM note_heads WHERE note_id=?1",
                        [&note_id],
                        |row| row.get(0),
                    )?;
                    if current_generation != generation {
                        return Err(rusqlite::Error::InvalidParameterName(
                            "external generation changed".to_string(),
                        ));
                    }
                    tx.execute(
                        "INSERT INTO mutation_intents (
                           op_id, note_id, mutation_kind, source,
                           expected_local_generation, target_relative_path,
                           journal_relative_path, payload_size, payload_sha256,
                           state, created_at_ms, file_applied_at_ms, committed_at_ms
                         ) VALUES (
                           ?1, ?2, 'reconcile_external', 'external_watcher',
                           ?3, ?4, ?5, ?6, ?7, 'committed', ?8, ?8, ?8
                         )",
                        params![
                            op_id,
                            note_id,
                            generation,
                            target_relative_path,
                            journal_relative_path,
                            payload.len() as i64,
                            payload_sha256,
                            now_ms
                        ],
                    )?;
                    tx.execute(
                        "UPDATE note_heads
                            SET local_generation=?2, local_hash=?3, updated_at_ms=?4
                          WHERE note_id=?1",
                        params![note_id, generation + 1, local_hash, now_ms],
                    )?;
                    tx.execute(
                        "UPDATE local_notes
                            SET file_size=?2, file_mtime_ns=?3, status='active',
                                missing_since_ms=NULL, updated_at_ms=?4
                          WHERE note_id=?1",
                        params![
                            note_id,
                            metadata.len() as i64,
                            modified_ns(&metadata),
                            now_ms
                        ],
                    )?;
                    if queued {
                        let sequence =
                            allocate_client_sequence(&tx, &scope_kind, &scope_id, now_ms)?;
                        let base_revision_id: Option<String> = tx.query_row(
                            "SELECT base_revision_id FROM note_heads WHERE note_id=?1",
                            [&note_id],
                            |row| row.get(0),
                        )?;
                        tx.execute(
                            "INSERT INTO outbox_operations (
                               op_id, note_id, scope_kind, scope_id,
                               client_sequence, base_revision_id,
                               payload_relative_path, state,
                               created_at_ms, updated_at_ms
                             ) VALUES (
                               ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8
                             )",
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
                    tx.commit()
                }
            })?;
            fs::remove_file(&journal_path).map_err(|error| error.to_string())?;
            normalized.push(NormalizedChange {
                note_id,
                kind: "external_modify".to_string(),
                path: slash_path(&relative_path),
                local_generation: generation + 1,
            });
        }
    }

    if needs_backfill {
        backfill_workspace(store, &workspace_path)?;
        for change in changes {
            if !matches!(change.kind.as_str(), "create" | "rename") {
                continue;
            }
            for raw_path in &change.paths {
                let Some((_, relative_path)) = event_paths(&workspace_path, Path::new(raw_path))?
                else {
                    continue;
                };
                if !is_supported_note_path(&relative_path)
                    || !workspace_path.join(&relative_path).exists()
                {
                    continue;
                }
                let path_key = normalized_path_key(&relative_path);
                let existing: Option<(String, i64)> = store.with_blocking(move |conn| {
                    conn.query_row(
                        "SELECT note.note_id, head.local_generation
                           FROM local_notes note
                           JOIN note_heads head ON head.note_id=note.note_id
                          WHERE note.normalized_path_key=?1",
                        [path_key],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .optional()
                })?;
                if let Some((note_id, generation)) = existing {
                    let local_generation = record_external_relink(
                        store,
                        &workspace_path,
                        &relative_path,
                        &note_id,
                        generation,
                    )?;
                    normalized.push(NormalizedChange {
                        note_id,
                        kind: if change.kind == "rename" {
                            "external_rename".to_string()
                        } else {
                            "external_create".to_string()
                        },
                        path: slash_path(&relative_path),
                        local_generation,
                    });
                }
            }
        }
    }
    Ok(normalized)
}

fn record_external_relink(
    store: &NoteStore,
    workspace_path: &Path,
    relative_path: &Path,
    note_id: &str,
    generation: i64,
) -> Result<i64, String> {
    let target_relative_path = slash_path(relative_path);
    let recent_engine_relocation: bool = store.with_blocking({
        let note_id = note_id.to_string();
        let target = target_relative_path.clone();
        move |conn| {
            conn.query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM mutation_intents
                    WHERE note_id=?1
                      AND mutation_kind IN ('rename', 'move')
                      AND target_relative_path=?2
                      AND state='committed'
                      AND created_at_ms>=?3
                 )",
                params![note_id, target, unix_ms() - 10_000],
                |row| row.get(0),
            )
        }
    })?;
    if recent_engine_relocation {
        return Ok(generation);
    }

    let absolute_path = workspace_path.join(relative_path);
    let payload = fs::read(&absolute_path).map_err(|error| error.to_string())?;
    let (scope_kind, scope_id, base_revision_id): (String, String, Option<String>) = store
        .with_blocking({
            let note_id = note_id.to_string();
            move |conn| {
                conn.query_row(
                    "SELECT note.scope_kind, note.scope_id, head.base_revision_id
                       FROM local_notes note
                       JOIN note_heads head ON head.note_id=note.note_id
                      WHERE note.note_id=?1",
                    [note_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
            }
        })?;
    let op_id = new_note_id();
    let journal_relative_path = format!("note-journal/{op_id}.pending");
    let journal_path = write_journal_record(
        &workspace_path.join(".lokus"),
        JournalHeader {
            version: 1,
            op_id: op_id.clone(),
            note_id: note_id.to_string(),
            mutation_kind: "rename".to_string(),
            target_relative_path: target_relative_path.clone(),
            expected_local_generation: Some(generation),
            payload_len: 0,
            payload_sha256: String::new(),
        },
        &payload,
    )?;
    let queued = scope_kind != "local_only";
    let outbox_relative_path = format!("outbox/{op_id}.payload");
    if queued {
        fs::create_dir_all(workspace_path.join(".lokus").join("outbox"))
            .map_err(|error| error.to_string())?;
        atomic_replace(
            &workspace_path.join(".lokus").join(&outbox_relative_path),
            &payload,
            &op_id,
        )?;
    }
    let payload_sha256 = hex::encode(Sha256::digest(&payload));
    let payload_size = payload.len() as i64;
    let local_hash = blake3::hash(&payload).to_hex().to_string();
    let now = unix_ms();
    let result = store.with_blocking({
        let note_id = note_id.to_string();
        let op_id = op_id.clone();
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
                    "external relink generation changed".to_string(),
                ));
            }
            tx.execute(
                "INSERT INTO mutation_intents (
                   op_id, note_id, mutation_kind, source,
                   expected_local_generation, target_relative_path,
                   journal_relative_path, payload_size, payload_sha256,
                   state, created_at_ms, file_applied_at_ms, committed_at_ms
                 ) VALUES (
                   ?1, ?2, 'rename', 'external_watcher', ?3, ?4, ?5,
                   ?6, ?7, 'committed', ?8, ?8, ?8
                 )",
                params![
                    op_id,
                    note_id,
                    generation,
                    target_relative_path,
                    journal_relative_path,
                    payload_size,
                    payload_sha256,
                    now
                ],
            )?;
            tx.execute(
                "UPDATE note_heads
                    SET local_generation=?2, local_hash=?3, updated_at_ms=?4
                  WHERE note_id=?1",
                params![note_id, generation + 1, local_hash, now],
            )?;
            if queued {
                let sequence = allocate_client_sequence(&tx, &scope_kind, &scope_id, now)?;
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
                        now
                    ],
                )?;
            }
            tx.commit()
        }
    });
    if let Err(error) = result {
        let _ = fs::remove_file(journal_path);
        if queued {
            let _ = fs::remove_file(workspace_path.join(".lokus").join(outbox_relative_path));
        }
        return Err(error);
    }
    fs::remove_file(journal_path).map_err(|error| error.to_string())?;
    Ok(generation + 1)
}

fn event_paths(
    workspace_path: &Path,
    event_path: &Path,
) -> Result<Option<(PathBuf, PathBuf)>, String> {
    let candidate = if event_path.is_absolute() {
        event_path.to_path_buf()
    } else {
        workspace_path.join(event_path)
    };
    let absolute = if candidate.exists() {
        fs::canonicalize(&candidate).map_err(|error| error.to_string())?
    } else if let (Some(parent), Some(file_name)) = (candidate.parent(), candidate.file_name()) {
        match fs::canonicalize(parent) {
            Ok(parent) => parent.join(file_name),
            Err(_) => candidate,
        }
    } else {
        candidate
    };
    let relative = match absolute.strip_prefix(workspace_path) {
        Ok(relative) => relative.to_path_buf(),
        Err(_) => return Ok(None),
    };
    if relative.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Ok(None);
    }
    Ok(Some((absolute, relative)))
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

#[cfg(test)]
mod tests {
    use std::fs;

    use super::super::backfill::backfill_workspace;
    use super::super::identity::normalized_path_key;
    use super::*;

    #[test]
    fn clean_external_modify_advances_local_generation() {
        let workspace = tempfile::tempdir().unwrap();
        let path = workspace.path().join("note.md");
        fs::write(&path, "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        fs::write(&path, "after").unwrap();

        let result = reconcile_external_changes(
            &store,
            workspace.path(),
            &[ExternalChange {
                kind: "modify".to_string(),
                paths: vec![path.to_string_lossy().to_string()],
            }],
            &HashSet::new(),
        )
        .unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].kind, "external_modify");
        assert_eq!(result[0].local_generation, 1);
    }

    #[test]
    fn dirty_external_modify_creates_recovery_without_advancing_head() {
        let workspace = tempfile::tempdir().unwrap();
        let path = workspace.path().join("note.md");
        fs::write(&path, "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        fs::write(&path, "external").unwrap();
        let dirty = HashSet::from([normalized_path_key(Path::new("note.md"))]);

        let result = reconcile_external_changes(
            &store,
            workspace.path(),
            &[ExternalChange {
                kind: "modify".to_string(),
                paths: vec![path.to_string_lossy().to_string()],
            }],
            &dirty,
        )
        .unwrap();

        assert_eq!(result[0].kind, "recovery_required");
        let (generation, branches): (i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("SELECT local_generation FROM note_heads", [], |row| {
                        row.get(0)
                    })?,
                    conn.query_row("SELECT count(*) FROM recovery_branches", [], |row| {
                        row.get(0)
                    })?,
                ))
            })
            .unwrap();
        assert_eq!(generation, 0);
        assert_eq!(branches, 1);
    }

    #[test]
    fn remove_marks_missing_but_never_creates_a_tombstone() {
        let workspace = tempfile::tempdir().unwrap();
        let path = workspace.path().join("note.md");
        fs::write(&path, "before").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        fs::remove_file(&path).unwrap();

        reconcile_external_changes(
            &store,
            workspace.path(),
            &[ExternalChange {
                kind: "remove".to_string(),
                paths: vec![path.to_string_lossy().to_string()],
            }],
            &HashSet::new(),
        )
        .unwrap();

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
        assert_eq!(status, "missing");
        assert_eq!(tombstones, 0);
    }

    #[test]
    fn external_team_rename_queues_the_new_encrypted_path_snapshot() {
        let workspace = tempfile::tempdir().unwrap();
        let old_path = workspace.path().join("note.md");
        let new_path = workspace.path().join("renamed.md");
        fs::write(&old_path, "content").unwrap();
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
        fs::rename(&old_path, &new_path).unwrap();

        let changes = reconcile_external_changes(
            &store,
            workspace.path(),
            &[ExternalChange {
                kind: "rename".to_string(),
                paths: vec![new_path.to_string_lossy().to_string()],
            }],
            &HashSet::new(),
        )
        .unwrap();

        assert_eq!(changes[0].local_generation, 1);
        let pending: i64 = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT count(*) FROM outbox_operations WHERE state='pending'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(pending, 1);
    }
}
