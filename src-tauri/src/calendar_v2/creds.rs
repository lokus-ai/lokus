//! Per-account credential storage.
//!
//! Release builds: keyring, service "io.lokus.calendar", key = account id.
//! Debug builds: JSON files under ~/.lokus/calendar_v2/creds/ — same pattern
//! V1 uses to avoid macOS keychain prompts on every `cargo run`.

use serde::{Deserialize, Serialize};

const SERVICE: &str = "io.lokus.calendar";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCreds {
    /// OAuth: access + refresh; token-paste providers: token in `access`.
    pub access: String,
    pub refresh: Option<String>,
    /// Unix seconds when `access` expires (absent = never / unknown).
    pub expires_at: Option<u64>,
}

fn dev_path(account_id: &str) -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("no home dir")?;
    let dir = home.join(".lokus").join("calendar_v2").join("creds");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{account_id}.json")))
}

pub fn store(account_id: &str, creds: &StoredCreds) -> Result<(), String> {
    let json = serde_json::to_string(creds).map_err(|e| e.to_string())?;
    if cfg!(debug_assertions) {
        std::fs::write(dev_path(account_id)?, json).map_err(|e| e.to_string())
    } else {
        keyring::Entry::new(SERVICE, account_id)
            .and_then(|e| e.set_password(&json))
            .map_err(|e| e.to_string())
    }
}

pub fn load(account_id: &str) -> Result<Option<StoredCreds>, String> {
    let json = if cfg!(debug_assertions) {
        match std::fs::read_to_string(dev_path(account_id)?) {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.to_string()),
        }
    } else {
        match keyring::Entry::new(SERVICE, account_id).and_then(|e| e.get_password()) {
            Ok(s) => s,
            Err(keyring::Error::NoEntry) => return Ok(None),
            Err(e) => return Err(e.to_string()),
        }
    };
    serde_json::from_str(&json).map(Some).map_err(|e| e.to_string())
}

pub fn delete(account_id: &str) -> Result<(), String> {
    if cfg!(debug_assertions) {
        let p = dev_path(account_id)?;
        if p.exists() {
            std::fs::remove_file(p).map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        match keyring::Entry::new(SERVICE, account_id).and_then(|e| e.delete_credential()) {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}
