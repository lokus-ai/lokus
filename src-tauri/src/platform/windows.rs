/// Windows-specific platform implementation for Lokus
/// 
/// This module provides Windows-specific implementations of file system operations,
/// system integration, and error handling.

use super::{
    FileSystemOperations, SystemIntegration, PlatformProvider, PlatformFeature, PlatformConfig,
    errors::{PlatformError, ErrorMessages}
};
use std::path::Path;
use std::process::Command;

/// Windows platform implementation
pub struct WindowsPlatform {
    initialized: bool,
}

impl WindowsPlatform {
    /// Create a new Windows platform instance
    pub fn new() -> Self {
        Self {
            initialized: false,
        }
    }
    
    /// Check if Windows Explorer is available
    fn is_explorer_available(&self) -> bool {
        // Explorer should always be available on Windows
        true
    }
    
    /// Check if PowerShell is available
    fn is_powershell_available(&self) -> bool {
        Command::new("powershell")
            .arg("-Command")
            .arg("exit 0")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    /// Check if Windows Terminal is available
    fn is_windows_terminal_available(&self) -> bool {
        Command::new("wt")
            .arg("--help")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    /// Get the preferred terminal for Windows
    fn get_preferred_terminal(&self) -> String {
        if self.is_windows_terminal_available() {
            "Windows Terminal".to_string()
        } else if self.is_powershell_available() {
            "PowerShell".to_string()
        } else {
            "Command Prompt".to_string()
        }
    }
}

impl FileSystemOperations for WindowsPlatform {
    fn reveal_in_file_manager(&self, path: &Path) -> Result<(), PlatformError> {
        if !path.exists() {
            return Err(PlatformError::file_system(
                ErrorMessages::file_not_found(&path.display().to_string()),
                "reveal_in_file_manager"
            ));
        }
        
        if !self.is_explorer_available() {
            return Err(PlatformError::application_not_found(
                "Windows Explorer",
                "reveal_in_file_manager"
            ));
        }
        
        // Windows Explorer requires specific formatting for the select command
        let path_str = path.display().to_string();
        
        // Build the command properly - /select,"path" needs to be a single argument
        let select_arg = format!("/select,\"{}\"", path_str);
        
        let result = Command::new("explorer")
            .arg(select_arg)
            .spawn();
            
        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                match err.kind() {
                    std::io::ErrorKind::PermissionDenied => {
                        Err(PlatformError::permission_denied("reveal_in_file_manager"))
                    }
                    std::io::ErrorKind::NotFound => {
                        Err(PlatformError::application_not_found(
                            "Windows Explorer",
                            "reveal_in_file_manager"
                        ))
                    }
                    _ => {
                        Err(PlatformError::file_system(
                            ErrorMessages::application_launch_failed("Windows Explorer"),
                            "reveal_in_file_manager"
                        ))
                    }
                }
            }
        }
    }
    
    fn open_terminal(&self, path: &Path) -> Result<(), PlatformError> {
        if !path.exists() {
            return Err(PlatformError::file_system(
                ErrorMessages::file_not_found(&path.display().to_string()),
                "open_terminal"
            ));
        }
        
        if !path.is_dir() {
            return Err(PlatformError::invalid_input(
                "Path must be a directory",
                "open_terminal"
            ));
        }
        
        let path_str = path.display().to_string();
        
        // Try Windows Terminal first (modern approach)
        if self.is_windows_terminal_available() {
            let result = Command::new("wt")
                .arg("-d")
                .arg(&path_str)
                .spawn();
                
            if result.is_ok() {
                return Ok(());
            }
        }
        
        // Fall back to PowerShell
        if self.is_powershell_available() {
            let result = Command::new("powershell")
                .arg("-NoExit")
                .arg("-Command")
                .arg(&format!("cd '{}'; $Host.UI.RawUI.WindowTitle = 'PowerShell - {}'", path_str, path.file_name().unwrap_or_default().to_string_lossy()))
                .spawn();
                
            if result.is_ok() {
                return Ok(());
            }
        }
        
        // Final fallback to cmd
        let result = Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("cmd")
            .arg("/k")
            .arg(&format!("cd /d \"{}\"", path_str))
            .spawn();
            
        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                match err.kind() {
                    std::io::ErrorKind::PermissionDenied => {
                        Err(PlatformError::permission_denied("open_terminal"))
                    }
                    std::io::ErrorKind::NotFound => {
                        Err(PlatformError::application_not_found(
                            "Command Prompt",
                            "open_terminal"
                        ))
                    }
                    _ => {
                        Err(PlatformError::file_system(
                            ErrorMessages::application_launch_failed("terminal"),
                            "open_terminal"
                        ))
                    }
                }
            }
        }
    }
}

