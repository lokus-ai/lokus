use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::note_engine::identity::rename_path_case_safe;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
    created: Option<i64>,
    modified: Option<i64>,
    children: Option<Vec<FileEntry>>,
}

// --- Private Helper ---

/// Walk a workspace directory tree.
///
/// Synchronous on purpose. The async version awaited four times per entry
/// (`read_dir`, `next_entry`, `file_type`, `metadata`), and on macOS each of
/// those metadata calls is a dispatch onto tokio's blocking pool — so a vault
/// with a few thousand files paid several thousand thread hand-offs just to
/// list itself. Running the whole walk inside ONE `spawn_blocking` keeps it
/// off the UI thread while doing the stats back-to-back on a single thread.
fn walk_directory(path: &Path, depth: usize) -> Result<Vec<FileEntry>, String> {
    // Limit recursion depth to prevent infinite loops
    const MAX_DEPTH: usize = 10;

    // Directories and files to exclude from file tree
    const EXCLUDED_NAMES: &[&str] = &[".lokus", "node_modules", ".git", ".DS_Store"];

    if depth > MAX_DEPTH {
        return Ok(vec![]);
    }

    let mut entries = vec![];
    let dir_entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in dir_entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip excluded directories and files
        if EXCLUDED_NAMES.contains(&name.as_str()) {
            continue;
        }

        // `file_type()` is answered from the readdir record on macOS and Linux,
        // so this costs no extra syscall.
        let Ok(file_type) = entry.file_type() else { continue };

        // Skip symbolic links to prevent infinite loops
        if file_type.is_symlink() {
            continue;
        }

        let is_directory = file_type.is_dir();

        let children = if is_directory {
            Some(walk_directory(&path, depth + 1)?)
        } else {
            None
        };

        // Real size + mtime for files. These used to be hardcoded to 0/None
        // "for performance", which cost far more than the stat it saved: the
        // sync cache compares the mtime+size it stored against these, so it
        // never registered a hit and re-read + re-hashed the whole vault every
        // five minutes. The MAX_FILE_SIZE guard downstream was dead for the
        // same reason (`0 > limit` is never true).
        //
        // Directories are skipped — nothing reads a directory's size, and it
        // is one stat per folder that buys nothing.
        let (size, created, modified) = if is_directory {
            (0, None, None)
        } else {
            match entry.metadata() {
                Ok(meta) => {
                    let to_secs = |t: std::io::Result<std::time::SystemTime>| {
                        t.ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                    };
                    (meta.len(), to_secs(meta.created()), to_secs(meta.modified()))
                }
                Err(_) => (0, None, None),
            }
        };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_directory,
            size,
            created,
            modified,
            children,
        });
    }

    entries.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then_with(|| a.name.cmp(&b.name)));
    Ok(entries)
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn read_workspace_files(workspace_path: String) -> Result<Vec<FileEntry>, String> {
    tokio::task::spawn_blocking(move || walk_directory(Path::new(&workspace_path), 0))
        .await
        .map_err(|e| format!("Directory walk failed: {}", e))?
}

/// Maximum size for a file loaded into the text editor. Larger files are refused
/// with a descriptive error instead of being read into memory / the webview.
const MAX_EDITOR_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    use tokio::io::AsyncReadExt;

    // Guard 1: refuse files larger than 10 MB before reading them in.
    if let Ok(meta) = tokio::fs::metadata(&path).await {
        if meta.len() > MAX_EDITOR_FILE_SIZE {
            return Err(format!(
                "FILE_TOO_LARGE: {} is {:.1} MB, which exceeds the {} MB editor limit.",
                path,
                meta.len() as f64 / (1024.0 * 1024.0),
                MAX_EDITOR_FILE_SIZE / (1024 * 1024)
            ));
        }
    }

    // Guard 2: binary heuristic — a NUL byte in the first 8 KB means this is not text.
    // (read_to_string only rejects invalid UTF-8; NUL is valid UTF-8, so binary blobs
    // full of NULs would otherwise load as garbage into the editor.)
    if let Ok(mut file) = tokio::fs::File::open(&path).await {
        let mut probe = [0u8; 8192];
        if let Ok(n) = file.read(&mut probe).await {
            if probe[..n].contains(&0) {
                return Err(format!(
                    "BINARY_FILE: {} appears to be a binary file (NUL byte detected); it cannot be opened in the text editor.",
                    path
                ));
            }
        }
    }

    tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

/// Save a file.
///
/// `async` is load-bearing: a non-`async` `#[tauri::command]` body is dispatched
/// on the main thread, so on macOS the fsync below would block the UI for the
/// whole duration of the write on every save.
#[tauri::command]
pub async fn write_file_content(path: String, content: String) -> Result<(), String> {
    atomic_write_file(&path, &content).await
}

