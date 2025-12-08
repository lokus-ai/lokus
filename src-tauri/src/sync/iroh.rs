// Iroh Sync Provider - Peer-to-peer synchronization using Iroh
// Provides decentralized sync without central servers

use super::provider::{PeerInfo, SyncError, SyncProvider, SyncResult, SyncStatus, SyncType};
use super::file_watcher::{FileWatcher, FileChangeKind};
use async_trait::async_trait;
use blake3::Hasher;
use iroh::client::Doc;
use iroh::net::key::SecretKey;
use iroh::node::{Builder, Node};
use iroh::node::MemNode;
use iroh_blobs::BlobFormat;
use iroh_docs::AuthorId;
use iroh::client::docs::ShareMode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use tokio::io::AsyncReadExt;

/// Metadata for a file stored in iroh-docs
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileMetadata {
    /// BLAKE3 hash of the file content
    hash: String,
    /// Last modified timestamp (Unix epoch)
    modified: u64,
    /// File size in bytes
    size: u64,
    /// Whether the file is deleted
    deleted: bool,
}

/// Sync progress event payload
#[derive(Debug, Clone, Serialize)]
struct SyncProgressEvent {
    status: String,
    file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_deleted: Option<bool>,
    timestamp: String,
}

/// Sync status update event payload
#[derive(Debug, Clone, Serialize)]
struct SyncStatusEvent {
    status: String,
    files_uploaded: usize,
    files_downloaded: usize,
    timestamp: String,
}

/// Sync error event payload
#[derive(Debug, Clone, Serialize)]
struct SyncErrorEvent {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    file: Option<String>,
    timestamp: String,
}

/// Iroh-based sync provider
pub struct IrohSyncProvider {
    /// Iroh node instance
    node: Option<MemNode>,
    /// Current document (workspace)
    doc: Option<Doc>,
    /// Author identity for this node
    author_id: Option<AuthorId>,
    /// Workspace directory path
    workspace_path: Option<PathBuf>,
    /// Local file metadata cache
    file_cache: HashMap<PathBuf, FileMetadata>,
    /// File watcher for automatic sync
    file_watcher: Option<FileWatcher>,
    /// Flag to indicate if auto-sync is running
    sync_running: Arc<AtomicBool>,
    /// App handle for event emission
    app_handle: Option<AppHandle>,
}

impl IrohSyncProvider {
    /// Create a new Iroh sync provider
    pub fn new() -> Self {
        Self {
            node: None,
            doc: None,
            author_id: None,
            workspace_path: None,
            file_cache: HashMap::new(),
            file_watcher: None,
            sync_running: Arc::new(AtomicBool::new(false)),
            app_handle: None,
        }
    }

    /// Create a new document and return its ticket
    pub async fn create_document(&mut self) -> SyncResult<String> {
        let node = self.node.as_ref().ok_or(SyncError::OperationFailed(
            "Node not initialized".to_string(),
        ))?;
        let _author = self.author_id.ok_or(SyncError::OperationFailed(
            "Author not initialized".to_string(),
        ))?;

        // Create new document
        let doc = node
            .docs()
            .create()
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to create document: {}", e)))?;

        // Generate sharing ticket
        let ticket = doc
            .share(ShareMode::Write, Default::default())
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to create ticket: {}", e)))?;

        self.doc = Some(doc);

        Ok(ticket.to_string())
    }

    /// Join an existing document using a ticket
    pub async fn join_document(&mut self, ticket: &str) -> SyncResult<String> {
        let node = self.node.as_ref().ok_or(SyncError::OperationFailed(
            "Node not initialized".to_string(),
        ))?;

        // Parse ticket
        let ticket = ticket
            .parse()
            .map_err(|e| SyncError::InvalidTicket(format!("{}", e)))?;

        // Import document (returns Doc directly in 0.28)
        let doc = node
            .docs()
            .import(ticket)
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to join document: {}", e)))?;

        let doc_id = doc.id();
        self.doc = Some(doc);

        Ok(format!("Joined document: {}", doc_id))
    }

