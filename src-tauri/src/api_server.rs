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
use tokio::sync::{RwLock, Notify};
use tokio::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreBuilder;
use thiserror::Error;

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

// API Server Configuration for startup
pub struct ApiServerConfig {
    pub state_ready: Arc<Notify>,
    pub max_retries: u32,
    pub base_delay_ms: u64,
}

// API Server Error Types
#[derive(Debug, Error)]
pub enum ApiServerError {
    #[error("ApiState not available - may not be managed yet")]
    StateNotAvailable,

    #[error("No ports available in range 3333-3336")]
    NoPortsAvailable,

    #[error("Failed to bind listener: {0}")]
    BindError(#[from] std::io::Error),
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
pub fn create_api_router(state: ApiState) -> Router {
    Router::new()
        .route("/api/workspace", get(get_workspace))
        .route("/api/workspaces/all", get(get_all_workspaces))
        .route("/api/notes", get(list_notes))
        .route("/api/tasks", get(get_tasks))
        .route("/api/health", get(|| async { "OK" }))
        .with_state(state)
}

// Start the API server with retry logic and port fallback
#[tracing::instrument(skip(app_handle, config))]
pub async fn start_api_server(
    app_handle: tauri::AppHandle,
    config: ApiServerConfig,
) -> Result<u16, ApiServerError> {
    // Wait for state to be ready (prevents race condition)
    tracing::info!("Waiting for ApiState to be ready...");
    config.state_ready.notified().await;
    tracing::debug!("ApiState is ready, proceeding with server start");

    // Retry loop with exponential backoff
    let mut attempt = 0;
    let mut delay_ms = config.base_delay_ms;

    loop {
        attempt += 1;
        tracing::info!(attempt, "Attempting to start API server");

        match try_start_server(&app_handle).await {
            Ok(port) => {
                tracing::info!(port, "API server started successfully");
                return Ok(port);
            }
            Err(e) if attempt < config.max_retries => {
                tracing::warn!(
                    error = %e,
                    attempt,
                    retry_in_ms = delay_ms,
                    "API server start failed, retrying"
                );
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                delay_ms *= 2; // Exponential backoff
            }
            Err(e) => {
                tracing::error!(error = %e, "API server failed after all retries");
                return Err(e);
            }
        }
    }
}

// Try to start the server on available port
async fn try_start_server(app_handle: &tauri::AppHandle) -> Result<u16, ApiServerError> {
    // Try to get state
    let state = app_handle
        .try_state::<ApiState>()
        .ok_or(ApiServerError::StateNotAvailable)?
        .inner()
        .clone();

    let router = create_api_router(state);

    // Try ports 3333, 3334, 3335, 3336
    for port in 3333..=3336 {
        tracing::debug!(port, "Attempting to bind port");

        match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            Ok(listener) => {
                tracing::info!(port, "Successfully bound to port");

                // Spawn server in background
                tokio::spawn(async move {
                    if let Err(e) = axum::serve(listener, router).await {
                        tracing::error!(error = %e, "Axum server error");
                    }
                });

                return Ok(port);
            }
            Err(e) => {
                tracing::warn!(port, error = %e, "Port unavailable, trying next");
                continue;
            }
        }
    }

    Err(ApiServerError::NoPortsAvailable)
}

// Update workspace when it changes
pub async fn update_workspace(app_handle: &tauri::AppHandle, workspace: Option<String>) {
    // This would be called when workspace changes
    // For now, we'll store it in app state
    if let Some(state) = app_handle.try_state::<ApiState>() {
        let mut current = state.current_workspace.write().await;
        *current = workspace.clone();

        if let Some(_ws) = workspace {
        } else {
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

// Tauri command to get current workspace
#[tauri::command]
pub async fn api_get_current_workspace(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    if let Some(state) = app_handle.try_state::<ApiState>() {
        let current = state.current_workspace.read().await;
        Ok(current.clone())
    } else {
        Ok(None)
    }
}