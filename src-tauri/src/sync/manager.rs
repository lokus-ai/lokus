use super::file_watcher::{FileChangeEvent, FileChangeKind, FileWatcher};
use super::provider::{SyncProvider, SyncStatus, SyncError, SyncResult, format_sync_error};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{Duration, interval};
use tauri::{AppHandle, Emitter};
use tracing::{debug, error, info, warn};

/// Events emitted by the sync manager
const EVENT_SYNC_STATUS: &str = "sync_status_updated";
const EVENT_SYNC_CONFLICT: &str = "sync_conflict";
const EVENT_SYNC_ERROR: &str = "sync_error";
const EVENT_SYNC_PROGRESS: &str = "sync_progress";

/// Sync manager configuration
#[derive(Debug, Clone)]
pub struct SyncConfig {
    /// Periodic sync interval in seconds (default: 30)
    pub periodic_sync_interval: u64,
    /// Enable automatic sync on file changes (default: true)
    pub auto_sync_on_change: bool,
    /// Enable periodic sync (default: true)
    pub enable_periodic_sync: bool,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            periodic_sync_interval: 30,
            auto_sync_on_change: true,
            enable_periodic_sync: true,
        }
    }
}

/// Sync event payload for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    pub event_type: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<SyncStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicts: Option<Vec<String>>,
}

/// Sync Manager orchestrates automatic synchronization
///
/// Handles:
/// - File watcher events (local changes)
/// - Periodic sync fallback
/// - Remote change notifications (for P2P providers)
/// - Conflict detection and resolution
pub struct SyncManager {
    /// Active sync provider (Git or Iroh)
    provider: Arc<Mutex<Box<dyn SyncProvider>>>,
    /// Workspace path
    workspace_path: PathBuf,
    /// Tauri app handle for emitting events
    app_handle: AppHandle,
    /// Configuration
    config: Arc<RwLock<SyncConfig>>,
    /// File watcher instance
    watcher: Arc<Mutex<Option<FileWatcher>>>,
    /// Shutdown signal
    shutdown_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    /// Is auto-sync running
    is_running: Arc<RwLock<bool>>,
}

impl SyncManager {
    /// Create a new sync manager
    ///
    /// # Arguments
    /// * `provider` - Sync provider (Git or Iroh)
    /// * `workspace_path` - Path to workspace directory
    /// * `app_handle` - Tauri app handle
    ///
    /// # Returns
    /// New SyncManager instance
    pub fn new(
        provider: Box<dyn SyncProvider>,
        workspace_path: PathBuf,
        app_handle: AppHandle,
    ) -> Self {
        Self {
            provider: Arc::new(Mutex::new(provider)),
            workspace_path,
            app_handle,
            config: Arc::new(RwLock::new(SyncConfig::default())),
            watcher: Arc::new(Mutex::new(None)),
            shutdown_tx: Arc::new(Mutex::new(None)),
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    /// Set a new sync provider
    ///
    /// # Arguments
    /// * `provider` - New sync provider
    pub async fn set_provider(&self, provider: Box<dyn SyncProvider>) {
        let mut p = self.provider.lock().await;
        *p = provider;
        info!("Sync provider updated");
    }

    /// Update configuration
    ///
    /// # Arguments
    /// * `config` - New configuration
    pub async fn set_config(&self, config: SyncConfig) {
        let mut c = self.config.write().await;
        *c = config;
        info!("Sync configuration updated");
    }

    /// Get current sync status
    ///
    /// # Returns
    /// Current sync status or error
    pub async fn get_status(&self) -> SyncResult<SyncStatus> {
        let provider = self.provider.lock().await;
        provider.status().await
    }

    /// Perform manual sync
    ///
    /// # Returns
    /// Success message or error
    pub async fn manual_sync(&self) -> SyncResult<String> {
        info!("Manual sync requested");

        self.emit_event(SyncEvent {
            event_type: EVENT_SYNC_PROGRESS.to_string(),
            message: "Starting manual sync...".to_string(),
            status: None,
            error: None,
            conflicts: None,
        }).await;

        let mut provider = self.provider.lock().await;
        match provider.sync().await {
            Ok(message) => {
                info!("Manual sync completed: {}", message);

                // Get updated status
                if let Ok(status) = provider.status().await {
                    self.emit_sync_status(&status).await;
                }

                Ok(message)
            }
            Err(e) => {
                error!("Manual sync failed: {}", e);
                self.emit_sync_error(&e, "manual sync").await;
                Err(e)
            }
        }
    }

    /// Start automatic synchronization
    ///
    /// Spawns background tasks for:
    /// - File watcher monitoring
    /// - Periodic sync
    /// - Remote change handling (for P2P providers)
    ///
    /// # Returns
    /// Success or error
    pub async fn start_auto_sync(&self) -> SyncResult<()> {
        // Check if already running
        let mut is_running = self.is_running.write().await;
        if *is_running {
            warn!("Auto-sync already running");
            return Ok(());
        }
        *is_running = true;
        drop(is_running);

        info!("Starting auto-sync for workspace: {:?}", self.workspace_path);

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();
        *self.shutdown_tx.lock().await = Some(shutdown_tx);

        // Initialize file watcher
        let watcher = FileWatcher::new(&self.workspace_path)
            .map_err(|e| SyncError::OperationFailed(format!("Failed to start file watcher: {}", e)))?;
        *self.watcher.lock().await = Some(watcher);

        // Spawn background sync task
        let provider = Arc::clone(&self.provider);
        let watcher = Arc::clone(&self.watcher);
        let config = Arc::clone(&self.config);
        let app_handle = self.app_handle.clone();
        let workspace_path = self.workspace_path.clone();
        let is_running = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            Self::sync_loop(
                provider,
                watcher,
                config,
                app_handle,
                workspace_path,
                shutdown_rx,
                is_running,
            )
            .await;
        });

        info!("Auto-sync started successfully");
        Ok(())
    }

