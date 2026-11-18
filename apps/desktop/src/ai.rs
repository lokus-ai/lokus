//! @part-of desktop
//! The assistant inside the app: settings, keys, and running a request while
//! passing its progress to the window. The logic lives in `lokus-ai`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use lokus_ai::config::{api_account, has_key, key_account, mcp_account, secret, set_secret};
use lokus_ai::{AiError, AppRunner, Approver, Config, McpServer, Provider, Request};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

use crate::Shell;

/// Where the window sends what happened when it carried out an app tool.
type Answer = oneshot::Sender<Result<String, String>>;

#[derive(Default)]
pub struct Ai {
    /// Requests in flight, by chat, so they can be stopped.
    running: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    /// Tool calls waiting for the person to allow or decline them.
    waiting: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    /// Tool calls the window is carrying out (opening a note, showing a view).
    acting: Arc<Mutex<HashMap<String, Answer>>>,
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

/// The open folder, as the window names it.
fn root_of(core: &lokus_core::Core) -> String {
    core.vault.root().to_string_lossy().to_string()
}

/// What a workspace's connections are kept by: the folder's own id, which goes with the folder
/// when it is moved or renamed.
fn id_of(core: &lokus_core::Core) -> Result<String, Value> {
    core.vault.id().map_err(|e| fail("config", e))
}

/// The id of the folder the window names; no folder, no id.
fn id_at(root: &str) -> Result<String, Value> {
    if root.is_empty() {
        return Ok(String::new());
    }
    lokus_core::Vault::open(root)
        .and_then(|vault| vault.id())
        .map_err(|e| fail("config", e))
}

/// Set while connections from before they belonged to a workspace could not be handed on.
static OWED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Give connections from before they belonged to a workspace to these folders. If the settings
/// cannot be written they stay where they were, and the next folder opened tries again for
/// every workspace on the computer, so a failed first start loses nobody's connections.
pub fn hand_on(app: &AppHandle, roots: &[String]) {
    use std::sync::atomic::Ordering;
    let all;
    let roots = if OWED.load(Ordering::Relaxed) {
        all = crate::vaults::here(app);
        &all
    } else {
        roots
    };
    let ids: Vec<String> = roots.iter().filter_map(|root| id_at(root).ok()).collect();
    let done = config_dir(app)
        .map_err(|_| "no settings folder".to_string())
        .and_then(|dir| Config::hand_on(&dir, &ids).map_err(|e| e.to_string()));
    OWED.store(done.is_err(), Ordering::Relaxed);
    if let Err(e) = done {
        eprintln!("connections could not be given to their workspaces: {e}");
    }
}

/// A folder was opened: what an older install left goes to it if nothing has had it yet, and
/// what was connected with no folder open (first-run setup) becomes this workspace's.
pub fn opened(app: &AppHandle, vault: &lokus_core::Vault) {
    hand_on(app, &[vault.root().to_string_lossy().to_string()]);
    let settled = config_dir(app)
        .map_err(|_| "no settings folder".to_string())
        .and_then(|dir| {
            let id = vault.id().map_err(|e| e.to_string())?;
            Config::settle(&dir, &id).map_err(|e| e.to_string())
        });
    if let Err(e) = settled {
        eprintln!("connections made during setup could not be given to the workspace: {e}");
    }
}

/// A connection made with no workspace open goes to the one open by the time it is made:
/// first-run setup can open its folder while a sign-in is still in the browser.
fn settle(app: &AppHandle, root: &str) {
    if !root.is_empty() {
        return;
    }
    if let Some(core) = app.state::<Shell>().core() {
        opened(app, &core.vault);
    }
}

/// Tool servers offered by the plugins that are switched on in this workspace.
fn plugin_servers(core: Option<&lokus_core::Core>) -> Vec<McpServer> {
    let Some(core) = core else {
        return Vec::new();
    };
    let keys = core.vault.id().unwrap_or_default();
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
            keys: keys.clone(),
        })
        .collect()
}

/// What the window sends back: the settings it was shown, and the workspace they were for.
#[derive(serde::Deserialize)]
pub struct Seen {
    #[serde(default)]
    root: String,
    #[serde(flatten)]
    config: Config,
}