impl SystemIntegration for WindowsPlatform {
    fn platform_name(&self) -> &'static str {
        "Windows"
    }
    
    fn supports_feature(&self, feature: PlatformFeature) -> bool {
        match feature {
            PlatformFeature::FileManagerReveal => self.is_explorer_available(),
            PlatformFeature::TerminalLaunch => true, // cmd should always be available
            PlatformFeature::CustomTerminal => self.is_windows_terminal_available() || self.is_powershell_available(),
            PlatformFeature::QuickLook => false, // Windows doesn't have QuickLook
            PlatformFeature::ContextMenus => true, // Windows supports context menus
        }
    }
    
    fn get_platform_config(&self) -> PlatformConfig {
        PlatformConfig {
            preferred_terminal: Some(self.get_preferred_terminal()),
            file_manager_name: "Windows Explorer".to_string(),
            native_dialogs: true,
            path_separator: '\\',
        }
    }
}

impl PlatformProvider for WindowsPlatform {
    fn initialize(&mut self) -> Result<(), PlatformError> {
        if self.initialized {
            return Ok(());
        }
        
        // Perform any Windows-specific initialization here
        // For now, just validate that basic Windows tools are available
        if !self.is_explorer_available() {
            return Err(PlatformError::system(
                "Windows Explorer is not available",
                "platform_initialization"
            ));
        }
        
        self.initialized = true;
        Ok(())
    }
    
    fn cleanup(&mut self) -> Result<(), PlatformError> {
        // Perform any Windows-specific cleanup here
        self.initialized = false;
        Ok(())
    }
}

impl Default for WindowsPlatform {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[test]
    fn test_windows_platform_creation() {
        let platform = WindowsPlatform::new();
        assert_eq!(platform.platform_name(), "Windows");
        assert!(!platform.initialized);
    }
    
    #[test]
    fn test_windows_platform_config() {
        let platform = WindowsPlatform::new();
        let config = platform.get_platform_config();
        
        assert_eq!(config.file_manager_name, "Windows Explorer");
        assert_eq!(config.path_separator, '\\');
        assert!(config.native_dialogs);
        assert!(config.preferred_terminal.is_some());
    }
    
    #[test]
    fn test_feature_support() {
        let platform = WindowsPlatform::new();
        
        // These should always be supported on Windows
        assert!(platform.supports_feature(PlatformFeature::FileManagerReveal));
        assert!(platform.supports_feature(PlatformFeature::TerminalLaunch));
        assert!(platform.supports_feature(PlatformFeature::ContextMenus));
        
        // QuickLook is not supported on Windows
        assert!(!platform.supports_feature(PlatformFeature::QuickLook));
    }
    
    #[test]
    fn test_invalid_path_handling() {
        let platform = WindowsPlatform::new();
        let invalid_path = PathBuf::from("C:\\NonExistentPath\\File.txt");
        
        let result = platform.reveal_in_file_manager(&invalid_path);
        assert!(result.is_err());
        
        if let Err(error) = result {
            assert_eq!(error.kind, PlatformErrorKind::FileSystem);
        }
    }
}