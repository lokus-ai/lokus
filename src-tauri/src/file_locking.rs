use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

lazy_static::lazy_static! {
    static ref FILE_LOCK_MANAGER: FileLock = FileLock {
        locks: Arc::new(Mutex::new(HashMap::new())),
    };
}

/// Global file lock manager to prevent concurrent file operations
/// and data races during read/write operations

#[derive(Clone)]
pub(crate) struct FileLock {
    locks: Arc<Mutex<HashMap<String, LockState>>>,
}

struct LockState {
    locked_by: String,  // Operation ID
    locked_at: Instant,
    lock_type: LockType,
}

#[derive(Debug, Clone, PartialEq)]
enum LockType {
    Read,
    Write,
}

const LOCK_TIMEOUT: Duration = Duration::from_secs(30);
const LOCK_RETRY_INTERVAL: Duration = Duration::from_millis(100);
const STALE_LOCK_AFTER: Duration = Duration::from_secs(300);

impl FileLock {
    /// One non-blocking attempt at the write lock. `Ok(false)` means another
    /// operation holds it.
    fn try_acquire_write_lock(path: &str, operation_id: &str) -> Result<bool, String> {
        let mut locks = FILE_LOCK_MANAGER.locks.lock()
            .map_err(|e| format!("Failed to acquire lock mutex: {}", e))?;

        if let Some(lock_state) = locks.get(path) {
            // Break locks left behind by a crashed operation.
            if lock_state.locked_at.elapsed() > STALE_LOCK_AFTER {
                locks.remove(path);
            } else {
                return Ok(false);
            }
        }

        locks.insert(path.to_string(), LockState {
            locked_by: operation_id.to_string(),
            locked_at: Instant::now(),
            lock_type: LockType::Write,
        });

        Ok(true)
    }

    fn timeout_error(path: &str) -> String {
        let held_by = FILE_LOCK_MANAGER.locks.lock().ok()
            .and_then(|locks| locks.get(path).map(|s| (s.locked_by.clone(), s.locked_at.elapsed())));

        match held_by {
            Some((who, held)) => format!(
                "Timeout waiting for write lock on {}. Locked by {} for {:?}",
                path, who, held
            ),
            None => format!("Timeout waiting for write lock on {}", path),
        }
    }

    /// Acquire a write lock on a file, parking the OS thread between attempts.
    ///
    /// Only safe off the UI thread — prefer [`acquire_write_lock_async`] from a
    /// `#[tauri::command]`, since a non-`async` command body runs on the main
    /// thread on macOS and this would freeze the window for the whole wait.
    #[allow(dead_code)]
    pub fn acquire_write_lock(path: &str, operation_id: &str) -> Result<(), String> {
        let start = Instant::now();

        loop {
            if Self::try_acquire_write_lock(path, operation_id)? {
                return Ok(());
            }
            if start.elapsed() > LOCK_TIMEOUT {
                return Err(Self::timeout_error(path));
            }
            std::thread::sleep(LOCK_RETRY_INTERVAL);
        }
    }

    /// Acquire a write lock, yielding to the async runtime between attempts
    /// instead of blocking a thread.
    pub async fn acquire_write_lock_async(path: &str, operation_id: &str) -> Result<(), String> {
        let start = Instant::now();

        loop {
            if Self::try_acquire_write_lock(path, operation_id)? {
                return Ok(());
            }
            if start.elapsed() > LOCK_TIMEOUT {
                return Err(Self::timeout_error(path));
            }
            tokio::time::sleep(LOCK_RETRY_INTERVAL).await;
        }
    }


    /// Release a write lock on a file
    pub fn release_write_lock(path: &str, operation_id: &str) -> Result<(), String> {
        let mut locks = FILE_LOCK_MANAGER.locks.lock()
            .map_err(|e| format!("Failed to acquire lock mutex: {}", e))?;
        
        if let Some(lock_state) = locks.get(path) {
            if lock_state.locked_by != operation_id {
                return Err(format!(
                    "Cannot release lock on {}. Locked by {}, attempting to release from {}",
                    path, lock_state.locked_by, operation_id
                ));
            }
            
            locks.remove(path);
            Ok(())
        } else {
            // Lock doesn't exist, this is OK
            Ok(())
        }
    }
    
