//! @part-of core.index
//! A disposable index of the vault: full-text search, links and tags.
//!
//! It lives in `.lokus/index.sqlite` and is rebuilt from the files whenever
//! it is missing or stale. The files stay the truth; deleting the index
//! loses nothing.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::sync::OnceLock;
use std::time::UNIX_EPOCH;

use regex::Regex;
use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::{CoreError, Result};
use crate::vault::{Vault, META_DIR};

/// Bump when the tables change; an old index is thrown away and rebuilt.
const SCHEMA: i64 = 4;

pub struct Index {
    db: Connection,
    vault: Vault,
}

#[derive(Debug, Serialize, Default)]
pub struct Refreshed {
    pub notes: usize,
    pub updated: usize,
    pub removed: usize,
}

#[derive(Debug, Serialize)]
pub struct Hit {
    pub path: String,
    pub title: String,
    /// Matching text with the hits wrapped in `[[[` and `]]]`.
    pub snippet: String,
}

/// One note as a database row.
#[derive(Debug, Serialize)]
pub struct Row {
    pub path: String,
    pub title: String,
    pub props: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct Mention {
    pub path: String,
    pub title: String,
    pub line: usize,
    pub context: String,
}

#[derive(Debug, Serialize)]
pub struct Node {
    pub path: String,
    pub title: String,
    /// Links in plus links out.
    pub degree: usize,
}

#[derive(Debug, Serialize)]
pub struct Graph {
    pub nodes: Vec<Node>,
    /// Pairs of indexes into `nodes`: source, target.
    pub edges: Vec<(usize, usize)>,
}

#[derive(Debug, PartialEq)]
struct Link {
    /// Lower-case, no `.md`, no `#heading`.
    target: String,
    line: usize,
    context: String,
}

fn db_err(e: rusqlite::Error) -> CoreError {
    CoreError::Index(e.to_string())
}

fn patterns() -> &'static (Regex, Regex, Regex, Regex) {
    static P: OnceLock<(Regex, Regex, Regex, Regex)> = OnceLock::new();
    P.get_or_init(|| {
        (
            Regex::new(r"!?\[\[([^\]\|\n]+)(?:\|[^\]\n]*)?\]\]").expect("wiki link pattern"),
            Regex::new(r"\[[^\]\n]*\]\(<?([^)\s>]+?\.md)(?:#[^)\s>]*)?>?\)")
                .expect("markdown link pattern"),
            Regex::new(r"(?:^|\s)#([\p{L}][\p{L}\p{N}_/-]*)").expect("tag pattern"),
            Regex::new(r"`[^`\n]*`").expect("inline code pattern"),
        )
    })
}

/// The part of a path or link that identifies a note: lower-case, no `.md`.
fn key(path: &str) -> String {
    let lower = path.trim().trim_start_matches("./").to_lowercase();
    lower.strip_suffix(".md").unwrap_or(&lower).to_string()
}

fn stem(key: &str) -> &str {
    key.rsplit('/').next().unwrap_or(key)
}

const OTHER_FILE: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "pdf", "mp4", "mov", "mp3", "wav",
    "canvas",
];

fn is_note_target(target: &str) -> bool {
    match target.rsplit_once('.') {
        Some((_, ext)) => !OTHER_FILE.contains(&ext.to_lowercase().as_str()),
        None => true,
    }
}

