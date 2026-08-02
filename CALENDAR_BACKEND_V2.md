# Calendar Backend V2 — Architecture

Status: **design approved, not yet implemented**
Origin: 3 independent design passes (store-first / provider-first / sync-first lenses), each adversarially verified against the real codebase. This doc is the synthesis.

## The problem with V1 (current code)

- **Single account per provider.** `storage.rs` is a singleton: one Google token keyring key, one CalDAV account. Ten accounts is impossible.
- **Network on every view change.** `get_all_events` fans out live HTTP calls to every visible calendar per request. No local store.
- **Three duplicate frontend caches** (CalendarContext upcoming-events, CalendarView's range cache, iCal's JSON files) with different invalidation rules.
- **No incremental sync anywhere.** No Google syncToken, no CalDAV sync-collection (CTag only), full refetches always.
- **Writes are fire-and-forget.** No If-Match/etag guard, no offline queue, conflicts clobber.
- Storage-layout traps (verified): `calendars.json`, `caldav_account.json`, `ical_subscriptions.json`, `ical_events/*.json` live in `~/.lokus/calendar/` **in production too** (the "dev path" is unconditional). Google token/account use keyring service `com.lokus.app.calendar` (keys `lokus_google_calendar_token`, `lokus_google_calendar_account`); the CalDAV password uses a *different* service `com.lokus.app.caldav`, key `lokus_caldav_account`. Bundle id is `io.lokus.app` — already inconsistent with those service strings; migration must read the existing strings verbatim.

## V2 core (consensus across all three designs)

**One SQLite database is the single source of truth. The UI never touches the network. Per-account sync engines are the only writers of remote data. Local edits go through an outbox.**

```
UI (React) ──invoke──▶ query commands ──▶ SQLite (rusqlite, WAL)
   ▲                                          ▲            │
   └── listen('calendar://changed') ◀─debounced─┐          │
                                                │          ▼
             per-account tokio sync tasks ──upsert──┐   outbox drain
             (Google / Graph / CalDAV / Notion / iCal)──▶ provider APIs
```

### Storage (rusqlite, bundled, WAL; DB at app-data dir `io.lokus.app/calendar.db`)

Tables: `accounts` (N rows, provider + identity + config JSON), `calendars` (FK account, stable local uuid ≠ provider id), `events` (local uuid pk, `provider_event_id` nullable until pushed, `ical_uid` for cross-account identity, RRULE/EXDATE/RDATE, etag, `raw` JSON for round-trip fidelity, tombstones), `occurrences` (materialized recurrence expansion — the only table the UI range-queries; indexed on start/end), `outbox` (pending local ops with base etag), `sync_state` (per-calendar cursor), `conflicts`.

Key semantics:
- **All-day events are civil dates, not UTC instants** (UTC-ms storage shifts them a day west of UTC). Store the date; expand in local tz at query time.
- rusqlite is blocking → dedicated writer thread/actor + read connection; never hold a connection across awaits.
- Attendees: JSON column on events (nothing queries by attendee).
- Recurrence expansion (`rrule` crate + manual RDATE/EXDATE merge) is needed **only for CalDAV and iCal** — see per-provider notes. Horizon ±12 months, re-anchored monthly.

### Provider abstraction (Rust)

```rust
#[async_trait]
trait CalendarConnector {
    fn capabilities(&self) -> Capabilities; // delta? expands_recurrence? writable? etag_style?
    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>>;
    async fn pull(&self, cal: &CalendarRef, cursor: Option<Cursor>) -> Result<PullResult>; // events + next cursor
    async fn push(&self, op: &OutboxOp) -> Result<PushResult>; // create/update/delete with etag guard
}
```

Per-provider facts (verified against current API docs by the review pass):

