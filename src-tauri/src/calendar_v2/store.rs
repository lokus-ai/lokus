//! CalendarStore — owns the SQLite connection on a dedicated thread.
//!
//! rusqlite is blocking and `Connection` is !Sync, so ALL access goes through
//! a single actor thread consuming closures from a channel. At this scale
//! (tens of thousands of rows, sub-ms indexed queries) one serialized
//! connection is faster than any pooling scheme and removes every locking
//! question. Async callers await a oneshot for the result.

use std::path::PathBuf;
use std::sync::mpsc;

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use super::expand::expand_event;
use super::models::{now_ms, Account, AlsoIn, CalendarRow, EventRow, OccurrenceView};
use super::schema;

type Job = Box<dyn FnOnce(&mut Connection) + Send>;

#[derive(Clone)]
pub struct CalendarStore {
    tx: mpsc::Sender<Job>,
}

/// Expansion horizon: ±12 months, re-anchored when the edge is <1 month away.
const HORIZON_BACK_MS: i64 = 365 * 86_400_000;
const HORIZON_FWD_MS: i64 = 365 * 86_400_000;

impl CalendarStore {
    /// Opens (creating if needed) the DB at `dir/calendar.db` and starts the
    /// writer thread. Fails fast on migration errors.
    pub fn open(dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&dir).map_err(|e| format!("create {dir:?}: {e}"))?;
        let path = dir.join("calendar.db");
        let mut conn = Connection::open(&path).map_err(|e| format!("open {path:?}: {e}"))?;
        conn.pragma_update(None, "journal_mode", "WAL").map_err(|e| e.to_string())?;
        conn.pragma_update(None, "synchronous", "NORMAL").map_err(|e| e.to_string())?;
        conn.pragma_update(None, "foreign_keys", "ON").map_err(|e| e.to_string())?;
        schema::apply_migrations(&mut conn)?;

        let (tx, rx) = mpsc::channel::<Job>();
        std::thread::Builder::new()
            .name("calendar-store".into())
            .spawn(move || {
                for job in rx {
                    job(&mut conn);
                }
            })
            .map_err(|e| e.to_string())?;

        Ok(Self { tx })
    }

    /// In-memory store for tests.
    #[cfg(test)]
    pub fn open_in_memory() -> Self {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        schema::apply_migrations(&mut conn).unwrap();
        let (tx, rx) = mpsc::channel::<Job>();
        std::thread::spawn(move || {
            for job in rx {
                job(&mut conn);
            }
        });
        Self { tx }
    }

    /// Run a closure on the store thread and await its result.
    pub async fn with<R, F>(&self, f: F) -> Result<R, String>
    where
        R: Send + 'static,
        F: FnOnce(&mut Connection) -> Result<R, String> + Send + 'static,
    {
        let (otx, orx) = tokio::sync::oneshot::channel();
        self.tx
            .send(Box::new(move |conn| {
                let _ = otx.send(f(conn));
            }))
            .map_err(|_| "calendar store thread is gone".to_string())?;
        orx.await.map_err(|_| "calendar store dropped result".to_string())?
    }

    /// Synchronous variant for non-async callsites (tests, migration).
    pub fn with_blocking<R, F>(&self, f: F) -> Result<R, String>
    where
        R: Send + 'static,
        F: FnOnce(&mut Connection) -> Result<R, String> + Send + 'static,
    {
        let (otx, orx) = mpsc::channel();
        self.tx
            .send(Box::new(move |conn| {
                let _ = otx.send(f(conn));
            }))
            .map_err(|_| "calendar store thread is gone".to_string())?;
        orx.recv().map_err(|_| "calendar store dropped result".to_string())?
    }
}

// ── Row mapping ─────────────────────────────────────────────────────────────

