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
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum CalendarProvider {
    Google,
    CalDAV,
    ICloud,
    ICal,
}

impl std::fmt::Display for CalendarProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarProvider::Google => write!(f, "google"),
            CalendarProvider::CalDAV => write!(f, "caldav"),
            CalendarProvider::ICloud => write!(f, "icloud"),
            CalendarProvider::ICal => write!(f, "ical"),
        }
    }
}

/// iCal subscription info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ICalSubscription {
    pub id: String,
    pub name: String,
    pub url: String,
    pub color: Option<String>,
    pub last_synced: Option<DateTime<Utc>>,
    pub sync_interval_minutes: u32,
    pub enabled: bool,
}

/// CalDAV account credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalDAVAccount {
    pub id: String,
    pub server_url: String,
    pub username: String,
    #[serde(skip_serializing, default)]
    pub password: String,
    pub display_name: Option<String>,
    pub principal_url: Option<String>,
    pub calendar_home_url: Option<String>,
    pub is_connected: bool,
    pub connected_at: Option<DateTime<Utc>>,
    pub last_synced: Option<DateTime<Utc>>,
}

/// CalDAV server presets
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalDAVPreset {
    ICloud,
    Fastmail,
    Custom,
}

impl CalDAVPreset {
    pub fn server_url(&self) -> &'static str {
        match self {
            CalDAVPreset::ICloud => "https://caldav.icloud.com",
            CalDAVPreset::Fastmail => "https://caldav.fastmail.com",
            CalDAVPreset::Custom => "",
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

// ============== Sync-related Types ==============

/// Represents a mapping between events across different calendar providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMapping {
    pub id: String,
    pub fingerprint: String,
    pub primary_event_id: String,
    pub primary_provider: CalendarProvider,
    pub primary_calendar_id: String,
    pub linked_events: Vec<LinkedEvent>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Represents a linked event in another calendar/provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedEvent {
    pub event_id: String,
    pub calendar_id: String,
    pub provider: CalendarProvider,
    pub last_synced_at: DateTime<Utc>,
    pub last_modified_at: Option<DateTime<Utc>>,
    pub sync_status: SyncEventStatus,
}

/// Status of a synced event
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SyncEventStatus {
    Synced,
    PendingPush,
    PendingPull,
    Conflict,
    DeletePending,
}

impl Default for SyncEventStatus {
    fn default() -> Self {
        Self::Synced
    }
}

/// Configuration for calendar sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub enabled: bool,
    pub conflict_resolution: ConflictResolution,
    pub sync_pairs: Vec<SyncPair>,
    pub deduplication_enabled: bool,
    pub auto_sync_interval_minutes: u32,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            conflict_resolution: ConflictResolution::default(),
            sync_pairs: Vec::new(),
            deduplication_enabled: true,
            auto_sync_interval_minutes: 15,
        }
    }
}

/// Conflict resolution strategy
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    /// Most recently modified version wins
    LastModifiedWins,
    /// Primary provider always wins
    PrimaryWins,
    /// Prompt user to resolve
    Manual,
    /// Prefer Google Calendar version
    PreferGoogle,
    /// Prefer CalDAV version
    PreferCalDAV,
}

impl Default for ConflictResolution {
    fn default() -> Self {
        Self::LastModifiedWins
    }
}

/// Represents a sync pair between two calendars
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPair {
    pub id: String,
    pub source_calendar_id: String,
    pub source_provider: CalendarProvider,
    pub target_calendar_id: String,
    pub target_provider: CalendarProvider,
    pub bidirectional: bool,
    pub enabled: bool,
}

/// A deduplicated event with information about where else it exists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeduplicatedEvent {
    pub event: CalendarEvent,
    pub also_in: Vec<CalendarProviderInfo>,
    pub is_read_only: bool,
    pub fingerprint: String,
}

/// Information about where an event also exists
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarProviderInfo {
    pub provider: CalendarProvider,
    pub calendar_id: String,
    pub calendar_name: String,
    pub event_id: String,
}

/// State of the sync engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub last_full_sync: Option<DateTime<Utc>>,
    pub last_incremental_sync: Option<DateTime<Utc>>,
    pub sync_in_progress: bool,
    pub pending_changes: u32,
    pub last_error: Option<String>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            last_full_sync: None,
            last_incremental_sync: None,
            sync_in_progress: false,
            pending_changes: 0,
            last_error: None,
        }
    }
}

/// Result of a full sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullSyncResult {
    pub success: bool,
    pub events_created: u32,
    pub events_updated: u32,
    pub events_deleted: u32,
    pub duplicates_found: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
    pub synced_at: DateTime<Utc>,
}
