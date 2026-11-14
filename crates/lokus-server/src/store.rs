//! @part-of server
//! Everything the relay keeps: workspaces, members, invites, the update log,
//! attachments and a record of who changed who may do what.
//! One SQLite file, so the relay is a single binary anyone can run.

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Serialize;

use crate::error::{Error, Result};

/// Once a note has this many stored edits they are merged into one.
const COMPACT_AFTER: i64 = 200;
/// The shape of the tables. Before launch the format changes in place, so a file made by an
/// older build is refused rather than half-understood. A table that is only added does not
/// change the number: an older file simply gains it.
const SCHEMA: i32 = 2;
/// How many workspaces one person may own, and how many unused invites one workspace may hold.
const MAX_OWNED: i64 = 50;
const MAX_PENDING_INVITES: i64 = 50;
/// How many keys a workspace may have for its own systems to push facts with, how many facts
/// may wait to be written into notes, and how long a device has to write the ones it took.
const MAX_KEYS: i64 = 20;
const MAX_WAITING_FACTS: i64 = 10_000;
const CLAIM_SECONDS: i64 = 120;

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Owner,
    Editor,
    Viewer,
}

impl Role {
    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "owner" => Some(Self::Owner),
            "editor" => Some(Self::Editor),
            "viewer" => Some(Self::Viewer),
            _ => None,
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Editor => "editor",
            Self::Viewer => "viewer",
        }
    }
    pub fn can_edit(self) -> bool {
        self != Self::Viewer
    }
}

#[derive(Debug, Serialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub role: Role,
}

#[derive(Debug, Serialize)]
pub struct Member {
    pub user: String,
    pub email: Option<String>,
    pub role: Role,
    pub joined_at: i64,
}

/// An invite nobody has used yet.
#[derive(Debug, Serialize)]
pub struct Invite {
    pub code: String,
    pub role: Role,
    pub created_by: String,
    pub expires_at: i64,
}

/// One change to who may do what in a workspace.
#[derive(Debug, Serialize)]
pub struct Entry {
    pub at: i64,
    pub actor: String,
    pub action: String,
    /// Who or what it was done to: a user id, or an invite's role.
    pub subject: Option<String>,
    pub detail: Option<String>,
}