    /// Get the current document's sharing ticket
    pub async fn get_ticket(&self) -> SyncResult<String> {
        let doc = self.doc.as_ref().ok_or(SyncError::DocumentNotFound)?;

        let ticket = doc
            .share(ShareMode::Write, Default::default())
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to get ticket: {}", e)))?;

        Ok(ticket.to_string())
    }

    /// List all peers connected to the document
    pub async fn list_peers(&self) -> SyncResult<Vec<PeerInfo>> {
        let node = self.node.as_ref().ok_or(SyncError::OperationFailed(
            "Node not initialized".to_string(),
        ))?;
        let _doc = self.doc.as_ref().ok_or(SyncError::DocumentNotFound)?;

        // TODO: Implement peer discovery for Iroh 0.28
        // In Iroh 0.28, the peer discovery API is not directly exposed in a simple way.
        // The node's connection information and document subscribers are managed internally
        // by the Iroh protocol. Peer sync happens automatically in the background.
        //
        // Possible approaches for future implementation:
        // 1. Use node.connections() if available in the specific Iroh version
        // 2. Query the gossip protocol for active participants
        // 3. Monitor sync events to track which peers are actively syncing
        //
        // For now, we return an empty list. The sync functionality itself still works
        // - peers will automatically discover and sync with each other when they share
        // the same document ticket. This is just a visibility/monitoring limitation.

        let peers = Vec::new();

        // Note: Even though we can't list peers in this version, document synchronization
        // still works automatically via Iroh's gossip protocol. When another device joins
        // using the same document ticket, sync will happen in the background.

        Ok(peers)
    }

    /// Calculate BLAKE3 hash of a file
    async fn hash_file(path: &Path) -> SyncResult<String> {
        let mut file = fs::File::open(path).await?;
        let mut hasher = Hasher::new();
        let mut buffer = vec![0; 8192];

        loop {
            let n = file.read(&mut buffer).await?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }

        Ok(hasher.finalize().to_hex().to_string())
    }

    /// Get file metadata
    async fn get_file_metadata(path: &Path) -> SyncResult<FileMetadata> {
        let metadata = fs::metadata(path).await?;
        let hash = Self::hash_file(path).await?;
        let modified = metadata
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| SyncError::FileSystem(format!("Invalid modified time: {}", e)))?
            .as_secs();