/// Title (first `# ` heading, if any), links and tags of one note.
fn parse(text: &str) -> (Option<String>, Vec<Link>, Vec<String>) {
    let (wiki, markdown, tag, code) = patterns();
    let mut title = None;
    let mut links = Vec::new();
    let mut tags = HashSet::new();
    let mut fence: Option<&str> = None;
    let mut in_frontmatter = false;

    for (number, raw) in text.lines().enumerate() {
        let trimmed = raw.trim_start();
        if number == 0 && trimmed.trim_end() == "---" {
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter {
            in_frontmatter = trimmed.trim_end() != "---";
            continue;
        }
        if let Some(open) = fence {
            if trimmed.starts_with(open) {
                fence = None;
            }
            continue;
        }
        if trimmed.starts_with("```") {
            fence = Some("```");
            continue;
        }
        if trimmed.starts_with("~~~") {
            fence = Some("~~~");
            continue;
        }
        if title.is_none() {
            if let Some(heading) = trimmed.strip_prefix("# ") {
                // A template's placeholder heading is not a title; its file name is.
                if !heading.contains("{{") {
                    title = Some(heading.trim().to_string());
                }
            }
        }
        let line = code.replace_all(raw, "");
        let context = raw.trim().chars().take(240).collect::<String>();
        let mut add = |target: &str| {
            let target = target.split(['#', '^']).next().unwrap_or("");
            if !target.trim().is_empty() && is_note_target(target) {
                links.push(Link {
                    target: key(target),
                    line: number + 1,
                    context: context.clone(),
                });
            }
        };
        for found in wiki.captures_iter(&line) {
            add(&found[1]);
        }
        for found in markdown.captures_iter(&line) {
            if !found[1].contains("://") {
                add(&found[1].replace("%20", " "));
            }
        }
        if !trimmed.starts_with('#') || trimmed.starts_with("# ") || !trimmed.contains(' ') {
            for found in tag.captures_iter(&line) {
                tags.insert(found[1].to_lowercase());
            }
        }
    }
    let mut tags: Vec<_> = tags.into_iter().collect();
    tags.sort();
    (title, links, tags)
}

impl Index {
    pub fn open(vault: &Vault) -> Result<Self> {
        let dir = vault.root().join(META_DIR);
        fs::create_dir_all(&dir)?;
        let file = dir.join("index.sqlite");
        let mut db = Connection::open(&file).map_err(db_err)?;
        let version: i64 = db
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(db_err)?;
        if version != SCHEMA {
            drop(db);
            for suffix in ["", "-wal", "-shm"] {
                let _ = fs::remove_file(dir.join(format!("index.sqlite{suffix}")));
            }
            db = Connection::open(&file).map_err(db_err)?;
            db.execute_batch(&format!(
                "PRAGMA journal_mode = WAL;
                 CREATE TABLE notes (path TEXT PRIMARY KEY, key TEXT NOT NULL, title TEXT NOT NULL,
                                     mtime INTEGER NOT NULL, size INTEGER NOT NULL);
                 CREATE INDEX notes_key ON notes (key);
                 CREATE TABLE links (source TEXT NOT NULL, target TEXT NOT NULL, line INTEGER NOT NULL,
                                     context TEXT NOT NULL);
                 CREATE INDEX links_source ON links (source);
                 CREATE INDEX links_target ON links (target);
                 CREATE TABLE props (path TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL);
                 CREATE INDEX props_path ON props (path);
                 CREATE TABLE tags (path TEXT NOT NULL, tag TEXT NOT NULL);
                 CREATE INDEX tags_tag ON tags (tag);
                 CREATE VIRTUAL TABLE text USING fts5 (path UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2');
                 PRAGMA user_version = {SCHEMA};"
            ))
            .map_err(db_err)?;
        }
        Ok(Self {
            db,
            vault: vault.clone(),
        })
    }

    /// Bring the index in line with the files: index what changed, drop what is gone.
    pub fn refresh(&mut self) -> Result<Refreshed> {
        let on_disk = self.vault.notes()?;
        let mut known: HashMap<String, (i64, i64)> = HashMap::new();
        {
            let mut rows = self
                .db
                .prepare("SELECT path, mtime, size FROM notes")
                .map_err(db_err)?;
            let found = rows
                .query_map([], |r| Ok((r.get::<_, String>(0)?, (r.get(1)?, r.get(2)?))))
                .map_err(db_err)?;
            for row in found {
                let (path, stamp) = row.map_err(db_err)?;
                known.insert(path, stamp);
            }
        }
        let mut report = Refreshed {
            notes: on_disk.len(),
            ..Default::default()
        };
        let tx = self.db.transaction().map_err(db_err)?;
        for path in &on_disk {
            let stamp = stamp(&self.vault, path);
            if known.remove(path) == stamp {
                continue;
            }
            put(&tx, &self.vault, path, stamp)?;
            report.updated += 1;
        }
        for path in known.keys() {
            forget(&tx, path)?;
            report.removed += 1;
        }
        tx.commit().map_err(db_err)?;
        Ok(report)
    }

    /// Re-index just these paths (or the notes under them), after a change on disk.
    pub fn update(&mut self, paths: &[String]) -> Result<()> {
        let tx = self.db.transaction().map_err(db_err)?;
        for path in paths {
            let abs = self.vault.root().join(path);
            if abs.is_file() && crate::vault::is_note(&abs) {
                put(&tx, &self.vault, path, stamp(&self.vault, path))?;
            } else if !abs.exists() {
                // A note or a whole folder went away.
                let like = format!("{}/%", path.replace('%', "\\%").replace('_', "\\_"));
                let mut gone = vec![path.clone()];
                {
                    let mut q = tx
                        .prepare("SELECT path FROM notes WHERE path LIKE ?1 ESCAPE '\\'")
                        .map_err(db_err)?;
                    let rows = q
                        .query_map([&like], |r| r.get::<_, String>(0))
                        .map_err(db_err)?;
                    for row in rows {
                        gone.push(row.map_err(db_err)?);
                    }
                }
                for p in gone {
                    forget(&tx, &p)?;
                }
            }
        }
        tx.commit().map_err(db_err)?;
        Ok(())
    }

    /// Every word must match; the last one matches as a prefix so results
    /// appear while typing.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<Hit>> {
        let words: Vec<String> = query
            .split_whitespace()
            .map(|w| w.replace('"', ""))
            .filter(|w| !w.is_empty())
            .map(|w| format!("\"{w}\"*"))
            .collect();
        if words.is_empty() {
            return Ok(Vec::new());
        }
        let mut q = self
            .db
            .prepare(
                "SELECT text.path, notes.title, snippet(text, 2, '[[[', ']]]', ' … ', 14)
                 FROM text JOIN notes ON notes.path = text.path
                 WHERE text MATCH ?1 ORDER BY bm25(text, 0.0, 8.0, 1.0) LIMIT ?2",
            )
            .map_err(db_err)?;
        let rows = q
            .query_map(params![words.join(" "), limit as i64], |r| {
                Ok(Hit {
                    path: r.get(0)?,
                    title: r.get(1)?,
                    snippet: r.get(2)?,
                })
            })
            .map_err(db_err)?;
        rows.collect::<rusqlite::Result<_>>().map_err(db_err)
    }

    /// Notes that link to `path`, one entry per linking line.
    pub fn backlinks(&self, path: &str) -> Result<Vec<Mention>> {
        let full = key(path);
        let short = stem(&full).to_string();
        // A bare `[[Name]]` means this note only if no better-placed note has that name.
        let owner_of_short = self.resolver()?.get(&short).cloned();
        let mut q = self
            .db
            .prepare(
                "SELECT links.source, notes.title, links.line, links.context, links.target
                 FROM links JOIN notes ON notes.path = links.source
                 WHERE links.target IN (?1, ?2) AND links.source != ?3
                 ORDER BY links.source, links.line",
            )
            .map_err(db_err)?;
        let rows = q
            .query_map(params![full, short, path], |r| {
                Ok((
                    Mention {
                        path: r.get(0)?,
                        title: r.get(1)?,
                        line: r.get(2)?,
                        context: r.get(3)?,
                    },
                    r.get::<_, String>(4)?,
                ))
            })
            .map_err(db_err)?;
        let mut out = Vec::new();
        for row in rows {
            let (mention, target) = row.map_err(db_err)?;
            if target == full || owner_of_short.as_deref() == Some(path) {
                out.push(mention);
            }
        }
        Ok(out)
    }

    /// Paths this note links to that exist.
    pub fn outgoing(&self, path: &str) -> Result<Vec<String>> {
        let resolver = self.resolver()?;
        let mut q = self
            .db
            .prepare("SELECT DISTINCT target FROM links WHERE source = ?1 ORDER BY line")
            .map_err(db_err)?;
        let rows = q
            .query_map([path], |r| r.get::<_, String>(0))
            .map_err(db_err)?;
        let mut out = Vec::new();
        for row in rows {
            if let Some(found) = resolver.get(&row.map_err(db_err)?) {
                if !out.contains(found) {
                    out.push(found.clone());
                }
            }
        }
        Ok(out)
    }

    pub fn graph(&self) -> Result<Graph> {
        let resolver = self.resolver()?;
        let mut nodes = Vec::new();
        let mut at: HashMap<String, usize> = HashMap::new();
        {
            let mut q = self
                .db
                .prepare("SELECT path, title FROM notes ORDER BY path")
                .map_err(db_err)?;
            let rows = q
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
                .map_err(db_err)?;
            for row in rows {
                let (path, title) = row.map_err(db_err)?;
                at.insert(path.clone(), nodes.len());
                nodes.push(Node {
                    path,
                    title,
                    degree: 0,
                });
            }
        }
        let mut edges = HashSet::new();
        let mut q = self
            .db
            .prepare("SELECT source, target FROM links")
            .map_err(db_err)?;
        let rows = q
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(db_err)?;
        for row in rows {
            let (source, target) = row.map_err(db_err)?;
            let (Some(&from), Some(&to)) = (
                at.get(&source),
                resolver.get(&target).and_then(|p| at.get(p)),
            ) else {
                continue;
            };
            if from != to && edges.insert((from, to)) {
                nodes[from].degree += 1;
                nodes[to].degree += 1;
            }
        }
        let mut edges: Vec<_> = edges.into_iter().collect();
        edges.sort_unstable();
        Ok(Graph { nodes, edges })
    }

    /// Notes directly inside `folder` (the vault root when empty) with their properties.
    pub fn rows(&self, folder: &str) -> Result<Vec<Row>> {
        self.rows_under(folder, false)
    }

    /// Notes inside `folder` with their properties; with `deep`, those in its subfolders too.
    pub fn rows_under(&self, folder: &str, deep: bool) -> Result<Vec<Row>> {
        let folder = folder.trim_matches('/');
        let mut q = self
            .db
            .prepare("SELECT path, title FROM notes ORDER BY path")
            .map_err(db_err)?;
        let found = q
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(db_err)?;
        let mut rows = Vec::new();
        for item in found {
            let (path, title) = item.map_err(db_err)?;
            let parent = path.rsplit_once('/').map(|(dir, _)| dir).unwrap_or("");
            let inside = deep
                && (folder.is_empty()
                    || parent.strip_prefix(folder).is_some_and(|rest| rest.starts_with('/')));
            if parent == folder || inside {
                rows.push(Row {
                    path,
                    title,
                    props: serde_json::Map::new(),
                });
            }
        }
        let mut q = self
            .db
            .prepare("SELECT key, value FROM props WHERE path = ?1")
            .map_err(db_err)?;
        for row in &mut rows {
            let found = q
                .query_map([&row.path], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
                })
                .map_err(db_err)?;
            for item in found {
                let (key, value) = item.map_err(db_err)?;
                row.props.insert(
                    key,
                    serde_json::from_str(&value).unwrap_or(serde_json::Value::Null),
                );
            }
        }
        Ok(rows)
    }

    pub fn tags(&self) -> Result<Vec<(String, usize)>> {
        let mut q = self
            .db
            .prepare("SELECT tag, COUNT(*) FROM tags GROUP BY tag ORDER BY COUNT(*) DESC, tag")
            .map_err(db_err)?;
        let rows = q
            .query_map([], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? as usize))
            })
            .map_err(db_err)?;
        rows.collect::<rusqlite::Result<_>>().map_err(db_err)
    }

    /// Link text to note path. A full path wins; a bare name goes to the
    /// note closest to the vault root, then alphabetically.
    fn resolver(&self) -> Result<HashMap<String, String>> {
        let mut q = self
            .db
            .prepare("SELECT key, path FROM notes ORDER BY length(path) - length(replace(path, '/', '')), path")
            .map_err(db_err)?;
        let rows = q
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(db_err)?;
        let mut map = HashMap::new();
        let mut by_stem = Vec::new();
        for row in rows {
            let (key, path) = row.map_err(db_err)?;
            by_stem.push((stem(&key).to_string(), path.clone()));
            map.insert(key, path);
        }
        for (short, path) in by_stem {
            map.entry(short).or_insert(path);
        }
        Ok(map)
    }
}

