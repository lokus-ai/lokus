use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use tauri_plugin_store::{StoreBuilder, JsonValue};
use tauri::AppHandle;

// === Core Data Structures ===

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub main: String, // Entry point file
    pub permissions: Vec<String>,
    pub dependencies: Option<HashMap<String, String>>,
    pub keywords: Option<Vec<String>>,
    pub repository: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub path: String,
    pub enabled: bool,
    pub installed_at: String, // ISO timestamp
    pub size: u64, // Size in bytes
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PluginSettings {
    pub enabled_plugins: Vec<String>,
    pub plugin_permissions: HashMap<String, Vec<String>>,
    pub plugin_settings: HashMap<String, JsonValue>,
}

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
pub fn list_plugins() -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    
    if !plugins_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut plugins = Vec::new();
    
    for entry in fs::read_dir(&plugins_dir).map_err(|e| format!("Failed to read plugins directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let plugin_path = entry.path();
        
        if plugin_path.is_dir() {
            if let Ok(plugin_info) = load_plugin_info(&plugin_path) {
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
    
    Ok(PluginInfo {
        manifest,
        path: plugin_path.to_string_lossy().to_string(),
        enabled: false, // Will be updated from settings
        installed_at,
        size,
    })
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
    // For now, return an error - zip installation would require additional dependencies
    Err("ZIP plugin installation not yet implemented. Please extract the plugin manually and install from directory.".to_string())
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
    let plugin_path = plugins_dir.join(&name);
    
    if !plugin_path.exists() {
        return Err(format!("Plugin '{}' is not installed", name));
    }
    
    // Remove plugin from enabled list and clean up settings
    cleanup_plugin_settings(&app, &name)?;
    
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
            } else if !is_valid_version(&manifest.version) {
                warnings.push("Version format should follow semantic versioning (e.g., 1.0.0)".to_string());
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
    // Plugin name should be alphanumeric with hyphens and underscores
    name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') && !name.is_empty()
}

fn is_valid_version(version: &str) -> bool {
    // Basic semantic version check (major.minor.patch)
    let parts: Vec<&str> = version.split('.').collect();
    parts.len() == 3 && parts.iter().all(|part| part.parse::<u32>().is_ok())
}

fn is_valid_permission(permission: &str) -> bool {
    // Define valid permissions for the plugin system
    const VALID_PERMISSIONS: &[&str] = &[
        "read:files",
        "write:files",
        "read:workspace",
        "write:workspace",
        "execute:commands",
        "network:http",
        "network:https",
        "ui:editor",
        "ui:sidebar",
        "ui:toolbar",
        "storage:local",
        "clipboard:read",
        "clipboard:write",
    ];
    
    VALID_PERMISSIONS.contains(&permission)
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
        .map_err(|e| format!("Failed to create store: {}", e))?;
    
    let _ = store.reload();
    
    if let Some(settings_value) = store.get("plugin_settings") {
        serde_json::from_value(settings_value.clone())
            .map_err(|e| format!("Failed to parse plugin settings: {}", e))
    } else {
        Ok(PluginSettings::default())
    }
}

fn save_plugin_settings(app: &AppHandle, settings: &PluginSettings) -> Result<(), String> {
    let store = StoreBuilder::new(app, PathBuf::from(".settings.dat")).build()
        .map_err(|e| format!("Failed to create store: {}", e))?;
    
    let _ = store.reload();
    let _ = store.set("plugin_settings".to_string(), serde_json::to_value(settings).unwrap());
    let _ = store.save();
    
    Ok(())
}

#[tauri::command]
pub fn enable_plugin(app: AppHandle, name: String) -> Result<(), String> {
    let mut settings = get_plugin_settings(&app)?;
    
    if !settings.enabled_plugins.contains(&name) {
        settings.enabled_plugins.push(name);
        save_plugin_settings(&app, &settings)?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn disable_plugin(app: AppHandle, name: String) -> Result<(), String> {
    let mut settings = get_plugin_settings(&app)?;
    
    settings.enabled_plugins.retain(|p| p != &name);
    save_plugin_settings(&app, &settings)?;
    
    Ok(())
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
    save_plugin_settings(&app, &settings)?;
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
    
    save_plugin_settings(&app, &settings)?;
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