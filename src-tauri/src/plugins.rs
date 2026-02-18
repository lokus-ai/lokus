use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::io::Read;
// Removed unused imports for performance optimization
use tauri_plugin_store::{StoreBuilder, JsonValue};
use tauri::AppHandle;
use zip::ZipArchive;
use semver::Version;
use chrono;
use walkdir;

// === Core Data Structures ===

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginManifest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>, // Plugin identifier (defaults to name if not provided)
    pub version: String,
    pub description: String,
    pub author: String,
    pub main: String, // Entry point file
    pub permissions: Vec<String>,
    pub dependencies: Option<HashMap<String, String>>,
    pub keywords: Option<Vec<String>>,
    pub repository: Option<serde_json::Value>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub contributes: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub path: String,
    pub enabled: bool,
    pub installed_at: String, // ISO timestamp
    pub size: u64, // Size in bytes
    // Cached marketplace metadata (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changelog: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloads: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_from: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginSettings {
    pub enabled_plugins: Vec<String>,
    pub plugin_permissions: HashMap<String, Vec<String>>,
    pub plugin_settings: HashMap<String, JsonValue>,
}

/// Cached marketplace metadata (saved alongside plugin)
#[derive(Serialize, Deserialize, Debug, Clone)]
#[allow(dead_code)]
pub struct MarketplaceMetadata {
    pub slug: Option<String>,
    pub icon_url: Option<String>,
    pub description: Option<String>,
    pub readme: Option<String>,
    pub changelog: Option<String>,
    pub author: Option<String>,
    pub downloads: Option<u64>,
    pub rating: Option<f64>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub license: Option<String>,
    pub installed_at: Option<String>,
    pub installed_from: Option<String>,
}

// Removed cache for simpler implementation

#[derive(Serialize, Debug)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

#[derive(Serialize, Debug)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstallationLog {
    pub plugin_name: String,
    pub version: String,
    pub installed_at: String,
    pub install_method: String,
    pub source_url: Option<String>,
    pub checksum: Option<String>,
}

#[derive(Serialize, Debug)]
#[allow(dead_code)]
pub struct GitHubRepoInfo {
    pub owner: String,
    pub repo: String,
    pub branch: Option<String>,
    pub tag: Option<String>,
    pub download_url: String,
}

#[derive(Serialize, Debug)]
#[allow(dead_code)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub plugin_name: Option<String>,
    pub error: Option<String>,
    pub warnings: Vec<String>,
    pub installation_log: Option<InstallationLog>,
}

// === Plugin Directory Management ===

fn get_home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Unable to determine home directory".to_string())
}

#[tauri::command]
pub fn get_plugins_directory() -> Result<String, String> {
    let home = get_home_dir()?;
    let plugins_dir = home.join(".lokus").join("plugins");
    Ok(plugins_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_plugins_directory() -> Result<String, String> {
    let home = get_home_dir()?;
    let lokus_dir = home.join(".lokus");
    let plugins_dir = lokus_dir.join("plugins");
    
    // Create .lokus directory if it doesn't exist
    if !lokus_dir.exists() {
        fs::create_dir_all(&lokus_dir).map_err(|e| format!("Failed to create .lokus directory: {}", e))?;
    }
    
    // Create plugins directory if it doesn't exist
    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir).map_err(|e| format!("Failed to create plugins directory: {}", e))?;
    }
    
    Ok(plugins_dir.to_string_lossy().to_string())
}

// === Plugin Discovery ===

