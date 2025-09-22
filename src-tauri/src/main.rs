#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod menu;
mod theme;
mod handlers;
mod clipboard;
mod clipboard_platform;
mod tasks;
mod search;
mod plugins;
mod platform;
mod mcp;
mod auth;

use windows::{open_workspace_window, open_preferences_window};
use tauri::Manager;
use tauri_plugin_store::{StoreBuilder, JsonValue};
use std::path::PathBuf;

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
fn clear_last_workspace(app: tauri::AppHandle) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let _ = store.delete("last_workspace_path".to_string());
    let _ = store.save();
}

#[tauri::command]
fn validate_workspace_path(path: String) -> bool {
    let workspace_path = std::path::Path::new(&path);
    
    // Check if path exists and is a directory
    if !workspace_path.exists() || !workspace_path.is_dir() {
        return false;
    }
    
    // Check if we can read the directory
    if workspace_path.read_dir().is_err() {
        return false;
    }
    
    // Check if it's a valid Lokus workspace or can be initialized as one
    let lokus_dir = workspace_path.join(".lokus");
    if lokus_dir.exists() {
        // It's already a Lokus workspace
        return lokus_dir.is_dir();
    }
    
    // If no .lokus folder, check if we can create one (write permissions)
    match std::fs::create_dir(&lokus_dir) {
        Ok(_) => {
            // Successfully created, remove it and return true
            let _ = std::fs::remove_dir(&lokus_dir);
            true
        }
        Err(_) => false
    }
}

#[tauri::command] 
fn get_validated_workspace_path(app: tauri::AppHandle) -> Option<String> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    
    if let Some(path) = store.get("last_workspace_path") {
        if let Some(path_str) = path.as_str() {
            if validate_workspace_path(path_str.to_string()) {
                return Some(path_str.to_string());
            } else {
                // Invalid path, clear it
                let _ = store.delete("last_workspace_path".to_string());
                let _ = store.save();
            }
        }
    }
    None
}

#[tauri::command]
fn clear_all_workspace_data(app: tauri::AppHandle) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    
    // Clear all workspace-related keys
    let _ = store.delete("last_workspace_path".to_string());
    
    // Clear all session states
    let keys = store.keys();
    for key in keys {
        if key.starts_with("session_state_") {
            let _ = store.delete(key.to_string());
        }
    }
    
    let _ = store.save();
    println!("Cleared all workspace data for development");
}

#[tauri::command]
fn is_development_mode() -> bool {
    // Check if we're in development mode
    cfg!(debug_assertions)
}

#[tauri::command]
fn force_launcher_mode(app: tauri::AppHandle) -> bool {
    clear_all_workspace_data(app);
    true
}

#[tauri::command]
fn save_session_state(app: tauri::AppHandle, workspace_path: String, open_tabs: Vec<String>, expanded_folders: Vec<String>) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let session = SessionState { open_tabs, expanded_folders };
    
    // Create workspace-specific key by hashing the path
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    workspace_path.hash(&mut hasher);
    let workspace_key = format!("session_state_{}", hasher.finish());
    
    let _ = store.set(workspace_key, serde_json::to_value(session).unwrap());
    let _ = store.save();
}

#[tauri::command]
fn load_session_state(app: tauri::AppHandle, workspace_path: String) -> Option<SessionState> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    
    // Create workspace-specific key by hashing the path
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    workspace_path.hash(&mut hasher);
    let workspace_key = format!("session_state_{}", hasher.finish());
    
    store.get(&workspace_key).and_then(|value| serde_json::from_value(value.clone()).ok())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![
      open_workspace_window,
      open_preferences_window,
      save_last_workspace,
      clear_last_workspace,
      validate_workspace_path,
      get_validated_workspace_path,
      clear_all_workspace_data,
      is_development_mode,
      force_launcher_mode,
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
      handlers::platform_files::platform_reveal_in_file_manager,
      handlers::platform_files::platform_open_terminal,
      handlers::platform_files::get_platform_information,
      handlers::platform_files::check_platform_feature_support,
      handlers::platform_files::get_platform_capabilities,
      clipboard::clipboard_write_text,
      clipboard::clipboard_read_text,
      clipboard::clipboard_write_html,
      clipboard::clipboard_read_html,
      clipboard::clipboard_has_text,
      clipboard::clipboard_clear,
      clipboard_platform::clipboard_write_text_enhanced,
      clipboard_platform::clipboard_read_text_enhanced,
      clipboard_platform::clipboard_write_html_enhanced,
      clipboard_platform::clipboard_get_content_info,
      clipboard_platform::clipboard_get_platform_info,
      clipboard_platform::clipboard_get_usage_tips,
      clipboard_platform::clipboard_clear_enhanced,
      platform::system_info::get_system_information,
      platform::system_info::check_system_capability,
      platform::examples::run_platform_examples,
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
      plugins::get_plugin_setting,
      plugins::read_plugin_file,
      plugins::get_plugin_manifest,
      mcp::mcp_start,
      mcp::mcp_stop,
      mcp::mcp_status,
      mcp::mcp_restart,
      mcp::mcp_health_check,
      auth::store_auth_token,
      auth::get_auth_token,
      auth::store_user_profile,
      auth::get_user_profile,
      auth::logout,
      auth::is_authenticated,
      auth::open_auth_url
    ])
    .setup(|app| {
      menu::init(&app.handle())?;
      
      // Initialize platform-specific systems
      if let Err(e) = handlers::platform_files::initialize() {
        eprintln!("Warning: Failed to initialize platform file operations: {}", e);
      }
      
      if let Err(e) = clipboard_platform::initialize() {
        eprintln!("Warning: Failed to initialize platform clipboard: {}", e);
      }
      
      // Initialize MCP Server Manager
      let mcp_manager = mcp::MCPServerManager::new(app.handle().clone());
      app.manage(mcp_manager);
      
      // Register deep link handler for auth callbacks
      auth::register_deep_link_handler(&app.handle());
      
      let app_handle = app.handle().clone();
      let store = StoreBuilder::new(app.handle(), PathBuf::from(".settings.dat")).build().unwrap();
      let _ = store.reload();

      // In development mode, always clear workspace data and show launcher
      if cfg!(debug_assertions) {
        println!("Development mode detected - clearing workspace data and showing launcher");
        clear_all_workspace_data(app.handle().clone());
        let main_window = app.get_webview_window("main").unwrap();
        main_window.show().unwrap();
      } else {
        // Production mode - use the validation function to check for valid workspace
        if let Some(valid_path) = get_validated_workspace_path(app.handle().clone()) {
          println!("Loading validated workspace: {}", valid_path);
          let main_window = app.get_webview_window("main").unwrap();
          main_window.hide().unwrap();
          let _ = open_workspace_window(app_handle, valid_path);
        } else {
          // No valid workspace found, show the launcher
          println!("No valid workspace found, showing launcher");
          let main_window = app.get_webview_window("main").unwrap();
          main_window.show().unwrap();
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
