//! @part-of server
//! Everything the relay keeps: workspaces, members, invites and the update log.
//! One SQLite file, so the relay is a single binary anyone can run.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::{Error, Result};

/// Once a note has this many stored edits they are merged into one.
const COMPACT_AFTER: i64 = 200;

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

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let db = Connection::open(path)?;
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_by TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS members (workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 user TEXT NOT NULL, email TEXT, role TEXT NOT NULL, PRIMARY KEY (workspace, user));
             CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY,
                 workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 role TEXT NOT NULL, created_by TEXT NOT NULL, used_by TEXT);
             CREATE TABLE IF NOT EXISTS updates (seq INTEGER PRIMARY KEY AUTOINCREMENT,
                 workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                 doc TEXT NOT NULL, data BLOB NOT NULL);
             CREATE INDEX IF NOT EXISTS updates_by_doc ON updates (workspace, doc, seq);",
        )?;
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
        tx.execute(
            "INSERT INTO workspaces (id, name, created_by) VALUES (?1, ?2, ?3)",
            params![id, name, user],
        )?;
        tx.execute(
            "INSERT INTO members (workspace, user, email, role) VALUES (?1, ?2, ?3, 'owner')",
            params![id, user, email],
        )?;
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
            "SELECT user, email, role FROM members WHERE workspace = ?1 ORDER BY role, email",
        )?;
        let rows = q.query_map([workspace], |r| {
            Ok(Member {
                user: r.get(0)?,
                email: r.get(1)?,
                role: role_of(r.get(2)?),
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn create_invite(&self, code: &str, workspace: &str, role: Role, by: &str) -> Result<()> {
        self.db()?.execute(
            "INSERT INTO invites (code, workspace, role, created_by) VALUES (?1, ?2, ?3, ?4)",
            params![code, workspace, role.name(), by],
        )?;
        Ok(())
    }

    /// Use an invite once. Someone already in the workspace keeps their role.
    pub fn accept_invite(&self, code: &str, user: &str, email: Option<&str>) -> Result<String> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        let found: Option<(String, String)> = tx
            .query_row(
                "SELECT workspace, role FROM invites WHERE code = ?1 AND used_by IS NULL",
                [code],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let (workspace, role) = found.ok_or(Error::NotFound("invite"))?;
        tx.execute(
            "INSERT INTO members (workspace, user, email, role) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (workspace, user) DO NOTHING",
            params![workspace, user, email, role],
        )?;
        tx.execute(
            "UPDATE invites SET used_by = ?2 WHERE code = ?1",
            params![code, user],
        )?;
        tx.commit()?;
        Ok(workspace)
    }

    /// Append one edit to the log and return its position.
    pub fn append(&self, workspace: &str, doc: &str, data: &[u8]) -> Result<i64> {
        let mut db = self.db()?;
        let tx = db.transaction()?;
        tx.execute(
            "INSERT INTO updates (workspace, doc, data) VALUES (?1, ?2, ?3)",
            params![workspace, doc, data],
        )?;
        let seq = tx.last_insert_rowid();
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM updates WHERE workspace = ?1 AND doc = ?2",
            params![workspace, doc],
            |r| r.get(0),
        )?;
        if count > COMPACT_AFTER {
            // Fold everything before this edit into one row. It takes the
            // highest old position, so nobody who is behind can miss it.
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
                    "INSERT INTO updates (seq, workspace, doc, data) VALUES (?1, ?2, ?3, ?4)",
                    params![last, workspace, doc, merged],
                )?;
            }
        }
        tx.commit()?;
        Ok(seq)
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
