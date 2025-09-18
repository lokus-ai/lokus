/// macOS-specific platform implementation for Lokus
/// 
/// This module provides macOS-specific implementations of file system operations,
/// system integration, and error handling using native macOS tools and conventions.

use super::{
    FileSystemOperations, SystemIntegration, PlatformProvider, PlatformFeature, PlatformConfig,
    errors::{PlatformError, PlatformErrorKind, ErrorMessages}
};
use std::path::Path;
use std::process::Command;

/// macOS platform implementation
pub struct MacOsPlatform {
    initialized: bool,
}

impl MacOsPlatform {
    /// Create a new macOS platform instance
    pub fn new() -> Self {
        Self {
            initialized: false,
        }
    }
    
    /// Check if Finder is available (should always be true on macOS)
    fn is_finder_available(&self) -> bool {
        Command::new("open")
            .arg("--help")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    /// Check if Terminal.app is available
    fn is_terminal_available(&self) -> bool {
        std::path::Path::new("/Applications/Utilities/Terminal.app").exists()
    }
    
    /// Check if iTerm2 is available
    fn is_iterm_available(&self) -> bool {
        std::path::Path::new("/Applications/iTerm.app").exists()
    }
    
    /// Check if Warp terminal is available
    fn is_warp_available(&self) -> bool {
        std::path::Path::new("/Applications/Warp.app").exists()
    }
    
    /// Get the preferred terminal for macOS
    fn get_preferred_terminal(&self) -> String {
        if self.is_iterm_available() {
            "iTerm2".to_string()
        } else if self.is_warp_available() {
            "Warp".to_string()
        } else if self.is_terminal_available() {
            "Terminal".to_string()
        } else {
            "Terminal".to_string() // fallback
        }
    }
    
    /// Launch terminal with the preferred application
    fn launch_preferred_terminal(&self, path: &Path) -> Result<(), PlatformError> {
        let path_str = path.display().to_string();
        
        // Try iTerm2 first if available
        if self.is_iterm_available() {
            let result = Command::new("open")
                .arg("-a")
                .arg("iTerm")
                .arg(&path_str)
                .spawn();
                
            if result.is_ok() {
                return Ok(());
            }
        }
        
        // Try Warp if available
        if self.is_warp_available() {
            let result = Command::new("open")
                .arg("-a")
                .arg("Warp")
                .arg(&path_str)
                .spawn();
                
            if result.is_ok() {
                return Ok(());
            }
        }
        
        // Fall back to Terminal.app
        let result = Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(&path_str)
            .spawn();
            
        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                Err(PlatformError::from(err))
            }
        }
    }
}

impl FileSystemOperations for MacOsPlatform {
    fn reveal_in_file_manager(&self, path: &Path) -> Result<(), PlatformError> {
        if !path.exists() {
            return Err(PlatformError::file_system(
                ErrorMessages::file_not_found(&path.display().to_string()),
                "reveal_in_file_manager"
            ));
        }
        
        if !self.is_finder_available() {
            return Err(PlatformError::application_not_found(
                "Finder",
                "reveal_in_file_manager"
            ));
        }
        
        let path_str = path.display().to_string();
        let result = Command::new("open")
            .arg("-R")
            .arg(&path_str)
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
                            "Finder",
                            "reveal_in_file_manager"
                        ))
                    }
                    _ => {
                        Err(PlatformError::file_system(
                            ErrorMessages::application_launch_failed("Finder"),
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
        
        self.launch_preferred_terminal(path)
    }
}

impl SystemIntegration for MacOsPlatform {
    fn platform_name(&self) -> &'static str {
        "macOS"
    }
    
    fn supports_feature(&self, feature: PlatformFeature) -> bool {
        match feature {
            PlatformFeature::FileManagerReveal => self.is_finder_available(),
            PlatformFeature::TerminalLaunch => self.is_terminal_available(),
            PlatformFeature::CustomTerminal => self.is_iterm_available() || self.is_warp_available(),
            PlatformFeature::QuickLook => true, // macOS has built-in QuickLook
            PlatformFeature::ContextMenus => true, // macOS supports context menus
        }
    }
    
    fn get_platform_config(&self) -> PlatformConfig {
        PlatformConfig {
            preferred_terminal: Some(self.get_preferred_terminal()),
            file_manager_name: "Finder".to_string(),
            native_dialogs: true,
            path_separator: '/',
        }
    }
}

