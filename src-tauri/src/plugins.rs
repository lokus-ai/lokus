use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::io::{Read, Write};
use tauri_plugin_store::{StoreBuilder, JsonValue};
use tauri::{AppHandle, Manager};
use reqwest;
use url::Url;
use tempfile::NamedTempFile;
use zip::ZipArchive;
use sha2::{Sha256, Digest};
use semver::Version;

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
pub struct InstallProgress {
    pub step: String,
    pub progress: f32, // 0.0 to 1.0
    pub message: String,
}

#[derive(Serialize, Debug)]
pub struct GitHubRepoInfo {
    pub owner: String,
    pub repo: String,
    pub branch: Option<String>,
    pub tag: Option<String>,
    pub download_url: String,
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

#[derive(Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub plugin_name: Option<String>,
    pub error: Option<String>,
    pub warnings: Vec<String>,
    pub installation_log: Option<InstallationLog>,
}

#[tauri::command]
pub async fn install_plugin_from_path(path: String) -> Result<InstallResult, String> {
    match install_plugin(path.clone()).await {
        Ok(plugin_name) => {
            // Read the manifest to get the version
            let plugins_dir_path = PathBuf::from(get_plugins_directory()?);
            let plugin_path = plugins_dir_path.join(&plugin_name);
            let version = if let Ok(plugin_info) = load_plugin_info(&plugin_path) {
                plugin_info.manifest.version
            } else {
                "unknown".to_string()
            };
            
            let log = InstallationLog {
                plugin_name: plugin_name.clone(),
                version,
                installed_at: chrono::Utc::now().to_rfc3339(),
                install_method: "local_path".to_string(),
                source_url: None,
                checksum: None,
            };
            
            // Save installation log
            let _ = save_installation_log(&log);
            
            Ok(InstallResult {
                success: true,
                message: format!("Plugin '{}' installed successfully", plugin_name),
                plugin_name: Some(plugin_name),
                error: None,
                warnings: vec![],
                installation_log: Some(log),
            })
        },
        Err(error) => Ok(InstallResult {
            success: false,
            message: "Installation failed".to_string(),
            plugin_name: None,
            error: Some(error),
            warnings: vec![],
            installation_log: None,
        }),
    }
}

