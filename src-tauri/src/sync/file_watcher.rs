use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, error};

/// File change event that gets emitted by the file watcher
#[derive(Debug, Clone)]
pub struct FileChangeEvent {
    pub path: PathBuf,
    pub kind: FileChangeKind,
}

/// Types of file changes we track
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed { from: PathBuf },
}

/// File watcher that monitors workspace directory for changes
pub struct FileWatcher {
    #[allow(dead_code)]
    debouncer: Debouncer<RecommendedWatcher, FileIdMap>,
    receiver: mpsc::UnboundedReceiver<FileChangeEvent>,
}

impl FileWatcher {
    /// Create a new file watcher for the given workspace path
    ///
    /// # Arguments
    /// * `workspace_path` - Root directory to watch
    ///
    /// # Returns
    /// * `Result<Self, String>` - FileWatcher instance or error message
    pub fn new(workspace_path: impl AsRef<Path>) -> Result<Self, String> {
        let workspace_path = workspace_path.as_ref().to_path_buf();

        // Create channel for file change events
        let (tx, rx) = mpsc::unbounded_channel();

        // Create debouncer with 500ms delay
        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events {
                            // Get the first path from the event
                            if let Some(path) = event.event.paths.first() {
                                // Filter out events for excluded paths
                                if Self::should_exclude_path(path) {
                                    continue;
                                }

                                // Convert notify event to our FileChangeEvent
                                if let Some(change_event) = Self::convert_event(event) {
                                    if let Err(e) = tx.send(change_event) {
                                        error!("Failed to send file change event: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors {
                            error!("File watcher error: {:?}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // Start watching the workspace directory
        debouncer
            .watcher()
            .watch(&workspace_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        debug!("File watcher started for: {:?}", workspace_path);

        Ok(Self {
            debouncer,
            receiver: rx,
        })
    }

    /// Receive the next file change event
    /// Returns None when the watcher is closed
    pub async fn next_event(&mut self) -> Option<FileChangeEvent> {
        self.receiver.recv().await
    }

    /// Check if a path should be excluded from watching
    fn should_exclude_path(path: &Path) -> bool {
        // Directories and files to exclude (matches pattern from handlers/files.rs:29)
        const EXCLUDED_NAMES: &[&str] = &[".lokus", "node_modules", ".git", ".DS_Store"];

        // Check each component of the path
        for component in path.components() {
            if let Some(name) = component.as_os_str().to_str() {
                if EXCLUDED_NAMES.contains(&name) {
                    return true;
                }

                // Also exclude hidden files and temp files
                if name.starts_with('.') && name != "." && name != ".." {
                    // Allow certain hidden files like .gitignore
                    if !matches!(name, ".gitignore" | ".gitattributes") {
                        return true;
                    }
                }

                // Exclude temporary files
                if name.ends_with(".tmp") || name.ends_with(".backup") || name.ends_with('~') {
                    return true;
                }
            }
        }

        false
    }

    /// Convert notify event to our FileChangeEvent
    fn convert_event(event: notify_debouncer_full::DebouncedEvent) -> Option<FileChangeEvent> {
        use notify::EventKind;

        // Get the first path from the event paths
        let path = event.event.paths.first()?.clone();

        let kind = match event.event.kind {
            EventKind::Create(_) => FileChangeKind::Created,
            EventKind::Modify(_) if event.event.paths.len() > 1 => {
                // Multiple paths indicates a rename
                FileChangeKind::Renamed { from: event.event.paths[0].clone() }
            }
            EventKind::Modify(_) => FileChangeKind::Modified,
            EventKind::Remove(_) => FileChangeKind::Deleted,
            EventKind::Access(_) | EventKind::Other | EventKind::Any => {
                // Ignore access events and unknown events
                return None;
            }
        };

        Some(FileChangeEvent { path, kind })
    }
}

/// Helper to create a file watcher and return a stream of events
pub fn watch_workspace(
    workspace_path: impl AsRef<Path>,
) -> Result<FileWatcher, String> {
    FileWatcher::new(workspace_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_should_exclude_path() {
        assert!(FileWatcher::should_exclude_path(Path::new("/workspace/.lokus/data")));
        assert!(FileWatcher::should_exclude_path(Path::new("/workspace/node_modules/package")));
        assert!(FileWatcher::should_exclude_path(Path::new("/workspace/.git/config")));
        assert!(FileWatcher::should_exclude_path(Path::new("/workspace/.DS_Store")));
        assert!(FileWatcher::should_exclude_path(Path::new("/workspace/file.tmp")));
        assert!(FileWatcher::should_exclude_path(Path::new("/workspace/file.backup")));

        // These should NOT be excluded
        assert!(!FileWatcher::should_exclude_path(Path::new("/workspace/file.txt")));
        assert!(!FileWatcher::should_exclude_path(Path::new("/workspace/.gitignore")));
        assert!(!FileWatcher::should_exclude_path(Path::new("/workspace/folder/file.md")));
    }

    #[tokio::test]
    async fn test_file_watcher_creation() {
        let temp_dir = TempDir::new().unwrap();
        let result = FileWatcher::new(temp_dir.path());
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_file_watcher_detects_changes() {
        let temp_dir = TempDir::new().unwrap();
        let mut watcher = FileWatcher::new(temp_dir.path()).unwrap();

        // Create a test file
        let test_file = temp_dir.path().join("test.txt");
        fs::write(&test_file, "test content").unwrap();

        // Wait for event with timeout
        let event = tokio::time::timeout(
            Duration::from_secs(2),
            watcher.next_event()
        ).await;

        assert!(event.is_ok());
        if let Ok(Some(change_event)) = event {
            assert_eq!(change_event.kind, FileChangeKind::Created);
            assert!(change_event.path.ends_with("test.txt"));
        }
    }
}
