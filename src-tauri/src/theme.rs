use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::fs;
use tauri::{AppHandle, Emitter};
use dirs;
use thiserror::Error;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemePayload {
  pub tokens: Option<HashMap<String, String>>, // CSS vars like {"--bg":"15 23 42", ...}
  pub mode:   Option<String>,                   // "light" | "dark" | "system"
  pub accent: Option<String>,                   // preset key or "r g b"
  pub scope:  Option<String>,                   // "global" (we’ll use this now)
}

#[derive(Error, Debug)]
pub enum ThemeError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Theme already exists: {0}")]
    #[allow(dead_code)]
    AlreadyExists(String),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ThemeTokens {
    #[serde(flatten)]
    pub tokens: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ThemeManifest {
    pub name: String,
    pub tokens: ThemeTokens,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ThemeValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub manifest: Option<ThemeManifest>,
}

// Required theme tokens for validation
const REQUIRED_TOKENS: &[&str] = &[
    "--bg", "--text", "--panel", "--border", "--muted", "--accent", "--accent-fg"
];

// Optional but recommended tokens
const RECOMMENDED_TOKENS: &[&str] = &[
    "--task-todo", "--task-progress", "--task-urgent", "--task-question",
    "--task-completed", "--task-cancelled", "--task-delegated",
    "--danger", "--success", "--warning", "--info",
    "--editor-placeholder"
];

#[allow(dead_code)]
pub fn get_themes_directory() -> Result<PathBuf, ThemeError> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| ThemeError::Validation("Could not find home directory".to_string()))?;

    let themes_dir = home_dir.join(".lokus").join("themes");

    // Create directory if it doesn't exist
    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir)?;

        // Set restrictive permissions on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&themes_dir, fs::Permissions::from_mode(0o755))?;
        }
    }

    Ok(themes_dir)
}

fn validate_color_value(value: &str) -> bool {
    // Check if it's a valid RGB space-separated format (e.g., "255 128 0")
    if let Ok(_) = value.split_whitespace()
        .map(|s| s.parse::<u8>())
        .collect::<Result<Vec<_>, _>>()
    {
        return value.split_whitespace().count() == 3;
    }

    // Check if it's a valid hex color
    if value.starts_with('#') && value.len() == 7 {
        return value[1..].chars().all(|c| c.is_ascii_hexdigit());
    }

    // Check if it's a valid hex color without #
    if value.len() == 6 && value.chars().all(|c| c.is_ascii_hexdigit()) {
        return true;
    }

    // Check for CSS color keywords or functions
    let css_colors = &["inherit", "transparent", "currentColor"];
    if css_colors.contains(&value) {
        return true;
    }

    // Check for CSS functions like rgb(), rgba(), hsl(), etc.
    if value.starts_with("rgb(") || value.starts_with("rgba(") ||
       value.starts_with("hsl(") || value.starts_with("hsla(") {
        return true;
    }

    false
}

pub fn validate_theme_manifest(manifest: &ThemeManifest) -> ThemeValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Check if name is not empty
    if manifest.name.trim().is_empty() {
        errors.push("Theme name cannot be empty".to_string());
    }

    // Check for required tokens
    for &token in REQUIRED_TOKENS {
        if !manifest.tokens.tokens.contains_key(token) {
            errors.push(format!("Missing required token: {}", token));
        } else if let Some(value) = manifest.tokens.tokens.get(token) {
            if !validate_color_value(value) {
                errors.push(format!("Invalid color value for {}: {}", token, value));
            }
        }
    }

    // Check for recommended tokens
    for &token in RECOMMENDED_TOKENS {
        if !manifest.tokens.tokens.contains_key(token) {
            warnings.push(format!("Missing recommended token: {}", token));
        } else if let Some(value) = manifest.tokens.tokens.get(token) {
            if !validate_color_value(value) {
                warnings.push(format!("Invalid color value for {}: {}", token, value));
            }
        }
    }

    // Validate all other tokens
    for (token, value) in &manifest.tokens.tokens {
        if !token.starts_with("--") {
            warnings.push(format!("Token should start with '--': {}", token));
        }

        if !validate_color_value(value) && !REQUIRED_TOKENS.contains(&token.as_str()) && !RECOMMENDED_TOKENS.contains(&token.as_str()) {
            warnings.push(format!("Potentially invalid color value for {}: {}", token, value));
        }
    }

    let is_valid = errors.is_empty();
    ThemeValidationResult {
        valid: is_valid,
        errors,
        warnings,
        manifest: if is_valid { Some(manifest.clone()) } else { None },
    }
}

