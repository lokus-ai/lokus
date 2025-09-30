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
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_file(path: String, new_name: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let mut new_path = path.clone();
    new_path.set_file_name(new_name);
    fs::rename(&path, &new_path).map_err(|e| e.to_string())?;
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
