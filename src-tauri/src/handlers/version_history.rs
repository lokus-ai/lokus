use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::io::{Read, Write};
use chrono::{DateTime, Utc};
use flate2::Compression;
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileVersion {
    pub timestamp: String,
    pub size: u64,
    pub lines: usize,
    pub action: String,
    pub preview: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VersionMetadata {
    pub file: String,
    pub versions: Vec<FileVersion>,
    pub settings: VersionSettings,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VersionSettings {
    pub max_versions: usize,
    pub retention_days: i64,
}

impl Default for VersionSettings {
    fn default() -> Self {
        VersionSettings {
            max_versions: 50,
            retention_days: 30,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiffLine {
    pub line_number_old: Option<usize>,
    pub line_number_new: Option<usize>,
    pub content: String,
    pub change_type: String, // "add", "delete", "unchanged"
}

// --- Helper Functions ---

fn get_backups_dir(workspace_path: &Path, file_path: &str) -> Result<PathBuf, String> {
    let file_name = Path::new(file_path)
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .to_string();

    let backups_dir = workspace_path
        .join(".lokus")
        .join("backups")
        .join(file_name);

    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    Ok(backups_dir)
}

fn get_metadata_path(backups_dir: &Path) -> PathBuf {
    backups_dir.join("metadata.json")
}

fn load_metadata(backups_dir: &Path) -> VersionMetadata {
    let metadata_path = get_metadata_path(backups_dir);

    if metadata_path.exists() {
        match fs::read_to_string(&metadata_path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(metadata) => return metadata,
                Err(_) => ,
            },
            Err(_) => ,
        }
    }

    // Return default metadata
    VersionMetadata {
        file: String::new(),
        versions: Vec::new(),
        settings: VersionSettings::default(),
    }
}

fn save_metadata(backups_dir: &Path, metadata: &VersionMetadata) -> Result<(), String> {
    let metadata_path = get_metadata_path(backups_dir);
    let json = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    fs::write(&metadata_path, json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    Ok(())
}

fn create_preview(content: &str, max_chars: usize) -> String {
    let preview: String = content.chars().take(max_chars).collect();
    if content.len() > max_chars {
        format!("{}...", preview)
    } else {
        preview
    }
}

// Compress content using gzip
fn compress_content(content: &str) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to compress: {}", e))?;
    encoder.finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))
}

// Decompress content from gzip
fn decompress_content(compressed: &[u8]) -> Result<String, String> {
    let mut decoder = GzDecoder::new(compressed);
    let mut decompressed = String::new();
    decoder.read_to_string(&mut decompressed)
        .map_err(|e| format!("Failed to decompress: {}", e))?;
    Ok(decompressed)
}

// --- Tauri Commands ---

#[tauri::command]
pub fn save_version(
    workspace_path: String,
    file_path: String,
    content: String,
    action: Option<String>,
) -> Result<FileVersion, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path)?;

    // Generate timestamp-based filename
    let timestamp = Utc::now();
    let timestamp_str = timestamp.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
    let version_path = backups_dir.join(format!("{}.md.gz", timestamp_str));

    // Compress and save version file
    let compressed = compress_content(&content)?;
    fs::write(&version_path, &compressed)
        .map_err(|e| format!("Failed to save version: {}", e))?;


    // Create version info
    let version = FileVersion {
        timestamp: timestamp.to_rfc3339(),
        size: content.len() as u64,
        lines: content.lines().count(),
        action: action.unwrap_or_else(|| "auto_save".to_string()),
        preview: create_preview(&content, 200),
    };

    // Load metadata and add version
    let mut metadata = load_metadata(&backups_dir);
    metadata.file = file_path.clone();
    metadata.versions.push(version.clone());

    // Cleanup old versions if needed
    cleanup_old_versions_internal(&mut metadata, &backups_dir)?;

    // Save updated metadata
    save_metadata(&backups_dir, &metadata)?;

    Ok(version)
}

#[tauri::command]
pub fn get_file_versions(
    workspace_path: String,
    file_path: String,
) -> Result<Vec<FileVersion>, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path)?;

    let metadata = load_metadata(&backups_dir);
    Ok(metadata.versions)
}

