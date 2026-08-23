use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Transaction};
use walkdir::WalkDir;

use super::identity::{is_supported_note_path, new_note_id, normalized_path_key};
use super::store::NoteStore;

#[derive(Debug, Default, PartialEq, Eq, serde::Serialize)]
pub struct BackfillReport {
    pub created: usize,
    pub reused: usize,
    pub skipped_symlinks: usize,
    pub recovered_mutations: usize,
    pub recovery_required: usize,
}

struct ScannedNote {
    relative_path: String,
    normalized_path_key: String,
    note_kind: &'static str,
    file_device: Option<u64>,
    file_inode: Option<u64>,
    file_size: u64,
    file_mtime_ns: i64,
    hash: String,
}

pub fn backfill_workspace(
    store: &NoteStore,
    workspace_path: &Path,
) -> Result<BackfillReport, String> {
    let mut scanned = Vec::new();
    let mut skipped_symlinks = 0;

    for entry in WalkDir::new(workspace_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| should_visit(entry.path(), workspace_path))
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if entry.file_type().is_symlink() {
            if is_supported_note_path(path) {
                skipped_symlinks += 1;
            }
            continue;
        }
        if !entry.file_type().is_file() || !is_supported_note_path(path) {
            continue;
        }

        scanned.push(scan_note(workspace_path, path)?);
    }

    let now_ms = unix_ms();
    let scanned_keys: HashSet<String> = scanned
        .iter()
        .map(|note| note.normalized_path_key.clone())
        .collect();
    store.with_blocking(move |conn| {
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT OR IGNORE INTO sync_scopes (
               scope_kind, scope_id, status, created_at_ms, updated_at_ms
             ) VALUES ('local_only', 'workspace', 'active', ?1, ?1)",
            [now_ms],
        )?;

        let mut report = BackfillReport {
            skipped_symlinks,
            ..BackfillReport::default()
        };

        for note in scanned {
            let existing: Option<String> = tx
                .query_row(
                    "SELECT note_id FROM local_notes WHERE normalized_path_key=?1",
                    [&note.normalized_path_key],
                    |row| row.get(0),
                )
                .optional()?;
            if existing.is_some() {
                tx.execute(
                    "UPDATE local_notes
                        SET relative_path=?2, note_kind=?3, status='active',
                            file_device=?4, file_inode=?5, file_size=?6,
                            file_mtime_ns=?7, updated_at_ms=?8,
                            missing_since_ms=NULL
                      WHERE normalized_path_key=?1",
                    params![
                        note.normalized_path_key,
                        note.relative_path,
                        note.note_kind,
                        note.file_device,
                        note.file_inode,
                        note.file_size,
                        note.file_mtime_ns,
                        now_ms,
                    ],
                )?;
                report.reused += 1;
                continue;
            }

            if let Some(note_id) = find_relink_candidate(&tx, &note, &scanned_keys)? {
                tx.execute(
                    "UPDATE local_notes
                        SET relative_path=?2, normalized_path_key=?3,
                            note_kind=?4, status='active', file_device=?5,
                            file_inode=?6, file_size=?7, file_mtime_ns=?8,
                            updated_at_ms=?9, missing_since_ms=NULL
                      WHERE note_id=?1",
                    params![
                        note_id,
                        note.relative_path,
                        note.normalized_path_key,
                        note.note_kind,
                        note.file_device,
                        note.file_inode,
                        note.file_size,
                        note.file_mtime_ns,
                        now_ms,
                    ],
                )?;
                tx.execute(
                    "INSERT INTO note_path_history (
                       note_id, relative_path, normalized_path_key, reason,
                       first_seen_at_ms, last_seen_at_ms
                     ) VALUES (?1, ?2, ?3, 'external_relink', ?4, ?4)",
                    params![
                        note_id,
                        note.relative_path,
                        note.normalized_path_key,
                        now_ms
                    ],
                )?;
                report.reused += 1;
                continue;
            }

            let note_id = new_note_id();
            tx.execute(
                "INSERT INTO local_notes (
                   note_id, relative_path, normalized_path_key, note_kind, status,
                   scope_kind, scope_id, file_device, file_inode, file_size,
                   file_mtime_ns, created_at_ms, updated_at_ms
                 ) VALUES (
                   ?1, ?2, ?3, ?4, 'active', 'local_only', 'workspace',
                   ?5, ?6, ?7, ?8, ?9, ?9
                 )",
                params![
                    note_id,
                    note.relative_path,
                    note.normalized_path_key,
                    note.note_kind,
                    note.file_device,
                    note.file_inode,
                    note.file_size,
                    note.file_mtime_ns,
                    now_ms,
                ],
            )?;
            tx.execute(
                "INSERT INTO note_heads (
                   note_id, local_generation, local_hash, updated_at_ms
                 ) VALUES (?1, 0, ?2, ?3)",
                params![note_id, note.hash, now_ms],
            )?;
            tx.execute(
                "INSERT INTO note_path_history (
                   note_id, relative_path, normalized_path_key, reason,
                   first_seen_at_ms, last_seen_at_ms
                 ) VALUES (?1, ?2, ?3, 'backfill', ?4, ?4)",
                params![
                    note_id,
                    note.relative_path,
                    note.normalized_path_key,
                    now_ms
                ],
            )?;
            report.created += 1;
        }

        {
            let mut statement = tx.prepare(
                "SELECT note_id, normalized_path_key
                   FROM local_notes
                  WHERE status='active'",
            )?;
            let rows: Vec<(String, String)> = statement
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                .collect::<rusqlite::Result<_>>()?;
            drop(statement);
            for (note_id, path_key) in rows {
                if !scanned_keys.contains(&path_key) {
                    tx.execute(
                        "UPDATE local_notes
                            SET status='missing',
                                missing_since_ms=COALESCE(missing_since_ms, ?2),
                                updated_at_ms=?2
                          WHERE note_id=?1",
                        params![note_id, now_ms],
                    )?;
                }
            }
        }

        let generation: i64 = tx.query_row(
            "SELECT COALESCE(max(scan_generation), 0) + 1 FROM migration_runs",
            [],
            |row| row.get(0),
        )?;
        tx.execute(
            "INSERT INTO migration_runs (
               migration_id, scan_generation, state, started_at_ms, committed_at_ms
             ) VALUES (?1, ?2, 'committed', ?3, ?3)",
            params![
                format!("note-identity-backfill-{generation}"),
                generation,
                now_ms
            ],
        )?;
        tx.commit()?;
        Ok(report)
    })
}

