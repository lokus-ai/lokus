/// Linux-specific platform implementation for Lokus
/// 
/// This module provides Linux-specific implementations of file system operations,
/// system integration, and error handling using common Linux desktop environments
/// and tools.

use super::{
    FileSystemOperations, SystemIntegration, PlatformProvider, PlatformFeature, PlatformConfig,
    errors::{PlatformError, PlatformErrorKind, ErrorMessages}
};
use std::path::Path;
use std::process::Command;

/// Linux platform implementation
pub struct LinuxPlatform {
    initialized: bool,
    desktop_environment: DesktopEnvironment,
}

/// Detected Linux desktop environment
#[derive(Debug, Clone, PartialEq)]
enum DesktopEnvironment {
    Gnome,
    Kde,
    Xfce,
    Unknown,
}

impl LinuxPlatform {
    /// Create a new Linux platform instance
    pub fn new() -> Self {
        Self {
            initialized: false,
            desktop_environment: DesktopEnvironment::Unknown,
        }
    }
    
    /// Detect the current desktop environment
    fn detect_desktop_environment(&self) -> DesktopEnvironment {
        // Check XDG_CURRENT_DESKTOP environment variable
        if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
            let desktop_lower = desktop.to_lowercase();
            if desktop_lower.contains("gnome") {
                return DesktopEnvironment::Gnome;
            } else if desktop_lower.contains("kde") {
                return DesktopEnvironment::Kde;
            } else if desktop_lower.contains("xfce") {
                return DesktopEnvironment::Xfce;
            }
        }
        
        // Fallback: check for specific file managers
        if self.is_command_available("nautilus") {
            DesktopEnvironment::Gnome
        } else if self.is_command_available("dolphin") {
            DesktopEnvironment::Kde
        } else if self.is_command_available("thunar") {
            DesktopEnvironment::Xfce
        } else {
            DesktopEnvironment::Unknown
        }
    }
    
    /// Check if a command is available in PATH
    fn is_command_available(&self, command: &str) -> bool {
        Command::new("which")
            .arg(command)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    /// Check if xdg-open is available (should be on most Linux systems)
    fn is_xdg_open_available(&self) -> bool {
        self.is_command_available("xdg-open")
    }
    
    /// Get the appropriate file manager for the desktop environment
    fn get_file_manager(&self) -> String {
        match self.desktop_environment {
            DesktopEnvironment::Gnome => {
                if self.is_command_available("nautilus") {
                    "nautilus".to_string()
                } else {
                    "xdg-open".to_string()
                }
            }
            DesktopEnvironment::Kde => {
                if self.is_command_available("dolphin") {
                    "dolphin".to_string()
                } else {
                    "xdg-open".to_string()
                }
            }
            DesktopEnvironment::Xfce => {
                if self.is_command_available("thunar") {
                    "thunar".to_string()
                } else {
                    "xdg-open".to_string()
                }
            }
            DesktopEnvironment::Unknown => "xdg-open".to_string(),
        }
    }
    
    /// Get available terminal applications in order of preference
    fn get_available_terminals(&self) -> Vec<String> {
        let terminals = match self.desktop_environment {
            DesktopEnvironment::Gnome => vec![
                "gnome-terminal",
                "tilix",
                "kitty",
                "alacritty",
                "terminator",
                "xterm",
            ],
            DesktopEnvironment::Kde => vec![
                "konsole",
                "kitty",
                "alacritty",
                "terminator",
                "xterm",
            ],
            DesktopEnvironment::Xfce => vec![
                "xfce4-terminal",
                "kitty",
                "alacritty",
                "terminator",
                "xterm",
            ],
            DesktopEnvironment::Unknown => vec![
                "x-terminal-emulator",
                "gnome-terminal",
                "konsole",
                "xfce4-terminal",
                "kitty",
                "alacritty",
                "terminator",
                "xterm",
            ],
        };
        
        terminals
            .into_iter()
            .filter(|&term| self.is_command_available(term))
            .map(|s| s.to_string())
            .collect()
    }
    
    /// Get the preferred terminal for Linux
    fn get_preferred_terminal(&self) -> String {
        let available_terminals = self.get_available_terminals();
        available_terminals
            .first()
            .cloned()
            .unwrap_or_else(|| "xterm".to_string())
    }
    
    /// Launch terminal with the preferred application
    fn launch_terminal(&self, path: &Path) -> Result<(), PlatformError> {
        let path_str = path.display().to_string();
        let available_terminals = self.get_available_terminals();
        
        for terminal in &available_terminals {
            let result = match terminal.as_str() {
                "gnome-terminal" | "tilix" => {
                    Command::new(terminal)
                        .arg("--working-directory")
                        .arg(&path_str)
                        .spawn()
                }
                "konsole" => {
                    Command::new(terminal)
                        .arg("--workdir")
                        .arg(&path_str)
                        .spawn()
                }
                "xfce4-terminal" => {
                    Command::new(terminal)
                        .arg("--working-directory")
                        .arg(&path_str)
                        .spawn()
                }
                "kitty" | "alacritty" => {
                    Command::new(terminal)
                        .arg("--working-directory")
                        .arg(&path_str)
                        .spawn()
                }
                "terminator" => {
                    Command::new(terminal)
                        .arg("--working-directory")
                        .arg(&path_str)
                        .spawn()
                }
                "x-terminal-emulator" => {
                    // Debian/Ubuntu specific terminal launcher
                    Command::new(terminal)
                        .env("PWD", &path_str)
                        .spawn()
                }
                "xterm" => {
                    // Basic fallback
                    Command::new(terminal)
                        .arg("-e")
                        .arg("bash")
                        .current_dir(&path_str)
                        .spawn()
                }
                _ => {
                    // Generic attempt
                    Command::new(terminal)
                        .arg("--working-directory")
                        .arg(&path_str)
                        .spawn()
                }
            };
            
            if result.is_ok() {
                return Ok(());
            }
        }
        
        Err(PlatformError::application_not_found(
            "terminal emulator",
            "open_terminal"
        ))
    }
}

