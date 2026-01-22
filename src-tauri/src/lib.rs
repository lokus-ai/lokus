#[cfg(desktop)]
mod window_manager;
#[cfg(desktop)]
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
#[cfg(desktop)]
mod mcp;
#[cfg(desktop)]
mod mcp_setup;
#[cfg(desktop)]
mod mcp_embedded;
#[cfg(desktop)]
mod auth;
#[cfg(desktop)]
mod connections;
#[cfg(desktop)]
mod calendar;
#[cfg(desktop)]
mod oauth_server;
mod secure_storage;
#[cfg(desktop)]
mod api_server;
mod logging;
#[cfg(desktop)]
mod sync;
#[cfg(desktop)]
mod credentials;
mod file_locking;
#[cfg(target_os = "macos")]
mod macos;

#[cfg(desktop)]
use window_manager::{open_workspace_window, open_preferences_window, open_launcher_window};
use tauri::{Manager, Listener, Emitter};
use tauri_plugin_store::{StoreBuilder, JsonValue};
use std::path::PathBuf;

#[derive(serde::Serialize, serde::Deserialize)]
struct SessionState {
    open_tabs: Vec<String>,
    expanded_folders: Vec<String>,
    #[serde(default)]
    recent_files: Vec<String>,
}

#[tauri::command]
fn save_last_workspace(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat"))
        .build()
        .map_err(|e| format!("Store error: {}", e))?;
    let _ = store.reload();

    #[cfg(target_os = "macos")]
    {
        // Create security-scoped bookmark for macOS
        match macos::bookmarks::create_bookmark(&path) {
            Ok(bookmark_data) => {
                // Save both path and bookmark
                let _ = store.set("last_workspace_path".to_string(), JsonValue::String(path));
                let _ = store.set("last_workspace_bookmark".to_string(), serde_json::to_value(bookmark_data).unwrap());
                let _ = store.save();
                Ok(())
            }
            Err(e) => {
                // If bookmark creation fails, still save the path
                // (will fall back to normal validation)
                tracing::warn!("Failed to create bookmark: {}", e);
                let _ = store.set("last_workspace_path".to_string(), JsonValue::String(path));
                let _ = store.save();
                Ok(())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Non-macOS: Just save path
        let _ = store.set("last_workspace_path".to_string(), JsonValue::String(path));
        let _ = store.save();
        Ok(())
    }
}

#[tauri::command]
fn clear_last_workspace(app: tauri::AppHandle) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let _ = store.delete("last_workspace_path".to_string());
    let _ = store.save();
}

/// Internal helper to validate a workspace path
/// This contains the core validation logic without bookmark handling
fn validate_path_internal(path: &str) -> bool {
    let workspace_path = std::path::Path::new(path);

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
            // Successfully created, keep it for workspace initialization
            true
        }
        Err(_) => false
    }
}

#[tauri::command]
fn validate_workspace_path(_app: tauri::AppHandle, path: String) -> bool {
    #[cfg(target_os = "macos")]
    {
        // Try to resolve bookmark first to get security-scoped access
        if let Ok(store) = StoreBuilder::new(&_app, PathBuf::from(".settings.dat")).build() {
            let _ = store.reload();
            if let Some(bookmark_value) = store.get("last_workspace_bookmark") {
                if let Ok(bookmark_data) = serde_json::from_value::<Vec<u8>>(bookmark_value.clone()) {
                    match macos::bookmarks::resolve_bookmark(&bookmark_data) {
                        Ok(resolved_path) => {
                            // Successfully got access via bookmark
                            let is_valid = validate_path_internal(&resolved_path);
                            macos::bookmarks::stop_accessing(&resolved_path);
                            return is_valid;
                        }
                        Err(e) => {
                            tracing::debug!("Failed to resolve bookmark: {}", e);
                            // Fall through to normal validation
                        }
                    }
                }
            }
        }
    }

    // Fallback: try normal validation (or used on non-macOS)
    validate_path_internal(&path)
}

