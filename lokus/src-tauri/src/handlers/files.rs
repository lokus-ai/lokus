use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn read_workspace_files(workspace_path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = vec![];
    let path = Path::new(&workspace_path);

    if path.is_dir() {
        for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let is_directory = path.is_dir();

            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory,
                children: if is_directory { Some(vec![]) } else { None },
            });
        }
    }
    entries.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then_with(|| a.name.cmp(&b.name)));
    Ok(entries)
}