impl PlatformProvider for MacOsPlatform {
    fn initialize(&mut self) -> Result<(), PlatformError> {
        if self.initialized {
            return Ok(());
        }
        
        // Perform any macOS-specific initialization here
        // Validate that essential macOS tools are available
        if !self.is_finder_available() {
            return Err(PlatformError::system(
                "Finder is not available",
                "platform_initialization"
            ));
        }
        
        if !self.is_terminal_available() {
            return Err(PlatformError::system(
                "Terminal.app is not available",
                "platform_initialization"
            ));
        }
        
        self.initialized = true;
        Ok(())
    }
    
    fn cleanup(&mut self) -> Result<(), PlatformError> {
        // Perform any macOS-specific cleanup here
        self.initialized = false;
        Ok(())
    }
}

impl Default for MacOsPlatform {
    fn default() -> Self {
        Self::new()
    }
}

/// macOS-specific utility functions
impl MacOsPlatform {
    /// Open a file with QuickLook
    pub fn quick_look(&self, path: &Path) -> Result<(), PlatformError> {
        if !path.exists() {
            return Err(PlatformError::file_system(
                ErrorMessages::file_not_found(&path.display().to_string()),
                "quick_look"
            ));
        }
        
        let result = Command::new("qlmanage")
            .arg("-p")
            .arg(path.display().to_string())
            .spawn();
            
        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                match err.kind() {
                    std::io::ErrorKind::NotFound => {
                        Err(PlatformError::unsupported("QuickLook"))
                    }
                    _ => {
                        Err(PlatformError::from(err))
                    }
                }
            }
        }
    }
    
    /// Get system information using macOS tools
    pub fn get_system_info(&self) -> Result<String, PlatformError> {
        let output = Command::new("sw_vers")
            .output();
            
        match output {
            Ok(output) => {
                if output.status.success() {
                    Ok(String::from_utf8_lossy(&output.stdout).to_string())
                } else {
                    Err(PlatformError::system(
                        "Failed to get system information",
                        "get_system_info"
                    ))
                }
            }
            Err(err) => {
                Err(PlatformError::from(err))
            }
        }
    }
    
    /// Check if running on Apple Silicon
    pub fn is_apple_silicon(&self) -> bool {
        Command::new("uname")
            .arg("-m")
            .output()
            .map(|output| {
                let arch = String::from_utf8_lossy(&output.stdout);
                arch.trim() == "arm64"
            })
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[test]
    fn test_macos_platform_creation() {
        let platform = MacOsPlatform::new();
        assert_eq!(platform.platform_name(), "macOS");
        assert!(!platform.initialized);
    }
    
    #[test]
    fn test_macos_platform_config() {
        let platform = MacOsPlatform::new();
        let config = platform.get_platform_config();
        
        assert_eq!(config.file_manager_name, "Finder");
        assert_eq!(config.path_separator, '/');
        assert!(config.native_dialogs);
        assert!(config.preferred_terminal.is_some());
    }
    
    #[test]
    fn test_feature_support() {
        let platform = MacOsPlatform::new();
        
        // These should be supported on macOS
        assert!(platform.supports_feature(PlatformFeature::QuickLook));
        assert!(platform.supports_feature(PlatformFeature::ContextMenus));
        
        // These depend on system availability but should generally be true
        // We can't guarantee in tests but the logic should be correct
    }
    
    #[test]
    fn test_invalid_path_handling() {
        let platform = MacOsPlatform::new();
        let invalid_path = PathBuf::from("/NonExistentPath/File.txt");
        
        let result = platform.reveal_in_file_manager(&invalid_path);
        assert!(result.is_err());
        
        if let Err(error) = result {
            assert_eq!(error.kind, PlatformErrorKind::FileSystem);
        }
    }
    
    #[test]
    fn test_terminal_preference_logic() {
        let platform = MacOsPlatform::new();
        let preferred = platform.get_preferred_terminal();
        
        // Should return some terminal name
        assert!(!preferred.is_empty());
        assert!(preferred.contains("Terminal") || preferred.contains("iTerm") || preferred.contains("Warp"));
    }
}