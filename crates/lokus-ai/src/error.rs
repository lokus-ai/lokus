//! @part-of ai
use serde_json::{json, Value};

pub type Result<T> = std::result::Result<T, AiError>;

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("add an API key for {0} in Settings first")]
    NoKey(String),
    #[error("choose a model in Settings first")]
    NoModel,
    #[error("the API key was refused")]
    BadKey,
    #[error("the provider is busy or rate-limiting; try again in a moment")]
    Busy,
    #[error("{0}")]
    Provider(String),
    #[error("could not reach {0}")]
    Network(String),
    #[error("this computer's keychain is locked or unavailable, so the key was not saved ({0})")]
    Keychain(String),
    #[error("tool server {server}: {message}")]
    Mcp { server: String, message: String },
    #[error("settings: {0}")]
    Config(String),
}

impl AiError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NoKey(_) => "no_key",
            Self::NoModel => "no_model",
            Self::BadKey => "bad_key",
            Self::Busy => "busy",
            Self::Provider(_) => "provider",
            Self::Network(_) => "network",
            Self::Keychain(_) => "keychain",
            Self::Mcp { .. } => "mcp",
            Self::Config(_) => "config",
        }
    }

    /// The `{code, message}` shape every error takes on its way to the UI.
    pub fn body(&self) -> Value {
        json!({ "code": self.code(), "message": self.to_string() })
    }
}