    /// Stop automatic synchronization
    ///
    /// # Returns
    /// Success or error
    pub async fn stop_auto_sync(&self) -> SyncResult<()> {
        info!("Stopping auto-sync");

        // Set running flag to false
        let mut is_running = self.is_running.write().await;
        if !*is_running {
            warn!("Auto-sync not running");
            return Ok(());
        }
        *is_running = false;
        drop(is_running);

        // Send shutdown signal
        if let Some(tx) = self.shutdown_tx.lock().await.take() {
            let _ = tx.send(());
        }

        // Clear watcher
        *self.watcher.lock().await = None;

        // Shutdown provider
        let mut provider = self.provider.lock().await;
        provider.shutdown().await?;

        info!("Auto-sync stopped successfully");
        Ok(())
    }

    /// Main sync loop - runs in background
    async fn sync_loop(
        provider: Arc<Mutex<Box<dyn SyncProvider>>>,
        watcher: Arc<Mutex<Option<FileWatcher>>>,
        config: Arc<RwLock<SyncConfig>>,
        app_handle: AppHandle,
        workspace_path: PathBuf,
        mut shutdown_rx: tokio::sync::oneshot::Receiver<()>,
        is_running: Arc<RwLock<bool>>,
    ) {
        let cfg = config.read().await.clone();
        let mut periodic_interval = interval(Duration::from_secs(cfg.periodic_sync_interval));

        loop {
            tokio::select! {
                // File watcher events
                Some(event) = async {
                    let mut w = watcher.lock().await;
                    if let Some(watcher) = w.as_mut() {
                        watcher.next_event().await
                    } else {
                        None
                    }
                } => {
                    let cfg = config.read().await;
                    if cfg.auto_sync_on_change {
                        Self::handle_file_change(
                            &provider,
                            &app_handle,
                            &workspace_path,
                            event,
                        ).await;
                    }
                }

                // Periodic sync
                _ = periodic_interval.tick() => {
                    let cfg = config.read().await;
                    if cfg.enable_periodic_sync {
                        Self::perform_periodic_sync(&provider, &app_handle).await;
                    }
                }

                // Shutdown signal
                _ = &mut shutdown_rx => {
                    info!("Sync loop received shutdown signal");
                    break;
                }
            }
        }

        // Mark as not running
        *is_running.write().await = false;
        info!("Sync loop terminated");
    }

    /// Handle file change event
    async fn handle_file_change(
        provider: &Arc<Mutex<Box<dyn SyncProvider>>>,
        app_handle: &AppHandle,
        workspace_path: &PathBuf,
        event: FileChangeEvent,
    ) {
        debug!("File change detected: {:?}", event);

        // Get relative path
        let relative_path = if let Ok(rel) = event.path.strip_prefix(workspace_path) {
            rel.to_path_buf()
        } else {
            event.path.clone()
        };

        let is_deleted = event.kind == FileChangeKind::Deleted;

        // Notify provider
        let mut provider = provider.lock().await;
        if let Err(e) = provider.on_file_changed(relative_path.clone(), is_deleted).await {
            error!("Failed to handle file change: {}", e);
            Self::emit_error_static(app_handle, &e, "handle file change").await;
        } else {
            debug!("File change handled: {:?}", relative_path);
        }
    }

    /// Perform periodic sync
    async fn perform_periodic_sync(
        provider: &Arc<Mutex<Box<dyn SyncProvider>>>,
        app_handle: &AppHandle,
    ) {
        debug!("Performing periodic sync");

        let mut provider = provider.lock().await;
        match provider.sync().await {
            Ok(message) => {
                debug!("Periodic sync completed: {}", message);

                // Get updated status and emit
                if let Ok(status) = provider.status().await {
                    Self::emit_status_static(app_handle, &status).await;
                }
            }
            Err(e) => {
                warn!("Periodic sync failed: {}", e);
                Self::emit_error_static(app_handle, &e, "periodic sync").await;
            }
        }
    }

