use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::calendar::models::{CalendarToken, CalendarAccount, CalendarProvider, CalendarError};
use crate::calendar::storage::CalendarStorage;
use reqwest::Client;
use serde_json;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};
use sha2::{Sha256, Digest};
use chrono::Utc;

pub struct GoogleCalendarAuth {
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

impl GoogleCalendarAuth {
    pub fn new() -> Result<Self, CalendarError> {
        let client_id = std::env::var("GOOGLE_CLIENT_ID")
            .map_err(|_| CalendarError::Auth("GOOGLE_CLIENT_ID environment variable not set".to_string()))?;

        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET")
            .map_err(|_| CalendarError::Auth("GOOGLE_CLIENT_SECRET environment variable not set".to_string()))?;

        // Use OAuth server port for callback (same as Gmail)
        let oauth_port = std::env::var("OAUTH_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(9080);

        Ok(Self {
            client_id,
            client_secret,
            redirect_uri: format!("http://localhost:{}/calendar-callback", oauth_port),
        })
    }

    pub fn generate_pkce_pair() -> (String, String) {
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

        (code_verifier, code_challenge)
    }

    pub fn generate_state() -> String {
        general_purpose::URL_SAFE_NO_PAD.encode(Uuid::new_v4().as_bytes())
    }

    pub fn generate_auth_url(&self, pkce_data: &PKCEData) -> Result<String, CalendarError> {
        // Request calendar read/write and user info scopes
        let scopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
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

        Ok(auth_url)
    }

    pub async fn exchange_code_for_token(
        &self,
        code: &str,
        code_verifier: &str,
    ) -> Result<CalendarToken, CalendarError> {
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
            return Err(CalendarError::Auth(format!("Token exchange failed: {}", error_text)));
        }

        let token_data: serde_json::Value = response.json().await?;

        let access_token = token_data["access_token"]
            .as_str()
            .ok_or_else(|| CalendarError::Auth("No access token in response".to_string()))?;

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

        let token = CalendarToken {
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
        CalendarStorage::store_google_token(&token)?;

        Ok(token)
    }

    pub async fn refresh_token(&self, refresh_token: &str) -> Result<CalendarToken, CalendarError> {
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
            // If refresh fails, delete stored token
            let _ = CalendarStorage::delete_google_token();
            let _ = CalendarStorage::delete_google_account();

            return Err(CalendarError::TokenExpired);
        }

        let token_data: serde_json::Value = response.json().await?;

        let access_token = token_data["access_token"]
            .as_str()
            .ok_or_else(|| CalendarError::Auth("No access token in refresh response".to_string()))?;

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

        let token = CalendarToken {
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
        CalendarStorage::store_google_token(&token)?;

        Ok(token)
    }

    pub async fn get_valid_token(&self) -> Result<CalendarToken, CalendarError> {
        let token = match CalendarStorage::get_google_token()? {
            Some(token) => token,
            None => {
                return Err(CalendarError::NotConnected);
            }
        };

        // Check if token is expired
        if CalendarStorage::is_token_expired(&token) {
            if let Some(refresh_token) = &token.refresh_token {
                match self.refresh_token(refresh_token).await {
                    Ok(new_token) => {
                        return Ok(new_token);
                    }
                    Err(e) => {
                        return Err(e);
                    }
                }
            } else {
                return Err(CalendarError::TokenExpired);
            }
        }

        Ok(token)
    }

    pub async fn fetch_and_store_account(&self, token: &CalendarToken) -> Result<CalendarAccount, CalendarError> {
        let client = Client::new();

        // Get user info
        let userinfo_response = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !userinfo_response.status().is_success() {
            let error_text = userinfo_response.text().await.unwrap_or_default();
            return Err(CalendarError::Api(format!("Failed to fetch user info: {}", error_text)));
        }

        let userinfo: serde_json::Value = userinfo_response.json().await?;

        let account = CalendarAccount {
            id: userinfo["id"]
                .as_str()
                .ok_or_else(|| CalendarError::Api("No user ID in response".to_string()))?
                .to_string(),
            provider: CalendarProvider::Google,
            email: userinfo["email"]
                .as_str()
                .ok_or_else(|| CalendarError::Api("No email in user info".to_string()))?
                .to_string(),
            is_connected: true,
            connected_at: Some(Utc::now()),
        };

        // Store the account
        CalendarStorage::store_google_account(&account)?;

        Ok(account)
    }

    #[allow(dead_code)]
    pub async fn revoke_token(&self, token: &str) -> Result<(), CalendarError> {
        let client = Client::new();
        let _response = client
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token)])
            .send()
            .await?;

        // Delete Google-specific storage only (not CalDAV/iCal)
        CalendarStorage::delete_google_token()?;
        CalendarStorage::delete_google_account()?;
        // Note: Don't call delete_calendars() - that deletes ALL providers!
        // The caller should handle removing only Google calendars from the list

        Ok(())
    }

    /// Revoke token with Google without touching local storage
    /// Used by disconnect flow which handles storage deletion separately
    pub async fn revoke_token_only(&self, token: &str) -> Result<(), CalendarError> {
        let client = Client::new();
        let response = client
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token)])
            .send()
            .await?;

        if !response.status().is_success() {
            // Log but don't fail - local cleanup is what matters
            println!("[Calendar] Token revocation returned status: {}", response.status());
        }

        Ok(())
    }

    pub fn is_authenticated(&self) -> Result<bool, CalendarError> {
        match CalendarStorage::get_google_token()? {
            Some(token) => Ok(!CalendarStorage::is_token_expired(&token)),
            None => Ok(false),
        }
    }
}
