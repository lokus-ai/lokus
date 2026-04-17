//! Block index — SQLite-backed durable block identity, references, and FTS.
//!
//! See `docs/plans/2026-04-16-block-identity-foundation-design.md` for the design.
//! Phase 1: commands only, no UI. Invoked by `BlockIndexClient.js` on save.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

const SCHEMA_VERSION: i32 = 1;

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS blocks (
    id           TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    node_type    TEXT NOT NULL,
    level        INTEGER,
    text_preview TEXT NOT NULL,
    position     INTEGER NOT NULL,
    checksum     TEXT NOT NULL,
    parent_id    TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_file_path ON blocks(file_path);
CREATE INDEX IF NOT EXISTS idx_blocks_parent    ON blocks(parent_id);

CREATE TABLE IF NOT EXISTS block_refs (
    source_block_id TEXT NOT NULL,
    target_block_id TEXT NOT NULL,
    source_file     TEXT NOT NULL,
    kind            TEXT NOT NULL,
    PRIMARY KEY (source_block_id, target_block_id)
);

CREATE INDEX IF NOT EXISTS idx_block_refs_target ON block_refs(target_block_id);
CREATE INDEX IF NOT EXISTS idx_block_refs_file   ON block_refs(source_file);

CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
    id UNINDEXED,
    text_preview,
    tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
    INSERT INTO blocks_fts(id, text_preview) VALUES (new.id, new.text_preview);
END;

CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
    DELETE FROM blocks_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
    DELETE FROM blocks_fts WHERE id = old.id;
    INSERT INTO blocks_fts(id, text_preview) VALUES (new.id, new.text_preview);
END;
"#;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockInput {
    pub id: String,
    pub node_type: String,
    pub level: Option<i32>,
    pub text_preview: String,
    pub position: i32,
    pub checksum: String,
    pub parent_id: Option<String>,
    #[serde(default)]
    pub outgoing_refs: Vec<OutgoingRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingRef {
    pub target_block_id: String,
    pub kind: String, // "link" | "embed"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockRecord {
    pub id: String,
    pub file_path: String,
    pub node_type: String,
    pub level: Option<i32>,
    pub text_preview: String,
    pub position: i32,
    pub checksum: String,
    pub parent_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRecord {
    pub source_block_id: String,
    pub target_block_id: String,
    pub source_file: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertResult {
    pub affected_block_ids: Vec<String>,
    pub added_refs: Vec<String>,
    pub removed_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    pub blocks: i64,
    pub files: i64,
    pub size_bytes: i64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(thiserror::Error, Debug)]
pub enum BlockIndexError {
    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Other(String),
}

impl From<BlockIndexError> for String {
    fn from(e: BlockIndexError) -> String {
        e.to_string()
    }
}

// ---------------------------------------------------------------------------
// Connection management — one cached Connection per workspace path
// ---------------------------------------------------------------------------

struct DbState {
    workspace_path: PathBuf,
    conn: Connection,
}

static DB: Lazy<Mutex<Option<DbState>>> = Lazy::new(|| Mutex::new(None));

fn db_path_for(workspace: &Path) -> PathBuf {
    workspace.join(".lokus").join("index.db")
}

fn configure_conn(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "cache_size", -8000)?; // 8 MB
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<(), BlockIndexError> {
    conn.execute_batch(SCHEMA_SQL)?;
    let current: Option<i32> = conn
        .query_row(
            "SELECT MAX(version) FROM schema_version",
            [],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    let current = current.unwrap_or(0);
    if current < SCHEMA_VERSION {
        conn.execute(
            "INSERT OR REPLACE INTO schema_version (version) VALUES (?1)",
            params![SCHEMA_VERSION],
        )?;
    }
    Ok(())
}

fn open_db(workspace: &Path) -> Result<DbState, BlockIndexError> {
    let path = db_path_for(workspace);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    configure_conn(&conn)?;
    run_migrations(&conn)?;
    Ok(DbState {
        workspace_path: workspace.to_path_buf(),
        conn,
    })
}

fn with_conn<F, T>(workspace_path: &str, f: F) -> Result<T, BlockIndexError>
where
    F: FnOnce(&Connection) -> Result<T, BlockIndexError>,
{
    let workspace = PathBuf::from(workspace_path);
    let mut guard = DB.lock();
    let need_open = match &*guard {
        Some(state) => state.workspace_path != workspace,
        None => true,
    };
    if need_open {
        *guard = Some(open_db(&workspace)?);
    }
    let state = guard.as_ref().expect("db just initialised");
    f(&state.conn)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Core operations (pure — take &Connection, testable without AppHandle)
// ---------------------------------------------------------------------------

pub(crate) fn upsert_file_impl(
    conn: &Connection,
    file_path: &str,
    blocks: &[BlockInput],
) -> Result<UpsertResult, BlockIndexError> {
    let tx = conn.unchecked_transaction()?;
    let now = now_ms();

    // Existing block IDs for this file
    let existing_ids: HashSet<String> = {
        let mut stmt = tx.prepare("SELECT id FROM blocks WHERE file_path = ?1")?;
        let rows = stmt.query_map([file_path], |r| r.get::<_, String>(0))?;
        let mut set = HashSet::new();
        for r in rows {
            set.insert(r?);
        }
        set
    };

    // Existing outgoing refs for this file
    let existing_refs: HashSet<(String, String)> = {
        let mut stmt = tx.prepare(
            "SELECT source_block_id, target_block_id FROM block_refs WHERE source_file = ?1",
        )?;
        let rows = stmt.query_map([file_path], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?;
        let mut set = HashSet::new();
        for r in rows {
            set.insert(r?);
        }
        set
    };

    // Upsert incoming blocks
    let new_ids: HashSet<String> = blocks.iter().map(|b| b.id.clone()).collect();
    let mut affected: Vec<String> = Vec::with_capacity(blocks.len());

    for b in blocks {
        tx.execute(
            "INSERT INTO blocks (id, file_path, node_type, level, text_preview, position, checksum, parent_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
             ON CONFLICT(id) DO UPDATE SET
                 file_path=excluded.file_path,
                 node_type=excluded.node_type,
                 level=excluded.level,
                 text_preview=excluded.text_preview,
                 position=excluded.position,
                 checksum=excluded.checksum,
                 parent_id=excluded.parent_id,
                 updated_at=excluded.updated_at",
            params![
                b.id,
                file_path,
                b.node_type,
                b.level,
                b.text_preview,
                b.position,
                b.checksum,
                b.parent_id,
                now
            ],
        )?;
        affected.push(b.id.clone());
    }

    // Remove blocks that used to exist in this file but no longer do
    for id in existing_ids.difference(&new_ids) {
        tx.execute("DELETE FROM blocks WHERE id = ?1", params![id])?;
        tx.execute("DELETE FROM block_refs WHERE source_block_id = ?1", params![id])?;
    }

    // Rebuild refs for this file
    tx.execute(
        "DELETE FROM block_refs WHERE source_file = ?1",
        params![file_path],
    )?;
    let mut new_refs: HashSet<(String, String)> = HashSet::new();
    for b in blocks {
        for r in &b.outgoing_refs {
            tx.execute(
                "INSERT OR IGNORE INTO block_refs (source_block_id, target_block_id, source_file, kind)
                 VALUES (?1, ?2, ?3, ?4)",
                params![b.id, r.target_block_id, file_path, r.kind],
            )?;
            new_refs.insert((b.id.clone(), r.target_block_id.clone()));
        }
    }

    let added_refs: Vec<String> = new_refs
        .difference(&existing_refs)
        .map(|(_, t)| t.clone())
        .collect();
    let removed_refs: Vec<String> = existing_refs
        .difference(&new_refs)
        .map(|(_, t)| t.clone())
        .collect();

    tx.commit()?;

    Ok(UpsertResult {
        affected_block_ids: affected,
        added_refs,
        removed_refs,
    })
}

pub(crate) fn delete_file_impl(
    conn: &Connection,
    file_path: &str,
) -> Result<Vec<String>, BlockIndexError> {
    let tx = conn.unchecked_transaction()?;
    let removed_ids: Vec<String> = {
        let mut stmt = tx.prepare("SELECT id FROM blocks WHERE file_path = ?1")?;
        let rows = stmt.query_map([file_path], |r| r.get::<_, String>(0))?;
        rows.collect::<Result<_, _>>()?
    };
    tx.execute("DELETE FROM blocks WHERE file_path = ?1", params![file_path])?;
    tx.execute(
        "DELETE FROM block_refs WHERE source_file = ?1",
        params![file_path],
    )?;
    tx.commit()?;
    Ok(removed_ids)
}

pub(crate) fn rename_file_impl(
    conn: &Connection,
    old_path: &str,
    new_path: &str,
) -> Result<(), BlockIndexError> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE blocks SET file_path = ?1 WHERE file_path = ?2",
        params![new_path, old_path],
    )?;
    tx.execute(
        "UPDATE block_refs SET source_file = ?1 WHERE source_file = ?2",
        params![new_path, old_path],
    )?;
    tx.commit()?;
    Ok(())
}

fn row_to_block(row: &rusqlite::Row) -> rusqlite::Result<BlockRecord> {
    Ok(BlockRecord {
        id: row.get("id")?,
        file_path: row.get("file_path")?,
        node_type: row.get("node_type")?,
        level: row.get("level")?,
        text_preview: row.get("text_preview")?,
        position: row.get("position")?,
        checksum: row.get("checksum")?,
        parent_id: row.get("parent_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub(crate) fn resolve_impl(
    conn: &Connection,
    id: &str,
) -> Result<Option<BlockRecord>, BlockIndexError> {
    let mut stmt = conn.prepare("SELECT * FROM blocks WHERE id = ?1")?;
    let result = stmt.query_row([id], row_to_block).optional()?;
    Ok(result)
}

pub(crate) fn get_file_blocks_impl(
    conn: &Connection,
    file_path: &str,
) -> Result<Vec<BlockRecord>, BlockIndexError> {
    let mut stmt =
        conn.prepare("SELECT * FROM blocks WHERE file_path = ?1 ORDER BY position")?;
    let rows = stmt.query_map([file_path], row_to_block)?;
    let results: Result<Vec<_>, _> = rows.collect();
    Ok(results?)
}

pub(crate) fn get_backlinks_impl(
    conn: &Connection,
    target_id: &str,
) -> Result<Vec<LinkRecord>, BlockIndexError> {
    let mut stmt = conn.prepare(
        "SELECT source_block_id, target_block_id, source_file, kind
         FROM block_refs WHERE target_block_id = ?1",
    )?;
    let rows = stmt.query_map([target_id], |r| {
        Ok(LinkRecord {
            source_block_id: r.get(0)?,
            target_block_id: r.get(1)?,
            source_file: r.get(2)?,
            kind: r.get(3)?,
        })
    })?;
    let results: Result<Vec<_>, _> = rows.collect();
    Ok(results?)
}

pub(crate) fn search_impl(
    conn: &Connection,
    query: &str,
    limit: i64,
) -> Result<Vec<BlockRecord>, BlockIndexError> {
    // Strip FTS5 metacharacters from user input to prevent syntax errors
    let sanitized: String = query
        .chars()
        .map(|c| match c {
            '"' | '*' | ':' | '(' | ')' => ' ',
            other => other,
        })
        .collect();
    let trimmed = sanitized.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let fts_query = format!("\"{}\"*", trimmed.replace('\"', ""));
    let mut stmt = conn.prepare(
        "SELECT b.* FROM blocks_fts f
         JOIN blocks b ON b.id = f.id
         WHERE blocks_fts MATCH ?1
         ORDER BY rank
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![fts_query, limit], row_to_block)?;
    let results: Result<Vec<_>, _> = rows.collect();
    Ok(results?)
}

pub(crate) fn stats_impl(conn: &Connection) -> Result<IndexStats, BlockIndexError> {
    let blocks: i64 = conn.query_row("SELECT COUNT(*) FROM blocks", [], |r| r.get(0))?;
    let files: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT file_path) FROM blocks",
        [],
        |r| r.get(0),
    )?;
    // Size from SQLite's page count * page size
    let page_count: i64 =
        conn.query_row("PRAGMA page_count", [], |r| r.get(0)).unwrap_or(0);
    let page_size: i64 =
        conn.query_row("PRAGMA page_size", [], |r| r.get(0)).unwrap_or(4096);
    Ok(IndexStats {
        blocks,
        files,
        size_bytes: page_count * page_size,
    })
}

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

fn emit_updated(
    app: &AppHandle,
    file: &str,
    affected_block_ids: &[String],
    added_refs: &[String],
    removed_refs: &[String],
) {
    let payload = serde_json::json!({
        "file": file,
        "affected_block_ids": affected_block_ids,
        "added_refs": added_refs,
        "removed_refs": removed_refs,
    });
    let _ = app.emit("lokus:block-index-updated", payload);
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn block_index_upsert_file(
    app: AppHandle,
    workspace_path: String,
    file_path: String,
    blocks: Vec<BlockInput>,
) -> Result<UpsertResult, String> {
    let file_for_emit = file_path.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<UpsertResult, BlockIndexError> {
        with_conn(&workspace_path, |conn| upsert_file_impl(conn, &file_path, &blocks))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)?;

    emit_updated(
        &app,
        &file_for_emit,
        &result.affected_block_ids,
        &result.added_refs,
        &result.removed_refs,
    );
    Ok(result)
}

#[tauri::command]
pub async fn block_index_delete_file(
    app: AppHandle,
    workspace_path: String,
    file_path: String,
) -> Result<Vec<String>, String> {
    let file_for_emit = file_path.clone();
    let removed = tokio::task::spawn_blocking(move || -> Result<Vec<String>, BlockIndexError> {
        with_conn(&workspace_path, |conn| delete_file_impl(conn, &file_path))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)?;

    emit_updated(&app, &file_for_emit, &removed, &[], &[]);
    Ok(removed)
}

#[tauri::command]
pub async fn block_index_rename_file(
    app: AppHandle,
    workspace_path: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let new_for_emit = new_path.clone();
    tokio::task::spawn_blocking(move || -> Result<(), BlockIndexError> {
        with_conn(&workspace_path, |conn| {
            rename_file_impl(conn, &old_path, &new_path)
        })
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)?;

    emit_updated(&app, &new_for_emit, &[], &[], &[]);
    Ok(())
}

#[tauri::command]
pub async fn block_index_resolve(
    workspace_path: String,
    id: String,
) -> Result<Option<BlockRecord>, String> {
    tokio::task::spawn_blocking(move || -> Result<Option<BlockRecord>, BlockIndexError> {
        with_conn(&workspace_path, |conn| resolve_impl(conn, &id))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)
}

#[tauri::command]
pub async fn block_index_get_file_blocks(
    workspace_path: String,
    file_path: String,
) -> Result<Vec<BlockRecord>, String> {
    tokio::task::spawn_blocking(move || -> Result<Vec<BlockRecord>, BlockIndexError> {
        with_conn(&workspace_path, |conn| get_file_blocks_impl(conn, &file_path))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)
}

#[tauri::command]
pub async fn block_index_get_backlinks(
    workspace_path: String,
    target_id: String,
) -> Result<Vec<LinkRecord>, String> {
    tokio::task::spawn_blocking(move || -> Result<Vec<LinkRecord>, BlockIndexError> {
        with_conn(&workspace_path, |conn| get_backlinks_impl(conn, &target_id))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)
}

#[tauri::command]
pub async fn block_index_search(
    workspace_path: String,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<BlockRecord>, String> {
    let limit = limit.unwrap_or(50).clamp(1, 500);
    tokio::task::spawn_blocking(move || -> Result<Vec<BlockRecord>, BlockIndexError> {
        with_conn(&workspace_path, |conn| search_impl(conn, &query, limit))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)
}

#[tauri::command]
pub async fn block_index_stats(workspace_path: String) -> Result<IndexStats, String> {
    tokio::task::spawn_blocking(move || -> Result<IndexStats, BlockIndexError> {
        with_conn(&workspace_path, |conn| stats_impl(conn))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)
}

/// Rebuild is intentionally a stub for Phase 1a: the JS side (BlockIndexer + on-save)
/// is the primary ingestion path. A full rebuild-from-disk scanner lands in Phase 1d
/// once the JS side is wired and we know the exact extract-blocks contract.
///
/// For now: returns current stats. Callers gate on these being zero to kick off a
/// JS-driven walk of the workspace.
#[tauri::command]
pub async fn block_index_rebuild(workspace_path: String) -> Result<IndexStats, String> {
    tokio::task::spawn_blocking(move || -> Result<IndexStats, BlockIndexError> {
        with_conn(&workspace_path, |conn| stats_impl(conn))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(String::from)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        configure_conn(&conn).unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    fn block(id: &str, pos: i32, text: &str) -> BlockInput {
        BlockInput {
            id: id.into(),
            node_type: "paragraph".into(),
            level: None,
            text_preview: text.into(),
            position: pos,
            checksum: "cafe".into(),
            parent_id: None,
            outgoing_refs: vec![],
        }
    }

    #[test]
    fn migrations_are_idempotent() {
        let conn = fresh_conn();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let v: i32 = conn
            .query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, SCHEMA_VERSION);
    }

    #[test]
    fn upsert_then_resolve() {
        let conn = fresh_conn();
        let res = upsert_file_impl(&conn, "a.md", &[block("b1", 0, "hello")]).unwrap();
        assert_eq!(res.affected_block_ids, vec!["b1"]);
        let got = resolve_impl(&conn, "b1").unwrap().unwrap();
        assert_eq!(got.file_path, "a.md");
        assert_eq!(got.text_preview, "hello");
    }

    #[test]
    fn upsert_removes_stale_blocks_for_file() {
        let conn = fresh_conn();
        upsert_file_impl(
            &conn,
            "a.md",
            &[block("b1", 0, "one"), block("b2", 1, "two")],
        )
        .unwrap();
        // second pass without b2
        upsert_file_impl(&conn, "a.md", &[block("b1", 0, "one updated")]).unwrap();
        assert!(resolve_impl(&conn, "b2").unwrap().is_none());
        assert_eq!(
            resolve_impl(&conn, "b1").unwrap().unwrap().text_preview,
            "one updated"
        );
    }

    #[test]
    fn delete_file_cascades_refs() {
        let conn = fresh_conn();
        let mut b = block("b1", 0, "src");
        b.outgoing_refs.push(OutgoingRef {
            target_block_id: "t1".into(),
            kind: "link".into(),
        });
        upsert_file_impl(&conn, "a.md", &[b]).unwrap();
        assert_eq!(get_backlinks_impl(&conn, "t1").unwrap().len(), 1);
        delete_file_impl(&conn, "a.md").unwrap();
        assert!(resolve_impl(&conn, "b1").unwrap().is_none());
        assert_eq!(get_backlinks_impl(&conn, "t1").unwrap().len(), 0);
    }

    #[test]
    fn rename_file_updates_rows() {
        let conn = fresh_conn();
        let mut b = block("b1", 0, "src");
        b.outgoing_refs.push(OutgoingRef {
            target_block_id: "t1".into(),
            kind: "link".into(),
        });
        upsert_file_impl(&conn, "old.md", &[b]).unwrap();
        rename_file_impl(&conn, "old.md", "new.md").unwrap();
        assert_eq!(
            resolve_impl(&conn, "b1").unwrap().unwrap().file_path,
            "new.md"
        );
        let back = get_backlinks_impl(&conn, "t1").unwrap();
        assert_eq!(back[0].source_file, "new.md");
    }

    #[test]
    fn get_backlinks_directional() {
        let conn = fresh_conn();
        let mut src = block("s1", 0, "hi");
        src.outgoing_refs.push(OutgoingRef {
            target_block_id: "t1".into(),
            kind: "link".into(),
        });
        upsert_file_impl(&conn, "src.md", &[src]).unwrap();
        upsert_file_impl(&conn, "target.md", &[block("t1", 0, "target")]).unwrap();
        assert_eq!(get_backlinks_impl(&conn, "t1").unwrap().len(), 1);
        assert_eq!(get_backlinks_impl(&conn, "s1").unwrap().len(), 0);
    }

    #[test]
    fn upsert_diffs_added_and_removed_refs() {
        let conn = fresh_conn();
        let mut b = block("s1", 0, "hi");
        b.outgoing_refs.push(OutgoingRef {
            target_block_id: "t1".into(),
            kind: "link".into(),
        });
        let first = upsert_file_impl(&conn, "a.md", &[b]).unwrap();
        assert_eq!(first.added_refs, vec!["t1"]);
        assert!(first.removed_refs.is_empty());

        let mut b2 = block("s1", 0, "hi");
        b2.outgoing_refs.push(OutgoingRef {
            target_block_id: "t2".into(),
            kind: "link".into(),
        });
        let second = upsert_file_impl(&conn, "a.md", &[b2]).unwrap();
        assert!(second.added_refs.contains(&"t2".to_string()));
        assert!(second.removed_refs.contains(&"t1".to_string()));
    }

    #[test]
    fn fts_finds_blocks() {
        let conn = fresh_conn();
        upsert_file_impl(
            &conn,
            "a.md",
            &[
                block("b1", 0, "the rain in spain"),
                block("b2", 1, "quick brown fox"),
            ],
        )
        .unwrap();
        let results = search_impl(&conn, "rain", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "b1");

        // Porter stemming: "fox" matches "fox"
        let results = search_impl(&conn, "fox", 10).unwrap();
        assert_eq!(results[0].id, "b2");
    }

    #[test]
    fn fts_handles_metacharacters() {
        let conn = fresh_conn();
        upsert_file_impl(&conn, "a.md", &[block("b1", 0, "hello world")]).unwrap();
        // Should not panic on FTS5 operators in user input
        let _ = search_impl(&conn, "\"(*:)", 10).unwrap();
        let results = search_impl(&conn, "hello", 10).unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn stats_reports_counts() {
        let conn = fresh_conn();
        upsert_file_impl(
            &conn,
            "a.md",
            &[block("b1", 0, "one"), block("b2", 1, "two")],
        )
        .unwrap();
        upsert_file_impl(&conn, "b.md", &[block("b3", 0, "three")]).unwrap();
        let s = stats_impl(&conn).unwrap();
        assert_eq!(s.blocks, 3);
        assert_eq!(s.files, 2);
        assert!(s.size_bytes > 0);
    }

    #[test]
    fn duplicate_text_different_ids_no_collision() {
        // Regression for block-parser.js virtual-ID hash collision.
        // Two identical paragraphs in different files must coexist with distinct ids.
        let conn = fresh_conn();
        upsert_file_impl(&conn, "a.md", &[block("id_a", 0, "same text")]).unwrap();
        upsert_file_impl(&conn, "b.md", &[block("id_b", 0, "same text")]).unwrap();
        assert_eq!(
            resolve_impl(&conn, "id_a").unwrap().unwrap().file_path,
            "a.md"
        );
        assert_eq!(
            resolve_impl(&conn, "id_b").unwrap().unwrap().file_path,
            "b.md"
        );
    }

    #[test]
    fn resolve_missing_returns_none() {
        let conn = fresh_conn();
        assert!(resolve_impl(&conn, "nope").unwrap().is_none());
    }
}
