//! @part-of desktop
//! The desktop shell. It owns the window and the open vault and forwards
//! everything else to `lokus-core`. No feature logic belongs here.
//! The same code starts the app on desktop and, through `run`, on phones.

mod account;
mod ai;
#[cfg(all(debug_assertions, desktop))]
mod dev_channel;
mod sync;
mod updates;
mod vaults;
mod windows;

use std::path::PathBuf;
use std::sync::Mutex;

use lokus_core::error::ErrorBody;
use lokus_core::watch::{watch, WatchHandle};
use lokus_core::{commands, Core, CoreError};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct Shell {
    open: Mutex<Option<OpenVault>>,
}

struct OpenVault {
    core: Arc<Core>,
    _watch: WatchHandle,
}

impl Shell {
    pub fn core(&self) -> Option<Arc<Core>> {
        self.open.lock().ok()?.as_ref().map(|o| o.core.clone())
    }
}

pub fn error_value(e: &CoreError) -> Value {
    serde_json::to_value(ErrorBody::from(e)).unwrap_or(Value::Null)
}

fn no_vault() -> Value {
    json!({ "code": "no_vault", "message": "no vault is open" })
}

/// Run a core command against the open vault.
pub fn run_core(shell: &Shell, name: &str, args: Value) -> Result<Value, Value> {
    let core = shell.core().ok_or_else(no_vault)?;
    commands::run(&core, name, args).map_err(|e| error_value(&e))
}

/// Open a folder as the vault, start watching it and remember it.
pub fn open_vault(app: &AppHandle, path: &str) -> Result<Value, Value> {
    // Sync belongs to a vault; switching vaults ends it.
    sync::stop_for(app);
    let core = Arc::new(Core::open(path).map_err(|e| error_value(&e))?);
    let vault = &core.vault;
    let emitter = app.clone();
    let indexer = core.clone();
    let handle = watch(vault, move |paths| {
        // Index first, so the UI finds fresh links and search results when it reacts.
        if let Ok(mut index) = indexer.index() {
            let _ = index.update(&paths);
        }
        emitter.state::<sync::Sync>().changed();
        let _ = emitter.emit("vault:changed", paths);
    })
    .map_err(|e| error_value(&e))?;
    let info = json!({ "name": vault.name(), "root": vault.root() });
    // Catch up with whatever changed while the app was closed, off the main path.
    let (catch_up, ready) = (core.clone(), app.clone());
    std::thread::spawn(move || {
        if let Ok(mut index) = catch_up.index() {
            let _ = index.refresh();
        }
        let _ = ready.emit("index:ready", ());
    });
    // Images in notes load through the asset protocol, limited to this vault.
    let _ = app
        .asset_protocol_scope()
        .allow_directory(vault.root(), true);

    if let Some(file) = last_vault_file(app) {
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(file, vault.root().to_string_lossy().as_bytes());
    }
    vaults::remember(app, vault.root());
    let shell = app.state::<Shell>();
    if let Ok(mut open) = shell.open.lock() {
        *open = Some(OpenVault {
            core: core.clone(),
            _watch: handle,
        });
    }
    let _ = app.emit("vault:opened", &info);
    Ok(info)
}

fn last_vault_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("last-vault"))
}

#[tauri::command(async)]
fn core_run(shell: State<'_, Shell>, name: String, args: Option<Value>) -> Result<Value, Value> {
    run_core(&shell, &name, args.unwrap_or(Value::Null))
}

#[tauri::command(async)]
fn vault_open(app: AppHandle, path: String) -> Result<Value, Value> {
    open_vault(&app, &path)
}

/// The folder notes are kept in when someone does not want to choose one: Documents, Lokus.
/// With `open` it is made if need be and opened; without, only its place is told.
/// A `name` asks for a folder of that name instead, for a team's workspace joined by invitation.
#[tauri::command(async)]
fn vault_default(app: AppHandle, open: bool, name: Option<String>) -> Result<Value, Value> {
    // A workspace's name is whatever its owner typed; only what is safe as a folder is kept.
    let named: String = name
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control() && !"/\\:".contains(*c))
        .collect();
    let named = named.trim().trim_start_matches('.').trim();
    let folder = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| json!({ "code": "io", "message": format!("Could not find your Documents folder: {e}") }))?
        .join(if named.is_empty() { "Lokus" } else { named });
    if !open {
        return Ok(json!({ "root": folder }));
    }
    std::fs::create_dir_all(&folder).map_err(
        |e| json!({ "code": "io", "message": format!("Could not make {}: {e}", folder.display()) }),
    )?;
    open_vault(&app, &folder.to_string_lossy())
}

