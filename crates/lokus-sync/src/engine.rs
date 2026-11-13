//! @part-of sync
//! The bridge between plain files and CRDT documents.
//!
//! Rules it keeps (learned the hard way by others):
//!  1. A file's text goes into its document exactly once. After that, only
//!     the difference between the last reconciled text and the new text is
//!     applied, never "delete everything and insert again".
//!  2. Nothing local is published until this device has pulled from the
//!     relay once, so a stale device cannot bring back deleted notes.
//!  3. After every step: document text == text on disk == `synced`.

use std::collections::{HashMap, HashSet};
use std::fs;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use yrs::updates::decoder::Decode;
use yrs::{Doc, GetString, Map, OffsetKind, Options, ReadTxn, StateVector, Text, Transact, Update};

use lokus_core::vault::{detect_eol, from_editor, to_editor, Eol, META_DIR};
use lokus_core::Vault;

use crate::error::{Error, Result};

/// The document that lists the workspace's notes: id -> path, or deleted.
pub const MANIFEST: &str = "manifest";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Entry {
    path: String,
    #[serde(default)]
    deleted: bool,
}

/// Something the engine did that a person might want to see.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    Wrote {
        path: String,
    },
    Renamed {
        from: String,
        to: String,
    },
    Trashed {
        path: String,
    },
    Published {
        path: String,
    },
    /// An edit made outside the app was folded into a document; an open editor applies it too.
    Ingested {
        doc: String,
        data: String,
    },
    /// Two different notes wanted the same path; the local file was moved aside.
    KeptBoth {
        path: String,
        moved_to: String,
    },
}

pub struct Outgoing {
    pub n: i64,
    pub doc: String,
    pub data: Vec<u8>,
}

pub struct Engine {
    pub(crate) vault: Vault,
    pub(crate) db: Connection,
    client_id: u64,
    pub events: Vec<Event>,
}

struct Row {
    state: Vec<u8>,
    synced: Option<String>,
    path: Option<String>,
}

