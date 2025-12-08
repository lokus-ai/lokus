// Sync Provider Trait - Abstract interface for different sync backends
// Enables pluggable sync systems (Git, Iroh, etc.)

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Sync provider type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SyncType {
    /// Git-based synchronization
    Git,
    /// Iroh peer-to-peer synchronization
    Iroh,
}

/// Sync status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// Whether the workspace is fully synced
    pub is_synced: bool,
    /// Whether there are local changes
    pub has_changes: bool,
    /// Type of sync being used
    pub sync_type: SyncType,
    /// Number of connected peers (for P2P sync)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_peers: Option<usize>,
    /// Document ID (for Iroh)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    /// Number of commits ahead (for Git)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ahead: Option<usize>,
    /// Number of commits behind (for Git)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub behind: Option<usize>,
    /// Merge conflicts (for Git)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicts: Option<Vec<String>>,
    /// Last commit hash (for Git)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_commit: Option<String>,
}

/// Peer information for P2P sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    /// Peer's node ID
    pub node_id: String,
    /// Peer's connection addresses (relay URLs or direct addresses)
    pub addresses: Vec<String>,
    /// Connection status
    pub connected: bool,
    /// Connection type (direct, relay, or unknown)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_type: Option<String>,
}

/// Errors that can occur during sync operations
#[derive(Error, Debug)]
pub enum SyncError {
    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Iroh-specific error
    #[error("Iroh error: {0}")]
    Iroh(String),

    /// Git-specific error
    #[error("Git error: {0}")]
    Git(String),

    /// Network error
    #[error("Network error: {0}")]
    Network(String),

    /// Serialization/deserialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// File system error
    #[error("File system error: {0}")]
    FileSystem(String),

    /// Document not found
    #[error("Document not found")]
    DocumentNotFound,

    /// Invalid ticket
    #[error("Invalid ticket: {0}")]
    InvalidTicket(String),

    /// Operation failed
    #[error("Operation failed: {0}")]
    OperationFailed(String),
}

/// Result type for sync operations
pub type SyncResult<T> = Result<T, SyncError>;

/// Abstract sync provider interface
///
/// This trait defines the contract for sync providers, enabling different
/// backends (Git, Iroh, etc.) to be used interchangeably.
#[async_trait]
pub trait SyncProvider: Send + Sync {
    /// Initialize the sync provider for a workspace
    ///
    /// # Arguments
    /// * `workspace_path` - Path to the workspace directory
    ///
    /// # Returns
    /// Success message or error
    async fn init(&mut self, workspace_path: PathBuf) -> SyncResult<String>;

    /// Get current sync status
    ///
    /// # Returns
    /// Current sync status including changes, peers, etc.
    async fn status(&self) -> SyncResult<SyncStatus>;

    /// Synchronize the workspace
    ///
    /// Performs a full sync operation - pulling changes and pushing local updates.
    ///
    /// # Returns
    /// Success message or error
    async fn sync(&mut self) -> SyncResult<String>;

    /// Handle a file change event
    ///
    /// Called when a file in the workspace is created, modified, or deleted.
    ///
    /// # Arguments
    /// * `file_path` - Path to the changed file (relative to workspace)
    /// * `is_deleted` - Whether the file was deleted
    ///
    /// # Returns
    /// Success or error
    async fn on_file_changed(&mut self, file_path: PathBuf, is_deleted: bool) -> SyncResult<()>;

    /// Get list of connected peers (for P2P sync)
    ///
    /// # Returns
    /// List of peer information, or None if not applicable
    async fn get_peers(&self) -> SyncResult<Vec<PeerInfo>>;

    /// Shutdown the sync provider
    ///
    /// Performs cleanup and saves state before shutdown.
    ///
    /// # Returns
    /// Success or error
    async fn shutdown(&mut self) -> SyncResult<()>;
}

/// Helper to create user-friendly error messages
pub fn format_sync_error(error: &SyncError, operation: &str) -> String {
    match error {
        SyncError::Network(_) => format!(
            "Network connection failed while trying to {}. Check your internet connection and try again.",
            operation
        ),
        SyncError::Iroh(msg) => format!(
            "Iroh sync error during {}: {}",
            operation, msg
        ),
        SyncError::Git(msg) => format!(
            "Git error during {}: {}",
            operation, msg
        ),
        SyncError::DocumentNotFound => format!(
            "Document not found. Initialize the workspace first."
        ),
        SyncError::InvalidTicket(_) => format!(
            "Invalid sync ticket. Please check the ticket and try again."
        ),
        _ => format!("Failed to {}: {}", operation, error),
    }
}
