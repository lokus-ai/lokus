//! OS-keychain-backed secret storage for the AI surface.
//!
//! The client `AIProvider` persists the user's short-lived Supabase JWT (and, in
//! BYOK mode, provider API keys) via `secure_store_set` / `secure_store_get`.
//! The JS already calls these with a localStorage fallback; this module makes
//! them real, backed by the `keyring 3.6` crate (macOS Keychain, Windows
//! Credential Manager, Linux Secret Service). It is the §8.1 prerequisite for
//! shipping the AI surface — without it the JWT sits in plaintext localStorage.
//!
//! Gating matches `keyring` in `Cargo.toml`, which lives in the
//! `cfg(not(any(target_os = "ios", target_os = "android")))` target block.

#![cfg(not(any(target_os = "ios", target_os = "android")))]

use keyring::Entry;

/// Keychain "service" namespace — keeps Lokus secrets grouped and avoids
/// colliding with other apps' entries under the same account name.
const SERVICE: &str = "com.lokus.ai";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| format!("Keychain entry error for '{}': {}", key, e))
}

/// Store (or overwrite) a secret under `key`.
#[tauri::command]
pub fn secure_store_set(key: String, value: String) -> Result<(), String> {
    let e = entry(&key)?;
    e.set_password(&value)
        .map_err(|err| format!("Failed to store secret '{}': {}", key, err))
}

/// Retrieve a secret, or `None` if it has never been set.
/// A missing entry is a normal state (first run), NOT an error.
#[tauri::command]
pub fn secure_store_get(key: String) -> Result<Option<String>, String> {
    let e = entry(&key)?;
    match e.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Failed to read secret '{}': {}", key, err)),
    }
}

/// Delete a secret. Deleting a non-existent key is a no-op (idempotent).
#[tauri::command]
pub fn secure_store_delete(key: String) -> Result<(), String> {
    let e = entry(&key)?;
    match e.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Failed to delete secret '{}': {}", key, err)),
    }
}
