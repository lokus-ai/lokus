//! Row types for Calendar V2. Serialized shapes are the frontend contract —
//! camelCase like the rest of the app's V2-era commands.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub provider: String,
    pub label: String,
    pub identity: String,
    pub status: String,
    pub color: Option<String>,
    pub config: serde_json::Value,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarRow {
    pub id: String,
    pub account_id: String,
    pub provider_calendar_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub is_primary: bool,
    pub is_writable: bool,
    pub visible: bool,
    pub sort_order: i64,
}

/// Full event row. `start`/`end` are unix ms for timed events; for all-day
/// events `start_date`/`end_date` (YYYY-MM-DD, end exclusive) are set and the
/// ms fields carry the local-midnight expansion for display convenience.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    pub id: String,
    pub calendar_id: String,
    pub provider_event_id: Option<String>,
    pub ical_uid: Option<String>,
    pub recurrence_id: Option<String>,
    pub master_event_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub start_tz: Option<String>,
    pub all_day: bool,
    pub status: String,
    pub transparency: String,
    pub rrule: Option<String>,
    pub rdate: Option<String>,
    pub exdate: Option<String>,
    pub organizer_email: Option<String>,
    pub organizer_is_self: bool,
    pub attendees: Option<String>,
    pub html_link: Option<String>,
    pub color: Option<String>,
    pub etag: Option<String>,
    pub provider_updated_at: Option<i64>,
    pub fingerprint: Option<String>,
    pub pending: bool,
    pub deleted: bool,
    pub created_at: i64,
    pub updated_at: i64,
    /// Full provider payload for round-trip fidelity of unmodeled fields.
    pub raw: Option<String>,
}

/// What the UI's range query returns: one row per visible occurrence,
/// carrying the fields the calendar views actually render.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OccurrenceView {
    pub event_id: String,
    pub calendar_id: String,
    pub account_id: String,
    pub title: String,
    pub location: Option<String>,
    pub start_ts: i64,
    pub end_ts: i64,
    pub all_day: bool,
    pub status: String,
    pub color: Option<String>,          // event override, else calendar color
    pub ical_uid: Option<String>,
    pub pending: bool,
    pub html_link: Option<String>,
    /// Other (calendar_id, account_id) pairs holding the same ical_uid —
    /// populated by query-time dedup; empty until Phase 7 UI shows badges.
    pub also_in: Vec<AlsoIn>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlsoIn {
    pub calendar_id: String,
    pub account_id: String,
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
