//! @part-of ai
//! Assistant settings (a small JSON file in the app's config folder) and
//! secrets (the OS keychain). Settings never contain a key.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{AiError, Result};

const SERVICE: &str = "io.lokus.app";
const FILE: &str = "ai.json";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    /// Claude, through the Anthropic API.
    #[default]
    Anthropic,
    /// Any service that speaks the OpenAI chat-completions format.
    OpenAi,
    /// The person's own ChatGPT plan, through Sign in with ChatGPT. No key.
    ChatGpt,
}

impl Provider {
    pub fn id(self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::OpenAi => "openai",
            Self::ChatGpt => "chatgpt",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Anthropic => "Anthropic",
            Self::OpenAi => "OpenAI",
            Self::ChatGpt => "ChatGPT",
        }
    }

    pub fn default_url(self) -> &'static str {
        match self {
            Self::Anthropic => "https://api.anthropic.com",
            Self::OpenAi | Self::ChatGpt => "https://api.openai.com/v1",
        }
    }

    fn env_key(self) -> &'static str {
        match self {
            Self::Anthropic => "ANTHROPIC_API_KEY",
            Self::OpenAi => "OPENAI_API_KEY",
            // Never read: this provider signs in instead.
            Self::ChatGpt => "",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub url: String,
    #[serde(default = "yes")]
    pub enabled: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub provider: Provider,
    /// Empty means the provider's default.
    #[serde(default)]
    pub model: String,
    /// Empty means the provider's own address.
    #[serde(default)]
    pub base_url: String,
    /// Let the assistant change notes and call tool servers without asking.
    #[serde(default)]
    pub auto_approve: bool,
    #[serde(default)]
    pub mcp: Vec<McpServer>,
}

impl Config {
    pub fn load(dir: &Path) -> Self {
        fs::read_to_string(dir.join(FILE))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, dir: &Path) -> Result<()> {
        let failed = |e: std::io::Error| AiError::Config(e.to_string());
        fs::create_dir_all(dir).map_err(failed)?;
        let text =
            serde_json::to_string_pretty(self).map_err(|e| AiError::Config(e.to_string()))?;
        let tmp = dir.join(format!("{FILE}.tmp"));
        fs::write(&tmp, text).map_err(failed)?;
        fs::rename(tmp, dir.join(FILE)).map_err(failed)
    }

    pub fn url(&self) -> &str {
        let trimmed = self.base_url.trim().trim_end_matches('/');
        if trimmed.is_empty() {
            self.provider.default_url()
        } else {
            trimmed
        }
    }

    pub fn model(&self) -> Result<&str> {
        match (self.model.trim(), self.provider) {
            ("", Provider::Anthropic) => Ok("claude-opus-5-5"),
            ("", Provider::OpenAi | Provider::ChatGpt) => Err(AiError::NoModel),
            (model, _) => Ok(model),
        }
    }
}

fn entry(account: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, account).map_err(|e| AiError::Keychain(e.to_string()))
}

/// Store a secret in the OS keychain; an empty value removes it.
pub fn set_secret(account: &str, secret: &str) -> Result<()> {
    let entry = entry(account)?;
    let result = if secret.is_empty() {
        match entry.delete_credential() {
            Err(keyring::Error::NoEntry) => Ok(()),
            other => other,
        }
    } else {
        entry.set_password(secret)
    };
    result.map_err(|e| AiError::Keychain(e.to_string()))
}

pub fn secret(account: &str) -> Option<String> {
    entry(account)
        .ok()?
        .get_password()
        .ok()
        .filter(|s| !s.is_empty())
}

pub fn key_account(provider: Provider) -> String {
    format!("ai:{}", provider.id())
}

pub fn mcp_account(server: &str) -> String {
    format!("mcp:{server}")
}

/// The key for a provider: the keychain first, then the usual environment
/// variable (which is how the command line and tests supply one).
pub fn api_key(provider: Provider) -> Result<String> {
    secret(&key_account(provider))
        .or_else(|| {
            std::env::var(provider.env_key())
                .ok()
                .filter(|k| !k.is_empty())
        })
        .ok_or_else(|| AiError::NoKey(provider.label().to_string()))
}

pub fn has_key(provider: Provider) -> bool {
    match provider {
        Provider::ChatGpt => crate::chatgpt::signed_in(),
        _ => api_key(provider).is_ok(),
    }
}

/// Where sign-ins live when the keychain cannot be used: until the app quits.
static MEMORY: std::sync::LazyLock<std::sync::Mutex<std::collections::HashMap<String, String>>> =
    std::sync::LazyLock::new(Default::default);

/// Keep a sign-in: in the keychain, or in memory if the keychain refuses.
pub fn keep(account: &str, value: &str) {
    if set_secret(account, value).is_err() {
        if let Ok(mut memory) = MEMORY.lock() {
            memory.insert(account.to_string(), value.to_string());
        }
    }
}

pub fn kept(account: &str) -> Option<String> {
    secret(account).or_else(|| MEMORY.lock().ok()?.get(account).cloned())
}

pub fn forget(account: &str) {
    let _ = set_secret(account, "");
    if let Ok(mut memory) = MEMORY.lock() {
        memory.remove(account);
    }
}
