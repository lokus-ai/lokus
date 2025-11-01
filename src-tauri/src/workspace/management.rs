//! Workspace management operations
//!
//! Handles workspace path validation, persistence, and retrieval

use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_store::{JsonValue, StoreBuilder};

use super::models::WorkspaceItem;

/// Save the last opened workspace path to persistent storage
#[tauri::command]
pub fn save_last_workspace(app: AppHandle, path: String) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat"))
        .build()
        .unwrap();
    let _ = store.reload();
    let _ = store.set("last_workspace_path".to_string(), JsonValue::String(path));
    let _ = store.save();
}

/// Clear the last opened workspace path from persistent storage
#[tauri::command]
pub fn clear_last_workspace(app: AppHandle) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat"))
        .build()
        .unwrap();
    let _ = store.reload();
    let _ = store.delete("last_workspace_path".to_string());
    let _ = store.save();
}

/// Validate if a path is a valid workspace directory
///
/// Checks:
/// - Path exists and is a directory
/// - Path is readable
/// - .lokus directory exists or can be created
#[tauri::command]
pub fn validate_workspace_path(path: String) -> bool {
    println!("[Backend] validate_workspace_path called with: {}", path);
    let workspace_path = Path::new(&path);

    // Check if path exists and is a directory
    if !workspace_path.exists() || !workspace_path.is_dir() {
        println!(
            "[Backend] Path validation failed: path doesn't exist or is not a directory"
        );
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
        Err(_) => false,
    }
}

/// Get the last workspace path if it's still valid
///
/// Returns None if the path is invalid or doesn't exist
#[tauri::command]
pub fn get_validated_workspace_path(app: AppHandle) -> Option<String> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat"))
        .build()
        .unwrap();
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

/// Clear all workspace data including session states
///
/// Used for development mode and resetting the application state
#[tauri::command]
pub fn clear_all_workspace_data(app: AppHandle) {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat"))
        .build()
        .unwrap();
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

/// Check if the application is running in development mode
#[tauri::command]
pub fn is_development_mode() -> bool {
    cfg!(debug_assertions)
}

/// Force launcher mode by clearing workspace data
///
/// Returns true on success
#[tauri::command]
pub fn force_launcher_mode(app: AppHandle) -> bool {
    clear_all_workspace_data(app);
    true
}

/// Get all configured workspaces
///
/// Currently returns only the last workspace due to hashed storage keys
#[tauri::command]
pub fn get_all_workspaces(app: AppHandle) -> Vec<WorkspaceItem> {
    let store = StoreBuilder::new(&app, PathBuf::from(".settings.dat"))
        .build()
        .unwrap();
    let _ = store.reload();

    let mut workspaces = Vec::new();

    // Get last workspace
    if let Some(path_value) = store.get("last_workspace_path") {
        if let Some(path) = path_value.as_str() {
            let name = Path::new(path)
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

    // Note: Currently we only return the last workspace because workspace paths
    // are stored as hashed keys (session_state_<hash>). To support multiple
    // workspaces, we would need to store workspace metadata separately.

    workspaces
}