| Provider | Auth | Incremental sync | Notes |
|---|---|---|---|
| Google (×N accounts) | PKCE + loopback (existing flow, reworked for multi-account) | `events.list` **`singleEvents=true` + `syncToken`** — a valid combo, so Google arrives pre-expanded and needs **no rrule code**. syncToken is pinned to the initial window → periodic re-anchor; `410 GONE` → full resync. Drop `orderBy` in the new connector. | If-Match writes; expect benign 412s on meetings (attendee RSVPs bump etags) — auto-resolve when local fields untouched. ~600 q/min/user. |
| Microsoft Graph (Outlook/365) | PKCE public client, `/common`, **register `signInAudience=AzureADandPersonalMicrosoftAccount`**, loopback redirect is port-agnostic `http://localhost` | `calendarView/delta` (window-scoped, returns expanded occurrences + `@removed`) | `Prefer: IdType="ImmutableId"`; 429 + Retry-After; ~10k req/10min/mailbox; MSA refresh tokens rotate on use (store the new one every refresh). |
| CalDAV / iCloud | app-specific password (existing) | RFC 6578 `sync-collection` REPORT (net-new — current code is CTag-only). **507 = truncated → keep paging with returned token; 403 valid-sync-token = expired → full resync.** CTag+query fallback for servers without 6578. | Needs rrule expansion locally. iCloud routes through the CalDAV connector with its own account row. |
| Notion | **Internal-integration token paste ONLY.** OAuth is impossible client-side (token exchange requires client_secret, no PKCE). | Poll databases with `last_edited_time >= cursor` — minute-granular, so overlap the window and rely on idempotent upserts; hourly full reconcile catches deletions/archived pages. | User picks database + date property per "calendar". ~3 req/s. Date-only/end-less dates need duration defaults. |
| iCal subscriptions | none | Conditional GET (ETag/Last-Modified). **`file://` imports are a static kind** — mtime check, no poll loop (today's `ical_import_file` must keep working). | Needs rrule expansion (v1 never expanded — recurring iCal events are broken today; v2 fixes this). |

### Sync engine

- One tokio task per account; staggered schedule: foreground (calendar view open) 60s for Google/Graph, 120s Notion, 15min CalDAV/iCal; background ×5; immediate pull on app focus and after any push.
- **Outbox**: local edit → write to store optimistically (`pending=1`) → outbox row with base etag → drain with exponential backoff. Offline-safe by construction.
- **Conflicts v1: remote-wins + conflict row** (surfaced in UI). No field-level merge — that's a later project. Auto-resolve the benign case (remote newer, local untouched).
- **Dedup**: query-time clustering on `ical_uid` (Google/Graph/CalDAV all carry it — covers the real "same invite in two accounts" case). No persisted cluster table, no fingerprint-fallback in v2 (false-positive risk; columns stay for later). The old blake3 fingerprint (`title|start-minute|location`, 16 hex) is kept only as a column for future use.
- **`sync_pairs` bidirectional mirroring is dropped** (it's wired into CalendarSettings UI — rip that out and shim `get_sync_config` so the settings screen doesn't crash during transition).
- `calendar://changed` Tauri event, debounced (initial 10-account sync would otherwise storm the UI).

### Auth / multi-account

- `accounts` table + per-account keyring entries (or one JSON map entry to get a single macOS ACL prompt — decide at implementation).
- `oauth_server.rs` rework: it's currently a fixed-port (9080) single-route server that completes flows by writing a temp file the frontend polls, with one shared PKCE file — **concurrent multi-account flows collide.** Needs per-flow state routing (provider + flow id in `state` param), per-flow PKCE, and a direct completion channel instead of file polling.
- Client IDs: Google from env today (needs shipping story), Microsoft public client id baked in (fine for PKCE), Notion n/a.
- Google OAuth verification (Testing → Production) is a parallel ops task — see checklist the team already has; multi-account doesn't change it (per-app, not per-account).

### Frontend contract

- Query commands: `calendar_accounts_list`, `calendar_list`, `events_in_range(start, end)` (reads `occurrences` joined to `events`, deduped), `event_get(id)`, `event_create/update/delete` (writes store + outbox, returns optimistic row), `account_add/remove`, `sync_now`.
- One zustand store fed by `events_in_range` + `calendar://changed` invalidation. **Deletes all three JS caches** (CalendarContext upcoming-events, CalendarView range cache, service-level). CalendarView keeps its schedule-block/task integration (that's a 4th data source, out of scope — budget for preserving it during the collapse).
- All 38 existing commands are invoked by `services/calendar.js` — the swap is all-or-nothing per release; land backend + frontend swap together rather than maintaining 38 shims.

### Migration (one-shot, on first v2 launch)

Read: `~/.lokus/calendar/*.json` (always — prod too), keyring `com.lokus.app.calendar` (both google keys) + `com.lokus.app.caldav`, dev files in debug. Produce account rows (existing CalDAV row → `icloud` if server_url contains icloud.com, else `caldav`), calendars, iCal subscriptions (`file://` → static kind). Do **not** seed event identity from the old iCal caches (recurrence was broken); first sync repopulates. Keep old files until v2 sync succeeds once, then archive.

## Phases

| # | Scope | Est. |
|---|---|---|
| 1 | Store: schema, migrations, writer actor, occurrence expansion (rrule+RDATE/EXDATE, fixtures), query commands | 1 wk |
| 2 | Account registry + auth rework (oauth_server routing, per-flow PKCE) + Google connector v2 (multi-account, syncToken, re-anchor, If-Match, outbox drain) | 2 wk |
| 3 | Frontend collapse: one store, `events_in_range`, delete 3 caches, migration shipped | 1.5–2 wk |
| 4 | CalDAV/iCloud sync-collection + iCal v2 (incl. `file://`, recurrence fix) | 1–1.5 wk |
| 5 | Microsoft Graph connector (prereq: Azure app registration) | 1–1.5 wk |
| 6 | Notion connector (token paste, DB+property picker, poll+reconcile) | 1 wk |
| 7 | Dedup (UID query-time), conflict surface, sync-status UI, polish | 1 wk |

New Rust deps: `rusqlite` (bundled), `rrule`, `rusqlite_migration`, `chrono-tz` (direct). Everything else (keyring, oauth2, async-trait, blake3, tokio, reqwest) already present.

## User-action prerequisites (not code)

1. Google OAuth app: publish to production + verification (kills the 7-day token expiry).
2. Azure: register app, `AzureADandPersonalMicrosoftAccount`, loopback `http://localhost` redirect.
3. Notion: users create an internal integration and paste the token (document this in-app).
