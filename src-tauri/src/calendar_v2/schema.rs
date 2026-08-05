//! SQLite schema for Calendar V2, applied via rusqlite_migration.
//!
//! Conventions:
//! - ids are UUIDv4 strings minted locally; provider ids live in
//!   `provider_*_id` columns so a provider can never collide with our keys.
//! - times are unix milliseconds UTC (`*_ts`), EXCEPT all-day events, which
//!   are civil dates (`start_date`/`end_date`, YYYY-MM-DD, end exclusive) —
//!   storing an all-day event as an instant shifts it a day across
//!   timezones. Occurrence rows for all-day events are expanded to local
//!   midnight and re-expanded when the system timezone changes (tracked in
//!   `meta.expansion_tz`).
//! - deletes are tombstones (`deleted=1`) until the outbox confirms the
//!   remote delete or the provider delta acknowledges it.

use rusqlite::Connection;

/// Versioned migrations applied via PRAGMA user_version. Append new entries;
/// never edit shipped ones.
const MIGRATIONS: &[&str] = &[
    // v1 — initial schema
    r#"
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,             -- google|microsoft|caldav|icloud|notion|ical
  label         TEXT NOT NULL,
  identity      TEXT NOT NULL,             -- email / principal / workspace / feed url hash
  status        TEXT NOT NULL DEFAULT 'connected', -- connected|auth_error|disabled
  color         TEXT,
  config        TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE(provider, identity)
);

CREATE TABLE calendars (
  id                   TEXT PRIMARY KEY,
  account_id           TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_calendar_id TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  color                TEXT,
  is_primary           INTEGER NOT NULL DEFAULT 0,
  is_writable          INTEGER NOT NULL DEFAULT 0,
  visible              INTEGER NOT NULL DEFAULT 1,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  deleted              INTEGER NOT NULL DEFAULT 0,
  UNIQUE(account_id, provider_calendar_id)
);

CREATE TABLE events (
  id                  TEXT PRIMARY KEY,
  calendar_id         TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  provider_event_id   TEXT,
  ical_uid            TEXT,
  recurrence_id       TEXT,               -- RECURRENCE-ID for override instances
  master_event_id     TEXT REFERENCES events(id) ON DELETE CASCADE,
  title               TEXT NOT NULL DEFAULT '',
  description         TEXT,
  location            TEXT,
  start_ts            INTEGER,            -- NULL for all-day
  end_ts              INTEGER,
  start_date          TEXT,               -- YYYY-MM-DD, all-day only
  end_date            TEXT,               -- exclusive, all-day only
  start_tz            TEXT,               -- IANA tz of original value
  all_day             INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'confirmed',
  transparency        TEXT NOT NULL DEFAULT 'opaque',
  rrule               TEXT,
  rdate               TEXT,               -- JSON array of iCal date strings
  exdate              TEXT,               -- JSON array of iCal date strings
  organizer_email     TEXT,
  organizer_is_self   INTEGER NOT NULL DEFAULT 0,
  attendees           TEXT,               -- JSON array (display-only)
  html_link           TEXT,
  color               TEXT,
  etag                TEXT,
  provider_updated_at INTEGER,
  fingerprint         TEXT,               -- blake3(title|start-minute|location)[..16], v1-compatible
  pending             INTEGER NOT NULL DEFAULT 0,
  deleted             INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  raw                 TEXT
);
CREATE UNIQUE INDEX idx_events_provider
  ON events(calendar_id, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX idx_events_uid ON events(ical_uid) WHERE ical_uid IS NOT NULL;
CREATE INDEX idx_events_master ON events(master_event_id) WHERE master_event_id IS NOT NULL;

CREATE TABLE occurrences (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_ts   INTEGER NOT NULL,
  end_ts     INTEGER NOT NULL,
  PRIMARY KEY(event_id, start_ts)
) WITHOUT ROWID;
CREATE INDEX idx_occ_range ON occurrences(start_ts, end_ts);

CREATE TABLE outbox (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  op          TEXT NOT NULL,               -- create|update|delete
  base_etag   TEXT,
  payload     TEXT NOT NULL,               -- serialized event snapshot at edit time
  attempts    INTEGER NOT NULL DEFAULT 0,
  next_try_at INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_outbox_due ON outbox(next_try_at);

CREATE TABLE sync_state (
  calendar_id  TEXT PRIMARY KEY REFERENCES calendars(id) ON DELETE CASCADE,
  cursor       TEXT,                       -- syncToken / deltaLink / sync-token / timestamp
  cursor_kind  TEXT,                       -- provider-specific tag
  anchored_at  INTEGER,                    -- when the cursor window was established
  last_sync_at INTEGER,
  last_error   TEXT
);

CREATE TABLE conflicts (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  local_json  TEXT NOT NULL,
  remote_json TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#,
];

pub fn apply_migrations(conn: &mut Connection) -> Result<(), String> {
    let current: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        if version <= current {
            continue;
        }
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch(sql)
            .map_err(|e| format!("migration v{version}: {e}"))?;
        tx.pragma_update(None, "user_version", version)
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_apply_cleanly_and_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        apply_migrations(&mut conn).unwrap();
        apply_migrations(&mut conn).unwrap();
        let v: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, MIGRATIONS.len() as i64);
    }
}
