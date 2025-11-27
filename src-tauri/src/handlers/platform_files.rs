/// Platform-abstracted file operations for Lokus
/// 
/// This module provides file system operations that use the platform abstraction layer,
/// ensuring consistent behavior across different operating systems while leveraging
/// platform-specific capabilities.

use crate::platform::{get_platform_provider, PlatformProvider};
use serde::{Serialize, Deserialize};
use std::path::Path;
use std::sync::OnceLock;

/// Global platform provider instance
static PLATFORM_PROVIDER: OnceLock<Box<dyn PlatformProvider>> = OnceLock::new();

/// Initialize the platform provider
fn get_or_init_platform_provider() -> &'static Box<dyn PlatformProvider> {
    PLATFORM_PROVIDER.get_or_init(|| {
        let mut provider = get_platform_provider();
        if let Err(_err) = provider.initialize() {
        }
        provider
    })
}

/// File entry structure that matches the existing API
#[derive(Serialize, Deserialize, Debug)]
pub struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    children: Option<Vec<FileEntry>>,
}

/// Platform-aware file operations
pub struct PlatformFileOperations;

impl PlatformFileOperations {
    /// Reveal a file or directory in the platform's file manager
    pub fn reveal_in_file_manager(path: &str) -> Result<(), String> {
        let provider = get_or_init_platform_provider();
        let path_obj = Path::new(path);
        
        provider
            .reveal_in_file_manager(path_obj)
            .map_err(|err| err.user_message())
    }
    
    /// Open a terminal at the specified directory
    pub fn open_terminal(path: &str) -> Result<(), String> {
        let provider = get_or_init_platform_provider();
        let path_obj = Path::new(path);
        
        provider
            .open_terminal(path_obj)
            .map_err(|err| err.user_message())
    }
    
    /// Get platform information for debugging/logging
    pub fn get_platform_info() -> PlatformInfo {
        let provider = get_or_init_platform_provider();
        let config = provider.get_platform_config();
        
        PlatformInfo {
            platform_name: provider.platform_name().to_string(),
            file_manager: config.file_manager_name,
            preferred_terminal: config.preferred_terminal,
            supports_native_dialogs: config.native_dialogs,
            path_separator: config.path_separator,
        }
    }
    
    /// Check if a specific platform feature is supported
    pub fn is_feature_supported(feature: &str) -> bool {
        let provider = get_or_init_platform_provider();
        
        use crate::platform::PlatformFeature;
        let platform_feature = match feature {
            "file_manager_reveal" => PlatformFeature::FileManagerReveal,
            "terminal_launch" => PlatformFeature::TerminalLaunch,
            "custom_terminal" => PlatformFeature::CustomTerminal,
            "quick_look" => PlatformFeature::QuickLook,
            "context_menus" => PlatformFeature::ContextMenus,
            _ => return false,
        };
        
        provider.supports_feature(platform_feature)
    }
}

/// Platform information for the frontend
#[derive(Serialize, Deserialize, Debug)]
pub struct PlatformInfo {
    pub platform_name: String,
    pub file_manager: String,
    pub preferred_terminal: Option<String>,
    pub supports_native_dialogs: bool,
    pub path_separator: char,
}

/// Enhanced error information
#[derive(Serialize, Deserialize, Debug)]
pub struct PlatformFileError {
    pub message: String,
    pub operation: String,
    pub platform_specific: bool,
    pub suggestions: Vec<String>,
}

impl PlatformFileError {
    #[allow(dead_code)]
    pub fn from_platform_error(err: crate::platform::errors::PlatformError) -> Self {
        let suggestions = match err.kind {
            crate::platform::errors::PlatformErrorKind::PermissionDenied => {
                vec![
                    "Check that you have the necessary permissions for this operation".to_string(),
                    "Try running the application with elevated privileges if necessary".to_string(),
                ]
            }
            crate::platform::errors::PlatformErrorKind::ApplicationNotFound => {
                vec![
                    "Install the required application for your platform".to_string(),
                    "Check that the application is available in your system PATH".to_string(),
                ]
            }
            crate::platform::errors::PlatformErrorKind::FileSystem => {
                vec![
                    "Verify that the file or directory exists".to_string(),
                    "Check for any file system corruption or issues".to_string(),
                ]
            }
            _ => vec![],
        };
        
        Self {
            message: err.user_message(),
            operation: err.operation,
            platform_specific: true,
            suggestions,
        }
    }
}