fn event_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<EventRow> {
    Ok(EventRow {
        id: row.get("id")?,
        calendar_id: row.get("calendar_id")?,
        provider_event_id: row.get("provider_event_id")?,
        ical_uid: row.get("ical_uid")?,
        recurrence_id: row.get("recurrence_id")?,
        master_event_id: row.get("master_event_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        location: row.get("location")?,
        start_ts: row.get("start_ts")?,
        end_ts: row.get("end_ts")?,
        start_date: row.get("start_date")?,
        end_date: row.get("end_date")?,
        start_tz: row.get("start_tz")?,
        all_day: row.get::<_, i64>("all_day")? != 0,
        status: row.get("status")?,
        transparency: row.get("transparency")?,
        rrule: row.get("rrule")?,
        rdate: row.get("rdate")?,
        exdate: row.get("exdate")?,
        organizer_email: row.get("organizer_email")?,
        organizer_is_self: row.get::<_, i64>("organizer_is_self")? != 0,
        attendees: row.get("attendees")?,
        html_link: row.get("html_link")?,
        color: row.get("color")?,
        etag: row.get("etag")?,
        provider_updated_at: row.get("provider_updated_at")?,
        fingerprint: row.get("fingerprint")?,
        pending: row.get::<_, i64>("pending")? != 0,
        deleted: row.get::<_, i64>("deleted")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        raw: None.or_else(|| row.get("raw").ok()),
    })
}

// ── Operations (free functions over &mut Connection, used via store.with) ──

pub fn upsert_account(conn: &mut Connection, acc: &Account) -> Result<(), String> {
    conn.execute(
        r#"INSERT INTO accounts (id, provider, label, identity, status, color, config, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
           ON CONFLICT(provider, identity) DO UPDATE SET
             label=excluded.label, status=excluded.status, color=excluded.color,
             config=excluded.config, updated_at=excluded.updated_at"#,
        params![
            acc.id, acc.provider, acc.label, acc.identity, acc.status, acc.color,
            acc.config.to_string(), acc.created_at, acc.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_accounts(conn: &mut Connection) -> Result<Vec<Account>, String> {
    let mut stmt = conn
        .prepare("SELECT id, provider, label, identity, status, color, config, created_at, updated_at FROM accounts ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Account {
                id: r.get(0)?,
                provider: r.get(1)?,
                label: r.get(2)?,
                identity: r.get(3)?,
                status: r.get(4)?,
                color: r.get(5)?,
                config: serde_json::from_str::<Value>(&r.get::<_, String>(6)?)
                    .unwrap_or(Value::Null),
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn delete_account(conn: &mut Connection, account_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM accounts WHERE id = ?1", params![account_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_calendar(conn: &mut Connection, cal: &CalendarRow) -> Result<(), String> {
    conn.execute(
        r#"INSERT INTO calendars (id, account_id, provider_calendar_id, name, description, color, is_primary, is_writable, visible, sort_order, deleted)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,0)
           ON CONFLICT(account_id, provider_calendar_id) DO UPDATE SET
             name=excluded.name, description=excluded.description, color=excluded.color,
             is_primary=excluded.is_primary, is_writable=excluded.is_writable, deleted=0"#,
        params![
            cal.id, cal.account_id, cal.provider_calendar_id, cal.name, cal.description,
            cal.color, cal.is_primary as i64, cal.is_writable as i64, cal.visible as i64,
            cal.sort_order
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_calendars(conn: &mut Connection) -> Result<Vec<CalendarRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, account_id, provider_calendar_id, name, description, color,
                    is_primary, is_writable, visible, sort_order
             FROM calendars WHERE deleted = 0 ORDER BY sort_order, name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CalendarRow {
                id: r.get(0)?,
                account_id: r.get(1)?,
                provider_calendar_id: r.get(2)?,
                name: r.get(3)?,
                description: r.get(4)?,
                color: r.get(5)?,
                is_primary: r.get::<_, i64>(6)? != 0,
                is_writable: r.get::<_, i64>(7)? != 0,
                visible: r.get::<_, i64>(8)? != 0,
                sort_order: r.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn set_calendar_visible(conn: &mut Connection, calendar_id: &str, visible: bool) -> Result<(), String> {
    conn.execute(
        "UPDATE calendars SET visible = ?2 WHERE id = ?1",
        params![calendar_id, visible as i64],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Upsert an event row and refresh its occurrences inside one transaction.
/// The unique (calendar_id, provider_event_id) index resolves identity for
/// provider rows; locally-created rows key on the local uuid.
pub fn upsert_event(conn: &mut Connection, ev: &EventRow) -> Result<String, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Resolve an existing local id for this provider row, if any.
    let existing_id: Option<String> = match &ev.provider_event_id {
        Some(pid) => tx
            .query_row(
                "SELECT id FROM events WHERE calendar_id=?1 AND provider_event_id=?2",
                params![ev.calendar_id, pid],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?,
        None => tx
            .query_row("SELECT id FROM events WHERE id=?1", params![ev.id], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string())?,
    };
    let id = existing_id.unwrap_or_else(|| ev.id.clone());

    tx.execute(
        r#"INSERT INTO events (id, calendar_id, provider_event_id, ical_uid, recurrence_id, master_event_id,
             title, description, location, start_ts, end_ts, start_date, end_date, start_tz, all_day,
             status, transparency, rrule, rdate, exdate, organizer_email, organizer_is_self, attendees,
             html_link, color, etag, provider_updated_at, fingerprint, pending, deleted, created_at, updated_at, raw)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?32,?33)
           ON CONFLICT(id) DO UPDATE SET
             provider_event_id=excluded.provider_event_id, ical_uid=excluded.ical_uid,
             recurrence_id=excluded.recurrence_id, master_event_id=excluded.master_event_id,
             title=excluded.title, description=excluded.description, location=excluded.location,
             start_ts=excluded.start_ts, end_ts=excluded.end_ts, start_date=excluded.start_date,
             end_date=excluded.end_date, start_tz=excluded.start_tz, all_day=excluded.all_day,
             status=excluded.status, transparency=excluded.transparency, rrule=excluded.rrule,
             rdate=excluded.rdate, exdate=excluded.exdate, organizer_email=excluded.organizer_email,
             organizer_is_self=excluded.organizer_is_self, attendees=excluded.attendees,
             html_link=excluded.html_link, color=excluded.color, etag=excluded.etag,
             provider_updated_at=excluded.provider_updated_at, fingerprint=excluded.fingerprint,
             pending=excluded.pending, deleted=excluded.deleted, updated_at=excluded.updated_at,
             raw=excluded.raw"#,
        params![
            id, ev.calendar_id, ev.provider_event_id, ev.ical_uid, ev.recurrence_id,
            ev.master_event_id, ev.title, ev.description, ev.location, ev.start_ts, ev.end_ts,
            ev.start_date, ev.end_date, ev.start_tz, ev.all_day as i64, ev.status,
            ev.transparency, ev.rrule, ev.rdate, ev.exdate, ev.organizer_email,
            ev.organizer_is_self as i64, ev.attendees, ev.html_link, ev.color, ev.etag,
            ev.provider_updated_at, ev.fingerprint, ev.pending as i64, ev.deleted as i64,
            ev.created_at, ev.updated_at, ev.raw
        ],
    )
    .map_err(|e| e.to_string())?;

    refresh_occurrences_tx(&tx, &id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

/// Recompute the occurrences of one event id within the current horizon.
fn refresh_occurrences_tx(tx: &rusqlite::Transaction<'_>, event_id: &str) -> Result<(), String> {
    let (h_start, h_end, tz) = horizon_tx(tx)?;

    let ev = tx
        .query_row("SELECT * FROM events WHERE id = ?1", params![event_id], event_from_row)
        .optional()
        .map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM occurrences WHERE event_id = ?1", params![event_id])
        .map_err(|e| e.to_string())?;

    if let Some(ev) = ev {
        for occ in expand_event(&ev, h_start, h_end, &tz) {
            tx.execute(
                "INSERT OR REPLACE INTO occurrences (event_id, start_ts, end_ts) VALUES (?1,?2,?3)",
                params![event_id, occ.start_ts, occ.end_ts],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn horizon_tx(tx: &rusqlite::Transaction<'_>) -> Result<(i64, i64, String), String> {
    let now = now_ms();
    let tz = iana_local_tz();
    let stored_tz: Option<String> = tx
        .query_row("SELECT value FROM meta WHERE key='expansion_tz'", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if stored_tz.as_deref() != Some(tz.as_str()) {
        tx.execute(
            "INSERT INTO meta (key, value) VALUES ('expansion_tz', ?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![tz],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok((now - HORIZON_BACK_MS, now + HORIZON_FWD_MS, tz))
}

/// Re-expand EVERYTHING (startup when tz changed; monthly horizon re-anchor).
pub fn reexpand_all(conn: &mut Connection) -> Result<usize, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let ids: Vec<String> = {
        let mut stmt = tx
            .prepare("SELECT id FROM events WHERE deleted = 0")
            .map_err(|e| e.to_string())?;
        let r = stmt
            .query_map([], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        r
    };
    for id in &ids {
        refresh_occurrences_tx(&tx, id)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(ids.len())
}

/// Whether startup should re-expand: tz changed or horizon edge is near.
pub fn needs_reexpansion(conn: &mut Connection) -> Result<bool, String> {
    let tz_now = iana_local_tz();
    let stored: Option<String> = conn
        .query_row("SELECT value FROM meta WHERE key='expansion_tz'", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if stored.as_deref() != Some(tz_now.as_str()) {
        return Ok(true);
    }
    let anchored: Option<String> = conn
        .query_row("SELECT value FROM meta WHERE key='horizon_anchored_at'", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    let anchored_ms = anchored.and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    Ok(now_ms() - anchored_ms > 30 * 86_400_000)
}

pub fn mark_horizon_anchored(conn: &mut Connection) -> Result<(), String> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES ('horizon_anchored_at', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![now_ms().to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// THE UI query: all occurrences overlapping [start, end) from visible
/// calendars, joined to events + calendars, deduped by ical_uid (first
/// occurrence wins; others become also_in entries).
pub fn events_in_range(
    conn: &mut Connection,
    start: i64,
    end: i64,
) -> Result<Vec<OccurrenceView>, String> {
    let mut stmt = conn
        .prepare(
            r#"SELECT o.event_id, e.calendar_id, c.account_id, e.title, e.location,
                      o.start_ts, o.end_ts, e.all_day, e.status,
                      COALESCE(e.color, c.color), e.ical_uid, e.pending, e.html_link
               FROM occurrences o
               JOIN events e ON e.id = o.event_id AND e.deleted = 0 AND e.status != 'cancelled'
               JOIN calendars c ON c.id = e.calendar_id AND c.visible = 1 AND c.deleted = 0
               WHERE o.start_ts < ?2 AND o.end_ts > ?1
               ORDER BY o.start_ts"#,
        )
        .map_err(|e| e.to_string())?;

    struct Raw {
        v: OccurrenceView,
    }
    let rows = stmt
        .query_map(params![start, end], |r| {
            Ok(Raw {
                v: OccurrenceView {
                    event_id: r.get(0)?,
                    calendar_id: r.get(1)?,
                    account_id: r.get(2)?,
                    title: r.get(3)?,
                    location: r.get(4)?,
                    start_ts: r.get(5)?,
                    end_ts: r.get(6)?,
                    all_day: r.get::<_, i64>(7)? != 0,
                    status: r.get(8)?,
                    color: r.get(9)?,
                    ical_uid: r.get(10)?,
                    pending: r.get::<_, i64>(11)? != 0,
                    html_link: r.get(12)?,
                    also_in: vec![],
                },
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Query-time dedup: same (ical_uid, start_ts) from different calendars
    // collapses to the first row; the duplicates are recorded as also_in.
    let mut seen: std::collections::HashMap<(String, i64), usize> = std::collections::HashMap::new();
    let mut out: Vec<OccurrenceView> = Vec::with_capacity(rows.len());
    for raw in rows {
        let v = raw.v;
        if let Some(uid) = v.ical_uid.clone() {
            let key = (uid, v.start_ts);
            if let Some(&idx) = seen.get(&key) {
                let dup = AlsoIn { calendar_id: v.calendar_id.clone(), account_id: v.account_id.clone() };
                out[idx].also_in.push(dup);
                continue;
            }
            seen.insert(key, out.len());
        }
        out.push(v);
    }
    Ok(out)
}

pub fn get_event(conn: &mut Connection, id: &str) -> Result<Option<EventRow>, String> {
    conn.query_row("SELECT * FROM events WHERE id = ?1", params![id], event_from_row)
        .optional()
        .map_err(|e| e.to_string())
}

/// Best-effort IANA name of the system timezone.
fn iana_local_tz() -> String {
    iana_time_zone::get_timezone().unwrap_or_else(|_| "UTC".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_account(conn: &mut Connection) -> String {
        let acc = Account {
            id: "acc1".into(),
            provider: "google".into(),
            label: "Test".into(),
            identity: "t@example.com".into(),
            status: "connected".into(),
            color: None,
            config: serde_json::json!({}),
            created_at: 1,
            updated_at: 1,
        };
        upsert_account(conn, &acc).unwrap();
        acc.id
    }

    fn mk_calendar(conn: &mut Connection, account_id: &str, id: &str) -> String {
        let cal = CalendarRow {
            id: id.into(),
            account_id: account_id.into(),
            provider_calendar_id: format!("prov-{id}"),
            name: "Cal".into(),
            description: None,
            color: Some("#00aaff".into()),
            is_primary: true,
            is_writable: true,
            visible: true,
            sort_order: 0,
        };
        upsert_calendar(conn, &cal).unwrap();
        cal.id
    }

    fn mk_event(cal: &str, id: &str, start: i64) -> EventRow {
        EventRow {
            id: id.into(),
            calendar_id: cal.into(),
            title: format!("ev-{id}"),
            start_ts: Some(start),
            end_ts: Some(start + 3_600_000),
            status: "confirmed".into(),
            transparency: "opaque".into(),
            created_at: 1,
            updated_at: 1,
            ..Default::default()
        }
    }

    #[test]
    fn upsert_and_range_query() {
        let store = CalendarStore::open_in_memory();
        store
            .with_blocking(|conn| {
                let acc = mk_account(conn);
                let cal = mk_calendar(conn, &acc, "cal1");
                let now = now_ms();
                upsert_event(conn, &mk_event(&cal, "e1", now)).unwrap();
                upsert_event(conn, &mk_event(&cal, "e2", now + 86_400_000)).unwrap();

                let hits = events_in_range(conn, now - 1000, now + 3_600_000).unwrap();
                assert_eq!(hits.len(), 1);
                assert_eq!(hits[0].title, "ev-e1");
                assert_eq!(hits[0].color.as_deref(), Some("#00aaff"));
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn provider_identity_upsert_reuses_local_id() {
        let store = CalendarStore::open_in_memory();
        store
            .with_blocking(|conn| {
                let acc = mk_account(conn);
                let cal = mk_calendar(conn, &acc, "cal1");
                let now = now_ms();
                let mut ev = mk_event(&cal, "local-a", now);
                ev.provider_event_id = Some("gid-1".into());
                let id1 = upsert_event(conn, &ev).unwrap();

                // Same provider id arrives again under a different local uuid
                let mut ev2 = mk_event(&cal, "local-b", now);
                ev2.provider_event_id = Some("gid-1".into());
                ev2.title = "updated".into();
                let id2 = upsert_event(conn, &ev2).unwrap();

                assert_eq!(id1, id2);
                let hits = events_in_range(conn, now - 1000, now + 3_600_000).unwrap();
                assert_eq!(hits.len(), 1);
                assert_eq!(hits[0].title, "updated");
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn recurring_event_produces_occurrences() {
        let store = CalendarStore::open_in_memory();
        store
            .with_blocking(|conn| {
                let acc = mk_account(conn);
                let cal = mk_calendar(conn, &acc, "cal1");
                let now = now_ms();
                let mut ev = mk_event(&cal, "rec1", now);
                ev.rrule = Some("FREQ=DAILY;COUNT=7".into());
                upsert_event(conn, &ev).unwrap();

                let hits = events_in_range(conn, now - 1000, now + 8 * 86_400_000).unwrap();
                assert_eq!(hits.len(), 7);
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn uid_dedup_collapses_mirrored_invite() {
        let store = CalendarStore::open_in_memory();
        store
            .with_blocking(|conn| {
                let acc = mk_account(conn);
                let cal_a = mk_calendar(conn, &acc, "calA");
                let cal_b = mk_calendar(conn, &acc, "calB");
                let now = now_ms();
                let mut e1 = mk_event(&cal_a, "e1", now);
                e1.ical_uid = Some("uid-123".into());
                let mut e2 = mk_event(&cal_b, "e2", now);
                e2.ical_uid = Some("uid-123".into());
                upsert_event(conn, &e1).unwrap();
                upsert_event(conn, &e2).unwrap();

                let hits = events_in_range(conn, now - 1000, now + 3_600_000).unwrap();
                assert_eq!(hits.len(), 1);
                assert_eq!(hits[0].also_in.len(), 1);
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn hidden_calendar_is_excluded() {
        let store = CalendarStore::open_in_memory();
        store
            .with_blocking(|conn| {
                let acc = mk_account(conn);
                let cal = mk_calendar(conn, &acc, "cal1");
                let now = now_ms();
                upsert_event(conn, &mk_event(&cal, "e1", now)).unwrap();
                set_calendar_visible(conn, &cal, false).unwrap();
                let hits = events_in_range(conn, now - 1000, now + 3_600_000).unwrap();
                assert!(hits.is_empty());
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn tombstoned_event_disappears() {
        let store = CalendarStore::open_in_memory();
        store
            .with_blocking(|conn| {
                let acc = mk_account(conn);
                let cal = mk_calendar(conn, &acc, "cal1");
                let now = now_ms();
                let mut ev = mk_event(&cal, "e1", now);
                upsert_event(conn, &ev).unwrap();
                ev.deleted = true;
                upsert_event(conn, &ev).unwrap();
                let hits = events_in_range(conn, now - 1000, now + 3_600_000).unwrap();
                assert!(hits.is_empty());
                Ok(())
            })
            .unwrap();
    }
}