        Ok(FileMetadata {
            hash,
            modified,
            size: metadata.len(),
            deleted: false,
        })
    }

    /// Sync a file to iroh (upload)
    async fn sync_file_to_iroh(&mut self, file_path: &Path) -> SyncResult<()> {
        let doc = self.doc.as_mut().ok_or(SyncError::DocumentNotFound)?;
        let author = self.author_id.ok_or(SyncError::OperationFailed(
            "Author not initialized".to_string(),
        ))?;
        let workspace = self
            .workspace_path
            .as_ref()
            .ok_or(SyncError::OperationFailed(
                "Workspace not initialized".to_string(),
            ))?;

        let full_path = workspace.join(file_path);
        let metadata = Self::get_file_metadata(&full_path).await?;

        // Store metadata in iroh-docs
        let key = format!("file:{}", file_path.to_string_lossy());
        let value = serde_json::to_vec(&metadata)?;

        doc.set_bytes(author, key.as_bytes().to_vec(), value)
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to set metadata: {}", e)))?;

        // Store file content in iroh-blobs
        let node = self.node.as_ref().ok_or(SyncError::OperationFailed(
            "Node not initialized".to_string(),
        ))?;

        // Import file into blobs
        // In iroh 0.28, add_from_path params: (path, in_place, tag, wrap)
        use iroh_blobs::util::SetTagOption;
        use iroh::client::blobs::WrapOption;
        let import = node
            .blobs()
            .add_from_path(full_path, false, SetTagOption::Auto, WrapOption::NoWrap)
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to import blob: {}", e)))?;

        // Wait for import to complete
        import
            .finish()
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to finish import: {}", e)))?;

        // Update cache
        self.file_cache.insert(file_path.to_path_buf(), metadata);

        Ok(())
    }

    /// Sync a file from iroh (download)
    async fn sync_file_from_iroh(
        &mut self,
        file_path: &Path,
        metadata: &FileMetadata,
    ) -> SyncResult<()> {
        let workspace = self
            .workspace_path
            .as_ref()
            .ok_or(SyncError::OperationFailed(
                "Workspace not initialized".to_string(),
            ))?;
        let node = self.node.as_ref().ok_or(SyncError::OperationFailed(
            "Node not initialized".to_string(),
        ))?;

        let full_path = workspace.join(file_path);

        // Check if we need to update the file
        if full_path.exists() {
            let local_metadata = Self::get_file_metadata(&full_path).await?;
            if local_metadata.hash == metadata.hash {
                // File is up to date
                return Ok(());
            }
        }

        // Create parent directory if needed
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        // Parse hash
        let hash_bytes =
            hex::decode(&metadata.hash).map_err(|e| SyncError::Iroh(format!("Invalid hash: {}", e)))?;
        let hash: [u8; 32] = hash_bytes
            .try_into()
            .map_err(|_| SyncError::Iroh("Hash must be 32 bytes".to_string()))?;

        // Download blob
        let blob = node
            .blobs()
            .read_to_bytes(hash.into())
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to read blob: {}", e)))?;

        // Write to file
        fs::write(&full_path, blob).await?;

        // Update cache
        self.file_cache.insert(file_path.to_path_buf(), metadata.clone());

        Ok(())
    }

    /// Start automatic synchronization
    ///
    /// # Arguments
    /// * `app_handle` - Tauri app handle for event emission
    ///
    /// # Returns
    /// Success message or error
    pub async fn start_auto_sync(&mut self, app_handle: AppHandle) -> SyncResult<String> {
        // Check if already running
        if self.sync_running.load(Ordering::SeqCst) {
            return Ok("Auto-sync is already running".to_string());
        }

        // Check prerequisites
        if self.doc.is_none() {
            return Err(SyncError::DocumentNotFound);
        }

        let workspace_path = self
            .workspace_path
            .as_ref()
            .ok_or(SyncError::OperationFailed(
                "Workspace not initialized".to_string(),
            ))?
            .clone();

        // Create file watcher
        let file_watcher = FileWatcher::new(&workspace_path)
            .map_err(|e| SyncError::FileSystem(format!("Failed to create file watcher: {}", e)))?;

        self.file_watcher = Some(file_watcher);
        self.app_handle = Some(app_handle.clone());
        self.sync_running.store(true, Ordering::SeqCst);

        // Spawn file watcher task
        let sync_running = self.sync_running.clone();
        let app_handle_for_task = app_handle.clone();
        let app_handle_clone = app_handle.clone();

        tokio::spawn(async move {
            while sync_running.load(Ordering::SeqCst) {
                let provider_mutex = app_handle_for_task.state::<tokio::sync::Mutex<IrohSyncProvider>>();
                let mut provider = provider_mutex.lock().await;

                if let Some(ref mut watcher) = provider.file_watcher {
                    // Get next event with timeout
                    let event_result = tokio::time::timeout(
                        std::time::Duration::from_secs(1),
                        watcher.next_event()
                    ).await;

                    drop(provider); // Release lock before processing

                    if let Ok(Some(event)) = event_result {
                        // Determine if file was deleted
                        let is_deleted = matches!(event.kind, FileChangeKind::Deleted);

                        // Get relative path
                        let mut provider = provider_mutex.lock().await;
                        if let Some(workspace) = &provider.workspace_path {
                            if let Ok(rel_path) = event.path.strip_prefix(workspace) {
                                let rel_path = rel_path.to_path_buf();

                                // Emit sync_progress event
                                let event = SyncProgressEvent {
                                    status: "syncing".to_string(),
                                    file: rel_path.to_string_lossy().to_string(),
                                    is_deleted: Some(is_deleted),
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                };
                                let _ = app_handle_clone.emit("sync_progress", event);

                                // Process the file change
                                match provider.on_file_changed(rel_path.clone(), is_deleted).await {
                                    Ok(_) => {
                                        let event = SyncProgressEvent {
                                            status: "synced".to_string(),
                                            file: rel_path.to_string_lossy().to_string(),
                                            is_deleted: None,
                                            timestamp: chrono::Utc::now().to_rfc3339(),
                                        };
                                        let _ = app_handle_clone.emit("sync_progress", event);
                                    }
                                    Err(e) => {
                                        let error_event = SyncErrorEvent {
                                            error: format!("Failed to sync file: {}", e),
                                            file: Some(rel_path.to_string_lossy().to_string()),
                                            timestamp: chrono::Utc::now().to_rfc3339(),
                                        };
                                        let _ = app_handle_clone.emit("sync_error", error_event);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    drop(provider);
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
            }
        });

        // Spawn periodic sync task (every 30 seconds)
        let sync_running = self.sync_running.clone();
        let app_handle_for_task2 = app_handle.clone();
        let app_handle_clone2 = app_handle.clone();

        tokio::spawn(async move {
            while sync_running.load(Ordering::SeqCst) {
                tokio::time::sleep(std::time::Duration::from_secs(30)).await;

                if !sync_running.load(Ordering::SeqCst) {
                    break;
                }

                let provider_mutex = app_handle_for_task2.state::<tokio::sync::Mutex<IrohSyncProvider>>();
                let mut provider = provider_mutex.lock().await;
                match provider.scan_and_sync().await {
                    Ok((uploaded, downloaded)) => {
                        let status_event = SyncStatusEvent {
                            status: "synced".to_string(),
                            files_uploaded: uploaded,
                            files_downloaded: downloaded,
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        };
                        let _ = app_handle_clone2.emit("sync_status_updated", status_event);
                    }
                    Err(e) => {
                        let error_event = SyncErrorEvent {
                            error: format!("Periodic sync failed: {}", e),
                            file: None,
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        };
                        let _ = app_handle_clone2.emit("sync_error", error_event);
                    }
                }
            }
        });

        Ok("Auto-sync started successfully".to_string())
    }

    /// Stop automatic synchronization
    ///
    /// # Returns
    /// Success message or error
    pub async fn stop_auto_sync(&mut self) -> SyncResult<String> {
        if !self.sync_running.load(Ordering::SeqCst) {
            return Ok("Auto-sync is not running".to_string());
        }

        // Set flag to false to stop background tasks
        self.sync_running.store(false, Ordering::SeqCst);

        // Drop file watcher to stop watching
        self.file_watcher = None;
        self.app_handle = None;

        Ok("Auto-sync stopped successfully".to_string())
    }

    /// Scan workspace and sync all files
    async fn scan_and_sync(&mut self) -> SyncResult<(usize, usize)> {
        // Clone the workspace path to avoid borrow checker issues
        let workspace = self
            .workspace_path
            .as_ref()
            .ok_or(SyncError::OperationFailed(
                "Workspace not initialized".to_string(),
            ))?
            .clone();

        let mut uploaded = 0;
        let mut downloaded = 0;

        // Get remote file list from document
        let doc = self.doc.as_ref().ok_or(SyncError::DocumentNotFound)?;
        let entries = doc
            .get_many(iroh_docs::store::Query::all())
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to query document: {}", e)))?;

        let mut remote_files: HashMap<PathBuf, FileMetadata> = HashMap::new();

        // Collect remote entries
        use futures::StreamExt;
        let mut entry_stream = entries;
        while let Some(entry) = entry_stream.next().await {
            let entry = entry.map_err(|e| SyncError::Iroh(format!("Failed to read entry: {}", e)))?;
            let key = String::from_utf8_lossy(entry.key()).to_string();

            if let Some(path_str) = key.strip_prefix("file:") {
                let node = self.node.as_ref().unwrap();
                let content = entry
                    .content_bytes(&**node)
                    .await
                    .map_err(|e| SyncError::Iroh(format!("Failed to read content: {}", e)))?;
                let metadata: FileMetadata = serde_json::from_slice(&content)?;

                if !metadata.deleted {
                    remote_files.insert(PathBuf::from(path_str), metadata);
                }
            }
        }

        // Download remote files
        for (path, metadata) in &remote_files {
            self.sync_file_from_iroh(path, metadata).await?;
            downloaded += 1;
        }

        // Upload local files
        let entries = walkdir::WalkDir::new(&workspace)
            .into_iter()
            .filter_entry(|e| {
                // Skip hidden files and directories
                !e.file_name()
                    .to_str()
                    .map(|s| s.starts_with('.'))
                    .unwrap_or(false)
            });

        for entry in entries {
            let entry = entry.map_err(|e| SyncError::FileSystem(e.to_string()))?;
            if entry.file_type().is_file() {
                let path = entry.path();
                let rel_path = path
                    .strip_prefix(&workspace)
                    .map_err(|e| SyncError::FileSystem(e.to_string()))?;

                // Check if file needs to be uploaded
                let needs_upload = if let Some(remote_meta) = remote_files.get(rel_path) {
                    let local_meta = Self::get_file_metadata(path).await?;
                    local_meta.hash != remote_meta.hash
                } else {
                    true
                };

                if needs_upload {
                    self.sync_file_to_iroh(rel_path).await?;
                    uploaded += 1;
                }
            }
        }

        // Emit sync status event if app handle is available
        if let Some(handle) = &self.app_handle {
            let status_event = SyncStatusEvent {
                status: "synced".to_string(),
                files_uploaded: uploaded,
                files_downloaded: downloaded,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            let _ = handle.emit("sync_status_updated", status_event);
        }

        Ok((uploaded, downloaded))
    }
}

impl Default for IrohSyncProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SyncProvider for IrohSyncProvider {
    async fn init(&mut self, workspace_path: PathBuf) -> SyncResult<String> {
        // Create iroh node
        let secret_key = SecretKey::generate();

        // Create in-memory node with the secret key (iroh 0.28 API)
        // Enable docs and blobs storage
        let node = Builder::default()
            .secret_key(secret_key)
            .enable_docs()
            .spawn()
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to create node: {}", e)))?;

        // Create default author
        let author = node
            .authors()
            .create()
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to create author: {}", e)))?;

        self.node = Some(node);
        self.author_id = Some(author);
        self.workspace_path = Some(workspace_path.clone());

        Ok(format!(
            "Iroh node initialized for workspace: {}",
            workspace_path.display()
        ))
    }

    async fn status(&self) -> SyncResult<SyncStatus> {
        let doc = self.doc.as_ref().ok_or(SyncError::DocumentNotFound)?;

        // Count entries in document
        let entries = doc
            .get_many(iroh_docs::store::Query::all())
            .await
            .map_err(|e| SyncError::Iroh(format!("Failed to query document: {}", e)))?;

        use futures::StreamExt;
        let entry_count = entries.count().await;
        let has_changes = entry_count > 0;

        // Get peer count
        let peers = self.list_peers().await?;
        let peer_count = peers.len();

        // Get document ID
        let doc_id = doc.id().to_string();

        Ok(SyncStatus {
            is_synced: !has_changes && peer_count > 0,
            has_changes,
            sync_type: SyncType::Iroh,
            connected_peers: Some(peer_count),
            document_id: Some(doc_id),
            ahead: None,
            behind: None,
            conflicts: None,
            last_commit: None,
        })
    }

    async fn sync(&mut self) -> SyncResult<String> {
        if self.doc.is_none() {
            return Err(SyncError::DocumentNotFound);
        }

        let (uploaded, downloaded) = self.scan_and_sync().await?;

        Ok(format!(
            "Sync complete: {} files uploaded, {} files downloaded",
            uploaded, downloaded
        ))
    }

    async fn on_file_changed(&mut self, file_path: PathBuf, is_deleted: bool) -> SyncResult<()> {
        if is_deleted {
            // Mark file as deleted in metadata
            let doc = self.doc.as_mut().ok_or(SyncError::DocumentNotFound)?;
            let author = self.author_id.ok_or(SyncError::OperationFailed(
                "Author not initialized".to_string(),
            ))?;

            let key = format!("file:{}", file_path.to_string_lossy());
            let metadata = FileMetadata {
                hash: String::new(),
                modified: 0,
                size: 0,
                deleted: true,
            };
            let value = serde_json::to_vec(&metadata)?;

            doc.set_bytes(author, key.as_bytes().to_vec(), value)
                .await
                .map_err(|e| SyncError::Iroh(format!("Failed to mark file as deleted: {}", e)))?;

            // Remove from cache
            self.file_cache.remove(&file_path);
        } else {
            // Upload the changed file
            self.sync_file_to_iroh(&file_path).await?;
        }

        Ok(())
    }

    async fn get_peers(&self) -> SyncResult<Vec<PeerInfo>> {
        self.list_peers().await
    }

    async fn shutdown(&mut self) -> SyncResult<()> {
        if let Some(node) = self.node.take() {
            node.shutdown()
                .await
                .map_err(|e| SyncError::Iroh(format!("Failed to shutdown node: {}", e)))?;
        }

        self.doc = None;
        self.author_id = None;
        self.workspace_path = None;
        self.file_cache.clear();

        Ok(())
    }
}

// Tauri commands for Iroh sync

#[tauri::command]
pub async fn iroh_init(workspace_path: String) -> Result<String, String> {
    let mut provider = IrohSyncProvider::new();
    provider
        .init(PathBuf::from(workspace_path))
        .await
        .map_err(|e| format!("Failed to initialize Iroh: {}", e))
}

#[tauri::command]
pub async fn iroh_init_document(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
    workspace_path: String,
) -> Result<String, String> {
    let mut provider = provider.lock().await;

    // Initialize node if not already initialized
    if provider.node.is_none() {
        provider
            .init(PathBuf::from(&workspace_path))
            .await
            .map_err(|e| format!("Failed to initialize Iroh: {}", e))?;
    }

    // Create document
    provider
        .create_document()
        .await
        .map_err(|e| format!("Failed to create document: {}", e))
}

#[tauri::command]
pub async fn iroh_join_document(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
    ticket: String,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider
        .join_document(&ticket)
        .await
        .map_err(|e| format!("Failed to join document: {}", e))
}

#[tauri::command]
pub async fn iroh_get_ticket(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
) -> Result<String, String> {
    let provider = provider.lock().await;
    provider
        .get_ticket()
        .await
        .map_err(|e| format!("Failed to get ticket: {}", e))
}

#[tauri::command]
pub async fn iroh_sync(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider
        .sync()
        .await
        .map_err(|e| format!("Failed to sync: {}", e))
}

#[tauri::command]
pub async fn iroh_manual_sync(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider
        .sync()
        .await
        .map_err(|e| format!("Failed to sync: {}", e))
}

#[tauri::command]
pub async fn iroh_sync_status(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
) -> Result<SyncStatus, String> {
    let provider = provider.lock().await;
    provider
        .status()
        .await
        .map_err(|e| format!("Failed to get status: {}", e))
}

#[tauri::command]
pub async fn iroh_list_peers(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
    _workspace_path: String,
) -> Result<Vec<PeerInfo>, String> {
    let provider = provider.lock().await;
    provider
        .get_peers()
        .await
        .map_err(|e| format!("Failed to list peers: {}", e))
}

#[tauri::command]
pub async fn iroh_start_auto_sync(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider
        .start_auto_sync(app_handle)
        .await
        .map_err(|e| format!("Failed to start auto-sync: {}", e))
}

#[tauri::command]
pub async fn iroh_stop_auto_sync(
    provider: tauri::State<'_, tokio::sync::Mutex<IrohSyncProvider>>,
) -> Result<String, String> {
    let mut provider = provider.lock().await;
    provider
        .stop_auto_sync()
        .await
        .map_err(|e| format!("Failed to stop auto-sync: {}", e))
}