impl FileSystemOperations for LinuxPlatform {
    fn reveal_in_file_manager(&self, path: &Path) -> Result<(), PlatformError> {
        if !path.exists() {
            return Err(PlatformError::file_system(
                ErrorMessages::file_not_found(&path.display().to_string()),
                "reveal_in_file_manager"
            ));
        }
        
        let file_manager = self.get_file_manager();
        let path_str = path.display().to_string();
        
        let result = match file_manager.as_str() {
            "nautilus" => {
                // GNOME Files (Nautilus) - show file/folder selection
                if path.is_file() {
                    Command::new("nautilus")
                        .arg("--select")
                        .arg(&path_str)
                        .spawn()
                } else {
                    Command::new("nautilus")
                        .arg(&path_str)
                        .spawn()
                }
            }
            "dolphin" => {
                // KDE Dolphin - show file/folder selection
                if path.is_file() {
                    Command::new("dolphin")
                        .arg("--select")
                        .arg(&path_str)
                        .spawn()
                } else {
                    Command::new("dolphin")
                        .arg(&path_str)
                        .spawn()
                }
            }
            "thunar" => {
                // XFCE Thunar - open parent directory if it's a file
                if path.is_file() {
                    let parent = path.parent().unwrap_or(Path::new("/"));
                    Command::new("thunar")
                        .arg(parent.display().to_string())
                        .spawn()
                } else {
                    Command::new("thunar")
                        .arg(&path_str)
                        .spawn()
                }
            }
            "xdg-open" => {
                // Generic xdg-open - open parent directory if it's a file
                if path.is_file() {
                    let parent = path.parent().unwrap_or(Path::new("/"));
                    Command::new("xdg-open")
                        .arg(parent.display().to_string())
                        .spawn()
                } else {
                    Command::new("xdg-open")
                        .arg(&path_str)
                        .spawn()
                }
            }
            _ => {
                return Err(PlatformError::application_not_found(
                    &file_manager,
                    "reveal_in_file_manager"
                ));
            }
        };
        
        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                match err.kind() {
                    std::io::ErrorKind::PermissionDenied => {
                        Err(PlatformError::permission_denied("reveal_in_file_manager"))
                    }
                    std::io::ErrorKind::NotFound => {
                        Err(PlatformError::application_not_found(
                            &file_manager,
                            "reveal_in_file_manager"
                        ))
                    }
                    _ => {
                        Err(PlatformError::file_system(
                            ErrorMessages::application_launch_failed(&file_manager),
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
        
        self.launch_terminal(path)
    }
}

impl SystemIntegration for LinuxPlatform {
    fn platform_name(&self) -> &'static str {
        "Linux"
    }
    
    fn supports_feature(&self, feature: PlatformFeature) -> bool {
        match feature {
            PlatformFeature::FileManagerReveal => {
                self.is_xdg_open_available() || !self.get_file_manager().is_empty()
            }
            PlatformFeature::TerminalLaunch => !self.get_available_terminals().is_empty(),
            PlatformFeature::CustomTerminal => {
                self.get_available_terminals().len() > 1 || 
                self.is_command_available("kitty") || 
                self.is_command_available("alacritty")
            }
            PlatformFeature::QuickLook => false, // Linux doesn't have built-in QuickLook
            PlatformFeature::ContextMenus => true, // Linux DEs support context menus
        }
    }
    
    fn get_platform_config(&self) -> PlatformConfig {
        PlatformConfig {
            preferred_terminal: Some(self.get_preferred_terminal()),
            file_manager_name: self.get_file_manager(),
            native_dialogs: true, // Most Linux DEs support native dialogs
            path_separator: '/',
        }
    }
}

impl PlatformProvider for LinuxPlatform {
    fn initialize(&mut self) -> Result<(), PlatformError> {
        if self.initialized {
            return Ok(());
        }
        
        // Detect desktop environment
        self.desktop_environment = self.detect_desktop_environment();
        
        // Validate that essential Linux tools are available
        if !self.is_xdg_open_available() && self.get_file_manager().is_empty() {
            return Err(PlatformError::system(
                "No file manager available (xdg-open or desktop-specific file manager)",
                "platform_initialization"
            ));
        }
        
        if self.get_available_terminals().is_empty() {
            return Err(PlatformError::system(
                "No terminal emulator available",
                "platform_initialization"
            ));
        }
        
        self.initialized = true;
        Ok(())
    }
    
    fn cleanup(&mut self) -> Result<(), PlatformError> {
        // Perform any Linux-specific cleanup here
        self.initialized = false;
        Ok(())
    }
}

impl Default for LinuxPlatform {
    fn default() -> Self {
        Self::new()
    }
}

/// Linux-specific utility functions
impl LinuxPlatform {
    /// Get information about the Linux distribution
    pub fn get_distribution_info(&self) -> Result<String, PlatformError> {
        // Try to read /etc/os-release first
        if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
            return Ok(content);
        }
        
        // Fallback to lsb_release if available
        if self.is_command_available("lsb_release") {
            let output = Command::new("lsb_release")
                .arg("-a")
                .output();
                
            match output {
                Ok(output) => {
                    if output.status.success() {
                        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
                    }
                }
                Err(_) => {}
            }
        }
        
        // Final fallback to uname
        let output = Command::new("uname")
            .arg("-a")
            .output();
            
        match output {
            Ok(output) => {
                if output.status.success() {
                    Ok(String::from_utf8_lossy(&output.stdout).to_string())
                } else {
                    Err(PlatformError::system(
                        "Failed to get distribution information",
                        "get_distribution_info"
                    ))
                }
            }
            Err(err) => {
                Err(PlatformError::from(err))
            }
        }
    }
    
    /// Check if running on Wayland
    pub fn is_wayland(&self) -> bool {
        std::env::var("WAYLAND_DISPLAY").is_ok() || 
        std::env::var("XDG_SESSION_TYPE").map(|s| s == "wayland").unwrap_or(false)
    }
    
    /// Check if running on X11
    pub fn is_x11(&self) -> bool {
        std::env::var("DISPLAY").is_ok() && !self.is_wayland()
    }
    
    /// Get the detected desktop environment
    pub fn get_desktop_environment(&self) -> &DesktopEnvironment {
        &self.desktop_environment
    }
    
    /// Open a file with the default application
    pub fn open_with_default_app(&self, path: &Path) -> Result<(), PlatformError> {
        if !path.exists() {
            return Err(PlatformError::file_system(
                ErrorMessages::file_not_found(&path.display().to_string()),
                "open_with_default_app"
            ));
        }
        
        let result = Command::new("xdg-open")
            .arg(path.display().to_string())
            .spawn();
            
        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                match err.kind() {
                    std::io::ErrorKind::NotFound => {
                        Err(PlatformError::application_not_found(
                            "xdg-open",
                            "open_with_default_app"
                        ))
                    }
                    _ => {
                        Err(PlatformError::from(err))
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[test]
    fn test_linux_platform_creation() {
        let platform = LinuxPlatform::new();
        assert_eq!(platform.platform_name(), "Linux");
        assert!(!platform.initialized);
    }
    
    #[test]
    fn test_linux_platform_config() {
        let platform = LinuxPlatform::new();
        let config = platform.get_platform_config();
        
        assert!(!config.file_manager_name.is_empty());
        assert_eq!(config.path_separator, '/');
        assert!(config.native_dialogs);
        assert!(config.preferred_terminal.is_some());
    }
    
    #[test]
    fn test_feature_support() {
        let platform = LinuxPlatform::new();
        
        // Context menus should be supported on Linux
        assert!(platform.supports_feature(PlatformFeature::ContextMenus));
        
        // QuickLook is not supported on Linux
        assert!(!platform.supports_feature(PlatformFeature::QuickLook));
    }
    
    #[test]
    fn test_invalid_path_handling() {
        let platform = LinuxPlatform::new();
        let invalid_path = PathBuf::from("/NonExistentPath/File.txt");
        
        let result = platform.reveal_in_file_manager(&invalid_path);
        assert!(result.is_err());
        
        if let Err(error) = result {
            assert_eq!(error.kind, PlatformErrorKind::FileSystem);
        }
    }
    
    #[test]
    fn test_desktop_environment_detection() {
        let platform = LinuxPlatform::new();
        let detected = platform.detect_desktop_environment();
        
        // Should return some valid desktop environment
        match detected {
            DesktopEnvironment::Gnome |
            DesktopEnvironment::Kde |
            DesktopEnvironment::Xfce |
            DesktopEnvironment::Unknown => {} // All are valid
        }
    }
    
    #[test]
    fn test_terminal_preference_logic() {
        let platform = LinuxPlatform::new();
        let preferred = platform.get_preferred_terminal();
        
        // Should return some terminal name
        assert!(!preferred.is_empty());
    }
    
    #[test]
    fn test_command_availability_check() {
        let platform = LinuxPlatform::new();
        
        // Test with a command that should exist on all Linux systems
        assert!(platform.is_command_available("ls"));
        
        // Test with a command that definitely doesn't exist
        assert!(!platform.is_command_available("this_command_definitely_does_not_exist_12345"));
    }
    
    #[test]
    fn test_wayland_x11_detection() {
        let platform = LinuxPlatform::new();
        
        // At least one should be false (can't run both simultaneously)
        // This is more of a smoke test to ensure the functions don't panic
        let wayland = platform.is_wayland();
        let x11 = platform.is_x11();
        
        // Both could be false (headless), but both can't be true
        assert!(!(wayland && x11));
    }
}