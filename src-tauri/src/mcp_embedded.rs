/// Embedded MCP Server
/// This module contains the MCP server code embedded directly in the binary
/// All dependencies are bundled - no external files needed

/// Bundled MCP server for stdio transport (used by Claude Desktop)
pub const MCP_SERVER_CODE: &str = include_str!("../resources/mcp-bundle/mcp-server.js");

/// Launcher script for stdio transport
pub const MCP_INDEX_CODE: &str = r#"#!/usr/bin/env node
/**
 * Lokus MCP Server Launcher (stdio transport)
 * Auto-generated bundled version
 */
require('./mcp-server.js');
"#;

/// Bundled HTTP server for HTTP transport (used by Claude CLI)
/// This is a fully bundled version with all dependencies included
pub const MCP_HTTP_SERVER_CODE: &str = include_str!("../resources/mcp-bundle/http-server-bundle.js");

use std::fs;
use std::path::PathBuf;

/// Extract the embedded MCP server to ~/.lokus/mcp-server/
/// All files are self-contained bundles - no external dependencies needed
pub fn extract_mcp_server() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let mcp_dir = home.join(".lokus").join("mcp-server");

    // Create directory if it doesn't exist
    fs::create_dir_all(&mcp_dir)
        .map_err(|e| format!("Failed to create MCP directory: {}", e))?;

    // Write bundled MCP server file (for stdio transport - Claude Desktop)
    let server_path = mcp_dir.join("mcp-server.js");
    fs::write(&server_path, MCP_SERVER_CODE)
        .map_err(|e| format!("Failed to write MCP server: {}", e))?;

    // Write stdio index file (launcher for Desktop)
    let index_path = mcp_dir.join("index.js");
    fs::write(&index_path, MCP_INDEX_CODE)
        .map_err(|e| format!("Failed to write MCP index: {}", e))?;

    // Write bundled HTTP server file (for HTTP transport - Claude CLI)
    // This is a fully self-contained bundle with all tools/resources included
    let http_server_path = mcp_dir.join("http-server.js");
    fs::write(&http_server_path, MCP_HTTP_SERVER_CODE)
        .map_err(|e| format!("Failed to write HTTP server: {}", e))?;

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

        // Make mcp-server.js executable
        let mut server_perms = fs::metadata(&server_path)
            .map_err(|e| format!("Failed to read server permissions: {}", e))?
            .permissions();
        server_perms.set_mode(0o755);
        fs::set_permissions(&server_path, server_perms)
            .map_err(|e| format!("Failed to set server permissions: {}", e))?;
    }

    Ok(index_path)
}