/// Settings as the window may see them: which keys exist, never the keys. The connections are
/// the open workspace's; `config.root` says which, and comes back with every change.
#[tauri::command(async)]
pub fn ai_settings(app: AppHandle) -> Result<Value, Value> {
    if OWED.load(std::sync::atomic::Ordering::Relaxed) {
        hand_on(&app, &[]);
    }
    let core = app.state::<Shell>().core();
    let root = core.as_deref().map(root_of).unwrap_or_default();
    let at = core.as_deref().map(id_of).transpose()?.unwrap_or_default();
    let config = load(&app)?.seen_from(&at);
    let names = |keep: &dyn Fn(&McpServer) -> bool| -> Vec<&str> {
        config
            .mcp
            .iter()
            .filter(|s| keep(s))
            .map(|s| s.name.as_str())
            .collect()
    };
    let mut shown = serde_json::to_value(&config).map_err(|e| fail("config", e))?;
    shown["root"] = json!(root);
    Ok(json!({
        "config": shown,
        "workspace": core.as_deref().map(|c| c.vault.name()).unwrap_or_default(),
        "keys": { "anthropic": has_key(Provider::Anthropic), "openai": has_key(Provider::OpenAi), "chatgpt": has_key(Provider::ChatGpt) },
        "tokens": names(&|s| secret(&mcp_account(s)).is_some()),
        "api_keys": config.apis.iter().filter(|a| secret(&api_account(a)).is_some()).map(|a| a.name.as_str()).collect::<Vec<_>>(),
        "signed_in": names(&lokus_ai::mcp_login::signed_in),
        "plugin_servers": plugin_servers(core.as_deref()),
    }))
}

#[tauri::command(async)]
pub fn ai_settings_save(app: AppHandle, config: Seen) -> Result<(), Value> {
    Config::put(&config_dir(&app)?, &id_at(&config.root)?, config.config).map_err(|e| e.body())
}

/// Store or (with an empty value) remove a provider key, or the key of one of the
/// workspace `root`'s connections.
#[tauri::command(async)]
pub fn ai_secret_set(
    app: AppHandle,
    kind: String,
    name: String,
    value: String,
    root: String,
) -> Result<(), Value> {
    let account = match (kind.as_str(), name.as_str()) {
        ("provider", "anthropic") => key_account(Provider::Anthropic),
        ("provider", "openai") => key_account(Provider::OpenAi),
        ("mcp" | "api", name) if !name.is_empty() => {
            return lokus_ai::config::set_key(
                &config_dir(&app)?,
                &id_at(&root)?,
                &kind,
                name,
                value.trim(),
            )
            .map_err(|e| e.body())
        }
        _ => return Err(fail("bad_args", "unknown secret")),
    };
    set_secret(&account, value.trim()).map_err(|e| e.body())
}

#[tauri::command]
pub async fn ai_models(app: AppHandle) -> Result<Vec<String>, Value> {
    let config = load(&app)?;
    let key = lokus_ai::chat::credential(config.provider)
        .await
        .map_err(|e| e.body())?;
    let models = lokus_ai::provider::models(&reqwest_client(), &config, &key)
        .await
        .map_err(|e| e.body())?;
    Config::adopt_model(&config_dir(&app)?, &config, &models).map_err(|e| e.body())?;
    Ok(models)
}

fn reqwest_client() -> lokus_ai::provider::Client {
    lokus_ai::provider::Client::new()
}

/// Connect to a tool server and list what it offers, to check an address.
#[tauri::command]
pub async fn ai_mcp_check(
    app: AppHandle,
    server: McpServer,
    token: Option<String>,
    root: String,
) -> Result<Vec<Value>, Value> {
    let server = load(&app)?.place(&id_at(&root)?, server);
    let connection = match token {
        Some(token) => lokus_ai::mcp::check_token(&server, &token)
            .await
            .map_err(|e| match e {
                AiError::Mcp { message, .. } => fail("mcp", message),
                other => other.body(),
            })?,
        None => lokus_ai::mcp::connect_soon(&server)
            .await
            .map_err(|e| e.body())?,
    };
    let tools = connection
        .tools
        .iter()
        .map(|t| json!({ "name": t.name, "description": t.description, "asks": t.writes }))
        .collect();
    connection.close().await;
    Ok(tools)
}

