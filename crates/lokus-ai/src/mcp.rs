//! @part-of ai
//! Tool servers (MCP) over HTTP, through the official Rust SDK. A server is
//! connected for the length of one request and its tools are offered to the
//! model beside the vault's own.

use rmcp::model::{CallToolRequestParams, ClientConfig, ProtocolVersion};
use rmcp::service::RunningService;
use rmcp::transport::auth::AuthClient;
use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig;
use rmcp::transport::StreamableHttpClientTransport;
use rmcp::{RoleClient, ServiceExt};
use serde_json::Value;

use crate::config::{mcp_account, read_secret, secret, set_secret, Config, McpServer};
use crate::error::{AiError, Result};
use crate::tools::Tool;

pub struct Connection {
    pub server: String,
    service: RunningService<RoleClient, ClientConfig>,
    pub tools: Vec<Tool>,
}

/// The name a server's tool goes by when offered to the model.
pub fn tool_name(server: &str, tool: &str) -> String {
    let clean = |s: &str| -> String {
        s.chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect()
    };
    format!("mcp__{}__{}", clean(server), clean(tool))
}

/// How long one call to a service may take, and how long connecting to one may take.
const CALL: std::time::Duration = std::time::Duration::from_secs(90);
const CONNECT: std::time::Duration = std::time::Duration::from_secs(20);

/// Connect, or give up after a while: one unreachable service must not stall every reply.
pub async fn connect_soon(server: &McpServer) -> Result<Connection> {
    match tokio::time::timeout(CONNECT, connect(server)).await {
        Ok(result) => result,
        Err(_) => Err(AiError::Mcp {
            server: server.name.clone(),
            message: format!(
                "it did not answer within {} seconds and was left out of this reply",
                CONNECT.as_secs()
            ),
        }),
    }
}

pub async fn connect(server: &McpServer) -> Result<Connection> {
    connect_using(server, None).await
}

/// Validate a pasted token without saving it or falling back to an existing sign-in.
pub async fn check_token(server: &McpServer, token: &str) -> Result<Connection> {
    let token = token.trim();
    if token.is_empty() {
        return Err(AiError::Mcp {
            server: server.name.clone(),
            message: "Enter a personal access token.".into(),
        });
    }
    tokio::time::timeout(CONNECT, connect_using(server, Some(token)))
        .await
        .map_err(|_| AiError::Mcp {
            server: server.name.clone(),
            message: "The service did not answer. Check your connection and try again.".into(),
        })?
        .map_err(|_| AiError::Mcp {
            server: server.name.clone(),
            message:
                "Could not connect. Check your token, its access and your network, then try again."
                    .into(),
        })
}

/// Commit an already checked token and its server together, for the workspace `root`; a
/// settings failure restores the previous credential, so updating a token cannot break a
/// working connection on disk failure.
pub fn save_token(dir: &std::path::Path, root: &str, server: McpServer, token: &str) -> Result<()> {
    let token = token.trim();
    if token.is_empty() {
        return Err(AiError::Config("Enter a personal access token.".into()));
    }
    // The workspace's own entry, also when it had been using one shared with others.
    let mut server = Config::own(root, server);
    let account = mcp_account(&server);
    let previous = read_secret(&account)?;
    let mut seen = Config::load(dir).seen_from(root);
    if let Some(existing) = seen.mcp.iter().find(|s| s.name == server.name) {
        server.enabled = existing.enabled;
    }
    seen.mcp.retain(|s| s.name != server.name);
    seen.mcp.push(server.clone());
    if let Err(error) = set_secret(&account, token).and_then(|_| Config::put(dir, root, seen)) {
        set_secret(&account, previous.as_deref().unwrap_or_default()).map_err(|_| {
            AiError::Keychain(
                "the previous token could not be restored; unlock the keychain and reconnect"
                    .into(),
            )
        })?;
        return Err(error);
    }
    let _ = crate::mcp_login::sign_out(dir, root, &server.name);
    // Its own token now, whatever became of the sign-in: no longer the one it shared.
    Config::let_go(dir, root, "mcp", &server.name)
}

async fn connect_using(server: &McpServer, token: Option<&str>) -> Result<Connection> {
    let failed = |message: String| AiError::Mcp {
        server: server.name.clone(),
        message,
    };
    let mut config = StreamableHttpClientTransportConfig::with_uri(server.url.clone());
    let token = token
        .map(str::to_owned)
        .or_else(|| secret(&mcp_account(server)));
    if let Some(token) = &token {
        config = config.auth_header(token.clone());
    }
    // A server the person signed in to is reached with those credentials,
    // which the SDK keeps fresh; otherwise with a pasted token, or nothing.
    let authorized = if token.is_some() {
        None
    } else {
        crate::mcp_login::authorized(server).await?
    };
    // `serve` uses initialize, which newer protocol versions no longer support.
    let info =
        ClientConfig::default().with_protocol_version(ProtocolVersion::LATEST_WITH_INITIALIZE);
    let started = match authorized {
        Some(manager) => {
            let client = AuthClient::new(reqwest::Client::default(), manager);
            info.serve(StreamableHttpClientTransport::with_client(client, config))
                .await
        }
        None => {
            let client = reqwest::Client::default();
            info.serve(StreamableHttpClientTransport::with_client(client, config))
                .await
        }
    };
    let service = started.map_err(|e| {
        let text = e.to_string();
        let needs_login = text.contains("401") || text.to_lowercase().contains("auth");
        failed(if needs_login {
            "it needs you to sign in again (Settings, Connections)".to_string()
        } else {
            text
        })
    })?;
    let listed = service
        .list_all_tools()
        .await
        .map_err(|e| failed(e.to_string()))?;
    let tools = listed
        .into_iter()
        .map(|t| Tool {
            name: t.name.to_string(),
            description: t.description.map(|d| d.to_string()).unwrap_or_default(),
            schema: Value::Object((*t.input_schema).clone()),
            writes: !t
                .annotations
                .and_then(|a| a.read_only_hint)
                .unwrap_or(false),
        })
        .collect();
    Ok(Connection {
        server: server.name.clone(),
        service,
        tools,
    })
}

impl Connection {
    pub async fn call(&self, tool: &str, input: &Value) -> std::result::Result<String, String> {
        let mut params = CallToolRequestParams::new(tool.to_string());
        if let Some(arguments) = input.as_object() {
            params = params.with_arguments(arguments.clone());
        }
        // A service that never answers must not hold the whole reply up for ever.
        let result = tokio::time::timeout(CALL, self.service.call_tool(params))
            .await
            .map_err(|_| {
                format!(
                    "{} did not answer within {} seconds; it was given up on",
                    self.server,
                    CALL.as_secs()
                )
            })?
            .map_err(|e| e.to_string())?;
        let failed = result.is_error.unwrap_or(false);
        // Text parts are joined; anything else is passed on as JSON.
        let value = serde_json::to_value(&result).unwrap_or_default();
        let parts: Vec<String> = value["content"]
            .as_array()
            .map(|blocks| {
                blocks
                    .iter()
                    .map(|b| match b["text"].as_str() {
                        Some(text) => text.to_string(),
                        None => b.to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        let mut text = parts.join("\n");
        if text.is_empty() {
            if let Some(structured) = value.get("structuredContent").filter(|v| !v.is_null()) {
                text = structured.to_string();
            }
        }
        if failed {
            Err(text)
        } else {
            Ok(text)
        }
    }

    pub async fn close(self) {
        let _ = self.service.cancel().await;
    }
}
