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
/// In a note's document, beside its text: what the text alone does not say.
const META: &str = "meta";
const EOL: &str = "eol";

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
    /// Another device named a path this one will not write: outside the vault, or app state.
    Skipped {
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
    /// False on a viewer's device: nothing it writes is sent, so it decides nothing for the team.
    can_publish: bool,
}

struct Row {
    state: Vec<u8>,
    synced: Option<String>,
    path: Option<String>,
}

/// The workspace a folder's sync state belongs to, read without starting an engine: `None` for a
/// folder that never synced, and for one whose engine is running elsewhere and holds the file.
pub fn bound(root: &std::path::Path) -> Option<String> {
    let file = root.join(META_DIR).join("sync.sqlite");
    if !file.is_file() {
        return None;
    }
    let db = Connection::open_with_flags(file, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    db.query_row("SELECT value FROM meta WHERE key = 'workspace'", [], |r| {
        r.get(0)
    })
    .ok()
}

impl Engine {
    pub fn root(&self) -> &std::path::Path {
        self.vault.root()
    }

    pub fn open(vault: &Vault) -> Result<Self> {
        let dir = vault.root().join(META_DIR);
        fs::create_dir_all(&dir)?;
        let db = Connection::open(dir.join("sync.sqlite"))?;
        // One engine per vault, across windows and programs. Two at once each decide a file is
        // new and register it, so the same note is published twice and other devices get
        // neither copy. The lock is held for as long as this engine lives.
        db.busy_timeout(std::time::Duration::from_millis(1500))?;
        db.execute_batch("PRAGMA locking_mode = EXCLUSIVE; BEGIN IMMEDIATE; COMMIT;")
            .map_err(|e| match e.sqlite_error_code() {
                Some(rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked) => {
                    Error::InUse
                }
                _ => Error::Store(e),
            })?;
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
            can_publish: true,
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

    /// Tie this vault's sync state to one workspace. Everything kept here (which notes were
    /// published, how far into the relay's log this device has read) is only true of the
    /// workspace it was learned from. Pointed at another one, the vault starts clean: without
    /// this, a vault moved to a new workspace published nothing, and read nothing below its
    /// old position. Returns whether state was dropped. The files themselves are never touched.
    pub fn bind(&mut self, workspace: &str) -> Result<bool> {
        let known = self.meta("workspace")?;
        if known.as_deref() == Some(workspace) {
            return Ok(false);
        }
        let used: i64 = self.db.query_row(
            "SELECT (SELECT COUNT(*) FROM docs) + (SELECT COUNT(*) FROM outbox) + (SELECT COUNT(*) FROM files)",
            [],
            |r| r.get(0),
        )?;
        let dropped = known.is_some() || used > 0 || self.cursor()? > 0;
        if dropped {
            self.db.execute_batch(
                "DELETE FROM docs; DELETE FROM outbox; DELETE FROM files; DELETE FROM transfers;
                 DELETE FROM meta WHERE key IN ('cursor', 'pulled') OR key LIKE 'unsent:%';",
            )?;
        }
        self.set_meta("workspace", workspace)?;
        Ok(dropped)
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
        // The relay has this note now, so it is no longer only this device's.
        self.db.execute(
            "DELETE FROM meta WHERE key = 'unsent:' || (SELECT doc FROM outbox WHERE n = ?1)",
            [n],
        )?;
        self.db.execute("DELETE FROM outbox WHERE n = ?1", [n])?;
        Ok(())
    }

    /// Make one change of everything queued about names. A device that was away sends where
    /// its notes are now, not each place they have been: a teammate's device acts on every
    /// change as it comes, and a note made as "Untitled" and given its title while away was
    /// met there as a second "Untitled", so one of the two was renamed "(local copy)" for
    /// good. Only for a device with nothing on its way to the relay.
    pub fn fold_outbox(&mut self) -> Result<()> {
        let rows: Vec<(i64, Vec<u8>)> = {
            let mut q = self
                .db
                .prepare("SELECT n, data FROM outbox WHERE doc = ?1 ORDER BY n")?;
            let rows = q.query_map([MANIFEST], |r| Ok((r.get(0)?, r.get(1)?)))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        let Some(&(first, _)) = rows.first().filter(|_| rows.len() > 1) else {
            return Ok(());
        };
        let parts: Vec<&[u8]> = rows.iter().map(|(_, data)| data.as_slice()).collect();
        let merged = yrs::merge_updates_v1(&parts).map_err(|e| Error::Crdt(e.to_string()))?;
        // The folded row is written before the others go: stopped in between, the same
        // changes are queued twice, which is harmless, and none is lost.
        self.db.execute(
            "UPDATE outbox SET data = ?1 WHERE n = ?2",
            params![merged, first],
        )?;
        self.db.execute(
            "DELETE FROM outbox WHERE doc = ?1 AND n != ?2",
            params![MANIFEST, first],
        )?;
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

    fn entry(&self, manifest: &Doc, id: &str) -> Option<Entry> {
        let map = manifest.get_or_insert_map("notes");
        let txn = manifest.transact();
        serde_json::from_str(&map.get(&txn, id)?.to_string(&txn)).ok()
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

    /// The line ending the note's document carries for a device that has no file of it yet.
    /// The text in the document is all `\n`, so without this a note written with `\r\n`
    /// reached a teammate as `\n`.
    fn carried_eol(doc: &Doc) -> Eol {
        let meta = doc.get_or_insert_map(META);
        match meta.get(&doc.transact(), EOL) {
            Some(yrs::Out::Any(yrs::Any::String(s))) if &*s == "crlf" => Eol::Crlf,
            _ => Eol::Lf,
        }
    }

    /// Record the ending of this device's file in the document, when it says another. Only a
    /// device whose own file was just edited says so; mixed endings say nothing.
    fn carry_eol(doc: &Doc, eol: Eol) {
        let name = match eol {
            Eol::Crlf => "crlf",
            Eol::Lf => "lf",
            Eol::Mixed => return,
        };
        if Self::carried_eol(doc) != eol {
            let meta = doc.get_or_insert_map(META);
            meta.insert(&mut doc.transact_mut(), EOL, name);
        }
    }

    /// A file that exists keeps its own line endings; a new one takes the document's.
    fn write_disk(&self, path: &str, text: &str, doc: &Doc) -> Result<()> {
        let eol = self
            .read_disk(path)
            .map(|(_, eol)| eol)
            .unwrap_or_else(|| Self::carried_eol(doc));
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
        let mut by_path: HashMap<&str, &str> = HashMap::new();
        for (id, e) in entries.iter().filter(|(_, e)| !e.deleted) {
            // Two notes can name one path until one of them is named aside. The file there is
            // the one this device put there.
            if !by_path.contains_key(e.path.as_str())
                || self.doc_id(&e.path)?.as_deref() == Some(id.as_str())
            {
                by_path.insert(e.path.as_str(), id.as_str());
            }
        }
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
            let Some((text, eol)) = self.read_disk(path) else {
                continue;
            };
            if let Some(&id) = by_path.get(path.as_str()) {
                self.ingest(id, path, &text, eol)?;
                continue;
            }
            if !self.pulled()? {
                continue;
            }
            // The file of a note that is waiting to be moved to the name the manifest gives it.
            // A name this device refuses is never moved to, so that file is read as before.
            if let Some(id) = self.doc_id(path)? {
                if entries
                    .get(&id)
                    .is_some_and(|e| !e.deleted && self.vault.resolve(&e.path).is_ok())
                {
                    continue;
                }
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
            Self::carry_eol(&doc, eol);
            let update = doc
                .transact()
                .encode_state_as_update_v1(&StateVector::default());
            self.save(&id, &doc, Some(&text), Some(path))?;
            self.set_meta(&format!("unsent:{id}"), "1")?;
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

    /// The app renamed a note, or a folder of them. The move on disk and the change to which
    /// document is where are made together, here, so that a scan never meets the move half
    /// done. A scan can only guess at a rename, by finding a new path holding the exact text
    /// of a note that vanished; a note with nothing in it yet gives it nothing to match. So a
    /// new note given its title was taken for one note deleted and another made: the editor
    /// went on typing into the deleted one, and none of it reached a file or a teammate.
    pub fn rename(&mut self, from: &str, to: &str) -> Result<()> {
        self.vault.rename(from, to)?;
        let manifest = self.load(MANIFEST)?;
        let inside = format!("{from}/");
        // The notes this device keeps there, by its own record. A note the manifest puts at
        // one of these names but that is still waiting for it is not one of the files moved.
        let moved: Vec<(String, String)> = {
            let mut q = self
                .db
                .prepare("SELECT id, path FROM docs WHERE path IS NOT NULL")?;
            let rows = q.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
            rows.collect::<rusqlite::Result<Vec<(String, String)>>>()?
                .into_iter()
                .filter(|(_, path)| path == from || path.starts_with(&inside))
                .collect()
        };
        for (id, old) in moved {
            let path = format!("{to}{}", &old[from.len()..]);
            self.set_entry(
                &manifest,
                &id,
                &Entry {
                    path: path.clone(),
                    deleted: false,
                },
            )?;
            let doc = self.load(&id)?;
            let synced = self.row(&id)?.and_then(|r| r.synced);
            self.save(&id, &doc, synced.as_deref(), Some(&path))?;
            self.events.push(Event::Renamed {
                from: old,
                to: path,
            });
        }
        Ok(())
    }

    /// If the file differs from the last reconciled text, apply just that
    /// difference to the document.
    fn ingest(&mut self, id: &str, path: &str, disk: &str, eol: Eol) -> Result<()> {
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
        // This note's own file is still where this device keeps it, so the file at `path` is
        // another note's: the manifest names a move that has not been made here yet.
        if let Some(own) = row.path.as_deref().filter(|own| *own != path) {
            if self.vault.resolve(own)?.exists() {
                return Ok(());
            }
        }
        let before = doc.transact().state_vector();
        if base != disk {
            {
                let mut txn = doc.transact_mut();
                apply_diff(&content, &mut txn, base, disk);
            }
            Self::carry_eol(&doc, eol);
        }
        let merged = content.get_string(&doc.transact());
        let update = doc.transact().encode_diff_v1(&before);
        if merged != disk {
            // The document had moved on (a remote edit not yet on disk).
            self.write_disk(path, &merged, &doc)?;
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
        let Some(path) = row.path.as_deref() else {
            return Err(Error::UnknownDoc(id.to_string()));
        };
        let doc = self.new_doc();
        apply(&doc, &row.state)?;
        apply(&doc, update)?;
        let text = doc
            .get_or_insert_text("content")
            .get_string(&doc.transact());
        self.write_disk(path, &text, &doc)?;
        // A note published before documents carried the ending, and edited only in the app.
        let before = doc.transact().state_vector();
        if let Some((_, eol)) = self.read_disk(path) {
            Self::carry_eol(&doc, eol);
        }
        let said = doc.transact().encode_diff_v1(&before);
        self.save(id, &doc, Some(&text), Some(path))?;
        self.queue(id, update.to_vec())?;
        if doc.transact().state_vector() != before {
            // The open editor takes it too: its copy must not miss a step this device made.
            self.events.push(Event::Ingested {
                doc: id.to_string(),
                data: encode(&said),
            });
            self.queue(id, said)?;
        }
        Ok(())
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
            if let Some((disk, eol)) = self.read_disk(p) {
                let base = row.synced.clone().unwrap_or_default();
                if disk != base {
                    let before = doc.transact().state_vector();
                    {
                        let mut txn = doc.transact_mut();
                        apply_diff(&content, &mut txn, &base, &disk);
                    }
                    Self::carry_eol(&doc, eol);
                    local = Some(doc.transact().encode_diff_v1(&before));
                }
            }
        }
        apply(&doc, update)?;
        let text = content.get_string(&doc.transact());

        if path.is_none() {
            // The manifest may already say where this note lives.
            let manifest = self.load(MANIFEST)?;
            if let Some(entry) = self.entry(&manifest, id).filter(|e| !e.deleted) {
                path = self.claim_path(&manifest, id, &entry.path, Some(&text))?;
            }
        }
        if let Some(p) = &path {
            if self.read_disk(p).map(|(disk, _)| disk) != Some(text.clone()) {
                self.write_disk(p, &text, &doc)?;
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

    /// Say whether this device may publish; a viewer's may not.
    pub fn allow_publishing(&mut self, yes: bool) {
        self.can_publish = yes;
    }

    /// Place any note left waiting while this device was a viewer's. Only for a device that is
    /// up to date with the relay.
    pub fn place_waiting(&mut self) -> Result<()> {
        if !self.can_publish {
            return Ok(());
        }
        let manifest = self.load(MANIFEST)?;
        self.materialize(&manifest)
    }

    /// Take everything this device missed, as the relay hands it over in one answer. All of
    /// what it says about names is taken in before any file is touched. Taking it one change
    /// at a time, a device that was away met two notes on one name that the team had long
    /// since named apart, named them apart itself, and that stale word could win: a
    /// teammate's later rename was undone, or a note they deleted came back.
    pub fn apply_pulled(&mut self, items: &[(String, Vec<u8>)]) -> Result<()> {
        let manifest = self.load(MANIFEST)?;
        for (_, data) in items.iter().filter(|(doc, _)| doc == MANIFEST) {
            apply(&manifest, data)?;
        }
        self.save(MANIFEST, &manifest, None, None)?;
        self.materialize(&manifest)?;
        self.materialize_files(&manifest)?;
        // A note's missed edits are taken as one, so its file is made once, from all of them:
        // made from the first alone, it would miss a line ending the document was told later.
        let mut notes: Vec<(&str, Vec<&[u8]>)> = Vec::new();
        let mut at: HashMap<&str, usize> = HashMap::new();
        for (doc, data) in items.iter().filter(|(doc, _)| doc != MANIFEST) {
            let i = *at.entry(doc).or_insert(notes.len());
            if i == notes.len() {
                notes.push((doc, Vec::new()));
            }
            notes[i].1.push(data);
        }
        for (doc, parts) in notes {
            if let [one] = parts[..] {
                self.apply_remote(doc, one)?;
            } else {
                let all = yrs::merge_updates_v1(&parts).map_err(|e| Error::Crdt(e.to_string()))?;
                self.apply_remote(doc, &all)?;
            }
        }
        Ok(())
    }

    /// A name beside `path` that no file on this device has.
    fn beside(&self, path: &str) -> Result<String> {
        let stem = path.strip_suffix(".md").unwrap_or(path);
        let mut n = 1;
        loop {
            let candidate = if n == 1 {
                format!("{stem} (local copy).md")
            } else {
                format!("{stem} (local copy {n}).md")
            };
            if !self.vault.resolve(&candidate)?.exists() {
                return Ok(candidate);
            }
            n += 1;
        }
    }

    /// Where note `id`, which the manifest puts at `path`, goes on this device. An unrelated
    /// local file that sits there is moved aside, never overwritten. One that already holds
    /// exactly `text` is the same note made twice (a starter note every vault begins with), so
    /// it stays and becomes this note's file. `None`: the note cannot be placed yet.
    fn claim_path(
        &mut self,
        manifest: &Doc,
        id: &str,
        path: &str,
        text: Option<&str>,
    ) -> Result<Option<String>> {
        let taken_by_other: Option<String> = self
            .db
            .query_row(
                "SELECT id FROM docs WHERE path = ?1 AND id != ?2",
                params![path, id],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(other) = &taken_by_other {
            let stays = self
                .entry(manifest, other)
                .is_some_and(|e| !e.deleted && e.path == path);
            if stays {
                // A viewer cannot tell the team which note keeps the name, so this one waits
                // where it is until an editor's device has said. Unless the note in its way is
                // one the viewer made and the team has never seen: no editor will ever name
                // that one, and where it goes is only this device's business.
                let own = self.meta(&format!("unsent:{other}"))?.is_some();
                if !self.can_publish && !own {
                    return Ok(None);
                }
                // Two notes made apart under one name. Both are kept: the one with the smaller
                // id has the name, on every device, and the other is named beside it.
                let aside = self.beside(path)?;
                let moved = if !self.can_publish || other.as_str() > id {
                    other
                } else {
                    id
                };
                self.set_entry(
                    manifest,
                    moved,
                    &Entry {
                        path: aside.clone(),
                        deleted: false,
                    },
                )?;
                if moved == id {
                    return Ok(Some(aside));
                }
                if self.vault.resolve(path)?.exists() {
                    self.vault.rename(path, &aside)?;
                }
                let doc = self.load(other)?;
                let synced = self.row(other)?.and_then(|r| r.synced);
                self.save(other, &doc, synced.as_deref(), Some(&aside))?;
                self.events.push(Event::KeptBoth {
                    path: path.to_string(),
                    moved_to: aside,
                });
                return Ok(Some(path.to_string()));
            }
            // The note here is on its way to another name (two notes swapped names). It waits
            // beside this one until its own turn, so neither file is written over.
            let aside = self.beside(path)?;
            if self.vault.resolve(path)?.exists() {
                self.vault.rename(path, &aside)?;
            }
            let doc = self.load(other)?;
            let synced = self.row(other)?.and_then(|r| r.synced);
            self.save(other, &doc, synced.as_deref(), Some(&aside))?;
            self.events.push(Event::Renamed {
                from: path.to_string(),
                to: aside,
            });
            return Ok(Some(path.to_string()));
        }
        let exists = self.vault.resolve(path)?.exists();
        if exists {
            let ours: Option<String> = self
                .db
                .query_row("SELECT path FROM docs WHERE id = ?1", [id], |r| r.get(0))
                .optional()?
                .flatten();
            let same =
                text.is_some() && self.read_disk(path).map(|(disk, _)| disk).as_deref() == text;
            if ours.as_deref() != Some(path) && !same {
                let aside = self.beside(path)?;
                self.vault.rename(path, &aside)?;
                self.events.push(Event::KeptBoth {
                    path: path.to_string(),
                    moved_to: aside,
                });
            }
        }
        Ok(Some(path.to_string()))
    }

    /// Bring files in line with the manifest: create, rename and trash.
    fn materialize(&mut self, manifest: &Doc) -> Result<()> {
        // Notes that are gone leave first, so a note given the name of one finds it free.
        let mut ids: Vec<(bool, String)> = self
            .entries(manifest)
            .into_iter()
            .map(|(id, entry)| (!entry.deleted, id))
            .collect();
        ids.sort();
        for (_, id) in ids {
            // Read now, not before the loop: placing an earlier note may have renamed this one.
            let Some(entry) = self.entry(manifest, &id) else {
                continue;
            };
            // A path this device must not write (it would leave the vault, or reach into
            // `.lokus/`) is skipped, not fatal. Failing here would stop sync for good on every
            // device, and any member could cause it with one entry.
            if !entry.deleted && self.vault.resolve(&entry.path).is_err() {
                self.events.push(Event::Skipped {
                    path: entry.path.clone(),
                });
                continue;
            }
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
                    let Some(target) = self.claim_path(manifest, &id, &entry.path, None)? else {
                        continue;
                    };
                    if self.vault.resolve(old)?.exists() {
                        self.vault.rename(old, &target)?;
                        self.events.push(Event::Renamed {
                            from: old.clone(),
                            to: target.clone(),
                        });
                    } else {
                        self.write_disk(&target, &text, &doc)?;
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
                    let Some(target) = self.claim_path(manifest, &id, &entry.path, Some(&text))?
                    else {
                        continue;
                    };
                    // A file that already says this is left exactly as it is, line endings and all.
                    if self.read_disk(&target).map(|(disk, _)| disk).as_deref() != Some(&text) {
                        self.write_disk(&target, &text, &doc)?;
                        self.events.push(Event::Wrote {
                            path: target.clone(),
                        });
                    }
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
    fn a_path_that_leaves_the_vault_is_refused_and_sync_carries_on() {
        let (mut a, mut b) = (device(), device());
        a.write("Plan.md", "the plan\n");
        a.write("Other.md", "other\n");
        exchange(&mut a, &mut b);
        // A hostile or broken device moves two notes to places no device may write.
        for (note, bad) in [
            ("Plan.md", "../evil.md"),
            ("Other.md", ".lokus/plugins/evil/main.js"),
        ] {
            let id = a.engine.doc_id(note).unwrap().unwrap();
            let manifest = a.engine.load(MANIFEST).unwrap();
            let entry = Entry {
                path: bad.to_string(),
                deleted: false,
            };
            a.engine.set_entry(&manifest, &id, &entry).unwrap();
        }
        for out in a.engine.outbox().unwrap() {
            b.engine.apply_remote(&out.doc, &out.data).unwrap();
        }
        let outside = b.vault.root().parent().unwrap().join("evil.md");
        assert!(!outside.exists());
        assert!(!b.vault.root().join(".lokus/plugins/evil/main.js").exists());
        assert_eq!(b.read("Plan.md").as_deref(), Some("the plan\n"));
        assert!(b
            .engine
            .events
            .iter()
            .any(|e| matches!(e, Event::Skipped { path } if path == "../evil.md")));
        // And the next ordinary change still arrives.
        a.write("Later.md", "still syncing\n");
        a.engine.scan().unwrap();
        for out in a.engine.outbox().unwrap() {
            b.engine.apply_remote(&out.doc, &out.data).unwrap();
        }
        assert_eq!(b.read("Later.md").as_deref(), Some("still syncing\n"));
    }

    #[test]
    fn a_vault_moved_to_another_workspace_starts_clean_and_publishes_everything() {
        let (mut a, mut b) = (device(), device());
        a.engine.bind("first").unwrap();
        a.write("Plan.md", "the plan\n");
        a.write("img/photo.png", "bytes");
        exchange(&mut a, &mut b);
        a.engine.set_cursor(95).unwrap();
        assert!(a.engine.outbox().unwrap().is_empty());
        // The same workspace again changes nothing.
        assert!(!a.engine.bind("first").unwrap());
        assert_eq!(a.engine.cursor().unwrap(), 95);

        // A different workspace: nothing carried over, so everything is offered afresh.
        assert!(a.engine.bind("second").unwrap());
        assert_eq!(a.engine.cursor().unwrap(), 0);
        // Nothing is published before the first pull from the new workspace, as for any device.
        a.engine.scan().unwrap();
        assert!(a.engine.outbox().unwrap().is_empty());
        a.engine.mark_pulled().unwrap();
        let mut c = device();
        exchange(&mut a, &mut c);
        assert_eq!(c.read("Plan.md").as_deref(), Some("the plan\n"));
        assert_eq!(a.read("Plan.md").as_deref(), Some("the plan\n"));
        // A vault that has never synced is bound without losing anything.
        let mut fresh = device();
        assert!(!fresh.engine.bind("second").unwrap());
    }

    #[test]
    fn a_vault_has_one_sync_engine_at_a_time() {
        let a = device();
        // A second engine on the same vault is turned away while the first lives...
        assert!(matches!(Engine::open(&a.vault), Err(Error::InUse)));
        // ...and welcome once it is gone.
        let vault = a.vault.clone();
        let _keep = a._dir;
        drop(a.engine);
        assert!(Engine::open(&vault).is_ok());
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
    fn retained_edits_follow_renames_but_refuse_deleted_documents() {
        let (mut a, mut b) = (device(), device());
        a.write("Task.md", "original\n");
        exchange(&mut a, &mut b);
        let id = a.engine.doc_id("Task.md").unwrap().unwrap();
        let editor = Doc::new();
        apply(&editor, &a.engine.state(&id).unwrap().unwrap()).unwrap();
        let content = editor.get_or_insert_text("content");
        let before = editor.transact().state_vector();
        content.push(&mut editor.transact_mut(), "retained before rename\n");
        let pending = editor.transact().encode_state_as_update_v1(&before);

        b.engine.rename("Task.md", "Renamed.md").unwrap();
        exchange(&mut a, &mut b);
        a.engine.local_update(&id, &pending).unwrap();
        exchange(&mut a, &mut b);
        assert_eq!(a.read("Task.md"), None);
        assert_eq!(a.read("Renamed.md"), b.read("Renamed.md"));
        assert_eq!(
            a.read("Renamed.md").as_deref(),
            Some("original\nretained before rename\n")
        );

        let before = editor.transact().state_vector();
        content.push(&mut editor.transact_mut(), "retained before deletion\n");
        let pending = editor.transact().encode_state_as_update_v1(&before);
        b.vault.delete("Renamed.md").unwrap();
        exchange(&mut a, &mut b);
        let state = a.engine.state(&id).unwrap();
        assert!(a.engine.row(&id).unwrap().unwrap().path.is_none());
        assert!(a.engine.outbox().unwrap().is_empty());
        assert!(
            matches!(a.engine.local_update(&id, &pending), Err(Error::UnknownDoc(doc)) if doc == id)
        );
        assert_eq!(a.engine.state(&id).unwrap(), state);
        assert!(a.engine.outbox().unwrap().is_empty());
        assert_eq!(a.read("Renamed.md"), None);
        assert!(content
            .get_string(&editor.transact())
            .contains("retained before deletion"));
    }

    /// What broke for the first team to use Lokus: New note, type its title, then write.
    #[test]
    fn an_empty_note_given_its_title_is_still_the_same_note() {
        let (mut a, mut b) = (device(), device());
        a.write("Untitled.md", "");
        exchange(&mut a, &mut b);
        let id = a.engine.doc_id("Untitled.md").unwrap().unwrap();

        a.engine.rename("Untitled.md", "Plan.md").unwrap();
        assert_eq!(
            a.engine.doc_id("Plan.md").unwrap().as_deref(),
            Some(id.as_str()),
            "the note keeps its document, so what is typed next goes to it"
        );
        a.write("Plan.md", "Written after the title.\n");
        exchange(&mut a, &mut b);
        assert_eq!(
            b.read("Plan.md").as_deref(),
            Some("Written after the title.\n")
        );
        assert_eq!(b.read("Untitled.md"), None);

        // A folder moves with everything in it.
        a.write("Old/One.md", "one\n");
        a.write("Old/Deep/Two.md", "");
        exchange(&mut a, &mut b);
        a.engine.rename("Old", "New").unwrap();
        a.write("New/Deep/Two.md", "two, at last\n");
        exchange(&mut a, &mut b);
        assert_eq!(b.read("New/One.md").as_deref(), Some("one\n"));
        assert_eq!(b.read("New/Deep/Two.md").as_deref(), Some("two, at last\n"));
        assert_eq!(b.read("Old/One.md"), None);
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

    #[test]
    fn a_local_file_with_the_same_text_is_not_kept_twice() {
        let (mut a, mut b) = (device(), device());
        a.write("Same.md", "the same starter note\n");
        a.engine.scan().unwrap();
        // Device b began with the identical note, as every new vault does.
        b.write("Same.md", "the same starter note\n");
        for out in a.engine.outbox().unwrap() {
            b.engine.apply_remote(&out.doc, &out.data).unwrap();
        }
        b.engine.mark_pulled().unwrap();
        b.engine.scan().unwrap();
        assert_eq!(
            b.read("Same.md").as_deref(),
            Some("the same starter note\n")
        );
        assert_eq!(b.read("Same (local copy).md"), None);
        assert!(b.engine.outbox().unwrap().is_empty());
    }

    #[test]
    fn two_notes_made_apart_under_one_name_are_both_kept() {
        let (mut a, mut b) = (device(), device());
        a.write("Seed.md", "seed\n");
        exchange(&mut a, &mut b);
        // Apart, each makes a note of the same name.
        a.write("Untitled.md", "written on a\n");
        b.write("Untitled.md", "written on b\n");
        exchange(&mut a, &mut b);
        let mut texts = Vec::new();
        for d in [&a, &b] {
            let mut kept = [
                d.read("Untitled.md").unwrap(),
                d.read("Untitled (local copy).md").unwrap(),
            ];
            kept.sort();
            assert_eq!(kept, ["written on a\n", "written on b\n"]);
            texts.push(d.read("Untitled.md"));
        }
        // Both devices agree which note has the name.
        assert_eq!(texts[0], texts[1]);
        assert!(a.engine.outbox().unwrap().is_empty() && b.engine.outbox().unwrap().is_empty());
    }

    #[test]
    fn two_notes_renamed_apart_to_one_name_are_both_kept() {
        let (mut a, mut b) = (device(), device());
        a.write("One.md", "one\n");
        a.write("Two.md", "two\n");
        exchange(&mut a, &mut b);
        a.engine.rename("One.md", "Same.md").unwrap();
        b.engine.rename("Two.md", "Same.md").unwrap();
        exchange(&mut a, &mut b);
        for d in [&a, &b] {
            let mut kept = [
                d.read("Same.md").unwrap(),
                d.read("Same (local copy).md").unwrap(),
            ];
            kept.sort();
            assert_eq!(kept, ["one\n", "two\n"]);
        }
        assert_eq!(a.read("Same.md"), b.read("Same.md"));
        assert!(a.engine.outbox().unwrap().is_empty() && b.engine.outbox().unwrap().is_empty());
    }

    #[test]
    fn a_viewer_waits_for_an_editor_to_name_two_notes_apart() {
        // What the two editors queue reaches everyone; nothing a viewer queues is ever sent.
        fn settle(a: &mut Device, b: &mut Device, viewer: &mut Device) {
            for _ in 0..4 {
                a.engine.scan().unwrap();
                b.engine.scan().unwrap();
                viewer.engine.scan().unwrap();
                for out in a.engine.outbox().unwrap() {
                    b.engine.apply_remote(&out.doc, &out.data).unwrap();
                    viewer.engine.apply_remote(&out.doc, &out.data).unwrap();
                    a.engine.sent(out.n).unwrap();
                }
                for out in b.engine.outbox().unwrap() {
                    a.engine.apply_remote(&out.doc, &out.data).unwrap();
                    viewer.engine.apply_remote(&out.doc, &out.data).unwrap();
                    b.engine.sent(out.n).unwrap();
                }
            }
        }
        // Which note keeps the name, and whose write wins, go by random ids: try a few.
        for round in 0..12 {
            let (mut a, mut b, mut viewer) = (device(), device(), device());
            viewer.engine.allow_publishing(false);
            a.write("One.md", "one\n");
            a.write("Two.md", "two\n");
            settle(&mut a, &mut b, &mut viewer);
            if round % 2 == 0 {
                a.write("Untitled.md", "written on a\n");
                b.write("Untitled.md", "written on b\n");
                a.engine.scan().unwrap();
                b.engine.scan().unwrap();
            } else {
                a.engine.rename("One.md", "Untitled.md").unwrap();
                b.engine.rename("Two.md", "Untitled.md").unwrap();
            }
            settle(&mut a, &mut b, &mut viewer);
            assert_eq!(files(&a), files(&b));
            assert_eq!(files(&viewer), files(&a));
            // The viewer wrote nothing of its own, so it still follows what editors do next.
            assert!(viewer.engine.outbox().unwrap().is_empty());
            a.engine
                .rename("Untitled (local copy).md", "Moved.md")
                .unwrap();
            settle(&mut a, &mut b, &mut viewer);
            assert_eq!(files(&viewer), files(&a));
            assert!(viewer.engine.outbox().unwrap().is_empty());
        }
    }

    /// Every note on the device, with its text.
    fn files(d: &Device) -> Vec<(String, String)> {
        let mut all: Vec<(String, String)> = d
            .vault
            .notes()
            .unwrap()
            .into_iter()
            .map(|p| (p.clone(), d.read(&p).unwrap()))
            .collect();
        all.sort();
        all
    }

    /// Two editors each make `Untitled.md`, and a viewer hears of both notes before either
    /// editor's device has named them apart.
    fn a_viewer_left_waiting() -> (Device, Device, Device) {
        let (mut a, mut b, mut viewer) = (device(), device(), device());
        viewer.engine.allow_publishing(false);
        a.write("Untitled.md", "written on a\n");
        b.write("Untitled.md", "written on b\n");
        a.engine.scan().unwrap();
        b.engine.scan().unwrap();
        for d in [&a, &b] {
            for out in d.engine.outbox().unwrap() {
                viewer.engine.apply_remote(&out.doc, &out.data).unwrap();
            }
        }
        assert_eq!(viewer.vault.notes().unwrap().len(), 1);
        (a, b, viewer)
    }

    #[test]
    fn a_viewer_made_an_editor_places_the_note_that_was_waiting() {
        let (_a, _b, mut viewer) = a_viewer_left_waiting();
        viewer.engine.allow_publishing(true);
        viewer.engine.place_waiting().unwrap();
        let mut texts = [
            viewer.read("Untitled.md").unwrap(),
            viewer.read("Untitled (local copy).md").unwrap(),
        ];
        texts.sort();
        assert_eq!(texts, ["written on a\n", "written on b\n"]);
    }

    #[test]
    fn a_device_that_was_away_does_not_undo_what_the_team_did_since() {
        // Whose word wins goes by random ids: try a few. Odd rounds: the copy was deleted.
        for round in 0..16 {
            // It left as a viewer that had heard of both notes, or was away for all of it.
            let (mut a, mut b, mut away) = a_viewer_left_waiting();
            if round % 4 < 2 {
                away = device();
            }
            // Meanwhile the editors name the notes apart, then move the copy or delete it.
            let mut missed: Vec<(String, Vec<u8>)> = Vec::new();
            for step in 0..2 {
                if step == 1 && round % 2 == 0 {
                    a.engine
                        .rename("Untitled (local copy).md", "Moved.md")
                        .unwrap();
                } else if step == 1 {
                    fs::remove_file(a.vault.root().join("Untitled (local copy).md")).unwrap();
                }
                for _ in 0..4 {
                    a.engine.scan().unwrap();
                    b.engine.scan().unwrap();
                    for out in a.engine.outbox().unwrap() {
                        b.engine.apply_remote(&out.doc, &out.data).unwrap();
                        a.engine.sent(out.n).unwrap();
                        missed.push((out.doc, out.data));
                    }
                    for out in b.engine.outbox().unwrap() {
                        a.engine.apply_remote(&out.doc, &out.data).unwrap();
                        b.engine.sent(out.n).unwrap();
                        missed.push((out.doc, out.data));
                    }
                }
            }
            // It comes back, as an editor, and is handed what it missed.
            away.engine.allow_publishing(true);
            away.engine.apply_pulled(&missed).unwrap();
            away.engine.scan().unwrap();
            assert_eq!(files(&away), files(&a));
            assert!(away.engine.outbox().unwrap().is_empty());
        }
    }

    #[test]
    fn a_viewers_own_note_does_not_hide_the_teams_note_of_the_same_name() {
        // What the editor queues reaches everyone; a viewer's own changes go nowhere.
        fn settle(a: &mut Device, viewer: &mut Device, publishes: bool) {
            for _ in 0..4 {
                a.engine.scan().unwrap();
                viewer.engine.scan().unwrap();
                for out in a.engine.outbox().unwrap() {
                    viewer.engine.apply_remote(&out.doc, &out.data).unwrap();
                    a.engine.sent(out.n).unwrap();
                }
                for out in viewer
                    .engine
                    .outbox()
                    .unwrap()
                    .into_iter()
                    .filter(|_| publishes)
                {
                    a.engine.apply_remote(&out.doc, &out.data).unwrap();
                    viewer.engine.sent(out.n).unwrap();
                }
            }
        }
        for _ in 0..8 {
            let (mut a, mut viewer) = (device(), device());
            viewer.engine.allow_publishing(false);
            viewer.write("Untitled.md", "viewer private\n");
            a.write("Untitled.md", "team note\n");
            settle(&mut a, &mut viewer, false);
            // The team's note has the name; the viewer's own is beside it, on this device only.
            assert_eq!(viewer.read("Untitled.md").as_deref(), Some("team note\n"));
            assert_eq!(
                viewer.read("Untitled (local copy).md").as_deref(),
                Some("viewer private\n")
            );
            assert_eq!(files(&a).len(), 1);
            // Renaming its own note leaves the team's alone, also once it may publish.
            viewer
                .engine
                .rename("Untitled (local copy).md", "Mine.md")
                .unwrap();
            viewer.engine.allow_publishing(true);
            viewer.engine.fold_outbox().unwrap();
            settle(&mut a, &mut viewer, true);
            for d in [&a, &viewer] {
                assert_eq!(d.read("Untitled.md").as_deref(), Some("team note\n"));
                assert_eq!(d.read("Mine.md").as_deref(), Some("viewer private\n"));
                assert_eq!(files(d).len(), 2);
            }
        }
    }

    #[test]
    fn a_note_made_and_given_its_title_while_away_disturbs_nobody() {
        for _ in 0..8 {
            let (mut a, mut b) = (device(), device());
            a.write("Untitled.md", "a's note\n");
            a.engine.scan().unwrap();
            // b, away, makes a note and gives it its title before it is back.
            b.write("Untitled.md", "b's meeting\n");
            b.engine.scan().unwrap();
            b.engine.rename("Untitled.md", "Meeting.md").unwrap();
            // Back: it takes in what it missed, then sends where its notes are now.
            let missed: Vec<(String, Vec<u8>)> = a
                .engine
                .outbox()
                .unwrap()
                .into_iter()
                .map(|o| (o.doc, o.data))
                .collect();
            b.engine.apply_pulled(&missed).unwrap();
            b.engine.fold_outbox().unwrap();
            exchange(&mut a, &mut b);
            for d in [&a, &b] {
                assert_eq!(
                    files(d),
                    [
                        ("Meeting.md".to_string(), "b's meeting\n".to_string()),
                        ("Untitled.md".to_string(), "a's note\n".to_string()),
                    ]
                );
            }
        }
    }

    #[test]
    fn renaming_a_folder_leaves_a_note_that_waits_for_a_name_in_it() {
        let (mut a, mut viewer) = (device(), device());
        viewer.engine.allow_publishing(false);
        a.write("f/One.md", "one\n");
        exchange(&mut a, &mut viewer);
        // On the viewer's device only: the note is renamed, then a teammate uses that name.
        viewer.engine.rename("f/One.md", "f/Plan.md").unwrap();
        a.write("f/Plan.md", "team plan\n");
        a.engine.scan().unwrap();
        for out in a.engine.outbox().unwrap() {
            viewer.engine.apply_remote(&out.doc, &out.data).unwrap();
            a.engine.sent(out.n).unwrap();
        }
        viewer.engine.rename("f", "g").unwrap();
        // Made an editor: what it did goes out, and no note is lost on either device.
        viewer.engine.allow_publishing(true);
        viewer.engine.place_waiting().unwrap();
        viewer.engine.fold_outbox().unwrap();
        exchange(&mut a, &mut viewer);
        assert_eq!(files(&a), files(&viewer));
        let mut texts: Vec<String> = files(&a).into_iter().map(|(_, text)| text).collect();
        texts.sort();
        assert_eq!(texts, ["one\n", "team plan\n"]);
    }

    #[test]
    fn renaming_a_note_leaves_another_that_waits_for_its_name() {
        let (_a, _b, mut viewer) = a_viewer_left_waiting();
        let shown = viewer.read("Untitled.md").unwrap();
        viewer.engine.rename("Untitled.md", "Mine.md").unwrap();
        // The name is free now, so once the device may place it the other note takes it.
        viewer.engine.allow_publishing(true);
        viewer.engine.place_waiting().unwrap();
        assert_eq!(viewer.read("Mine.md"), Some(shown));
        assert!(viewer
            .read("Untitled.md")
            .is_some_and(|t| Some(&t) != viewer.read("Mine.md").as_ref()));
        assert_eq!(viewer.read("Untitled (local copy).md"), None);
    }

    #[test]
    fn a_note_whose_new_name_is_refused_is_still_read_where_it_is() {
        let (mut a, mut b) = (device(), device());
        a.write("Plan.md", "the plan\n");
        exchange(&mut a, &mut b);
        let id = a.engine.doc_id("Plan.md").unwrap().unwrap();
        let manifest = a.engine.load(MANIFEST).unwrap();
        let bad = Entry {
            path: "../evil.md".to_string(),
            deleted: false,
        };
        a.engine.set_entry(&manifest, &id, &bad).unwrap();
        for out in a.engine.outbox().unwrap() {
            b.engine.apply_remote(&out.doc, &out.data).unwrap();
            a.engine.sent(out.n).unwrap();
        }
        b.write("Plan.md", "the plan\nwritten on b afterwards\n");
        b.engine.scan().unwrap();
        assert!(!b.engine.outbox().unwrap().is_empty());
    }

    #[test]
    fn two_notes_that_swapped_names_arrive_as_one_change() {
        let (mut a, mut b) = (device(), device());
        a.write("One.md", "one\n");
        a.write("Two.md", "two\n");
        exchange(&mut a, &mut b);
        a.engine.rename("One.md", "Tmp.md").unwrap();
        a.engine.rename("Two.md", "One.md").unwrap();
        a.engine.rename("Tmp.md", "Two.md").unwrap();
        // The relay hands a device that was away the three renames as one change.
        let out = a.engine.outbox().unwrap();
        let parts: Vec<&[u8]> = out.iter().map(|o| o.data.as_slice()).collect();
        let merged = yrs::merge_updates_v1(&parts).unwrap();
        b.engine.apply_remote(MANIFEST, &merged).unwrap();
        for o in &out {
            a.engine.sent(o.n).unwrap();
        }
        exchange(&mut a, &mut b);
        for d in [&a, &b] {
            assert_eq!(d.read("One.md").as_deref(), Some("two\n"));
            assert_eq!(d.read("Two.md").as_deref(), Some("one\n"));
            assert_eq!(d.read("One (local copy).md"), None);
            assert_eq!(d.read("Two (local copy).md"), None);
        }
        assert!(a.engine.outbox().unwrap().is_empty() && b.engine.outbox().unwrap().is_empty());
    }

    #[test]
    fn a_note_given_the_name_of_a_deleted_one_arrives_as_one_change() {
        // Which of the two notes is placed first goes by their ids, so try a few pairs.
        for _ in 0..8 {
            let (mut a, mut b) = (device(), device());
            a.write("Old.md", "old\n");
            a.write("Kept.md", "kept\n");
            exchange(&mut a, &mut b);
            fs::remove_file(a.vault.root().join("Old.md")).unwrap();
            a.engine.scan().unwrap();
            a.engine.rename("Kept.md", "Old.md").unwrap();
            let out = a.engine.outbox().unwrap();
            let parts: Vec<&[u8]> = out.iter().map(|o| o.data.as_slice()).collect();
            let merged = yrs::merge_updates_v1(&parts).unwrap();
            b.engine.apply_remote(MANIFEST, &merged).unwrap();
            for o in &out {
                a.engine.sent(o.n).unwrap();
            }
            exchange(&mut a, &mut b);
            for d in [&a, &b] {
                assert_eq!(d.read("Old.md").as_deref(), Some("kept\n"));
                assert_eq!(d.read("Kept.md"), None);
                assert_eq!(d.read("Old (local copy).md"), None);
            }
        }
    }

    #[test]
    fn a_note_with_windows_line_endings_arrives_with_them() {
        let (mut a, mut b) = (device(), device());
        a.write("Win.md", "one\r\ntwo\r\nthree");
        b.write("Unix.md", "one\ntwo\n");
        exchange(&mut a, &mut b);
        assert_eq!(b.read("Win.md").as_deref(), Some("one\r\ntwo\r\nthree"));
        assert_eq!(a.read("Unix.md").as_deref(), Some("one\ntwo\n"));
        // A teammate's edit keeps them on both devices, with none mixed in.
        b.write("Win.md", "one\r\nTWO\r\nthree");
        exchange(&mut a, &mut b);
        assert_eq!(a.read("Win.md").as_deref(), Some("one\r\nTWO\r\nthree"));

        // Rewritten with other endings on one device: the other's file is not touched.
        a.write("Win.md", "one\nTWO\nthree!");
        exchange(&mut a, &mut b);
        assert_eq!(b.read("Win.md").as_deref(), Some("one\r\nTWO\r\nthree!"));

        // A device that joins later takes all it missed at once, and its file has the endings
        // last written, though the note was first published with others.
        let (mut d, mut c) = (device(), device());
        d.write("Late.md", "one\ntwo\n");
        d.engine.scan().unwrap();
        d.write("Late.md", "one\r\ntwo\r\nthree\r\n");
        d.engine.scan().unwrap();
        let mut missed: Vec<(String, Vec<u8>)> = Vec::new();
        for out in d.engine.outbox().unwrap() {
            missed.push((out.doc, out.data));
        }
        c.engine.apply_pulled(&missed).unwrap();
        assert_eq!(
            c.read("Late.md").as_deref(),
            Some("one\r\ntwo\r\nthree\r\n")
        );
    }

    #[test]
    fn a_line_ending_changed_while_away_is_said_when_merged_with_a_teammates_edit() {
        // An edit made while away, merged with a teammate's as it arrives, says its ending too.
        let (mut a, mut b) = (device(), device());
        a.write("Away.md", "one\ntwo\n");
        exchange(&mut a, &mut b);
        a.write("Away.md", "one\r\ntwo\r\nfrom a\r\n");
        b.write("Away.md", "from b\none\ntwo\n");
        b.engine.scan().unwrap();
        for out in b.engine.outbox().unwrap() {
            a.engine.apply_remote(&out.doc, &out.data).unwrap();
        }
        exchange(&mut a, &mut b);
        let id = b.engine.doc_id("Away.md").unwrap().unwrap();
        let told = Doc::new();
        apply(&told, &b.engine.state(&id).unwrap().unwrap()).unwrap();
        assert_eq!(Engine::carried_eol(&told), Eol::Crlf);
        assert_eq!(
            a.read("Away.md").as_deref(),
            Some("from b\r\none\r\ntwo\r\nfrom a\r\n")
        );
    }

    #[test]
    fn a_matching_local_file_keeps_its_own_line_endings() {
        let (mut a, mut b) = (device(), device());
        a.write("Mixed.md", "one\ntwo\nthree\n");
        a.engine.scan().unwrap();
        b.write("Mixed.md", "one\r\ntwo\nthree\n");
        // The note's text arrives before the manifest that says where it lives.
        let mut out = a.engine.outbox().unwrap();
        out.sort_by_key(|o| o.doc == MANIFEST);
        for o in out {
            b.engine.apply_remote(&o.doc, &o.data).unwrap();
        }
        b.engine.mark_pulled().unwrap();
        assert_eq!(b.read("Mixed.md").as_deref(), Some("one\r\ntwo\nthree\n"));
        assert_eq!(b.read("Mixed (local copy).md"), None);
    }
}