// Atomic write implementation: write to temp file then rename
async fn atomic_write_file(path: &str, content: &str) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;

    let target_path = Path::new(path);

    // Pre-write validation: check parent directory exists
    if let Some(parent) = target_path.parent() {
        if !tokio::fs::try_exists(parent).await.unwrap_or(false) {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Write to a temp file, then rename over the target. rename(2) within a
    // directory is atomic, so the original file is either fully replaced or
    // untouched — there is no torn state for a `.backup` copy to roll back to.
    // Making one was doubling the bytes written on every single save.
    let temp_path = format!("{}.tmp", path);
    let write_result = async {
        let mut file = tokio::fs::File::create(&temp_path).await?;
        file.write_all(content.as_bytes()).await?;
        file.sync_all().await?; // Ensure data is flushed to disk
        Ok::<(), std::io::Error>(())
    }.await;

    if let Err(e) = write_result {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!("Failed to write to temp file: {}", e));
    }

    match tokio::fs::rename(&temp_path, target_path).await {
        Ok(_) => Ok(()),
        Err(e) => {
            let _ = tokio::fs::remove_file(&temp_path).await;
            Err(format!("Failed to rename temp file: {}", e))
        }
    }
}

// Separate command for saving versions - only called when needed
#[tauri::command]
pub async fn save_file_version_manual(path: String, content: String) -> Result<(), String> {
    save_file_version(&path, &content).await
}

// Helper function to save file version
async fn save_file_version(file_path: &str, content: &str) -> Result<(), String> {
    let path = Path::new(file_path);

    // Find workspace root by looking for .lokus directory
    let workspace_root = find_workspace_root(path)?;

    // Get relative path from workspace root
    let relative_path = path.strip_prefix(&workspace_root)
        .map_err(|_| "Failed to get relative path")?
        .to_string_lossy()
        .to_string();

    // Save version using the version_history module
    let workspace_path = workspace_root.to_string_lossy().to_string();
    super::version_history::save_version(
        workspace_path,
        relative_path,
        content.to_string(),
        Some("auto_save".to_string()),
    ).await.map(|_| ())
}

// Helper function to find workspace root containing .lokus directory
fn find_workspace_root(start_path: &Path) -> Result<PathBuf, String> {
    let mut current = start_path;

    // If the path is a file, start from its parent
    if current.is_file() {
        current = current.parent().ok_or("Cannot find parent directory")?;
    }

    // Traverse up the directory tree looking for .lokus
    while let Some(parent) = current.parent() {
        let lokus_dir = current.join(".lokus");
        if lokus_dir.exists() && lokus_dir.is_dir() {
            return Ok(current.to_path_buf());
        }
        current = parent;
    }

    // Check the root level
    let lokus_dir = current.join(".lokus");
    if lokus_dir.exists() && lokus_dir.is_dir() {
        return Ok(current.to_path_buf());
    }

    Err("Workspace root not found (no .lokus directory)".to_string())
}

