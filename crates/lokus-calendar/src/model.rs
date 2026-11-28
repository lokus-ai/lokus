//! @part-of calendar
//! What an event, a calendar and an account look like inside Lokus, whichever provider they
//! come from. Times are instants in UTC; `zone` is the time zone the event was made in.

use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub struct CalError {
    pub code: &'static str,
    pub message: String,
}

pub type Result<T> = std::result::Result<T, CalError>;

impl CalError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
    pub fn body(&self) -> Value {
        json!({ "code": self.code, "message": self.message })
    }
    /// The provider could not be reached at all, so the change waits.
    pub fn offline(&self) -> bool {
        self.code == "offline"
    }
    /// Not refused: the change stays waiting and is tried again.
    pub fn waits(&self) -> bool {
        matches!(self.code, "offline" | "slow")
    }
}

impl std::fmt::Display for CalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl From<rusqlite::Error> for CalError {
    fn from(e: rusqlite::Error) -> Self {
        Self::new("store", e.to_string())
    }
}

impl From<std::io::Error> for CalError {
    fn from(e: std::io::Error) -> Self {
        Self::new("io", e.to_string())
    }
}

impl From<lokus_core::CoreError> for CalError {
    fn from(e: lokus_core::CoreError) -> Self {
        Self::new("vault", e.to_string())
    }
}

pub fn bad(message: impl Into<String>) -> CalError {
    CalError::new("invalid_args", message)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Google,
    Microsoft,
}

impl Provider {
    pub fn id(self) -> &'static str {
        match self {
            Provider::Google => "google",
            Provider::Microsoft => "microsoft",
        }
    }
    pub fn from_id(id: &str) -> Result<Self> {
        match id {
            "google" => Ok(Provider::Google),
            "microsoft" => Ok(Provider::Microsoft),
            other => Err(bad(format!(
                "'provider' must be google or microsoft, not '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// `google:ana@acme.test`.
    pub id: String,
    pub provider: Provider,
    pub email: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calendar {
    pub account: String,
    pub id: String,
    pub name: String,
    pub color: String,
    pub hidden: bool,
    /// The provider's own main calendar of this account.
    pub primary: bool,
    /// Where new events go.
    #[serde(default)]
    pub default: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Guest {
    pub email: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub optional: bool,
    /// `accepted`, `declined`, `tentative` or `needsAction`.
    #[serde(default = "no_reply")]
    pub reply: String,
}

fn no_reply() -> String {
    "needsAction".into()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Meeting {
    /// `meet` or `teams`.
    pub kind: String,
    pub url: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Event {
    /// `account|calendar|id`: the one name Lokus uses for it.
    pub key: String,
    pub account: String,
    pub calendar: String,
    /// The provider's id; `local-…` until the provider has it.
    pub id: String,
    /// The invitation's own id (iCalUID): the same on every account the event reaches.
    #[serde(default)]
    pub uid: String,
    pub title: String,
    pub start: String,
    pub end: String,
    #[serde(default)]
    pub all_day: bool,
    #[serde(default)]
    pub zone: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub guests: Vec<Guest>,
    #[serde(default)]
    pub organizer: String,
    /// The signed-in account organises it, so it may change it.
    #[serde(default = "yes")]
    pub mine: bool,
    /// This account's own reply, when it is a guest.
    #[serde(default)]
    pub reply: String,
    #[serde(default)]
    pub meeting: Option<Meeting>,
    /// A meeting link is wanted and the provider has not made it yet.
    #[serde(default)]
    pub want_meeting: bool,
    /// The repeat rule (`RRULE:FREQ=WEEKLY`) of a repeating event.
    #[serde(default)]
    pub repeat: Option<String>,
    /// The repeating event this is one occurrence of.
    #[serde(default)]
    pub series: Option<String>,
    #[serde(default)]
    pub link: String,
    /// Changes are held here and the guests have not been told.
    #[serde(default)]
    pub pending: bool,
    /// Never sent: "Send invite" is what sends it.
    #[serde(default)]
    pub unsent: bool,
    /// What the held changes are: `time`, `title`, `guests`, …
    #[serde(default)]
    pub changes: Vec<String>,
    /// Waiting to reach the provider (offline, or not sent yet).
    #[serde(default)]
    pub queued: bool,
    /// The provider refused the last change.
    #[serde(default)]
    pub error: Option<String>,
    /// The meeting note, as a path in the open folder.
    #[serde(default)]
    pub note: Option<String>,
}

fn yes() -> bool {
    true
}

pub fn key(account: &str, calendar: &str, id: &str) -> String {
    format!("{account}|{calendar}|{id}")
}

/// (account, calendar, id) of an event's key.
pub fn split(key: &str) -> Result<(&str, &str, &str)> {
    let mut parts = key.splitn(3, '|');
    match (parts.next(), parts.next(), parts.next()) {
        (Some(a), Some(c), Some(i)) if !i.is_empty() => Ok((a, c, i)),
        _ => Err(bad(format!("'{key}' is not an event"))),
    }
}

pub fn time(text: &str) -> Result<DateTime<Utc>> {
    let text = text.trim();
    if text.len() == 10 {
        return time(&format!("{text}T00:00:00Z"));
    }
    DateTime::parse_from_rfc3339(text)
        .map(|t| t.with_timezone(&Utc))
        .map_err(|_| bad(format!("'{text}' is not a time like 2026-12-01T15:00:00Z")))
}

pub fn stamp(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn now() -> String {
    stamp(Utc::now())
}

/// The fields of an event a person can change, by the name used in `changes`.
pub const FIELDS: [&str; 7] = [
    "title",
    "time",
    "location",
    "description",
    "guests",
    "meeting",
    "repeat",
];

/// Which fields differ between two versions of an event.
pub fn differ(old: &Event, new: &Event) -> Vec<String> {
    let mut out = Vec::new();
    let mut add = |name: &str, changed: bool| {
        if changed {
            out.push(name.to_string());
        }
    };
    add("title", old.title != new.title);
    add(
        "time",
        (&old.start, &old.end, old.all_day, &old.zone)
            != (&new.start, &new.end, new.all_day, &new.zone),
    );
    add("location", old.location != new.location);
    add("description", old.description != new.description);
    let people = |e: &Event| -> Vec<(String, bool)> {
        e.guests
            .iter()
            .map(|g| (g.email.to_lowercase(), g.optional))
            .collect()
    };
    add("guests", people(old) != people(new));
    add(
        "meeting",
        (old.meeting.is_some() || old.want_meeting) != (new.meeting.is_some() || new.want_meeting),
    );
    add("repeat", old.repeat != new.repeat);
    out
}
