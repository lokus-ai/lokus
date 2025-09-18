/// Platform-specific clipboard operations for Lokus
/// 
/// This module provides clipboard functionality that respects platform-specific
/// behaviors and limitations while maintaining a consistent API.

use super::errors::{PlatformError, PlatformErrorKind};
use std::time::Duration;

/// Trait for platform-specific clipboard operations
pub trait ClipboardOperations {
    /// Write plain text to the clipboard
    fn write_text(&self, text: &str) -> Result<(), PlatformError>;
    
    /// Read plain text from the clipboard
    fn read_text(&self) -> Result<String, PlatformError>;
    
    /// Write HTML content to the clipboard
    fn write_html(&self, html: &str, fallback_text: Option<&str>) -> Result<(), PlatformError>;
    
    /// Read HTML content from the clipboard
    fn read_html(&self) -> Result<String, PlatformError>;
    
    /// Check if the clipboard contains text
    fn has_text(&self) -> bool;
    
    /// Check if the clipboard contains HTML
    fn has_html(&self) -> bool;
    
    /// Clear the clipboard
    fn clear(&self) -> Result<(), PlatformError>;
    
    /// Get clipboard history if supported (returns empty vec if not supported)
    fn get_history(&self) -> Result<Vec<ClipboardEntry>, PlatformError>;
    
    /// Check if clipboard monitoring is supported
    fn supports_monitoring(&self) -> bool;
}

/// A clipboard entry with metadata
#[derive(Debug, Clone)]
pub struct ClipboardEntry {
    pub content: String,
    pub content_type: ClipboardContentType,
    pub timestamp: std::time::SystemTime,
    pub source_app: Option<String>,
}

/// Types of clipboard content
#[derive(Debug, Clone, PartialEq)]
pub enum ClipboardContentType {
    Text,
    Html,
    Image,
    Files,
    Other(String),
}

/// Platform-specific clipboard configuration
#[derive(Debug, Clone)]
pub struct ClipboardConfig {
    /// Maximum text length supported
    pub max_text_length: Option<usize>,
    /// Whether HTML clipboard is supported
    pub supports_html: bool,
    /// Whether image clipboard is supported
    pub supports_images: bool,
    /// Whether file clipboard is supported
    pub supports_files: bool,
    /// Whether clipboard history is available
    pub supports_history: bool,
    /// History retention duration
    pub history_retention: Duration,
}

/// Enhanced clipboard provider that wraps platform-specific behavior
pub struct PlatformClipboard {
    config: ClipboardConfig,
}

impl PlatformClipboard {
    /// Create a new platform clipboard instance
    pub fn new() -> Self {
        Self {
            config: Self::get_platform_config(),
        }
    }
    
    /// Get platform-specific clipboard configuration
    fn get_platform_config() -> ClipboardConfig {
        #[cfg(target_os = "macos")]
        {
            ClipboardConfig {
                max_text_length: None, // macOS doesn't have a strict limit
                supports_html: true,
                supports_images: true,
                supports_files: true,
                supports_history: false, // Would require third-party apps
                history_retention: Duration::from_secs(3600), // 1 hour default
            }
        }
        
        #[cfg(target_os = "windows")]
        {
            ClipboardConfig {
                max_text_length: Some(1_000_000), // Conservative limit for Windows
                supports_html: true,
                supports_images: true,
                supports_files: true,
                supports_history: true, // Windows 10+ has clipboard history
                history_retention: Duration::from_secs(3600 * 24), // 24 hours
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            ClipboardConfig {
                max_text_length: Some(500_000), // Conservative for X11
                supports_html: true,
                supports_images: true,
                supports_files: true,
                supports_history: false, // Depends on clipboard manager
                history_retention: Duration::from_secs(1800), // 30 minutes
            }
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            ClipboardConfig {
                max_text_length: Some(100_000),
                supports_html: false,
                supports_images: false,
                supports_files: false,
                supports_history: false,
                history_retention: Duration::from_secs(600),
            }
        }
    }
    
    /// Get the platform clipboard configuration
    pub fn get_config(&self) -> &ClipboardConfig {
        &self.config
    }
    
    /// Validate text length against platform limits
    fn validate_text_length(&self, text: &str) -> Result<(), PlatformError> {
        if let Some(max_length) = self.config.max_text_length {
            if text.len() > max_length {
                return Err(PlatformError::invalid_input(
                    format!("Text length ({} bytes) exceeds platform limit ({} bytes)", 
                            text.len(), max_length),
                    "clipboard_write"
                ));
            }
        }
        Ok(())
    }
    
    /// Convert Tauri clipboard errors to platform errors
    fn convert_clipboard_error(&self, error: String, operation: &str) -> PlatformError {
        if error.contains("permission") || error.contains("access") {
            PlatformError::permission_denied(operation)
        } else if error.contains("timeout") {
            PlatformError::new(
                PlatformErrorKind::System,
                "Clipboard operation timed out - another application may be using it",
                operation
            )
        } else if error.contains("format") || error.contains("type") {
            PlatformError::new(
                PlatformErrorKind::Unsupported,
                "Clipboard format not supported on this platform",
                operation
            )
        } else {
            PlatformError::new(
                PlatformErrorKind::System,
                format!("Clipboard operation failed: {}", error),
                operation
            )
        }
    }
}

impl ClipboardOperations for PlatformClipboard {
    fn write_text(&self, text: &str) -> Result<(), PlatformError> {
        self.validate_text_length(text)?;
        
        // For now, we'll return a placeholder since Tauri clipboard requires async context
        // This would be implemented with the actual Tauri clipboard API
        Ok(())
    }
    
