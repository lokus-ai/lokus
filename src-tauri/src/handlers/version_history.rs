use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::io::{Read, Write};
use chrono::{DateTime, Utc};
use flate2::Compression;
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use rand::Rng;
use crate::file_locking::FileLock;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileVersion {
    pub timestamp: String,
    pub size: u64,
    pub lines: usize,
    pub action: String,
    pub preview: String,
    /// Name of the .md.gz blob backing this version.
    ///
    /// Versions are written as `{timestamp}-{random}.md.gz` so two saves in the
    /// same millisecond can't collide, but lookup and cleanup used to rebuild
    /// the name as `{timestamp}.md.gz` — which matched nothing. Restores failed
    /// and no blob was ever deleted, so `.lokus/backups` grew without bound.
    /// Recording the real name makes both exact; `None` means a pre-fix entry,
    /// which we resolve by prefix instead.
    #[serde(default)]
    pub file: Option<String>,
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

async fn get_backups_dir(workspace_path: &Path, file_path: &str) -> Result<PathBuf, String> {
    let file_name = Path::new(file_path)
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .to_string();

    let backups_dir = workspace_path
        .join(".lokus")
        .join("backups")
        .join(file_name);

    tokio::fs::create_dir_all(&backups_dir).await
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    Ok(backups_dir)
}

/// The on-disk blob for a version, or `None` if it has gone missing.
///
/// New entries carry their filename. Entries written before that field existed
/// are found by scanning for the `{timestamp}` prefix, which is what the random
/// collision suffix is appended to.
async fn resolve_version_path(backups_dir: &Path, version: &FileVersion) -> Option<PathBuf> {
    if let Some(name) = &version.file {
        let path = backups_dir.join(name);
        return if path.exists() { Some(path) } else { None };
    }

    let dt = DateTime::parse_from_rfc3339(&version.timestamp).ok()?;
    let prefix = dt.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();

    let mut dir = tokio::fs::read_dir(backups_dir).await.ok()?;
    while let Ok(Some(entry)) = dir.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) && name.ends_with(".md.gz") {
            return Some(entry.path());
        }
    }
    None
}

fn get_metadata_path(backups_dir: &Path) -> PathBuf {
    backups_dir.join("metadata.json")
}

async fn load_metadata(backups_dir: &Path) -> VersionMetadata {
    let metadata_path = get_metadata_path(backups_dir);

    if let Ok(content) = tokio::fs::read_to_string(&metadata_path).await {
        if let Ok(metadata) = serde_json::from_str(&content) {
            return metadata;
        }
    }

    // Return default metadata
    VersionMetadata {
        file: String::new(),
        versions: Vec::new(),
        settings: VersionSettings::default(),
    }
}

async fn save_metadata(backups_dir: &Path, metadata: &VersionMetadata) -> Result<(), String> {
    let metadata_path = get_metadata_path(backups_dir);
    let json = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    tokio::fs::write(&metadata_path, json).await
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
pub async fn save_version(
    workspace_path: String,
    file_path: String,
    content: String,
    action: Option<String>,
) -> Result<FileVersion, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path).await?;

    // Generate timestamp-based filename with random suffix to prevent collisions
    let timestamp = Utc::now();
    let timestamp_str = timestamp.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
    let random_suffix: u16 = rand::thread_rng().gen();
    let version_name = format!("{}-{:04x}.md.gz", timestamp_str, random_suffix);
    let version_path = backups_dir.join(&version_name);

    // gzip is CPU-bound and content can be up to the 10 MB editor limit, so it
    // goes to the blocking pool rather than stalling an async worker.
    let to_compress = content.clone();
    let compressed = tokio::task::spawn_blocking(move || compress_content(&to_compress))
        .await
        .map_err(|e| format!("Compression task failed: {}", e))??;

    tokio::fs::write(&version_path, &compressed).await
        .map_err(|e| format!("Failed to save version: {}", e))?;

    // Create version info
    let version = FileVersion {
        timestamp: timestamp.to_rfc3339(),
        size: content.len() as u64,
        lines: content.lines().count(),
        action: action.unwrap_or_else(|| "auto_save".to_string()),
        preview: create_preview(&content, 200),
        file: Some(version_name),
    };

    // Load metadata and add version (protected by file lock)
    let metadata_path = backups_dir.join("metadata.json").to_string_lossy().to_string();
    let op_id = format!("save_version_{}", timestamp_str);

    FileLock::acquire_write_lock_async(&metadata_path, &op_id).await
        .map_err(|e| format!("Failed to acquire metadata lock: {}", e))?;

    let mut metadata = load_metadata(&backups_dir).await;
    metadata.file = file_path.clone();
    metadata.versions.push(version.clone());
    let result = async {
        cleanup_old_versions_internal(&mut metadata, &backups_dir).await?;
        save_metadata(&backups_dir, &metadata).await
    }.await;

    let _ = FileLock::release_write_lock(&metadata_path, &op_id);
    result?;

    Ok(version)
}