    /// Check if a file is currently locked
    pub fn is_locked(path: &str) -> Result<bool, String> {
        let locks = FILE_LOCK_MANAGER.locks.lock()
            .map_err(|e| format!("Failed to acquire lock mutex: {}", e))?;
        
        Ok(locks.contains_key(path))
    }
    
    /// Force release all locks (emergency use only)
    pub fn release_all_locks() -> Result<(), String> {
        let mut locks = FILE_LOCK_MANAGER.locks.lock()
            .map_err(|e| format!("Failed to acquire lock mutex: {}", e))?;
        
        let _count = locks.len();
        locks.clear();
        
        Ok(())
    }
}

/// RAII-style lock guard that automatically releases lock when dropped
#[allow(dead_code)]
pub struct FileLockGuard {
    path: String,
    operation_id: String,
}

#[allow(dead_code)]
impl FileLockGuard {
    /// Create a new file lock guard
    pub fn new(path: String, operation_id: String) -> Result<Self, String> {
        FileLock::acquire_write_lock(&path, &operation_id)?;
        Ok(FileLockGuard { path, operation_id })
    }
}

impl Drop for FileLockGuard {
    fn drop(&mut self) {
        let _ = FileLock::release_write_lock(&self.path, &self.operation_id);
    }
}

/// Atomic file write with temp file and rename
/// Prevents partial writes and corruption
#[allow(dead_code)]
pub async fn write_file_atomic(
    path: &str,
    content: &[u8],
) -> Result<(), String> {
    use tokio::fs;
    use tokio::io::AsyncWriteExt;
    
    let temp_path = format!("{}.tmp.{}", path, uuid::Uuid::new_v4());
    
    // Write to temp file first
    let mut file = fs::File::create(&temp_path).await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
        
    file.write_all(content).await
        .map_err(|e| format!("Failed to write to temp file: {}", e))?;
    
    file.sync_all().await
        .map_err(|e| format!("Failed to sync temp file: {}", e))?;
    
    drop(file);
    
    // Atomic rename
    fs::rename(&temp_path, path).await
        .map_err(|e| {
            // Clean up temp file if rename fails
            let _ = std::fs::remove_file(&temp_path);
            format!("Failed to rename temp file: {}", e)
        })?;
    
    Ok(())
}

/// Read file with retry logic for transient errors
#[allow(dead_code)]
pub async fn read_file_with_retry(
    path: &str,
    max_retries: u32,
) -> Result<Vec<u8>, String> {
    use tokio::fs;
    
    let mut attempts = 0;
    let mut last_error = String::new();
    
    while attempts < max_retries {
        match fs::read(path).await {
            Ok(content) => return Ok(content),
            Err(e) => {
                last_error = e.to_string();
                attempts += 1;
                
                if attempts < max_retries {
                    tokio::time::sleep(Duration::from_millis(100 * attempts as u64)).await;
                }
            }
        }
    }
    
    Err(format!("Failed to read file after {} retries: {}", max_retries, last_error))
}

/// Safe file operation wrapper that acquires lock, performs operation, releases lock
#[allow(dead_code)]
pub async fn with_file_lock<F, R>(
    path: &str,
    operation_id: &str,
    operation: F,
) -> Result<R, String>
where
    F: FnOnce() -> Result<R, String>,
{
    let _guard = FileLockGuard::new(path.to_string(), operation_id.to_string())?;
    operation()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_lock_acquire_release() {
        let path = "/test/file.txt";
        let op_id = "test-op-1";
        
        assert!(!FileLock::is_locked(path).unwrap());
        
        FileLock::acquire_write_lock(path, op_id).unwrap();
        assert!(FileLock::is_locked(path).unwrap());
        
        FileLock::release_write_lock(path, op_id).unwrap();
        assert!(!FileLock::is_locked(path).unwrap());
    }
    
    #[test]
    fn test_lock_guard() {
        let path = "/test/file2.txt".to_string();
        let op_id = "test-op-2".to_string();
        
        {
            let _guard = FileLockGuard::new(path.clone(), op_id.clone()).unwrap();
            assert!(FileLock::is_locked(&path).unwrap());
        }
        
        // Lock should be released automatically
        assert!(!FileLock::is_locked(&path).unwrap());
    }
}
