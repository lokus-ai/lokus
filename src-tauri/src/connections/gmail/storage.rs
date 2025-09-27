use std::path::PathBuf;
use keyring::Entry;
use crate::connections::gmail::models::{GmailToken, GmailProfile, GmailError};
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
        // println!("[GMAIL] 🔑 Storing Gmail token: service={}, key={}", SERVICE_NAME, GMAIL_TOKEN_KEY);
        
        // In development mode, use file storage as fallback due to keychain issues
        if cfg!(debug_assertions) {
            // println!("[GMAIL] 🔑 Using file storage for development mode");
            return Self::store_token_to_file(token);
        }
        
        let entry = Self::get_keyring_entry(GMAIL_TOKEN_KEY)?;
        // println!("[GMAIL] 🔑 Keyring entry created for Gmail token storage");
        
        let token_json = serde_json::to_string(token)
            .map_err(|e| GmailError::Storage(format!("Failed to serialize Gmail token: {}", e)))?;
        // println!("[GMAIL] 🔑 Gmail token serialized, length: {} chars", token_json.len());
        
        match entry.set_password(&token_json) {
            Ok(_) => {
                // println!("[GMAIL] 🔑 Gmail token stored in keyring successfully");
                Ok(())
            },
            Err(e) => {
                // println!("[GMAIL] 🔑 Failed to store Gmail token: {:?}", e);
                Err(GmailError::Storage(format!("Failed to store Gmail token: {}", e)))
            }
        }
    }

    pub fn get_token() -> Result<Option<GmailToken>, GmailError> {
        // println!("[GMAIL] 🔑 Getting keyring entry for Gmail token: service={}, key={}", SERVICE_NAME, GMAIL_TOKEN_KEY);
        
        // In development mode, use file storage as fallback due to keychain issues
        if cfg!(debug_assertions) {
            // println!("[GMAIL] 🔑 Using file storage for development mode");
            return Self::get_token_from_file();
        }
        
        let entry = Self::get_keyring_entry(GMAIL_TOKEN_KEY)?;
        // println!("[GMAIL] 🔑 Keyring entry created successfully");
        
        match entry.get_password() {
            Ok(token_json) => {
                // println!("[GMAIL] 🔑 Gmail token found in keyring");
                let token: GmailToken = serde_json::from_str(&token_json)
                    .map_err(|e| GmailError::Storage(format!("Failed to deserialize Gmail token: {}", e)))?;
                // println!("[GMAIL] 🔑 Gmail token deserialized successfully");
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => {
                // println!("[GMAIL] 🔑 No Gmail token entry found in keyring");
                Ok(None)
            },
            Err(e) => {
                // println!("[GMAIL] 🔑 Keyring error: {:?}", e);
                Err(GmailError::Storage(format!("Failed to retrieve Gmail token: {}", e)))
            },
        }
    }

    pub fn delete_token() -> Result<(), GmailError> {
        // println!("[GMAIL] 🔑 Deleting Gmail token");
        
        // In development mode, delete from file storage
        if cfg!(debug_assertions) {
            let token_path = Self::get_dev_token_path()?;
            if token_path.exists() {
                std::fs::remove_file(&token_path)
                    .map_err(|e| GmailError::Storage(format!("Failed to delete Gmail token file: {}", e)))?;
                // println!("[GMAIL] 🔑 Gmail token file deleted: {}", token_path.display());
            }
            return Ok(());
        }
        
        let entry = Self::get_keyring_entry(GMAIL_TOKEN_KEY)?;
        entry.delete_credential()
            .map_err(|e| GmailError::Storage(format!("Failed to delete Gmail token: {}", e)))
    }

    pub fn store_profile(profile: &GmailProfile) -> Result<(), GmailError> {
        // println!("[GMAIL] 🔑 Storing Gmail profile");
        
        // In development mode, use file storage
        if cfg!(debug_assertions) {
            return Self::store_profile_to_file(profile);
        }
        
        let entry = Self::get_keyring_entry(GMAIL_PROFILE_KEY)?;
        let profile_json = serde_json::to_string(profile)
            .map_err(|e| GmailError::Storage(format!("Failed to serialize Gmail profile: {}", e)))?;
        entry.set_password(&profile_json)
            .map_err(|e| GmailError::Storage(format!("Failed to store Gmail profile: {}", e)))
    }

    pub fn get_profile() -> Result<Option<GmailProfile>, GmailError> {
        // println!("[GMAIL] 🔑 Getting Gmail profile");
        
        // In development mode, use file storage
        if cfg!(debug_assertions) {
            return Self::get_profile_from_file();
        }
        
        let entry = Self::get_keyring_entry(GMAIL_PROFILE_KEY)?;
        match entry.get_password() {
            Ok(profile_json) => {
                let profile: GmailProfile = serde_json::from_str(&profile_json)
                    .map_err(|e| GmailError::Storage(format!("Failed to deserialize Gmail profile: {}", e)))?;
                Ok(Some(profile))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(GmailError::Storage(format!("Failed to retrieve Gmail profile: {}", e))),
        }
    }

    pub fn delete_profile() -> Result<(), GmailError> {
        // println!("[GMAIL] 🔑 Deleting Gmail profile");
        
        // In development mode, delete from file storage
        if cfg!(debug_assertions) {
            let profile_path = Self::get_dev_profile_path()?;
            if profile_path.exists() {
                std::fs::remove_file(&profile_path)
                    .map_err(|e| GmailError::Storage(format!("Failed to delete Gmail profile file: {}", e)))?;
                // println!("[GMAIL] 🔑 Gmail profile file deleted: {}", profile_path.display());
            }
            return Ok(());
        }
        
        let entry = Self::get_keyring_entry(GMAIL_PROFILE_KEY)?;
        entry.delete_credential()
            .map_err(|e| GmailError::Storage(format!("Failed to delete Gmail profile: {}", e)))
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

    // File-based storage for development mode (keychain workaround)
    fn get_dev_token_path() -> Result<PathBuf, GmailError> {
        let home_dir = dirs::home_dir().ok_or_else(|| GmailError::Storage("Failed to get home directory".to_string()))?;
        let app_dir = home_dir.join(".lokus").join("gmail");
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)
                .map_err(|e| GmailError::Storage(format!("Failed to create Gmail app directory: {}", e)))?;
        }
        Ok(app_dir.join("gmail_token.json"))
    }

    fn store_token_to_file(token: &GmailToken) -> Result<(), GmailError> {
        let token_path = Self::get_dev_token_path()?;
        let token_json = serde_json::to_string(token)
            .map_err(|e| GmailError::Storage(format!("Failed to serialize Gmail token: {}", e)))?;
        
        std::fs::write(&token_path, token_json)
            .map_err(|e| GmailError::Storage(format!("Failed to write Gmail token file: {}", e)))?;
        
        // println!("[GMAIL] 🔑 Gmail token stored to file: {}", token_path.display());
        Ok(())
    }

    fn get_token_from_file() -> Result<Option<GmailToken>, GmailError> {
        let token_path = Self::get_dev_token_path()?;
        
        if !token_path.exists() {
            // println!("[GMAIL] 🔑 Gmail token file does not exist: {}", token_path.display());
            return Ok(None);
        }

        let token_json = std::fs::read_to_string(&token_path)
            .map_err(|e| GmailError::Storage(format!("Failed to read Gmail token file: {}", e)))?;
        
        let token: GmailToken = serde_json::from_str(&token_json)
            .map_err(|e| GmailError::Storage(format!("Failed to deserialize Gmail token: {}", e)))?;
        
        // println!("[GMAIL] 🔑 Gmail token loaded from file: {}", token_path.display());
        Ok(Some(token))
    }

    fn get_dev_profile_path() -> Result<PathBuf, GmailError> {
        let home_dir = dirs::home_dir().ok_or_else(|| GmailError::Storage("Failed to get home directory".to_string()))?;
        let app_dir = home_dir.join(".lokus").join("gmail");
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)
                .map_err(|e| GmailError::Storage(format!("Failed to create Gmail app directory: {}", e)))?;
        }
        Ok(app_dir.join("gmail_profile.json"))
    }

    fn store_profile_to_file(profile: &GmailProfile) -> Result<(), GmailError> {
        let profile_path = Self::get_dev_profile_path()?;
        let profile_json = serde_json::to_string(profile)
            .map_err(|e| GmailError::Storage(format!("Failed to serialize Gmail profile: {}", e)))?;
        
        std::fs::write(&profile_path, profile_json)
            .map_err(|e| GmailError::Storage(format!("Failed to write Gmail profile file: {}", e)))?;
        
        // println!("[GMAIL] 🔑 Gmail profile stored to file: {}", profile_path.display());
        Ok(())
    }

    fn get_profile_from_file() -> Result<Option<GmailProfile>, GmailError> {
        let profile_path = Self::get_dev_profile_path()?;
        
        if !profile_path.exists() {
            // println!("[GMAIL] 🔑 Gmail profile file does not exist: {}", profile_path.display());
            return Ok(None);
        }

        let profile_json = std::fs::read_to_string(&profile_path)
            .map_err(|e| GmailError::Storage(format!("Failed to read Gmail profile file: {}", e)))?;
        
        let profile: GmailProfile = serde_json::from_str(&profile_json)
            .map_err(|e| GmailError::Storage(format!("Failed to deserialize Gmail profile: {}", e)))?;
        
        // println!("[GMAIL] 🔑 Gmail profile loaded from file: {}", profile_path.display());
        Ok(Some(profile))
    }
}