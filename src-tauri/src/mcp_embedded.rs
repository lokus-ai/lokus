/// Embedded MCP Server
/// This module contains the MCP server code embedded directly in the binary

pub const MCP_SERVER_CODE: &str = include_str!("../resources/mcp-bundle/mcp-server.js");
pub const MCP_INDEX_CODE: &str = r#"#!/usr/bin/env node
/**
 * Lokus MCP Server Launcher (stdio transport)
 * Auto-generated bundled version
 */
require('./mcp-server.js');
"#;

// TODO: Bundle http-server.js properly - for now use source
// This will be replaced with proper bundled version
pub const MCP_HTTP_SERVER_CODE: &str = include_str!("../../src/mcp-server/http-server.js");

use std::fs;
use std::path::PathBuf;

/// Extract the embedded MCP server to a temporary directory
pub fn extract_mcp_server() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let mcp_dir = home.join(".lokus").join("mcp-server");

    // Create directory if it doesn't exist
    fs::create_dir_all(&mcp_dir)
        .map_err(|e| format!("Failed to create MCP directory: {}", e))?;

    // Write bundled MCP server file (for stdio transport)
    let server_path = mcp_dir.join("mcp-server.js");
    fs::write(&server_path, MCP_SERVER_CODE)
        .map_err(|e| format!("Failed to write MCP server: {}", e))?;

    // Write stdio index file (for Desktop)
    let index_path = mcp_dir.join("index.js");
    fs::write(&index_path, MCP_INDEX_CODE)
        .map_err(|e| format!("Failed to write MCP index: {}", e))?;

    // Write HTTP server file (for CLI)
    let http_server_path = mcp_dir.join("http-server.js");
    fs::write(&http_server_path, MCP_HTTP_SERVER_CODE)
        .map_err(|e| format!("Failed to write HTTP server: {}", e))?;

    // Copy tools directory for http-server.js dependencies
    // In dev mode, create symlink; in production, this would be bundled
    #[cfg(debug_assertions)]
    {
        let source_tools = std::env::current_dir()
            .ok()
            .and_then(|d| Some(d.parent()?.join("src/mcp-server")));

        if let Some(source_dir) = source_tools {
            if source_dir.exists() {
                let target_tools = mcp_dir.join("tools");
                let target_utils = mcp_dir.join("utils");
                let target_resources = mcp_dir.join("resources");
                let target_workspace_matcher = mcp_dir.join("workspace-matcher.js");

                // Remove old symlinks/dirs if they exist
                let _ = fs::remove_dir_all(&target_tools);
                let _ = fs::remove_dir_all(&target_utils);
                let _ = fs::remove_dir_all(&target_resources);
                let _ = fs::remove_file(&target_workspace_matcher);

                // Create symlinks (faster in dev)
                #[cfg(unix)]
                {
                    use std::os::unix::fs::symlink;
                    let _ = symlink(source_dir.join("tools"), &target_tools);
                    let _ = symlink(source_dir.join("utils"), &target_utils);
                    let _ = symlink(source_dir.join("resources"), &target_resources);
                    let _ = symlink(source_dir.join("workspace-matcher.js"), &target_workspace_matcher);
                }

                // On Windows or if symlink fails, copy instead
                #[cfg(not(unix))]
                {
                    fn copy_dir_all(src: impl AsRef<std::path::Path>, dst: impl AsRef<std::path::Path>) -> std::io::Result<()> {
                        std::fs::create_dir_all(&dst)?;
                        for entry in std::fs::read_dir(src)? {
                            let entry = entry?;
                            if entry.file_type()?.is_dir() {
                                copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
                            } else {
                                std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
                            }
                        }
                        Ok(())
                    }

                    let _ = copy_dir_all(source_dir.join("tools"), &target_tools);
                    let _ = copy_dir_all(source_dir.join("utils"), &target_utils);
                    let _ = copy_dir_all(source_dir.join("resources"), &target_resources);
                    let _ = std::fs::copy(source_dir.join("workspace-matcher.js"), &target_workspace_matcher);
                }

                println!("[MCP Embedded] ✅ Linked development tools directory");
            }
        }
    }

    // Make scripts executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        // Make index.js executable
        let mut perms = fs::metadata(&index_path)
            .map_err(|e| format!("Failed to read permissions: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&index_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;

        // Make http-server.js executable
        let mut http_perms = fs::metadata(&http_server_path)
            .map_err(|e| format!("Failed to read HTTP server permissions: {}", e))?
            .permissions();
        http_perms.set_mode(0o755);
        fs::set_permissions(&http_server_path, http_perms)
            .map_err(|e| format!("Failed to set HTTP server permissions: {}", e))?;
    }

    println!("[MCP Embedded] ✅ Extracted MCP servers:");
    println!("[MCP Embedded]    - stdio: {:?}", index_path);
    println!("[MCP Embedded]    - http: {:?}", http_server_path);

    Ok(index_path)
}