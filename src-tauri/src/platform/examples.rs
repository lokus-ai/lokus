/// Examples and usage patterns for the platform abstraction layer
/// 
/// This module provides practical examples of how to use the platform abstraction
/// layer effectively in various scenarios.

#[allow(dead_code)]

use super::{
    get_platform_provider, 
    PlatformProvider, 
    PlatformFeature,
    errors::{PlatformError, PlatformErrorKind},
    system_info::SystemInfoCollector,
    clipboard::{ClipboardUtils, ClipboardPlatformInfo},
};
use std::path::Path;

/// Example: Basic platform detection and feature checking
pub fn example_platform_detection() -> Result<(), PlatformError> {
    println!("=== Platform Detection Example ===");
    
    // Get the platform provider for the current OS
    let provider = get_platform_provider();
    
    // Basic platform information
    println!("Platform: {}", provider.platform_name());
    let config = provider.get_platform_config();
    println!("File Manager: {}", config.file_manager_name);
    println!("Preferred Terminal: {:?}", config.preferred_terminal);
    println!("Path Separator: '{}'", config.path_separator);
    
    // Feature detection
    let features = [
        ("File Manager Reveal", PlatformFeature::FileManagerReveal),
        ("Terminal Launch", PlatformFeature::TerminalLaunch),
        ("Custom Terminal", PlatformFeature::CustomTerminal),
        ("Quick Look", PlatformFeature::QuickLook),
        ("Context Menus", PlatformFeature::ContextMenus),
    ];
    
    println!("\nSupported Features:");
    for (name, feature) in features {
        let supported = provider.supports_feature(feature);
        println!("  {} {}", if supported { "✓" } else { "✗" }, name);
    }
    
    Ok(())
}

/// Example: Safe file operations with platform-specific error handling
pub fn example_file_operations() -> Result<(), PlatformError> {
    println!("\n=== File Operations Example ===");
    
    let provider = get_platform_provider();
    
    // Example paths for demonstration
    let test_paths = [
        "/Users/example/Documents",  // macOS/Linux
        "/home/user/Documents",      // Linux
        "C:\\Users\\User\\Documents", // Windows
        ".",                         // Current directory (should work on all platforms)
    ];
    
    for path_str in &test_paths {
        let path = Path::new(path_str);
        
        if path.exists() {
            println!("Testing with path: {}", path_str);
            
            // Try to reveal in file manager
            match provider.reveal_in_file_manager(path) {
                Ok(()) => println!("  ✓ Successfully revealed in file manager"),
                Err(err) => match err.kind {
                    PlatformErrorKind::FileSystem => {
                        println!("  ✗ File system error: {}", err.user_message());
                    }
                    PlatformErrorKind::PermissionDenied => {
                        println!("  ✗ Permission denied: {}", err.user_message());
                    }
                    PlatformErrorKind::ApplicationNotFound => {
                        println!("  ✗ File manager not found: {}", err.user_message());
                    }
                    _ => {
                        println!("  ✗ Error: {}", err.user_message());
                    }
                }
            }
            
            // Try to open terminal (only for directories)
            if path.is_dir() {
                match provider.open_terminal(path) {
                    Ok(()) => println!("  ✓ Successfully opened terminal"),
                    Err(err) => println!("  ✗ Terminal error: {}", err.user_message()),
                }
            }
            
            break; // Use first existing path
        }
    }
    
    Ok(())
}