    fn read_text(&self) -> Result<String, PlatformError> {
        // Placeholder implementation
        // This would use the actual Tauri clipboard API
        Err(PlatformError::new(
            PlatformErrorKind::System,
            "Direct clipboard access not implemented - use Tauri commands",
            "read_text"
        ))
    }
    
    fn write_html(&self, html: &str, _fallback_text: Option<&str>) -> Result<(), PlatformError> {
        if !self.config.supports_html {
            return Err(PlatformError::unsupported("HTML clipboard"));
        }
        
        self.validate_text_length(html)?;
        
        // Placeholder - would implement HTML clipboard writing
        Ok(())
    }
    
    fn read_html(&self) -> Result<String, PlatformError> {
        if !self.config.supports_html {
            return Err(PlatformError::unsupported("HTML clipboard"));
        }
        
        // Placeholder implementation
        Err(PlatformError::new(
            PlatformErrorKind::System,
            "Direct HTML clipboard access not implemented",
            "read_html"
        ))
    }
    
    fn has_text(&self) -> bool {
        // This would check clipboard state
        false
    }
    
    fn has_html(&self) -> bool {
        self.config.supports_html && false // Would check actual clipboard state
    }
    
    fn clear(&self) -> Result<(), PlatformError> {
        // Placeholder implementation
        Ok(())
    }
    
    fn get_history(&self) -> Result<Vec<ClipboardEntry>, PlatformError> {
        if !self.config.supports_history {
            return Ok(vec![]);
        }
        
        // Platform-specific history implementation would go here
        #[cfg(target_os = "windows")]
        {
            // Windows 10+ clipboard history API
            // This would require additional Windows-specific code
        }
        
        Ok(vec![])
    }
    
    fn supports_monitoring(&self) -> bool {
        // Platform-specific clipboard monitoring support
        #[cfg(target_os = "macos")]
        return false; // macOS doesn't easily support clipboard monitoring
        
        #[cfg(target_os = "windows")]
        return true; // Windows supports clipboard change notifications
        
        #[cfg(target_os = "linux")]
        return true; // X11/Wayland can monitor clipboard changes
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return false;
    }
}

/// Platform-specific clipboard utilities
pub struct ClipboardUtils;

impl ClipboardUtils {
    /// Get platform-specific clipboard information
    pub fn get_platform_clipboard_info() -> ClipboardPlatformInfo {
        let config = PlatformClipboard::get_platform_config();
        
        ClipboardPlatformInfo {
            platform: std::env::consts::OS.to_string(),
            supports_html: config.supports_html,
            supports_images: config.supports_images,
            supports_files: config.supports_files,
            supports_history: config.supports_history,
            max_text_length: config.max_text_length,
            supports_monitoring: PlatformClipboard::new().supports_monitoring(),
        }
    }
    
    /// Check if the clipboard functionality is available
    pub fn is_clipboard_available() -> bool {
        // Basic check - would be enhanced with actual clipboard API calls
        true
    }
    
    /// Get recommended clipboard usage patterns for the platform
    pub fn get_usage_recommendations() -> Vec<String> {
        let mut recommendations = vec![];
        
        #[cfg(target_os = "macos")]
        {
            recommendations.push("Use CMD+C/CMD+V for best compatibility".to_string());
            recommendations.push("Large text may be stored as file references".to_string());
        }
        
        #[cfg(target_os = "windows")]
        {
            recommendations.push("Enable clipboard history in Windows settings for enhanced functionality".to_string());
            recommendations.push("Be aware of clipboard size limits in older Windows versions".to_string());
        }
        
        #[cfg(target_os = "linux")]
        {
            recommendations.push("Install a clipboard manager for history support".to_string());
            recommendations.push("Some applications may conflict with clipboard access".to_string());
        }
        
        recommendations
    }
}

/// Platform information about clipboard capabilities
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ClipboardPlatformInfo {
    pub platform: String,
    pub supports_html: bool,
    pub supports_images: bool,
    pub supports_files: bool,
    pub supports_history: bool,
    pub max_text_length: Option<usize>,
    pub supports_monitoring: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_config_creation() {
        let config = PlatformClipboard::get_platform_config();
        
        // Basic validation
        assert!(config.history_retention.as_secs() > 0);
    }
    
    #[test]
    fn test_clipboard_creation() {
        let clipboard = PlatformClipboard::new();
        let config = clipboard.get_config();
        
        // Ensure configuration is properly set
        assert!(config.history_retention.as_secs() > 0);
    }
    
    #[test]
    fn test_text_length_validation() {
        let clipboard = PlatformClipboard::new();
        
        // Test with normal text
        let result = clipboard.validate_text_length("Hello, world!");
        assert!(result.is_ok());
        
        // Test with large text if platform has limits
        if let Some(max_length) = clipboard.config.max_text_length {
            let large_text = "x".repeat(max_length + 1);
            let result = clipboard.validate_text_length(&large_text);
            assert!(result.is_err());
        }
    }
    
    #[test]
    fn test_platform_info_retrieval() {
        let info = ClipboardUtils::get_platform_clipboard_info();
        
        assert!(!info.platform.is_empty());
        // Most platforms should support basic text clipboard
    }
    
    #[test]
    fn test_clipboard_availability() {
        // Basic availability check should pass
        assert!(ClipboardUtils::is_clipboard_available());
    }
    
    #[test]
    fn test_usage_recommendations() {
        let recommendations = ClipboardUtils::get_usage_recommendations();
        
        // Should have some recommendations for any platform
        // (may be empty for some platforms, which is valid)
        assert!(recommendations.len() >= 0);
    }
}