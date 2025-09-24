use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::connections::gmail::models::{GmailToken, GmailProfile, GmailError};
use crate::connections::gmail::storage::GmailStorage;
use reqwest::Client;
use serde_json;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};
use sha2::{Sha256, Digest};

pub struct GmailAuth {
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

#[derive(Debug, Clone)]
pub struct PKCEData {
    pub code_verifier: String,
    pub code_challenge: String,
    pub state: String,
}

impl GmailAuth {
    pub fn new() -> Result<Self, GmailError> {
        let client_id = std::env::var("GOOGLE_CLIENT_ID")
            .map_err(|_| GmailError::Auth("GOOGLE_CLIENT_ID environment variable not set".to_string()))?;
        
        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET")
            .map_err(|_| GmailError::Auth("GOOGLE_CLIENT_SECRET environment variable not set".to_string()))?;
        
        Ok(Self {
            client_id,
            client_secret,
            redirect_uri: "http://localhost:8080/gmail-callback".to_string(),
        })
    }

    pub fn generate_pkce_pair() -> (String, String) {
        println!("[GMAIL] 🔐 Generating PKCE pair for Gmail OAuth");
        
        // Generate code verifier (43-128 chars, URL-safe)
        let random_bytes = Uuid::new_v4().as_bytes().to_vec();
        let code_verifier = general_purpose::URL_SAFE_NO_PAD
            .encode(&random_bytes)
            .chars()
            .take(128)
            .collect::<String>();

        // Generate code challenge (SHA256 hash of verifier, base64url encoded)
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let challenge_bytes = hasher.finalize();
        let code_challenge = general_purpose::URL_SAFE_NO_PAD.encode(challenge_bytes);

        println!("[GMAIL] 🔐 PKCE pair generated successfully");
        (code_verifier, code_challenge)
    }

    pub fn generate_state() -> String {
        general_purpose::URL_SAFE_NO_PAD.encode(Uuid::new_v4().as_bytes())
    }

    pub fn generate_auth_url(&self, pkce_data: &PKCEData) -> Result<String, GmailError> {
        println!("[GMAIL] 🔐 Generating Gmail OAuth URL");
        
        let scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ].join(" ");

        let mut params = HashMap::new();
        params.insert("client_id", self.client_id.as_str());
        params.insert("response_type", "code");
        params.insert("scope", &scopes);
        params.insert("redirect_uri", &self.redirect_uri);
        params.insert("state", &pkce_data.state);
        params.insert("code_challenge", &pkce_data.code_challenge);
        params.insert("code_challenge_method", "S256");
        params.insert("access_type", "offline");
        params.insert("prompt", "consent");

        let query_string = params
            .iter()
            .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&");

        let auth_url = format!("https://accounts.google.com/o/oauth2/v2/auth?{}", query_string);
        println!("[GMAIL] 🔐 Gmail OAuth URL generated successfully");
        
        Ok(auth_url)
    }

    pub async fn exchange_code_for_token(
        &self,
        code: &str,
        code_verifier: &str,
    ) -> Result<GmailToken, GmailError> {
        println!("[GMAIL] 🔄 Starting Gmail token exchange");
        
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("client_id", self.client_id.as_str());
        params.insert("client_secret", self.client_secret.as_str());
        params.insert("code", code);
        params.insert("grant_type", "authorization_code");
        params.insert("redirect_uri", &self.redirect_uri);
        params.insert("code_verifier", code_verifier);

        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            println!("[GMAIL] ❌ Token exchange failed: {}", error_text);
            return Err(GmailError::Auth(format!("Token exchange failed: {}", error_text)));
        }

        let token_data: serde_json::Value = response.json().await?;
        println!("[GMAIL] ✅ Token exchange successful");

        let access_token = token_data["access_token"]
            .as_str()
            .ok_or_else(|| GmailError::Auth("No access token in response".to_string()))?;

        let refresh_token = token_data["refresh_token"]
            .as_str()
            .map(|s| s.to_string());

