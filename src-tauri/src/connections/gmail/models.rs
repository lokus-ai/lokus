use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<u64>,
    pub scope: String,
    pub token_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailMessage {
    pub id: String,
    pub thread_id: String,
    pub subject: String,
    pub from: Vec<EmailAddress>,
    pub to: Vec<EmailAddress>,
    pub cc: Option<Vec<EmailAddress>>,
    pub bcc: Option<Vec<EmailAddress>>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub attachments: Vec<EmailAttachment>,
    pub labels: Vec<String>,
    pub snippet: String,
    pub date: DateTime<Utc>,
    pub is_read: bool,
    pub is_starred: bool,
    pub size_estimate: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAddress {
    pub email: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAttachment {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub data: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailThread {
    pub id: String,
    pub subject: String,
    pub messages: Vec<EmailMessage>,
    pub labels: Vec<String>,
    pub snippet: String,
    pub is_read: bool,
    pub date: DateTime<Utc>,
    pub message_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailComposer {
    pub to: Vec<EmailAddress>,
    pub cc: Option<Vec<EmailAddress>>,
    pub bcc: Option<Vec<EmailAddress>>,
    pub subject: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub attachments: Vec<EmailAttachment>,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailLabel {
    pub id: String,
    pub name: String,
    pub type_: String, // "system" or "user"
    pub messages_total: u32,
    pub messages_unread: u32,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSearchOptions {
    pub query: String,
    pub max_results: Option<u32>,
    pub page_token: Option<String>,
    pub include_spam_trash: bool,
    pub label_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailListOptions {
    pub label_ids: Option<Vec<String>>,
    pub max_results: Option<u32>,
    pub page_token: Option<String>,
    pub include_spam_trash: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailProfile {
    pub email_address: String,
    pub messages_total: u64,
    pub threads_total: u64,
    pub history_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedOperation {
    pub id: String,
    pub operation_type: OperationType,
    pub data: serde_json::Value,
    pub attempts: u32,
    pub max_attempts: u32,
    pub created_at: DateTime<Utc>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    SendEmail,
    ReplyEmail,
    ForwardEmail,
    MarkAsRead,
    MarkAsUnread,
    Star,
    Unstar,
    Archive,
    Delete,
    AddLabel,
    RemoveLabel,
}

#[derive(Debug, thiserror::Error)]
pub enum GmailError {
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("API error: {0}")]
    Api(String),
    
    #[error("Rate limit exceeded")]
    #[allow(dead_code)]
    RateLimit,
    
    #[error("Token expired")]
    TokenExpired,
    
    #[error("Invalid request: {0}")]
    #[allow(dead_code)]
    InvalidRequest(String),
    
    #[error("Storage error: {0}")]
    Storage(String),
    
    #[error("Parse error: {0}")]
    Parse(String),
}

impl From<reqwest::Error> for GmailError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            GmailError::Network("Request timeout".to_string())
        } else if err.is_connect() {
            GmailError::Network("Connection failed".to_string())
        } else {
            GmailError::Network(err.to_string())
        }
    }
}

impl From<serde_json::Error> for GmailError {
    fn from(err: serde_json::Error) -> Self {
        GmailError::Parse(err.to_string())
    }
}