#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod menu;
mod theme;
mod handlers;
mod clipboard;
mod clipboard_platform;
mod tasks;
mod kanban;
mod search;
mod plugins;
mod platform;
mod mcp;
mod mcp_setup;
mod mcp_embedded;
mod auth;
mod connections;
mod oauth_server;
mod secure_storage;
mod api_server;

use windows::{open_workspace_window, open_preferences_window, open_launcher_window};
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
    println!("[Backend] validate_workspace_path called with: {}", path);
    let workspace_path = std::path::Path::new(&path);

    // Check if path exists and is a directory
    if !workspace_path.exists() || !workspace_path.is_dir() {
        println!("[Backend] Path validation failed: path doesn't exist or is not a directory");
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
            // Successfully created, keep it for workspace initialization
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

#[derive(serde::Serialize)]
struct WorkspaceItem {
    path: String,
    name: String,
}

#[tauri::command]
fn get_all_workspaces(app: tauri::AppHandle) -> Vec<WorkspaceItem> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();

    let mut workspaces = Vec::new();

    // Get last workspace
    if let Some(path_value) = store.get("last_workspace_path") {
        if let Some(path) = path_value.as_str() {
            let name = std::path::Path::new(path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            workspaces.push(WorkspaceItem {
                path: path.to_string(),
                name,
            });
        }
    }

    // Get all session states to find unique workspace paths
    // Note: Currently we only return the last workspace because workspace paths
    // are stored as hashed keys (session_state_<hash>). To support multiple
    // workspaces, we would need to store workspace metadata separately.

    workspaces
}

fn main() {
  // Load environment variables from .env file if it exists
  // Use proper path resolution instead of hardcoded relative path
  if let Ok(current_dir) = std::env::current_dir() {
    let env_path = current_dir.parent().unwrap_or(&current_dir).join(".env");
    if env_path.exists() {
      if let Err(e) = dotenvy::from_path(&env_path) {
        println!("Warning: Failed to load .env file from {:?}: {}", env_path, e);
      }
    }
  }

  // Set up panic hook to handle WebView2 cleanup errors gracefully
  std::panic::set_hook(Box::new(|panic_info| {
    let payload = panic_info.payload();
    if let Some(s) = payload.downcast_ref::<&str>() {
      // Ignore WebView2 window cleanup errors
      if s.contains("Failed to unregister class") || s.contains("Chrome_WidgetWin") {
        eprintln!("WebView2 cleanup warning (non-critical): {}", s);
        return;
      }
    }
    // For other panics, print the normal panic message
    eprintln!("Application panic: {}", panic_info);
  }));

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
      open_launcher_window,
      save_last_workspace,
      clear_last_workspace,
      validate_workspace_path,
      get_validated_workspace_path,
      clear_all_workspace_data,
      is_development_mode,
      force_launcher_mode,
      save_session_state,
      load_session_state,
      get_all_workspaces,
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
      tasks::link_task_to_kanban,
      tasks::get_tasks_by_kanban_board,
      kanban::list_kanban_boards,
      kanban::create_kanban_board,
      kanban::open_kanban_board,
      kanban::save_kanban_board,
      kanban::delete_kanban_board,
      kanban::rename_kanban_board,
      kanban::add_card_to_board,
      kanban::move_card_between_columns,
      kanban::update_card_in_board,
      kanban::delete_card_from_board,
      kanban::initialize_workspace_kanban,
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
      auth::initiate_oauth_flow,
      auth::handle_oauth_callback,
      auth::is_authenticated,
      auth::get_auth_token,
      auth::get_user_profile,
      auth::refresh_auth_token,
      auth::logout,
      auth::open_auth_url,
      connections::gmail_initiate_auth,
      connections::gmail_complete_auth,
      connections::gmail_check_auth_callback,
      connections::gmail_is_authenticated,
      connections::gmail_logout,
      connections::gmail_get_profile,
      connections::gmail_list_emails,
      connections::gmail_search_emails,
      connections::gmail_get_email,
      connections::gmail_send_email,
      connections::gmail_reply_email,
      connections::gmail_forward_email,
      connections::gmail_mark_as_read,
      connections::gmail_mark_as_unread,
      connections::gmail_star_emails,
      connections::gmail_unstar_emails,
      connections::gmail_archive_emails,
      connections::gmail_delete_emails,
      connections::gmail_get_labels,
      connections::gmail_get_queue_stats,
      connections::gmail_force_process_queue,
      connections::gmail_clear_queue,
      mcp_setup::setup_mcp_integration,
      mcp_setup::check_mcp_status,
      api_server::api_set_workspace,
      api_server::api_clear_workspace
    ])
    .setup(|app| {
      menu::init(&app.handle())?;

      // Initialize platform-specific systems with better error handling
      match handlers::platform_files::initialize() {
        Ok(_) => println!("✅ Platform file operations initialized successfully"),
        Err(e) => {
          eprintln!("⚠️ Warning: Failed to initialize platform file operations: {}", e);
          eprintln!("ℹ️ Some file operations may not work properly");
        }
      }

      match clipboard_platform::initialize() {
        Ok(_) => println!("✅ Platform clipboard initialized successfully"),
        Err(e) => {
          eprintln!("⚠️ Warning: Failed to initialize platform clipboard: {}", e);
          eprintln!("ℹ️ Clipboard functionality may be limited");
        }
      }

      // Initialize MCP Server Manager
      let mcp_manager = mcp::MCPServerManager::new(app.handle().clone());
      app.manage(mcp_manager);

      // Initialize auth state
      let auth_state = auth::SharedAuthState::default();
      app.manage(auth_state);

      // Initialize OAuth Server
      let oauth_server = oauth_server::OAuthServer::new();
      app.manage(oauth_server.clone());

      // Start OAuth server after the app is fully initialized
      let oauth_server_clone = oauth_server.clone();
      tauri::async_runtime::spawn(async move {
        match oauth_server_clone.start().await {
          Ok(_) => println!("[OAUTH SERVER] ✅ OAuth server started successfully"),
          Err(e) => {
            eprintln!("[OAUTH SERVER] ⚠️ Failed to start OAuth server: {}", e);
            eprintln!("[OAUTH SERVER] ℹ️ OAuth functionality will be disabled");
            eprintln!("[OAUTH SERVER] 💡 Try setting OAUTH_PORT environment variable to use a different port");
          }
        }
      });

      // Initialize and start API server for MCP integration
      let api_state = api_server::ApiState {
        app_handle: app.handle().clone(),
        current_workspace: std::sync::Arc::new(tokio::sync::RwLock::new(None)),
      };
      app.manage(api_state.clone());

      // Start API server for MCP integration
      let app_handle_for_api = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        println!("[API Server] 🚀 Starting API server for MCP integration...");
        api_server::start_api_server(app_handle_for_api).await;
      });

      // Initialize Gmail Connection Manager - always manage even if initialization fails
      match connections::ConnectionManager::new(app.handle().clone()) {
        Ok(connection_manager) => {
          println!("[GMAIL] 🚀 Connection Manager initialized successfully");
          app.manage(connection_manager);
        }
        Err(e) => {
          eprintln!("[GMAIL] ❌ Failed to initialize Connection Manager: {}", e);
          eprintln!("[GMAIL] ℹ️  Creating fallback Connection Manager for graceful error handling");
          // Create a fallback connection manager to prevent "state not managed" errors
          if let Ok(fallback_manager) = connections::ConnectionManager::new_fallback() {
            app.manage(fallback_manager);
          }
        }
      }

      // Register deep link handler for auth callbacks
      auth::register_deep_link_handler(&app.handle());

      // Auto-setup MCP integration on first launch
      let app_clone = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        let setup = mcp_setup::MCPSetup::new(app_clone);
        if !setup.is_setup_complete() {
          println!("[MCP] First launch detected - setting up MCP integration...");
          if let Err(e) = setup.setup().await {
            eprintln!("[MCP] ❌ Setup failed: {}", e);
          }
        } else {
          println!("[MCP] ✅ MCP integration already configured");
        }
      });

      let app_handle = app.handle().clone();
      let store = StoreBuilder::new(app.handle(), PathBuf::from(".settings.dat")).build().unwrap();
      let _ = store.reload();

      // In development mode, always clear workspace data and show launcher
      if cfg!(debug_assertions) {
        println!("Development mode detected - clearing workspace data and showing launcher");
        clear_all_workspace_data(app.handle().clone());
        if let Some(main_window) = app.get_webview_window("main") {
          let _ = main_window.show();
        }
      } else {
        // Production mode - use the validation function to check for valid workspace
        if let Some(valid_path) = get_validated_workspace_path(app.handle().clone()) {
          println!("Loading validated workspace: {}", valid_path);
          if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.hide();
          }
          let _ = open_workspace_window(app_handle, valid_path);
        } else {
          // No valid workspace found, show the launcher
          println!("No valid workspace found, showing launcher");
          if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.show();
          }
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