#[tauri::command]
pub fn rename_file(path: String, new_name: String) -> Result<String, String> {
    let new_path = rename_path_case_safe(Path::new(&path), &new_name)?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_file_in_workspace(workspace_path: String, name: String) -> Result<String, String> {
    let path = Path::new(&workspace_path).join(&name);
    let path_str = path.to_string_lossy().to_string();
    atomic_write_file(&path_str, "").await?;
    Ok(path_str)
}

#[tauri::command]
pub fn create_folder_in_workspace(workspace_path: String, name: String) -> Result<(), String> {
    let path = Path::new(&workspace_path).join(name);
    fs::create_dir(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct CopyFilesResult {
    success: Vec<String>,
    failed: Vec<String>,
    skipped: Vec<String>,
}

// Helper: Recursive directory copy
async fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    tokio::fs::create_dir_all(dst).await?;

    let mut entries = tokio::fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            Box::pin(copy_dir_recursive(&src_path, &dst_path)).await?;
        } else {
            tokio::fs::copy(&src_path, &dst_path).await?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn copy_external_files_to_workspace(
    file_paths: Vec<String>,
    workspace_path: String,
    target_folder: Option<String>,
) -> Result<CopyFilesResult, String> {
    let mut result = CopyFilesResult {
        success: vec![],
        failed: vec![],
        skipped: vec![],
    };

    let destination = if let Some(folder) = target_folder {
        PathBuf::from(&folder)
    } else {
        PathBuf::from(&workspace_path)
    };

    // Ensure destination exists
    if !destination.exists() {
        return Err(format!("Destination folder does not exist: {:?}", destination));
    }

    for file_path in file_paths {
        let source = Path::new(&file_path);

        // Skip if source doesn't exist
        if !source.exists() {
            result.skipped.push(file_path.clone());
            continue;
        }

        let file_name = source.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        // Handle naming conflicts: file.png -> file-1.png -> file-2.png
        let mut target_path = destination.join(file_name);
        let mut counter = 1;

        while target_path.exists() {
            let stem = source.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let extension = source.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");

            let new_name = if extension.is_empty() {
                format!("{}-{}", stem, counter)
            } else {
                format!("{}-{}.{}", stem, counter, extension)
            };

            target_path = destination.join(new_name);
            counter += 1;

            // Safety: prevent infinite loop
            if counter > 1000 {
                result.failed.push(file_path.clone());
                break;
            }
        }

        // Copy file or directory recursively
        match if source.is_dir() {
            copy_dir_recursive(source, &target_path).await
        } else {
            tokio::fs::copy(source, &target_path).await.map(|_| ())
        } {
            Ok(_) => result.success.push(target_path.to_string_lossy().to_string()),
            Err(_) => {
                result.failed.push(file_path);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn move_file(source_path: String, destination_dir: String) -> Result<(), String> {
    let source = PathBuf::from(&source_path);
    let dest_dir = PathBuf::from(&destination_dir);

    let file_name = source.file_name().ok_or("Invalid source path")?;
    let final_dest = dest_dir.join(file_name);

    // Check if the destination already exists
    if final_dest.exists() {
        return Err("A file with that name already exists in the destination folder.".to_string());
    }

    fs::rename(&source, &final_dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    // Use platform abstraction for better error handling and consistency
    super::platform_files::platform_reveal_in_file_manager(path)
}

#[tauri::command]
pub fn open_terminal(path: String) -> Result<(), String> {
    // Use platform abstraction for better error handling and consistency
    super::platform_files::platform_open_terminal(path)
}

#[tauri::command]
pub fn read_image_file(path: String) -> Result<String, String> {
    // Read the file as binary
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;

    // Convert to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_string = general_purpose::STANDARD.encode(&bytes);

    // Determine MIME type from extension
    let mime_type = match Path::new(&path).extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    };

    // Return data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_string))
}

// --- Import/Migration Helper Commands ---

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DirectoryEntry {
    pub name: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result = vec![];

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let is_dir = path.is_dir();

        result.push(DirectoryEntry { name, is_dir });
    }

    Ok(result)
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    // Alias for write_file_content for consistency with importers
    atomic_write_file(&path, &content).await
}

#[tauri::command]
pub fn create_directory(path: String, recursive: bool) -> Result<(), String> {
    let path = Path::new(&path);
    if recursive {
        fs::create_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::create_dir(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn read_all_files(paths: Vec<String>) -> Result<std::collections::HashMap<String, String>, String> {
    use futures::future::join_all;
    use tokio::fs;


    let futures: Vec<_> = paths.into_iter().map(|path| {
        let path_clone = path.clone();
        async move {
            match fs::read_to_string(&path).await {
                Ok(content) => Some((path_clone, content)),
                Err(_e) => {
                    None
                }
            }
        }
    }).collect();

    let results = join_all(futures).await;

    let mut file_map = std::collections::HashMap::new();
    for result in results {
        if let Some((path, content)) = result {
            file_map.insert(path, content);
        }
    }

    Ok(file_map)
}

#[tauri::command]
pub async fn write_binary_file(path: String, content: Vec<u8>) -> Result<(), String> {
    use std::io::Write;

    let file_path = std::path::Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Atomic write: temp file + rename
    let temp_path = file_path.with_extension("tmp_sync");
    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(&content)
        .map_err(|e| format!("Failed to write content: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync file: {}", e))?;

    std::fs::rename(&temp_path, file_path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn find_workspace_images(workspace_path: String) -> Result<Vec<String>, String> {
    const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];

    let workspace = Path::new(&workspace_path);

    if !workspace.exists() {
        return Err("Workspace path does not exist".to_string());
    }

    let mut image_files = Vec::new();

    fn find_images_recursive(dir: &Path, image_files: &mut Vec<String>) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and common excluded directories
            if file_name.starts_with('.') || file_name == "node_modules" {
                continue;
            }

            if path.is_dir() {
                find_images_recursive(&path, image_files)?;
            } else if let Some(ext) = path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if IMAGE_EXTENSIONS.contains(&ext_lower.as_str()) {
                    if let Some(path_str) = path.to_str() {
                        image_files.push(path_str.to_string());
                    }
                }
            }
        }

        Ok(())
    }

    find_images_recursive(workspace, &mut image_files)
        .map_err(|e| format!("Failed to scan directory: {}", e))?;

    Ok(image_files)
}
