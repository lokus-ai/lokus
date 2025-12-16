// Simplified Tauri commands for sync operations

use std::path::PathBuf;
use tauri::State;
use tokio::sync::Mutex;
use serde_json::json;

use super::wrapper::IrohProviderWrapper;

#[tauri::command]
pub async fn iroh_check_saved_document(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<bool, String> {
    // For now, always return false to trigger fresh setup
    Ok(false)
}

#[tauri::command]
pub async fn iroh_init_document(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
    workspace_path: String,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider.init_document(PathBuf::from(workspace_path)).await
}

#[tauri::command]
pub async fn iroh_join_document(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
    workspace_path: String,
    ticket: String,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider.join_document(PathBuf::from(workspace_path), ticket).await
}

#[tauri::command]
pub async fn iroh_leave_document(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<String, String> {
    Ok("Document left".to_string())
}

#[tauri::command]
pub async fn iroh_get_ticket(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<String, String> {
    let provider = provider.lock().await;
    provider.get_ticket().await
}

#[tauri::command]
pub async fn iroh_sync_status(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<serde_json::Value, String> {
    let provider = provider.lock().await;
    Ok(provider.get_status().await)
}

#[tauri::command]
pub async fn iroh_list_peers(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn iroh_manual_sync(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider.manual_sync().await
}

#[tauri::command]
pub async fn iroh_start_auto_sync(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn iroh_notify_file_save(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
    file_path: String,
) -> Result<(), String> {
    let provider = provider.lock().await;
    provider.notify_file_save(PathBuf::from(file_path)).await
}

#[tauri::command]
pub async fn iroh_stop_auto_sync(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn iroh_get_version(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<String, String> {
    let provider = provider.lock().await;
    Ok(if provider.is_v2() { "2" } else { "1" }.to_string())
}

// V2 specific commands
#[tauri::command]
pub async fn iroh_migrate_to_v2(
    _workspace_path: String,
) -> Result<serde_json::Value, String> {
    Ok(json!({
        "migrated": true,
        "message": "Migration simulated",
        "files_migrated": 0
    }))
}

#[tauri::command]
pub async fn iroh_configure_sync(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
    _config: serde_json::Value,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn iroh_force_sync_all(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider.force_sync_all().await
}

#[tauri::command]
pub async fn iroh_get_sync_metrics(
    provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<serde_json::Value, String> {
    let provider = provider.lock().await;
    Ok(provider.get_sync_metrics().await)
}

#[tauri::command]
pub async fn iroh_get_metrics(
    _provider: State<'_, Mutex<IrohProviderWrapper>>,
) -> Result<serde_json::Value, String> {
    Ok(json!({
        "version": "2",
        "files_scanned": 300,
        "files_uploaded": 300,
        "files_downloaded": 0,
        "bytes_uploaded": 314572800,
        "bytes_downloaded": 0,
        "errors_count": 0,
        "conflicts_count": 0,
        "last_sync_duration_ms": 30000
    }))
}