/// Example: Platform-specific optimizations
pub fn example_platform_optimizations() -> Result<(), PlatformError> {
    println!("\n=== Platform Optimizations Example ===");
    
    let provider = get_platform_provider();
    
    match provider.platform_name() {
        "macOS" => {
            println!("macOS-specific optimizations:");
            
            // Check if running on Apple Silicon for performance optimizations
            #[cfg(target_os = "macos")]
            {
                use super::macos::MacOsPlatform;
                let macos = MacOsPlatform::new();
                let is_apple_silicon = macos.is_apple_silicon();
                println!("  - Apple Silicon: {}", is_apple_silicon);
                
                if provider.supports_feature(PlatformFeature::QuickLook) {
                    println!("  - QuickLook available for file previews");
                }
            }
        }
        
        "Windows" => {
            println!("Windows-specific optimizations:");
            
            // Check for Windows Terminal availability
            if provider.supports_feature(PlatformFeature::CustomTerminal) {
                println!("  - Modern terminal available (Windows Terminal/PowerShell)");
            } else {
                println!("  - Fallback to Command Prompt");
            }
            
            println!("  - Clipboard history potentially available");
        }
        
        "Linux" => {
            println!("Linux-specific optimizations:");
            
            #[cfg(target_os = "linux")]
            {
                use super::linux::LinuxPlatform;
                let linux = LinuxPlatform::new();
                
                println!("  - Desktop Environment: {:?}", linux.get_desktop_environment());
                println!("  - Display Server: {}", 
                    if linux.is_wayland() { "Wayland" } 
                    else if linux.is_x11() { "X11" } 
                    else { "Unknown" });
                
                // Get distribution information
                if let Ok(distro_info) = linux.get_distribution_info() {
                    println!("  - Distribution: {}", distro_info.lines().next().unwrap_or("Unknown"));
                }
            }
        }
        
        platform => {
            println!("Generic optimizations for {}", platform);
        }
    }
    
    Ok(())
}

/// Example: Comprehensive system information gathering
pub fn example_system_information() -> Result<(), PlatformError> {
    println!("\n=== System Information Example ===");
    
    let system_info = SystemInfoCollector::collect()?;
    
    // Operating System Information
    println!("OS Information:");
    println!("  Platform: {}", system_info.os_info.platform);
    println!("  Version: {}", system_info.os_info.version);
    println!("  Architecture: {}", system_info.os_info.architecture);
    if let Some(build) = &system_info.os_info.build {
        println!("  Build: {}", build);
    }
    if let Some(kernel) = &system_info.os_info.kernel_version {
        println!("  Kernel: {}", kernel);
    }
    
    // Hardware Information
    println!("\nHardware Information:");
    println!("  CPU Architecture: {}", system_info.hardware.cpu_architecture);
    println!("  CPU Cores: {}", system_info.hardware.cpu_count);
    if let Some(total_mem) = system_info.hardware.total_memory {
        println!("  Total Memory: {} GB", total_mem / (1024 * 1024 * 1024));
    }
    if let Some(avail_mem) = system_info.hardware.available_memory {
        println!("  Available Memory: {} GB", avail_mem / (1024 * 1024 * 1024));
    }
    
    // Available Applications
    println!("\nAvailable Applications:");
    if !system_info.available_apps.terminals.is_empty() {
        println!("  Terminals: {}", system_info.available_apps.terminals.join(", "));
    }
    if !system_info.available_apps.file_managers.is_empty() {
        println!("  File Managers: {}", system_info.available_apps.file_managers.join(", "));
    }
    if !system_info.available_apps.editors.is_empty() {
        println!("  Editors: {}", system_info.available_apps.editors.join(", "));
    }
    
    // System Capabilities
    println!("\nSystem Capabilities:");
    println!("  Notifications: {}", system_info.capabilities.supports_notifications);
    println!("  Global Shortcuts: {}", system_info.capabilities.supports_global_shortcuts);
    println!("  System Tray: {}", system_info.capabilities.supports_system_tray);
    println!("  Dark Mode: {}", system_info.capabilities.supports_dark_mode);
    println!("  Transparency: {}", system_info.capabilities.supports_transparency);
    
    Ok(())
}

/// Example: Clipboard operations with platform awareness
pub fn example_clipboard_operations() -> Result<(), PlatformError> {
    println!("\n=== Clipboard Operations Example ===");
    
    let clipboard_info = ClipboardUtils::get_platform_clipboard_info();
    
    println!("Clipboard Capabilities:");
    println!("  Platform: {}", clipboard_info.platform);
    println!("  HTML Support: {}", clipboard_info.supports_html);
    println!("  Image Support: {}", clipboard_info.supports_images);
    println!("  File Support: {}", clipboard_info.supports_files);
    println!("  History Support: {}", clipboard_info.supports_history);
    println!("  Monitoring Support: {}", clipboard_info.supports_monitoring);
    
    if let Some(max_length) = clipboard_info.max_text_length {
        println!("  Max Text Length: {} bytes", max_length);
    } else {
        println!("  Max Text Length: No limit");
    }
    
    // Usage recommendations
    let recommendations = ClipboardUtils::get_usage_recommendations();
    if !recommendations.is_empty() {
        println!("\nPlatform-specific recommendations:");
        for recommendation in recommendations {
            println!("  • {}", recommendation);
        }
    }
    
    Ok(())
}

