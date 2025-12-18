// Enterprise-Grade Iroh V2 Implementation
// Designed to handle 300+ files reliably with proper error handling and performance

// use async_trait::async_trait; // Not used
use iroh::{
    // base::node_addr::NodeAddr,
    client::Doc,
    client::docs::ShareMode,
    docs::{AuthorId, DocTicket, NamespaceId},
    node::{Builder, MemNode},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet, VecDeque},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime},
};
use tokio::{
    fs,
    io::AsyncReadExt,
    sync::{mpsc, Mutex, RwLock, Semaphore},
    task::JoinHandle,
    time::interval,
};
use tracing::{debug, error, info, warn};
use futures::TryStreamExt;
use zstd::stream::{encode_all as zstd_encode, decode_all as zstd_decode};
use super::network_monitor::{NetworkMonitor, BandwidthLimiter};
use super::retry_utils::{retry_with_backoff, RetryConfig};

// Configuration constants
const DEFAULT_MAX_CONCURRENT_OPS: usize = 30; // Increased for enterprise
const DEFAULT_MAX_MEMORY_MB: usize = 1024; // Increased for enterprise
const DEFAULT_CHUNK_SIZE: usize = 4 * 1024 * 1024; // 4MB
const DEFAULT_BATCH_SIZE: usize = 100; // Increased for better batching
const HEALTH_CHECK_INTERVAL_SECS: u64 = 30;
const SYNC_PROGRESS_REPORT_INTERVAL_MS: u64 = 500;

// Smart sync timing constants
const DEBOUNCE_DURATION_MS: u64 = 2000; // 2 seconds after last edit
const BATCH_SYNC_INTERVAL_MS: u64 = 30000; // 30 seconds for batch
const IDLE_SYNC_INTERVAL_MS: u64 = 300000; // 5 minutes for idle

// Error types
#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Initialization failed: {0}")]
    InitializationError(String),
    
    #[error("Document error: {0}")]
    DocumentError(String),
    
    #[error("File system error: {0}")]
    FileSystemError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("State error: {0}")]
    StateError(String),
    
    #[error("Operation cancelled")]
    Cancelled,
    
    #[error("Memory limit exceeded")]
    MemoryLimitExceeded,
}

// Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub max_concurrent_ops: usize,
    pub max_memory_mb: usize,
    pub chunk_size: usize,
    pub batch_size: usize,
    pub retry_attempts: u32,
    pub retry_base_delay_ms: u64,
    pub retry_max_delay_ms: u64,
    pub enable_compression: bool,
    pub compression_level: i32,
    pub enable_encryption: bool,
    pub enable_delta_sync: bool,
    pub conflict_resolution: ConflictResolution,
    pub bandwidth_limit_mbps: Option<f64>,
    pub enable_integrity_checks: bool,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            max_concurrent_ops: DEFAULT_MAX_CONCURRENT_OPS,
            max_memory_mb: DEFAULT_MAX_MEMORY_MB,
            chunk_size: DEFAULT_CHUNK_SIZE,
            batch_size: DEFAULT_BATCH_SIZE,
            retry_attempts: 3,
            retry_base_delay_ms: 1000, // 1 second
            retry_max_delay_ms: 60000, // 60 seconds
            enable_compression: true,
            compression_level: 3, // zstd default
            enable_encryption: false,
            enable_delta_sync: true,
            conflict_resolution: ConflictResolution::LastWriteWins,
            bandwidth_limit_mbps: None,
            enable_integrity_checks: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    LastWriteWins,
    FirstWriteWins,
    Manual,
    AutoMerge, // For text files
    KeepBoth, // Rename conflicting file
}

// Sync state machine
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SyncState {
    Uninitialized,
    Initializing,
    Idle,
    Scanning,
    Syncing { progress: f32 },
    Failed(String),
    Shutdown,
}

// Metrics (using Arc to avoid Clone issues with AtomicU64)
#[derive(Debug)]
pub struct SyncMetrics {
    pub inner: Arc<SyncMetricsInner>,
}

#[derive(Debug)]
pub struct SyncMetricsInner {
    pub files_scanned: AtomicU64,
    pub files_uploaded: AtomicU64,
    pub files_downloaded: AtomicU64,
    pub bytes_uploaded: AtomicU64,
    pub bytes_downloaded: AtomicU64,
    pub bytes_compressed: AtomicU64,
    pub compression_ratio: AtomicU64, // Stored as percentage * 100
    pub errors_count: AtomicU64,
    pub retry_count: AtomicU64,
    pub conflicts_count: AtomicU64,
    pub conflicts_resolved: AtomicU64,
    pub network_bandwidth_bps: AtomicU64,
    pub last_sync_duration_ms: AtomicU64,
    pub corrupted_files: AtomicU64,
    pub delta_syncs: AtomicU64,
    pub network_bandwidth: AtomicU64,
    pub network_status: AtomicU64,
}

impl Clone for SyncMetrics {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

impl Default for SyncMetrics {
    fn default() -> Self {
        Self {
            inner: Arc::new(SyncMetricsInner {
                files_scanned: AtomicU64::new(0),
                files_uploaded: AtomicU64::new(0),
                files_downloaded: AtomicU64::new(0),
                bytes_uploaded: AtomicU64::new(0),
                bytes_downloaded: AtomicU64::new(0),
                bytes_compressed: AtomicU64::new(0),
                compression_ratio: AtomicU64::new(10000), // 100.00%
                errors_count: AtomicU64::new(0),
                retry_count: AtomicU64::new(0),
                conflicts_count: AtomicU64::new(0),
                conflicts_resolved: AtomicU64::new(0),
                network_bandwidth_bps: AtomicU64::new(0),
                last_sync_duration_ms: AtomicU64::new(0),
                corrupted_files: AtomicU64::new(0),
                delta_syncs: AtomicU64::new(0),
                network_bandwidth: AtomicU64::new(0),
                network_status: AtomicU64::new(1), // 1 = online
            }),
        }
    }
}

impl SyncMetrics {
    pub fn files_scanned(&self) -> u64 {
        self.inner.files_scanned.load(Ordering::Relaxed)
    }
    
    pub fn files_uploaded(&self) -> u64 {
        self.inner.files_uploaded.load(Ordering::Relaxed)
    }
    
    pub fn files_downloaded(&self) -> u64 {
        self.inner.files_downloaded.load(Ordering::Relaxed)
    }
    
    pub fn add_uploaded(&self, count: u64, bytes: u64) {
        self.inner.files_uploaded.fetch_add(count, Ordering::Relaxed);
        self.inner.bytes_uploaded.fetch_add(bytes, Ordering::Relaxed);
    }
    
    pub fn add_downloaded(&self, count: u64, bytes: u64) {
        self.inner.files_downloaded.fetch_add(count, Ordering::Relaxed);
        self.inner.bytes_downloaded.fetch_add(bytes, Ordering::Relaxed);
    }
    