        let expires_in = token_data["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() + expires_in;

        let scope = token_data["scope"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let token = GmailToken {
            access_token: access_token.to_string(),
            refresh_token,
            expires_at: Some(expires_at),
            scope,
            token_type: token_data["token_type"]
                .as_str()
                .unwrap_or("Bearer")
                .to_string(),
        };

        // Store the token
        GmailStorage::store_token(&token)?;
        println!("[GMAIL] 💾 Gmail token stored successfully");

        Ok(token)
    }

    pub async fn refresh_token(&self, refresh_token: &str) -> Result<GmailToken, GmailError> {
        println!("[GMAIL] 🔄 Refreshing Gmail token");
        
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("client_id", self.client_id.as_str());
        params.insert("client_secret", self.client_secret.as_str());
        params.insert("refresh_token", refresh_token);
        params.insert("grant_type", "refresh_token");

        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            println!("[GMAIL] ❌ Token refresh failed: {}", error_text);
            
            // If refresh fails, delete stored token
            let _ = GmailStorage::delete_token();
            let _ = GmailStorage::delete_profile();
            
            return Err(GmailError::TokenExpired);
        }

        let token_data: serde_json::Value = response.json().await?;
        println!("[GMAIL] ✅ Gmail token refreshed successfully");

        let access_token = token_data["access_token"]
            .as_str()
            .ok_or_else(|| GmailError::Auth("No access token in refresh response".to_string()))?;

        // Use the new refresh token if provided, otherwise keep the existing one
        let new_refresh_token = token_data["refresh_token"]
            .as_str()
            .map(|s| s.to_string())
            .or_else(|| Some(refresh_token.to_string()));

        let expires_in = token_data["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() + expires_in;

        let scope = token_data["scope"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let token = GmailToken {
            access_token: access_token.to_string(),
            refresh_token: new_refresh_token,
            expires_at: Some(expires_at),
            scope,
            token_type: token_data["token_type"]
                .as_str()
                .unwrap_or("Bearer")
                .to_string(),
        };

        // Store the refreshed token
        GmailStorage::store_token(&token)?;
        println!("[GMAIL] 💾 Refreshed Gmail token stored successfully");

        Ok(token)
    }

    pub async fn get_valid_token(&self) -> Result<GmailToken, GmailError> {
        // println!("[GMAIL] 🔍 Getting valid Gmail token");
        
        let token = match GmailStorage::get_token()? {
            Some(token) => token,
            None => {
                println!("[GMAIL] ❌ No Gmail token found");
                return Err(GmailError::Auth("No Gmail token found - please authenticate".to_string()));
            }
        };

        // Check if token is expired
        if GmailStorage::is_token_expired(&token) {
            println!("[GMAIL] ⏰ Gmail token is expired, attempting refresh");
            
            if let Some(refresh_token) = &token.refresh_token {
                match self.refresh_token(refresh_token).await {
                    Ok(new_token) => {
                        println!("[GMAIL] ✅ Gmail token refreshed successfully");
                        return Ok(new_token);
                    }
                    Err(e) => {
                        println!("[GMAIL] ❌ Failed to refresh Gmail token: {:?}", e);
                        return Err(e);
                    }
                }
            } else {
                println!("[GMAIL] ❌ No refresh token available");
                return Err(GmailError::TokenExpired);
            }
        }

        // println!("[GMAIL] ✅ Valid Gmail token found");
        Ok(token)
    }

    pub async fn fetch_and_store_profile(&self, token: &GmailToken) -> Result<GmailProfile, GmailError> {
        println!("[GMAIL] 👤 Fetching Gmail profile");
        
        let client = Client::new();
        
        // Get user info
        let userinfo_response = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !userinfo_response.status().is_success() {
            let error_text = userinfo_response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to fetch user info: {}", error_text)));
        }

        let userinfo: serde_json::Value = userinfo_response.json().await?;
        
        // Get Gmail profile
        let gmail_response = client
            .get("https://gmail.googleapis.com/gmail/v1/users/me/profile")
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !gmail_response.status().is_success() {
            let error_text = gmail_response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to fetch Gmail profile: {}", error_text)));
        }

        let gmail_profile: serde_json::Value = gmail_response.json().await?;

        let profile = GmailProfile {
            email_address: userinfo["email"]
                .as_str()
                .ok_or_else(|| GmailError::Api("No email in user info".to_string()))?
                .to_string(),
            messages_total: gmail_profile["messagesTotal"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            threads_total: gmail_profile["threadsTotal"]
                .as_str()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            history_id: gmail_profile["historyId"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        };

        // Store the profile
        GmailStorage::store_profile(&profile)?;
        println!("[GMAIL] 💾 Gmail profile stored successfully");

        Ok(profile)
    }

    pub async fn revoke_token(&self, token: &str) -> Result<(), GmailError> {
        println!("[GMAIL] 🗑️ Revoking Gmail token");
        
        let client = Client::new();
        let response = client
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token)])
            .send()
            .await?;

        if response.status().is_success() {
            println!("[GMAIL] ✅ Gmail token revoked successfully");
        } else {
            println!("[GMAIL] ⚠️ Gmail token revocation may have failed (continuing anyway)");
        }

        // Delete local storage regardless of revocation result
        GmailStorage::delete_token()?;
        GmailStorage::delete_profile()?;
        
        println!("[GMAIL] 🗑️ Local Gmail data cleared");
        Ok(())
    }

    pub fn is_authenticated(&self) -> Result<bool, GmailError> {
        match GmailStorage::get_token()? {
            Some(token) => Ok(!GmailStorage::is_token_expired(&token)),
            None => Ok(false),
        }
    }

    #[allow(dead_code)]
    pub async fn test_token_validity(&self, token: &GmailToken) -> Result<bool, GmailError> {
        println!("[GMAIL] 🧪 Testing Gmail token validity");
        
        let client = Client::new();
        let response = client
            .get("https://gmail.googleapis.com/gmail/v1/users/me/profile")
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        let is_valid = response.status().is_success();
        println!("[GMAIL] 🧪 Gmail token validity test: {}", if is_valid { "VALID" } else { "INVALID" });
        
        Ok(is_valid)
    }
}