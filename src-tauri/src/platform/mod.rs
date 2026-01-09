/// Platform abstraction layer for Lokus
/// 
/// This module provides trait-based abstractions for platform-specific operations,
/// ensuring clear separation between platform-specific code and business logic.

pub mod errors;
pub mod clipboard;
pub mod system_info;
pub mod examples;

#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(any(target_os = "android", target_os = "ios"))]
pub mod mobile;

use errors::PlatformError;
use std::path::Path;

/// Trait for file system operations that vary by platform
pub trait FileSystemOperations {
    /// Reveal a file or directory in the platform's file manager
    /// 
    /// # Arguments
    /// * `path` - The path to the file or directory to reveal
    /// 
    /// # Returns
    /// * `Ok(())` if the operation succeeded
    /// * `Err(PlatformError)` if the operation failed
    fn reveal_in_file_manager(&self, path: &Path) -> Result<(), PlatformError>;
    
    /// Open a terminal at the specified directory
    /// 
    /// # Arguments
    /// * `path` - The directory path where the terminal should open
    /// 
    /// # Returns
    /// * `Ok(())` if the operation succeeded
    /// * `Err(PlatformError)` if the operation failed
    fn open_terminal(&self, path: &Path) -> Result<(), PlatformError>;
}

/// Trait for system integration operations
pub trait SystemIntegration {
    /// Get the platform name for debugging/logging purposes
    fn platform_name(&self) -> &'static str;
    
    /// Check if a specific feature is supported on this platform
    fn supports_feature(&self, feature: PlatformFeature) -> bool;
    
    /// Get platform-specific configuration or behavior hints
    fn get_platform_config(&self) -> PlatformConfig;
}

/// Features that may or may not be available on different platforms
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlatformFeature {
    FileManagerReveal,
    TerminalLaunch,
    CustomTerminal,
    QuickLook,
    ContextMenus,
}

/// Platform-specific configuration and behavior hints
#[derive(Debug, Clone)]
pub struct PlatformConfig {
    /// Preferred terminal application
    pub preferred_terminal: Option<String>,
    /// File manager application name
    pub file_manager_name: String,
    /// Whether the platform supports native file dialogs
    pub native_dialogs: bool,
    /// Path separator for this platform
    pub path_separator: char,
}

/// Main platform provider - returns the appropriate implementation for the current OS
pub fn get_platform_provider() -> Box<dyn PlatformProvider> {
    #[cfg(target_os = "windows")]
    return Box::new(windows::WindowsPlatform::new());
    
    #[cfg(target_os = "macos")]
    return Box::new(macos::MacOsPlatform::new());
    
    #[cfg(target_os = "linux")]
    return Box::new(linux::LinuxPlatform::new());

    #[cfg(any(target_os = "android", target_os = "ios"))]
    return Box::new(mobile::MobilePlatform::new());
}

/// Combined trait that all platform implementations must provide
pub trait PlatformProvider: FileSystemOperations + SystemIntegration + Send + Sync {
    /// Initialize any platform-specific resources
    fn initialize(&mut self) -> Result<(), PlatformError>;
    
    /// Clean up platform-specific resources
    #[allow(dead_code)]
    fn cleanup(&mut self) -> Result<(), PlatformError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_provider_creation() {
        let provider = get_platform_provider();
        
        // Basic smoke test - ensure we can create a provider
        assert!(!provider.platform_name().is_empty());
    }
    
    #[test]
    fn test_platform_features() {
        let provider = get_platform_provider();
        
        // All platforms should support basic file operations
        assert!(provider.supports_feature(PlatformFeature::FileManagerReveal));
        assert!(provider.supports_feature(PlatformFeature::TerminalLaunch));
    }
}