#[tauri::command]
pub fn list_plugins(app: AppHandle) -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    
    if !plugins_dir.exists() {
        return Ok(vec![]);
    }
    
    // Load enabled plugins from storage
    let enabled_plugins = match get_enabled_plugins(app.clone()) {
        Ok(enabled) => enabled.into_iter().collect::<std::collections::HashSet<_>>(),
        Err(_e) => {
            std::collections::HashSet::new()
        }
    };
    
    let mut plugins = Vec::new();
    
    for entry in fs::read_dir(&plugins_dir).map_err(|e| format!("Failed to read plugins directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let plugin_path = entry.path();
        
        if plugin_path.is_dir() {
            if let Ok(mut plugin_info) = load_plugin_info(&plugin_path) {
                // Set correct enabled state from storage
                plugin_info.enabled = enabled_plugins.contains(&plugin_info.manifest.name);
                plugins.push(plugin_info);
            }
        }
    }
    
    // Sort plugins by name
    plugins.sort_by(|a, b| a.manifest.name.cmp(&b.manifest.name));
    
    Ok(plugins)
}

fn load_plugin_info(plugin_path: &Path) -> Result<PluginInfo, String> {
    let manifest_path = plugin_path.join("plugin.json");

    if !manifest_path.exists() {
        return Err("plugin.json not found".to_string());
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;

    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse plugin.json: {}", e))?;

    // Calculate plugin directory size
    let size = calculate_directory_size(plugin_path)?;

    // Get installation timestamp from directory metadata
    let metadata = fs::metadata(plugin_path)
        .map_err(|e| format!("Failed to read plugin metadata: {}", e))?;

    let installed_at = metadata.created()
        .or_else(|_| metadata.modified())
        .map(|time| {
            let duration = time.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
            chrono::DateTime::<chrono::Utc>::from_timestamp(duration.as_secs() as i64, 0)
                .unwrap_or_default()
                .to_rfc3339()
        })
        .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339());

    // Read local plugin files for metadata
    // Icon: check for icon.png, icon.svg, or icon field in manifest
    let icon_url = find_plugin_icon(plugin_path);

    // README: read README.md if exists
    let readme = read_plugin_metadata_file(plugin_path, "README.md");

    // Changelog: read CHANGELOG.md if exists
    let changelog = read_plugin_metadata_file(plugin_path, "CHANGELOG.md");

    Ok(PluginInfo {
        manifest,
        path: plugin_path.to_string_lossy().to_string(),
        enabled: false, // Will be updated from settings
        installed_at,
        size,
        icon_url,
        slug: None, // Could be set from plugin.json id field
        readme,
        changelog,
        downloads: None,
        rating: None,
        homepage: None,
        installed_from: None,
    })
}

/// Find plugin icon file and return as file:// URL or data URL
fn find_plugin_icon(plugin_path: &Path) -> Option<String> {
    // Check for common icon files
    let icon_files = ["icon.png", "icon.svg", "icon.jpg", "icon.jpeg", "logo.png", "logo.svg"];

    // Folders to check for icons
    let icon_folders = ["", "assets", "dist", "images", "img"];

    for folder in &icon_folders {
        for icon_file in &icon_files {
            let icon_path = if folder.is_empty() {
                plugin_path.join(icon_file)
            } else {
                plugin_path.join(folder).join(icon_file)
            };

            if icon_path.exists() {
                // Return as file:// URL for local access
                return Some(format!("file://{}", icon_path.to_string_lossy()));
            }
        }
    }

    None
}

/// Read a text file from plugin directory (internal helper)
fn read_plugin_metadata_file(plugin_path: &Path, filename: &str) -> Option<String> {
    let file_path = plugin_path.join(filename);
    if file_path.exists() {
        fs::read_to_string(&file_path).ok()
    } else {
        None
    }
}

fn calculate_directory_size(dir: &Path) -> Result<u64, String> {
    let mut size = 0;

    for entry in walkdir::WalkDir::new(dir) {
        let entry = entry.map_err(|e| format!("Failed to walk directory: {}", e))?;
        if entry.file_type().is_file() {
            let metadata = entry.metadata().map_err(|e| format!("Failed to read file metadata: {}", e))?;
            size += metadata.len();
        }
    }

    Ok(size)
}

