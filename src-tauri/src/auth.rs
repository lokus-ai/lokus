use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter};
use std::collections::HashMap;
use url::Url;

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

const SERVICE_NAME: &str = "Lokus";
const TOKEN_KEY: &str = "auth_token";
const USER_KEY: &str = "user_profile";

pub struct AuthManager;

impl AuthManager {
    pub fn new() -> Self {
        Self
    }

    fn get_entry(key: &str) -> Result<Entry, String> {
        Entry::new(SERVICE_NAME, key).map_err(|e| format!("Failed to create keyring entry: {}", e))
    }

    pub fn store_token(token: &AuthToken) -> Result<(), String> {
        let entry = Self::get_entry(TOKEN_KEY)?;
        let token_json = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token: {}", e))?;
        
        entry.set_password(&token_json)
            .map_err(|e| format!("Failed to store token: {}", e))
    }

    pub fn get_token() -> Result<Option<AuthToken>, String> {
        let entry = Self::get_entry(TOKEN_KEY)?;
        match entry.get_password() {
            Ok(token_json) => {
                let token: AuthToken = serde_json::from_str(&token_json)
                    .map_err(|e| format!("Failed to deserialize token: {}", e))?;
                Ok(Some(token))
            }
            Err(_) => Ok(None),
        }
    }

    pub fn store_user_profile(profile: &UserProfile) -> Result<(), String> {
        let entry = Self::get_entry(USER_KEY)?;
        let profile_json = serde_json::to_string(profile)
            .map_err(|e| format!("Failed to serialize profile: {}", e))?;
        
        entry.set_password(&profile_json)
            .map_err(|e| format!("Failed to store profile: {}", e))
    }

    pub fn get_user_profile() -> Result<Option<UserProfile>, String> {
        let entry = Self::get_entry(USER_KEY)?;
        match entry.get_password() {
            Ok(profile_json) => {
                let profile: UserProfile = serde_json::from_str(&profile_json)
                    .map_err(|e| format!("Failed to deserialize profile: {}", e))?;
                Ok(Some(profile))
            }
            Err(_) => Ok(None),
        }
    }

    pub fn clear_auth_data() -> Result<(), String> {
        let token_entry = Self::get_entry(TOKEN_KEY)?;
        let profile_entry = Self::get_entry(USER_KEY)?;
        
        let _ = token_entry.delete_credential();
        let _ = profile_entry.delete_credential();
        
        Ok(())
    }
}

#[command]
pub async fn store_auth_token(token: AuthToken) -> Result<(), String> {
    AuthManager::store_token(&token)
}

#[command]
pub async fn get_auth_token() -> Result<Option<AuthToken>, String> {
    AuthManager::get_token()
}

#[command]
pub async fn store_user_profile(profile: UserProfile) -> Result<(), String> {
    AuthManager::store_user_profile(&profile)
}

#[command]
pub async fn get_user_profile() -> Result<Option<UserProfile>, String> {
    AuthManager::get_user_profile()
}

#[command]
pub async fn logout() -> Result<(), String> {
    AuthManager::clear_auth_data()
}

#[command]
pub async fn is_authenticated() -> Result<bool, String> {
    match AuthManager::get_token()? {
        Some(token) => {
            // Check if token is expired
            if let Some(expires_at) = token.expires_at {
                let now = chrono::Utc::now().timestamp();
                Ok(now < expires_at)
            } else {
                Ok(true)
            }
        }
        None => Ok(false)
    }
}

#[command]
pub async fn open_auth_url(auth_url: String) -> Result<(), String> {
    let url = format!("{}?redirect=lokus://auth-callback", auth_url);
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    Ok(())
}

pub fn handle_deep_link(app: &AppHandle, url: String) -> Result<(), String> {
    println!("Received deep link: {}", url);
    
    if url.starts_with("lokus://auth-callback") {
        let parsed_url = Url::parse(&url)
            .map_err(|e| format!("Failed to parse URL: {}", e))?;
        
        let mut params: HashMap<String, String> = HashMap::new();
        for (key, value) in parsed_url.query_pairs() {
            params.insert(key.to_string(), value.to_string());
        }
        
        // Emit event to frontend with auth data
        app.emit("auth-callback", params)
            .map_err(|e| format!("Failed to emit auth event: {}", e))?;
    }
    
    Ok(())
}

pub fn register_deep_link_handler(app: &AppHandle) {
    // Deep links are now handled through the frontend using the plugin
    // The main.rs already initializes the plugin
    println!("Deep link handler registered for lokus:// scheme");
}