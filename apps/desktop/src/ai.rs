//! @part-of desktop
//! The assistant inside the app: settings, keys, and running a request while
//! passing its progress to the window. The logic lives in `lokus-ai`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use lokus_ai::config::{has_key, key_account, mcp_account, secret, set_secret};
use lokus_ai::{AiError, Approver, Config, McpServer, Provider, Request};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

use crate::Shell;

#[derive(Default)]
pub struct Ai {
    /// Requests in flight, by chat, so they can be stopped.
    running: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    /// Tool calls waiting for the person to allow or decline them.
    waiting: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

fn fail(code: &str, message: impl ToString) -> Value {
    json!({ "code": code, "message": message.to_string() })
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, Value> {
    app.path().app_config_dir().map_err(|e| fail("config", e))
}

fn load(app: &AppHandle) -> Result<Config, Value> {
    Ok(Config::load(&config_dir(app)?))
}

/// Tool servers offered by the plugins that are switched on.
fn plugin_servers(app: &AppHandle) -> Vec<McpServer> {
    let Some(core) = app.state::<Shell>().core() else {
        return Vec::new();
    };
    lokus_core::plugins::list(&core.vault)
        .unwrap_or_default()
        .into_iter()
        .filter(|p| p.enabled)
        .filter_map(|p| p.manifest)
        .flat_map(|m| m.contributes.mcp_servers)
        .map(|s| McpServer {
            name: s.name,
            url: s.url,
            enabled: true,
        })
        .collect()
}

/// Settings as the window may see them: which keys exist, never the keys.
#[tauri::command(async)]
pub fn ai_settings(app: AppHandle) -> Result<Value, Value> {
    let config = load(&app)?;
    let tokens: Vec<&str> = config
        .mcp
        .iter()
        .filter(|s| secret(&mcp_account(&s.name)).is_some())
        .map(|s| s.name.as_str())
        .collect();
    Ok(json!({
        "config": config,
        "keys": { "anthropic": has_key(Provider::Anthropic), "openai": has_key(Provider::OpenAi) },
        "tokens": tokens,
        "signed_in": config.mcp.iter().filter(|s| lokus_ai::mcp_login::signed_in(&s.name)).map(|s| s.name.as_str()).collect::<Vec<_>>(),
        "plugin_servers": plugin_servers(&app),
    }))
}

#[tauri::command(async)]
pub fn ai_settings_save(app: AppHandle, config: Config) -> Result<(), Value> {
    config.save(&config_dir(&app)?).map_err(|e| e.body())
}

/// Store or (with an empty value) remove a provider key or a tool-server token.
#[tauri::command(async)]
pub fn ai_secret_set(kind: String, name: String, value: String) -> Result<(), Value> {
    let account = match (kind.as_str(), name.as_str()) {
        ("provider", "anthropic") => key_account(Provider::Anthropic),
        ("provider", "openai") => key_account(Provider::OpenAi),
        ("mcp", server) if !server.is_empty() => mcp_account(server),
        _ => return Err(fail("bad_args", "unknown secret")),
    };
    set_secret(&account, value.trim()).map_err(|e| e.body())
}

#[tauri::command]
pub async fn ai_models(app: AppHandle) -> Result<Vec<String>, Value> {
    let config = load(&app)?;
    let key = lokus_ai::config::api_key(config.provider).map_err(|e| e.body())?;
    lokus_ai::provider::models(&reqwest_client(), &config, &key)
        .await
        .map_err(|e| e.body())
}

fn reqwest_client() -> lokus_ai::provider::Client {
    lokus_ai::provider::Client::new()
}

/// Connect to a tool server and list what it offers, to check an address.
#[tauri::command]
pub async fn ai_mcp_check(server: McpServer) -> Result<Vec<Value>, Value> {
    let connection = lokus_ai::mcp::connect(&server)
        .await
        .map_err(|e| e.body())?;
    let tools = connection
        .tools
        .iter()
        .map(|t| json!({ "name": t.name, "description": t.description, "asks": t.writes }))
        .collect();
    connection.close().await;
    Ok(tools)
}

/// Run one request. Progress arrives as `ai:event` messages tagged with the
/// chat; the reply to this call is the messages to add to the conversation.
#[tauri::command]
pub async fn ai_send(app: AppHandle, chat: String, messages: Vec<Value>) -> Result<Value, Value> {
    let request = Request {
        config: load(&app)?,
        messages,
        core: app.state::<Shell>().core(),
        extra_servers: plugin_servers(&app),
    };
    let waiting = app.state::<Ai>().waiting.clone();
    let approve: Approver = Arc::new(move |id: &str| {
        let (answer, wait) = oneshot::channel();
        if let Ok(mut waiting) = waiting.lock() {
            waiting.insert(id.to_string(), answer);
        }
        wait
    });
    let (emitter, tag) = (app.clone(), chat.clone());
    let emit = move |event: lokus_ai::Event| {
        let _ = emitter.emit("ai:event", json!({ "chat": tag, "event": event }));
    };
    let (done, outcome) = oneshot::channel::<Result<lokus_ai::Outcome, AiError>>();
    let task = tauri::async_runtime::spawn(async move {
        let _ = done.send(lokus_ai::send(request, emit, approve).await);
    });
    if let Ok(mut running) = app.state::<Ai>().running.lock() {
        if let Some(old) = running.insert(chat.clone(), task) {
            old.abort();
        }
    }
    let result = outcome.await;
    if let Ok(mut running) = app.state::<Ai>().running.lock() {
        running.remove(&chat);
    }
    match result {
        Ok(Ok(outcome)) => serde_json::to_value(outcome).map_err(|e| fail("ai", e)),
        Ok(Err(e)) => Err(e.body()),
        Err(_) => Err(fail("stopped", "stopped")),
    }
}

#[tauri::command(async)]
pub fn ai_stop(app: AppHandle, chat: String) {
    if let Ok(mut running) = app.state::<Ai>().running.lock() {
        if let Some(task) = running.remove(&chat) {
            task.abort();
        }
    }
}

/// The person's answer to a tool call that asked first.
#[tauri::command(async)]
pub fn ai_approve(app: AppHandle, id: String, allow: bool) {
    if let Ok(mut waiting) = app.state::<Ai>().waiting.lock() {
        if let Some(answer) = waiting.remove(&id) {
            let _ = answer.send(allow);
        }
    }
}

/// Sign in to a tool server in the person's browser.
#[tauri::command]
pub async fn ai_mcp_login(server: McpServer) -> Result<(), Value> {
    let show = |url: &str| {
        let _ = open::that(url);
    };
    lokus_ai::mcp_login::login(&server, show)
        .await
        .map_err(|e| e.body())
}

#[tauri::command(async)]
pub fn ai_mcp_logout(name: String) {
    lokus_ai::mcp_login::sign_out(&name);
}