fn find_relink_candidate(
    tx: &Transaction<'_>,
    note: &ScannedNote,
    scanned_keys: &HashSet<String>,
) -> rusqlite::Result<Option<String>> {
    if let (Some(device), Some(inode)) = (note.file_device, note.file_inode) {
        let mut statement = tx.prepare(
            "SELECT note_id, normalized_path_key
               FROM local_notes
              WHERE file_device=?1 AND file_inode=?2",
        )?;
        let candidates: Vec<String> = statement
            .query_map(params![device, inode], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|row| match row {
                Ok((id, path_key)) if !scanned_keys.contains(&path_key) => Some(Ok(id)),
                Ok(_) => None,
                Err(error) => Some(Err(error)),
            })
            .collect::<rusqlite::Result<_>>()?;
        if candidates.len() == 1 {
            return Ok(candidates.into_iter().next());
        }
        if candidates.len() > 1 {
            return Ok(None);
        }
    }

    let mut statement = tx.prepare(
        "SELECT note.note_id, note.normalized_path_key
           FROM local_notes note
           JOIN note_heads head ON head.note_id=note.note_id
          WHERE head.local_hash=?1 AND note.file_size=?2",
    )?;
    let candidates: Vec<String> = statement
        .query_map(params![note.hash, note.file_size], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .filter_map(|row| match row {
            Ok((id, path_key)) if !scanned_keys.contains(&path_key) => Some(Ok(id)),
            Ok(_) => None,
            Err(error) => Some(Err(error)),
        })
        .collect::<rusqlite::Result<_>>()?;
    Ok((candidates.len() == 1)
        .then(|| candidates.into_iter().next())
        .flatten())
}

fn should_visit(path: &Path, workspace_path: &Path) -> bool {
    if path == workspace_path || !path.is_dir() {
        return true;
    }
    !matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some(".lokus" | ".git" | "node_modules" | "target")
    )
}

