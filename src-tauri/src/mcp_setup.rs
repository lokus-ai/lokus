/**
 * MCP Auto-Setup Module
 *
 * Automatically configures MCP integration on first launch.
 * Creates configuration files and sets up AI Desktop integration.
 */

use std::path::PathBuf;
use std::fs;
use serde_json::json;
use tauri::Manager;
use crate::mcp_embedded;

#[derive(Debug)]
pub struct MCPSetup {
    app_handle: tauri::AppHandle,
}

impl MCPSetup {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }

    /// Main setup function - called on first launch or after update
    pub async fn setup(&self) -> Result<(), String> {
        println!("[MCP Setup] Starting automatic MCP configuration...");

        // 1. Get paths
        let mcp_server_path = self.get_bundled_mcp_path()?;
        let ai_config_path = self.get_ai_desktop_config_path()?;

        // 2. Ensure MCP server is executable
        self.make_mcp_executable(&mcp_server_path)?;

        // 3. Create/update AI Desktop configuration
        self.update_ai_desktop_config(&ai_config_path, &mcp_server_path)?;

        // 4. Ensure default workspace exists
        self.ensure_default_workspace()?;

        // 5. Create Lokus config directory
        self.create_lokus_config_dir()?;

        println!("[MCP Setup] ✅ MCP configuration completed successfully!");
        Ok(())
    }

    /// Get path to bundled MCP server
    fn get_bundled_mcp_path(&self) -> Result<PathBuf, String> {
        // First try to find an already extracted version
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        let extracted_path = home.join(".lokus").join("mcp-server").join("index.js");

        if extracted_path.exists() {
            println!("[MCP Setup] Using existing extracted MCP server at: {:?}", extracted_path);
            return Ok(extracted_path);
        }

        // Extract the embedded MCP server
        println!("[MCP Setup] Extracting embedded MCP server...");
        let mcp_path = mcp_embedded::extract_mcp_server()?;
        println!("[MCP Setup] Successfully extracted MCP server to: {:?}", mcp_path);

        Ok(mcp_path)
    }

    /// Get path to AI Desktop config
    fn get_ai_desktop_config_path(&self) -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;

        #[cfg(target_os = "macos")]
        let config_path = home.join("Library/Application Support/Claude/claude_desktop_config.json");

        #[cfg(target_os = "windows")]
        let config_path = home.join("AppData/Roaming/Claude/claude_desktop_config.json");

        #[cfg(target_os = "linux")]
        let config_path = home.join(".config/Claude/claude_desktop_config.json");

        // Create directory if it doesn't exist
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        Ok(config_path)
    }

    /// Make MCP server executable (Unix only)
    #[cfg(unix)]
    fn make_mcp_executable(&self, path: &PathBuf) -> Result<(), String> {
        use std::os::unix::fs::PermissionsExt;

        let mut perms = fs::metadata(path)
            .map_err(|e| format!("Failed to read MCP server metadata: {}", e))?
            .permissions();

        perms.set_mode(0o755); // rwxr-xr-x

        fs::set_permissions(path, perms)
            .map_err(|e| format!("Failed to make MCP server executable: {}", e))?;

        println!("[MCP Setup] Made MCP server executable");
        Ok(())
    }

    #[cfg(not(unix))]
    fn make_mcp_executable(&self, _path: &PathBuf) -> Result<(), String> {
        // Windows doesn't need chmod
        Ok(())
    }

    /// Update or create AI Desktop config
    fn update_ai_desktop_config(&self, config_path: &PathBuf, mcp_path: &PathBuf) -> Result<(), String> {
        // Read existing config or create new one
        let mut config = if config_path.exists() {
            let content = fs::read_to_string(config_path)
                .map_err(|e| format!("Failed to read AI config: {}", e))?;

            serde_json::from_str(&content)
                .unwrap_or_else(|_| json!({}))
        } else {
            json!({})
        };

        // Add or update Lokus MCP server
        if let Some(obj) = config.as_object_mut() {
            // Ensure mcpServers object exists
            if !obj.contains_key("mcpServers") {
                obj.insert("mcpServers".to_string(), json!({}));
            }

            if let Some(mcp_servers) = obj.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
                // Add Lokus MCP server configuration
                mcp_servers.insert("lokus".to_string(), json!({
                    "command": "node",
                    "args": [mcp_path.to_string_lossy()],
                    "env": {}
                }));
            }
        }

        // Write updated config
        let config_str = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(config_path, config_str)
            .map_err(|e| format!("Failed to write AI config: {}", e))?;

        println!("[MCP Setup] ✅ Updated AI Desktop config at: {:?}", config_path);
        Ok(())
    }

    /// Ensure default workspace exists
    fn ensure_default_workspace(&self) -> Result<(), String> {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        let workspace = home.join("Documents").join("Lokus Workspace");

        if !workspace.exists() {
            fs::create_dir_all(&workspace)
                .map_err(|e| format!("Failed to create default workspace: {}", e))?;

            // Create .lokus directory
            fs::create_dir_all(workspace.join(".lokus"))
                .map_err(|e| format!("Failed to create .lokus directory: {}", e))?;

            // Create welcome note
            let welcome = r#"# Welcome to Lokus! 👋

This is your default workspace. Here's what you can do:

## Features
- 📝 Create notes with rich text editing
- 🔗 Link notes with [[WikiLinks]]
- 📁 Organize with folders
- 🔍 Search everything instantly
- 🤖 Use AI to help with your notes

## Getting Started
1. Create a new note (Cmd/Ctrl + N)
2. Start writing!
3. Use [[links]] to connect ideas
4. Ask AI for help anytime

Happy note-taking! ✨
"#;

            fs::write(workspace.join("Welcome.md"), welcome)
                .map_err(|e| format!("Failed to create welcome note: {}", e))?;

            println!("[MCP Setup] ✅ Created default workspace at: {:?}", workspace);
        }

        Ok(())
    }

    /// Create Lokus config directory
    fn create_lokus_config_dir(&self) -> Result<(), String> {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        let lokus_config = home.join(".lokus");

        fs::create_dir_all(&lokus_config)
            .map_err(|e| format!("Failed to create .lokus config directory: {}", e))?;

        println!("[MCP Setup] ✅ Created Lokus config directory");
        Ok(())
    }

    /// Check if setup has been completed
    pub fn is_setup_complete(&self) -> bool {
        if let Ok(config_path) = self.get_ai_desktop_config_path() {
            if !config_path.exists() {
                return false;
            }

            // Check if lokus MCP server is configured
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                    return config
                        .get("mcpServers")
                        .and_then(|s| s.get("lokus"))
                        .is_some();
                }
            }
        }

        false
    }
}

/// Tauri command to manually trigger MCP setup
#[tauri::command]
pub async fn setup_mcp_integration(app: tauri::AppHandle) -> Result<String, String> {
    let setup = MCPSetup::new(app);
    setup.setup().await?;
    Ok("MCP integration configured successfully!".to_string())
}

/// Tauri command to check MCP setup status
#[tauri::command]
pub fn check_mcp_status(app: tauri::AppHandle) -> Result<bool, String> {
    let setup = MCPSetup::new(app);
    Ok(setup.is_setup_complete())
}
