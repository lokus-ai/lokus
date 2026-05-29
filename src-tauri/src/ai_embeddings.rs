//! Local semantic-search index over note embeddings (`.lokus/embeddings.db`).
//!
//! Backs the Layer-B "connected notes" resurfacing: notes are embedded locally
//! by Ollama (`nomic-embed-text`, 768-dim) and stored here. The DB lives inside
//! the workspace's `.lokus/` dir and is **never synced** (sync explicitly
//! excludes it).
//!
//! ## Storage decision (§6.7 [FIX])
//! The implementation doc spec'd a `vec0` virtual table from the `sqlite-vec`
//! extension, but flagged it as **unconfirmed on crates.io** and offered a
//! pure-Rust fallback. There is no published, audited Rust crate that bundles
//! the `sqlite-vec` C extension portably across macOS/Windows/Linux, and
//! shipping a per-platform `.dylib`/`.dll`/`.so` + `load_extension` is brittle.
//!
//! So we take the robust path: `rusqlite` with the **`bundled`** feature
//! (statically links a known-good libsqlite3 — no cross-platform version drift,
//! no extension loading), store each embedding as a packed `f32` BLOB, and run
//! cosine-distance kNN in Rust. For a single user's note count this is more than
//! fast enough, and it has zero external-binary surface. The `note_meta` table
//! and its mtime-based reindex-diff semantics are kept verbatim, so swapping in
//! a real ANN index later is a localized change.
//!
//! No `reqwest` here, so this module is all-platform (no cfg gate).

use rusqlite::Connection;
use serde::Serialize;

/// Open (creating if needed) the embeddings DB and ensure the schema exists.
fn open_db(db_path: &str) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open embeddings DB: {}", e))?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    // `note_vecs` mirrors the spec's virtual-table intent with a plain table:
    // one row per note, the embedding packed as a little-endian f32 BLOB.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS note_vecs (
            note_id   TEXT PRIMARY KEY,
            embedding BLOB NOT NULL,
            dims      INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS note_meta (
            note_id    TEXT PRIMARY KEY,
            note_path  TEXT NOT NULL,
            mtime      INTEGER NOT NULL,
            chunk_hash TEXT NOT NULL,
            indexed_at INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to create embeddings schema: {}", e))?;

    Ok(conn)
}

/// Pack an f32 vector into a little-endian byte BLOB.
fn pack_embedding(embedding: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(embedding.len() * 4);
    for &v in embedding {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}

/// Unpack a little-endian byte BLOB back into an f32 vector.
fn unpack_embedding(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

/// Cosine distance in `[0, 2]` (0 = identical direction). Mismatched / zero
/// vectors yield the max distance so they sort last.
fn cosine_distance(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 2.0;
    }
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if na == 0.0 || nb == 0.0 {
        return 2.0;
    }
    1.0 - (dot / (na.sqrt() * nb.sqrt()))
}

#[derive(Debug, Serialize)]
pub struct EmbeddingMatch {
    pub note_id: String,
    pub note_path: String,
    pub distance: f32,
}

/// Upsert a note's embedding + metadata. Called by the generate-on-save
/// pipeline after Ollama produces a vector. Idempotent on `note_id`.
#[tauri::command]
pub fn index_note_embedding(
    db_path: String,
    note_id: String,
    note_path: String,
    mtime: i64,
    chunk_hash: String,
    embedding: Vec<f32>,
) -> Result<(), String> {
    if embedding.is_empty() {
        return Err("Refusing to index an empty embedding".to_string());
    }

    let conn = open_db(&db_path)?;
    let blob = pack_embedding(&embedding);
    let dims = embedding.len() as i64;
    let indexed_at = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO note_vecs (note_id, embedding, dims) VALUES (?1, ?2, ?3)
         ON CONFLICT(note_id) DO UPDATE SET embedding = excluded.embedding, dims = excluded.dims",
        rusqlite::params![note_id, blob, dims],
    )
    .map_err(|e| format!("Failed to upsert embedding: {}", e))?;

    conn.execute(
        "INSERT INTO note_meta (note_id, note_path, mtime, chunk_hash, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(note_id) DO UPDATE SET
            note_path = excluded.note_path, mtime = excluded.mtime,
            chunk_hash = excluded.chunk_hash, indexed_at = excluded.indexed_at",
        rusqlite::params![note_id, note_path, mtime, chunk_hash, indexed_at],
    )
    .map_err(|e| format!("Failed to upsert note_meta: {}", e))?;

    Ok(())
}