#[tauri::command]
pub fn get_version_content(
    workspace_path: String,
    file_path: String,
    timestamp: String,
) -> Result<String, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path)?;

    // Parse timestamp and find file
    let dt = DateTime::parse_from_rfc3339(&timestamp)
        .map_err(|e| format!("Invalid timestamp: {}", e))?;
    let formatted = dt.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
    let version_path = backups_dir.join(format!("{}.md.gz", formatted));

    if !version_path.exists() {
        return Err("Version file not found".to_string());
    }

    // Read and decompress version file
    let compressed = fs::read(&version_path)
        .map_err(|e| format!("Failed to read version: {}", e))?;
    decompress_content(&compressed)
}

#[tauri::command]
pub fn get_diff(
    workspace_path: String,
    file_path: String,
    timestamp1: String,
    timestamp2: String,
) -> Result<Vec<DiffLine>, String> {

    let content1 = get_version_content(workspace_path.clone(), file_path.clone(), timestamp1)?;
    let content2 = get_version_content(workspace_path, file_path, timestamp2)?;

    // Simple line-by-line diff
    let lines1: Vec<&str> = content1.lines().collect();
    let lines2: Vec<&str> = content2.lines().collect();

    let mut diff_lines = Vec::new();
    let mut i = 0;
    let mut j = 0;

    while i < lines1.len() || j < lines2.len() {
        if i < lines1.len() && j < lines2.len() && lines1[i] == lines2[j] {
            // Unchanged line
            diff_lines.push(DiffLine {
                line_number_old: Some(i + 1),
                line_number_new: Some(j + 1),
                content: lines1[i].to_string(),
                change_type: "unchanged".to_string(),
            });
            i += 1;
            j += 1;
        } else if j < lines2.len() && (i >= lines1.len() || lines1[i] != lines2[j]) {
            // Added line
            diff_lines.push(DiffLine {
                line_number_old: None,
                line_number_new: Some(j + 1),
                content: lines2[j].to_string(),
                change_type: "add".to_string(),
            });
            j += 1;
        } else if i < lines1.len() {
            // Deleted line
            diff_lines.push(DiffLine {
                line_number_old: Some(i + 1),
                line_number_new: None,
                content: lines1[i].to_string(),
                change_type: "delete".to_string(),
            });
            i += 1;
        }
    }

    Ok(diff_lines)
}

#[tauri::command]
pub fn restore_version(
    workspace_path: String,
    file_path: String,
    timestamp: String,
) -> Result<String, String> {

    let content = get_version_content(workspace_path.clone(), file_path.clone(), timestamp.clone())?;

    // Write content back to original file
    let full_path = Path::new(&workspace_path).join(&file_path);
    fs::write(&full_path, &content)
        .map_err(|e| format!("Failed to restore version: {}", e))?;

    // Save a new version with "restore" action
    save_version(
        workspace_path,
        file_path,
        content.clone(),
        Some(format!("Restored from {}", timestamp)),
    )?;

    Ok(content)
}

#[tauri::command]
pub fn cleanup_old_versions(
    workspace_path: String,
    file_path: String,
) -> Result<usize, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path)?;

    let mut metadata = load_metadata(&backups_dir);
    let removed = cleanup_old_versions_internal(&mut metadata, &backups_dir)?;
    save_metadata(&backups_dir, &metadata)?;

    Ok(removed)
}

fn cleanup_old_versions_internal(
    metadata: &mut VersionMetadata,
    backups_dir: &Path,
) -> Result<usize, String> {
    let max_versions = metadata.settings.max_versions;
    let retention_days = metadata.settings.retention_days;
    let now = Utc::now();

    let mut removed = 0;

    // Sort versions by timestamp (newest first)
    metadata.versions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    // Keep only max_versions most recent
    if metadata.versions.len() > max_versions {
        let to_remove = metadata.versions.split_off(max_versions);
        for version in &to_remove {
            if let Ok(dt) = DateTime::parse_from_rfc3339(&version.timestamp) {
                let formatted = dt.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
                let version_path = backups_dir.join(format!("{}.md.gz", formatted));
                if version_path.exists() {
                    let _ = fs::remove_file(version_path);
                    removed += 1;
                }
            }
        }
    }

    // Remove versions older than retention_days
    metadata.versions.retain(|version| {
        if let Ok(dt) = DateTime::parse_from_rfc3339(&version.timestamp) {
            let age_days = (now - dt.with_timezone(&Utc)).num_days();
            if age_days > retention_days {
                let formatted = dt.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
                let version_path = backups_dir.join(format!("{}.md.gz", formatted));
                if version_path.exists() {
                    let _ = fs::remove_file(version_path);
                    removed += 1;
                }
                false
            } else {
                true
            }
        } else {
            true
        }
    });

    Ok(removed)
}
