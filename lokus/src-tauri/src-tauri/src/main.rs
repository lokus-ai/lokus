#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod menu;
mod theme;
mod handlers;

use windows::open_workspace_window;
use tauri::Manager;
use tauri_plugin_store::{StoreBuilder, JsonValue};
use std::path::PathBuf;

#[tauri::command]
fn save_last_workspace(app: tauri::AppHandle, path: String) {
    let mut store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let _ = store.set("last_workspace_path".to_string(), JsonValue::String(path));
    let _ = store.save();
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      open_workspace_window,
      save_last_workspace,
      theme::theme_broadcast,
      handlers::files::read_workspace_files,
      handlers::files::create_file_in_workspace,
      handlers::files::create_folder_in_workspace,
      handlers::files::read_file_content,
      handlers::files::write_file_content,
      handlers::files::rename_file,
      handlers::files::move_file
    ])
    .setup(|app| {
      menu::init(&app.handle())?;
      
      let app_handle = app.handle().clone();
      let mut store = StoreBuilder::new(app.handle(), PathBuf::from(".settings.dat")).build().unwrap();
      let _ = store.reload();

      if let Some(path) = store.get("last_workspace_path") {
        if let Some(path_str) = path.as_str() {
          let main_window = app.get_webview_window("main").unwrap();
          main_window.hide().unwrap();
          open_workspace_window(app_handle, path_str.to_string());
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
