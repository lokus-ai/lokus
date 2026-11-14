//! @part-of sync
//! Attachments: files in the vault that are not notes (images, PDFs).
//! They are not merged; the manifest records each path's content hash, the
//! bytes live on the relay under that hash, and devices fetch what they lack.
//! A local file is never overwritten by a different one: it is kept beside it.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::time::UNIX_EPOCH;

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use yrs::{Doc, Map, ReadTxn, Transact};

use lokus_core::vault::hash;

use crate::engine::{Engine, Event, MANIFEST};
use crate::error::{Error, Result};

/// The largest attachment that is synced; bigger files stay on their device.
pub const MAX_FILE: u64 = 25 * 1024 * 1024;
const FILES: &str = "files";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct FileEntry {
    hash: String,
    size: u64,
    #[serde(default)]
    deleted: bool,
}

/// Bytes that still have to go to the relay (`up`) or come from it.
#[derive(Debug, Clone)]
pub struct Transfer {
    pub path: String,
    pub hash: String,
    pub up: bool,
}

/// What this device last agreed on for a path.
struct Known {
    hash: String,
    size: u64,
    mtime: i64,
}

impl Engine {
    pub(crate) fn create_file_tables(&self) -> Result<()> {
        self.db.execute_batch(
            "CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, hash TEXT NOT NULL, size INTEGER NOT NULL, mtime INTEGER NOT NULL);
             CREATE TABLE IF NOT EXISTS transfers (path TEXT NOT NULL, up INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (path, up));",
        )?;
        Ok(())
    }

    fn file_entries(&self, manifest: &Doc) -> HashMap<String, FileEntry> {
        let map = manifest.get_or_insert_map(FILES);
        let txn = manifest.transact();
        map.iter(&txn)
            .filter_map(|(path, value)| {
                let entry = serde_json::from_str(&value.to_string(&txn)).ok()?;
                Some((path.to_string(), entry))
            })
            .collect()
    }

    fn set_file_entry(&self, manifest: &Doc, path: &str, entry: &FileEntry) -> Result<()> {
        let before = manifest.transact().state_vector();
        {
            let map = manifest.get_or_insert_map(FILES);
            let mut txn = manifest.transact_mut();
            map.insert(
                &mut txn,
                path,
                serde_json::to_string(entry).unwrap_or_default(),
            );
        }
        let update = manifest.transact().encode_diff_v1(&before);
        self.save(MANIFEST, manifest, None, None)?;
        self.queue(MANIFEST, update)
    }

    fn known(&self, path: &str) -> Result<Option<Known>> {
        Ok(self
            .db
            .query_row(
                "SELECT hash, size, mtime FROM files WHERE path = ?1",
                [path],
                |r| {
                    Ok(Known {
                        hash: r.get(0)?,
                        size: r.get(1)?,
                        mtime: r.get(2)?,
                    })
                },
            )
            .optional()?)
    }

    fn remember(&self, path: &str, hash: &str) -> Result<()> {
        let (size, mtime) = self.stat(path).unwrap_or((0, 0));
        self.db.execute(
            "INSERT INTO files (path, hash, size, mtime) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (path) DO UPDATE SET hash = ?2, size = ?3, mtime = ?4",
            params![path, hash, size, mtime],
        )?;
        Ok(())
    }

    fn forget(&self, path: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM files WHERE path = ?1", [path])?;
        Ok(())
    }

    /// Size and modification time, which together say "unchanged" cheaply.
    fn stat(&self, path: &str) -> Option<(u64, i64)> {
        let meta = fs::metadata(self.vault.resolve(path).ok()?).ok()?;
        let mtime = meta
            .modified()
            .ok()?
            .duration_since(UNIX_EPOCH)
            .ok()?
            .as_millis() as i64;
        Some((meta.len(), mtime))
    }

    fn hash_file(&self, path: &str) -> Result<String> {
        Ok(hash(&fs::read(self.vault.resolve(path)?)?))
    }

    fn want(&self, path: &str, hash: &str, up: bool) -> Result<()> {
        self.db.execute(
            "INSERT INTO transfers (path, up, hash) VALUES (?1, ?2, ?3)
             ON CONFLICT (path, up) DO UPDATE SET hash = ?3",
            params![path, up, hash],
        )?;
        Ok(())
    }

