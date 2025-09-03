#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod menu;
mod theme;
mod handlers;

use windows::open_workspace_window;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      open_workspace_window,
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
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