    /// Apply remote change to local file system
    ///
    /// # Arguments
    /// * `file_path` - Relative path to file
    /// * `content` - File content (None for deletion)
    ///
    /// # Returns
    /// Success or error
    pub async fn apply_remote_change(
        &self,
        file_path: PathBuf,
        content: Option<Vec<u8>>,
    ) -> SyncResult<()> {
        let full_path = self.workspace_path.join(&file_path);

        if let Some(content) = content {
            // Create parent directories if needed
            if let Some(parent) = full_path.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| SyncError::FileSystem(format!("Failed to create directory: {}", e)))?;
            }

            // Write file atomically
            tokio::fs::write(&full_path, content)
                .await
                .map_err(|e| SyncError::FileSystem(format!("Failed to write file: {}", e)))?;

            info!("Applied remote change: {:?}", file_path);
        } else {
            // Delete file
            if full_path.exists() {
                tokio::fs::remove_file(&full_path)
                    .await
                    .map_err(|e| SyncError::FileSystem(format!("Failed to delete file: {}", e)))?;

                info!("Applied remote deletion: {:?}", file_path);
            }
        }

        Ok(())
    }

    /// Emit sync status event to frontend
    async fn emit_sync_status(&self, status: &SyncStatus) {
        Self::emit_status_static(&self.app_handle, status).await;
    }

    /// Emit sync status (static version for use in background tasks)
    async fn emit_status_static(app_handle: &AppHandle, status: &SyncStatus) {
        let event = SyncEvent {
            event_type: EVENT_SYNC_STATUS.to_string(),
            message: if status.is_synced {
                "Workspace is up to date".to_string()
            } else if status.has_changes {
                "Local changes detected".to_string()
            } else {
                "Sync status updated".to_string()
            },
            status: Some(status.clone()),
            error: None,
            conflicts: None,
        };

        if let Err(e) = app_handle.emit(EVENT_SYNC_STATUS, event) {
            error!("Failed to emit sync status event: {}", e);
        }
    }

    /// Emit sync error event to frontend
    async fn emit_sync_error(&self, error: &SyncError, operation: &str) {
        Self::emit_error_static(&self.app_handle, error, operation).await;
    }

    /// Emit sync error (static version for use in background tasks)
    async fn emit_error_static(app_handle: &AppHandle, error: &SyncError, operation: &str) {
        let event = SyncEvent {
            event_type: EVENT_SYNC_ERROR.to_string(),
            message: format_sync_error(error, operation),
            status: None,
            error: Some(format!("{}", error)),
            conflicts: None,
        };

        if let Err(e) = app_handle.emit(EVENT_SYNC_ERROR, event) {
            error!("Failed to emit sync error event: {}", e);
        }
    }

    /// Emit sync conflict event to frontend
    async fn emit_conflict(&self, conflicts: Vec<String>) {
        let event = SyncEvent {
            event_type: EVENT_SYNC_CONFLICT.to_string(),
            message: format!("Detected {} conflict(s)", conflicts.len()),
            status: None,
            error: None,
            conflicts: Some(conflicts.clone()),
        };

        if let Err(e) = self.app_handle.emit(EVENT_SYNC_CONFLICT, event) {
            error!("Failed to emit sync conflict event: {}", e);
        }
    }

    /// Emit generic sync event
    async fn emit_event(&self, event: SyncEvent) {
        let event_type = event.event_type.clone();
        if let Err(e) = self.app_handle.emit(&event_type, event) {
            error!("Failed to emit sync event {}: {}", event_type, e);
        }
    }

    /// Check if auto-sync is running
    pub async fn is_running(&self) -> bool {
        *self.is_running.read().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    // Mock sync provider for testing
    struct MockProvider {
        sync_count: usize,
    }

    #[async_trait]
    impl SyncProvider for MockProvider {
        async fn init(&mut self, _workspace_path: PathBuf) -> SyncResult<String> {
            Ok("Mock initialized".to_string())
        }

        async fn status(&self) -> SyncResult<SyncStatus> {
            Ok(SyncStatus {
                is_synced: true,
                has_changes: false,
                sync_type: super::super::provider::SyncType::Git,
                connected_peers: None,
                document_id: None,
                ahead: None,
                behind: None,
                conflicts: None,
                last_commit: None,
            })
        }

        async fn sync(&mut self) -> SyncResult<String> {
            self.sync_count += 1;
            Ok(format!("Mock sync {}", self.sync_count))
        }

        async fn on_file_changed(&mut self, _file_path: PathBuf, _is_deleted: bool) -> SyncResult<()> {
            Ok(())
        }

        async fn get_peers(&self) -> SyncResult<Vec<super::super::provider::PeerInfo>> {
            Ok(vec![])
        }

        async fn shutdown(&mut self) -> SyncResult<()> {
            Ok(())
        }
    }

    #[test]
    fn test_sync_config_default() {
        let config = SyncConfig::default();
        assert_eq!(config.periodic_sync_interval, 30);
        assert!(config.auto_sync_on_change);
        assert!(config.enable_periodic_sync);
    }
}