/// The vault that is open, reopening the last one on first call.
#[tauri::command(async)]
fn vault_current(app: AppHandle, shell: State<'_, Shell>) -> Option<Value> {
    if let Some(core) = shell.core() {
        return Some(json!({ "name": core.vault.name(), "root": core.vault.root() }));
    }
    let last = std::fs::read_to_string(last_vault_file(&app)?).ok()?;
    open_vault(&app, last.trim()).ok()
}

/// How plugin frames address their files; the form differs by platform.
const PLUGIN_ORIGIN: &str = if cfg!(any(windows, target_os = "android")) {
    "http://lokus-plugin.localhost"
} else {
    "lokus-plugin:"
};

/// Serve `lokus-plugin://localhost/<id>/<file>` from the open vault's plugins.
/// The frame that asks is sandboxed; the policy header limits what it loads.
fn plugin_file(app: &AppHandle, uri_path: &str) -> tauri::http::Response<Vec<u8>> {
    use tauri::http::{header, Response, StatusCode};
    let path = percent_encoding::percent_decode_str(uri_path).decode_utf8_lossy();
    let path = path.trim_start_matches('/');
    let (id, file) = path.split_once('/').unwrap_or((path, ""));
    let served = app
        .state::<Shell>()
        .core()
        .ok_or_else(|| "no vault is open".to_string())
        .and_then(|core| {
            lokus_core::plugins::serve(&core.vault, id, file, PLUGIN_ORIGIN)
                .map_err(|e| e.to_string())
        });
    let response = match served {
        Ok(file) => Response::builder()
            .header(header::CONTENT_TYPE, file.mime)
            .header(header::CONTENT_SECURITY_POLICY, file.csp)
            .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
            .header(header::CACHE_CONTROL, "no-store")
            .body(file.bytes),
        Err(message) => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(message.into_bytes()),
    };
    response.unwrap_or_default()
}

/// The app menu. Cmd+W closes a tab, not the window, so it is our own item.
#[cfg(desktop)]
fn menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    let close_tab = MenuItemBuilder::with_id("close-tab", "Close Tab")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let app_menu = SubmenuBuilder::new(app, "Lokus")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let new_window = MenuItemBuilder::with_id("new-window", "New Window")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&new_window)
        .separator()
        .item(&close_tab)
        .close_window()
        .build()?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .fullscreen()
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &window])
        .build()
}

/// Every command the window may call, written once. A development build adds the one that
/// answers the terminal. There used to be two lists, and a command added to only the
/// development one (the list of services to connect) was missing from the released app.
macro_rules! commands {
    ($($extra:path),*) => {
        tauri::generate_handler![
            core_run,
            vault_open,
            vault_current,
            sync::sync_connect,
            sync::sync_disconnect,
            sync::sync_token,
            sync::sync_status,
            sync::sync_doc,
            sync::sync_local,
            sync::sync_awareness,
            sync::relay_call,
            account::account_browser_login,
            ai::ai_settings,
            ai::ai_settings_save,
            ai::ai_secret_set,
            ai::ai_models,
            ai::ai_connectors,
            ai::ai_mcp_check,
            ai::ai_mcp_login,
            ai::ai_mcp_logout,
            ai::ai_chatgpt_login,
            ai::ai_chatgpt_logout,
            ai::ai_send,
            ai::ai_stop,
            ai::ai_approve,
            ai::ai_act_done,
            updates::update_check,
            updates::update_install,
            updates::update_restart,
            updates::app_about,
            updates::open_web,
            updates::app_place,
            updates::app_quit,
            windows::window_new,
            vault_default,
            vaults::vault_list,
            vaults::vault_forget,
            $($extra),*
        ]
    };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::Updates::default())
        .manage(Shell::default())
        .manage(sync::Sync::default())
        .manage(ai::Ai::default())
        .register_uri_scheme_protocol("lokus-plugin", |ctx, request| {
            plugin_file(ctx.app_handle(), request.uri().path())
        });
    #[cfg(desktop)]
    let builder = builder.menu(menu).on_menu_event(|app, event| {
        match event.id().as_ref() {
            "close-tab" => windows::tell_front(app, "menu:close-tab"),
            "new-window" => {
                let app = app.clone();
                // Off the menu's own thread: a window cannot be made from inside its handler.
                tauri::async_runtime::spawn(async move {
                    let _ = windows::open(&app);
                });
            }
            _ => {}
        }
    });

    #[cfg(all(debug_assertions, desktop))]
    let builder = builder
        .manage(dev_channel::Pending::default())
        .invoke_handler(commands!(dev_channel::dev_reply))
        .setup(|app| {
            dev_channel::start(app.handle().clone());
            Ok(())
        });

    #[cfg(not(all(debug_assertions, desktop)))]
    let builder = builder.invoke_handler(commands!());

    builder
        .run(tauri::generate_context!())
        .expect("failed to start Lokus");
}
