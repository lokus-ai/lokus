//! @part-of ai
//! Signing in to a tool server that asks for it (OAuth, as the MCP spec lays
//! it out). The SDK does the protocol; this file opens the browser side of
//! it, catches the redirect on a local port, and keeps the result in the OS
//! keychain so the next request needs no sign-in.

use std::time::Duration;

use rmcp::transport::auth::{
    AuthError, AuthorizationManager, AuthorizationRequest, CredentialStore, OAuthState,
    StoredCredentials,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::config::{forget, keep, kept, McpServer};
use crate::error::{AiError, Result};

const WAIT: Duration = Duration::from_secs(300);
const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Lokus</title>\
<body style=\"font:16px -apple-system,sans-serif;text-align:center;padding-top:20vh\">\
<h2>Signed in</h2><p>You can close this tab and go back to Lokus.</p>";

fn account(server: &str) -> String {
    format!("mcp-oauth:{server}")
}

struct Store {
    account: String,
}

#[async_trait::async_trait]
impl CredentialStore for Store {
    async fn load(&self) -> std::result::Result<Option<StoredCredentials>, AuthError> {
        Ok(kept(&self.account).and_then(|json| serde_json::from_str(&json).ok()))
    }

    async fn save(&self, credentials: StoredCredentials) -> std::result::Result<(), AuthError> {
        let json = serde_json::to_string(&credentials)
            .map_err(|e| AuthError::InternalError(e.to_string()))?;
        keep(&self.account, &json);
        Ok(())
    }

    async fn clear(&self) -> std::result::Result<(), AuthError> {
        forget(&self.account);
        Ok(())
    }
}

pub fn signed_in(server: &str) -> bool {
    kept(&account(server)).is_some()
}

pub fn sign_out(server: &str) {
    forget(&account(server));
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
    // A service that knows Lokus as a registered app returns to one fixed address it has on
    // file; any other server is told the address when Lokus introduces itself, so any free
    // port will do.
    let app = crate::catalog::app_for(&server.name, &server.url);
    let listener = TcpListener::bind(("127.0.0.1", app.map_or(0, |a| a.port)))
        .await
        .map_err(|e| match (app, e.kind()) {
            (Some(_), std::io::ErrorKind::AddrInUse) => AiError::Mcp {
                server: server.name.clone(),
                message: "sign-in failed: another sign-in is still open; finish or close it and try again".into(),
            },
            _ => io(e),
        })?;
    let port = listener.local_addr().map_err(io)?.port();
    // A browser may try `localhost` as ::1 first, so listen there too when the address is fixed.
    let also = match app {
        Some(a) => TcpListener::bind(("::1", a.port)).await.ok(),
        None => None,
    };
    let host = if app.is_some() { "localhost" } else { "127.0.0.1" };
    let redirect = format!("http://{host}:{port}/callback");

    let mut request = AuthorizationRequest::new(redirect).with_client_name("Lokus");
    if let Some(app) = app {
        request = request
            .with_preregistered_client(app.client_id)
            .with_scopes(app.scopes.iter().copied());
    }
    let mut state = OAuthState::Unauthorized(manager(server).await?);
    state
        .start_authorization(request)
        .await
        .map_err(failed(server))?;
    let url = state
        .get_authorization_url()
        .await
        .map_err(failed(server))?;
    show(&url);

    let came_back = async {
        loop {
            let (mut stream, _) = match &also {
                Some(other) => tokio::select! {
                    got = listener.accept() => got?,
                    got = other.accept() => got?,
                },
                None => listener.accept().await?,
            };
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
        .handle_callback_url(&format!("http://{host}:{port}{path}"))
        .await
        .map_err(failed(server))
}