/// Remove a note's vector + metadata (used when a note is deleted or its scan
/// row disappears during the reindex diff).
#[tauri::command]
pub fn delete_note_embedding(db_path: String, note_id: String) -> Result<(), String> {
    let conn = open_db(&db_path)?;
    conn.execute("DELETE FROM note_vecs WHERE note_id = ?1", rusqlite::params![note_id])
        .map_err(|e| format!("Failed to delete embedding: {}", e))?;
    conn.execute("DELETE FROM note_meta WHERE note_id = ?1", rusqlite::params![note_id])
        .map_err(|e| format!("Failed to delete note_meta: {}", e))?;
    Ok(())
}

/// kNN cosine search: return the `k` nearest notes to `query_embedding`,
/// ascending by distance.
#[tauri::command]
pub fn search_embeddings(
    db_path: String,
    query_embedding: Vec<f32>,
    k: usize,
) -> Result<Vec<EmbeddingMatch>, String> {
    if query_embedding.is_empty() {
        return Err("Empty query embedding".to_string());
    }

    let conn = open_db(&db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT v.note_id, m.note_path, v.embedding
             FROM note_vecs v JOIN note_meta m ON m.note_id = v.note_id",
        )
        .map_err(|e| format!("Failed to prepare search: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let note_id: String = row.get(0)?;
            let note_path: String = row.get(1)?;
            let blob: Vec<u8> = row.get(2)?;
            Ok((note_id, note_path, blob))
        })
        .map_err(|e| format!("Failed to query embeddings: {}", e))?;

    let mut matches: Vec<EmbeddingMatch> = Vec::new();
    for row in rows {
        let (note_id, note_path, blob) = row.map_err(|e| format!("Row read error: {}", e))?;
        let emb = unpack_embedding(&blob);
        let distance = cosine_distance(&query_embedding, &emb);
        matches.push(EmbeddingMatch { note_id, note_path, distance });
    }

    matches.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));
    matches.truncate(k);
    Ok(matches)
}

/// Return `(note_id, mtime)` for every indexed note — the generate-on-save
/// pipeline diffs this against the live FileScanner mtime cache to decide which
/// notes to (re)embed and which to delete.
#[tauri::command]
pub fn list_indexed_notes(db_path: String) -> Result<Vec<(String, i64)>, String> {
    let conn = open_db(&db_path)?;
    let mut stmt = conn
        .prepare("SELECT note_id, mtime FROM note_meta")
        .map_err(|e| format!("Failed to prepare list: {}", e))?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
        .map_err(|e| format!("Failed to list indexed notes: {}", e))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("Row read error: {}", e))?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_roundtrip() {
        let v = vec![0.1f32, -0.5, 1.0, 0.0];
        assert_eq!(unpack_embedding(&pack_embedding(&v)), v);
    }

    #[test]
    fn cosine_identical_is_zero() {
        let v = vec![1.0f32, 2.0, 3.0];
        assert!(cosine_distance(&v, &v) < 1e-6);
    }

    #[test]
    fn cosine_orthogonal_is_one() {
        let a = vec![1.0f32, 0.0];
        let b = vec![0.0f32, 1.0];
        assert!((cosine_distance(&a, &b) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn cosine_mismatched_dims_is_max() {
        assert_eq!(cosine_distance(&[1.0, 2.0], &[1.0]), 2.0);
    }

    #[test]
    fn index_search_roundtrip() {
        let tmp = std::env::temp_dir().join(format!("lokus-emb-test-{}.db", std::process::id()));
        let db = tmp.to_string_lossy().to_string();
        let _ = std::fs::remove_file(&db);

        index_note_embedding(db.clone(), "n1".into(), "/a.md".into(), 100, "h1".into(), vec![1.0, 0.0, 0.0]).unwrap();
        index_note_embedding(db.clone(), "n2".into(), "/b.md".into(), 200, "h2".into(), vec![0.0, 1.0, 0.0]).unwrap();

        let res = search_embeddings(db.clone(), vec![0.9, 0.1, 0.0], 2).unwrap();
        assert_eq!(res.len(), 2);
        assert_eq!(res[0].note_id, "n1"); // nearest to the query direction

        let listed = list_indexed_notes(db.clone()).unwrap();
        assert_eq!(listed.len(), 2);

        delete_note_embedding(db.clone(), "n1".into()).unwrap();
        assert_eq!(list_indexed_notes(db.clone()).unwrap().len(), 1);

        let _ = std::fs::remove_file(&db);
    }
}