#[tauri::command]
pub fn theme_broadcast(app: AppHandle, payload: ThemePayload) -> Result<(), String> {
  app.emit("theme:apply", payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn validate_theme_file(file_path: String) -> Result<ThemeValidationResult, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;

    let manifest: ThemeManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse theme JSON: {}", e))?;

    Ok(validate_theme_manifest(&manifest))
}

#[tauri::command]
pub fn import_theme_file(file_path: String, overwrite: bool) -> Result<String, String> {
    // Read and validate the theme file
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;

    let manifest: ThemeManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse theme JSON: {}", e))?;

    // Validate the theme
    let validation = validate_theme_manifest(&manifest);
    if !validation.valid {
        return Err(format!("Theme validation failed: {}", validation.errors.join(", ")));
    }

    // Generate safe filename from theme name
    let safe_name = manifest.name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .to_lowercase();

    if safe_name.is_empty() {
        return Err("Theme name contains no valid characters".to_string());
    }

    // Get themes directory
    let themes_dir = get_themes_directory()
        .map_err(|e| format!("Failed to access themes directory: {}", e))?;

    let theme_file = themes_dir.join(format!("{}.json", safe_name));

    // Check if theme already exists
    if theme_file.exists() && !overwrite {
        return Err(format!("Theme '{}' already exists. Set overwrite=true to replace it.", manifest.name));
    }

    // Write the theme file
    fs::write(&theme_file, serde_json::to_string_pretty(&manifest).unwrap())
        .map_err(|e| format!("Failed to write theme file: {}", e))?;

    // Set file permissions
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&theme_file, fs::Permissions::from_mode(0o644));
    }

    Ok(safe_name)
}

#[tauri::command]
pub fn export_theme(theme_id: String, export_path: String) -> Result<(), String> {
    let themes_dir = get_themes_directory()
        .map_err(|e| format!("Failed to access themes directory: {}", e))?;

    let theme_file = themes_dir.join(format!("{}.json", theme_id));

    if !theme_file.exists() {
        return Err(format!("Theme '{}' not found", theme_id));
    }

    // Copy the theme file to the export path
    fs::copy(&theme_file, &export_path)
        .map_err(|e| format!("Failed to export theme: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_custom_theme(theme_id: String) -> Result<(), String> {
    let themes_dir = get_themes_directory()
        .map_err(|e| format!("Failed to access themes directory: {}", e))?;

    let theme_file = themes_dir.join(format!("{}.json", theme_id));

    if !theme_file.exists() {
        return Err(format!("Theme '{}' not found", theme_id));
    }

    fs::remove_file(&theme_file)
        .map_err(|e| format!("Failed to delete theme: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn list_custom_themes() -> Result<Vec<ThemeManifest>, String> {
    let themes_dir = get_themes_directory()
        .map_err(|e| format!("Failed to access themes directory: {}", e))?;

    let mut themes = Vec::new();

    if themes_dir.exists() {
        for entry in fs::read_dir(&themes_dir)
            .map_err(|e| format!("Failed to read themes directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        match serde_json::from_str::<ThemeManifest>(&content) {
                            Ok(manifest) => themes.push(manifest),
                            Err(_e) => {
                            }
                        }
                    }
                    Err(_e) => {
                    }
                }
            }
        }
    }

    Ok(themes)
}

#[tauri::command]
pub fn get_theme_tokens(theme_id: String) -> Result<HashMap<String, String>, String> {
    let themes_dir = get_themes_directory()
        .map_err(|e| format!("Failed to access themes directory: {}", e))?;

    let theme_file = themes_dir.join(format!("{}.json", theme_id));

    if !theme_file.exists() {
        return Err(format!("Theme '{}' not found", theme_id));
    }

    let content = fs::read_to_string(&theme_file)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;

    let manifest: ThemeManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse theme JSON: {}", e))?;

    Ok(manifest.tokens.tokens)
}

#[tauri::command]
pub fn save_theme_tokens(theme_id: String, tokens: HashMap<String, String>) -> Result<(), String> {
    let themes_dir = get_themes_directory()
        .map_err(|e| format!("Failed to access themes directory: {}", e))?;

    let theme_file = themes_dir.join(format!("{}.json", theme_id));

    if !theme_file.exists() {
        return Err(format!("Theme '{}' not found", theme_id));
    }

    // Read existing manifest to preserve name, author, etc.
    let content = fs::read_to_string(&theme_file)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;

    let mut manifest: ThemeManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse theme JSON: {}", e))?;

    // Update tokens
    manifest.tokens.tokens = tokens;

    // Write back to file
    fs::write(&theme_file, serde_json::to_string_pretty(&manifest).unwrap())
        .map_err(|e| format!("Failed to write theme file: {}", e))?;

    Ok(())
}
