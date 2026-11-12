//! @part-of desktop
//! The desktop shell. It owns the window and the open vault and forwards
//! everything else to `lokus-core`. No feature logic belongs here.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(debug_assertions, unix))]
mod dev_channel;

use std::path::PathBuf;
use std::sync::Mutex;

use lokus_core::error::ErrorBody;
use lokus_core::watch::{watch, WatchHandle};
use lokus_core::{commands, CoreError, Vault};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct Shell {
    open: Mutex<Option<OpenVault>>,
}

struct OpenVault {
    vault: Vault,
    _watch: WatchHandle,
}

impl Shell {
    pub fn vault(&self) -> Option<Vault> {
        self.open.lock().ok()?.as_ref().map(|o| o.vault.clone())
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
    let vault = shell.vault().ok_or_else(no_vault)?;
    commands::run(&vault, name, args).map_err(|e| error_value(&e))
}

/// Open a folder as the vault, start watching it and remember it.
pub fn open_vault(app: &AppHandle, path: &str) -> Result<Value, Value> {
    let vault = Vault::open(path).map_err(|e| error_value(&e))?;
    let emitter = app.clone();
    let handle = watch(&vault, move |paths| {
        let _ = emitter.emit("vault:changed", paths);
    })
    .map_err(|e| error_value(&e))?;
    let info = json!({ "name": vault.name(), "root": vault.root() });

    if let Some(file) = last_vault_file(app) {
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(file, vault.root().to_string_lossy().as_bytes());
    }
    let shell = app.state::<Shell>();
    if let Ok(mut open) = shell.open.lock() {
        *open = Some(OpenVault {
            vault,
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

/// The vault that is open, reopening the last one on first call.
#[tauri::command(async)]
fn vault_current(app: AppHandle, shell: State<'_, Shell>) -> Option<Value> {
    if let Some(vault) = shell.vault() {
        return Some(json!({ "name": vault.name(), "root": vault.root() }));
    }
    let last = std::fs::read_to_string(last_vault_file(&app)?).ok()?;
    open_vault(&app, last.trim()).ok()
}

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Shell::default());

    #[cfg(all(debug_assertions, unix))]
    let builder = builder
        .manage(dev_channel::Pending::default())
        .invoke_handler(tauri::generate_handler![
            core_run,
            vault_open,
            vault_current,
            dev_channel::dev_reply
        ])
        .setup(|app| {
            dev_channel::start(app.handle().clone());
            Ok(())
        });

    #[cfg(not(all(debug_assertions, unix)))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        core_run,
        vault_open,
        vault_current
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("failed to start Lokus");
}