/// Save a checked token connection, restoring its old token if settings cannot be saved.
#[tauri::command(async)]
pub fn ai_mcp_token_save(
    app: AppHandle,
    server: McpServer,
    token: String,
    root: String,
) -> Result<(), Value> {
    lokus_ai::mcp::save_token(&config_dir(&app)?, &id_at(&root)?, server, &token)
        .map_err(|e| e.body())?;
    settle(&app, &root);
    Ok(())
}

/// Run one request. Progress arrives as `ai:event` messages tagged with the
/// chat; the reply to this call is the messages to add to the conversation.
#[tauri::command]
pub async fn ai_send(
    app: AppHandle,
    chat: String,
    messages: Vec<Value>,
    briefing: String,
    root: Option<String>,
) -> Result<Value, Value> {
    // App tools run in the window: it is told what to do and answers through `ai_act_done`.
    let (acting, window, tag) = (app.state::<Ai>().acting.clone(), app.clone(), chat.clone());
    let act: AppRunner = Arc::new(move |id: &str, name: &str, input: &Value| {
        let (answer, wait) = oneshot::channel();
        if let Ok(mut acting) = acting.lock() {
            acting.insert(id.to_string(), answer);
        }
        let _ = window.emit(
            "ai:act",
            json!({ "chat": tag, "id": id, "name": name, "input": input }),
        );
        wait
    });
    // The workspace is taken once: its notes, its plugins and its connections go together, and
    // a folder opened while this runs changes none of them.
    let core = app.state::<Shell>().core();
    let open = core.as_deref().map(root_of).unwrap_or_default();
    // A question asked in one workspace is never answered with another's notes or connections.
    if root.is_some_and(|asked| asked != open) {
        return Err(
            json!({ "code": "vault_changed", "message": "The workspace changed. Try again in the original workspace." }),
        );
    }
    let at = core.as_deref().map(id_of).transpose()?.unwrap_or_default();
    let request = Request {
        config: load(&app)?.seen_from(&at),
        messages,
        extra_servers: plugin_servers(core.as_deref()),
        core,
        briefing,
        app: Some(act),
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

/// The window's answer to an app tool it was asked to carry out.
#[tauri::command(async)]
pub fn ai_act_done(app: AppHandle, id: String, ok: bool, result: String) {
    if let Ok(mut acting) = app.state::<Ai>().acting.lock() {
        if let Some(answer) = acting.remove(&id) {
            let _ = answer.send(if ok { Ok(result) } else { Err(result) });
        }
    }
}

/// The services Lokus offers by name, and which of them can be connected today.
#[tauri::command(async)]
pub fn ai_connectors() -> Vec<lokus_ai::catalog::Connector> {
    lokus_ai::catalog::all()
}

/// Sign in to a tool server in the person's browser, for the workspace `root`, and keep it
/// among that workspace's connections. The sign-in is that workspace's own, also when it had
/// been using one shared with others.
#[tauri::command]
pub async fn ai_mcp_login(app: AppHandle, server: McpServer, root: String) -> Result<(), Value> {
    let show = |url: &str| {
        let _ = open::that(url);
    };
    let at = id_at(&root)?;
    let server = Config::own(&at, server);
    lokus_ai::mcp_login::login(&server, show)
        .await
        .map_err(|e| e.body())?;
    let dir = config_dir(&app)?;
    Config::let_go(&dir, &at, "mcp", &server.name).map_err(|e| e.body())?;
    let mut seen = Config::load(&dir).seen_from(&at);
    if !seen.mcp.iter().any(|s| s.name == server.name) {
        seen.mcp.push(server);
        Config::put(&dir, &at, seen).map_err(|e| e.body())?;
    }
    settle(&app, &root);
    Ok(())
}

#[tauri::command(async)]
pub fn ai_mcp_logout(app: AppHandle, name: String, root: String) -> Result<(), Value> {
    lokus_ai::mcp_login::sign_out(&config_dir(&app)?, &id_at(&root)?, &name).map_err(|e| e.body())
}

/// Sign in with ChatGPT in the person's browser.
#[tauri::command]
pub async fn ai_chatgpt_login() -> Result<(), Value> {
    let show = |url: &str| {
        let _ = open::that(url);
    };
    lokus_ai::chatgpt::login(show).await.map_err(|e| e.body())
}

#[tauri::command(async)]
pub fn ai_chatgpt_logout() {
    lokus_ai::chatgpt::sign_out();
}