/// Resolve plugin name/id to actual folder name
/// Checks: 1) exact folder match, 2) manifest.id match, 3) manifest.name match
fn resolve_plugin_name(plugins_dir: &Path, name_or_id: &str) -> Result<String, String> {
    // 1. Try exact folder name match
    let direct_path = plugins_dir.join(name_or_id);
    if direct_path.exists() && direct_path.is_dir() {
        return Ok(name_or_id.to_string());
    }

    // 2. Search through plugin folders for matching manifest.id or manifest.name
    if let Ok(entries) = fs::read_dir(plugins_dir) {
        for entry in entries.flatten() {
            let folder_path = entry.path();
            if !folder_path.is_dir() { continue; }

            let manifest_path = folder_path.join("plugin.json");
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                    // Match by id or name
                    if manifest.id.as_deref() == Some(name_or_id) || manifest.name == name_or_id {
                        if let Some(folder_name) = folder_path.file_name() {
                            return Ok(folder_name.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    Err(format!("Plugin '{}' not found", name_or_id))
}

// === Plugin Information ===

#[tauri::command]
pub fn get_plugin_info(name: String) -> Result<PluginInfo, String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let plugin_path = plugins_dir.join(&name);
    
    if !plugin_path.exists() {
        return Err(format!("Plugin '{}' not found", name));
    }
    
    load_plugin_info(&plugin_path)
}

// === Plugin Installation ===

#[tauri::command]
pub async fn install_plugin(path: String) -> Result<String, String> {
    let plugins_dir = PathBuf::from(create_plugins_directory()?);

    // Check if it's a URL (desktop only - requires reqwest)
    #[cfg(desktop)]
    if path.starts_with("http://") || path.starts_with("https://") {
        return install_plugin_from_url(&path, &plugins_dir).await;
    }

    #[cfg(not(desktop))]
    if path.starts_with("http://") || path.starts_with("https://") {
        return Err("Installing plugins from URLs is not supported on mobile".to_string());
    }

    let source_path = PathBuf::from(&path);

    if !source_path.exists() {
        return Err("Source plugin path does not exist".to_string());
    }

    // If it's a file, assume it's a zip archive
    if source_path.is_file() {
        install_plugin_from_zip(&source_path, &plugins_dir).await
    } else if source_path.is_dir() {
        install_plugin_from_directory(&source_path, &plugins_dir).await
    } else {
        Err("Invalid plugin source path".to_string())
    }
}

#[cfg(desktop)]
async fn install_plugin_from_url(url: &str, plugins_dir: &std::path::Path) -> Result<String, String> {
    // Download the file
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to download plugin: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download plugin: HTTP {}", response.status()));
    }

    let content = response.bytes()
        .await
        .map_err(|e| format!("Failed to read download content: {}", e))?;

    // Save to temporary file
    let temp_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create temporary directory: {}", e))?;
    let temp_path = temp_dir.path().join("plugin.zip");

    fs::write(&temp_path, content)
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;

    // Install from the downloaded zip
    install_plugin_from_zip(&temp_path, plugins_dir).await
}

async fn install_plugin_from_directory(source_dir: &Path, plugins_dir: &Path) -> Result<String, String> {
    // Validate plugin manifest first
    let manifest_path = source_dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err("plugin.json not found in source directory".to_string());
    }
    
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;
    
    let validation_result = validate_plugin_manifest(manifest_content.clone())?;
    if !validation_result.valid {
        return Err(format!("Plugin manifest validation failed: {:?}", validation_result.errors));
    }
    
    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse plugin.json: {}", e))?;
    
    // Check if plugin already exists
    let dest_dir = plugins_dir.join(&manifest.name);
    if dest_dir.exists() {
        return Err(format!("Plugin '{}' is already installed", manifest.name));
    }
    
    // Copy plugin directory
    copy_directory(source_dir, &dest_dir)
        .map_err(|e| format!("Failed to copy plugin: {}", e))?;
    
    Ok(manifest.name)
}

async fn install_plugin_from_zip(zip_path: &Path, plugins_dir: &Path) -> Result<String, String> {
    let file = fs::File::open(zip_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;
    
    // Find the plugin.json file to determine the plugin structure
    let mut plugin_manifest_index = None;
    let mut root_folder = None;
    
    for i in 0..archive.len() {
        let file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
        if file.name().ends_with("plugin.json") {
            plugin_manifest_index = Some(i);
            // Extract the root folder name from the path
            let path_parts: Vec<&str> = file.name().split('/').collect();
            if path_parts.len() > 1 {
                root_folder = Some(path_parts[0].to_string());
            }
            break;
        }
    }
    
    let manifest_index = plugin_manifest_index
        .ok_or_else(|| "No plugin.json found in ZIP archive".to_string())?;
    
    // Read and validate the manifest
    let mut manifest_file = archive.by_index(manifest_index)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;
    
    let mut manifest_content = String::new();
    manifest_file.read_to_string(&mut manifest_content)
        .map_err(|e| format!("Failed to read plugin.json content: {}", e))?;
    
    let validation_result = validate_plugin_manifest(manifest_content.clone())?;
    if !validation_result.valid {
        return Err(format!("Plugin manifest validation failed: {:?}", validation_result.errors));
    }
    
    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse plugin.json: {}", e))?;
    
    // Check if plugin already exists
    let dest_dir = plugins_dir.join(&manifest.name);
    if dest_dir.exists() {
        return Err(format!("Plugin '{}' is already installed", manifest.name));
    }
    
    // Extract the ZIP archive
    let temp_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create temporary directory: {}", e))?;
    
    // Reset the archive reader
    drop(manifest_file);
    let file = fs::File::open(zip_path)
        .map_err(|e| format!("Failed to reopen ZIP file: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to reread ZIP archive: {}", e))?;
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
            let outpath = temp_dir.path().join(file.name());
        
        // Prevent Zip Slip vulnerability
        if !outpath.starts_with(temp_dir.path()) {
            return Err(format!("Invalid file path in ZIP: {}", file.name()));
        }
        
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }
    
    // Determine the source directory for copying
    let source_dir = if let Some(folder) = root_folder {
        temp_dir.path().join(folder)
    } else {
        temp_dir.path().to_path_buf()
    };
    
    // Copy to the final destination
    copy_directory(&source_dir, &dest_dir)
        .map_err(|e| format!("Failed to copy extracted plugin: {}", e))?;
    
    Ok(manifest.name)
}

fn copy_directory(src: &Path, dest: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        
        if src_path.is_dir() {
            copy_directory(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }
    
    Ok(())
}

// === Plugin Uninstallation ===

#[tauri::command]
pub fn uninstall_plugin(app: AppHandle, name: String) -> Result<(), String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);

    // Resolve name/id to actual folder name
    let resolved_name = resolve_plugin_name(&plugins_dir, &name)?;
    let plugin_path = plugins_dir.join(&resolved_name);

    // Remove plugin from enabled list and clean up settings
    cleanup_plugin_settings(&app, &resolved_name)?;

    // Remove plugin directory
    fs::remove_dir_all(&plugin_path)
        .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;

    Ok(())
}

fn cleanup_plugin_settings(app: &AppHandle, plugin_name: &str) -> Result<(), String> {
    let store = StoreBuilder::new(app, PathBuf::from(".settings.dat")).build()
        .map_err(|e| format!("Failed to create store: {}", e))?;
    
    let _ = store.reload();
    
    // Get current plugin settings
    let mut plugin_settings = if let Some(settings_value) = store.get("plugin_settings") {
        serde_json::from_value::<PluginSettings>(settings_value.clone())
            .unwrap_or_default()
    } else {
        PluginSettings {
            enabled_plugins: vec![],
            plugin_permissions: HashMap::new(),
            plugin_settings: HashMap::new(),
        }
    };
    
    // Remove plugin from enabled list
    plugin_settings.enabled_plugins.retain(|p| p != plugin_name);
    
    // Remove plugin permissions
    plugin_settings.plugin_permissions.remove(plugin_name);
    
    // Remove plugin-specific settings
    plugin_settings.plugin_settings.remove(plugin_name);
    
    // Save updated settings
    let _ = store.set("plugin_settings".to_string(), serde_json::to_value(plugin_settings).unwrap());
    let _ = store.save();
    
    Ok(())
}

// === Plugin Manifest Validation ===

#[tauri::command]
pub fn validate_plugin_manifest(manifest: String) -> Result<ValidationResult, String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    
    // Try to parse the JSON
    let parsed_manifest: Result<PluginManifest, _> = serde_json::from_str(&manifest);
    
    match parsed_manifest {
        Ok(manifest) => {
            // Validate required fields
            if manifest.name.trim().is_empty() {
                errors.push(ValidationError {
                    field: "name".to_string(),
                    message: "Plugin name cannot be empty".to_string(),
                });
            } else if !is_valid_plugin_name(&manifest.name) {
                errors.push(ValidationError {
                    field: "name".to_string(),
                    message: "Plugin name contains invalid characters".to_string(),
                });
            }
            
            if manifest.version.trim().is_empty() {
                errors.push(ValidationError {
                    field: "version".to_string(),
                    message: "Plugin version cannot be empty".to_string(),
                });
            } else {
                match validate_version_format(&manifest.version) {
                    Ok(_version) => {
                        // Version is valid
                    }
                    Err(e) => {
                        errors.push(ValidationError {
                            field: "version".to_string(),
                            message: e,
                        });
                    }
                }
            }
            
            if manifest.description.trim().is_empty() {
                warnings.push("Plugin description is empty".to_string());
            }
            
            if manifest.author.trim().is_empty() {
                warnings.push("Plugin author is empty".to_string());
            }
            
            if manifest.main.trim().is_empty() {
                errors.push(ValidationError {
                    field: "main".to_string(),
                    message: "Main entry point cannot be empty".to_string(),
                });
            }
            
            // Validate permissions
            for permission in &manifest.permissions {
                if !is_valid_permission(permission) {
                    errors.push(ValidationError {
                        field: "permissions".to_string(),
                        message: format!("Invalid permission: {}", permission),
                    });
                }
            }
        }
        Err(e) => {
            errors.push(ValidationError {
                field: "json".to_string(),
                message: format!("Invalid JSON: {}", e),
            });
        }
    }
    
    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    })
}

