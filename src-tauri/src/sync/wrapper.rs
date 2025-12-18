// Simple wrapper for V1/V2 compatibility
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use super::iroh::IrohSyncProvider;
use super::iroh_v2_enterprise::IrohSyncProviderV2;
use super::provider::SyncProvider;
use serde::{Serialize, Deserialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProviderConfig {
    pub use_v2: bool,
}

impl Default for SyncProviderConfig {
    fn default() -> Self {
        Self {
            // V2 is now the default! Use LOKUS_USE_IROH_V1=true to fallback to V1
            use_v2: std::env::var("LOKUS_USE_IROH_V1")
                .unwrap_or_default()
                .to_lowercase() != "true",
        }
    }
}

pub enum IrohProviderWrapper {
    V1(IrohSyncProvider),
    V2(IrohSyncProviderV2),
}

impl IrohProviderWrapper {
    pub fn new(config: SyncProviderConfig) -> Self {
        if config.use_v2 {
            IrohProviderWrapper::V2(IrohSyncProviderV2::new())
        } else {
            IrohProviderWrapper::V1(IrohSyncProvider::new())
        }
    }
    
    pub async fn init_document(&mut self, workspace_path: PathBuf) -> Result<String, String> {
        match self {
            IrohProviderWrapper::V1(p) => {
                // V1 needs init first, then create_document
                p.init(workspace_path.clone()).await
                    .map_err(|e| format!("{}", e))?;
                p.create_document().await
                    .map_err(|e| format!("{}", e))
            },
            IrohProviderWrapper::V2(p) => p.init_document(workspace_path).await,
        }
    }
    
    pub async fn join_document(&mut self, workspace_path: PathBuf, ticket: String) -> Result<String, String> {
        match self {
            IrohProviderWrapper::V1(p) => {
                // V1 needs init first, then join
                p.init(workspace_path).await
                    .map_err(|e| format!("{}", e))?;
                p.join_document(&ticket).await
                    .map_err(|e| format!("{}", e))
            },
            IrohProviderWrapper::V2(p) => p.join_document(workspace_path, &ticket).await,
        }
    }
    
    pub async fn manual_sync(&mut self) -> Result<String, String> {
        match self {
            IrohProviderWrapper::V1(p) => {
                let _ = p.sync();
                Ok("V1 sync triggered".to_string())
            },
            IrohProviderWrapper::V2(p) => p.scan_and_sync().await,
        }
    }
    
    pub async fn get_status(&self) -> serde_json::Value {
        match self {
            IrohProviderWrapper::V1(p) => {
                match p.status().await {
                    Ok(status) => json!(status),
                    Err(_) => json!({"status": "unknown"})
                }
            }
            IrohProviderWrapper::V2(p) => {
                let status = p.get_status().await;
                json!(status)
            }
        }
    }
    
    pub fn is_v2(&self) -> bool {
        matches!(self, IrohProviderWrapper::V2(_))
    }
    
    pub async fn notify_file_save(&self, file_path: PathBuf) -> Result<(), String> {
        match self {
            IrohProviderWrapper::V1(_) => {
                // V1 doesn't support smart sync
                Ok(())
            }
            IrohProviderWrapper::V2(p) => {
                // Notify V2 that this file was just saved (high priority)
                p.handle_file_change(file_path, true).await
            }
        }
    }
    
    pub async fn force_sync_all(&mut self) -> Result<String, String> {
        match self {
            IrohProviderWrapper::V1(p) => {
                // V1: trigger regular sync
                let _ = p.sync();
                Ok("V1 sync triggered".to_string())
            }
            IrohProviderWrapper::V2(p) => {
                // V2: force full scan and sync
                p.scan_and_sync().await
            }
        }
    }
    
    pub async fn get_sync_metrics(&self) -> serde_json::Value {
        match self {
            IrohProviderWrapper::V1(_) => {
                // V1 doesn't have detailed metrics
                json!({
                    "files_scanned": 0,
                    "files_uploaded": 0,
                    "files_downloaded": 0,
                    "bytes_uploaded": 0,
                    "bytes_downloaded": 0,
                    "errors_count": 0,
                    "conflicts_count": 0,
                    "last_sync_duration_ms": 0
                })
            }
            IrohProviderWrapper::V2(p) => {
                // V2 has comprehensive metrics
                let metrics = p.metrics();
                json!({
                    "files_scanned": metrics.files_scanned(),
                    "files_uploaded": metrics.files_uploaded(),
                    "files_downloaded": metrics.files_downloaded(),
                    "bytes_uploaded": metrics.inner.bytes_uploaded.load(Ordering::Relaxed),
                    "bytes_downloaded": metrics.inner.bytes_downloaded.load(Ordering::Relaxed),
                    "errors_count": metrics.inner.errors_count.load(Ordering::Relaxed),
                    "conflicts_count": metrics.inner.conflicts_count.load(Ordering::Relaxed),
                    "last_sync_duration_ms": metrics.inner.last_sync_duration_ms.load(Ordering::Relaxed),
                })
            }
        }
    }

    pub async fn get_ticket(&self) -> Result<String, String> {
        match self {
            IrohProviderWrapper::V1(p) => {
                p.get_ticket().await
                    .map_err(|e| format!("{}", e))
            }
            IrohProviderWrapper::V2(p) => {
                p.get_ticket().await
            }
        }
    }
}