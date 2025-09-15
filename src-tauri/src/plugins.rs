use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use tauri_plugin_store::{StoreBuilder, JsonValue};
use tauri::AppHandle;
use regex::Regex;

// === Core Data Structures ===

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginManifestV1 {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub main: String,
    pub lokus_version: String,
    pub permissions: Option<Vec<String>>,
    pub dependencies: Option<HashMap<String, String>>,
    pub keywords: Option<Vec<String>>,
    pub repository: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub activation_events: Option<Vec<String>>,
    pub categories: Option<Vec<String>>,
    pub contributes: Option<JsonValue>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginAuthor {
    pub name: String,
    pub email: Option<String>,
    pub url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginRepository {
    #[serde(rename = "type")]
    pub repo_type: String,
    pub url: String,
    pub directory: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginEngines {
    pub lokus: String,
    pub node: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginCapabilities {
    pub untrusted_workspaces: Option<UntrustedWorkspaceSupport>,
    pub virtual_workspaces: Option<VirtualWorkspaceSupport>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UntrustedWorkspaceSupport {
    pub supported: bool,
    pub restricted_configurations: Option<Vec<String>>,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VirtualWorkspaceSupport {
    pub supported: bool,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PluginManifestV2 {
    pub manifest: String, // Should be "2.0"
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub version: String,
    pub publisher: Option<String>,
    pub description: Option<String>,
    pub engines: PluginEngines,
    pub categories: Option<Vec<String>>,
    pub keywords: Option<Vec<String>>,
    pub main: Option<String>,
    pub browser: Option<String>,
    pub activation_events: Option<Vec<String>>,
    pub contributes: Option<JsonValue>,
    pub capabilities: Option<PluginCapabilities>,
    pub author: Option<JsonValue>, // Can be string or PluginAuthor
    pub license: Option<String>,
    pub homepage: Option<String>,
    pub repository: Option<JsonValue>, // Can be string or PluginRepository
    pub bugs: Option<JsonValue>,
    pub qna: Option<JsonValue>,
    pub badges: Option<Vec<JsonValue>>,
    pub markdown: Option<String>,
    pub gallery_banner: Option<JsonValue>,
    pub preview: Option<bool>,
    pub enabled_api_proposals: Option<Vec<String>>,
    pub api: Option<String>,
    pub extension_dependencies: Option<Vec<String>>,
    pub extension_pack: Option<Vec<String>>,
    pub icon: Option<String>,
    pub scripts: Option<HashMap<String, String>>,
    pub pricing: Option<String>,
    pub sponsor: Option<JsonValue>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum PluginManifest {
    V1(PluginManifestV1),
    V2(PluginManifestV2),
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
    plugins.sort_by(|a, b| {
        let name_a = match &a.manifest {
            PluginManifest::V1(v1) => &v1.name,
            PluginManifest::V2(v2) => &v2.name,
        };
        let name_b = match &b.manifest {
            PluginManifest::V1(v1) => &v1.name,
            PluginManifest::V2(v2) => &v2.name,
        };
        name_a.cmp(name_b)
    });
    
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
    let plugin_name = match &manifest {
        PluginManifest::V1(v1) => &v1.name,
        PluginManifest::V2(v2) => &v2.name,
    };
    let dest_dir = plugins_dir.join(plugin_name);
    if dest_dir.exists() {
        return Err(format!("Plugin '{}' is already installed", plugin_name));
    }
    
    // Copy plugin directory
    copy_directory(source_dir, &dest_dir)
        .map_err(|e| format!("Failed to copy plugin: {}", e))?;
    
    Ok(plugin_name.clone())
}

async fn install_plugin_from_zip(_zip_path: &Path, _plugins_dir: &Path) -> Result<String, String> {
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
    
    // Try to parse the JSON first to detect version
    let manifest_value: serde_json::Value = match serde_json::from_str(&manifest) {
        Ok(value) => value,
        Err(e) => {
            errors.push(ValidationError {
                field: "json".to_string(),
                message: format!("Invalid JSON: {}", e),
            });
            return Ok(ValidationResult {
                valid: false,
                errors,
                warnings,
            });
        }
    };

    // Detect manifest version
    let version = detect_manifest_version(&manifest_value);
    
    match version.as_str() {
        "2.0" => validate_manifest_v2(&manifest_value, &mut errors, &mut warnings),
        "1.0" | "unknown" => validate_manifest_v1(&manifest_value, &mut errors, &mut warnings),
        _ => {
            errors.push(ValidationError {
                field: "manifest".to_string(),
                message: format!("Unsupported manifest version: {}", version),
            });
        }
    }
    
    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    })
}

fn detect_manifest_version(manifest: &serde_json::Value) -> String {
    if let Some(version) = manifest.get("manifest").and_then(|v| v.as_str()) {
        return version.to_string();
    }
    
    // Check for v2 indicators
    if manifest.get("engines").is_some() || manifest.get("publisher").is_some() {
        return "2.0".to_string();
    }
    
    // Check for v1 indicators
    if manifest.get("lokusVersion").is_some() {
        return "1.0".to_string();
    }
    
    "unknown".to_string()
}

fn validate_manifest_v2(manifest: &serde_json::Value, errors: &mut Vec<ValidationError>, warnings: &mut Vec<String>) {
    // Parse as V2 manifest
    let parsed_manifest: Result<PluginManifestV2, _> = serde_json::from_value(manifest.clone());
    
    match parsed_manifest {
        Ok(manifest_v2) => {
            // Validate manifest version
            if manifest_v2.manifest != "2.0" {
                errors.push(ValidationError {
                    field: "manifest".to_string(),
                    message: "Manifest version must be '2.0'".to_string(),
                });
            }
            
            // Validate required fields
            if manifest_v2.id.trim().is_empty() {
                errors.push(ValidationError {
                    field: "id".to_string(),
                    message: "Plugin ID cannot be empty".to_string(),
                });
            } else if !is_valid_plugin_id(&manifest_v2.id) {
                errors.push(ValidationError {
                    field: "id".to_string(),
                    message: "Plugin ID must be lowercase, start with a letter, and contain only letters, numbers, and hyphens".to_string(),
                });
            }
            
            if manifest_v2.name.trim().is_empty() {
                errors.push(ValidationError {
                    field: "name".to_string(),
                    message: "Plugin name cannot be empty".to_string(),
                });
            }
            
            if !is_valid_version(&manifest_v2.version) {
                errors.push(ValidationError {
                    field: "version".to_string(),
                    message: "Version must follow semantic versioning format".to_string(),
                });
            }
            
            // Validate engines
            if !is_valid_version_range(&manifest_v2.engines.lokus) {
                errors.push(ValidationError {
                    field: "engines.lokus".to_string(),
                    message: "Invalid Lokus version range".to_string(),
                });
            }
            
            // Validate publisher format if present
            if let Some(publisher) = &manifest_v2.publisher {
                if !is_valid_plugin_id(publisher) {
                    errors.push(ValidationError {
                        field: "publisher".to_string(),
                        message: "Publisher must be lowercase, start with a letter, and contain only letters, numbers, and hyphens".to_string(),
                    });
                }
            }
            
            // Validate activation events
            if let Some(activation_events) = &manifest_v2.activation_events {
                for event in activation_events {
                    if !is_valid_activation_event_v2(event) {
                        warnings.push(format!("Unknown activation event: {}", event));
                    }
                }
            }
            
            // Validate categories
            if let Some(categories) = &manifest_v2.categories {
                for category in categories {
                    if !is_valid_category_v2(category) {
                        warnings.push(format!("Unknown category: {}", category));
                    }
                }
            }
            
            // Validate capabilities
            if let Some(capabilities) = &manifest_v2.capabilities {
                validate_capabilities_v2(capabilities, warnings);
            }
        }
        Err(e) => {
            errors.push(ValidationError {
                field: "manifest".to_string(),
                message: format!("Invalid v2 manifest structure: {}", e),
            });
        }
    }
}

fn validate_manifest_v1(manifest: &serde_json::Value, errors: &mut Vec<ValidationError>, warnings: &mut Vec<String>) {
    // Parse as V1 manifest
    let parsed_manifest: Result<PluginManifestV1, _> = serde_json::from_value(manifest.clone());
    
    match parsed_manifest {
        Ok(manifest_v1) => {
            // Validate required fields
            if manifest_v1.id.trim().is_empty() {
                errors.push(ValidationError {
                    field: "id".to_string(),
                    message: "Plugin ID cannot be empty".to_string(),
                });
            } else if !is_valid_plugin_id(&manifest_v1.id) {
                errors.push(ValidationError {
                    field: "id".to_string(),
                    message: "Plugin ID contains invalid characters".to_string(),
                });
            }
            
            if manifest_v1.name.trim().is_empty() {
                errors.push(ValidationError {
                    field: "name".to_string(),
                    message: "Plugin name cannot be empty".to_string(),
                });
            }
            
            if !is_valid_version(&manifest_v1.version) {
                warnings.push("Version format should follow semantic versioning (e.g., 1.0.0)".to_string());
            }
            
            if manifest_v1.main.trim().is_empty() {
                errors.push(ValidationError {
                    field: "main".to_string(),
                    message: "Main entry point cannot be empty".to_string(),
                });
            }
            
            if !is_valid_version_range(&manifest_v1.lokus_version) {
                errors.push(ValidationError {
                    field: "lokusVersion".to_string(),
                    message: "Invalid Lokus version range".to_string(),
                });
            }
            
            // Validate permissions
            if let Some(permissions) = &manifest_v1.permissions {
                for permission in permissions {
                    if !is_valid_permission_v1(permission) {
                        errors.push(ValidationError {
                            field: "permissions".to_string(),
                            message: format!("Invalid permission: {}", permission),
                        });
                    }
                }
            }
            
            // Validate activation events
            if let Some(activation_events) = &manifest_v1.activation_events {
                for event in activation_events {
                    if !is_valid_activation_event_v1(event) {
                        warnings.push(format!("Unknown activation event: {}", event));
                    }
                }
            }
            
            // Suggest upgrade to v2
            warnings.push("Consider upgrading to manifest v2 for enhanced capabilities".to_string());
        }
        Err(e) => {
            errors.push(ValidationError {
                field: "manifest".to_string(),
                message: format!("Invalid v1 manifest structure: {}", e),
            });
        }
    }
}

fn is_valid_plugin_id(id: &str) -> bool {
    // Plugin ID should be lowercase, start with letter, contain only letters, numbers, and hyphens
    let regex = Regex::new(r"^[a-z][a-z0-9-]*[a-z0-9]$").unwrap();
    regex.is_match(id) && id.len() >= 2 && id.len() <= 214
}

fn is_valid_plugin_name(name: &str) -> bool {
    // Plugin name should be alphanumeric with hyphens and underscores
    name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') && !name.is_empty()
}

fn is_valid_version(version: &str) -> bool {
    // Semantic version check (major.minor.patch with optional pre-release and build)
    let regex = Regex::new(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$").unwrap();
    regex.is_match(version)
}

fn is_valid_version_range(version_range: &str) -> bool {
    // Allow version ranges like "^1.0.0", ">=1.0.0", "1.0.0", etc.
    let regex = Regex::new(r"^[\^~>=<]*\d+\.\d+\.\d+").unwrap();
    regex.is_match(version_range)
}

fn is_valid_permission_v1(permission: &str) -> bool {
    // Define valid permissions for v1 plugin system
    const VALID_PERMISSIONS_V1: &[&str] = &[
        "read_files",
        "write_files", 
        "execute_commands",
        "access_network",
        "modify_ui",
        "access_settings",
        "access_vault",
        "all"
    ];
    
    VALID_PERMISSIONS_V1.contains(&permission)
}

fn is_valid_activation_event_v1(event: &str) -> bool {
    const VALID_EVENTS_V1: &[&str] = &[
        "onStartup",
        "onCommand:*",
        "onLanguage:*",
        "onFileType:*",
        "onView:*",
        "onUri:*",
        "onWebviewPanel:*",
        "workspaceContains:*"
    ];
    
    // Check exact match or pattern match
    for valid_event in VALID_EVENTS_V1 {
        if valid_event.ends_with('*') {
            if event.starts_with(&valid_event[..valid_event.len()-1]) {
                return true;
            }
        } else if event == *valid_event {
            return true;
        }
    }
    
    false
}

fn is_valid_activation_event_v2(event: &str) -> bool {
    const VALID_EVENTS_V2: &[&str] = &[
        "*",
        "onStartupFinished",
        "onCommand:",
        "onLanguage:",
        "onDebug:",
        "onDebugResolve:",
        "onDebugInitialConfigurations",
        "onDebugDynamicConfigurations:",
        "workspaceContains:",
        "onFileSystem:",
        "onSearch:",
        "onView:",
        "onUri",
        "onWebviewPanel:",
        "onCustomEditor:",
        "onAuthenticationRequest:",
        "onOpenExternalUri:",
        "onTerminalProfile:"
    ];
    
    // Check exact match or pattern match
    for valid_event in VALID_EVENTS_V2 {
        if valid_event.ends_with(':') && *valid_event != "onUri" {
            if event.starts_with(valid_event) {
                return true;
            }
        } else if event == *valid_event {
            return true;
        }
    }
    
    false
}

fn is_valid_category_v2(category: &str) -> bool {
    const VALID_CATEGORIES_V2: &[&str] = &[
        "Programming Languages",
        "Snippets",
        "Linters",
        "Themes", 
        "Debuggers",
        "Formatters",
        "Keymaps",
        "SCM Providers",
        "Extension Packs",
        "Language Packs",
        "Data Science",
        "Machine Learning",
        "Visualization",
        "Notebooks",
        "Education",
        "Testing",
        "Other"
    ];
    
    VALID_CATEGORIES_V2.contains(&category)
}

fn validate_capabilities_v2(capabilities: &PluginCapabilities, warnings: &mut Vec<String>) {
    // Check for conflicting capability declarations
    if let (Some(untrusted), Some(virtual_ws)) = (&capabilities.untrusted_workspaces, &capabilities.virtual_workspaces) {
        if !untrusted.supported && virtual_ws.supported {
            warnings.push("Plugin supports virtual workspaces but not untrusted workspaces. This may limit functionality.".to_string());
        }
    }
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