fn stamp(vault: &Vault, path: &str) -> Option<(i64, i64)> {
    let meta = fs::metadata(vault.root().join(path)).ok()?;
    let mtime = meta
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_nanos() as i64;
    Some((mtime, meta.len() as i64))
}

fn forget(db: &Connection, path: &str) -> Result<()> {
    for sql in [
        "DELETE FROM notes WHERE path = ?1",
        "DELETE FROM links WHERE source = ?1",
        "DELETE FROM tags WHERE path = ?1",
        "DELETE FROM props WHERE path = ?1",
        "DELETE FROM text WHERE path = ?1",
    ] {
        db.execute(sql, [path]).map_err(db_err)?;
    }
    Ok(())
}

fn put(db: &Connection, vault: &Vault, path: &str, stamp: Option<(i64, i64)>) -> Result<()> {
    forget(db, path)?;
    let Some((mtime, size)) = stamp else {
        return Ok(());
    };
    let Ok(bytes) = fs::read(vault.root().join(path)) else {
        return Ok(());
    };
    let text = String::from_utf8_lossy(&bytes);
    let (heading, links, tags) = parse(&text);
    let file_name = path.rsplit('/').next().unwrap_or(path);
    let name = file_name.strip_suffix(".md").unwrap_or(file_name);
    let title = heading.unwrap_or_else(|| name.to_string());
    db.execute(
        "INSERT INTO notes (path, key, title, mtime, size) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![path, key(path), title, mtime, size],
    )
    .map_err(db_err)?;
    // The file name is searchable too, weighted like a title.
    db.execute(
        "INSERT INTO text (path, title, body) VALUES (?1, ?2, ?3)",
        params![path, format!("{title} {name}"), text],
    )
    .map_err(db_err)?;
    for link in links {
        db.execute(
            "INSERT INTO links (source, target, line, context) VALUES (?1, ?2, ?3, ?4)",
            params![path, link.target, link.line as i64, link.context],
        )
        .map_err(db_err)?;
    }
    for (key, value) in crate::frontmatter::read(&text) {
        db.execute(
            "INSERT INTO props (path, key, value) VALUES (?1, ?2, ?3)",
            params![path, key, value.to_string()],
        )
        .map_err(db_err)?;
    }
    for tag in tags {
        db.execute(
            "INSERT INTO tags (path, tag) VALUES (?1, ?2)",
            params![path, tag],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault(files: &[(&str, &str)]) -> (tempfile::TempDir, Vault) {
        let dir = tempfile::tempdir().unwrap();
        for (path, text) in files {
            let abs = dir.path().join(path);
            fs::create_dir_all(abs.parent().unwrap()).unwrap();
            fs::write(abs, text).unwrap();
        }
        let vault = Vault::open(dir.path()).unwrap();
        (dir, vault)
    }

    #[test]
    fn links_in_code_and_frontmatter_do_not_count() {
        let text = "---\nrelated: \"[[Hidden]]\"\n---\n# Title\nsee [[A|alias]] and [b](sub/B.md#x) `[[C]]`\n```\n[[D]]\n```\n![[pic.png]] #tag";
        let (title, links, tags) = parse(text);
        assert_eq!(title.as_deref(), Some("Title"));
        assert_eq!(
            links.iter().map(|l| l.target.as_str()).collect::<Vec<_>>(),
            ["a", "sub/b"]
        );
        assert_eq!(tags, ["tag"]);
    }

    #[test]
    fn search_backlinks_and_graph_follow_the_files() {
        let (_dir, v) = vault(&[
            (
                "Home.md",
                "# Home\nGo to [[Plan]] and [[Missing]]. Zebra crossing.",
            ),
            (
                "work/Plan.md",
                "The quarterly plan mentions zebras. Back to [[Home]].",
            ),
            ("work/Other.md", "nothing here"),
        ]);
        let mut index = Index::open(&v).unwrap();
        let first = index.refresh().unwrap();
        assert_eq!((first.notes, first.updated, first.removed), (3, 3, 0));
        assert_eq!(
            index.refresh().unwrap().updated,
            0,
            "an unchanged vault is not re-read"
        );

        let hits = index.search("zebra", 10).unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits[0].snippet.contains("[[["));
        assert_eq!(
            index.search("quarterly pla", 10).unwrap()[0].path,
            "work/Plan.md"
        );
        assert!(index.search("\"", 10).unwrap().is_empty());

        let back = index.backlinks("work/Plan.md").unwrap();
        assert_eq!(
            (back.len(), back[0].path.as_str(), back[0].line),
            (1, "Home.md", 2)
        );
        assert_eq!(index.outgoing("Home.md").unwrap(), ["work/Plan.md"]);

        fs::write(
            v.root().join("work/Other.md"),
            "---\nstatus: doing\nestimate: 3\n---\nbody",
        )
        .unwrap();
        index.update(&["work/Other.md".into()]).unwrap();
        let rows = index.rows("work").unwrap();
        let other = rows.iter().find(|r| r.path == "work/Other.md").unwrap();
        assert_eq!(other.props["status"], serde_json::json!("doing"));
        assert_eq!(other.props["estimate"], serde_json::json!(3));
        assert_eq!(rows.len(), 2, "only notes directly in the folder");
        assert_eq!(index.rows_under("", true).unwrap().len(), 3, "every note, at any depth");
        assert_eq!(index.rows_under("wor", true).unwrap().len(), 0, "a folder, not a prefix");

        let graph = index.graph().unwrap();
        assert_eq!((graph.nodes.len(), graph.edges.len()), (3, 2));

        fs::remove_file(v.root().join("Home.md")).unwrap();
        index.update(&["Home.md".into()]).unwrap();
        assert!(index.backlinks("work/Plan.md").unwrap().is_empty());
        assert!(index.search("crossing", 10).unwrap().is_empty());
    }
}