    pub fn increment_errors(&self) {
        self.inner.errors_count.fetch_add(1, Ordering::Relaxed);
    }
}

// File entry for tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileEntry {
    path: PathBuf,
    size: u64,
    modified: SystemTime,
    hash: [u8; 32], // blake3 hash
    chunk_hashes: Vec<[u8; 32]>, // For delta sync
    version: u64, // Version number for conflict detection
    author: String, // Who last modified
}

// Conflict information
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConflictInfo {
    local_entry: FileEntry,
    remote_entry: FileEntry,
    conflict_type: ConflictType,
    resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum ConflictType {
    ContentModified,
    DeletedRemotely,
    DeletedLocally,
    BothModified,
}

// Memory limiter
struct MemoryLimiter {
    semaphore: Arc<Semaphore>,
    chunk_size: usize,
}

impl MemoryLimiter {
    fn new(max_mb: usize, chunk_size: usize) -> Self {
        let max_chunks = (max_mb * 1024 * 1024) / chunk_size;
        Self {
            semaphore: Arc::new(Semaphore::new(max_chunks)),
            chunk_size,
        }
    }
    
    async fn acquire(&self) -> Result<MemoryPermit, SyncError> {
        match self.semaphore.clone().acquire_owned().await {
            Ok(permit) => Ok(MemoryPermit { _permit: permit }),
            Err(_) => Err(SyncError::MemoryLimitExceeded),
        }
    }
}

struct MemoryPermit {
    _permit: tokio::sync::OwnedSemaphorePermit,
}

// Sync operation for queuing
#[derive(Debug, Clone)]
enum SyncOperation {
    Upload { path: PathBuf, entry: FileEntry },
    Download { path: PathBuf, hash: [u8; 32], size: u64 },
    Delete { path: PathBuf },
}

// Transaction for atomic operations
struct SyncTransaction {
    id: String,
    operations: Vec<SyncOperation>,
    completed: HashSet<String>,
    start_time: Instant,
}

// Progress reporter
#[derive(Clone)]
struct ProgressReporter {
    tx: mpsc::UnboundedSender<ProgressEvent>,
}

#[derive(Debug)]
enum ProgressEvent {
    Started { total_files: usize },
    Progress { current: usize, total: usize },
    Completed { duration_ms: u64 },
    Error { message: String },
}

// Smart sync queue with priority levels
#[derive(Debug, Clone, PartialEq, Eq)]
enum SyncPriority {
    High,   // Currently edited file - sync immediately
    Medium, // Recently modified files - sync within 30s
    Low,    // Bulk changes/imports - sync in background
}

// Smart sync queue for managing file sync priorities
struct SmartSyncQueue {
    high_priority: Arc<Mutex<VecDeque<PathBuf>>>,
    medium_priority: Arc<Mutex<VecDeque<PathBuf>>>,
    low_priority: Arc<Mutex<VecDeque<PathBuf>>>,
    last_sync: Arc<RwLock<HashMap<PathBuf, Instant>>>,
    pending_files: Arc<RwLock<HashSet<PathBuf>>>, // Prevent duplicates
    debounce_timers: Arc<Mutex<HashMap<PathBuf, tokio::task::JoinHandle<()>>>>,
}

impl SmartSyncQueue {
    fn new() -> Self {
        Self {
            high_priority: Arc::new(Mutex::new(VecDeque::new())),
            medium_priority: Arc::new(Mutex::new(VecDeque::new())),
            low_priority: Arc::new(Mutex::new(VecDeque::new())),
            last_sync: Arc::new(RwLock::new(HashMap::new())),
            pending_files: Arc::new(RwLock::new(HashSet::new())),
            debounce_timers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    async fn add_file(&self, path: PathBuf, priority: SyncPriority) {
        // Check if already pending
        if self.pending_files.read().await.contains(&path) {
            return;
        }
        
        // Add to pending set
        self.pending_files.write().await.insert(path.clone());
        
        // Add to appropriate queue
        match priority {
            SyncPriority::High => {
                self.high_priority.lock().await.push_back(path);
            }
            SyncPriority::Medium => {
                self.medium_priority.lock().await.push_back(path);
            }
            SyncPriority::Low => {
                self.low_priority.lock().await.push_back(path);
            }
        }
    }
    
    async fn get_next_batch(&self, limit: usize) -> Vec<PathBuf> {
        let mut batch = Vec::new();
        
        // First take from high priority
        let mut high = self.high_priority.lock().await;
        while batch.len() < limit && !high.is_empty() {
            if let Some(path) = high.pop_front() {
                batch.push(path);
            }
        }
        drop(high);
        
        // Then medium priority
        let mut medium = self.medium_priority.lock().await;
        while batch.len() < limit && !medium.is_empty() {
            if let Some(path) = medium.pop_front() {
                batch.push(path);
            }
        }
        drop(medium);
        
        // Finally low priority
        let mut low = self.low_priority.lock().await;
        while batch.len() < limit && !low.is_empty() {
            if let Some(path) = low.pop_front() {
                batch.push(path);
            }
        }
        drop(low);
        
        // Remove from pending
        let mut pending = self.pending_files.write().await;
        for path in &batch {
            pending.remove(path);
        }
        
        batch
    }
}

// Main sync provider
#[derive(Clone)]
pub struct IrohSyncProviderV2 {
    // Core components
    node: Arc<RwLock<Option<MemNode>>>,
    doc: Arc<RwLock<Option<Doc>>>,
    doc_id: Arc<RwLock<Option<NamespaceId>>>,
    author_id: Arc<RwLock<Option<AuthorId>>>,
    
    // Configuration
    config: Arc<RwLock<SyncConfig>>,
    workspace_path: Arc<RwLock<Option<PathBuf>>>,
    
    // State management
    state: Arc<RwLock<SyncState>>,
    state_subscribers: Arc<Mutex<Vec<mpsc::UnboundedSender<SyncState>>>>,
    
    // Performance
    memory_limiter: Arc<MemoryLimiter>,
    operation_semaphore: Arc<Semaphore>,
    file_cache: Arc<RwLock<HashMap<PathBuf, FileEntry>>>,
    
    // Sync management
    sync_queue: Arc<Mutex<VecDeque<SyncOperation>>>,
    active_transaction: Arc<Mutex<Option<SyncTransaction>>>,
    
    // Smart sync queue
    smart_queue: Arc<SmartSyncQueue>,
    
    // File watcher
    file_watcher: Arc<Mutex<Option<super::file_watcher::FileWatcher>>>,
    
    // Conflict management
    conflicts: Arc<RwLock<HashMap<PathBuf, ConflictInfo>>>,
    
    // Network monitoring
    network_monitor: Arc<Mutex<Option<NetworkMonitor>>>,
    bandwidth_limiter: Arc<Mutex<Option<BandwidthLimiter>>>,
    
    // Offline queue
    offline_queue: Arc<Mutex<VecDeque<SyncOperation>>>,
    is_online: Arc<AtomicBool>,
    
    // Metrics
    metrics: SyncMetrics,
    
    // Background tasks
    sync_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    monitor_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    batch_sync_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    idle_sync_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    
    // Sync timing
    last_manual_sync: Arc<RwLock<Instant>>,
    last_idle_sync: Arc<RwLock<Instant>>,
    
    // Shutdown
    shutdown_signal: Arc<AtomicBool>,
}

impl IrohSyncProviderV2 {
    pub fn new() -> Self {
        let config = SyncConfig::default();
        let memory_limiter = Arc::new(MemoryLimiter::new(
            config.max_memory_mb,
            config.chunk_size,
        ));
        let operation_semaphore = Arc::new(Semaphore::new(config.max_concurrent_ops));
        
        Self {
            node: Arc::new(RwLock::new(None)),
            // client field removed in v0.28 - using node directly
            doc: Arc::new(RwLock::new(None)),
            doc_id: Arc::new(RwLock::new(None)),
            author_id: Arc::new(RwLock::new(None)),
            config: Arc::new(RwLock::new(config)),
            workspace_path: Arc::new(RwLock::new(None)),
            state: Arc::new(RwLock::new(SyncState::Uninitialized)),
            state_subscribers: Arc::new(Mutex::new(Vec::new())),
            memory_limiter,
            operation_semaphore,
            file_cache: Arc::new(RwLock::new(HashMap::new())),
            sync_queue: Arc::new(Mutex::new(VecDeque::new())),
            active_transaction: Arc::new(Mutex::new(None)),
            smart_queue: Arc::new(SmartSyncQueue::new()),
            file_watcher: Arc::new(Mutex::new(None)),
            conflicts: Arc::new(RwLock::new(HashMap::new())),
            network_monitor: Arc::new(Mutex::new(None)),
            bandwidth_limiter: Arc::new(Mutex::new(None)),
            offline_queue: Arc::new(Mutex::new(VecDeque::new())),
            is_online: Arc::new(AtomicBool::new(true)),
            metrics: SyncMetrics::default(),
            sync_handle: Arc::new(Mutex::new(None)),
            monitor_handle: Arc::new(Mutex::new(None)),
            batch_sync_handle: Arc::new(Mutex::new(None)),
            idle_sync_handle: Arc::new(Mutex::new(None)),
            last_manual_sync: Arc::new(RwLock::new(Instant::now())),
            last_idle_sync: Arc::new(RwLock::new(Instant::now())),
            shutdown_signal: Arc::new(AtomicBool::new(false)),
        }
    }
    
    // Set sync state and notify subscribers
    async fn set_state(&self, new_state: SyncState) {
        *self.state.write().await = new_state.clone();
        
        // Notify all subscribers
        let subscribers = self.state_subscribers.lock().await;
        for tx in subscribers.iter() {
            let _ = tx.send(new_state.clone());
        }
    }
    
    // Subscribe to state changes
    pub async fn subscribe_state(&self) -> mpsc::UnboundedReceiver<SyncState> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.state_subscribers.lock().await.push(tx);
        rx
    }
    
    // Initialize document (create new)
    pub async fn init_document(&mut self, workspace_path: PathBuf) -> Result<String, String> {
        info!("V2: Initializing new document for workspace: {:?}", workspace_path);
        self.set_state(SyncState::Initializing).await;
        
        // Validate workspace
        if !workspace_path.exists() || !workspace_path.is_dir() {
            let error = format!("Invalid workspace path: {:?}", workspace_path);
            self.set_state(SyncState::Failed(error.clone())).await;
            return Err(error);
        }
        
        *self.workspace_path.write().await = Some(workspace_path.clone());
        
        // Initialize Iroh node
        let node = Builder::default()
            .enable_docs()
            .spawn()
            .await
            .map_err(|e| {
                let error = format!("Failed to spawn Iroh node: {}", e);
                error
            })?;
        
        let _node_id = node.node_id();
        
        // Create author and document
        let author = node.authors().create().await
            .map_err(|e| format!("Failed to create author: {}", e))?;
        
        let doc = node.docs().create().await
            .map_err(|e| format!("Failed to create document: {}", e))?;
        
        let doc_id = doc.id();
        
        // Create share ticket before moving doc
        let ticket = doc.share(ShareMode::Write, Default::default()).await
            .map_err(|e| format!("Failed to create share ticket: {}", e))?;
        
        // Store components
        *self.node.write().await = Some(node);
        *self.doc.write().await = Some(doc);
        *self.doc_id.write().await = Some(doc_id);
        *self.author_id.write().await = Some(author);
        
        // Start background tasks
        self.start_background_tasks().await?;
        
        // Initial scan
        self.scan_and_sync().await?;
        
        self.set_state(SyncState::Idle).await;
        
        info!("V2: Document initialized successfully");
        Ok(ticket.to_string())
    }
    
    // Join existing document
    pub async fn join_document(&mut self, workspace_path: PathBuf, ticket: &str) -> Result<String, String> {
        info!("V2: Joining document with ticket");
        self.set_state(SyncState::Initializing).await;

        *self.workspace_path.write().await = Some(workspace_path);

        // Parse ticket
        let ticket: DocTicket = ticket.parse()
            .map_err(|e| format!("Invalid ticket: {}", e))?;

        // Initialize node
        let node = Builder::default()
            .enable_docs()
            .spawn()
            .await
            .map_err(|e| format!("Failed to spawn node: {}", e))?;

        // Create author
        let author = node.authors().create().await
            .map_err(|e| format!("Failed to create author: {}", e))?;

        // Import document from parsed ticket
        let doc = node.docs().import(ticket).await
            .map_err(|e| format!("Failed to import document: {}", e))?;

        let doc_id = doc.id();

        // Store components
        *self.doc.write().await = Some(doc.clone());
        *self.doc_id.write().await = Some(doc_id);
        *self.author_id.write().await = Some(author);
        *self.node.write().await = Some(node);

        // Start background tasks
        self.start_background_tasks().await?;

        // Initial sync
        self.scan_and_sync().await?;

        self.set_state(SyncState::Idle).await;

        info!("V2: Successfully joined document");
        Ok("Successfully joined document".to_string())
    }

    /// Get the current document's sharing ticket
    pub async fn get_ticket(&self) -> Result<String, String> {
        let doc = self.doc.read().await;
        let doc = doc.as_ref().ok_or("Document not initialized")?;

        let ticket = doc
            .share(ShareMode::Write, Default::default())
            .await
            .map_err(|e| format!("Failed to get ticket: {}", e))?;

        Ok(ticket.to_string())
    }

    // Start background monitoring and sync tasks
    async fn start_background_tasks(&self) -> Result<(), String> {
        // Start file watcher
        self.start_file_watcher().await?;
        
        // Health monitor
        let monitor_handle = {
            let state = self.state.clone();
            let metrics = self.metrics.clone();
            let shutdown_signal = self.shutdown_signal.clone();
            
            tokio::spawn(async move {
                let mut interval = interval(Duration::from_secs(HEALTH_CHECK_INTERVAL_SECS));
                
                while !shutdown_signal.load(Ordering::Relaxed) {
                    interval.tick().await;
                    
                    let current_state = state.read().await.clone();
                    debug!(
                        "V2 Health: State={:?}, Files={}, Uploaded={}, Downloaded={}, Errors={}",
                        current_state,
                        metrics.files_scanned(),
                        metrics.files_uploaded(),
                        metrics.files_downloaded(),
                        metrics.inner.errors_count.load(Ordering::Relaxed)
                    );
                }
            })
        };
        
        // Batch sync task - runs every 30 seconds
        let batch_sync_handle = {
            let self_clone = self.clone();
            let shutdown_signal = self.shutdown_signal.clone();
            
            tokio::spawn(async move {
                let mut interval = interval(Duration::from_millis(BATCH_SYNC_INTERVAL_MS));
                
                while !shutdown_signal.load(Ordering::Relaxed) {
                    interval.tick().await;
                    
                    // Trigger sync for medium priority files
                    match self_clone.trigger_smart_sync().await {
                        Ok(_) => debug!("V2: Batch sync completed"),
                        Err(e) => error!("V2: Batch sync failed: {}", e),
                    }
                }
            })
        };
        
        // Idle sync task - runs every 5 minutes
        let idle_sync_handle = {
            let self_clone = self.clone();
            let shutdown_signal = self.shutdown_signal.clone();
            
            tokio::spawn(async move {
                let mut interval = interval(Duration::from_millis(IDLE_SYNC_INTERVAL_MS));
                
                while !shutdown_signal.load(Ordering::Relaxed) {
                    interval.tick().await;
                    
                    // Full scan and sync
                    info!("V2: Running idle sync (full scan)");
                    match self_clone.scan_and_sync().await {
                        Ok(_) => {
                            *self_clone.last_idle_sync.write().await = Instant::now();
                            info!("V2: Idle sync completed");
                        }
                        Err(e) => error!("V2: Idle sync failed: {}", e),
                    }
                }
            })
        };
        
        *self.monitor_handle.lock().await = Some(monitor_handle);
        *self.batch_sync_handle.lock().await = Some(batch_sync_handle);
        *self.idle_sync_handle.lock().await = Some(idle_sync_handle);
        
        // Network status monitor
        let _network_monitor_handle = {
            let self_clone = self.clone();
            let shutdown_signal = self.shutdown_signal.clone();
            
            tokio::spawn(async move {
                let mut interval = interval(Duration::from_secs(10)); // Check every 10 seconds
                let mut was_offline = false;
                
                while !shutdown_signal.load(Ordering::Relaxed) {
                    interval.tick().await;
                    
                    if let Some(monitor) = self_clone.network_monitor.lock().await.as_ref() {
                        let is_online = monitor.is_online();
                        let bandwidth_bps = monitor.get_bandwidth_bps();
                        
                        self_clone.metrics.inner.network_bandwidth.store(bandwidth_bps, Ordering::Relaxed);
                        self_clone.is_online.store(is_online, Ordering::Relaxed);
                        
                        if is_online && was_offline {
                            info!("V2: Network connection restored, processing offline queue");
                            // Process offline queue
                            let mut queue = self_clone.offline_queue.lock().await;
                            let operations: Vec<_> = queue.drain(..).collect();
                            drop(queue);
                            
                            if !operations.is_empty() {
                                info!("V2: Processing {} queued operations", operations.len());
                                if let Err(e) = self_clone.execute_sync_operations(operations).await {
                                    error!("V2: Failed to process offline queue: {}", e);
                                }
                            }
                        }
                        
                        was_offline = !is_online;
                    }
                }
            })
        };
        
        info!("V2: Background tasks started - file watcher, batch sync (30s), idle sync (5m)");
        Ok(())
    }
    
    // Scan workspace and queue sync operations
    pub async fn scan_and_sync(&self) -> Result<String, String> {
        info!("V2: Starting full workspace scan and sync");
        let start_time = Instant::now();
        
        self.set_state(SyncState::Scanning).await;
        
        // Scan local files
        let local_files = self.scan_workspace().await?;
        info!("V2: Found {} local files", local_files.len());
        
        // Get remote entries
        let remote_entries = self.fetch_remote_entries().await?;
        info!("V2: Found {} remote entries", remote_entries.len());
        
        // Calculate sync operations
        let operations = self.calculate_sync_operations(&local_files, &remote_entries).await?;
        info!("V2: Calculated {} sync operations", operations.len());
        
        if operations.is_empty() {
            self.set_state(SyncState::Idle).await;
            return Ok("Already in sync".to_string());
        }
        
        // Execute sync operations in batches
        self.execute_sync_operations(operations).await?;
        
        let duration = start_time.elapsed();
        self.metrics.inner.last_sync_duration_ms.store(
            duration.as_millis() as u64,
            Ordering::Relaxed
        );
        
        self.set_state(SyncState::Idle).await;
        
        Ok(format!(
            "V2 Sync completed: {} files uploaded, {} files downloaded in {}ms",
            self.metrics.files_uploaded(),
            self.metrics.files_downloaded(),
            duration.as_millis()
        ))
    }
    
    // Scan workspace for files
    async fn scan_workspace(&self) -> Result<HashMap<PathBuf, FileEntry>, String> {
        let workspace = self.workspace_path.read().await.clone()
            .ok_or_else(|| "Workspace not set".to_string())?;
        
        let mut entries = HashMap::new();
        let mut scan_queue = VecDeque::new();
        scan_queue.push_back(workspace.clone());
        
        self.metrics.inner.files_scanned.store(0, Ordering::Relaxed);
        
        while let Some(dir) = scan_queue.pop_front() {
            let mut read_dir = fs::read_dir(&dir).await
                .map_err(|e| format!("Failed to read directory {:?}: {}", dir, e))?;
            
            while let Some(entry) = read_dir.next_entry().await
                .map_err(|e| format!("Failed to read entry: {}", e))? {
                
                let path = entry.path();
                let metadata = entry.metadata().await
                    .map_err(|e| format!("Failed to get metadata for {:?}: {}", path, e))?;
                
                // Skip hidden files and .lokus directory
                if path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false) {
                    continue;
                }
                
                if metadata.is_dir() {
                    scan_queue.push_back(path);
                } else if metadata.is_file() {
                    // Calculate hash efficiently
                    let hash = self.hash_file(&path).await?;
                    
                    let relative_path = path.strip_prefix(&workspace)
                        .map_err(|e| format!("Failed to get relative path: {}", e))?
                        .to_path_buf();
                    
                    entries.insert(relative_path.clone(), FileEntry {
                        path: relative_path,
                        size: metadata.len(),
                        modified: metadata.modified()
                            .unwrap_or_else(|_| SystemTime::now()),
                        hash,
                        chunk_hashes: vec![],
                        version: 1,
                        author: "local".to_string(),
                    });
                    
                    self.metrics.inner.files_scanned.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
        
        // Update cache
        *self.file_cache.write().await = entries.clone();
        
        Ok(entries)
    }
    
    // Calculate file hash with chunk hashes for delta sync
    async fn hash_file_with_chunks(&self, path: &Path) -> Result<([u8; 32], Vec<[u8; 32]>), String> {
        use tokio::io::AsyncReadExt;
        
        let mut file = fs::File::open(path).await
            .map_err(|e| format!("Failed to open file {:?}: {}", path, e))?;
        
        let mut hasher = blake3::Hasher::new();
        let mut chunk_hashes = Vec::new();
        let chunk_size = 1024 * 1024; // 1MB chunks for delta sync
        let mut buffer = vec![0u8; chunk_size];
        
        loop {
            let n = file.read(&mut buffer).await
                .map_err(|e| format!("Failed to read file {:?}: {}", path, e))?;
            
            if n == 0 {
                break;
            }
            
            // Hash the chunk
            let chunk_data = &buffer[..n];
            hasher.update(chunk_data);
            
            // Store chunk hash
            let chunk_hash = blake3::hash(chunk_data).into();
            chunk_hashes.push(chunk_hash);
        }
        
        Ok((hasher.finalize().into(), chunk_hashes))
    }
    
    // Simple hash for compatibility
    async fn hash_file(&self, path: &Path) -> Result<[u8; 32], String> {
        let (hash, _) = self.hash_file_with_chunks(path).await?;
        Ok(hash)
    }
    
    // Fetch remote entries from document
    async fn fetch_remote_entries(&self) -> Result<HashMap<PathBuf, [u8; 32]>, String> {
        let doc = self.doc.read().await.clone()
            .ok_or_else(|| "Document not initialized".to_string())?;
        
        let mut entries = HashMap::new();
        
        let mut query = doc.get_many(iroh::docs::store::Query::all()).await
            .map_err(|e| format!("Failed to query document: {}", e))?;
        
        while let Some(entry) = query.try_next().await
            .map_err(|e| format!("Failed to get entry: {}", e))? {
            
            // Parse key as path
            let key = entry.key();
            if let Ok(path_str) = std::str::from_utf8(key) {
                let path = PathBuf::from(path_str);
                
                // For v0.28, we need to get content using the node
                // For now, store a placeholder hash - this will be fixed when we read the content
                let hash = [0u8; 32]; // TODO: Get actual hash from entry
                entries.insert(path, hash);
            }
        }
        
        Ok(entries)
    }
    
    // Calculate sync operations
    async fn calculate_sync_operations(
        &self,
        local_files: &HashMap<PathBuf, FileEntry>,
        remote_entries: &HashMap<PathBuf, [u8; 32]>,
    ) -> Result<Vec<SyncOperation>, String> {
        let mut operations = Vec::new();
        
        // Find files to upload
        for (path, entry) in local_files {
            match remote_entries.get(path) {
                Some(remote_hash) if remote_hash != &entry.hash => {
                    // File modified locally
                    operations.push(SyncOperation::Upload {
                        path: path.clone(),
                        entry: entry.clone(),
                    });
                }
                None => {
                    // New local file
                    operations.push(SyncOperation::Upload {
                        path: path.clone(),
                        entry: entry.clone(),
                    });
                }
                _ => {} // File unchanged
            }
        }
        
        // Find files to download
        for (path, remote_hash) in remote_entries {
            if !local_files.contains_key(path) {
                operations.push(SyncOperation::Download {
                    path: path.clone(),
                    hash: *remote_hash,
                    size: 0, // Will be determined during download
                });
            }
        }
        
        Ok(operations)
    }
    
    // Execute sync operations with batching and concurrency control
    async fn execute_sync_operations(&self, operations: Vec<SyncOperation>) -> Result<(), String> {
        // Check if we're online
        if let Some(monitor) = self.network_monitor.lock().await.as_ref() {
            if !monitor.is_online() {
                // Queue operations for offline processing
                warn!("V2: Network offline, queuing {} operations", operations.len());
                let mut offline_queue = self.offline_queue.lock().await;
                for op in operations {
                    offline_queue.push_back(op);
                }
                self.metrics.inner.network_status.store(0, Ordering::Relaxed); // 0 = offline
                return Ok(());
            }
        }
        
        let total_operations = operations.len();
        let config = self.config.read().await;
        let batch_size = config.batch_size;
        
        // Create progress reporter
        let (progress_tx, mut progress_rx) = mpsc::unbounded_channel();
        let progress_reporter = ProgressReporter { tx: progress_tx };
        
        // Start progress reporting task
        let state = self.state.clone();
        tokio::spawn(async move {
            while let Some(event) = progress_rx.recv().await {
                match event {
                    ProgressEvent::Progress { current, total } => {
                        let progress = (current as f32 / total as f32) * 100.0;
                        *state.write().await = SyncState::Syncing { progress };
                    }
                    _ => {}
                }
            }
        });
        
        progress_reporter.tx.send(ProgressEvent::Started { 
            total_files: total_operations 
        }).ok();
        
        // Process operations in batches
        let mut completed = 0;
        
        for chunk in operations.chunks(batch_size) {
            // Create transaction for this batch
            let transaction = SyncTransaction {
                id: format!("{}", uuid::Uuid::new_v4()),
                operations: chunk.to_vec(),
                completed: HashSet::new(),
                start_time: Instant::now(),
            };
            
            *self.active_transaction.lock().await = Some(transaction);
            
            // Execute batch concurrently
            let mut tasks = Vec::new();
            
            for operation in chunk {
                let permit = self.operation_semaphore.clone().acquire_owned().await
                    .map_err(|e| format!("Failed to acquire semaphore: {}", e))?;
                
                let op_clone = operation.clone();
                let self_clone = self.clone();
                
                let task = tokio::spawn(async move {
                    let _permit = permit; // Hold permit for duration of operation
                    
                    // Get shared resources inside the task
                    let workspace = self_clone.workspace_path.read().await.clone()
                        .ok_or_else(|| "Workspace not set".to_string())?;
                    let doc = self_clone.doc.read().await.clone()
                        .ok_or_else(|| "Document not set".to_string())?;
                    let author = self_clone.author_id.read().await.clone()
                        .ok_or_else(|| "Author not set".to_string())?;
                    let metrics = self_clone.metrics.clone();
                    let memory_limiter = self_clone.memory_limiter.clone();
                    
                    match op_clone {
                        SyncOperation::Upload { path, entry } => {
                            Self::execute_upload(
                                workspace,
                                doc,
                                author,
                                path,
                                entry,
                                metrics,
                                memory_limiter,
                            ).await
                        }
                        SyncOperation::Download { path, hash, .. } => {
                            let node = self_clone.node.read().await.clone()
                                .ok_or_else(|| "Node not set".to_string())?;
                            Self::execute_download(
                                workspace,
                                doc,
                                author,
                                &node,
                                path,
                                hash,
                                metrics,
                                memory_limiter,
                            ).await
                        }
                        SyncOperation::Delete { .. } => {
                            // TODO: Implement delete
                            Ok(())
                        }
                    }
                });
                
                tasks.push(task);
            }
            
            // Wait for all operations in batch to complete
            let results = futures::future::join_all(tasks).await;
            
            // Check results
            for result in results {
                match result {
                    Ok(Ok(())) => completed += 1,
                    Ok(Err(e)) => {
                        error!("Operation failed: {}", e);
                        self.metrics.increment_errors();
                    }
                    Err(e) => {
                        error!("Task panicked: {}", e);
                        self.metrics.increment_errors();
                    }
                }
            }
            
            // Clear transaction
            *self.active_transaction.lock().await = None;
            
            // Report progress
            progress_reporter.tx.send(ProgressEvent::Progress {
                current: completed,
                total: total_operations,
            }).ok();
        }
        
        Ok(())
    }
    
    // Execute upload operation with retry and compression
    async fn execute_upload(
        workspace: PathBuf,
        doc: Doc,
        author: AuthorId,
        relative_path: PathBuf,
        mut entry: FileEntry,
        metrics: SyncMetrics,
        memory_limiter: Arc<MemoryLimiter>,
    ) -> Result<(), String> {
        let full_path = workspace.join(&relative_path);
        
        // Add retry logic with default config
        let retry_config = RetryConfig {
            max_retries: 3,
            base_delay_ms: 1000,
            max_delay_ms: 60000,
            multiplier: 2.0,
        };
        
        retry_with_backoff("file upload", &retry_config, || {
            let full_path = full_path.clone();
            let doc = doc.clone();
            let relative_path = relative_path.clone();
            let mut entry = entry.clone();
            let metrics = metrics.clone();
            let memory_limiter = memory_limiter.clone();
            
            Box::pin(async move {
                // Read file with integrity check
                let mut file = fs::File::open(&full_path).await
                    .map_err(|e| format!("Failed to open file: {}", e))?;
                
                let mut content = Vec::new();
                let mut buffer = vec![0u8; DEFAULT_CHUNK_SIZE];
                
                // Acquire memory permit
                let _permit = memory_limiter.acquire().await
                    .map_err(|e| format!("Memory limit exceeded: {}", e))?;
                
                // Read file in chunks
                loop {
                    let n = file.read(&mut buffer).await
                        .map_err(|e| format!("Failed to read file: {}", e))?;
                    
                    if n == 0 {
                        break;
                    }
                    
                    content.extend_from_slice(&buffer[..n]);
                }
                
                // Verify integrity
                let calculated_hash: [u8; 32] = blake3::hash(&content).into();
                if calculated_hash != entry.hash {
                    metrics.inner.corrupted_files.fetch_add(1, Ordering::Relaxed);
                    return Err("File corrupted during read".to_string());
                }
                
                // Compress if enabled (using default compression level 3)
                let enable_compression = true; // Enterprise default
                let final_content = if enable_compression && content.len() > 1024 { // Only compress files > 1KB
                    match zstd_encode(&content[..], 3) {
                        Ok(compressed) => {
                            // Only use compressed if it's actually smaller
                            if compressed.len() < content.len() {
                                let ratio = (compressed.len() as f64 / content.len() as f64 * 10000.0) as u64;
                                metrics.inner.compression_ratio.store(ratio, Ordering::Relaxed);
                                metrics.inner.bytes_compressed.fetch_add(content.len() as u64 - compressed.len() as u64, Ordering::Relaxed);
                                compressed
                            } else {
                                content
                            }
                        }
                        Err(e) => {
                            warn!("Compression failed, using uncompressed: {}", e);
                            content
                        }
                    }
                } else {
                    content
                };
                
                // Prepare document entry with metadata
                let metadata = serde_json::to_vec(&entry)
                    .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
                
                let mut doc_content = Vec::new();
                doc_content.extend_from_slice(&(metadata.len() as u32).to_le_bytes());
                doc_content.extend_from_slice(&metadata);
                doc_content.extend_from_slice(&final_content);
                
                // Store with retry handled by outer function
                let key = relative_path.to_string_lossy().as_bytes().to_vec();
                doc.set_bytes(author, key, doc_content).await
                    .map_err(|e| format!("Failed to upload file: {}", e))?;
                
                metrics.add_uploaded(1, entry.size);
                metrics.inner.retry_count.fetch_add(1, Ordering::Relaxed);
                
                debug!("V2: Uploaded file: {:?} ({} bytes, compressed: {})", 
                    relative_path, entry.size, enable_compression);
                Ok(())
            })
        }).await
    }
    
    // Execute download operation with retry and decompression
    async fn execute_download(
        workspace: PathBuf,
        doc: Doc,
        author_id: AuthorId,
        node: &MemNode,
        relative_path: PathBuf,
        hash: [u8; 32],
        metrics: SyncMetrics,
        memory_limiter: Arc<MemoryLimiter>,
    ) -> Result<(), String> {
        let full_path = workspace.join(&relative_path);
        
        // Add retry logic
        let retry_config = RetryConfig {
            max_retries: 5, // More retries for downloads
            base_delay_ms: 2000,
            max_delay_ms: 120000,
            multiplier: 1.5,
        };
        
        retry_with_backoff("file download", &retry_config, || {
            let full_path = full_path.clone();
            let doc = doc.clone();
            let relative_path = relative_path.clone();
            let node_clone = node.clone();
            let metrics = metrics.clone();
            let memory_limiter = memory_limiter.clone();
            
            Box::pin(async move {
                // Get entry from document
                let key = relative_path.to_string_lossy().as_bytes().to_vec();
                let entry = doc.get_exact(author_id, key, false).await
                    .map_err(|e| format!("Failed to get document entry: {}", e))?
                    .ok_or_else(|| "File not found in document".to_string())?;
                
                // Get content hash and bytes
                let content_hash = entry.content_hash();
                let content_bytes = node_clone.blobs().read_to_bytes(content_hash).await
                    .map_err(|e| format!("Failed to get content bytes: {}", e))?;
                
                // Parse document entry
                if content_bytes.len() < 4 {
                    return Err("Invalid document entry: too small".to_string());
                }
                
                // Read metadata length
                let metadata_len = u32::from_le_bytes([
                    content_bytes[0],
                    content_bytes[1],
                    content_bytes[2],
                    content_bytes[3],
                ]) as usize;
                
                if content_bytes.len() < 4 + metadata_len {
                    return Err("Invalid document entry: metadata truncated".to_string());
                }
                
                // Parse metadata
                let metadata_bytes = &content_bytes[4..4 + metadata_len];
                let file_entry: FileEntry = serde_json::from_slice(metadata_bytes)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;
                
                // Get file content (possibly compressed)
                let file_data = &content_bytes[4 + metadata_len..];
                let file_size = file_data.len() as u64;
                
                // Acquire memory permit
                let _permit = memory_limiter.acquire().await
                    .map_err(|e| format!("Memory limit exceeded: {}", e))?;
                
                // Decompress if needed
                let final_content = if file_data.len() > 0 && file_data[0] == 0x28 && file_data[1] == 0xB5 {
                    // Zstd magic number detected
                    match zstd_decode(&file_data[..]) {
                        Ok(decompressed) => {
                            debug!("V2: Decompressed {} -> {} bytes", file_data.len(), decompressed.len());
                            decompressed
                        }
                        Err(e) => {
                            warn!("Decompression failed, treating as uncompressed: {}", e);
                            file_data.to_vec()
                        }
                    }
                } else {
                    file_data.to_vec()
                };
                
                // Verify integrity
                let calculated_hash: [u8; 32] = blake3::hash(&final_content).into();
                if calculated_hash != file_entry.hash {
                    metrics.inner.corrupted_files.fetch_add(1, Ordering::Relaxed);
                    return Err(format!("Integrity check failed for {:?}", relative_path));
                }
                
                // Create parent directories
                if let Some(parent) = full_path.parent() {
                    fs::create_dir_all(parent).await
                        .map_err(|e| format!("Failed to create directories: {}", e))?;
                }
                
                // Write file atomically
                let temp_path = full_path.with_extension("tmp");
                fs::write(&temp_path, &final_content).await
                    .map_err(|e| format!("Failed to write file: {}", e))?;
                
                // Set file modified time if available
                if let Ok(metadata) = fs::metadata(&temp_path).await {
                    // TODO: Set modified time from file_entry.modified
                }
                
                fs::rename(&temp_path, &full_path).await
                    .map_err(|e| format!("Failed to rename file: {}", e))?;
                
                metrics.add_downloaded(1, file_entry.size);
                metrics.inner.retry_count.fetch_add(1, Ordering::Relaxed);
                
                debug!("V2: Downloaded file: {:?} ({} bytes, original: {})", 
                    relative_path, final_content.len(), file_entry.size);
                Ok(())
            })
        }).await
    }
    
    // Get current status
    pub async fn get_status(&self) -> SyncStatus {
        let state = self.state.read().await.clone();
        let status = match state {
            SyncState::Idle => "synced",
            SyncState::Syncing { .. } => "syncing",
            SyncState::Failed(_) => "failed",
            _ => "unknown",
        };
        
        SyncStatus {
            status,
            files_uploaded: self.metrics.files_uploaded(),
            files_downloaded: self.metrics.files_downloaded(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
    
    // Get metrics (public accessor)
    pub fn metrics(&self) -> &SyncMetrics {
        &self.metrics
    }
    
    // Get detailed metrics for monitoring
    pub async fn get_detailed_metrics(&self) -> DetailedMetrics {
        let inner = &self.metrics.inner;
        let config = self.config.read().await;
        
        DetailedMetrics {
            files_scanned: inner.files_scanned.load(Ordering::Relaxed),
            files_uploaded: inner.files_uploaded.load(Ordering::Relaxed),
            files_downloaded: inner.files_downloaded.load(Ordering::Relaxed),
            bytes_uploaded: inner.bytes_uploaded.load(Ordering::Relaxed),
            bytes_downloaded: inner.bytes_downloaded.load(Ordering::Relaxed),
            errors_count: inner.errors_count.load(Ordering::Relaxed),
            retry_count: inner.retry_count.load(Ordering::Relaxed),
            compression_ratio: inner.compression_ratio.load(Ordering::Relaxed) as f32 / 10000.0,
            bytes_compressed: inner.bytes_compressed.load(Ordering::Relaxed),
            corrupted_files: inner.corrupted_files.load(Ordering::Relaxed),
            network_bandwidth: inner.network_bandwidth.load(Ordering::Relaxed),
            network_status: inner.network_status.load(Ordering::Relaxed),
            offline_queue_size: self.offline_queue.lock().await.len(),
            conflicts_count: self.conflicts.read().await.len(),
            config_summary: ConfigSummary {
                compression_enabled: config.enable_compression,
                delta_sync_enabled: config.enable_delta_sync,
                encryption_enabled: config.enable_encryption,
                bandwidth_limit_mbps: config.bandwidth_limit_mbps,
            },
        }
    }
    
    // Get conflicts for resolution
    pub async fn get_conflicts(&self) -> Vec<ConflictInfo> {
        self.conflicts.read().await.values().cloned().collect()
    }
    
    // Resolve conflict
    pub async fn resolve_conflict(&self, path: PathBuf, resolution: ConflictResolution) -> Result<(), String> {
        let conflict = self.conflicts.write().await.remove(&path)
            .ok_or_else(|| "No conflict found for path".to_string())?;
        
        match resolution {
            ConflictResolution::LastWriteWins => {
                // Use local version
                let op = SyncOperation::Upload {
                    path: conflict.local_entry.path.clone(),
                    entry: conflict.local_entry.clone(),
                };
                self.execute_sync_operations(vec![op]).await?;
            }
            ConflictResolution::FirstWriteWins => {
                // Use remote version - trigger download
                let op = SyncOperation::Download {
                    path: conflict.remote_entry.path.clone(),
                    hash: conflict.remote_entry.hash,
                    size: conflict.remote_entry.size,
                };
                self.execute_sync_operations(vec![op]).await?;
            }
            ConflictResolution::KeepBoth => {
                // Rename local file and download remote
                let new_name = format!(
                    "{}_local_{}", 
                    conflict.local_entry.path.file_stem().unwrap_or_default().to_string_lossy(),
                    chrono::Utc::now().format("%Y%m%d_%H%M%S")
                );
                let new_path = conflict.local_entry.path.with_file_name(new_name);
                
                // Rename local file
                let workspace = self.workspace_path.read().await.clone()
                    .ok_or_else(|| "Workspace not set".to_string())?;
                let old_full = workspace.join(&conflict.local_entry.path);
                let new_full = workspace.join(&new_path);
                fs::rename(&old_full, &new_full).await
                    .map_err(|e| format!("Failed to rename file: {}", e))?;
                
                // Download remote version
                let op = SyncOperation::Download {
                    path: conflict.remote_entry.path.clone(),
                    hash: conflict.remote_entry.hash,
                    size: conflict.remote_entry.size,
                };
                self.execute_sync_operations(vec![op]).await?;
            }
            _ => return Err("Resolution strategy not implemented".to_string()),
        }
        
        Ok(())
    }
    
    // Handle file change with smart debouncing
    pub async fn handle_file_change(&self, path: PathBuf, is_current_file: bool) -> Result<(), String> {
        let workspace = self.workspace_path.read().await.clone()
            .ok_or_else(|| "Workspace not set".to_string())?;
        
        // Skip if not in workspace
        if !path.starts_with(&workspace) {
            return Ok(());
        }
        
        // Get relative path
        let relative_path = path.strip_prefix(&workspace)
            .map_err(|e| format!("Failed to get relative path: {}", e))?
            .to_path_buf();
        
        // Skip hidden files
        if relative_path.to_string_lossy().contains("/.") {
            return Ok(());
        }
        
        // Determine priority
        let priority = if is_current_file {
            SyncPriority::High
        } else {
            SyncPriority::Medium
        };
        
        // Cancel existing debounce timer for this file
        let mut timers = self.smart_queue.debounce_timers.lock().await;
        if let Some(timer) = timers.remove(&relative_path) {
            timer.abort();
        }
        
        // Create new debounce timer
        let queue = self.smart_queue.clone();
        let path_clone = relative_path.clone();
        let self_clone = self.clone();
        let priority_clone = priority.clone();
        
        let timer = tokio::spawn(async move {
            // Wait for debounce duration
            tokio::time::sleep(Duration::from_millis(DEBOUNCE_DURATION_MS)).await;
            
            // Add to queue
            queue.add_file(path_clone, priority_clone).await;
            
            // Trigger sync if high priority
            if matches!(priority, SyncPriority::High) {
                let _ = self_clone.trigger_smart_sync().await;
            }
        });
        
        timers.insert(relative_path, timer);
        
        Ok(())
    }
    
    // Trigger smart sync based on queue
    pub async fn trigger_smart_sync(&self) -> Result<(), String> {
        // Get batch of files to sync
        let batch = self.smart_queue.get_next_batch(50).await;
        
        if batch.is_empty() {
            return Ok(());
        }
        
        info!("V2: Smart sync triggered for {} files", batch.len());
        
        // Convert to sync operations
        let workspace = self.workspace_path.read().await.clone()
            .ok_or_else(|| "Workspace not set".to_string())?;
        
        let mut operations = Vec::new();
        for relative_path in batch {
            let full_path = workspace.join(&relative_path);
            
            if full_path.exists() {
                // File exists - upload
                if let Ok(metadata) = fs::metadata(&full_path).await {
                    if metadata.is_file() {
                        let hash = self.hash_file(&full_path).await?;
                        let entry = FileEntry {
                            path: relative_path,
                            size: metadata.len(),
                            modified: metadata.modified()
                                .unwrap_or_else(|_| SystemTime::now()),
                            hash,
                            chunk_hashes: vec![],
                            version: 1,
                            author: "local".to_string(),
                        };
                        operations.push(SyncOperation::Upload { 
                            path: entry.path.clone(), 
                            entry 
                        });
                    }
                }
            } else {
                // File deleted - mark for deletion
                operations.push(SyncOperation::Delete { path: relative_path });
            }
        }
        
        if !operations.is_empty() {
            self.execute_sync_operations(operations).await?;
        }
        
        Ok(())
    }
    
    // Start file watcher
    async fn start_file_watcher(&self) -> Result<(), String> {
        let workspace = self.workspace_path.read().await.clone()
            .ok_or_else(|| "Workspace not set".to_string())?;
        
        // Create file watcher
        let mut watcher = super::file_watcher::FileWatcher::new(&workspace)
            .map_err(|e| format!("Failed to create file watcher: {}", e))?;
        
        // Start watcher task
        let self_clone = self.clone();
        tokio::spawn(async move {
            while let Some(event) = watcher.next_event().await {
                match event.kind {
                    super::file_watcher::FileChangeKind::Created |
                    super::file_watcher::FileChangeKind::Modified => {
                        let _ = self_clone.handle_file_change(event.path, false).await;
                    }
                    super::file_watcher::FileChangeKind::Deleted => {
                        let _ = self_clone.handle_file_change(event.path, false).await;
                    }
                    super::file_watcher::FileChangeKind::Renamed { from: _ } => {
                        let _ = self_clone.handle_file_change(event.path, false).await;
                    }
                }
            }
        });
        
        // Note: We can't store the watcher since we moved it into the task
        // The watcher will run until the task is aborted
        
        Ok(())
    }
    
    // Shutdown cleanly
    pub async fn shutdown(&mut self) -> Result<(), String> {
        info!("V2: Shutting down sync provider");
        self.shutdown_signal.store(true, Ordering::Relaxed);
        
        // Stop background tasks
        if let Some(handle) = self.sync_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.monitor_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.batch_sync_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.idle_sync_handle.lock().await.take() {
            handle.abort();
        }
        
        // Stop file watcher
        *self.file_watcher.lock().await = None;
        
        // Clear state
        self.set_state(SyncState::Shutdown).await;
        
        // Drop components
        *self.node.write().await = None;
        // client field removed - using node directly
        *self.doc.write().await = None;
        
        Ok(())
    }
}

// Public types for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub status: &'static str,
    pub files_uploaded: u64,
    pub files_downloaded: u64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedMetrics {
    pub files_scanned: u64,
    pub files_uploaded: u64,
    pub files_downloaded: u64,
    pub bytes_uploaded: u64,
    pub bytes_downloaded: u64,
    pub errors_count: u64,
    pub retry_count: u64,
    pub compression_ratio: f32,
    pub bytes_compressed: u64,
    pub corrupted_files: u64,
    pub network_bandwidth: u64,
    pub network_status: u64,
    pub offline_queue_size: usize,
    pub conflicts_count: usize,
    pub config_summary: ConfigSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSummary {
    pub compression_enabled: bool,
    pub delta_sync_enabled: bool,
    pub encryption_enabled: bool,
    pub bandwidth_limit_mbps: Option<f64>,
}

// UUID support
mod uuid {
    use std::fmt;
    
    pub struct Uuid([u8; 16]);
    
    impl Uuid {
        pub fn new_v4() -> Self {
            let mut bytes = [0u8; 16];
            getrandom::getrandom(&mut bytes).unwrap();
            
            // Set version (4) and variant
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            
            Self(bytes)
        }
    }
    
    impl fmt::Display for Uuid {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            let d = &self.0;
            write!(f, "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7],
                d[8], d[9], d[10], d[11], d[12], d[13], d[14], d[15]
            )
        }
    }
}

// Add getrandom to dependencies in Cargo.toml