/// Check if a workspace path needs re-authorization
/// Returns true if the workspace likely exists but we can't access it due to stale bookmark
/// This helps distinguish between "deleted/moved" vs "permission lost after app update"
#[tauri::command]
fn check_workspace_needs_reauth(_app: tauri::AppHandle, path: String) -> bool {
    #[cfg(target_os = "macos")]
    {
        // First, check if we have a stored bookmark for this path
        if let Ok(store) = StoreBuilder::new(&_app, PathBuf::from(".settings.dat")).build() {
            let _ = store.reload();

            // Check if the stored path matches
            let stored_path = store.get("last_workspace_path")
                .and_then(|v| v.as_str().map(String::from));

            if stored_path.as_deref() == Some(path.as_str()) {
                // We have a stored path matching this one
                // Try to resolve the bookmark
                if let Some(bookmark_value) = store.get("last_workspace_bookmark") {
                    if let Ok(bookmark_data) = serde_json::from_value::<Vec<u8>>(bookmark_value.clone()) {
                        match macos::bookmarks::resolve_bookmark(&bookmark_data) {
                            Ok(resolved_path) => {
                                // Bookmark still works - don't need reauth
                                macos::bookmarks::stop_accessing(&resolved_path);
                                return false;
                            }
                            Err(_) => {
                                // Bookmark is stale - need reauth
                                // The workspace likely still exists, just can't access it
                                return true;
                            }
                        }
                    }
                }
            }
        }

        // No bookmark found for this path, or path doesn't match
        // This could be a recent workspace without a bookmark
        // Try direct access as fallback (will fail in sandbox but might work in dev)
        let workspace_path = std::path::Path::new(&path);
        if workspace_path.exists() && workspace_path.is_dir() {
            return false; // Can access directly
        }

        // Can't determine - assume needs reauth if the path looks valid
        // (has parent directory structure that suggests it once existed)
        if let Some(parent) = workspace_path.parent() {
            if parent.exists() {
                return true; // Parent exists, so workspace might have existed
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On non-macOS, just check if path exists
        let workspace_path = std::path::Path::new(&path);
        return !workspace_path.exists();
    }

    false
}

fn restore_workspace_access(_app: &tauri::AppHandle) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(store) = StoreBuilder::new(_app, PathBuf::from(".settings.dat")).build() {
            let _ = store.reload();
            if let Some(bookmark_value) = store.get("last_workspace_bookmark") {
                if let Ok(bookmark_data) = serde_json::from_value::<Vec<u8>>(bookmark_value.clone()) {
                    match macos::bookmarks::resolve_bookmark(&bookmark_data) {
                        Ok(resolved_path) => {
                            // Successfully got access via bookmark
                            // IMPORTANT: We DO NOT call stop_accessing here.
                            // We need to keep the access open for the duration of the app session.
                            if validate_path_internal(&resolved_path) {
                                tracing::info!("Restored security-scoped access to: {}", resolved_path);
                                return Some(resolved_path);
                            } else {
                                // Path invalid, cleanup
                                macos::bookmarks::stop_accessing(&resolved_path);
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to resolve bookmark: {}", e);
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
fn get_validated_workspace_path(app: tauri::AppHandle) -> Option<String> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();

    if let Some(path) = store.get("last_workspace_path") {
        if let Some(path_str) = path.as_str() {
            if validate_workspace_path(app.clone(), path_str.to_string()) {
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
fn save_session_state(app: tauri::AppHandle, workspace_path: String, open_tabs: Vec<String>, expanded_folders: Vec<String>, recent_files: Vec<String>) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat")).build().unwrap();
    let _ = store.reload();
    let session = SessionState { open_tabs, expanded_folders, recent_files };

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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Load environment variables from .env file if it exists
  // Use proper path resolution instead of hardcoded relative path
  if let Ok(current_dir) = std::env::current_dir() {
    let env_path = current_dir.parent().unwrap_or(&current_dir).join(".env");
    if env_path.exists() {
      if let Err(_e) = dotenvy::from_path(&env_path) {
      }
    }
  }

  // Initialize logging infrastructure first
  let log_config = logging::LoggingConfig {
    log_dir: dirs::home_dir()
      .unwrap_or_default()
      .join(".lokus")
      .join("logs"),
    max_days_retained: 7,
    sentry_enabled: std::env::var("VITE_ENABLE_CRASH_REPORTS")
      .unwrap_or_else(|_| "false".to_string())
      .to_lowercase() == "true",
    environment: std::env::var("VITE_SENTRY_ENVIRONMENT")
      .unwrap_or_else(|_| "production".to_string()),
  };

  let _ = logging::init_logging(log_config);

  tracing::info!("Lokus starting...");

  // Initialize Sentry for crash reporting (desktop only)
  #[cfg(desktop)]
  let _sentry_guard = {
    let sentry_dsn = std::env::var("TAURI_SENTRY_DSN").ok();
    let sentry_enabled = std::env::var("VITE_ENABLE_CRASH_REPORTS")
      .unwrap_or_else(|_| "false".to_string())
      .to_lowercase() == "true";
    let sentry_environment = std::env::var("VITE_SENTRY_ENVIRONMENT")
      .unwrap_or_else(|_| "production".to_string());

    let guard = if let (Some(dsn), true) = (sentry_dsn.as_ref(), sentry_enabled) {
      let g = sentry::init((
        dsn.as_str(),
        sentry::ClientOptions {
          release: sentry::release_name!(),
          environment: Some(sentry_environment.clone().into()),
          attach_stacktrace: true,
          ..Default::default()
        },
      ));
      Some(g)
    } else {
      None
    };

    // Set up panic hook to handle WebView2 cleanup errors gracefully and report to Sentry
    let default_panic = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
      let payload = panic_info.payload();
      if let Some(s) = payload.downcast_ref::<&str>() {
        // Ignore WebView2 window cleanup errors (don't report to Sentry)
        if s.contains("Failed to unregister class") || s.contains("Chrome_WidgetWin") {
          return;
        }
      }

      // Report panic to Sentry
      sentry::integrations::panic::panic_handler(panic_info);

      // Also print the normal panic message
      default_panic(panic_info);
    }));

    guard
  };

  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_shell::init());

  // Desktop-only plugins
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
  }

  builder
    .invoke_handler(tauri::generate_handler![
      greet,
      #[cfg(desktop)]
      open_workspace_window,
      #[cfg(desktop)]
      open_preferences_window,
      #[cfg(desktop)]
      open_launcher_window,
      #[cfg(desktop)]
      window_manager::sync_window_theme,
      save_last_workspace,
      clear_last_workspace,
      validate_workspace_path,
      check_workspace_needs_reauth,
      get_validated_workspace_path,
      clear_all_workspace_data,
      is_development_mode,
      force_launcher_mode,
      save_session_state,
      load_session_state,
      get_all_workspaces,
      theme::theme_broadcast,
      theme::import_theme_file,
      theme::validate_theme_file,
      theme::export_theme,
      theme::delete_custom_theme,
      theme::list_custom_themes,
      theme::get_theme_tokens,
      theme::save_theme_tokens,
      handlers::files::read_workspace_files,
      handlers::files::create_file_in_workspace,
      handlers::files::create_folder_in_workspace,
      handlers::files::read_file_content,
      handlers::files::read_binary_file,
      handlers::files::write_file_content,
      handlers::files::save_file_version_manual,
      handlers::files::rename_file,
      handlers::files::move_file,
      handlers::files::delete_file,
      handlers::files::reveal_in_finder,
      handlers::files::open_terminal,
      handlers::files::read_image_file,
      handlers::files::path_exists,
      handlers::files::is_directory,
      handlers::files::read_directory,
      handlers::files::write_file,
      handlers::files::create_directory,
      handlers::files::read_all_files,
      handlers::files::copy_external_files_to_workspace,
      handlers::files::find_workspace_images,
      handlers::platform_files::platform_reveal_in_file_manager,
      handlers::platform_files::platform_open_terminal,
      handlers::platform_files::get_platform_information,
      handlers::platform_files::check_platform_feature_support,
      handlers::platform_files::get_platform_capabilities,
      handlers::version_history::save_version,
      handlers::version_history::get_file_versions,
      handlers::version_history::get_version_content,
      handlers::version_history::get_diff,
      handlers::version_history::restore_version,
      handlers::version_history::cleanup_old_versions,
      #[cfg(desktop)]
      sync::git_init,
      #[cfg(desktop)]
      sync::git_add_remote,
      #[cfg(desktop)]
      sync::git_commit,
      #[cfg(desktop)]
      sync::git_push,
      #[cfg(desktop)]
      sync::git_pull,
      #[cfg(desktop)]
      sync::git_status,
      #[cfg(desktop)]
      sync::detect_conflicts,
      #[cfg(desktop)]
      sync::git_get_current_branch,
      #[cfg(desktop)]
      sync::git_force_push,
      #[cfg(desktop)]
      sync::git_force_pull,
      // Iroh sync commands
      #[cfg(desktop)]
      sync::iroh_check_saved_document,
      #[cfg(desktop)]
      sync::iroh_init_document,
      #[cfg(desktop)]
      sync::iroh_join_document,
      #[cfg(desktop)]
      sync::iroh_leave_document,
      #[cfg(desktop)]
      sync::iroh_get_ticket,
      #[cfg(desktop)]
      sync::iroh_sync_status,
      #[cfg(desktop)]
      sync::iroh_list_peers,
      #[cfg(desktop)]
      sync::iroh_manual_sync,
      #[cfg(desktop)]
      sync::iroh_start_auto_sync,
      #[cfg(desktop)]
      sync::iroh_stop_auto_sync,
      #[cfg(desktop)]
      sync::iroh_notify_file_save,
      #[cfg(desktop)]
      sync::iroh_force_sync_all,
      #[cfg(desktop)]
      sync::iroh_get_sync_metrics,
      #[cfg(desktop)]
      sync::iroh_get_version,
      #[cfg(desktop)]
      sync::iroh_migrate_to_v2,
      #[cfg(desktop)]
      sync::iroh_configure_sync,
      #[cfg(desktop)]
      sync::iroh_get_metrics,
      #[cfg(desktop)]
      credentials::store_git_credentials,
      #[cfg(desktop)]
      credentials::retrieve_git_credentials,
      #[cfg(desktop)]
      credentials::delete_git_credentials,
      #[cfg(desktop)]
      credentials::store_iroh_keys,
      #[cfg(desktop)]
      credentials::retrieve_iroh_keys,
      #[cfg(desktop)]
      credentials::delete_iroh_keys,
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
      #[cfg(desktop)]
      mcp::mcp_start,
      #[cfg(desktop)]
      mcp::mcp_stop,
      #[cfg(desktop)]
      mcp::mcp_status,
      #[cfg(desktop)]
      mcp::mcp_restart,
      #[cfg(desktop)]
      mcp::mcp_health_check,
      #[cfg(desktop)]
      auth::initiate_oauth_flow,
      #[cfg(desktop)]
      auth::handle_oauth_callback,
      #[cfg(desktop)]
      auth::is_authenticated,
      #[cfg(desktop)]
      auth::get_auth_token,
      #[cfg(desktop)]
      auth::get_user_profile,
      #[cfg(desktop)]
      auth::refresh_auth_token,
      #[cfg(desktop)]
      auth::logout,
      #[cfg(desktop)]
      auth::open_auth_url,
      #[cfg(desktop)]
      connections::gmail_initiate_auth,
      #[cfg(desktop)]
      connections::gmail_complete_auth,
      #[cfg(desktop)]
      connections::gmail_check_auth_callback,
      #[cfg(desktop)]
      connections::gmail_is_authenticated,
      #[cfg(desktop)]
      connections::gmail_logout,
      #[cfg(desktop)]
      connections::gmail_get_profile,
      #[cfg(desktop)]
      connections::gmail_list_emails,
      #[cfg(desktop)]
      connections::gmail_search_emails,
      #[cfg(desktop)]
      connections::gmail_get_email,
      #[cfg(desktop)]
      connections::gmail_send_email,
      #[cfg(desktop)]
      connections::gmail_reply_email,
      #[cfg(desktop)]
      connections::gmail_forward_email,
      #[cfg(desktop)]
      connections::gmail_mark_as_read,
      #[cfg(desktop)]
      connections::gmail_mark_as_unread,
      #[cfg(desktop)]
      connections::gmail_star_emails,
      #[cfg(desktop)]
      connections::gmail_unstar_emails,
      #[cfg(desktop)]
      connections::gmail_archive_emails,
      #[cfg(desktop)]
      connections::gmail_delete_emails,
      #[cfg(desktop)]
      connections::gmail_get_labels,
      #[cfg(desktop)]
      connections::gmail_get_queue_stats,
      #[cfg(desktop)]
      connections::gmail_force_process_queue,
      #[cfg(desktop)]
      connections::gmail_clear_queue,
      #[cfg(desktop)]
      mcp_setup::setup_mcp_integration,
      #[cfg(desktop)]
      mcp_setup::check_mcp_status,
      #[cfg(desktop)]
      mcp_setup::restart_mcp_server,
      #[cfg(desktop)]
      api_server::api_set_workspace,
      #[cfg(desktop)]
      api_server::api_clear_workspace,
      #[cfg(desktop)]
      api_server::api_get_current_workspace,
      // Calendar commands
      #[cfg(desktop)]
      calendar::google_calendar_auth_start,
      #[cfg(desktop)]
      calendar::google_calendar_auth_complete,
      #[cfg(desktop)]
      calendar::google_calendar_check_auth_callback,
      #[cfg(desktop)]
      calendar::google_calendar_auth_status,
      #[cfg(desktop)]
      calendar::google_calendar_get_account,
      #[cfg(desktop)]
      calendar::calendar_disconnect,
      #[cfg(desktop)]
      calendar::get_calendars,
      #[cfg(desktop)]
      calendar::get_cached_calendars,
      #[cfg(desktop)]
      calendar::get_events,
      #[cfg(desktop)]
      calendar::get_all_events,
      #[cfg(desktop)]
      calendar::create_event,
      #[cfg(desktop)]
      calendar::update_event,
      #[cfg(desktop)]
      calendar::delete_event,
      #[cfg(desktop)]
      calendar::get_sync_status,
      #[cfg(desktop)]
      calendar::sync_calendars,
      #[cfg(desktop)]
      calendar::update_calendar_visibility
    ])
    .setup(|app| {
      #[cfg(desktop)]
      menu::init(&app.handle())?;

      // Initialize platform-specific systems with better error handling
      match handlers::platform_files::initialize() {
        Ok(_) => {},
        Err(_e) => {
        }
      }

      match clipboard_platform::initialize() {
        Ok(_) => {},
        Err(_e) => {
        }
      }

      // Desktop-only initialization
      #[cfg(desktop)]
      {
        // Initialize MCP Server Manager
        let mcp_manager = mcp::MCPServerManager::new(app.handle().clone());
        app.manage(mcp_manager.clone());

        // Auto-start HTTP MCP server for CLI integration
        let mcp_manager_clone = mcp_manager.clone();
        tauri::async_runtime::spawn(async move {
          // Small delay to ensure MCP setup completes first
          tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

          match mcp_manager_clone.auto_start() {
            Ok(_status) => {
            }
            Err(_e) => {
            }
          }
        });

        // Initialize auth state
        let auth_state = auth::SharedAuthState::default();
        app.manage(auth_state);

        // Initialize calendar auth state
        let calendar_state = calendar::SharedCalendarAuthState::default();
        app.manage(calendar_state);

        // Initialize Iroh sync provider (V1 or V2 based on configuration)
        // Initialize Iroh provider synchronously (it will be initialized on first use)
        let provider = sync::wrapper::IrohProviderWrapper::new(sync::wrapper::SyncProviderConfig::default());
        let iroh_provider = tokio::sync::Mutex::new(provider);
        app.manage(iroh_provider);

        // Initialize OAuth Server
        let oauth_server = oauth_server::OAuthServer::new();
        app.manage(oauth_server.clone());

        // Start OAuth server after the app is fully initialized
        let oauth_server_clone = oauth_server.clone();
        tauri::async_runtime::spawn(async move {
          match oauth_server_clone.start().await {
            Ok(_) => {},
            Err(_e) => {
            }
          }
        });

        // Initialize and start API server for MCP integration
        // Create state readiness notifier to prevent race conditions
        let api_state_ready = std::sync::Arc::new(tokio::sync::Notify::new());

        let api_state = api_server::ApiState {
          app_handle: app.handle().clone(),
          current_workspace: std::sync::Arc::new(tokio::sync::RwLock::new(None)),
        };

        // Start API server task FIRST (so it can wait for notification)
        let app_handle_for_api = app.handle().clone();
        let api_ready_clone = api_state_ready.clone();
        tauri::async_runtime::spawn(async move {
          let config = api_server::ApiServerConfig {
            state_ready: api_ready_clone,
            max_retries: 5,
            base_delay_ms: 100,
          };

          match api_server::start_api_server(app_handle_for_api, config).await {
            Ok(port) => {
              tracing::info!(port, "API server started successfully");
            }
            Err(e) => {
              tracing::error!(error = %e, "Failed to start API server");
              sentry::capture_message(
                &format!("API server failed to start: {}", e),
                sentry::Level::Error
              );
            }
          }
        });

        // Small delay to ensure task is spawned and waiting
        std::thread::sleep(std::time::Duration::from_millis(10));

        // THEN manage state and signal
        app.manage(api_state.clone());
        api_state_ready.notify_one();
        tracing::debug!("ApiState registered and notified");

        // Initialize Gmail Connection Manager - always manage even if initialization fails
        match connections::ConnectionManager::new(app.handle().clone()) {
          Ok(connection_manager) => {
            app.manage(connection_manager);
          }
          Err(_e) => {
            // Create a fallback connection manager to prevent "state not managed" errors
            if let Ok(fallback_manager) = connections::ConnectionManager::new_fallback() {
              app.manage(fallback_manager);
            }
          }
        }

        // Register deep link handler for auth callbacks
        auth::register_deep_link_handler(&app.handle());
      }

      // Register generic deep link handler for plugin dev
      let app_handle_deep_link = app.handle().clone();
      app.listen("deep-link://new-url", move |event| {
        let payload = event.payload();
        let _ = app_handle_deep_link.emit("deep-link-received", payload);
        
        // If this is a plugin-dev link, try to open devtools (debug only)
        #[cfg(debug_assertions)]
        if payload.contains("lokus://plugin-dev") {
          if let Some(window) = app_handle_deep_link.get_webview_window("main") {
            window.open_devtools();
          }
        }
      });

      // Auto-setup MCP integration on first launch (desktop only)
      #[cfg(desktop)]
      {
        let app_clone = app.handle().clone();
        tauri::async_runtime::spawn(async move {
          let setup = mcp_setup::MCPSetup::new(app_clone);
          if !setup.is_setup_complete() {
            if let Err(_e) = setup.setup().await {
            }
          } else {
          }
        });
      }

      // Desktop-only window management
      #[cfg(desktop)]
      {
        let app_handle = app.handle().clone();
        let store = StoreBuilder::new(app.handle(), PathBuf::from(".settings.dat")).build().unwrap();
        let _ = store.reload();

        // In development mode, always clear workspace data and show launcher
        if cfg!(debug_assertions) {
          clear_all_workspace_data(app.handle().clone());
          if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.show();
          }
        } else {
          // Production mode - use the validation function to check for valid workspace
          // Try to restore access via bookmark first (macOS)
          let mut valid_path = restore_workspace_access(&app.handle());

          // If no bookmark restored, try standard validation (non-macOS or fallback)
          if valid_path.is_none() {
               valid_path = get_validated_workspace_path(app.handle().clone());
          }

          if let Some(path) = valid_path {
            if let Some(main_window) = app.get_webview_window("main") {
              let _ = main_window.hide();
            }
            let _ = open_workspace_window(app_handle, path);
          } else {
            // No valid workspace found, show the launcher
            if let Some(main_window) = app.get_webview_window("main") {
              let _ = main_window.show();
            }
          }
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
