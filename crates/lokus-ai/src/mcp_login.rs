//! @part-of ai
//! Signing in to a tool server that asks for it (OAuth, as the MCP spec lays
//! it out). The SDK does the protocol; this file opens the browser side of
//! it, catches the redirect on a local port, and keeps the result in the OS
//! keychain so the next request needs no sign-in.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use rmcp::transport::auth::{
    AuthError, AuthorizationManager, AuthorizationRequest, CredentialStore, OAuthState,
    StoredCredentials,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::config::{secret, set_secret, McpServer};
use crate::error::{AiError, Result};

const WAIT: Duration = Duration::from_secs(300);
const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Lokus</title>\
<body style=\"font:16px -apple-system,sans-serif;text-align:center;padding-top:20vh\">\
<h2>Signed in</h2><p>You can close this tab and go back to Lokus.</p>";

/// Where sign-ins live when the keychain cannot be used: until the app quits.
static MEMORY: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(Default::default);

fn account(server: &str) -> String {
    format!("mcp-oauth:{server}")
}

struct Store {
    account: String,
}

fn stored(account: &str) -> Option<String> {
    secret(account).or_else(|| MEMORY.lock().ok()?.get(account).cloned())
}

#[async_trait::async_trait]
impl CredentialStore for Store {
    async fn load(&self) -> std::result::Result<Option<StoredCredentials>, AuthError> {
        Ok(stored(&self.account).and_then(|json| serde_json::from_str(&json).ok()))
    }

    async fn save(&self, credentials: StoredCredentials) -> std::result::Result<(), AuthError> {
        let json = serde_json::to_string(&credentials)
            .map_err(|e| AuthError::InternalError(e.to_string()))?;
        if set_secret(&self.account, &json).is_err() {
            if let Ok(mut memory) = MEMORY.lock() {
                memory.insert(self.account.clone(), json);
            }
        }
        Ok(())
    }

    async fn clear(&self) -> std::result::Result<(), AuthError> {
        let _ = set_secret(&self.account, "");
        if let Ok(mut memory) = MEMORY.lock() {
            memory.remove(&self.account);
        }
        Ok(())
    }
}

pub fn signed_in(server: &str) -> bool {
    stored(&account(server)).is_some()
}

pub fn sign_out(server: &str) {
    let _ = set_secret(&account(server), "");
    if let Ok(mut memory) = MEMORY.lock() {
        memory.remove(&account(server));
    }
}

fn failed(server: &McpServer) -> impl Fn(AuthError) -> AiError + '_ {
    |e| AiError::Mcp {
        server: server.name.clone(),
        message: format!("sign-in failed: {e}"),
    }
}

async fn manager(server: &McpServer) -> Result<AuthorizationManager> {
    // A server on this machine (someone developing one) may keep its sign-in pages there too.
    let local = ["http://127.0.0.1", "http://localhost", "http://[::1]"]
        .iter()
        .any(|prefix| server.url.starts_with(prefix));
    let built = if local {
        AuthorizationManager::new_allowing_private_addresses(server.url.as_str()).await
    } else {
        AuthorizationManager::new(server.url.as_str()).await
    };
    let mut manager = built.map_err(failed(server))?;
    manager.set_credential_store(Store {
        account: account(&server.name),
    });
    Ok(manager)
}

/// The signed-in connection details for a server, if the person signed in before.
pub async fn authorized(server: &McpServer) -> Result<Option<AuthorizationManager>> {
    if !signed_in(&server.name) {
        return Ok(None);
    }
    let mut manager = manager(server).await?;
    match manager.initialize_from_store().await {
        Ok(true) => Ok(Some(manager)),
        Ok(false) => Ok(None),
        Err(e) => Err(failed(server)(e)),
    }
}

/// Sign in to a server. `show` is handed the address to open in a browser;
/// this returns once the browser has come back, or after five minutes.
pub async fn login(server: &McpServer, show: impl FnOnce(&str)) -> Result<()> {
    let io = |e: std::io::Error| AiError::Mcp {
        server: server.name.clone(),
        message: format!("sign-in failed: {e}"),
    };
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.map_err(io)?;
    let port = listener.local_addr().map_err(io)?.port();
    let redirect = format!("http://127.0.0.1:{port}/callback");

    let mut state = OAuthState::Unauthorized(manager(server).await?);
    state
        .start_authorization(AuthorizationRequest::new(redirect).with_client_name("Lokus"))
        .await
        .map_err(failed(server))?;
    let url = state
        .get_authorization_url()
        .await
        .map_err(failed(server))?;
    show(&url);

    let came_back = async {
        loop {
            let (mut stream, _) = listener.accept().await?;
            let mut head = vec![0u8; 8192];
            let n = stream.read(&mut head).await?;
            let request = String::from_utf8_lossy(&head[..n]).into_owned();
            let path = request
                .split_whitespace()
                .nth(1)
                .unwrap_or_default()
                .to_string();
            let found = path.starts_with("/callback?");
            let (status, body) = if found {
                ("200 OK", DONE_PAGE)
            } else {
                ("404 Not Found", "")
            };
            let reply = format!(
                "HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(reply.as_bytes()).await?;
            if found {
                return Ok::<String, std::io::Error>(path);
            }
        }
    };
    let path = tokio::time::timeout(WAIT, came_back)
        .await
        .map_err(|_| AiError::Mcp {
            server: server.name.clone(),
            message: "sign-in was not finished in the browser".into(),
        })?
        .map_err(io)?;
    state
        .handle_callback_url(&format!("http://127.0.0.1:{port}{path}"))
        .await
        .map_err(failed(server))
}
