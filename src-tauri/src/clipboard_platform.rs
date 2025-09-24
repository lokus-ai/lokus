/// Enhanced clipboard operations using platform abstraction
/// 
/// This module provides clipboard functionality that leverages platform-specific
/// capabilities while maintaining the existing Tauri clipboard API for compatibility.

use crate::platform::clipboard::{ClipboardUtils, ClipboardPlatformInfo};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Enhanced clipboard operations with platform awareness
pub struct PlatformAwareClipboard;

impl PlatformAwareClipboard {
    /// Write text with platform-specific validation and optimization
    pub async fn write_text_enhanced(app: &AppHandle, text: String) -> Result<(), String> {
        // Get platform info for validation
        let platform_info = ClipboardUtils::get_platform_clipboard_info();
        
        // Validate text length if platform has limits
        if let Some(max_length) = platform_info.max_text_length {
            if text.len() > max_length {
                return Err(format!(
                    "Text too long for this platform. Maximum: {} bytes, provided: {} bytes",
                    max_length, text.len()
                ));
            }
        }
        
        // Use standard Tauri clipboard with enhanced error handling
        app.clipboard()
            .write_text(text)
            .map_err(|e| {
                format!("Platform clipboard error: {}", Self::enhance_error_message(e.to_string()))
            })
    }
    
    /// Read text with platform-specific error handling
    pub async fn read_text_enhanced(app: &AppHandle) -> Result<String, String> {
        app.clipboard()
            .read_text()
            .map_err(|e| {
                format!("Platform clipboard error: {}", Self::enhance_error_message(e.to_string()))
            })
    }
    
    /// Write HTML with platform compatibility check
    pub async fn write_html_enhanced(app: &AppHandle, html: String, fallback_text: Option<String>) -> Result<(), String> {
        let platform_info = ClipboardUtils::get_platform_clipboard_info();
        
        if !platform_info.supports_html {
            if let Some(fallback) = fallback_text {
                return Self::write_text_enhanced(app, fallback).await;
            } else {
                return Err("HTML clipboard not supported on this platform and no fallback text provided".to_string());
            }
        }
        
        app.clipboard()
            .write_html(html, fallback_text)
            .map_err(|e| {
                format!("Platform HTML clipboard error: {}", Self::enhance_error_message(e.to_string()))
            })
    }
    
    /// Check clipboard content with platform-specific detection
    pub async fn has_content_enhanced(app: &AppHandle) -> Result<ClipboardContentInfo, String> {
        // Try to read text to determine content presence
        let has_text = match app.clipboard().read_text() {
            Ok(text) => !text.is_empty(),
            Err(_) => false,
        };
        
        let platform_info = ClipboardUtils::get_platform_clipboard_info();
        
        Ok(ClipboardContentInfo {
            has_text,
            has_html: platform_info.supports_html && has_text, // Simplified detection
            has_images: false, // Would require additional detection logic
            has_files: false,  // Would require additional detection logic
            content_size_estimate: if has_text {
                app.clipboard().read_text().map(|t| t.len()).unwrap_or(0)
            } else {
                0
            },
        })
    }
    
    /// Get platform-specific clipboard recommendations
    pub fn get_usage_tips() -> Vec<String> {
        ClipboardUtils::get_usage_recommendations()
    }
    
    /// Enhanced error message with platform context
    fn enhance_error_message(original_error: String) -> String {
        let platform_info = ClipboardUtils::get_platform_clipboard_info();
        
        let platform_specific_help = match platform_info.platform.as_str() {
            "macos" => {
                if original_error.contains("permission") {
                    " (On macOS, ensure Lokus has accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility)"
                } else {
                    " (On macOS, try using Cmd+C/Cmd+V if direct access fails)"
                }
            }
            "windows" => {
                if original_error.contains("timeout") || original_error.contains("busy") {
                    " (On Windows, another application may be using the clipboard. Try again in a moment)"
                } else {
                    " (On Windows, check if clipboard history is interfering in Settings > System > Clipboard)"
                }
            }
            "linux" => {
                if original_error.contains("selection") {
                    " (On Linux, ensure your clipboard manager is running properly)"
                } else {
                    " (On Linux, clipboard behavior depends on your desktop environment)"
                }
            }
            _ => "",
        };
        
        format!("{}{}", original_error, platform_specific_help)
    }
}

/// Information about clipboard content
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ClipboardContentInfo {
    pub has_text: bool,
    pub has_html: bool,
    pub has_images: bool,
    pub has_files: bool,
    pub content_size_estimate: usize,
}

// --- Enhanced Tauri Commands ---

#[tauri::command]
pub async fn clipboard_write_text_enhanced(app: AppHandle, text: String) -> Result<(), String> {
    PlatformAwareClipboard::write_text_enhanced(&app, text).await
}

#[tauri::command]
pub async fn clipboard_read_text_enhanced(app: AppHandle) -> Result<String, String> {
    PlatformAwareClipboard::read_text_enhanced(&app).await
}

#[tauri::command]
pub async fn clipboard_write_html_enhanced(app: AppHandle, html: String, fallback_text: Option<String>) -> Result<(), String> {
    PlatformAwareClipboard::write_html_enhanced(&app, html, fallback_text).await
}

#[tauri::command]
pub async fn clipboard_get_content_info(app: AppHandle) -> Result<ClipboardContentInfo, String> {
    PlatformAwareClipboard::has_content_enhanced(&app).await
}

#[tauri::command]
pub fn clipboard_get_platform_info() -> ClipboardPlatformInfo {
    ClipboardUtils::get_platform_clipboard_info()
}

#[tauri::command]
pub fn clipboard_get_usage_tips() -> Vec<String> {
    PlatformAwareClipboard::get_usage_tips()
}

#[tauri::command]
pub async fn clipboard_clear_enhanced(app: AppHandle) -> Result<(), String> {
    app.clipboard()
        .clear()
        .map_err(|e| {
            format!("Platform clipboard clear error: {}", 
                   PlatformAwareClipboard::enhance_error_message(e.to_string()))
        })
}

/// Initialize platform-aware clipboard
pub fn initialize() -> Result<(), String> {
    // Verify clipboard availability
    if !ClipboardUtils::is_clipboard_available() {
        return Err("Clipboard functionality is not available on this platform".to_string());
    }
    
    let platform_info = ClipboardUtils::get_platform_clipboard_info();
    println!("Initialized platform-aware clipboard for: {} (HTML: {}, Images: {}, History: {})", 
             platform_info.platform,
             platform_info.supports_html,
             platform_info.supports_images,
             platform_info.supports_history);
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_enhancement() {
        let original = "Permission denied".to_string();
        let enhanced = PlatformAwareClipboard::enhance_error_message(original);
        
        // Should contain additional platform-specific information
        assert!(enhanced.len() > "Permission denied".len());
    }
    
    #[test]
    fn test_platform_info_retrieval() {
        let info = clipboard_get_platform_info();
        assert!(!info.platform.is_empty());
    }
    
    #[test]
    fn test_usage_tips() {
        let _tips = clipboard_get_usage_tips();
        // Tips may be empty for some platforms, which is valid
        // Length check is redundant since Vec::len() is always >= 0
    }
    
    #[test]
    fn test_initialization() {
        let result = initialize();
        // Should succeed on most platforms
        assert!(result.is_ok());
    }
}