// --- Tauri Commands ---

#[tauri::command]
pub fn platform_reveal_in_file_manager(path: String) -> Result<(), String> {
    PlatformFileOperations::reveal_in_file_manager(&path)
}

#[tauri::command]
pub fn platform_open_terminal(path: String) -> Result<(), String> {
    PlatformFileOperations::open_terminal(&path)
}

#[tauri::command]
pub fn get_platform_information() -> PlatformInfo {
    PlatformFileOperations::get_platform_info()
}

#[tauri::command]
pub fn check_platform_feature_support(feature: String) -> bool {
    PlatformFileOperations::is_feature_supported(&feature)
}

#[tauri::command]
pub fn get_platform_capabilities() -> Vec<String> {
    let provider = get_or_init_platform_provider();
    
    use crate::platform::PlatformFeature;
    let features = [
        ("file_manager_reveal", PlatformFeature::FileManagerReveal),
        ("terminal_launch", PlatformFeature::TerminalLaunch),
        ("custom_terminal", PlatformFeature::CustomTerminal),
        ("quick_look", PlatformFeature::QuickLook),
        ("context_menus", PlatformFeature::ContextMenus),
    ];
    
    features
        .iter()
        .filter(|(_, feature)| provider.supports_feature(*feature))
        .map(|(name, _)| name.to_string())
        .collect()
}

/// Initialize platform-specific file operations
pub fn initialize() -> Result<(), String> {
    let provider = get_or_init_platform_provider();
    
    // Just access the provider to trigger initialization
    let _info = provider.platform_name();
    
    Ok(())
}

/// Cleanup platform-specific resources
#[allow(dead_code)]
pub fn cleanup() -> Result<(), String> {
    // Currently, the platform provider is static and can't be easily cleaned up
    // This could be enhanced in the future if needed
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_info_retrieval() {
        let info = PlatformFileOperations::get_platform_info();
        
        // Basic validation
        assert!(!info.platform_name.is_empty());
        assert!(!info.file_manager.is_empty());
        assert!(info.path_separator == '/' || info.path_separator == '\\');
    }
    
    #[test]
    fn test_feature_support_checking() {
        // All platforms should support file manager reveal and terminal launch
        assert!(PlatformFileOperations::is_feature_supported("file_manager_reveal"));
        assert!(PlatformFileOperations::is_feature_supported("terminal_launch"));
        
        // Unknown features should return false
        assert!(!PlatformFileOperations::is_feature_supported("unknown_feature"));
    }
    
    #[test]
    fn test_platform_capabilities() {
        let capabilities = get_platform_capabilities();
        
        // Should have at least basic capabilities
        assert!(!capabilities.is_empty());
        assert!(capabilities.contains(&"file_manager_reveal".to_string()));
        assert!(capabilities.contains(&"terminal_launch".to_string()));
    }
    
    #[test]
    fn test_invalid_path_handling() {
        let invalid_path = "/definitely/does/not/exist/anywhere/12345";
        let result = PlatformFileOperations::reveal_in_file_manager(invalid_path);
        
        // Should fail gracefully
        assert!(result.is_err());
    }
    
    #[test]
    fn test_platform_error_conversion() {
        let platform_error = crate::platform::errors::PlatformError::file_system(
            "Test error", 
            "test_operation"
        );
        
        let file_error = PlatformFileError::from_platform_error(platform_error);
        
        assert!(!file_error.message.is_empty());
        assert_eq!(file_error.operation, "test_operation");
        assert!(file_error.platform_specific);
    }
}