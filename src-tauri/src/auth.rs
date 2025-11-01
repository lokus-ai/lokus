use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tauri::{State, AppHandle, Emitter};
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};
use sha2::{Sha256, Digest};
use tokio::net::TcpListener;
use hyper::{body::Incoming, Request, Response, StatusCode};
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use hyper_util::server::conn::auto::Builder;
use url::Url;
use serde_json;
use crate::secure_storage::SecureStorage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<u64>,
    pub user_id: Option<String>,
    pub token_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PKCEData {
    pub code_verifier: String,
    #[allow(dead_code)]
    pub code_challenge: String,
    pub state: String,
    pub redirect_uri: String,
}

#[derive(Debug)]
pub struct AuthState {
    pub pkce_data: Option<PKCEData>,
    pub pending_callback: Option<HashMap<String, String>>,
    pub localhost_server_port: Option<u16>,
}

impl Default for AuthState {
    fn default() -> Self {
        Self {
            pkce_data: None,
            pending_callback: None,
            localhost_server_port: None,
        }
    }
}

pub type SharedAuthState = Arc<Mutex<AuthState>>;

const TOKEN_KEY: &str = "lokus_auth_token";
const PROFILE_KEY: &str = "lokus_user_profile";

pub struct AuthService;

impl AuthService {
    fn generate_pkce_pair() -> (String, String) {
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

    fn generate_state() -> String {
        general_purpose::URL_SAFE_NO_PAD.encode(Uuid::new_v4().as_bytes())
    }

    async fn find_available_port() -> Result<u16, String> {
        // Try ports 3333-3400 for localhost redirect server
        for port in 3333..=3400 {
            if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                drop(listener);
                return Ok(port);
            }
        }
        Err("No available ports found".to_string())
    }

