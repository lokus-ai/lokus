//! The provider abstraction: every calendar backend implements this trait.
//! Connectors are stateless beyond their account id + credentials handle;
//! all persistence goes through the store.

use async_trait::async_trait;

use super::models::EventRow;

#[derive(Debug, Clone, Copy)]
pub struct Capabilities {
    /// Provider hands back pre-expanded instances (Google singleEvents,
    /// Graph calendarView) — the store still expands anything with an RRULE,
    /// so connectors with this flag set must strip recurrence fields.
    pub expands_recurrence: bool,
    pub writable: bool,
    /// Supports incremental cursors (syncToken/deltaLink/sync-token).
    pub delta: bool,
}

/// A calendar as the provider describes it (pre-store).
#[derive(Debug, Clone)]
pub struct RemoteCalendar {
    pub provider_calendar_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub is_primary: bool,
    pub is_writable: bool,
}

#[derive(Debug, Clone)]
pub enum Cursor {
    Token(String),
}

#[derive(Debug)]
pub struct PullPage {
    /// Upserts (deleted=true rows are tombstones from the provider).
    pub events: Vec<EventRow>,
    /// Cursor to persist AFTER this page is applied. None mid-pagination.
    pub next_cursor: Option<Cursor>,
    /// More pages remain — call pull again immediately with `page_token`.
    pub page_token: Option<String>,
    /// True when this pull replaced the whole window (initial or post-410):
    /// events of this calendar absent from the full set should be removed.
    pub full_resync: bool,
}

#[derive(Debug)]
pub enum PushOutcome {
    /// Remote accepted; provider id + new etag for the local row.
    Applied { provider_event_id: String, etag: Option<String> },
    /// Remote deleted (delete op acknowledged).
    Deleted,
    /// Precondition failed — somebody else changed it. Engine records a
    /// conflict and re-pulls.
    Conflict,
}

#[derive(Debug, thiserror::Error)]
pub enum ConnectorError {
    #[error("auth expired")]
    AuthExpired,
    #[error("cursor expired")]
    CursorExpired,
    #[error("rate limited, retry after {0}s")]
    RateLimited(u64),
    #[error("{0}")]
    Other(String),
}

impl From<reqwest::Error> for ConnectorError {
    fn from(e: reqwest::Error) -> Self {
        ConnectorError::Other(e.to_string())
    }
}

#[async_trait]
pub trait CalendarConnector: Send + Sync {
    fn capabilities(&self) -> Capabilities;

    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>, ConnectorError>;

    /// Pull one page of changes for a calendar. `local_calendar_id` is the
    /// store id the returned EventRows must reference.
    async fn pull(
        &self,
        provider_calendar_id: &str,
        local_calendar_id: &str,
        cursor: Option<&Cursor>,
        page_token: Option<&str>,
    ) -> Result<PullPage, ConnectorError>;

    /// Push one local op (create/update/delete) described by the event row.
    async fn push(
        &self,
        provider_calendar_id: &str,
        op: &str,
        event: &EventRow,
        base_etag: Option<&str>,
    ) -> Result<PushOutcome, ConnectorError>;
}
