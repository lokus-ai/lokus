use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Represents a calendar event from any provider (Google, CalDAV, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub calendar_id: String,
    pub provider: CalendarProvider,
    pub title: String,
    pub description: Option<String>,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub all_day: bool,
    pub location: Option<String>,
    pub attendees: Vec<EventAttendee>,
    pub recurrence_rule: Option<String>,
    pub status: EventStatus,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub etag: Option<String>,
    pub html_link: Option<String>,
    pub color_id: Option<String>,
}

/// Represents a calendar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calendar {
    pub id: String,
    pub provider: CalendarProvider,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub is_primary: bool,
    pub is_writable: bool,
    pub sync_token: Option<String>,
    pub last_synced: Option<DateTime<Utc>>,
    pub visible: bool,
}

/// Represents a connected calendar account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarAccount {
    pub id: String,
    pub provider: CalendarProvider,
    pub email: String,
    pub is_connected: bool,
    pub connected_at: Option<DateTime<Utc>>,
}

/// Calendar provider type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CalendarProvider {
    Google,
    CalDAV,
    ICloud,
}

impl std::fmt::Display for CalendarProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarProvider::Google => write!(f, "google"),
            CalendarProvider::CalDAV => write!(f, "caldav"),
            CalendarProvider::ICloud => write!(f, "icloud"),
        }
    }
}

/// Event attendee
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventAttendee {
    pub email: String,
    pub name: Option<String>,
    pub response_status: AttendeeResponseStatus,
    pub is_organizer: bool,
}

/// Attendee response status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AttendeeResponseStatus {
    NeedsAction,
    Declined,
    Tentative,
    Accepted,
}

impl Default for AttendeeResponseStatus {
    fn default() -> Self {
        Self::NeedsAction
    }
}

/// Event status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EventStatus {
    Confirmed,
    Tentative,
    Cancelled,
}

impl Default for EventStatus {
    fn default() -> Self {
        Self::Confirmed
    }
}

/// OAuth token for calendar providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<u64>,
    pub scope: String,
    pub token_type: String,
}

/// Request to create a new event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub all_day: bool,
    pub location: Option<String>,
    pub attendees: Option<Vec<String>>,
    pub recurrence_rule: Option<String>,
}

/// Request to update an event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEventRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub all_day: Option<bool>,
    pub location: Option<String>,
    pub attendees: Option<Vec<String>>,
    pub recurrence_rule: Option<String>,
    pub status: Option<EventStatus>,
}

/// Sync status for calendar operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub last_sync: Option<DateTime<Utc>>,
    pub pending_changes: u32,
    pub error: Option<String>,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            is_syncing: false,
            last_sync: None,
            pending_changes: 0,
            error: None,
        }
    }
}

/// Result of a sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub events_added: u32,
    pub events_updated: u32,
    pub events_deleted: u32,
    pub errors: Vec<String>,
    pub synced_at: DateTime<Utc>,
}

/// Calendar error types
#[derive(Debug, thiserror::Error)]
pub enum CalendarError {
    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Token expired")]
    TokenExpired,

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Calendar not connected")]
    NotConnected,
}

impl From<reqwest::Error> for CalendarError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            CalendarError::Network("Request timeout".to_string())
        } else if err.is_connect() {
            CalendarError::Network("Connection failed".to_string())
        } else {
            CalendarError::Network(err.to_string())
        }
    }
}

impl From<serde_json::Error> for CalendarError {
    fn from(err: serde_json::Error) -> Self {
        CalendarError::Parse(err.to_string())
    }
}

impl From<CalendarError> for String {
    fn from(err: CalendarError) -> Self {
        err.to_string()
    }
}
