//! The sync engine: one background loop that walks every connected account,
//! pulls provider deltas into the store, and drains the outbox.
//!
//! Scheduling (v1 of the engine — deliberately simple): a single loop ticks
//! every 60 seconds and syncs accounts sequentially; `sync_now` pokes the
//! loop via Notify. Per-account failures set accounts.status and never stop
//! the loop. Rate limits push the account's next attempt back.

use std::collections::HashMap;
use std::sync::Arc;

use rusqlite::{params, Connection, OptionalExtension};
use tauri::AppHandle;
use tokio::sync::Notify;

use super::commands::emit_changed;
use super::connector::{CalendarConnector, ConnectorError, Cursor, PushOutcome};
use super::models::{now_ms, Account, CalendarRow, EventRow};
use super::providers::connector_for;
use super::store::{self, CalendarStore};

const TICK_SECS: u64 = 60;

#[derive(Clone)]
pub struct SyncEngine {
    pub poke: Arc<Notify>,
}

impl SyncEngine {
    pub fn start(app: AppHandle, store: CalendarStore) -> Self {
        let poke = Arc::new(Notify::new());
        let engine = Self { poke: poke.clone() };
        tauri::async_runtime::spawn(async move {
            // Small delay so app startup isn't competing with a sync burst.
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            let mut last_synced: HashMap<String, i64> = HashMap::new();
            loop {
                let changed = sync_all(&store, &mut last_synced).await;
                if changed {
                    emit_changed(&app);
                }
                tokio::select! {
                    _ = tokio::time::sleep(std::time::Duration::from_secs(TICK_SECS)) => {}
                    _ = poke.notified() => {}
                }
            }
        });
        engine
    }

    pub fn sync_now(&self) {
        self.poke.notify_one();
    }
}