impl Engine {
    pub fn open(vault: &Vault) -> Result<Self> {
        let dir = vault.root().join(META_DIR);
        fs::create_dir_all(&dir)?;
        let db = Connection::open(dir.join("sync.sqlite"))?;
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY, state BLOB NOT NULL, synced TEXT, path TEXT);
             CREATE TABLE IF NOT EXISTS outbox (n INTEGER PRIMARY KEY AUTOINCREMENT, doc TEXT NOT NULL, data BLOB NOT NULL);",
        )?;
        let mut engine = Self {
            vault: vault.clone(),
            db,
            client_id: 0,
            events: Vec::new(),
        };
        engine.create_file_tables()?;
        engine.client_id = match engine.meta("client_id")? {
            Some(id) => id.parse().unwrap_or(1),
            None => {
                // Yjs client ids are 32-bit on the wire in practice; stay inside that.
                let id = (uuid::Uuid::new_v4().as_u128() as u32).max(1) as u64;
                engine.set_meta("client_id", &id.to_string())?;
                id
            }
        };
        Ok(engine)
    }

    pub fn meta(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .db
            .query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| r.get(0))
            .optional()?)
    }

    pub fn set_meta(&self, key: &str, value: &str) -> Result<()> {
        self.db.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    /// Position in the relay's log this device has seen.
    pub fn cursor(&self) -> Result<i64> {
        Ok(self
            .meta("cursor")?
            .and_then(|c| c.parse().ok())
            .unwrap_or(0))
    }

    pub fn set_cursor(&self, seq: i64) -> Result<()> {
        if seq > self.cursor()? {
            self.set_meta("cursor", &seq.to_string())?;
        }
        Ok(())
    }

    /// Called after the first successful pull; local notes may be published from then on.
    pub fn mark_pulled(&self) -> Result<()> {
        self.set_meta("pulled", "1")
    }

    fn pulled(&self) -> Result<bool> {
        Ok(self.meta("pulled")?.is_some())
    }

    pub fn outbox(&self) -> Result<Vec<Outgoing>> {
        let mut q = self
            .db
            .prepare("SELECT n, doc, data FROM outbox ORDER BY n")?;
        let rows = q.query_map([], |r| {
            Ok(Outgoing {
                n: r.get(0)?,
                doc: r.get(1)?,
                data: r.get(2)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn sent(&self, n: i64) -> Result<()> {
        self.db.execute("DELETE FROM outbox WHERE n = ?1", [n])?;
        Ok(())
    }

    fn new_doc(&self) -> Doc {
        Doc::with_options(Options {
            client_id: yrs::block::ClientID::new(self.client_id),
            // Offsets must mean the same thing as in the editor (JavaScript strings).
            offset_kind: OffsetKind::Utf16,
            ..Options::default()
        })
    }

    fn row(&self, id: &str) -> Result<Option<Row>> {
        Ok(self
            .db
            .query_row(
                "SELECT state, synced, path FROM docs WHERE id = ?1",
                [id],
                |r| {
                    Ok(Row {
                        state: r.get(0)?,
                        synced: r.get(1)?,
                        path: r.get(2)?,
                    })
                },
            )
            .optional()?)
    }

    pub(crate) fn load(&self, id: &str) -> Result<Doc> {
        let doc = self.new_doc();
        if let Some(row) = self.row(id)? {
            apply(&doc, &row.state)?;
        }
        Ok(doc)
    }

    pub(crate) fn save(
        &self,
        id: &str,
        doc: &Doc,
        synced: Option<&str>,
        path: Option<&str>,
    ) -> Result<()> {
        let state = doc
            .transact()
            .encode_state_as_update_v1(&StateVector::default());
        self.db.execute(
            "INSERT INTO docs (id, state, synced, path) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (id) DO UPDATE SET state = ?2, synced = ?3, path = ?4",
            params![id, state, synced, path],
        )?;
        Ok(())
    }

    pub(crate) fn queue(&self, doc: &str, data: Vec<u8>) -> Result<()> {
        self.db.execute(
            "INSERT INTO outbox (doc, data) VALUES (?1, ?2)",
            params![doc, data],
        )?;
        Ok(())
    }

    fn entries(&self, manifest: &Doc) -> HashMap<String, Entry> {
        let map = manifest.get_or_insert_map("notes");
        let txn = manifest.transact();
        map.iter(&txn)
            .filter_map(|(id, value)| {
                let entry = serde_json::from_str(&value.to_string(&txn)).ok()?;
                Some((id.to_string(), entry))
            })
            .collect()
    }

    /// Change the manifest and queue the change for the relay.
    fn set_entry(&self, manifest: &Doc, id: &str, entry: &Entry) -> Result<()> {
        let before = manifest.transact().state_vector();
        {
            let map = manifest.get_or_insert_map("notes");
            let mut txn = manifest.transact_mut();
            map.insert(
                &mut txn,
                id,
                serde_json::to_string(entry).unwrap_or_default(),
            );
        }
        let update = manifest.transact().encode_diff_v1(&before);
        self.save(MANIFEST, manifest, None, None)?;
        self.queue(MANIFEST, update)
    }

    fn read_disk(&self, path: &str) -> Option<(String, Eol)> {
        let bytes = fs::read(self.vault.resolve(path).ok()?).ok()?;
        let text = String::from_utf8(bytes).ok()?;
        let eol = detect_eol(&text);
        Some((to_editor(&text), eol))
    }

    fn write_disk(&self, path: &str, text: &str) -> Result<()> {
        let eol = self.read_disk(path).map(|(_, eol)| eol).unwrap_or(Eol::Lf);
        if self.vault.resolve(path)?.exists() {
            self.vault.write(path, text, eol, None)?;
        } else {
            self.vault.create(path, &from_editor(text, eol))?;
        }
        Ok(())
    }

    /// Fold what changed on disk into the documents and queue it for the relay.
    pub fn scan(&mut self) -> Result<()> {
        let manifest = self.load(MANIFEST)?;
        let entries = self.entries(&manifest);
        let by_path: HashMap<&str, &str> = entries
            .iter()
            .filter(|(_, e)| !e.deleted)
            .map(|(id, e)| (e.path.as_str(), id.as_str()))
            .collect();
        let on_disk: HashSet<String> = self.vault.notes()?.into_iter().collect();

        // Notes we wrote before that are no longer on disk: deleted, or renamed.
        let mut missing: Vec<(String, String, String)> = Vec::new();
        for (id, entry) in entries.iter().filter(|(_, e)| !e.deleted) {
            if on_disk.contains(&entry.path) {
                continue;
            }
            if let Some(row) = self.row(id)? {
                if row.path.as_deref() == Some(entry.path.as_str()) {
                    missing.push((
                        id.clone(),
                        entry.path.clone(),
                        row.synced.unwrap_or_default(),
                    ));
                }
            }
        }

        let mut paths: Vec<&String> = on_disk.iter().collect();
        paths.sort();
        for path in paths {
            let Some((text, _)) = self.read_disk(path) else {
                continue;
            };
            if let Some(&id) = by_path.get(path.as_str()) {
                self.ingest(id, path, &text)?;
                continue;
            }
            if !self.pulled()? {
                continue;
            }
            // A new path with the exact text of a note that just vanished is a rename.
            let renamed = missing
                .iter()
                .position(|(_, _, synced)| !synced.is_empty() && *synced == text);
            if let Some(at) = renamed {
                let (id, old, _) = missing.remove(at);
                self.set_entry(
                    &manifest,
                    &id,
                    &Entry {
                        path: path.clone(),
                        deleted: false,
                    },
                )?;
                let doc = self.load(&id)?;
                self.save(&id, &doc, Some(&text), Some(path))?;
                self.events.push(Event::Renamed {
                    from: old,
                    to: path.clone(),
                });
                continue;
            }
            let id = uuid::Uuid::new_v4().to_string();
            let doc = self.new_doc();
            {
                let content = doc.get_or_insert_text("content");
                let mut txn = doc.transact_mut();
                content.insert(&mut txn, 0, &text);
            }
            let update = doc
                .transact()
                .encode_state_as_update_v1(&StateVector::default());
            self.save(&id, &doc, Some(&text), Some(path))?;
            self.queue(&id, update)?;
            self.set_entry(
                &manifest,
                &id,
                &Entry {
                    path: path.clone(),
                    deleted: false,
                },
            )?;
            self.events.push(Event::Published { path: path.clone() });
        }

        for (id, path, _) in missing {
            self.set_entry(
                &manifest,
                &id,
                &Entry {
                    path: path.clone(),
                    deleted: true,
                },
            )?;
            let doc = self.load(&id)?;
            let synced = self.row(&id)?.and_then(|r| r.synced);
            self.save(&id, &doc, synced.as_deref(), None)?;
        }
        if self.pulled()? {
            self.scan_files(&manifest)?;
        }
        Ok(())
    }

    /// If the file differs from the last reconciled text, apply just that
    /// difference to the document.
    fn ingest(&mut self, id: &str, path: &str, disk: &str) -> Result<()> {
        let Some(row) = self.row(id)? else {
            return Ok(());
        };
        let doc = self.new_doc();
        apply(&doc, &row.state)?;
        let content = doc.get_or_insert_text("content");
        let current = content.get_string(&doc.transact());
        let base = row.synced.as_deref().unwrap_or(&current);
        if base == disk && row.path.as_deref() == Some(path) {
            return Ok(());
        }
        let before = doc.transact().state_vector();
        if base != disk {
            let mut txn = doc.transact_mut();
            apply_diff(&content, &mut txn, base, disk);
        }
        let merged = content.get_string(&doc.transact());
        let update = doc.transact().encode_diff_v1(&before);
        if merged != disk {
            // The document had moved on (a remote edit not yet on disk).
            self.write_disk(path, &merged)?;
            self.events.push(Event::Wrote {
                path: path.to_string(),
            });
        }
        self.save(id, &doc, Some(&merged), Some(path))?;
        if base != disk {
            self.events.push(Event::Ingested {
                doc: id.to_string(),
                data: encode(&update),
            });
            self.queue(id, update)?;
        }
        Ok(())
    }

    /// Take an edit made on this device by the editor, already a CRDT update.
    pub fn local_update(&mut self, id: &str, update: &[u8]) -> Result<()> {
        let Some(row) = self.row(id)? else {
            return Err(Error::UnknownDoc(id.to_string()));
        };
        let doc = self.new_doc();
        apply(&doc, &row.state)?;
        apply(&doc, update)?;
        let text = doc
            .get_or_insert_text("content")
            .get_string(&doc.transact());
        if let Some(path) = row.path.as_deref() {
            self.write_disk(path, &text)?;
        }
        self.save(id, &doc, Some(&text), row.path.as_deref())?;
        self.queue(id, update.to_vec())
    }

    /// Take an edit from the relay and bring the files in line with it.
    pub fn apply_remote(&mut self, id: &str, update: &[u8]) -> Result<()> {
        if id == MANIFEST {
            let manifest = self.load(MANIFEST)?;
            apply(&manifest, update)?;
            self.save(MANIFEST, &manifest, None, None)?;
            self.materialize(&manifest)?;
            return self.materialize_files(&manifest);
        }
        let row = self.row(id)?;
        let doc = self.new_doc();
        let mut path = None;
        if let Some(row) = &row {
            apply(&doc, &row.state)?;
            path = row.path.clone();
        }
        let content = doc.get_or_insert_text("content");

        // Fold in any local edit that has not been picked up yet, so it is merged, not overwritten.
        let mut local = None;
        if let (Some(p), Some(row)) = (&path, &row) {
            if let Some((disk, _)) = self.read_disk(p) {
                let base = row.synced.clone().unwrap_or_default();
                if disk != base {
                    let before = doc.transact().state_vector();
                    {
                        let mut txn = doc.transact_mut();
                        apply_diff(&content, &mut txn, &base, &disk);
                    }
                    local = Some(doc.transact().encode_diff_v1(&before));
                }
            }
        }
        apply(&doc, update)?;
        let text = content.get_string(&doc.transact());

        if path.is_none() {
            // The manifest may already say where this note lives.
            let manifest = self.load(MANIFEST)?;
            if let Some(entry) = self.entries(&manifest).get(id).filter(|e| !e.deleted) {
                path = Some(self.claim_path(id, &entry.path)?);
            }
        }
        if let Some(p) = &path {
            if self.read_disk(p).map(|(disk, _)| disk) != Some(text.clone()) {
                self.write_disk(p, &text)?;
                self.events.push(Event::Wrote { path: p.clone() });
            }
        }
        self.save(
            id,
            &doc,
            path.as_ref().map(|_| text.as_str()),
            path.as_deref(),
        )?;
        if let Some(update) = local {
            self.events.push(Event::Ingested {
                doc: id.to_string(),
                data: encode(&update),
            });
            self.queue(id, update)?;
        }
        Ok(())
    }

    /// Make sure `path` is free for note `id`. An unrelated local file that
    /// sits there is moved aside, never overwritten.
    fn claim_path(&mut self, id: &str, path: &str) -> Result<String> {
        let taken_by_other: Option<String> = self
            .db
            .query_row(
                "SELECT id FROM docs WHERE path = ?1 AND id != ?2",
                params![path, id],
                |r| r.get(0),
            )
            .optional()?;
        let exists = self.vault.resolve(path)?.exists();
        if exists && taken_by_other.is_none() {
            let ours: Option<String> = self
                .db
                .query_row("SELECT path FROM docs WHERE id = ?1", [id], |r| r.get(0))
                .optional()?
                .flatten();
            if ours.as_deref() != Some(path) {
                let stem = path.strip_suffix(".md").unwrap_or(path);
                let mut n = 1;
                let aside = loop {
                    let candidate = if n == 1 {
                        format!("{stem} (local copy).md")
                    } else {
                        format!("{stem} (local copy {n}).md")
                    };
                    if !self.vault.resolve(&candidate)?.exists() {
                        break candidate;
                    }
                    n += 1;
                };
                self.vault.rename(path, &aside)?;
                self.events.push(Event::KeptBoth {
                    path: path.to_string(),
                    moved_to: aside,
                });
            }
        }
        Ok(path.to_string())
    }

    /// Bring files in line with the manifest: create, rename and trash.
    fn materialize(&mut self, manifest: &Doc) -> Result<()> {
        let mut entries: Vec<(String, Entry)> = self.entries(manifest).into_iter().collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        for (id, entry) in entries {
            let Some(row) = self.row(&id)? else { continue };
            let doc = self.new_doc();
            apply(&doc, &row.state)?;
            let text = doc
                .get_or_insert_text("content")
                .get_string(&doc.transact());
            match (&row.path, entry.deleted) {
                (Some(old), true) => {
                    // Only trash what we know; a file edited since stays and is published again by the next scan.
                    let unchanged = self
                        .read_disk(old)
                        .map(|(disk, _)| Some(disk) == row.synced)
                        .unwrap_or(false);
                    if unchanged {
                        self.vault.delete(old)?;
                        self.events.push(Event::Trashed { path: old.clone() });
                    }
                    self.save(&id, &doc, row.synced.as_deref(), None)?;
                }
                (Some(old), false) if *old != entry.path => {
                    let target = self.claim_path(&id, &entry.path)?;
                    if self.vault.resolve(old)?.exists() {
                        self.vault.rename(old, &target)?;
                        self.events.push(Event::Renamed {
                            from: old.clone(),
                            to: target.clone(),
                        });
                    } else {
                        self.write_disk(&target, &text)?;
                        self.events.push(Event::Wrote {
                            path: target.clone(),
                        });
                    }
                    self.save(
                        &id,
                        &doc,
                        row.synced.as_deref().or(Some(&text)),
                        Some(&target),
                    )?;
                }
                (None, false) => {
                    let target = self.claim_path(&id, &entry.path)?;
                    self.write_disk(&target, &text)?;
                    self.events.push(Event::Wrote {
                        path: target.clone(),
                    });
                    self.save(&id, &doc, Some(&text), Some(&target))?;
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// The document id of the note at `path`, if it is synced.
    pub fn doc_id(&self, path: &str) -> Result<Option<String>> {
        Ok(self
            .db
            .query_row("SELECT id FROM docs WHERE path = ?1", [path], |r| r.get(0))
            .optional()?)
    }

    /// Full state of a document, for an editor that is opening it.
    pub fn state(&self, id: &str) -> Result<Option<Vec<u8>>> {
        Ok(self.row(id)?.map(|r| r.state))
    }
}

fn encode(bytes: &[u8]) -> String {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn apply(doc: &Doc, update: &[u8]) -> Result<()> {
    let update = Update::decode_v1(update).map_err(|e| Error::Crdt(e.to_string()))?;
    doc.transact_mut()
        .apply_update(update)
        .map_err(|e| Error::Crdt(e.to_string()))
}

fn utf16(text: &str) -> u32 {
    text.encode_utf16().count() as u32
}

/// Apply the difference between `old` and `new` to the shared text as the
/// smallest set of inserts and deletes we can find.
fn apply_diff(content: &yrs::TextRef, txn: &mut yrs::TransactionMut, old: &str, new: &str) {
    use similar::{ChangeTag, TextDiff};
    // Diff by line first, then by character inside changed runs: precise and fast on long notes.
    let diff = TextDiff::configure()
        .timeout(std::time::Duration::from_millis(500))
        .diff_lines(old, new);
    let mut at: u32 = 0;
    let mut removed = String::new();
    let mut added = String::new();
    let flush =
        |at: &mut u32, removed: &mut String, added: &mut String, txn: &mut yrs::TransactionMut| {
            if removed.is_empty() && added.is_empty() {
                return;
            }
            let inner = TextDiff::configure()
                .timeout(std::time::Duration::from_millis(200))
                .diff_chars(removed.as_str(), added.as_str());
            for change in inner.iter_all_changes() {
                let piece = change.value();
                match change.tag() {
                    ChangeTag::Equal => *at += utf16(piece),
                    ChangeTag::Delete => content.remove_range(txn, *at, utf16(piece)),
                    ChangeTag::Insert => {
                        content.insert(txn, *at, piece);
                        *at += utf16(piece);
                    }
                }
            }
            removed.clear();
            added.clear();
        };
    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Equal => {
                flush(&mut at, &mut removed, &mut added, txn);
                at += utf16(change.value());
            }
            ChangeTag::Delete => removed.push_str(change.value()),
            ChangeTag::Insert => added.push_str(change.value()),
        }
    }
    flush(&mut at, &mut removed, &mut added, txn);
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Device {
        _dir: tempfile::TempDir,
        vault: Vault,
        engine: Engine,
    }

    fn device() -> Device {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        let engine = Engine::open(&vault).unwrap();
        engine.mark_pulled().unwrap();
        Device {
            _dir: dir,
            vault,
            engine,
        }
    }

    impl Device {
        fn write(&self, path: &str, text: &str) {
            let abs = self.vault.root().join(path);
            fs::create_dir_all(abs.parent().unwrap()).unwrap();
            fs::write(abs, text).unwrap();
        }
        fn read(&self, path: &str) -> Option<String> {
            fs::read_to_string(self.vault.root().join(path)).ok()
        }
    }

    /// Stand in for the relay: hand everything each device queued to the other.
    fn exchange(a: &mut Device, b: &mut Device) {
        for _ in 0..4 {
            a.engine.scan().unwrap();
            b.engine.scan().unwrap();
            for out in a.engine.outbox().unwrap() {
                b.engine.apply_remote(&out.doc, &out.data).unwrap();
                a.engine.sent(out.n).unwrap();
            }
            for out in b.engine.outbox().unwrap() {
                a.engine.apply_remote(&out.doc, &out.data).unwrap();
                b.engine.sent(out.n).unwrap();
            }
        }
    }

    #[test]
    fn a_new_note_reaches_the_other_device() {
        let (mut a, mut b) = (device(), device());
        a.write("Plan.md", "# Plan\n\nship it 🚀\n");
        exchange(&mut a, &mut b);
        assert_eq!(b.read("Plan.md").as_deref(), Some("# Plan\n\nship it 🚀\n"));
    }

    #[test]
    fn edits_made_apart_are_both_kept() {
        let (mut a, mut b) = (device(), device());
        a.write("Note.md", "first line\nmiddle\nlast line\n");
        exchange(&mut a, &mut b);
        // Both edit while "offline", in different places.
        a.write("Note.md", "FIRST line\nmiddle\nlast line\n");
        b.write(
            "Note.md",
            "first line\nmiddle\nlast line, extended 日本語\n",
        );
        exchange(&mut a, &mut b);
        let merged = "FIRST line\nmiddle\nlast line, extended 日本語\n";
        assert_eq!(a.read("Note.md").as_deref(), Some(merged));
        assert_eq!(b.read("Note.md").as_deref(), Some(merged));
    }

    #[test]
    fn renames_and_deletes_travel() {
        let (mut a, mut b) = (device(), device());
        a.write("Old.md", "some text\n");
        a.write("Gone.md", "to be deleted\n");
        exchange(&mut a, &mut b);
        fs::rename(a.vault.root().join("Old.md"), a.vault.root().join("New.md")).unwrap();
        fs::remove_file(a.vault.root().join("Gone.md")).unwrap();
        exchange(&mut a, &mut b);
        assert_eq!(b.read("New.md").as_deref(), Some("some text\n"));
        assert_eq!(b.read("Old.md"), None);
        assert_eq!(
            b.read("Gone.md"),
            None,
            "the delete reached the other device"
        );
        // And it stays deleted: nothing resurrects it on later rounds.
        exchange(&mut a, &mut b);
        assert_eq!(a.read("Gone.md"), None);
    }

    #[test]
    fn nothing_is_published_before_the_first_pull() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        fs::write(dir.path().join("Stale.md"), "old device\n").unwrap();
        let mut engine = Engine::open(&vault).unwrap();
        engine.scan().unwrap();
        assert!(engine.outbox().unwrap().is_empty());
    }

    #[test]
    fn a_local_file_in_the_way_is_kept_not_overwritten() {
        let (mut a, mut b) = (device(), device());
        a.write("Same.md", "from device a\n");
        a.engine.scan().unwrap();
        // Device b has its own, unrelated note at the same path and has not published it.
        b.write("Same.md", "from device b\n");
        for out in a.engine.outbox().unwrap() {
            b.engine.apply_remote(&out.doc, &out.data).unwrap();
        }
        assert_eq!(b.read("Same.md").as_deref(), Some("from device a\n"));
        assert_eq!(
            b.read("Same (local copy).md").as_deref(),
            Some("from device b\n")
        );
    }
}