#[tauri::command]
pub async fn get_file_versions(
    workspace_path: String,
    file_path: String,
) -> Result<Vec<FileVersion>, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path).await?;

    let metadata = load_metadata(&backups_dir).await;
    Ok(metadata.versions)
}

#[tauri::command]
pub async fn get_version_content(
    workspace_path: String,
    file_path: String,
    timestamp: String,
) -> Result<String, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path).await?;

    let metadata = load_metadata(&backups_dir).await;
    let version = metadata.versions.iter()
        .find(|v| v.timestamp == timestamp)
        .ok_or("Version not found")?;

    let version_path = resolve_version_path(&backups_dir, version).await
        .ok_or("Version file not found")?;

    // Read and decompress version file
    let compressed = tokio::fs::read(&version_path).await
        .map_err(|e| format!("Failed to read version: {}", e))?;
    tokio::task::spawn_blocking(move || decompress_content(&compressed))
        .await
        .map_err(|e| format!("Decompression task failed: {}", e))?
}

#[tauri::command]
pub async fn get_diff(
    workspace_path: String,
    file_path: String,
    timestamp1: String,
    timestamp2: String,
) -> Result<Vec<DiffLine>, String> {

    let content1 = get_version_content(workspace_path.clone(), file_path.clone(), timestamp1).await?;
    let content2 = get_version_content(workspace_path, file_path, timestamp2).await?;

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
pub async fn restore_version(
    workspace_path: String,
    file_path: String,
    timestamp: String,
) -> Result<String, String> {

    let content = get_version_content(workspace_path.clone(), file_path.clone(), timestamp.clone()).await?;

    // Write content back to original file
    let full_path = Path::new(&workspace_path).join(&file_path);
    tokio::fs::write(&full_path, &content).await
        .map_err(|e| format!("Failed to restore version: {}", e))?;

    // Save a new version with "restore" action
    save_version(
        workspace_path,
        file_path,
        content.clone(),
        Some(format!("Restored from {}", timestamp)),
    ).await?;

    Ok(content)
}

#[tauri::command]
pub async fn cleanup_old_versions(
    workspace_path: String,
    file_path: String,
) -> Result<usize, String> {

    let workspace = Path::new(&workspace_path);
    let backups_dir = get_backups_dir(workspace, &file_path).await?;

    let mut metadata = load_metadata(&backups_dir).await;
    let removed = cleanup_old_versions_internal(&mut metadata, &backups_dir).await?;
    save_metadata(&backups_dir, &metadata).await?;

    Ok(removed)
}

async fn cleanup_old_versions_internal(
    metadata: &mut VersionMetadata,
    backups_dir: &Path,
) -> Result<usize, String> {
    let max_versions = metadata.settings.max_versions;
    let retention_days = metadata.settings.retention_days;
    let now = Utc::now();

    let mut removed = 0;

    // Sort versions by timestamp (newest first)
    metadata.versions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let mut expired: Vec<FileVersion> = Vec::new();

    // Keep only max_versions most recent
    if metadata.versions.len() > max_versions {
        expired.extend(metadata.versions.split_off(max_versions));
    }

    // Remove versions older than retention_days
    let mut kept = Vec::with_capacity(metadata.versions.len());
    for version in metadata.versions.drain(..) {
        let too_old = DateTime::parse_from_rfc3339(&version.timestamp)
            .map(|dt| (now - dt.with_timezone(&Utc)).num_days() > retention_days)
            .unwrap_or(false);
        if too_old { expired.push(version); } else { kept.push(version); }
    }
    metadata.versions = kept;

    for version in &expired {
        if let Some(path) = resolve_version_path(backups_dir, version).await {
            if tokio::fs::remove_file(path).await.is_ok() {
                removed += 1;
            }
        }
    }

    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_filenames_are_unique() {
        // Generate multiple version filenames at the "same" time
        let mut filenames = std::collections::HashSet::new();
        for _ in 0..100 {
            let timestamp = Utc::now();
            let timestamp_str = timestamp.format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
            let random_suffix: u16 = rand::thread_rng().gen();
            let filename = format!("{}-{:04x}.md.gz", timestamp_str, random_suffix);
            filenames.insert(filename);
        }
        // With 16-bit random suffix, 100 attempts should all be unique
        // (birthday paradox threshold is ~256 for 65536 space)
        assert_eq!(filenames.len(), 100, "Generated duplicate filenames!");
    }
}