/// Sync every connected account; returns whether anything changed.
/// `last_synced` gates per-provider cadence (CalDAV/iCal poll slower than
/// delta APIs) — a sync_now poke still respects nothing older than 5s.
async fn sync_all(store: &CalendarStore, last_synced: &mut HashMap<String, i64>) -> bool {
    let accounts = match store.with(store::list_accounts).await {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut any_changes = false;
    for account in accounts {
        if account.status == "disabled" {
            continue;
        }
        let min_interval = super::providers::min_sync_interval_ms(&account.provider);
        if let Some(last) = last_synced.get(&account.id) {
            if now_ms() - last < min_interval {
                continue;
            }
        }
        let Some(conn) = connector_for(&account) else { continue };
        last_synced.insert(account.id.clone(), now_ms());
        match sync_account(store, &account, conn.clone()).await {
            Ok(changed) => {
                any_changes |= changed;
                if account.status != "connected" {
                    let id = account.id.clone();
                    let _ = store
                        .with(move |c| set_account_status(c, &id, "connected", None))
                        .await;
                }
            }
            Err(ConnectorError::AuthExpired) => {
                let id = account.id.clone();
                let _ = store
                    .with(move |c| set_account_status(c, &id, "auth_error", Some("login expired")))
                    .await;
                any_changes = true; // status change is UI-visible
            }
            Err(e) => {
                let id = account.id.clone();
                let msg = e.to_string();
                let _ = store
                    .with(move |c| set_account_status(c, &id, "connected", Some(&msg)))
                    .await;
            }
        }
    }
    any_changes
}

async fn sync_account(
    store: &CalendarStore,
    account: &Account,
    conn: Arc<dyn CalendarConnector>,
) -> Result<bool, ConnectorError> {
    let mut changed = false;

    // 1 · Calendars: upsert the provider's list; tombstone the vanished.
    let remote_cals = conn.list_calendars().await?;
    let account_id = account.id.clone();
    let remote_clone: Vec<_> = remote_cals.clone();
    changed |= store
        .with(move |c| reconcile_calendars(c, &account_id, &remote_clone))
        .await
        .map_err(ConnectorError::Other)?;

    // 2 · Events: pull each visible local calendar of this account.
    let account_id = account.id.clone();
    let local_cals: Vec<CalendarRow> = store
        .with(move |c| {
            Ok(store::list_calendars(c)?
                .into_iter()
                .filter(|cal| cal.account_id == account_id && cal.visible)
                .collect())
        })
        .await
        .map_err(ConnectorError::Other)?;

    for cal in &local_cals {
        match pull_calendar(store, conn.as_ref(), cal).await {
            Ok(c) => changed |= c,
            Err(ConnectorError::CursorExpired) => {
                // Clear cursor and refetch the window once.
                let cal_id = cal.id.clone();
                store
                    .with(move |c| save_cursor(c, &cal_id, None))
                    .await
                    .map_err(ConnectorError::Other)?;
                changed |= pull_calendar(store, conn.as_ref(), cal).await?;
            }
            Err(ConnectorError::RateLimited(_)) => break, // try again next tick
            Err(e) => return Err(e),
        }
    }

    // 3 · Outbox: push pending local ops for this account's calendars.
    changed |= drain_outbox(store, account, conn.as_ref()).await?;

    Ok(changed)
}

async fn pull_calendar(
    store: &CalendarStore,
    conn: &dyn CalendarConnector,
    cal: &CalendarRow,
) -> Result<bool, ConnectorError> {
    let cal_id = cal.id.clone();
    let cursor: Option<Cursor> = store
        .with(move |c| load_cursor(c, &cal_id))
        .await
        .map_err(ConnectorError::Other)?;

    let mut changed = false;
    let mut page_token: Option<String> = None;
    let mut full_resync_ids: Option<Vec<String>> = None;

    loop {
        let page = conn
            .pull(&cal.provider_calendar_id, &cal.id, cursor.as_ref(), page_token.as_deref())
            .await?;

        if page.full_resync && full_resync_ids.is_none() {
            full_resync_ids = Some(vec![]);
        }

        if !page.events.is_empty() {
            changed = true;
            let events = page.events;
            if let Some(ids) = &mut full_resync_ids {
                ids.extend(events.iter().filter_map(|e| e.provider_event_id.clone()));
            }
            store
                .with(move |c| {
                    for ev in &events {
                        store::upsert_event(c, ev)?;
                    }
                    Ok(())
                })
                .await
                .map_err(ConnectorError::Other)?;
        }

        if let Some(next) = page.next_cursor {
            let cal_id = cal.id.clone();
            let Cursor::Token(tok) = next;
            store
                .with(move |c| save_cursor(c, &cal_id, Some(&tok)))
                .await
                .map_err(ConnectorError::Other)?;
        }

        match page.page_token {
            Some(pt) => page_token = Some(pt),
            None => break,
        }
    }

    // Full window replace: anything local+provider-backed that the provider
    // didn't send this round is gone remotely.
    if let Some(seen) = full_resync_ids {
        let cal_id = cal.id.clone();
        let removed = store
            .with(move |c| tombstone_missing(c, &cal_id, &seen))
            .await
            .map_err(ConnectorError::Other)?;
        changed |= removed > 0;
    }

    let cal_id = cal.id.clone();
    store
        .with(move |c| {
            c.execute(
                "UPDATE sync_state SET last_sync_at=?2, last_error=NULL WHERE calendar_id=?1",
                params![cal_id, now_ms()],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })
        .await
        .map_err(ConnectorError::Other)?;

    Ok(changed)
}

async fn drain_outbox(
    store: &CalendarStore,
    account: &Account,
    conn: &dyn CalendarConnector,
) -> Result<bool, ConnectorError> {
    let account_id = account.id.clone();
    let due: Vec<(String, String, String, Option<String>, String)> = store
        .with(move |c| {
            let mut stmt = c
                .prepare(
                    r#"SELECT o.id, o.event_id, o.op, o.base_etag, cal.provider_calendar_id
                       FROM outbox o
                       JOIN events e ON e.id = o.event_id
                       JOIN calendars cal ON cal.id = e.calendar_id
                       WHERE cal.account_id = ?1 AND o.next_try_at <= ?2
                       ORDER BY o.created_at LIMIT 20"#,
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![account_id, now_ms()], |r| {
                    Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(rows)
        })
        .await
        .map_err(ConnectorError::Other)?;

    if due.is_empty() {
        return Ok(false);
    }

    let mut changed = false;
    for (outbox_id, event_id, op, base_etag, provider_cal_id) in due {
        let ev_id = event_id.clone();
        let Some(event) = store
            .with(move |c| store::get_event(c, &ev_id))
            .await
            .map_err(ConnectorError::Other)?
        else {
            let oid = outbox_id.clone();
            let _ = store
                .with(move |c| {
                    c.execute("DELETE FROM outbox WHERE id=?1", params![oid])
                        .map_err(|e| e.to_string())?;
                    Ok(())
                })
                .await;
            continue;
        };

        match conn.push(&provider_cal_id, &op, &event, base_etag.as_deref()).await {
            Ok(outcome) => {
                changed = true;
                let oid = outbox_id.clone();
                store
                    .with(move |c| apply_push_outcome(c, &oid, &event_id, outcome))
                    .await
                    .map_err(ConnectorError::Other)?;
            }
            Err(ConnectorError::AuthExpired) => return Err(ConnectorError::AuthExpired),
            Err(ConnectorError::RateLimited(s)) => {
                let oid = outbox_id.clone();
                let delay = (s as i64) * 1000;
                let _ = store
                    .with(move |c| {
                        c.execute(
                            "UPDATE outbox SET next_try_at=?2, attempts=attempts+1 WHERE id=?1",
                            params![oid, now_ms() + delay],
                        )
                        .map_err(|e| e.to_string())?;
                        Ok(())
                    })
                    .await;
                break;
            }
            Err(e) => {
                // Exponential backoff: 1min, 4min, 16min… capped at 1h.
                let oid = outbox_id.clone();
                let msg = e.to_string();
                let _ = store
                    .with(move |c| {
                        let attempts: i64 = c
                            .query_row("SELECT attempts FROM outbox WHERE id=?1", params![oid], |r| r.get(0))
                            .unwrap_or(0);
                        let backoff = (60_000i64 * 4i64.pow(attempts.min(5) as u32)).min(3_600_000);
                        c.execute(
                            "UPDATE outbox SET next_try_at=?2, attempts=attempts+1, last_error=?3 WHERE id=?1",
                            params![oid, now_ms() + backoff, msg],
                        )
                        .map_err(|e| e.to_string())?;
                        Ok(())
                    })
                    .await;
            }
        }
    }
    Ok(changed)
}

// ── Store helpers (run on the store thread) ────────────────────────────────

fn reconcile_calendars(
    conn: &mut Connection,
    account_id: &str,
    remote: &[super::connector::RemoteCalendar],
) -> Result<bool, String> {
    let mut changed = false;
    let existing: HashMap<String, String> = {
        let mut stmt = conn
            .prepare("SELECT provider_calendar_id, id FROM calendars WHERE account_id=?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![account_id], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<(String, String)>, _>>()
            .map_err(|e| e.to_string())?;
        rows.into_iter().collect()
    };

    for rc in remote {
        let local_id = existing
            .get(&rc.provider_calendar_id)
            .cloned()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        if !existing.contains_key(&rc.provider_calendar_id) {
            changed = true;
        }
        store::upsert_calendar(
            conn,
            &CalendarRow {
                id: local_id.clone(),
                account_id: account_id.to_string(),
                provider_calendar_id: rc.provider_calendar_id.clone(),
                name: rc.name.clone(),
                description: rc.description.clone(),
                color: rc.color.clone(),
                is_primary: rc.is_primary,
                is_writable: rc.is_writable,
                visible: true,
                sort_order: 0,
            },
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO sync_state (calendar_id) VALUES (?1)",
            params![local_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let remote_ids: std::collections::HashSet<&str> =
        remote.iter().map(|r| r.provider_calendar_id.as_str()).collect();
    for (pid, local_id) in &existing {
        if !remote_ids.contains(pid.as_str()) {
            conn.execute("UPDATE calendars SET deleted=1 WHERE id=?1", params![local_id])
                .map_err(|e| e.to_string())?;
            changed = true;
        }
    }
    Ok(changed)
}

fn load_cursor(conn: &mut Connection, calendar_id: &str) -> Result<Option<Cursor>, String> {
    let tok: Option<String> = conn
        .query_row(
            "SELECT cursor FROM sync_state WHERE calendar_id=?1",
            params![calendar_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    Ok(tok.map(Cursor::Token))
}

fn save_cursor(conn: &mut Connection, calendar_id: &str, cursor: Option<&str>) -> Result<(), String> {
    conn.execute(
        r#"INSERT INTO sync_state (calendar_id, cursor, anchored_at)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(calendar_id) DO UPDATE SET cursor=excluded.cursor,
             anchored_at=CASE WHEN excluded.cursor IS NULL THEN excluded.anchored_at ELSE COALESCE(sync_state.anchored_at, excluded.anchored_at) END"#,
        params![calendar_id, cursor, now_ms()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// After a full-window pull: tombstone provider-backed events of this
/// calendar that the provider no longer reports (deleted remotely while we
/// had no cursor). Rows still pending local push are left alone.
fn tombstone_missing(
    conn: &mut Connection,
    calendar_id: &str,
    seen_provider_ids: &[String],
) -> Result<usize, String> {
    let seen: std::collections::HashSet<&str> =
        seen_provider_ids.iter().map(|s| s.as_str()).collect();
    let all: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, provider_event_id FROM events
                 WHERE calendar_id=?1 AND provider_event_id IS NOT NULL AND deleted=0 AND pending=0",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![calendar_id], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    let mut removed = 0;
    for (id, pid) in all {
        if !seen.contains(pid.as_str()) {
            if let Some(mut ev) = store::get_event(conn, &id)? {
                ev.deleted = true;
                ev.updated_at = now_ms();
                store::upsert_event(conn, &ev)?;
                removed += 1;
            }
        }
    }
    Ok(removed)
}

fn apply_push_outcome(
    conn: &mut Connection,
    outbox_id: &str,
    event_id: &str,
    outcome: PushOutcome,
) -> Result<(), String> {
    match outcome {
        PushOutcome::Applied { provider_event_id, etag } => {
            if let Some(mut ev) = store::get_event(conn, event_id)? {
                ev.provider_event_id = Some(provider_event_id);
                ev.etag = etag;
                ev.pending = false;
                ev.updated_at = now_ms();
                store::upsert_event(conn, &ev)?;
            }
        }
        PushOutcome::Deleted => {
            conn.execute("DELETE FROM events WHERE id=?1", params![event_id])
                .map_err(|e| e.to_string())?;
        }
        PushOutcome::Conflict => {
            // Remote-wins v1: record the conflict; the next pull overwrites
            // the local row with the remote version.
            if let Some(ev) = store::get_event(conn, event_id)? {
                let local = serde_json::to_string(&ev).unwrap_or_default();
                conn.execute(
                    "INSERT INTO conflicts (id, event_id, local_json, remote_json, created_at) VALUES (?1,?2,?3,'{}',?4)",
                    params![uuid::Uuid::new_v4().to_string(), event_id, local, now_ms()],
                )
                .map_err(|e| e.to_string())?;
                let mut ev = ev;
                ev.pending = false;
                ev.updated_at = now_ms();
                store::upsert_event(conn, &ev)?;
            }
        }
    }
    conn.execute("DELETE FROM outbox WHERE id=?1", params![outbox_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn set_account_status(
    conn: &mut Connection,
    account_id: &str,
    status: &str,
    _error: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE accounts SET status=?2, updated_at=?3 WHERE id=?1",
        params![account_id, status, now_ms()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Enqueue an outbox op for a locally-edited event (called by commands).
pub fn enqueue_outbox(conn: &mut Connection, event: &EventRow, op: &str) -> Result<(), String> {
    conn.execute(
        r#"INSERT INTO outbox (id, event_id, op, base_etag, payload, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
        params![
            uuid::Uuid::new_v4().to_string(),
            event.id,
            op,
            event.etag,
            serde_json::to_string(event).unwrap_or_default(),
            now_ms()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
