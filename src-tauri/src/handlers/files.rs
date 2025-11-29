use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};

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
fn read_directory_contents(path: &Path) -> futures::future::BoxFuture<'static, Result<Vec<FileEntry>, String>> {
    let path = path.to_path_buf();
    Box::pin(async move {
        read_directory_contents_with_depth(&path, 0).await
    })
}

async fn read_directory_contents_with_depth(path: &Path, depth: usize) -> Result<Vec<FileEntry>, String> {
    // Limit recursion depth to prevent infinite loops
    const MAX_DEPTH: usize = 10;

    // Directories and files to exclude from file tree
    const EXCLUDED_NAMES: &[&str] = &[".lokus", "node_modules", ".git", ".DS_Store"];

    if depth > MAX_DEPTH {
        return Ok(vec![]);
    }

    let mut entries = vec![];
    let mut dir_entries = tokio::fs::read_dir(path).await.map_err(|e| {
        e.to_string()
    })?;

    while let Ok(Some(entry)) = dir_entries.next_entry().await {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        // Skip excluded directories and files
        if EXCLUDED_NAMES.contains(&name.as_str()) {
            continue;
        }

        // Get file type efficiently without full metadata
        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;
        let is_directory = file_type.is_dir();
        
        // Skip symbolic links to prevent infinite loops
        if file_type.is_symlink() {
            continue;
        }

        let children = if is_directory {
            Some(Box::pin(read_directory_contents_with_depth(&path, depth + 1)).await?)
        } else {
            None
        };

        // Skip metadata fetching for performance - set defaults
        let size = 0;
        let created = None;
        let modified = None;

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
    read_directory_contents(Path::new(&workspace_path)).await
}

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
    atomic_write_file(&path, &content)
}

// Atomic write implementation: write to temp file then rename
fn atomic_write_file(path: &str, content: &str) -> Result<(), String> {
    use std::io::Write;

    let target_path = Path::new(path);

    // Pre-write validation: check parent directory exists
    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {}", parent.display()));
        }
    }

    // Create backup if file exists (for rollback)
    let backup_path = if target_path.exists() {
        let backup = format!("{}.backup", path);
        fs::copy(target_path, &backup).ok(); // Best effort - don't fail if backup fails
        Some(backup)
    } else {
        None
    };

    // Write to temporary file first
    let temp_path = format!("{}.tmp", path);
    let write_result = (|| -> Result<(), std::io::Error> {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?; // Ensure data is flushed to disk
        Ok(())
    })();

    match write_result {
        Ok(_) => {
            // Atomic rename: this is the critical operation
            match fs::rename(&temp_path, target_path) {
                Ok(_) => {
                    // Success! Clean up backup
                    if let Some(backup) = backup_path {
                        let _ = fs::remove_file(backup); // Best effort cleanup
                    }
                    Ok(())
                }
                Err(e) => {
                    // Rename failed - clean up temp file and restore backup
                    let _ = fs::remove_file(&temp_path);
                    if let Some(backup) = backup_path {
                        let _ = fs::rename(&backup, target_path); // Attempt rollback
                    }
                    Err(format!("Failed to rename temp file: {}", e))
                }
            }
        }
        Err(e) => {
            // Write to temp failed - clean up
            let _ = fs::remove_file(&temp_path);
            if let Some(backup) = backup_path {
                let _ = fs::remove_file(backup);
            }
            Err(format!("Failed to write to temp file: {}", e))
        }
    }
}

// Separate command for saving versions - only called when needed
#[tauri::command]
pub fn save_file_version_manual(path: String, content: String) -> Result<(), String> {
    save_file_version(&path, &content)
}

// Helper function to save file version
fn save_file_version(file_path: &str, content: &str) -> Result<(), String> {
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
    ).map(|_| ())
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

    let path = PathBuf::from(&path);

    // Validate that the source file exists
    if !path.exists() {
        return Err(format!("File or folder '{}' does not exist", path.display()));
    }

    // Validate new name is not empty
    if new_name.trim().is_empty() {
        return Err("New name cannot be empty".to_string());
    }

    let mut new_path = path.clone();
    new_path.set_file_name(new_name.trim());

    // Check if destination already exists
    if new_path.exists() {
        return Err(format!("A file or folder named '{}' already exists", new_path.file_name().unwrap().to_string_lossy()));
    }

    fs::rename(&path, &new_path).map_err(|e| {
        format!("Failed to rename: {}", e)
    })?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_file_in_workspace(workspace_path: String, name: String) -> Result<String, String> {
    let path = Path::new(&workspace_path).join(&name);
    let path_str = path.to_string_lossy().to_string();
    atomic_write_file(&path_str, "")?;
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
            Err(e) => {
                eprintln!("Failed to copy {}: {}", file_path, e);
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
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Alias for write_file_content for consistency with importers
    atomic_write_file(&path, &content)
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
                Err(e) => {
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
