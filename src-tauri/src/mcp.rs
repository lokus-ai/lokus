/**
 * MCP Server Management Module
 * 
 * Handles MCP server lifecycle management in the Tauri backend:
 * - Spawns Node.js process to run the MCP server
 * - Manages server state and process lifecycle
 * - Provides IPC commands for frontend communication
 */

use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tokio::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerStatus {
    pub is_running: bool,
    pub port: u16,
    pub pid: Option<u32>,
    pub url: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug)]
pub struct MCPServerManager {
    process: Arc<Mutex<Option<Child>>>,
    status: Arc<Mutex<MCPServerStatus>>,
    _app_handle: AppHandle,
}

impl MCPServerManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(MCPServerStatus {
                is_running: false,
                port: 3456,
                pid: None,
                url: None,
                last_error: None,
            })),
            _app_handle: app_handle,
        }
    }

    pub fn start_server(&self, port: Option<u16>) -> Result<MCPServerStatus, String> {
        let mut process_guard = self.process.lock().map_err(|e| format!("Mutex error: {}", e))?;
        let mut status_guard = self.status.lock().map_err(|e| format!("Mutex error: {}", e))?;

        // Check if already running
        if status_guard.is_running {
            return Ok(status_guard.clone());
        }

        let port = port.unwrap_or(3456);
        
        // Get the project root directory and find the MCP server script
        let current_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        
        // In development, current_dir is src-tauri, so we need to go up one level
        let project_root = if current_dir.file_name().unwrap_or_default() == "src-tauri" {
            current_dir.parent().unwrap_or(&current_dir).to_path_buf()
        } else {
            current_dir.clone()
        };
        
        let server_script = project_root.join("src").join("mcp-server").join("standalone.js");
        
        // Verify the script exists
        if !server_script.exists() {
            return Err(format!(
                "MCP server script not found at: {}. Current dir: {}, Project root: {}", 
                server_script.display(),
                current_dir.display(),
                project_root.display()
            ));
        }

        // Start the Node.js process
        let mut command = Command::new("node");
        command
            .arg(server_script.to_string_lossy().to_string())
            .arg("--port")
            .arg(port.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = command.spawn()
            .map_err(|e| format!("Failed to start MCP server: {}", e))?;

        let pid = child.id();

        // Update process and status
        *process_guard = Some(child);
        status_guard.is_running = true;
        status_guard.port = port;
        status_guard.pid = Some(pid);
        status_guard.url = Some(format!("http://localhost:{}", port));
        status_guard.last_error = None;

        println!("🔌 MCP Server started on port {} with PID {}", port, pid);

        Ok(status_guard.clone())
    }

    pub fn stop_server(&self) -> Result<MCPServerStatus, String> {
        let mut process_guard = self.process.lock().map_err(|e| format!("Mutex error: {}", e))?;
        let mut status_guard = self.status.lock().map_err(|e| format!("Mutex error: {}", e))?;

        if let Some(mut child) = process_guard.take() {
            // Try to terminate gracefully first
            if let Err(e) = child.kill() {
                println!("Warning: Failed to kill MCP server process: {}", e);
            }

            // Wait for the process to exit
            if let Err(e) = child.wait() {
                println!("Warning: Failed to wait for MCP server process: {}", e);
            }

            println!("🔌 MCP Server stopped (PID: {:?})", status_guard.pid);
        }

        // Update status
        status_guard.is_running = false;
        status_guard.pid = None;
        status_guard.url = None;
        status_guard.last_error = None;

        Ok(status_guard.clone())
    }

    pub fn get_status(&self) -> Result<MCPServerStatus, String> {
        let status_guard = self.status.lock().map_err(|e| format!("Mutex error: {}", e))?;
        Ok(status_guard.clone())
    }

    pub fn restart_server(&self, port: Option<u16>) -> Result<MCPServerStatus, String> {
        // Stop first
        self.stop_server()?;
        
        // Small delay to ensure clean shutdown
        std::thread::sleep(Duration::from_millis(100));
        
        // Start again
        self.start_server(port)
    }

    pub fn check_health(&self) -> Result<bool, String> {
        let status_guard = self.status.lock().map_err(|e| format!("Mutex error: {}", e))?;
        
        if !status_guard.is_running {
            return Ok(false);
        }

        // Check if the process is still alive
        let mut process_guard = self.process.lock().map_err(|e| format!("Mutex error: {}", e))?;
        
        if let Some(child) = process_guard.as_mut() {
            match child.try_wait() {
                Ok(Some(_)) => {
                    // Process has exited
                    drop(process_guard);
                    drop(status_guard);
                    self.stop_server()?;
                    Ok(false)
                }
                Ok(None) => {
                    // Process is still running
                    Ok(true)
                }
                Err(e) => {
                    Err(format!("Failed to check process status: {}", e))
                }
            }
        } else {
            Ok(false)
        }
    }
}

// Tauri commands
#[tauri::command]
pub async fn mcp_start(
    manager: State<'_, MCPServerManager>,
    port: Option<u16>,
) -> Result<MCPServerStatus, String> {
    manager.start_server(port)
}

#[tauri::command]
pub async fn mcp_stop(
    manager: State<'_, MCPServerManager>,
) -> Result<MCPServerStatus, String> {
    manager.stop_server()
}

#[tauri::command]
pub async fn mcp_status(
    manager: State<'_, MCPServerManager>,
) -> Result<MCPServerStatus, String> {
    manager.get_status()
}

#[tauri::command]
pub async fn mcp_restart(
    manager: State<'_, MCPServerManager>,
    port: Option<u16>,
) -> Result<MCPServerStatus, String> {
    manager.restart_server(port)
}

#[tauri::command]
pub async fn mcp_health_check(
    manager: State<'_, MCPServerManager>,
) -> Result<bool, String> {
    manager.check_health()
}