fn scan_note(workspace_path: &Path, path: &Path) -> Result<ScannedNote, String> {
    let relative = path
        .strip_prefix(workspace_path)
        .map_err(|error| error.to_string())?;
    let relative_path = slash_path(relative);
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified = metadata
        .modified()
        .unwrap_or(UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .min(i64::MAX as u128) as i64;
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let (file_device, file_inode) = file_identity(&metadata);
    let note_kind = if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
    {
        "plain_text"
    } else {
        "markdown"
    };

    Ok(ScannedNote {
        normalized_path_key: normalized_path_key(Path::new(&relative_path)),
        relative_path,
        note_kind,
        file_device,
        file_inode,
        file_size: metadata.len(),
        file_mtime_ns: modified,
        hash: blake3::hash(&bytes).to_hex().to_string(),
    })
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

    use uuid::Uuid;

    use super::*;

    #[test]
    fn backfill_is_idempotent_and_only_indexes_supported_regular_notes() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("alpha.md"), "# Alpha").unwrap();
        fs::write(workspace.path().join("beta.txt"), "Beta").unwrap();
        fs::write(workspace.path().join("board.kanban"), "{}").unwrap();
        fs::create_dir_all(workspace.path().join(".lokus")).unwrap();
        fs::write(workspace.path().join(".lokus").join("hidden.md"), "hidden").unwrap();

        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let first = backfill_workspace(&store, workspace.path()).unwrap();
        assert_eq!(first.created, 2);
        assert_eq!(first.reused, 0);

        let rows: Vec<(String, String)> = store
            .with_blocking(|conn| {
                let mut statement = conn.prepare(
                    "SELECT note_id, relative_path FROM local_notes ORDER BY relative_path",
                )?;
                let rows = statement
                    .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                    .collect();
                rows
            })
            .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].1, "alpha.md");
        assert_eq!(rows[1].1, "beta.txt");
        assert!(rows
            .iter()
            .all(|(id, _)| { Uuid::parse_str(id).unwrap().get_version_num() == 7 }));

        let second = backfill_workspace(&store, workspace.path()).unwrap();
        assert_eq!(second.created, 0);
        assert_eq!(second.reused, 2);
    }

    #[test]
    fn copying_a_note_allocates_a_new_identity() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("original.md"), "same bytes").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        fs::copy(
            workspace.path().join("original.md"),
            workspace.path().join("copy.md"),
        )
        .unwrap();

        let report = backfill_workspace(&store, workspace.path()).unwrap();
        assert_eq!(report.created, 1);
        assert_eq!(report.reused, 1);

        let ids: Vec<String> = store
            .with_blocking(|conn| {
                let mut statement =
                    conn.prepare("SELECT note_id FROM local_notes ORDER BY relative_path")?;
                let ids = statement.query_map([], |row| row.get(0))?.collect();
                ids
            })
            .unwrap();
        assert_eq!(ids.len(), 2);
        assert_ne!(ids[0], ids[1]);
    }

    #[test]
    fn external_rename_preserves_identity_by_file_identity() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("before.md"), "content").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let before_id: String = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT note_id FROM local_notes WHERE relative_path='before.md'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();

        fs::rename(
            workspace.path().join("before.md"),
            workspace.path().join("after.md"),
        )
        .unwrap();
        let report = backfill_workspace(&store, workspace.path()).unwrap();

        assert_eq!(report.created, 0);
        assert_eq!(report.reused, 1);
        let (after_id, old_count): (String, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row(
                        "SELECT note_id FROM local_notes WHERE relative_path='after.md'",
                        [],
                        |row| row.get(0),
                    )?,
                    conn.query_row(
                        "SELECT count(*) FROM local_notes WHERE relative_path='before.md'",
                        [],
                        |row| row.get(0),
                    )?,
                ))
            })
            .unwrap();
        assert_eq!(after_id, before_id);
        assert_eq!(old_count, 0);
    }

    #[test]
    fn unique_hash_relinks_a_move_when_file_identity_changes() {
        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("before.md"), "same content").unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        backfill_workspace(&store, workspace.path()).unwrap();
        let before_id: String = store
            .with_blocking(|conn| {
                conn.query_row("SELECT note_id FROM local_notes", [], |row| row.get(0))
            })
            .unwrap();

        fs::remove_file(workspace.path().join("before.md")).unwrap();
        fs::write(workspace.path().join("after.md"), "same content").unwrap();
        let report = backfill_workspace(&store, workspace.path()).unwrap();

        assert_eq!(report.created, 0);
        let after_id: String = store
            .with_blocking(|conn| {
                conn.query_row(
                    "SELECT note_id FROM local_notes WHERE relative_path='after.md'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(after_id, before_id);
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_notes_are_skipped() {
        use std::os::unix::fs::symlink;

        let workspace = tempfile::tempdir().unwrap();
        fs::write(workspace.path().join("real.md"), "real").unwrap();
        symlink(
            workspace.path().join("real.md"),
            workspace.path().join("linked.md"),
        )
        .unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();

        let report = backfill_workspace(&store, workspace.path()).unwrap();
        assert_eq!(report.created, 1);
        assert_eq!(report.skipped_symlinks, 1);
    }
}