    pub fn transfers(&self) -> Result<Vec<Transfer>> {
        let mut q = self
            .db
            .prepare("SELECT path, hash, up FROM transfers ORDER BY up DESC, path")?;
        let rows = q.query_map([], |r| {
            Ok(Transfer {
                path: r.get(0)?,
                hash: r.get(1)?,
                up: r.get(2)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn transfer_done(&self, transfer: &Transfer) -> Result<()> {
        self.db.execute(
            "DELETE FROM transfers WHERE path = ?1 AND up = ?2 AND hash = ?3",
            params![transfer.path, transfer.up, transfer.hash],
        )?;
        Ok(())
    }

    /// Move a local file out of the way of a different one with the same name.
    fn set_aside(&mut self, path: &str) -> Result<()> {
        let (stem, ext) = match path.rsplit_once('.') {
            Some((stem, ext)) if !ext.contains('/') => (stem, format!(".{ext}")),
            _ => (path, String::new()),
        };
        let mut n = 1;
        let aside = loop {
            let candidate = if n == 1 {
                format!("{stem} (local copy){ext}")
            } else {
                format!("{stem} (local copy {n}){ext}")
            };
            if !self.vault.resolve(&candidate)?.exists() {
                break candidate;
            }
            n += 1;
        };
        self.vault.rename(path, &aside)?;
        self.forget(path)?;
        self.events.push(Event::KeptBoth {
            path: path.to_string(),
            moved_to: aside,
        });
        Ok(())
    }

    /// Compare the attachments on disk with the manifest and queue what
    /// follows: publish, fetch, or record a deletion.
    pub(crate) fn scan_files(&mut self, manifest: &Doc) -> Result<()> {
        let entries = self.file_entries(manifest);
        let on_disk: HashSet<String> = self.vault.attachments()?.into_iter().collect();
        let mut paths: Vec<&String> = on_disk.iter().collect();
        paths.sort();
        for path in paths {
            let Some((size, mtime)) = self.stat(path) else {
                continue;
            };
            if size > MAX_FILE {
                continue;
            }
            let known = self.known(path)?;
            let current = match &known {
                Some(k) if k.size == size && k.mtime == mtime => k.hash.clone(),
                _ => self.hash_file(path)?,
            };
            let remote = entries.get(path).filter(|e| !e.deleted);
            let untouched = known.as_ref().is_some_and(|k| k.hash == current);
            match remote {
                Some(e) if e.hash == current => {
                    if known.is_none_or(|k| k.hash != current || k.mtime != mtime) {
                        self.remember(path, &current)?;
                    }
                }
                // The workspace has a newer version and ours was not touched: take it.
                Some(e) if untouched => self.want(path, &e.hash, false)?,
                // Ours differs from a version we never had: keep ours beside it.
                Some(e) if known.as_ref().is_none_or(|k| k.hash != e.hash) => {
                    self.set_aside(path)?;
                    self.want(path, &e.hash, false)?;
                }
                // New here, or changed here since we last agreed: publish.
                _ => {
                    let entry = FileEntry {
                        hash: current.clone(),
                        size,
                        deleted: false,
                    };
                    self.set_file_entry(manifest, path, &entry)?;
                    self.remember(path, &current)?;
                    self.want(path, &current, true)?;
                    self.events.push(Event::Published { path: path.clone() });
                }
            }
        }
        for (path, entry) in entries.iter().filter(|(_, e)| !e.deleted) {
            if on_disk.contains(path) {
                continue;
            }
            match self.known(path)? {
                // We had exactly this file and it is gone: it was deleted here.
                Some(k) if k.hash == entry.hash => {
                    let gone = FileEntry {
                        deleted: true,
                        ..entry.clone()
                    };
                    self.set_file_entry(manifest, path, &gone)?;
                    self.forget(path)?;
                }
                _ => self.want(path, &entry.hash, false)?,
            }
        }
        Ok(())
    }

    /// Follow a change to the manifest made elsewhere.
    pub(crate) fn materialize_files(&mut self, manifest: &Doc) -> Result<()> {
        let mut entries: Vec<(String, FileEntry)> =
            self.file_entries(manifest).into_iter().collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        for (path, entry) in entries {
            // A path this device must not write is skipped; see `materialize` for why.
            if self.vault.resolve(&path).is_err() {
                self.events.push(Event::Skipped { path: path.clone() });
                continue;
            }
            let known = self.known(&path)?;
            if entry.deleted {
                self.db
                    .execute("DELETE FROM transfers WHERE path = ?1 AND up = 0", [&path])?;
                let Some(known) = known else { continue };
                // Only trash the version we know; a changed file stays and is published again.
                let exists = self.vault.resolve(&path)?.exists();
                if exists && self.hash_file(&path)? == known.hash {
                    self.vault.delete(&path)?;
                    self.events.push(Event::Trashed { path: path.clone() });
                }
                self.forget(&path)?;
            } else if known.is_none_or(|k| k.hash != entry.hash) {
                self.want(&path, &entry.hash, false)?;
            }
        }
        Ok(())
    }

    /// The bytes to send for an upload, or `None` if the file has changed
    /// or gone since (a later scan queues the right thing).
    pub fn read_upload(&self, transfer: &Transfer) -> Result<Option<Vec<u8>>> {
        let Ok(abs) = self.vault.resolve(&transfer.path) else {
            return Ok(None);
        };
        Ok(fs::read(abs)
            .ok()
            .filter(|bytes| hash(bytes) == transfer.hash))
    }

    /// Put fetched bytes in place, unless the workspace no longer wants them there.
    pub fn store_download(&mut self, transfer: &Transfer, bytes: &[u8]) -> Result<()> {
        if hash(bytes) != transfer.hash {
            return Err(Error::Net(format!("{} arrived damaged", transfer.path)));
        }
        let manifest = self.load(MANIFEST)?;
        let wanted = self
            .file_entries(&manifest)
            .get(&transfer.path)
            .is_some_and(|e| !e.deleted && e.hash == transfer.hash);
        if !wanted {
            return Ok(());
        }
        let path = transfer.path.as_str();
        if self.vault.resolve(path)?.exists() {
            let current = self.hash_file(path)?;
            if current == transfer.hash {
                return self.remember(path, &current);
            }
            if self.known(path)?.is_none_or(|k| k.hash != current) {
                self.set_aside(path)?;
            }
        }
        self.vault.write_file(path, bytes)?;
        self.remember(path, &transfer.hash)?;
        self.events.push(Event::Wrote {
            path: path.to_string(),
        });
        Ok(())
    }
}