/// Example: Error handling patterns
pub fn example_error_handling() -> Result<(), PlatformError> {
    println!("\n=== Error Handling Example ===");
    
    let provider = get_platform_provider();
    let non_existent_path = Path::new("/this/path/definitely/does/not/exist");
    
    // Demonstrate different error types and handling
    match provider.reveal_in_file_manager(non_existent_path) {
        Ok(()) => unreachable!("This should fail"),
        Err(err) => {
            println!("Caught expected error:");
            println!("  Kind: {:?}", err.kind);
            println!("  Operation: {}", err.operation);
            println!("  Message: {}", err.message);
            println!("  User Message: {}", err.user_message());
            
            // Handle different error types
            match err.kind {
                PlatformErrorKind::FileSystem => {
                    println!("  → This is a file system error, path might not exist");
                }
                PlatformErrorKind::PermissionDenied => {
                    println!("  → This is a permission error, check access rights");
                }
                PlatformErrorKind::ApplicationNotFound => {
                    println!("  → Required application is missing");
                }
                _ => {
                    println!("  → Other error type");
                }
            }
        }
    }
    
    Ok(())
}

/// Example: Cross-platform path handling
pub fn example_cross_platform_paths() -> Result<(), PlatformError> {
    println!("\n=== Cross-Platform Path Handling Example ===");
    
    let provider = get_platform_provider();
    let config = provider.get_platform_config();
    
    println!("Path separator for this platform: '{}'", config.path_separator);
    
    // Construct platform-appropriate paths
    let user_documents = match provider.platform_name() {
        "Windows" => r"C:\Users\User\Documents",
        "macOS" => "/Users/user/Documents",
        "Linux" => "/home/user/Documents",
        _ => "./Documents",
    };
    
    println!("Typical documents path: {}", user_documents);
    
    // Use std::path for cross-platform path handling
    let path = Path::new(user_documents);
    if let Some(parent) = path.parent() {
        println!("Parent directory: {}", parent.display());
    }
    
    Ok(())
}

/// Example: Feature-based conditional logic
pub fn example_feature_conditional_logic() -> Result<(), PlatformError> {
    println!("\n=== Feature-Based Conditional Logic Example ===");
    
    let provider = get_platform_provider();
    
    // QuickLook example (macOS only)
    if provider.supports_feature(PlatformFeature::QuickLook) {
        println!("QuickLook is available - could implement file preview");
        
        #[cfg(target_os = "macos")]
        {
            println!("  Implementation: Use 'qlmanage -p' for file previews");
        }
    } else {
        println!("QuickLook not available - use alternative preview method");
    }
    
    // Terminal customization
    if provider.supports_feature(PlatformFeature::CustomTerminal) {
        let config = provider.get_platform_config();
        if let Some(terminal) = config.preferred_terminal {
            println!("Custom terminal available: {}", terminal);
            println!("  Could offer terminal selection in preferences");
        }
    } else {
        println!("Using default terminal");
    }
    
    // System tray
    if provider.supports_feature(PlatformFeature::ContextMenus) {
        println!("Context menus supported - can implement right-click actions");
    }
    
    Ok(())
}

/// Run all examples
pub fn run_all_examples() -> Result<(), PlatformError> {
    println!("🚀 Platform Abstraction Layer Examples\n");
    
    example_platform_detection()?;
    example_file_operations()?;
    example_platform_optimizations()?;
    example_system_information()?;
    example_clipboard_operations()?;
    example_error_handling()?;
    example_cross_platform_paths()?;
    example_feature_conditional_logic()?;
    
    println!("\n✅ All examples completed successfully!");
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_detection_example() {
        let result = example_platform_detection();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_system_information_example() {
        let result = example_system_information();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_clipboard_operations_example() {
        let result = example_clipboard_operations();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_error_handling_example() {
        let result = example_error_handling();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_cross_platform_paths_example() {
        let result = example_cross_platform_paths();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_feature_conditional_logic_example() {
        let result = example_feature_conditional_logic();
        assert!(result.is_ok());
    }
}

/// Tauri command to run platform examples (useful for debugging)
#[tauri::command]
pub fn run_platform_examples() -> Result<String, String> {
    match run_all_examples() {
        Ok(()) => Ok("All platform examples completed successfully".to_string()),
        Err(err) => Err(err.user_message()),
    }
}