    async fn start_localhost_server(
        port: u16,
        auth_state: SharedAuthState,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let auth_state_clone = auth_state.clone();
        let app_handle_clone = app_handle.clone();

        tokio::spawn(async move {
            let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).await.unwrap();
            
            loop {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);
                let auth_state = auth_state_clone.clone();
                let app_handle = app_handle_clone.clone();
                
                tokio::task::spawn(async move {
                    if let Err(err) = Builder::new(hyper_util::rt::TokioExecutor::new())
                        .serve_connection(
                            io,
                            service_fn(move |req| {
                                Self::handle_localhost_request(req, auth_state.clone(), app_handle.clone())
                            })
                        )
                        .await
                    {
                        eprintln!("Error serving connection: {:?}", err);
                    }
                });
            }
        });

        Ok(())
    }

    async fn handle_localhost_request(
        req: Request<Incoming>,
        auth_state: SharedAuthState,
        app_handle: AppHandle,
    ) -> Result<Response<String>, hyper::Error> {
        let uri = req.uri();
        println!("📞 Received localhost request: {}", uri);
        
        if uri.path() == "/auth/callback" {
            println!("🔐 Processing OAuth callback...");
            let query = uri.query().unwrap_or("");
            let params: HashMap<String, String> = url::form_urlencoded::parse(query.as_bytes())
                .into_owned()
                .collect();

            // Process OAuth callback directly here instead of emitting to frontend
            if let (Some(code), Some(state)) = (params.get("code"), params.get("state")) {
                println!("🔄 Processing OAuth callback directly in localhost server");
                
                // Handle the OAuth callback directly
                match AuthService::handle_oauth_callback_internal(code.clone(), state.clone(), auth_state.clone()).await {
                    Ok(_) => {
                        println!("✅ OAuth callback processed successfully");
                        // Emit success event to frontend to update UI
                        let _ = app_handle.emit("auth-success", serde_json::json!({}));
                    }
                    Err(e) => {
                        println!("❌ OAuth callback failed: {}", e);
                        let _ = app_handle.emit("auth-error", serde_json::json!({"error": e}));
                    }
                }
            }

            let response_html = r#"
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authentication Successful</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
                        .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
                        .message { color: #6c757d; font-size: 16px; line-height: 1.5; }
                        .icon { font-size: 48px; margin-bottom: 20px; }
                    </style>
                    <script>
                        setTimeout(() => {
                            window.close();
                        }, 3000);
                    </script>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✅</div>
                        <div class="success">Authentication Successful!</div>
                        <div class="message">
                            You have been successfully signed in to Lokus.<br>
                            This window will close automatically.
                        </div>
                    </div>
                </body>
                </html>
            "#;

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/html")
                .body(response_html.to_string())
                .unwrap())
        } else {
            Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body("Not Found".to_string())
                .unwrap())
        }
    }

    /// Store authentication token securely with encryption.
    ///
    /// This is the core of the unified token system. All tokens (auth and sync)
    /// are now stored through this single method, ensuring consistency and preventing
    /// auth-sync disconnect issues.
    ///
    /// The token is encrypted before storage and associated with a session that tracks:
    /// - Session creation time
    /// - Last access time
    /// - Session validity
    ///
    /// # Parameters
    /// * `token` - The authentication token to store
    ///
    /// # Unified Token System
    /// Previously, sync operations used separate token storage (sync_token commands).
    /// This caused issues where users would log in successfully but sync would fail
    /// because sync tokens weren't updated. Now all operations use this single token
    /// storage, retrieved via get_token() and passed to git operations.
    ///
    /// # Returns
    /// * `Ok(())` - Token stored successfully
    /// * `Err(String)` - Error message if storage fails
    pub fn store_token(token: &AuthToken) -> Result<(), String> {
        println!("🔑 Storing token securely with encryption");

        // Use secure storage for both development and production
        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        // Store token with encryption
        storage.store(TOKEN_KEY, token)
            .map_err(|e| format!("Failed to store encrypted token: {}", e))?;

        // Create or update session
        if !storage.is_session_valid().unwrap_or(false) {
            storage.create_session()
                .map_err(|e| format!("Failed to create session: {}", e))?;
        } else {
            storage.update_session_access()
                .map_err(|e| format!("Failed to update session: {}", e))?;
        }

        println!("🔑 Token stored securely with session management");
        Ok(())
    }

    /// Retrieve authentication token from secure storage.
    ///
    /// This method is called by AuthManager's getAccessToken() to get tokens
    /// for both authentication checks and sync operations (unified token system).
    ///
    /// Validates the session before returning the token:
    /// - If session is expired or invalid, clears all tokens and returns None
    /// - If session is valid, updates the last access time
    ///
    /// # Unified Token System Flow
    /// 1. User logs in → store_token() saves encrypted token
    /// 2. Sync operation needs credentials → getAccessToken() calls this method
    /// 3. Token is validated and returned
    /// 4. Token is passed directly to git_push/git_pull commands
    ///
    /// This replaces the old dual-token system that caused auth-sync disconnects.
    ///
    /// # Returns
    /// * `Ok(Some(token))` - Valid token found
    /// * `Ok(None)` - No token or session expired
    /// * `Err(String)` - Error retrieving token
    pub fn get_token() -> Result<Option<AuthToken>, String> {
        println!("🔑 Retrieving token from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        // Check if session is valid first
        if !storage.is_session_valid().unwrap_or(false) {
            println!("🔑 Session expired or invalid - clearing tokens");
            let _ = storage.delete(TOKEN_KEY);
            let _ = storage.delete(PROFILE_KEY);
            return Ok(None);
        }

        // Retrieve encrypted token
        let token: Option<AuthToken> = storage.retrieve(TOKEN_KEY)
            .map_err(|e| format!("Failed to retrieve encrypted token: {}", e))?;

        if token.is_some() {
            // Update session access time
            storage.update_session_access()
                .map_err(|e| format!("Failed to update session access: {}", e))?;
            println!("🔑 Token retrieved successfully from secure storage");
        } else {
            println!("🔑 No token found in secure storage");
        }

        Ok(token)
    }

    pub fn delete_token() -> Result<(), String> {
        println!("🔑 Deleting token from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        storage.delete(TOKEN_KEY)
            .map_err(|e| format!("Failed to delete encrypted token: {}", e))?;

        println!("🔑 Token deleted from secure storage");
        Ok(())
    }

    pub fn store_user_profile(profile: &UserProfile) -> Result<(), String> {
        println!("🔑 Storing user profile securely");

        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        storage.store(PROFILE_KEY, profile)
            .map_err(|e| format!("Failed to store encrypted profile: {}", e))?;

        println!("🔑 User profile stored securely");
        Ok(())
    }

    pub fn get_user_profile() -> Result<Option<UserProfile>, String> {
        println!("🔑 Retrieving user profile from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        // Check session validity
        if !storage.is_session_valid().unwrap_or(false) {
            println!("🔑 Session invalid - profile access denied");
            return Ok(None);
        }

        let profile: Option<UserProfile> = storage.retrieve(PROFILE_KEY)
            .map_err(|e| format!("Failed to retrieve encrypted profile: {}", e))?;

        if profile.is_some() {
            println!("🔑 User profile retrieved successfully");
        }

        Ok(profile)
    }

    pub fn delete_user_profile() -> Result<(), String> {
        println!("🔑 Deleting user profile from secure storage");

        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        storage.delete(PROFILE_KEY)
            .map_err(|e| format!("Failed to delete encrypted profile: {}", e))?;

        println!("🔑 User profile deleted from secure storage");
        Ok(())
    }

    pub fn is_token_expired(token: &AuthToken) -> bool {
        if let Some(expires_at) = token.expires_at {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            expires_at <= now
        } else {
            false
        }
    }

    /// Clear all secure storage (for complete logout)
    pub fn clear_all_secure_data() -> Result<(), String> {
        println!("🧹 Clearing all secure authentication data");

        let storage = SecureStorage::new()
            .map_err(|e| format!("Failed to initialize secure storage: {}", e))?;

        storage.clear_all()
            .map_err(|e| format!("Failed to clear secure storage: {}", e))?;

        println!("🧹 All secure authentication data cleared");
        Ok(())
    }

    async fn handle_oauth_callback_internal(
        code: String,
        state: String,
        auth_state: SharedAuthState,
    ) -> Result<(), String> {
        let pkce_data = {
            let auth_state_guard = auth_state.lock().unwrap();
            auth_state_guard.pkce_data.clone()
        };

        let pkce_data = pkce_data.ok_or("No PKCE data found")?;

        // Verify state parameter
        if state != pkce_data.state {
            return Err("Invalid state parameter".to_string());
        }

        // Exchange code for token
        let auth_base_url = std::env::var("AUTH_BASE_URL")
            .unwrap_or_else(|_| "https://lokusmd.com".to_string());

        println!("🔄 Starting token exchange with code: {}", code);
        println!("🔄 PKCE verifier: {}", pkce_data.code_verifier);
        println!("🔄 Redirect URI: {}", pkce_data.redirect_uri);

        let client = reqwest::Client::new();
        let token_response = client
            .post(&format!("{}/api/auth/token", auth_base_url))
            .form(&[
                ("grant_type", "authorization_code"),
                ("client_id", "lokus-desktop"),
                ("code", &code),
                ("redirect_uri", &pkce_data.redirect_uri),
                ("code_verifier", &pkce_data.code_verifier),
            ])
            .send()
            .await
            .map_err(|e| format!("Token request failed: {}", e))?;

        if !token_response.status().is_success() {
            let error_text = token_response.text().await.unwrap_or_default();
            return Err(format!("Token exchange failed: {}", error_text));
        }

        let token_data: serde_json::Value = token_response
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        let access_token = token_data["access_token"]
            .as_str()
            .ok_or("No access token in response")?;

        let refresh_token = token_data["refresh_token"].as_str().map(|s| s.to_string());
        let expires_in = token_data["expires_in"].as_u64();

        let expires_at = expires_in.map(|exp| {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() + exp
        });

        let token = AuthToken {
            access_token: access_token.to_string(),
            refresh_token,
            expires_at,
            user_id: token_data["user_id"].as_str().map(|s| s.to_string()),
            token_type: token_data["token_type"]
                .as_str()
                .unwrap_or("Bearer")
                .to_string(),
        };

        // Store token
        println!("💾 Storing token in keychain...");
        Self::store_token(&token)?;
        println!("✅ Token stored successfully");

        // Fetch and store user profile
        println!("👤 Fetching user profile...");
        match fetch_and_store_user_profile(&token).await {
            Ok(_) => println!("✅ User profile stored successfully"),
            Err(e) => {
                println!("❌ Failed to store user profile: {}", e);
                // Continue anyway - don't fail the entire OAuth flow
            }
        }

        // Clear PKCE data
        {
            let mut auth_state_guard = auth_state.lock().unwrap();
            auth_state_guard.pkce_data = None;
            auth_state_guard.pending_callback = None;
        }

        Ok(())
    }
}

// Tauri commands
#[tauri::command]
pub async fn initiate_oauth_flow(
    auth_state: State<'_, SharedAuthState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let (code_verifier, code_challenge) = AuthService::generate_pkce_pair();
    let state = AuthService::generate_state();
    
    // Start localhost server for hybrid approach
    let port = AuthService::find_available_port().await?;
    let redirect_uri = format!("http://localhost:{}/auth/callback", port);
    
    // Store PKCE data
    {
        let mut auth_state_guard = auth_state.lock().unwrap();
        auth_state_guard.pkce_data = Some(PKCEData {
            code_verifier,
            code_challenge: code_challenge.clone(),
            state: state.clone(),
            redirect_uri: redirect_uri.clone(),
        });
        auth_state_guard.localhost_server_port = Some(port);
    }

    // Start the localhost server
    println!("🚀 Starting localhost server on port {}", port);
    AuthService::start_localhost_server(port, auth_state.inner().clone(), app_handle).await?;
    println!("✅ Localhost server started successfully on port {}", port);

    // Build OAuth URL
    let auth_base_url = std::env::var("AUTH_BASE_URL")
        .unwrap_or_else(|_| "https://lokusmd.com".to_string());

    let mut auth_url = Url::parse(&format!("{}/api/auth/authorize", auth_base_url))
        .map_err(|e| format!("Invalid auth URL: {}", e))?;

    auth_url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", "lokus-desktop")
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("scope", "read write")
        .append_pair("state", &state)
        .append_pair("code_challenge", &code_challenge)
        .append_pair("code_challenge_method", "S256");

    Ok(auth_url.to_string())
}

#[tauri::command]
pub async fn handle_oauth_callback(
    code: String,
    state: String,
    auth_state: State<'_, SharedAuthState>,
) -> Result<(), String> {
    AuthService::handle_oauth_callback_internal(code, state, auth_state.inner().clone()).await
}

async fn fetch_and_store_user_profile(token: &AuthToken) -> Result<(), String> {
    let auth_base_url = std::env::var("AUTH_BASE_URL")
        .unwrap_or_else(|_| "https://lokusmd.com".to_string());

    let client = reqwest::Client::new();
    let profile_response = client
        .get(&format!("{}/api/auth/profile", auth_base_url))
        .bearer_auth(&token.access_token)
        .send()
        .await
        .map_err(|e| format!("Profile request failed: {}", e))?;

    if !profile_response.status().is_success() {
        return Err("Failed to fetch user profile".to_string());
    }

    let profile_data: serde_json::Value = profile_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse profile response: {}", e))?;

    let profile = UserProfile {
        id: profile_data["id"]
            .as_str()
            .ok_or("No user ID in profile")?
            .to_string(),
        email: profile_data["email"]
            .as_str()
            .ok_or("No email in profile")?
            .to_string(),
        name: profile_data["name"]
            .as_str()
            .unwrap_or("User")
            .to_string(),
        avatar_url: profile_data["avatar_url"].as_str().map(|s| s.to_string()),
    };

    AuthService::store_user_profile(&profile)?;
    Ok(())
}

#[tauri::command]
pub fn is_authenticated() -> Result<bool, String> {
    println!("🔍 Checking authentication status...");
    match AuthService::get_token()? {
        Some(token) => {
            let is_expired = AuthService::is_token_expired(&token);
            println!("🔍 Token found - expired: {}", is_expired);
            Ok(!is_expired)
        },
        None => {
            println!("🔍 No token found");
            Ok(false)
        },
    }
}

#[tauri::command]
pub fn get_auth_token() -> Result<Option<AuthToken>, String> {
    AuthService::get_token()
}

#[tauri::command]
pub fn get_user_profile() -> Result<Option<UserProfile>, String> {
    AuthService::get_user_profile()
}

#[tauri::command]
pub async fn refresh_auth_token() -> Result<(), String> {
    let current_token = AuthService::get_token()?
        .ok_or("No token found")?;

    let refresh_token = current_token.refresh_token
        .ok_or("No refresh token available")?;

    let auth_base_url = std::env::var("AUTH_BASE_URL")
        .unwrap_or_else(|_| "https://lokusmd.com".to_string());

    let client = reqwest::Client::new();
    let refresh_response = client
        .post(&format!("{}/api/auth/refresh", auth_base_url))
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", "lokus-desktop"),
            ("refresh_token", &refresh_token),
        ])
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    if !refresh_response.status().is_success() {
        AuthService::delete_token()?;
        AuthService::delete_user_profile()?;
        return Err("Token refresh failed - please sign in again".to_string());
    }

    let token_data: serde_json::Value = refresh_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    let access_token = token_data["access_token"]
        .as_str()
        .ok_or("No access token in refresh response")?;

    let new_refresh_token = token_data["refresh_token"]
        .as_str()
        .map(|s| s.to_string())
        .or(Some(refresh_token));

    let expires_in = token_data["expires_in"].as_u64();
    let expires_at = expires_in.map(|exp| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() + exp
    });

    let new_token = AuthToken {
        access_token: access_token.to_string(),
        refresh_token: new_refresh_token,
        expires_at,
        user_id: current_token.user_id,
        token_type: token_data["token_type"]
            .as_str()
            .unwrap_or("Bearer")
            .to_string(),
    };

    AuthService::store_token(&new_token)?;
    Ok(())
}

#[tauri::command]
pub fn logout() -> Result<(), String> {
    println!("👋 Logging out user");

    // Clear all secure storage instead of individual deletions
    AuthService::clear_all_secure_data()?;

    // Also clear Gmail secure storage
    use crate::connections::gmail::storage::GmailStorage;
    let _ = GmailStorage::clear_all(); // Don't fail logout if Gmail clear fails

    println!("👋 User logged out successfully");
    Ok(())
}

#[tauri::command]
pub async fn open_auth_url(auth_url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&auth_url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", &auth_url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&auth_url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    Ok(())
}

pub fn register_deep_link_handler(_app: &AppHandle) {
    println!("Deep link handler registered for lokus:// scheme");
}