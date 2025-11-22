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
fn read_directory_contents(path: &Path) -> Result<Vec<FileEntry>, String> {
    read_directory_contents_with_depth(path, 0)
}

fn read_directory_contents_with_depth(path: &Path, depth: usize) -> Result<Vec<FileEntry>, String> {
    // Limit recursion depth to prevent infinite loops
    const MAX_DEPTH: usize = 10;

    // Directories and files to exclude from file tree
    const EXCLUDED_NAMES: &[&str] = &[".lokus", "node_modules", ".git", ".DS_Store"];

    if depth > MAX_DEPTH {
        println!("[Backend] Max depth {} reached, stopping recursion at path: {:?}", MAX_DEPTH, path);
        return Ok(vec![]);
    }

    let mut entries = vec![];
    let dir_entries = fs::read_dir(path).map_err(|e| {
        println!("[Backend] Error reading directory {:?}: {}", path, e);
        e.to_string()
    })?;

    for entry in dir_entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let is_directory = path.is_dir();

        // Skip excluded directories and files
        if EXCLUDED_NAMES.contains(&name.as_str()) {
            println!("[Backend] Skipping excluded entry: {}", name);
            continue;
        }

        // Skip symbolic links to prevent infinite loops
        if path.symlink_metadata().map(|m| m.file_type().is_symlink()).unwrap_or(false) {
            println!("[Backend] Skipping symlink: {:?}", path);
            continue;
        }

        let children = if is_directory {
            Some(read_directory_contents_with_depth(&path, depth + 1)?)
        } else {
            None
        };

        // Get file metadata
        let metadata = fs::metadata(&path).ok();
        let size = metadata.as_ref().and_then(|m| if !is_directory { Some(m.len()) } else { None }).unwrap_or(0);
        let created = metadata.as_ref().and_then(|m|
            m.created().ok().and_then(|t|
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs() as i64)
            )
        );
        let modified = metadata.as_ref().and_then(|m|
            m.modified().ok().and_then(|t|
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs() as i64)
            )
        );

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
pub fn read_workspace_files(workspace_path: String) -> Result<Vec<FileEntry>, String> {
    println!("[Backend] read_workspace_files called with path: {}", workspace_path);
    let result = read_directory_contents(Path::new(&workspace_path));
    match &result {
        Ok(files) => println!("[Backend] Successfully read {} files/folders", files.len()),
        Err(e) => println!("[Backend] Error reading workspace files: {}", e),
    }
    result
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
    // Write the file first
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(())
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
    println!("[Backend] rename_file called: {} -> {}", path, new_name);

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

    println!("[Backend] Renaming: {:?} -> {:?}", path, new_path);
    fs::rename(&path, &new_path).map_err(|e| {
        eprintln!("[Backend] Rename failed: {}", e);
        format!("Failed to rename: {}", e)
    })?;

    println!("[Backend] Rename successful");
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_file_in_workspace(workspace_path: String, name: String) -> Result<String, String> {
    let path = Path::new(&workspace_path).join(&name);
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_folder_in_workspace(workspace_path: String, name: String) -> Result<(), String> {
    let path = Path::new(&workspace_path).join(name);
    fs::create_dir(path).map_err(|e| e.to_string())?;
    Ok(())
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