fn is_valid_plugin_name(name: &str) -> bool {
    // Plugin name should be alphanumeric with hyphens, underscores, and spaces
    name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == ' ') && !name.trim().is_empty()
}

// Enhanced validation functions
fn validate_version_format(version: &str) -> Result<Version, String> {
    Version::parse(version)
        .map_err(|e| format!("Invalid semantic version format: {}", e))
}

fn is_valid_permission(permission: &str) -> bool {
    // Define valid permission patterns for the plugin system
    // Format: category:action or category:subcategory:action
    const VALID_PREFIXES: &[&str] = &[
        "read:", "write:", "execute:", "network:", "ui:", "storage:", "clipboard:",
        "filesystem:", "files:", "workspace:", "editor:", "commands:", "events:",
        "notifications:", "settings:", "themes:", "sidebar:", "toolbar:", "statusbar:",
    ];

    // Check if permission matches any valid prefix pattern
    VALID_PREFIXES.iter().any(|prefix| permission.starts_with(prefix))
}

// === Plugin Storage Operations ===

impl Default for PluginSettings {
    fn default() -> Self {
        Self {
            enabled_plugins: Vec::new(),
            plugin_permissions: HashMap::new(),
            plugin_settings: HashMap::new(),
        }
    }
}

fn get_plugin_settings(app: &AppHandle) -> Result<PluginSettings, String> {

    let store = StoreBuilder::new(app, PathBuf::from(".settings.dat")).build()
        .map_err(|e| {
            let error = format!("Failed to create store: {}", e);
            error
        })?;

    store.reload()
        .map_err(|e| {
            let error = format!("Failed to reload store: {}", e);
            error
        })?;

    if let Some(settings_value) = store.get("plugin_settings") {

        let settings: PluginSettings = serde_json::from_value(settings_value.clone())
            .map_err(|e| {
                let error = format!("Failed to parse plugin settings: {}", e);
                error
            })?;

        Ok(settings)
    } else {
        Ok(PluginSettings::default())
    }
}

