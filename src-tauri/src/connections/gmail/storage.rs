use std::path::PathBuf;
use keyring::Entry;
use crate::connections::gmail::models::{GmailToken, GmailProfile, GmailError};
use crate::secure_storage::SecureStorage;
use serde_json;

const GMAIL_TOKEN_KEY: &str = "lokus_gmail_token";
const GMAIL_PROFILE_KEY: &str = "lokus_gmail_profile";
const SERVICE_NAME: &str = "com.pratham.lokus.gmail";

pub struct GmailStorage;

impl GmailStorage {
    fn get_keyring_entry(key: &str) -> Result<Entry, GmailError> {
        Entry::new(SERVICE_NAME, key)
            .map_err(|e| GmailError::Storage(format!("Failed to create keyring entry: {}", e)))
    }

    pub fn store_token(token: &GmailToken) -> Result<(), GmailError> {
        println!("[GMAIL] 🔒 Storing Gmail token securely with encryption");

        // Use secure storage for both development and production
        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        // Store token with encryption
        storage.store(GMAIL_TOKEN_KEY, token)
            .map_err(|e| GmailError::Storage(format!("Failed to store encrypted Gmail token: {}", e)))?;

        println!("[GMAIL] 🔒 Gmail token stored securely");
        Ok(())
    }

    pub fn get_token() -> Result<Option<GmailToken>, GmailError> {
        println!("[GMAIL] 🔓 Retrieving Gmail token from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        // Retrieve encrypted token
        let token: Option<GmailToken> = storage.retrieve(GMAIL_TOKEN_KEY)
            .map_err(|e| GmailError::Storage(format!("Failed to retrieve encrypted Gmail token: {}", e)))?;

        if token.is_some() {
            println!("[GMAIL] 🔓 Gmail token retrieved successfully from secure storage");
        } else {
            println!("[GMAIL] 🔓 No Gmail token found in secure storage");
        }

        Ok(token)
    }

    pub fn delete_token() -> Result<(), GmailError> {
        println!("[GMAIL] 🗑️ Deleting Gmail token from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        storage.delete(GMAIL_TOKEN_KEY)
            .map_err(|e| GmailError::Storage(format!("Failed to delete encrypted Gmail token: {}", e)))?;

        println!("[GMAIL] 🗑️ Gmail token deleted from secure storage");
        Ok(())
    }

    pub fn store_profile(profile: &GmailProfile) -> Result<(), GmailError> {
        println!("[GMAIL] 🔒 Storing Gmail profile securely");

        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        storage.store(GMAIL_PROFILE_KEY, profile)
            .map_err(|e| GmailError::Storage(format!("Failed to store encrypted Gmail profile: {}", e)))?;

        println!("[GMAIL] 🔒 Gmail profile stored securely");
        Ok(())
    }

    pub fn get_profile() -> Result<Option<GmailProfile>, GmailError> {
        println!("[GMAIL] 🔓 Retrieving Gmail profile from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        let profile: Option<GmailProfile> = storage.retrieve(GMAIL_PROFILE_KEY)
            .map_err(|e| GmailError::Storage(format!("Failed to retrieve encrypted Gmail profile: {}", e)))?;

        if profile.is_some() {
            println!("[GMAIL] 🔓 Gmail profile retrieved successfully");
        }

        Ok(profile)
    }

    pub fn delete_profile() -> Result<(), GmailError> {
        println!("[GMAIL] 🗑️ Deleting Gmail profile from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        storage.delete(GMAIL_PROFILE_KEY)
            .map_err(|e| GmailError::Storage(format!("Failed to delete encrypted Gmail profile: {}", e)))?;

        println!("[GMAIL] 🗑️ Gmail profile deleted from secure storage");
        Ok(())
    }

    pub fn is_token_expired(token: &GmailToken) -> bool {
        if let Some(expires_at) = token.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            expires_at <= now + 300 // Consider expired if less than 5 minutes remaining
        } else {
            false
        }
    }

    /// Clear all Gmail secure storage (for logout)
    pub fn clear_all() -> Result<(), GmailError> {
        println!("[GMAIL] 🧹 Clearing all Gmail secure storage data");

        let storage = SecureStorage::new()
            .map_err(|e| GmailError::Storage(format!("Failed to initialize secure storage: {}", e)))?;

        // Delete token and profile
        let _ = storage.delete(GMAIL_TOKEN_KEY);
        let _ = storage.delete(GMAIL_PROFILE_KEY);

        println!("[GMAIL] 🧹 All Gmail secure storage data cleared");
        Ok(())
    }
}