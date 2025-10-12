/// HTTP API Server for MCP Integration
/// Provides REST endpoints for MCP to interact with Lokus
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::RwLock;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreBuilder;

#[derive(Clone)]
pub struct ApiState {
    pub app_handle: tauri::AppHandle,
    pub current_workspace: Arc<RwLock<Option<String>>>,
}

#[derive(Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub workspace: String,
    pub name: String,
    pub total_notes: usize,
    pub has_bases: bool,
    pub has_canvas: bool,
    pub has_tasks: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WorkspaceListItem {
    pub path: String,
    pub name: String,
    pub last_accessed: Option<i64>,
    pub note_count: Option<usize>,
}

#[derive(Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

// Get current workspace information
pub async fn get_workspace(
    State(state): State<ApiState>,
) -> Result<Json<ApiResponse<WorkspaceInfo>>, StatusCode> {
    let workspace = state.current_workspace.read().await;

    match workspace.as_ref() {
        Some(path) => {
            // Get workspace details
            let info = WorkspaceInfo {
                workspace: path.clone(),
                name: std::path::Path::new(path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                total_notes: count_notes(path).await,
                has_bases: check_has_feature(path, ".bases").await,
                has_canvas: check_has_feature(path, ".canvas").await,
                has_tasks: check_has_feature(path, ".tasks.db").await,
            };

            Ok(Json(ApiResponse {
                success: true,
                data: Some(info),
                error: None,
            }))
        }
        None => {
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some("No workspace open".to_string()),
            }))
        }
    }
}

// List all notes in workspace
pub async fn list_notes(
    State(state): State<ApiState>,
) -> Result<Json<ApiResponse<Vec<NoteInfo>>>, StatusCode> {
    let workspace = state.current_workspace.read().await;

    match workspace.as_ref() {
        Some(path) => {
            let notes = get_all_notes(path).await;
            Ok(Json(ApiResponse {
                success: true,
                data: Some(notes),
                error: None,
            }))
        }
        None => {
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some("No workspace open".to_string()),
            }))
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct NoteInfo {
    pub path: String,
    pub name: String,
    pub created: Option<i64>,
    pub modified: Option<i64>,
    pub tags: Vec<String>,
    pub links: Vec<String>,
}

// Get all tasks
pub async fn get_tasks(
    State(state): State<ApiState>,
) -> Result<Json<ApiResponse<Vec<TaskInfo>>>, StatusCode> {
    // Use Tauri command to get tasks
    match state.app_handle.emit("api:get_tasks", ()) {
        Ok(_) => {
            // In real implementation, we'd wait for response
            Ok(Json(ApiResponse {
                success: true,
                data: Some(vec![]),
                error: None,
            }))
        }
        Err(e) => {
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }))
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    pub description: Option<String>,
    pub created_at: i64,
}

// Helper functions
async fn count_notes(workspace: &str) -> usize {
    // Count .md files in workspace
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(workspace) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if ext == "md" {
                    count += 1;
                }
            }
        }
    }
    count
}

async fn check_has_feature(workspace: &str, feature: &str) -> bool {
    let feature_path = std::path::Path::new(workspace).join(feature);
    feature_path.exists()
}

async fn get_all_notes(workspace: &str) -> Vec<NoteInfo> {
    let mut notes = Vec::new();

    if let Ok(entries) = std::fs::read_dir(workspace) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    let metadata = std::fs::metadata(&path).ok();
                    notes.push(NoteInfo {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        created: metadata.as_ref().and_then(|m| {
                            m.created().ok().and_then(|t| {
                                t.duration_since(std::time::UNIX_EPOCH).ok()
                                    .map(|d| d.as_secs() as i64)
                            })
                        }),
                        modified: metadata.as_ref().and_then(|m| {
                            m.modified().ok().and_then(|t| {
                                t.duration_since(std::time::UNIX_EPOCH).ok()
                                    .map(|d| d.as_secs() as i64)
                            })
                        }),
                        tags: vec![], // TODO: Extract from frontmatter
                        links: vec![], // TODO: Extract wiki links
                    });
                }
            }
        }
    }

    notes
}

// Get all available workspaces
pub async fn get_all_workspaces(
    State(state): State<ApiState>,
) -> Result<Json<ApiResponse<Vec<WorkspaceListItem>>>, StatusCode> {
    let store = StoreBuilder::new(&state.app_handle, PathBuf::from(".settings.dat"))
        .build()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = store.reload();

    let mut workspaces = Vec::new();

    // Note: Currently workspace paths are hashed in session_state keys,
    // so we can't easily extract all workspaces. We rely on last_workspace_path instead.

    // Get last workspace path
    if let Some(last_ws_value) = store.get("last_workspace_path") {
        if let Some(path) = last_ws_value.as_str() {
            let name = std::path::Path::new(path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let note_count = count_notes(path).await;

            workspaces.push(WorkspaceListItem {
                path: path.to_string(),
                name,
                last_accessed: Some(chrono::Utc::now().timestamp()),
                note_count: Some(note_count),
            });
        }
    }

    Ok(Json(ApiResponse {
        success: true,
        data: Some(workspaces),
        error: None,
    }))
}

// Create the API router
pub fn create_api_router(app_handle: tauri::AppHandle) -> Router {
    let state = ApiState {
        app_handle,
        current_workspace: Arc::new(RwLock::new(None)),
    };

    Router::new()
        .route("/api/workspace", get(get_workspace))
        .route("/api/workspaces/all", get(get_all_workspaces))
        .route("/api/notes", get(list_notes))
        .route("/api/tasks", get(get_tasks))
        .route("/api/health", get(|| async { "OK" }))
        .with_state(state)
}

// Start the API server
pub async fn start_api_server(app_handle: tauri::AppHandle) {
    let router = create_api_router(app_handle.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3333")
        .await
        .unwrap();

    println!("[API Server] Running on http://127.0.0.1:3333");

    axum::serve(listener, router)
        .await
        .unwrap();
}

// Update workspace when it changes
pub async fn update_workspace(app_handle: &tauri::AppHandle, workspace: Option<String>) {
    // This would be called when workspace changes
    // For now, we'll store it in app state
    if let Some(state) = app_handle.try_state::<ApiState>() {
        let mut current = state.current_workspace.write().await;
        *current = workspace.clone();

        if let Some(ws) = workspace {
            println!("[API Server] ✅ Workspace updated: {}", ws);
        } else {
            println!("[API Server] ⚠️ Workspace cleared");
        }
    }
}

// Tauri command to update workspace from frontend
#[tauri::command]
pub async fn api_set_workspace(
    app_handle: tauri::AppHandle,
    workspace: String,
) -> Result<(), String> {
    update_workspace(&app_handle, Some(workspace)).await;
    Ok(())
}

// Tauri command to clear workspace
#[tauri::command]
pub async fn api_clear_workspace(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    update_workspace(&app_handle, None).await;
    Ok(())
}