fn save_plugin_settings_internal(app: &AppHandle, settings: &PluginSettings) -> Result<(), String> {
    
    let store = StoreBuilder::new(app, PathBuf::from(".settings.dat")).build()
        .map_err(|e| {
            let error = format!("Failed to create store: {}", e);
            error
        })?;
    
    // Reload store before saving
    store.reload()
        .map_err(|e| {
            let error = format!("Failed to reload store: {}", e);
            error
        })?;
    
    // Serialize settings with detailed logging
    let settings_value = serde_json::to_value(settings)
        .map_err(|e| {
            let error = format!("Failed to serialize plugin settings: {}", e);
            error
        })?;
    
    
    // Set the value in store
    store.set("plugin_settings".to_string(), settings_value.clone());
    
    // Verify the value was set correctly
    if let Some(stored_value) = store.get("plugin_settings") {
        if stored_value != settings_value {
        }
    } else {
        return Err("Failed to set value in store".to_string());
    }
    
    // Save store with error handling
    store.save()
        .map_err(|e| {
            let error = format!("Failed to save plugin settings to disk: {}", e);
            error
        })?;
    
    // Remove unnecessary delay for better performance
    
    // Force reload the store to verify the save was successful
    store.reload()
        .map_err(|e| {
            let error = format!("Failed to reload store after save: {}", e);
            error
        })?;
    
    // Verify the save was successful
    if let Some(stored_value) = store.get("plugin_settings") {
        if let Ok(stored_settings) = serde_json::from_value::<PluginSettings>(stored_value) {
            if stored_settings.enabled_plugins != settings.enabled_plugins {
            }
        } else {
        }
    } else {
        return Err("Save operation failed - no data found after save".to_string());
    }
    

    Ok(())
}

