//! @part-of calendar
//! The local copy: accounts, calendars, the events last heard from each provider, changes held
//! until "Send update", and changes waiting to be sent. One SQLite file beside the app's other
//! settings, per person and not in any folder. Deleting it loses nothing the providers have:
//! only what was typed offline and never sent.

use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::model::{now, stamp, Account, Calendar, Event, Provider, Result};

pub const FILE: &str = "calendar.sqlite";

pub struct Store {
    db: Connection,
}

/// A change held back because the event has guests: what it will look like, and which fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Held {
    pub event: Event,
    pub changed: Vec<String>,
    /// `this` or `all`, for a repeating event.
    #[serde(default)]
    pub scope: String,
}

/// A change on its way to a provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Queued {
    pub n: i64,
    pub account: String,
    pub key: String,
    /// `create`, `update`, `delete` or `reply`.
    pub op: String,
    pub body: Value,
    pub notify: bool,
    pub error: Option<String>,
}

pub fn path(dir: &Path) -> PathBuf {
    dir.join(FILE)
}

impl Store {
    /// Whether anything was ever connected: one look at the disk, nothing opened.
    pub fn exists(dir: &Path) -> bool {
        path(dir).is_file()
    }

    pub fn open(dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(dir)?;
        let db = Connection::open(path(dir))?;
        db.busy_timeout(std::time::Duration::from_secs(5))?;
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, provider TEXT, email TEXT, name TEXT);
             CREATE TABLE IF NOT EXISTS calendars (account TEXT, id TEXT, name TEXT, color TEXT, hidden INTEGER DEFAULT 0,
               is_primary INTEGER DEFAULT 0, position TEXT, read_from TEXT, PRIMARY KEY (account, id));
             CREATE TABLE IF NOT EXISTS events (key TEXT PRIMARY KEY, account TEXT, calendar TEXT, start TEXT, end TEXT, json TEXT);
             CREATE INDEX IF NOT EXISTS events_by_time ON events (start, end);
             CREATE TABLE IF NOT EXISTS held (key TEXT PRIMARY KEY, json TEXT);
             CREATE TABLE IF NOT EXISTS sending (n INTEGER PRIMARY KEY, at TEXT);
             CREATE TABLE IF NOT EXISTS tried (n INTEGER PRIMARY KEY);
             CREATE TABLE IF NOT EXISTS outbox (n INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT, key TEXT, op TEXT, body TEXT,
               notify INTEGER, error TEXT, made TEXT);
             CREATE TABLE IF NOT EXISTS made (id TEXT PRIMARY KEY, key TEXT, at TEXT);
             CREATE TABLE IF NOT EXISTS notes (key TEXT PRIMARY KEY, folder TEXT, path TEXT);
             CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT);",
        )?;
        // Events read before each carried its invitation id are read once more, in full.
        db.execute_batch(
            "UPDATE calendars SET position = NULL WHERE NOT EXISTS (SELECT 1 FROM settings WHERE name = 'uids');
             INSERT OR IGNORE INTO settings (name, value) VALUES ('uids', '1');",
        )?;
        Ok(Self { db })
    }

    // ---- accounts and calendars ----

    pub fn accounts(&self) -> Result<Vec<Account>> {
        let mut q = self
            .db
            .prepare("SELECT id, provider, email, name FROM accounts ORDER BY rowid")?;
        let rows = q.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (id, provider, email, name) = row?;
            out.push(Account {
                id,
                provider: Provider::from_id(&provider)?,
                email,
                name,
            });
        }
        Ok(out)
    }

    pub fn account(&self, id: &str) -> Result<Account> {
        self.accounts()?
            .into_iter()
            .find(|a| a.id == id)
            .ok_or_else(|| {
                crate::model::CalError::new("no_account", format!("no calendar account '{id}'"))
            })
    }

    pub fn add_account(&self, account: &Account) -> Result<()> {
        self.db.execute(
            "INSERT INTO accounts (id, provider, email, name) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (id) DO UPDATE SET name = ?4",
            params![
                account.id,
                account.provider.id(),
                account.email,
                account.name
            ],
        )?;
        Ok(())
    }

    /// Everything of one account: its calendars, events, held and waiting changes.
    pub fn remove_account(&self, id: &str) -> Result<()> {
        for table in ["calendars", "events", "outbox"] {
            self.db
                .execute(&format!("DELETE FROM {table} WHERE account = ?1"), [id])?;
        }
        // By the start of the key, not LIKE: an address has `_` in it, which LIKE reads as any letter.
        let start = format!("{id}|");
        for table in ["held", "notes"] {
            self.db.execute(
                &format!("DELETE FROM {table} WHERE substr(key, 1, ?2) = ?1"),
                params![start, start.chars().count() as i64],
            )?;
        }
        self.db.execute(
            "DELETE FROM sending WHERE n NOT IN (SELECT n FROM outbox)",
            [],
        )?;
        self.db
            .execute("DELETE FROM accounts WHERE id = ?1", [id])?;
        if self
            .setting("default")?
            .is_some_and(|d| d.starts_with(&format!("{id}|")))
        {
            self.db
                .execute("DELETE FROM settings WHERE name = 'default'", [])?;
        }
        Ok(())
    }

    pub fn calendars(&self) -> Result<Vec<Calendar>> {
        let default = self.default_calendar()?;
        let mut q = self.db.prepare(
            "SELECT c.account, c.id, c.name, c.color, c.hidden, c.is_primary FROM calendars c
             JOIN accounts a ON a.id = c.account ORDER BY a.rowid, c.is_primary DESC, c.name",
        )?;
        let rows = q.query_map([], |r| {
            Ok(Calendar {
                account: r.get(0)?,
                id: r.get(1)?,
                name: r.get(2)?,
                color: r.get(3)?,
                hidden: r.get::<_, i64>(4)? != 0,
                primary: r.get::<_, i64>(5)? != 0,
                default: false,
            })
        })?;
        let mut out = rows.collect::<rusqlite::Result<Vec<_>>>()?;
        for c in &mut out {
            c.default = default
                .as_ref()
                .is_some_and(|(a, i)| *a == c.account && *i == c.id);
        }
        Ok(out)
    }

    /// What the provider lists now. Colour and hidden are the person's own once set here.
    pub fn keep_calendars(&self, account: &str, listed: &[Calendar]) -> Result<()> {
        for c in listed {
            self.db.execute(
                "INSERT INTO calendars (account, id, name, color, is_primary) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT (account, id) DO UPDATE SET name = ?3, is_primary = ?5",
                params![account, c.id, c.name, c.color, c.primary as i64],
            )?;
        }
        let known: Vec<String> = listed.iter().map(|c| c.id.clone()).collect();
        for old in self
            .calendars()?
            .into_iter()
            .filter(|c| c.account == account)
        {
            if !known.contains(&old.id) {
                self.db.execute(
                    "DELETE FROM calendars WHERE account = ?1 AND id = ?2",
                    params![account, old.id],
                )?;
                self.db.execute(
                    "DELETE FROM events WHERE account = ?1 AND calendar = ?2",
                    params![account, old.id],
                )?;
            }
        }
        Ok(())
    }

    pub fn set_calendar(
        &self,
        account: &str,
        id: &str,
        hidden: Option<bool>,
        color: Option<&str>,
    ) -> Result<()> {
        if let Some(hidden) = hidden {
            self.db.execute(
                "UPDATE calendars SET hidden = ?3 WHERE account = ?1 AND id = ?2",
                params![account, id, hidden as i64],
            )?;
        }
        if let Some(color) = color {
            self.db.execute(
                "UPDATE calendars SET color = ?3 WHERE account = ?1 AND id = ?2",
                params![account, id, color],
            )?;
        }
        Ok(())
    }

    /// Where new events go: the one chosen, or the first account's main calendar.
    pub fn default_calendar(&self) -> Result<Option<(String, String)>> {
        if let Some(chosen) = self.setting("default")? {
            if let Some((account, id)) = chosen.split_once('|') {
                return Ok(Some((account.to_string(), id.to_string())));
            }
        }
        Ok(self
            .db
            .query_row(
                "SELECT c.account, c.id FROM calendars c JOIN accounts a ON a.id = c.account
                 ORDER BY a.rowid, c.is_primary DESC LIMIT 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?)
    }

    /// How far a calendar has been read: the provider's own marker and the first day asked for.
    pub fn position(&self, account: &str, id: &str) -> Result<(Option<String>, Option<String>)> {
        Ok(self
            .db
            .query_row(
                "SELECT position, read_from FROM calendars WHERE account = ?1 AND id = ?2",
                params![account, id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?
            .unwrap_or((None, None)))
    }

    pub fn set_position(
        &self,
        account: &str,
        id: &str,
        position: Option<&str>,
        from: &str,
    ) -> Result<()> {
        self.db.execute(
            "UPDATE calendars SET position = ?3, read_from = ?4 WHERE account = ?1 AND id = ?2",
            params![account, id, position, from],
        )?;
        Ok(())
    }

    pub fn setting(&self, name: &str) -> Result<Option<String>> {
        Ok(self
            .db
            .query_row("SELECT value FROM settings WHERE name = ?1", [name], |r| {
                r.get(0)
            })
            .optional()?)
    }

    pub fn set_setting(&self, name: &str, value: &str) -> Result<()> {
        self.db.execute(
            "INSERT INTO settings (name, value) VALUES (?1, ?2) ON CONFLICT (name) DO UPDATE SET value = ?2",
            params![name, value],
        )?;
        Ok(())
    }

    // ---- events ----

    pub fn put(&self, event: &Event) -> Result<()> {
        self.db.execute(
            "INSERT INTO events (key, account, calendar, start, end, json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT (key) DO UPDATE SET start = ?4, end = ?5, json = ?6",
            params![
                event.key,
                event.account,
                event.calendar,
                event.start,
                event.end,
                serde_json::to_string(event).unwrap_or_default()
            ],
        )?;
        Ok(())
    }

    pub fn drop_event(&self, key: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM events WHERE key = ?1", [key])?;
        Ok(())
    }

    pub fn clear_calendar(&self, account: &str, calendar: &str) -> Result<()> {
        self.db.execute(
            "DELETE FROM events WHERE account = ?1 AND calendar = ?2 AND key NOT IN (SELECT key FROM outbox)",
            params![account, calendar],
        )?;
        Ok(())
    }

    /// As last heard from the provider (or as made here, when it has not been sent yet).
    pub fn stored(&self, key: &str) -> Result<Option<Event>> {
        let json: Option<String> = self
            .db
            .query_row("SELECT json FROM events WHERE key = ?1", [key], |r| {
                r.get(0)
            })
            .optional()?;
        Ok(json.and_then(|j| serde_json::from_str(&j).ok()))
    }

    fn dress(&self, mut event: Event) -> Result<Event> {
        if let Some(held) = self.held(&event.key)? {
            let base = event;
            event = held.event;
            // What the provider said since is kept for everything the person did not change.
            // (A never-sent invitation has nothing at the provider to keep.)
            if !event.unsent && base.key == event.key {
                let was = |name: &str| !held.changed.iter().any(|c| c == name);
                if was("title") {
                    event.title = base.title;
                }
                if was("time") {
                    (event.start, event.end) = (base.start, base.end);
                    (event.all_day, event.zone) = (base.all_day, base.zone);
                }
                if was("location") {
                    event.location = base.location;
                }
                if was("description") {
                    event.description = base.description;
                }
                if was("guests") {
                    event.guests = base.guests;
                } else {
                    // The person's list, with each guest's answer as the provider has it now.
                    for g in &mut event.guests {
                        if let Some(b) = base.guests.iter().find(|b| b.email == g.email) {
                            g.reply.clone_from(&b.reply);
                        }
                    }
                }
                if was("meeting") {
                    event.meeting = base.meeting;
                }
                if was("repeat") {
                    event.repeat = base.repeat;
                }
            }
            event.pending = true;
            event.changes = held.changed;
        }
        let (waiting, error): (i64, Option<String>) = self.db.query_row(
            "SELECT COUNT(*), MAX(error) FROM outbox WHERE key = ?1",
            [&event.key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        event.queued = waiting > 0;
        event.error = error;
        event.note = self
            .db
            .query_row("SELECT path FROM notes WHERE key = ?1", [&event.key], |r| {
                r.get(0)
            })
            .optional()?;
        Ok(event)
    }

    /// One event as the person sees it: with changes that are held or still waiting.
    pub fn event(&self, key: &str) -> Result<Option<Event>> {
        match self.stored(key)? {
            Some(event) => Ok(Some(self.dress(event)?)),
            None => match self.held(key)? {
                Some(held) => Ok(Some(self.dress(held.event)?)),
                None => Ok(None),
            },
        }
    }

    /// Events that touch [from, to), from every calendar that is not hidden.
    pub fn events(&self, from: &str, to: &str, with_hidden: bool) -> Result<Vec<Event>> {
        let hidden: Vec<(String, String)> = self
            .calendars()?
            .into_iter()
            .filter(|c| c.hidden && !with_hidden)
            .map(|c| (c.account, c.id))
            .collect();
        let mut q = self
            .db
            .prepare("SELECT json FROM events WHERE start < ?2 AND end > ?1 ORDER BY start")?;
        let mut out: Vec<Event> = Vec::new();
        for json in q.query_map(params![from, to], |r| r.get::<_, String>(0))? {
            if let Ok(event) = serde_json::from_str::<Event>(&json?) {
                out.push(self.dress(event)?);
            }
        }
        // Never-sent invitations exist only as held changes, and a held move puts an event at a
        // time the provider's copy is not: both are found here, by the time the person sees.
        let mut q = self.db.prepare("SELECT json FROM held")?;
        for json in q.query_map([], |r| r.get::<_, String>(0))? {
            let Ok(held) = serde_json::from_str::<Held>(&json?) else {
                continue;
            };
            if out.iter().any(|e| e.key == held.event.key) {
                continue;
            }
            if let Some(event) = self.event(&held.event.key)? {
                out.push(event);
            }
        }
        out.retain(|e| {
            e.start.as_str() < to
                && e.end.as_str() > from
                && !hidden
                    .iter()
                    .any(|(a, c)| *a == e.account && *c == e.calendar)
        });
        out.sort_by(|a, b| a.start.cmp(&b.start));
        // One invitation reaching two connected accounts is one event: the organiser's copy is
        // the one shown, or else the first account's.
        let order: Vec<String> = self.accounts()?.into_iter().map(|a| a.id).collect();
        let rank = |e: &Event| (!e.mine, order.iter().position(|a| *a == e.account));
        let mut seen: Vec<usize> = Vec::new();
        for i in 0..out.len() {
            let twin = seen.iter().copied().find(|&j| {
                !out[i].uid.is_empty() && out[j].uid == out[i].uid && out[j].start == out[i].start
            });
            match twin {
                Some(j) if rank(&out[i]) < rank(&out[j]) => {
                    seen.retain(|&k| k != j);
                    seen.push(i);
                }
                Some(_) => {}
                None => seen.push(i),
            }
        }
        seen.sort_unstable();
        let mut at = 0;
        out.retain(|_| {
            at += 1;
            seen.binary_search(&(at - 1)).is_ok()
        });
        Ok(out)
    }

    pub fn drop_series(&self, account: &str, calendar: &str, series: &str) -> Result<()> {
        let mut q = self
            .db
            .prepare("SELECT key, json FROM events WHERE account = ?1 AND calendar = ?2")?;
        let rows: Vec<(String, String)> = q
            .query_map(params![account, calendar], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?;
        for (key, json) in rows {
            let same = serde_json::from_str::<Event>(&json)
                .is_ok_and(|e| e.series.as_deref() == Some(series) || e.id == series);
            if same {
                self.drop_event(&key)?;
            }
        }
        // Changes held on its occurrences go with it, or they would still show.
        let mut q = self.db.prepare("SELECT key, json FROM held")?;
        let held: Vec<(String, String)> = q
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?;
        for (key, json) in held {
            let same = serde_json::from_str::<Held>(&json).is_ok_and(|h| {
                (h.event.account.as_str(), h.event.calendar.as_str()) == (account, calendar)
                    && (h.event.series.as_deref() == Some(series) || h.event.id == series)
            });
            if same {
                self.release(&key)?;
            }
        }
        Ok(())
    }

    /// My answer to a series as a whole: the one most of its dates read so far carry. A date
    /// answered on its own keeps its own answer and does not change this.
    pub fn series_reply(&self, like: &Event) -> Result<String> {
        let mut counts: Vec<(String, usize)> = Vec::new();
        for e in self.series_dates(like)? {
            match counts.iter_mut().find(|(r, _)| *r == e.reply) {
                Some((_, n)) => *n += 1,
                None => counts.push((e.reply, 1)),
            }
        }
        Ok(counts
            .into_iter()
            .max_by_key(|(_, n)| *n)
            .map_or_else(|| like.reply.clone(), |(r, _)| r))
    }

    /// The series is answered: every date that carried the series' answer takes the new one.
    pub fn answer_series(&self, like: &Event, me: &str, answer: &str) -> Result<()> {
        let was = self.series_reply(like)?;
        for mut e in self.series_dates(like)? {
            if e.reply == was {
                e.reply = answer.to_string();
                for g in e
                    .guests
                    .iter_mut()
                    .filter(|g| g.email.eq_ignore_ascii_case(me))
                {
                    g.reply = answer.to_string();
                }
                self.put(&e)?;
            }
        }
        Ok(())
    }

    fn series_dates(&self, like: &Event) -> Result<Vec<Event>> {
        let mut q = self
            .db
            .prepare("SELECT json FROM events WHERE account = ?1 AND calendar = ?2")?;
        let all = q
            .query_map(params![like.account, like.calendar], |r| {
                r.get::<_, String>(0)
            })?
            .filter_map(|json| serde_json::from_str::<Event>(&json.ok()?).ok())
            .filter(|e| e.series.is_some() && e.series == like.series)
            .collect();
        Ok(all)
    }

    /// The first occurrence of a series, of those read so far.
    pub fn first_of(&self, account: &str, calendar: &str, series: &str) -> Result<Option<String>> {
        let mut q = self.db.prepare(
            "SELECT json FROM events WHERE account = ?1 AND calendar = ?2 ORDER BY start",
        )?;
        for json in q.query_map(params![account, calendar], |r| r.get::<_, String>(0))? {
            if let Ok(e) = serde_json::from_str::<Event>(&json?) {
                if e.series.as_deref() == Some(series) {
                    return Ok(Some(e.key));
                }
            }
        }
        Ok(None)
    }

    // ---- held changes ----

    pub fn held(&self, key: &str) -> Result<Option<Held>> {
        let json: Option<String> = self
            .db
            .query_row("SELECT json FROM held WHERE key = ?1", [key], |r| r.get(0))
            .optional()?;
        Ok(json.and_then(|j| serde_json::from_str(&j).ok()))
    }

    pub fn hold(&self, held: &Held) -> Result<()> {
        self.db.execute(
            "INSERT INTO held (key, json) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET json = ?2",
            params![held.event.key, serde_json::to_string(held).unwrap_or_default()],
        )?;
        Ok(())
    }

    /// Whether there was something held: of two that send the same held change at once, only
    /// the one that releases it sends it.
    pub fn release(&self, key: &str) -> Result<bool> {
        Ok(self.db.execute("DELETE FROM held WHERE key = ?1", [key])? > 0)
    }

    // ---- changes waiting to be sent ----

    pub fn queue(
        &self,
        account: &str,
        key: &str,
        op: &str,
        body: &Value,
        notify: bool,
    ) -> Result<()> {
        // One delete of an event waits at a time, and a reply is not added when the last one waiting
        // is the same: asked for three times at once it is still one request and one email, and
        // yes, no, yes still ends in yes.
        self.db.execute(
            "INSERT INTO outbox (account, key, op, body, notify, made) SELECT ?1, ?2, ?3, ?4, ?5, ?6
             WHERE ?3 NOT IN ('delete', 'reply') OR NOT EXISTS (SELECT 1 FROM outbox o WHERE key = ?2 AND op = ?3
               AND error IS NULL AND (op = 'delete' OR (json_extract(body, '$.answer') = json_extract(?4, '$.answer')
                 AND json_extract(body, '$.scope') = json_extract(?4, '$.scope')
                 AND n = (SELECT MAX(n) FROM outbox WHERE key = o.key AND op = 'reply' AND error IS NULL))))",
            params![account, key, op, body.to_string(), notify as i64, now()],
        )?;
        Ok(())
    }

    /// A change that was handed to the provider before, whose answer never came: it may have
    /// been acted on.
    pub fn tried(&self, n: i64) -> Result<bool> {
        let tried: i64 =
            self.db
                .query_row("SELECT COUNT(*) FROM tried WHERE n = ?1", [n], |r| r.get(0))?;
        Ok(tried > 0)
    }

    pub fn set_tried(&self, n: i64) -> Result<()> {
        self.db
            .execute("INSERT OR IGNORE INTO tried (n) VALUES (?1)", [n])?;
        Ok(())
    }

    pub fn set_body(&self, n: i64, body: &Value) -> Result<()> {
        self.db.execute(
            "UPDATE outbox SET body = ?2 WHERE n = ?1",
            params![n, body.to_string()],
        )?;
        Ok(())
    }

    pub fn waiting(&self) -> Result<Vec<Queued>> {
        let mut q = self
            .db
            .prepare("SELECT n, account, key, op, body, notify, error FROM outbox ORDER BY n")?;
        let rows = q.query_map([], |r| {
            Ok(Queued {
                n: r.get(0)?,
                account: r.get(1)?,
                key: r.get(2)?,
                op: r.get(3)?,
                body: serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or(Value::Null),
                notify: r.get::<_, i64>(5)? != 0,
                error: r.get(6)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Take a waiting change to send it. The app and the command line share this file, and each
    /// sends what waits: only the one that takes a change sends it, so it reaches the provider
    /// once. A change taken by something that then died is free again after five minutes.
    pub fn take(&self, n: i64) -> Result<bool> {
        let stale = stamp(chrono::Utc::now() - chrono::Duration::minutes(5));
        self.db
            .execute("DELETE FROM sending WHERE at < ?1", [stale])?;
        let taken = self.db.execute(
            "INSERT OR IGNORE INTO sending (n, at) SELECT n, ?2 FROM outbox WHERE n = ?1",
            params![n, now()],
        )?;
        Ok(taken == 1)
    }

    /// The account signed in again: what was refused while it could not is tried again.
    pub fn retry(&self, account: &str) -> Result<()> {
        self.db.execute(
            "UPDATE outbox SET error = NULL WHERE account = ?1",
            [account],
        )?;
        Ok(())
    }

    /// Something is sending a change to this event right now.
    pub fn taking(&self, key: &str) -> Result<bool> {
        let n: i64 = self.db.query_row(
            "SELECT COUNT(*) FROM sending s JOIN outbox o ON o.n = s.n WHERE o.key = ?1",
            [key],
            |r| r.get(0),
        )?;
        Ok(n > 0)
    }

    /// Put a taken change back: it could not be sent now.
    pub fn untake(&self, n: i64) -> Result<()> {
        self.db.execute("DELETE FROM sending WHERE n = ?1", [n])?;
        Ok(())
    }

    pub fn sent(&self, n: i64) -> Result<()> {
        self.db.execute("DELETE FROM outbox WHERE n = ?1", [n])?;
        self.db.execute("DELETE FROM tried WHERE n = ?1", [n])?;
        self.untake(n)
    }

    pub fn refused(&self, n: i64, why: &str) -> Result<()> {
        self.db
            .execute("UPDATE outbox SET error = ?2 WHERE n = ?1", params![n, why])?;
        self.untake(n)
    }

    /// The event already made from a draft with this id, if any: making it again is the same event.
    pub fn made(&self, id: &str) -> Result<Option<String>> {
        Ok(self
            .db
            .query_row("SELECT key FROM made WHERE id = ?1", [id], |r| r.get(0))
            .optional()?)
    }

    pub fn keep_made(&self, id: &str, key: &str) -> Result<()> {
        let old = stamp(chrono::Utc::now() - chrono::Duration::days(7));
        self.db.execute("DELETE FROM made WHERE at < ?1", [old])?;
        self.db.execute(
            "INSERT OR REPLACE INTO made (id, key, at) VALUES (?1, ?2, ?3)",
            params![id, key, now()],
        )?;
        Ok(())
    }

    /// Try a refused change to this event again.
    pub fn retry_event(&self, key: &str) -> Result<()> {
        self.db
            .execute("UPDATE outbox SET error = NULL WHERE key = ?1", [key])?;
        Ok(())
    }

    /// Give up what was refused for this event, and what waits behind it. True if there was any.
    pub fn is_refused(&self, key: &str) -> Result<bool> {
        let refused: i64 = self.db.query_row(
            "SELECT COUNT(*) FROM outbox WHERE key = ?1 AND error IS NOT NULL",
            [key],
            |r| r.get(0),
        )?;
        Ok(refused > 0)
    }

    pub fn drop_refused(&self, key: &str) -> Result<bool> {
        let refused = i64::from(self.is_refused(key)?);
        if refused > 0 {
            self.db
                .execute("DELETE FROM outbox WHERE key = ?1", [key])?;
        }
        Ok(refused > 0)
    }

    /// The provider gave a new event its own id: everything that named the local one follows.
    pub fn rename(&self, old: &str, new: &str) -> Result<()> {
        for table in ["outbox", "held", "notes", "made"] {
            self.db.execute(
                &format!("UPDATE OR REPLACE {table} SET key = ?2 WHERE key = ?1"),
                params![old, new],
            )?;
        }
        if let Some(mut held) = self.held(new)? {
            held.event.key = new.to_string();
            held.event.id = new.rsplit('|').next().unwrap_or_default().to_string();
            self.hold(&held)?;
        }
        self.drop_event(old)
    }

    // ---- meeting notes ----

    pub fn note(&self, key: &str, folder: &str) -> Result<Option<String>> {
        Ok(self
            .db
            .query_row(
                "SELECT path FROM notes WHERE key = ?1 AND folder = ?2",
                params![key, folder],
                |r| r.get(0),
            )
            .optional()?)
    }

    /// The events that have a note in this folder: a note in another folder is not this one's.
    pub fn noted(&self, folder: &str) -> Result<Vec<String>> {
        let mut q = self.db.prepare("SELECT key FROM notes WHERE folder = ?1")?;
        let keys = q
            .query_map([folder], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(keys)
    }

    pub fn forget_note(&self, key: &str) -> Result<()> {
        self.db.execute("DELETE FROM notes WHERE key = ?1", [key])?;
        Ok(())
    }

    pub fn keep_note(&self, key: &str, folder: &str, path: &str) -> Result<()> {
        self.db.execute(
            "INSERT INTO notes (key, folder, path) VALUES (?1, ?2, ?3)
             ON CONFLICT (key) DO UPDATE SET folder = ?2, path = ?3",
            params![key, folder, path],
        )?;
        Ok(())
    }
}
