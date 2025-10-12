/// Embedded MCP Server
/// This module contains the MCP server code embedded directly in the binary

pub const MCP_SERVER_CODE: &str = include_str!("../resources/mcp-bundle/mcp-server.js");
pub const MCP_INDEX_CODE: &str = r#"#!/usr/bin/env node
/**
 * Lokus MCP Server Launcher
 * Auto-generated bundled version
 */
require('./mcp-server.js');
"#;

use std::fs;
use std::path::PathBuf;

/// Extract the embedded MCP server to a temporary directory
pub fn extract_mcp_server() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let mcp_dir = home.join(".lokus").join("mcp-server");

    // Create directory if it doesn't exist
    fs::create_dir_all(&mcp_dir)
        .map_err(|e| format!("Failed to create MCP directory: {}", e))?;

    // Write MCP server file
    let server_path = mcp_dir.join("mcp-server.js");
    fs::write(&server_path, MCP_SERVER_CODE)
        .map_err(|e| format!("Failed to write MCP server: {}", e))?;

    // Write index file
    let index_path = mcp_dir.join("index.js");
    fs::write(&index_path, MCP_INDEX_CODE)
        .map_err(|e| format!("Failed to write MCP index: {}", e))?;

    // Make index executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&index_path)
            .map_err(|e| format!("Failed to read permissions: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&index_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    println!("[MCP Embedded] Extracted MCP server to: {:?}", index_path);
    Ok(index_path)
}