/// A key a team's own systems push facts with. The key itself is never kept, only its hash.
#[derive(Debug, Serialize)]
pub struct Key {
    pub id: String,
    pub label: String,
    pub created_by: String,
    pub created_at: i64,
    pub last_used: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct Stored {
    pub doc: String,
    pub seq: i64,
    /// Base64 of the CRDT update.
    pub data: String,
}

pub struct Store {
    db: Mutex<Connection>,
}

fn role_of(text: String) -> Role {
    Role::parse(&text).unwrap_or(Role::Viewer)
}

/// Write down a change to a workspace's people. Kept even after the workspace is deleted.
fn record(
    tx: &Transaction,
    workspace: &str,
    actor: &str,
    action: &str,
    subject: Option<&str>,
    detail: Option<&str>,
) -> rusqlite::Result<()> {
    tx.execute(
        "INSERT INTO audit (workspace, at, actor, action, subject, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![workspace, now(), actor, action, subject, detail],
    )?;
    Ok(())
}

fn owners(tx: &Transaction, workspace: &str) -> rusqlite::Result<i64> {
    tx.query_row(
        "SELECT COUNT(*) FROM members WHERE workspace = ?1 AND role = 'owner'",
        [workspace],
        |r| r.get(0),
    )
}

fn role_in(tx: &Transaction, workspace: &str, user: &str) -> rusqlite::Result<Option<Role>> {
    let role: Option<String> = tx
        .query_row(
            "SELECT role FROM members WHERE workspace = ?1 AND user = ?2",
            params![workspace, user],
            |r| r.get(0),
        )
        .optional()?;
    Ok(role.map(role_of))
}

const LAST_OWNER: &str =
    "a workspace needs an owner: make someone else an owner first, or delete the workspace";

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let db = Connection::open(path)?;
        db.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        let version: i32 = db.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        let existing: i64 = db.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'",
            [],
            |r| r.get(0),
        )?;
        if existing > 0 && version != SCHEMA {
            return Err(Error::Internal(
                "this relay database was made by an older build and its tables no longer match; \
                 move the file aside and start again"
                    .into(),
            ));
        }
        db.execute_batch(&format!(
            "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL,
                 created_by TEXT NOT NULL, created_at INTEGER NOT NULL);
             CREATE TABLE IF NOT EXISTS members (workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 user TEXT NOT NULL, email TEXT, role TEXT NOT NULL, joined_at INTEGER NOT NULL,
                 PRIMARY KEY (workspace, user));
             CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY,
                 workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 role TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
                 expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
                 used_by TEXT, used_at INTEGER);
             CREATE TABLE IF NOT EXISTS updates (seq INTEGER PRIMARY KEY AUTOINCREMENT,
                 workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 doc TEXT NOT NULL, data BLOB NOT NULL, user TEXT, at INTEGER NOT NULL);
             CREATE INDEX IF NOT EXISTS updates_by_doc ON updates (workspace, doc, seq);
             CREATE TABLE IF NOT EXISTS blobs (workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 hash TEXT NOT NULL, data BLOB NOT NULL, size INTEGER NOT NULL, user TEXT NOT NULL,
                 at INTEGER NOT NULL, PRIMARY KEY (workspace, hash));
             CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace TEXT NOT NULL,
                 at INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT, detail TEXT);
             CREATE INDEX IF NOT EXISTS audit_by_workspace ON audit (workspace, id);
             CREATE TABLE IF NOT EXISTS ingest_keys (id TEXT PRIMARY KEY,
                 workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_by TEXT NOT NULL,
                 created_at INTEGER NOT NULL, last_used INTEGER, revoked INTEGER NOT NULL DEFAULT 0);
             CREATE TABLE IF NOT EXISTS inbox (seq INTEGER PRIMARY KEY AUTOINCREMENT,
                 workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 body TEXT NOT NULL, at INTEGER NOT NULL, claimed_by TEXT, claimed_at INTEGER);
             CREATE INDEX IF NOT EXISTS inbox_by_workspace ON inbox (workspace, seq);
             CREATE TABLE IF NOT EXISTS app_releases (version TEXT NOT NULL, platform TEXT NOT NULL,
                 url TEXT NOT NULL, signature TEXT NOT NULL, at INTEGER NOT NULL,
                 pulled INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (version, platform));
             CREATE TABLE IF NOT EXISTS app_news (id TEXT PRIMARY KEY, body TEXT NOT NULL, at INTEGER NOT NULL);
             PRAGMA user_version = {SCHEMA};"
        ))?;
        Ok(Self { db: Mutex::new(db) })
    }

    fn db(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.db
            .lock()
            .map_err(|_| Error::Internal("store lock".into()))
    }

    pub fn create_workspace(
        &self,
        id: &str,
        name: &str,
        user: &str,
        email: Option<&str>,
    ) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let owned: i64 = tx.query_row(
            "SELECT COUNT(*) FROM members WHERE user = ?1 AND role = 'owner'",
            [user],
            |r| r.get(0),
        )?;
        if owned >= MAX_OWNED {
            return Err(Error::BadRequest(format!(
                "one account can own up to {MAX_OWNED} workspaces"
            )));
        }
        tx.execute(
            "INSERT INTO workspaces (id, name, created_by, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, user, now()],
        )?;
        tx.execute(
            "INSERT INTO members (workspace, user, email, role, joined_at) VALUES (?1, ?2, ?3, 'owner', ?4)",
            params![id, user, email, now()],
        )?;
        record(&tx, id, user, "workspace_created", None, Some(name))?;
        Ok(tx.commit()?)
    }

    /// Remove a workspace and everything in it. The record of it having existed stays.
    pub fn delete_workspace(&self, id: &str, actor: &str) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        record(&tx, id, actor, "workspace_deleted", None, None)?;
        tx.execute("DELETE FROM workspaces WHERE id = ?1", [id])?;
        Ok(tx.commit()?)
    }

    pub fn workspaces_of(&self, user: &str) -> Result<Vec<Workspace>> {
        let db = self.db()?;
        let mut q = db.prepare(
            "SELECT w.id, w.name, m.role FROM workspaces w JOIN members m ON m.workspace = w.id
             WHERE m.user = ?1 ORDER BY w.name",
        )?;
        let rows = q.query_map([user], |r| {
            Ok(Workspace {
                id: r.get(0)?,
                name: r.get(1)?,
                role: role_of(r.get(2)?),
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn role(&self, workspace: &str, user: &str) -> Result<Option<Role>> {
        let db = self.db()?;
        let role: Option<String> = db
            .query_row(
                "SELECT role FROM members WHERE workspace = ?1 AND user = ?2",
                params![workspace, user],
                |r| r.get(0),
            )
            .optional()?;
        Ok(role.map(role_of))
    }

    pub fn members(&self, workspace: &str) -> Result<Vec<Member>> {
        let db = self.db()?;
        let mut q = db.prepare(
            "SELECT user, email, role, joined_at FROM members WHERE workspace = ?1
             ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, email",
        )?;
        let rows = q.query_map([workspace], |r| {
            Ok(Member {
                user: r.get(0)?,
                email: r.get(1)?,
                role: role_of(r.get(2)?),
                joined_at: r.get(3)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Give a member another role. The last owner cannot be made anything less.
    pub fn set_role(&self, workspace: &str, user: &str, role: Role, actor: &str) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let current = role_in(&tx, workspace, user)?.ok_or(Error::NotFound("member"))?;
        if current == role {
            return Ok(());
        }
        if current == Role::Owner && owners(&tx, workspace)? == 1 {
            return Err(Error::BadRequest(LAST_OWNER.into()));
        }
        tx.execute(
            "UPDATE members SET role = ?3 WHERE workspace = ?1 AND user = ?2",
            params![workspace, user, role.name()],
        )?;
        let detail = format!("{} to {}", current.name(), role.name());
        record(
            &tx,
            workspace,
            actor,
            "role_changed",
            Some(user),
            Some(&detail),
        )?;
        Ok(tx.commit()?)
    }

    /// Take a member out of a workspace: an owner removing them, or the member leaving.
    pub fn remove_member(&self, workspace: &str, user: &str, actor: &str) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let current = role_in(&tx, workspace, user)?.ok_or(Error::NotFound("member"))?;
        if current == Role::Owner && owners(&tx, workspace)? == 1 {
            return Err(Error::BadRequest(LAST_OWNER.into()));
        }
        tx.execute(
            "DELETE FROM members WHERE workspace = ?1 AND user = ?2",
            params![workspace, user],
        )?;
        let action = if actor == user {
            "member_left"
        } else {
            "member_removed"
        };
        record(&tx, workspace, actor, action, Some(user), None)?;
        Ok(tx.commit()?)
    }

    /// Make an invite that works once, until `expires_at`.
    pub fn create_invite(
        &self,
        code: &str,
        workspace: &str,
        role: Role,
        by: &str,
        expires_at: i64,
    ) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let pending: i64 = tx.query_row(
            "SELECT COUNT(*) FROM invites WHERE workspace = ?1 AND used_by IS NULL AND revoked = 0 AND expires_at > ?2",
            params![workspace, now()],
            |r| r.get(0),
        )?;
        if pending >= MAX_PENDING_INVITES {
            return Err(Error::BadRequest(
                "this workspace has too many unused invites; cancel some first".into(),
            ));
        }
        tx.execute(
            "INSERT INTO invites (code, workspace, role, created_by, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![code, workspace, role.name(), by, now(), expires_at],
        )?;
        record(
            &tx,
            workspace,
            by,
            "invite_created",
            Some(role.name()),
            None,
        )?;
        Ok(tx.commit()?)
    }

    /// The invites that could still be used.
    pub fn invites(&self, workspace: &str) -> Result<Vec<Invite>> {
        let db = self.db()?;
        let mut q = db.prepare(
            "SELECT code, role, created_by, expires_at FROM invites
             WHERE workspace = ?1 AND used_by IS NULL AND revoked = 0 AND expires_at > ?2 ORDER BY created_at",
        )?;
        let rows = q.query_map(params![workspace, now()], |r| {
            Ok(Invite {
                code: r.get(0)?,
                role: role_of(r.get(1)?),
                created_by: r.get(2)?,
                expires_at: r.get(3)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Cancel an invite nobody has used.
    pub fn revoke_invite(&self, workspace: &str, code: &str, actor: &str) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let changed = tx.execute(
            "UPDATE invites SET revoked = 1 WHERE workspace = ?1 AND code = ?2 AND used_by IS NULL AND revoked = 0",
            params![workspace, code],
        )?;
        if changed == 0 {
            return Err(Error::NotFound("invite"));
        }
        record(&tx, workspace, actor, "invite_cancelled", None, None)?;
        Ok(tx.commit()?)
    }

    /// Use an invite once. Someone already in the workspace keeps their role. An invite that
    /// was used, cancelled or has run out looks exactly like one that never existed.
    pub fn accept_invite(&self, code: &str, user: &str, email: Option<&str>) -> Result<String> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let found: Option<(String, String)> = tx
            .query_row(
                "SELECT workspace, role FROM invites
                 WHERE code = ?1 AND used_by IS NULL AND revoked = 0 AND expires_at > ?2",
                params![code, now()],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let (workspace, role) = found.ok_or(Error::NotFound("invite"))?;
        tx.execute(
            "INSERT INTO members (workspace, user, email, role, joined_at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (workspace, user) DO NOTHING",
            params![workspace, user, email, role, now()],
        )?;
        tx.execute(
            "UPDATE invites SET used_by = ?2, used_at = ?3 WHERE code = ?1",
            params![code, user, now()],
        )?;
        record(&tx, &workspace, user, "invite_accepted", Some(&role), None)?;
        tx.commit()?;
        Ok(workspace)
    }

    /// The most recent changes to who may do what, newest first.
    pub fn audit(&self, workspace: &str, limit: i64) -> Result<Vec<Entry>> {
        let db = self.db()?;
        let mut q = db.prepare(
            "SELECT at, actor, action, subject, detail FROM audit WHERE workspace = ?1 ORDER BY id DESC LIMIT ?2",
        )?;
        let rows = q.query_map(params![workspace, limit], |r| {
            Ok(Entry {
                at: r.get(0)?,
                actor: r.get(1)?,
                action: r.get(2)?,
                subject: r.get(3)?,
                detail: r.get(4)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Append one edit to the log, noting who made it, and return its position.
    pub fn append(&self, workspace: &str, doc: &str, data: &[u8], user: &str) -> Result<i64> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        tx.execute(
            "INSERT INTO updates (workspace, doc, data, user, at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![workspace, doc, data, user, now()],
        )?;
        let seq = tx.last_insert_rowid();
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM updates WHERE workspace = ?1 AND doc = ?2",
            params![workspace, doc],
            |r| r.get(0),
        )?;
        if count > COMPACT_AFTER {
            // Fold everything before this edit into one row. It takes the
            // highest old position, so nobody who is behind can miss it. The
            // folded row is many people's work, so it names nobody.
            let old: Vec<(i64, Vec<u8>)> = {
                let mut q = tx.prepare("SELECT seq, data FROM updates WHERE workspace = ?1 AND doc = ?2 AND seq < ?3 ORDER BY seq")?;
                let rows =
                    q.query_map(params![workspace, doc, seq], |r| Ok((r.get(0)?, r.get(1)?)))?;
                rows.collect::<rusqlite::Result<_>>()?
            };
            if let Some(&(last, _)) = old.last() {
                let parts: Vec<&[u8]> = old.iter().map(|(_, d)| d.as_slice()).collect();
                let merged =
                    yrs::merge_updates_v1(&parts).map_err(|e| Error::Internal(e.to_string()))?;
                tx.execute(
                    "DELETE FROM updates WHERE workspace = ?1 AND doc = ?2 AND seq < ?3",
                    params![workspace, doc, seq],
                )?;
                tx.execute(
                    "INSERT INTO updates (seq, workspace, doc, data, user, at) VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
                    params![last, workspace, doc, merged, now()],
                )?;
            }
        }
        tx.commit()?;
        Ok(seq)
    }

    /// Keep an attachment's bytes under their hash, unless that would take the workspace past
    /// `room` bytes in all. Storing the same bytes twice is a no-op.
    pub fn put_blob(
        &self,
        workspace: &str,
        hash: &str,
        data: &[u8],
        user: &str,
        room: u64,
    ) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let held = tx
            .query_row(
                "SELECT 1 FROM blobs WHERE workspace = ?1 AND hash = ?2",
                params![workspace, hash],
                |_| Ok(()),
            )
            .optional()?
            .is_some();
        if held {
            return Ok(());
        }
        let used: i64 = tx.query_row(
            "SELECT COALESCE(SUM(size), 0) FROM blobs WHERE workspace = ?1",
            [workspace],
            |r| r.get(0),
        )?;
        if used as u64 + data.len() as u64 > room {
            return Err(Error::BadRequest(
                "this workspace's attachment storage is full".into(),
            ));
        }
        tx.execute(
            "INSERT INTO blobs (workspace, hash, data, size, user, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![workspace, hash, data, data.len() as i64, user, now()],
        )?;
        Ok(tx.commit()?)
    }

    pub fn blob(&self, workspace: &str, hash: &str) -> Result<Option<Vec<u8>>> {
        Ok(self
            .db()?
            .query_row(
                "SELECT data FROM blobs WHERE workspace = ?1 AND hash = ?2",
                params![workspace, hash],
                |r| r.get(0),
            )
            .optional()?)
    }

    /// Every edit after `since`, oldest first, and the newest position.
    pub fn since(&self, workspace: &str, since: i64) -> Result<(Vec<Stored>, i64)> {
        use base64::Engine;
        let db = self.db()?;
        let mut q = db.prepare(
            "SELECT doc, seq, data FROM updates WHERE workspace = ?1 AND seq > ?2 ORDER BY seq",
        )?;
        let rows = q.query_map(params![workspace, since], |r| {
            let data: Vec<u8> = r.get(2)?;
            Ok(Stored {
                doc: r.get(0)?,
                seq: r.get(1)?,
                data: base64::engine::general_purpose::STANDARD.encode(data),
            })
        })?;
        let items: Vec<Stored> = rows.collect::<rusqlite::Result<_>>()?;
        let head = items.last().map(|i| i.seq).unwrap_or(since);
        Ok((items, head))
    }
}

/// Facts pushed by a team's own systems, held until a device writes them into notes.
impl Store {
    pub fn create_key(&self, workspace: &str, id: &str, hash: &str, label: &str, by: &str) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let live: i64 = tx.query_row(
            "SELECT COUNT(*) FROM ingest_keys WHERE workspace = ?1 AND revoked = 0",
            [workspace],
            |r| r.get(0),
        )?;
        if live >= MAX_KEYS {
            return Err(Error::BadRequest(
                "this workspace has too many keys; remove one first".into(),
            ));
        }
        tx.execute(
            "INSERT INTO ingest_keys (id, workspace, hash, label, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, workspace, hash, label, by, now()],
        )?;
        record(&tx, workspace, by, "key_created", Some(id), Some(label))?;
        Ok(tx.commit()?)
    }

    pub fn keys(&self, workspace: &str) -> Result<Vec<Key>> {
        let db = self.db()?;
        let mut q = db.prepare(
            "SELECT id, label, created_by, created_at, last_used FROM ingest_keys WHERE workspace = ?1 AND revoked = 0 ORDER BY created_at",
        )?;
        let keys = q
            .query_map([workspace], |r| {
                Ok(Key {
                    id: r.get(0)?,
                    label: r.get(1)?,
                    created_by: r.get(2)?,
                    created_at: r.get(3)?,
                    last_used: r.get(4)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(keys)
    }

    pub fn revoke_key(&self, workspace: &str, id: &str, actor: &str) -> Result<()> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let changed = tx.execute(
            "UPDATE ingest_keys SET revoked = 1 WHERE workspace = ?1 AND id = ?2 AND revoked = 0",
            params![workspace, id],
        )?;
        if changed == 0 {
            return Err(Error::NotFound("key"));
        }
        record(&tx, workspace, actor, "key_removed", Some(id), None)?;
        Ok(tx.commit()?)
    }

    /// The workspace a key pushes into, if the key is live. Notes that it was used.
    pub fn key_workspace(&self, hash: &str) -> Result<Option<String>> {
        let db = self.db()?;
        let workspace: Option<String> = db
            .query_row(
                "SELECT workspace FROM ingest_keys WHERE hash = ?1 AND revoked = 0",
                [hash],
                |r| r.get(0),
            )
            .optional()?;
        if workspace.is_some() {
            db.execute(
                "UPDATE ingest_keys SET last_used = ?2 WHERE hash = ?1",
                params![hash, now()],
            )?;
        }
        Ok(workspace)
    }

    /// Keep facts until a device writes them. All of them are kept, or none.
    pub fn push_inbox(&self, workspace: &str, bodies: &[String]) -> Result<usize> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let waiting: i64 = tx.query_row(
            "SELECT COUNT(*) FROM inbox WHERE workspace = ?1",
            [workspace],
            |r| r.get(0),
        )?;
        if waiting + bodies.len() as i64 > MAX_WAITING_FACTS {
            return Err(Error::BadRequest(
                "too many facts are waiting to be written; open Lokus on a computer in this workspace so it can catch up".into(),
            ));
        }
        for body in bodies {
            tx.execute(
                "INSERT INTO inbox (workspace, body, at) VALUES (?1, ?2, ?3)",
                params![workspace, body, now()],
            )?;
        }
        tx.commit()?;
        Ok(bodies.len())
    }

    /// Hand the oldest waiting facts to one device. A fact a device took and never finished
    /// is handed out again after a while, so one that crashed does not strand it.
    pub fn claim_inbox(&self, workspace: &str, device: &str, limit: i64) -> Result<Vec<(i64, String)>> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let stale = now() - CLAIM_SECONDS;
        let taken: Vec<(i64, String)> = {
            let mut q = tx.prepare(
                "SELECT seq, body FROM inbox WHERE workspace = ?1
                 AND (claimed_by IS NULL OR claimed_by = ?2 OR claimed_at < ?3) ORDER BY seq LIMIT ?4",
            )?;
            let rows = q.query_map(params![workspace, device, stale, limit], |r| Ok((r.get(0)?, r.get(1)?)))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        for (seq, _) in &taken {
            tx.execute(
                "UPDATE inbox SET claimed_by = ?2, claimed_at = ?3 WHERE seq = ?1",
                params![seq, device, now()],
            )?;
        }
        tx.commit()?;
        Ok(taken)
    }

    /// A device has written these facts into notes: forget them.
    pub fn ack_inbox(&self, workspace: &str, device: &str, seqs: &[i64]) -> Result<usize> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let mut done = 0;
        for seq in seqs {
            done += tx.execute(
                "DELETE FROM inbox WHERE seq = ?1 AND workspace = ?2 AND claimed_by = ?3",
                params![seq, workspace, device],
            )?;
        }
        tx.commit()?;
        Ok(done)
    }
}

/// One build of the app that computers of one platform can update to.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Release {
    pub version: String,
    pub platform: String,
    pub url: String,
    pub signature: String,
    pub at: i64,
    pub pulled: bool,
}

/// The app's own releases and news: the same for every workspace, read by every copy of the app.
impl Store {
    pub fn put_release(&self, version: &str, platform: &str, url: &str, signature: &str) -> Result<()> {
        self.db()?.execute(
            "INSERT INTO app_releases (version, platform, url, signature, at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (version, platform) DO UPDATE SET url = ?3, signature = ?4, pulled = 0",
            params![version, platform, url, signature, now()],
        )?;
        Ok(())
    }

    /// Stop offering a version. Says how many builds that took back.
    pub fn pull_release(&self, version: &str) -> Result<usize> {
        Ok(self.db()?.execute(
            "UPDATE app_releases SET pulled = 1 WHERE version = ?1 AND pulled = 0",
            [version],
        )?)
    }

    pub fn releases(&self) -> Result<Vec<Release>> {
        let db = self.db()?;
        let mut q = db.prepare("SELECT version, platform, url, signature, at, pulled FROM app_releases")?;
        let all = q
            .query_map([], |r| {
                Ok(Release {
                    version: r.get(0)?,
                    platform: r.get(1)?,
                    url: r.get(2)?,
                    signature: r.get(3)?,
                    at: r.get(4)?,
                    pulled: r.get::<_, i64>(5)? != 0,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(all)
    }

    pub fn put_news(&self, id: &str, body: &str, at: i64) -> Result<()> {
        self.db()?.execute(
            "INSERT INTO app_news (id, body, at) VALUES (?1, ?2, ?3)
             ON CONFLICT (id) DO UPDATE SET body = ?2, at = ?3",
            params![id, body, at],
        )?;
        Ok(())
    }

    /// When a post first went out, if it has.
    pub fn news_at(&self, id: &str) -> Result<Option<i64>> {
        Ok(self
            .db()?
            .query_row("SELECT at FROM app_news WHERE id = ?1", [id], |r| r.get(0))
            .optional()?)
    }

    pub fn drop_news(&self, id: &str) -> Result<usize> {
        Ok(self.db()?.execute("DELETE FROM app_news WHERE id = ?1", [id])?)
    }

    /// The newest posts, newest first, each as the JSON it was published as.
    pub fn news(&self, limit: i64) -> Result<Vec<String>> {
        let db = self.db()?;
        let mut q = db.prepare("SELECT body FROM app_news ORDER BY at DESC, id DESC LIMIT ?1")?;
        let all = q.query_map([limit], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
        Ok(all)
    }
}
