//! @part-of core
use serde::Serialize;

pub type Result<T> = std::result::Result<T, CoreError>;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("path is outside the vault or not allowed: {0}")]
    InvalidPath(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("already exists: {0}")]
    AlreadyExists(String),
    #[error("{0} is not UTF-8 text")]
    NotText(String),
    #[error("{0} changed on disk since it was read")]
    Conflict(String),
    #[error("unknown command: {0}")]
    UnknownCommand(String),
    #[error("bad arguments for {command}: {message}")]
    BadArgs { command: String, message: String },
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("file watcher: {0}")]
    Watch(String),
}

impl CoreError {
    /// Stable machine-readable code; the UI switches on this, never on the message.
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidPath(_) => "invalid_path",
            Self::NotFound(_) => "not_found",
            Self::AlreadyExists(_) => "already_exists",
            Self::NotText(_) => "not_text",
            Self::Conflict(_) => "conflict",
            Self::UnknownCommand(_) => "unknown_command",
            Self::BadArgs { .. } => "bad_args",
            Self::Io(_) => "io",
            Self::Watch(_) => "watch",
        }
    }
}

#[derive(Serialize)]
pub struct ErrorBody {
    pub code: &'static str,
    pub message: String,
}

impl From<&CoreError> for ErrorBody {
    fn from(e: &CoreError) -> Self {
        Self {
            code: e.code(),
            message: e.to_string(),
        }
    }
}
