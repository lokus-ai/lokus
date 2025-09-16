#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod menu;
mod theme;
mod handlers;
mod clipboard;
mod tasks;
mod search;
mod plugins;

use windows::{open_workspace_window, open_preferences_window};
use tauri::Manager;
use tauri_plugin_store::{StoreBuilder, JsonValue};
use std::path::PathBuf;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::{Emitter, Listener};

#[derive(serde::Serialize, serde::Deserialize)]
struct SessionState {
    open_tabs: Vec<String>,
    expanded_folders: Vec<String>,
}

#[tauri::command]
fn save_last_workspace(app: tauri::AppHandle, path: String) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let _ = store.set("last_workspace_path".to_string(), JsonValue::String(path));
    let _ = store.save();
}

#[tauri::command]
fn save_session_state(app: tauri::AppHandle, open_tabs: Vec<String>, expanded_folders: Vec<String>) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let session = SessionState { open_tabs, expanded_folders };
    let _ = store.set("session_state".to_string(), serde_json::to_value(session).unwrap());
    let _ = store.save();
}

#[tauri::command]
fn load_session_state(app: tauri::AppHandle) -> Option<SessionState> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    store.get("session_state").and_then(|value| serde_json::from_value(value.clone()).ok())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .invoke_handler(tauri::generate_handler![
      open_workspace_window,
      open_preferences_window,
      save_last_workspace,
      save_session_state,
      load_session_state,
      theme::theme_broadcast,
      handlers::files::read_workspace_files,
      handlers::files::create_file_in_workspace,
      handlers::files::create_folder_in_workspace,
      handlers::files::read_file_content,
      handlers::files::write_file_content,
      handlers::files::rename_file,
      handlers::files::move_file,
      handlers::files::delete_file,
      handlers::files::reveal_in_finder,
      handlers::files::open_terminal,
      clipboard::clipboard_write_text,
      clipboard::clipboard_read_text,
      clipboard::clipboard_write_html,
      clipboard::clipboard_read_html,
      clipboard::clipboard_has_text,
      clipboard::clipboard_clear,
      tasks::create_task,
      tasks::get_all_tasks,
      tasks::get_task,
      tasks::update_task,
      tasks::delete_task,
      tasks::get_tasks_by_status,
      tasks::get_tasks_by_note,
      tasks::bulk_update_task_status,
      tasks::extract_tasks_from_content,
      search::search_in_files,
      search::search_in_file,
      search::get_file_content_with_lines,
      search::build_search_index,
      plugins::list_plugins,
      plugins::install_plugin,
      plugins::install_plugin_from_path,
      plugins::install_plugin_from_url,
      plugins::uninstall_plugin,
      plugins::get_plugin_info,
      plugins::validate_plugin_manifest,
      plugins::get_plugins_directory,
      plugins::create_plugins_directory,
      plugins::enable_plugin,
      plugins::disable_plugin,
      plugins::get_enabled_plugins,
      plugins::set_plugin_permission,
      plugins::get_plugin_permissions,
      plugins::set_plugin_setting,
      plugins::get_plugin_setting
    ])
    .setup(|app| {
      menu::init(&app.handle())?;
      
      let app_handle = app.handle().clone();
      let store = StoreBuilder::new(app.handle(), PathBuf::from(".settings.dat")).build().unwrap();
      let _ = store.reload();

      if let Some(path) = store.get("last_workspace_path") {
        if let Some(path_str) = path.as_str() {
          let main_window = app.get_webview_window("main").unwrap();
          main_window.hide().unwrap();
          let _ = open_workspace_window(app_handle, path_str.to_string());
        }
      } else {
        // If no workspace is open, explicitly show the main window
        let main_window = app.get_webview_window("main").unwrap();
        main_window.show().unwrap();
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
