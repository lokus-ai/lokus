use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use rusqlite::Connection;

use super::schema;

type Job = Box<dyn FnOnce(&mut Connection) + Send>;

#[derive(Clone)]
pub struct NoteStore {
    tx: mpsc::Sender<Job>,
}

impl NoteStore {
    pub fn open(workspace_path: PathBuf) -> Result<Self, String> {
        let metadata_dir = workspace_path.join(".lokus");
        std::fs::create_dir_all(&metadata_dir)
            .map_err(|error| format!("create {metadata_dir:?}: {error}"))?;
        let db_path = metadata_dir.join("notes.sqlite3");
        let mut conn =
            Connection::open(&db_path).map_err(|error| format!("open {db_path:?}: {error}"))?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(|error| error.to_string())?;
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|error| error.to_string())?;
        conn.pragma_update(None, "synchronous", "FULL")
            .map_err(|error| error.to_string())?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|error| error.to_string())?;
        schema::apply_migrations(&mut conn)?;

        let (tx, rx) = mpsc::channel::<Job>();
        std::thread::Builder::new()
            .name("note-engine-store".to_string())
            .spawn(move || {
                for job in rx {
                    job(&mut conn);
                }
            })
            .map_err(|error| format!("spawn note store: {error}"))?;

        Ok(Self { tx })
    }

    pub fn with_blocking<R, F>(&self, job: F) -> Result<R, String>
    where
        R: Send + 'static,
        F: FnOnce(&mut Connection) -> rusqlite::Result<R> + Send + 'static,
    {
        let (result_tx, result_rx) = mpsc::channel();
        self.tx
            .send(Box::new(move |conn| {
                let _ = result_tx.send(job(conn));
            }))
            .map_err(|_| "note store thread is gone".to_string())?;
        result_rx
            .recv()
            .map_err(|_| "note store dropped result".to_string())?
            .map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_creates_workspace_database_with_durable_pragmas() {
        let workspace = tempfile::tempdir().unwrap();
        let store = NoteStore::open(workspace.path().to_path_buf()).unwrap();
        let db_path = workspace.path().join(".lokus").join("notes.sqlite3");

        assert!(db_path.exists());
        let (journal_mode, synchronous, foreign_keys): (String, i64, i64) = store
            .with_blocking(|conn| {
                Ok((
                    conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))?,
                    conn.query_row("PRAGMA synchronous", [], |row| row.get(0))?,
                    conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?,
                ))
            })
            .unwrap();
        assert_eq!(journal_mode.to_ascii_lowercase(), "wal");
        assert_eq!(synchronous, 2);
        assert_eq!(foreign_keys, 1);
    }
}