#[tauri::command]
pub async fn install_plugin_from_url(url: String) -> Result<InstallResult, String> {
    let mut warnings = Vec::new();
    
    // Parse and validate the URL
    let github_info = match parse_github_url(&url) {
        Ok(info) => info,
        Err(e) => {
            return Ok(InstallResult {
                success: false,
                message: "Invalid GitHub URL".to_string(),
                plugin_name: None,
                error: Some(e),
                warnings: vec![],
                installation_log: None,
            });
        }
    };
    
    let plugins_dir = PathBuf::from(create_plugins_directory()?);
    
    // Download the ZIP file
    match download_and_install_from_github(&github_info, &plugins_dir).await {
        Ok((plugin_name, log)) => {
            Ok(InstallResult {
                success: true,
                message: format!("Plugin '{}' installed successfully from GitHub", plugin_name),
                plugin_name: Some(plugin_name),
                error: None,
                warnings,
                installation_log: Some(log),
            })
        }
        Err(e) => {
            Ok(InstallResult {
                success: false,
                message: "GitHub installation failed".to_string(),
                plugin_name: None,
                error: Some(e),
                warnings,
                installation_log: None,
            })
        }
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
        
        let mut outpath = temp_dir.path().join(file.name());
        
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

// GitHub URL parsing and handling functions
fn parse_github_url(url: &str) -> Result<GitHubRepoInfo, String> {
    let parsed_url = Url::parse(url)
        .map_err(|e| format!("Invalid URL format: {}", e))?;
    
    if parsed_url.host_str() != Some("github.com") {
        return Err("Only GitHub URLs are currently supported".to_string());
    }
    
    let path_segments: Vec<&str> = parsed_url.path_segments()
        .ok_or("Invalid GitHub URL path")?
        .collect();
    
    if path_segments.len() < 2 {
        return Err("GitHub URL must include owner and repository name".to_string());
    }
    
    let owner = path_segments[0].to_string();
    let repo = path_segments[1].to_string();
    
    // Handle different GitHub URL formats
    let (branch, tag) = if path_segments.len() >= 4 && path_segments[2] == "tree" {
        (Some(path_segments[3].to_string()), None)
    } else if path_segments.len() >= 4 && path_segments[2] == "releases" && path_segments[3] == "tag" && path_segments.len() >= 5 {
        (None, Some(path_segments[4].to_string()))
    } else {
        (Some("main".to_string()), None) // Default to main branch
    };
    
    // Construct download URL
    let download_url = if let Some(tag_name) = &tag {
        format!("https://github.com/{}/{}/archive/refs/tags/{}.zip", owner, repo, tag_name)
    } else if let Some(branch_name) = &branch {
        format!("https://github.com/{}/{}/archive/refs/heads/{}.zip", owner, repo, branch_name)
    } else {
        format!("https://github.com/{}/{}/archive/refs/heads/main.zip", owner, repo)
    };
    
    Ok(GitHubRepoInfo {
        owner,
        repo,
        branch,
        tag,
        download_url,
    })
}

async fn download_and_install_from_github(
    github_info: &GitHubRepoInfo,
    plugins_dir: &Path,
) -> Result<(String, InstallationLog), String> {
    // Create a temporary file for the download
    let mut temp_file = NamedTempFile::new()
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;
    
    // Download the ZIP file
    let client = reqwest::Client::new();
    let response = client
        .get(&github_info.download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download from GitHub: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub returned error: {}", response.status()));
    }
    
    let content = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download content: {}", e))?;
    
    // Calculate checksum
    let mut hasher = Sha256::new();
    hasher.update(&content);
    let checksum = format!("{:x}", hasher.finalize());
    
    // Write to temporary file
    temp_file.write_all(&content)
        .map_err(|e| format!("Failed to write downloaded content: {}", e))?;
    
    // Install from the downloaded ZIP
    let plugin_name = install_plugin_from_zip(temp_file.path(), plugins_dir).await?;
    
    // Read the manifest to get the version
    let plugins_dir_path = PathBuf::from(get_plugins_directory()?);
    let plugin_path = plugins_dir_path.join(&plugin_name);
    let version = if let Ok(plugin_info) = load_plugin_info(&plugin_path) {
        plugin_info.manifest.version
    } else {
        "unknown".to_string()
    };
    
    // Create installation log
    let log = InstallationLog {
        plugin_name: plugin_name.clone(),
        version,
        installed_at: chrono::Utc::now().to_rfc3339(),
        install_method: "github_url".to_string(),
        source_url: Some(github_info.download_url.clone()),
        checksum: Some(checksum),
    };
    
    // Save installation log
    let _ = save_installation_log(&log);
    
    Ok((plugin_name, log))
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
            } else {
                match validate_version_format(&manifest.version) {
                    Ok(version) => {
                        // Check version compatibility with Lokus
                        if let Err(compat_error) = check_version_compatibility(&version) {
                            warnings.push(compat_error);
                        }
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
            
            // Validate dependencies
            if let Some(dependencies) = &manifest.dependencies {
                for (dep_name, dep_version) in dependencies {
                    match validate_dependency(dep_name, dep_version) {
                        Ok(warning) => {
                            if let Some(w) = warning {
                                warnings.push(w);
                            }
                        }
                        Err(e) => {
                            errors.push(ValidationError {
                                field: "dependencies".to_string(),
                                message: format!("Dependency '{}': {}", dep_name, e),
                            });
                        }
                    }
                }
            }
            
            // Enhanced security validation
            if let Err(security_errors) = validate_plugin_security(&manifest) {
                errors.extend(security_errors);
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

// Enhanced validation functions
fn validate_version_format(version: &str) -> Result<Version, String> {
    Version::parse(version)
        .map_err(|e| format!("Invalid semantic version format: {}", e))
}

fn check_version_compatibility(plugin_version: &Version) -> Result<(), String> {
    // Define minimum and maximum supported plugin API versions
    let min_supported = Version::parse("1.0.0").unwrap();
    let max_supported = Version::parse("2.0.0").unwrap();
    
    if plugin_version < &min_supported {
        Err(format!("Plugin version {} is too old. Minimum supported version is {}", plugin_version, min_supported))
    } else if plugin_version >= &max_supported {
        Err(format!("Plugin version {} may not be compatible. Maximum tested version is {}", plugin_version, max_supported))
    } else {
        Ok(())
    }
}

fn validate_dependency(dep_name: &str, dep_version: &str) -> Result<Option<String>, String> {
    // List of known and supported dependencies
    let supported_deps = [
        "react", "react-dom", "typescript", "javascript",
        "markdown", "katex", "codemirror", "prosemirror",
    ];
    
    if !supported_deps.contains(&dep_name) {
        return Err(format!("Unsupported dependency: {}", dep_name));
    }
    
    // Validate version format
    if dep_version.starts_with('^') || dep_version.starts_with('~') || dep_version.starts_with(">=") {
        // Version range - validate the base version
        let base_version = dep_version.trim_start_matches(['^', '~', '>', '=', ' '].as_ref());
        validate_version_format(base_version)?;
        Ok(Some(format!("Using version range '{}' for dependency '{}'", dep_version, dep_name)))
    } else if dep_version == "*" || dep_version == "latest" {
        Ok(Some(format!("Using latest version for dependency '{}' - consider pinning to specific version", dep_name)))
    } else {
        // Exact version
        validate_version_format(dep_version)?;
        Ok(None)
    }
}

fn validate_plugin_security(manifest: &PluginManifest) -> Result<(), Vec<ValidationError>> {
    let mut errors = Vec::new();
    
    // Check for dangerous permission combinations
    let has_file_write = manifest.permissions.contains(&"write:files".to_string());
    let has_execute = manifest.permissions.contains(&"execute:commands".to_string());
    let has_network = manifest.permissions.iter().any(|p| p.starts_with("network:"));
    
    if has_file_write && has_execute {
        errors.push(ValidationError {
            field: "permissions".to_string(),
            message: "Combination of file write and execute permissions requires additional security review".to_string(),
        });
    }
    
    if has_network && has_file_write {
        errors.push(ValidationError {
            field: "permissions".to_string(),
            message: "Combination of network and file write permissions requires additional security review".to_string(),
        });
    }
    
    // Validate main entry point extension
    if !manifest.main.ends_with(".js") && !manifest.main.ends_with(".ts") && !manifest.main.ends_with(".jsx") && !manifest.main.ends_with(".tsx") {
        errors.push(ValidationError {
            field: "main".to_string(),
            message: "Main entry point must be a JavaScript or TypeScript file".to_string(),
        });
    }
    
    // Check for suspicious keywords in description
    let suspicious_keywords = ["hack", "exploit", "bypass", "admin", "root", "sudo"];
    let description_lower = manifest.description.to_lowercase();
    for keyword in suspicious_keywords {
        if description_lower.contains(keyword) {
            errors.push(ValidationError {
                field: "description".to_string(),
                message: format!("Description contains potentially suspicious keyword: {}", keyword),
            });
        }
    }
    
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
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

// === Installation History and Update Management ===

#[tauri::command]
pub fn get_installation_history() -> Result<Vec<InstallationLog>, String> {
    let home = get_home_dir()?;
    let history_file = home.join(".lokus").join("plugin_history.json");
    
    if !history_file.exists() {
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&history_file)
        .map_err(|e| format!("Failed to read installation history: {}", e))?;
    
    let history: Vec<InstallationLog> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse installation history: {}", e))?;
    
    Ok(history)
}

fn save_installation_log(log: &InstallationLog) -> Result<(), String> {
    let home = get_home_dir()?;
    let lokus_dir = home.join(".lokus");
    let history_file = lokus_dir.join("plugin_history.json");
    
    // Ensure .lokus directory exists
    if !lokus_dir.exists() {
        fs::create_dir_all(&lokus_dir)
            .map_err(|e| format!("Failed to create .lokus directory: {}", e))?;
    }
    
    // Load existing history
    let mut history = if history_file.exists() {
        let content = fs::read_to_string(&history_file)
            .map_err(|e| format!("Failed to read existing history: {}", e))?;
        serde_json::from_str::<Vec<InstallationLog>>(&content)
            .unwrap_or_default()
    } else {
        vec![]
    };
    
    // Add new log entry
    history.push(log.clone());
    
    // Keep only the last 100 entries
    if history.len() > 100 {
        history = history.into_iter().skip(history.len() - 100).collect();
    }
    
    // Save updated history
    let updated_content = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    
    fs::write(&history_file, updated_content)
        .map_err(|e| format!("Failed to write installation history: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn check_plugin_updates() -> Result<Vec<String>, String> {
    let plugins = list_plugins()?;
    let mut updatable_plugins = Vec::new();
    
    for plugin in plugins {
        if let Some(repo_url) = &plugin.manifest.repository {
            // For GitHub repositories, we can check for updates
            if repo_url.contains("github.com") {
                // This would require calling GitHub API to check for new releases
                // For now, we'll just add plugins that have repository URLs
                updatable_plugins.push(plugin.manifest.name);
            }
        }
    }
    
    Ok(updatable_plugins)
}

#[tauri::command]
pub async fn update_plugin(plugin_name: String) -> Result<InstallResult, String> {
    // Get plugin info
    let plugin_info = get_plugin_info(plugin_name.clone())?;
    
    if let Some(repo_url) = &plugin_info.manifest.repository {
        if repo_url.contains("github.com") {
            // Backup current plugin
            backup_plugin(&plugin_name)?;
            
            // Install new version
            match install_plugin_from_url(repo_url.clone()).await {
                Ok(result) => {
                    if result.success {
                        // Clean up backup if installation successful
                        let _ = cleanup_plugin_backup(&plugin_name);
                        Ok(result)
                    } else {
                        // Restore backup if installation failed
                        restore_plugin_backup(&plugin_name)?;
                        Ok(result)
                    }
                }
                Err(e) => {
                    // Restore backup if installation failed
                    restore_plugin_backup(&plugin_name)?;
                    Err(e)
                }
            }
        } else {
            Ok(InstallResult {
                success: false,
                message: "Plugin update not supported".to_string(),
                plugin_name: Some(plugin_name),
                error: Some("Only GitHub-hosted plugins support automatic updates".to_string()),
                warnings: vec![],
                installation_log: None,
            })
        }
    } else {
        Ok(InstallResult {
            success: false,
            message: "No repository URL found".to_string(),
            plugin_name: Some(plugin_name),
            error: Some("Plugin manifest doesn't specify a repository URL".to_string()),
            warnings: vec![],
            installation_log: None,
        })
    }
}

// === Backup and Restore Functions ===

fn backup_plugin(plugin_name: &str) -> Result<(), String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let plugin_path = plugins_dir.join(plugin_name);
    let backup_path = plugins_dir.join(format!("{}.backup", plugin_name));
    
    if !plugin_path.exists() {
        return Err(format!("Plugin '{}' not found", plugin_name));
    }
    
    if backup_path.exists() {
        fs::remove_dir_all(&backup_path)
            .map_err(|e| format!("Failed to remove existing backup: {}", e))?;
    }
    
    copy_directory(&plugin_path, &backup_path)
        .map_err(|e| format!("Failed to create plugin backup: {}", e))?;
    
    Ok(())
}

fn restore_plugin_backup(plugin_name: &str) -> Result<(), String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let plugin_path = plugins_dir.join(plugin_name);
    let backup_path = plugins_dir.join(format!("{}.backup", plugin_name));
    
    if !backup_path.exists() {
        return Err(format!("No backup found for plugin '{}'", plugin_name));
    }
    
    // Remove current plugin if it exists
    if plugin_path.exists() {
        fs::remove_dir_all(&plugin_path)
            .map_err(|e| format!("Failed to remove current plugin: {}", e))?;
    }
    
    // Restore from backup
    copy_directory(&backup_path, &plugin_path)
        .map_err(|e| format!("Failed to restore plugin backup: {}", e))?;
    
    Ok(())
}

fn cleanup_plugin_backup(plugin_name: &str) -> Result<(), String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let backup_path = plugins_dir.join(format!("{}.backup", plugin_name));
    
    if backup_path.exists() {
        fs::remove_dir_all(&backup_path)
            .map_err(|e| format!("Failed to cleanup plugin backup: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn backup_all_plugins() -> Result<String, String> {
    let plugins = list_plugins()?;
    let home = get_home_dir()?;
    let backup_dir = home.join(".lokus").join("backups").join(&chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string());
    
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    
    for plugin in plugins {
        let plugin_name = &plugin.manifest.name;
        let source_path = PathBuf::from(&plugin.path);
        let dest_path = backup_dir.join(plugin_name);
        
        copy_directory(&source_path, &dest_path)
            .map_err(|e| format!("Failed to backup plugin '{}': {}", plugin_name, e))?;
    }
    
    Ok(backup_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_plugins_from_backup(backup_path: String) -> Result<Vec<String>, String> {
    let backup_dir = PathBuf::from(backup_path);
    
    if !backup_dir.exists() {
        return Err("Backup directory does not exist".to_string());
    }
    
    let plugins_dir = PathBuf::from(create_plugins_directory()?);
    let mut restored_plugins = Vec::new();
    
    for entry in fs::read_dir(&backup_dir)
        .map_err(|e| format!("Failed to read backup directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read backup entry: {}", e))?;
        
        if entry.path().is_dir() {
            let plugin_name = entry.file_name().to_string_lossy().to_string();
            let source_path = entry.path();
            let dest_path = plugins_dir.join(&plugin_name);
            
            // Remove existing plugin if it exists
            if dest_path.exists() {
                fs::remove_dir_all(&dest_path)
                    .map_err(|e| format!("Failed to remove existing plugin '{}': {}", plugin_name, e))?;
            }
            
            // Restore plugin
            copy_directory(&source_path, &dest_path)
                .map_err(|e| format!("Failed to restore plugin '{}': {}", plugin_name, e))?;
            
            restored_plugins.push(plugin_name);
        }
    }
    
    Ok(restored_plugins)
}

// === Bulk Installation Support ===

#[derive(Serialize, Debug)]
pub struct BulkInstallResult {
    pub total: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<InstallResult>,
}

#[tauri::command]
pub async fn bulk_install_plugins(urls: Vec<String>) -> Result<BulkInstallResult, String> {
    let mut results = Vec::new();
    let total = urls.len();
    let mut successful = 0;
    let mut failed = 0;
    
    for url in urls {
        match install_plugin_from_url(url).await {
            Ok(result) => {
                if result.success {
                    successful += 1;
                } else {
                    failed += 1;
                }
                results.push(result);
            }
            Err(e) => {
                failed += 1;
                results.push(InstallResult {
                    success: false,
                    message: "Installation failed".to_string(),
                    plugin_name: None,
                    error: Some(e),
                    warnings: vec![],
                    installation_log: None,
                });
            }
        }
    }
    
    Ok(BulkInstallResult {
        total,
        successful,
        failed,
        results,
    })
}

// === Plugin Runtime Support ===

#[tauri::command]
pub fn get_plugin_code(plugin_id: String) -> Result<String, String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let plugin_dir = plugins_dir.join(&plugin_id);
    
    if !plugin_dir.exists() {
        return Err(format!("Plugin '{}' not found", plugin_id));
    }
    
    // Read plugin manifest to get main file
    let manifest_path = plugin_dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(format!("Plugin manifest not found for '{}'", plugin_id));
    }
    
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin manifest: {}", e))?;
    
    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse plugin manifest: {}", e))?;
    
    // Read main file
    let main_file_path = plugin_dir.join(&manifest.main);
    if !main_file_path.exists() {
        return Err(format!("Main file '{}' not found for plugin '{}'", manifest.main, plugin_id));
    }
    
    let plugin_code = fs::read_to_string(&main_file_path)
        .map_err(|e| format!("Failed to read plugin main file: {}", e))?;
    
    Ok(plugin_code)
}

#[tauri::command]
pub fn get_plugin_manifest(plugin_id: String) -> Result<PluginManifest, String> {
    let plugins_dir = PathBuf::from(get_plugins_directory()?);
    let plugin_dir = plugins_dir.join(&plugin_id);
    
    if !plugin_dir.exists() {
        return Err(format!("Plugin '{}' not found", plugin_id));
    }
    
    let manifest_path = plugin_dir.join("plugin.json");
    if !manifest_path.exists() {
        return Err(format!("Plugin manifest not found for '{}'", plugin_id));
    }
    
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin manifest: {}", e))?;
    
    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse plugin manifest: {}", e))?;
    
    Ok(manifest)
}

#[tauri::command]
pub fn get_workspace_folders() -> Result<Vec<String>, String> {
    // This would be implemented to return the current workspace folders
    // For now, return a placeholder
    Ok(vec!["/Users/user/workspace".to_string()])
}

#[tauri::command]
pub fn open_text_document(path: String) -> Result<String, String> {
    // This would be implemented to open a text document in the editor
    // For now, return success message
    Ok(format!("Document opened: {}", path))
}

#[tauri::command]
pub async fn execute_command(app: AppHandle, command: String, args: Vec<String>) -> Result<String, String> {
    // Emit command execution event for the frontend to handle
    app.emit("command-execute", serde_json::json!({
        "command": command,
        "args": args
    })).map_err(|e| format!("Failed to emit command: {}", e))?;
    
    Ok("Command executed".to_string())
}

#[tauri::command]
pub async fn notify_plugin_activated(app: AppHandle, plugin_id: String) -> Result<(), String> {
    // Emit plugin activation event
    app.emit("plugin-activated", serde_json::json!({
        "pluginId": plugin_id
    })).map_err(|e| format!("Failed to emit plugin activated event: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn notify_plugin_deactivated(app: AppHandle, plugin_id: String) -> Result<(), String> {
    // Emit plugin deactivation event
    app.emit("plugin-deactivated", serde_json::json!({
        "pluginId": plugin_id
    })).map_err(|e| format!("Failed to emit plugin deactivated event: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn show_message_dialog(app: AppHandle, message_type: String, message: String, items: Vec<String>) -> Result<String, String> {
    // Emit show message event for the frontend to handle
    app.emit("show-message", serde_json::json!({
        "type": message_type,
        "message": message,
        "items": items
    })).map_err(|e| format!("Failed to show message dialog: {}", e))?;
    
    Ok("Message shown".to_string())
}