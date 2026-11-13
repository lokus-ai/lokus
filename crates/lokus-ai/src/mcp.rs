//! @part-of ai
//! Tool servers (MCP) over HTTP, through the official Rust SDK. A server is
//! connected for the length of one request and its tools are offered to the
//! model beside the vault's own.

use rmcp::model::CallToolRequestParams;
use rmcp::service::RunningService;
use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig;
use rmcp::transport::StreamableHttpClientTransport;
use rmcp::{RoleClient, ServiceExt};
use serde_json::Value;

use crate::config::{mcp_account, secret, McpServer};
use crate::error::{AiError, Result};
use crate::tools::Tool;

pub struct Connection {
    pub server: String,
    service: RunningService<RoleClient, ()>,
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

pub async fn connect(server: &McpServer) -> Result<Connection> {
    let failed = |message: String| AiError::Mcp {
        server: server.name.clone(),
        message,
    };
    let mut config = StreamableHttpClientTransportConfig::with_uri(server.url.clone());
    if let Some(token) = secret(&mcp_account(&server.name)) {
        config = config.auth_header(token);
    }
    let transport = StreamableHttpClientTransport::with_client(reqwest::Client::default(), config);
    let service = ().serve(transport).await.map_err(|e| failed(e.to_string()))?;
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
        let result = self
            .service
            .call_tool(params)
            .await
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