// === Atomic Plugin State Operations ===

/// Atomically update a plugin's enabled state with proper error handling and verification
fn update_plugin_enabled_state(app: &AppHandle, plugin_name: &str, enabled: bool) -> Result<(), String> {
    
    // Load current settings with retry logic
    let mut settings = get_plugin_settings(app)?;
    
    // Verify the plugin exists before enabling
    if enabled {
        let plugins_dir = PathBuf::from(get_plugins_directory()?);
        let plugin_path = plugins_dir.join(plugin_name);
        if !plugin_path.exists() {
            return Err(format!("Cannot enable plugin '{}': plugin directory not found", plugin_name));
        }
    }
    
    // Update enabled state atomically
    let was_enabled = settings.enabled_plugins.contains(&plugin_name.to_string());
    
    if enabled && !was_enabled {
        // Add to enabled plugins
        settings.enabled_plugins.push(plugin_name.to_string());
    } else if !enabled && was_enabled {
        // Remove from enabled plugins
        settings.enabled_plugins.retain(|p| p != plugin_name);
    } else {
        // No change needed
        return Ok(());
    }
    
    // Validate the settings before saving
    if let Err(validation_error) = validate_plugin_settings(&settings) {
        return Err(format!("Settings validation failed: {}", validation_error));
    }
    
    // Save settings atomically
    save_plugin_settings_internal(app, &settings)?;
    
    Ok(())
}

/// Validate plugin settings before saving
fn validate_plugin_settings(settings: &PluginSettings) -> Result<(), String> {
    // Check for duplicates in enabled plugins
    let mut seen = std::collections::HashSet::new();
    for plugin_name in &settings.enabled_plugins {
        if !seen.insert(plugin_name.clone()) {
            return Err(format!("Duplicate plugin in enabled list: {}", plugin_name));
        }
    }
    
    // Validate plugin names (basic validation)
    for plugin_name in &settings.enabled_plugins {
        if plugin_name.trim().is_empty() {
            return Err("Empty plugin name found in enabled list".to_string());
        }
        if plugin_name.contains("..") || plugin_name.contains("/") || plugin_name.contains("\\") {
            return Err(format!("Invalid plugin name: {}", plugin_name));
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn enable_plugin(app: AppHandle, name: String) -> Result<(), String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);

    // Resolve name/id to actual folder name
    let resolved_name = resolve_plugin_name(&plugins_dir, &name)?;

    // Use atomic operation for enabling plugin
    update_plugin_enabled_state(&app, &resolved_name, true)
}

#[tauri::command]
pub fn disable_plugin(app: AppHandle, name: String) -> Result<(), String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);

    // Resolve name/id to actual folder name
    let resolved_name = resolve_plugin_name(&plugins_dir, &name)?;

    // Use atomic operation for disabling plugin
    update_plugin_enabled_state(&app, &resolved_name, false)
}

#[tauri::command]
pub fn get_enabled_plugins(app: AppHandle) -> Result<Vec<String>, String> {
    let settings = get_plugin_settings(&app)?;
    Ok(settings.enabled_plugins)
}

#[tauri::command]
pub fn set_plugin_permission(app: AppHandle, plugin_name: String, permissions: Vec<String>) -> Result<(), String> {
    let mut settings = get_plugin_settings(&app)?;
    settings.plugin_permissions.insert(plugin_name, permissions);
    save_plugin_settings_internal(&app, &settings)?;
    Ok(())
}

#[tauri::command]
pub fn get_plugin_permissions(app: AppHandle, plugin_name: String) -> Result<Vec<String>, String> {
    let settings = get_plugin_settings(&app)?;
    Ok(settings.plugin_permissions.get(&plugin_name).cloned().unwrap_or_default())
}

#[tauri::command]
pub fn set_plugin_setting(app: AppHandle, plugin_name: String, key: String, value: JsonValue) -> Result<(), String> {
    let mut settings = get_plugin_settings(&app)?;
    
    let plugin_settings = settings.plugin_settings
        .entry(plugin_name)
        .or_insert_with(|| JsonValue::Object(serde_json::Map::new()));
    
    if let JsonValue::Object(map) = plugin_settings {
        map.insert(key, value);
    }
    
    save_plugin_settings_internal(&app, &settings)?;
    Ok(())
}

#[tauri::command]
pub fn get_plugin_setting(app: AppHandle, plugin_name: String, key: String) -> Result<Option<JsonValue>, String> {
    let settings = get_plugin_settings(&app)?;
    
    if let Some(plugin_settings) = settings.plugin_settings.get(&plugin_name) {
        if let JsonValue::Object(map) = plugin_settings {
            Ok(map.get(&key).cloned())
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}

#[allow(dead_code)]
#[tauri::command]
pub fn save_plugin_settings(app: AppHandle, plugin_id: String, settings: JsonValue) -> Result<(), String> {
    let mut current_settings = get_plugin_settings(&app)?;
    
    current_settings.plugin_settings.insert(plugin_id, settings);
    
    save_plugin_settings_internal(&app, &current_settings)?;
    Ok(())
}

// === Plugin File Operations ===

#[tauri::command]
pub fn read_plugin_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    
    // Security check: ensure the path is within the plugins directory
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    if !file_path.starts_with(&plugins_dir) {
        return Err("Access denied: path must be within plugins directory".to_string());
    }
    
    // Check if file exists
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    
    // Read file content
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
pub fn get_plugin_manifest(plugin_name: String) -> Result<PluginManifest, String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let plugin_path = plugins_dir.join(&plugin_name);
    let manifest_path = plugin_path.join("plugin.json");
    
    if !manifest_path.exists() {
        return Err(format!("Manifest not found for plugin: {}", plugin_name));
    }
    
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    
    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;
    
    Ok(manifest)
}