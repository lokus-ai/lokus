# Platform Abstraction Layer for Lokus

This directory contains the platform abstraction layer for Lokus, providing a clean, trait-based interface for platform-specific operations while maintaining clear separation between business logic and platform-dependent code.

## 🏗️ Architecture Overview

The platform abstraction layer is designed with the following principles:

1. **Trait-based abstraction**: Common operations are defined as traits that each platform implements
2. **Clear separation**: Platform-specific code is isolated in dedicated modules
3. **Consistent error handling**: All platforms use a unified error system
4. **Feature detection**: Runtime detection of platform capabilities
5. **Compile-time safety**: Platform-specific code is conditionally compiled

## 📁 Module Structure

```
platform/
├── mod.rs              # Main platform abstraction traits and provider
├── errors.rs           # Unified error handling system
├── clipboard.rs        # Clipboard operation abstractions
├── macos.rs           # macOS-specific implementations
├── windows.rs         # Windows-specific implementations
├── linux.rs           # Linux-specific implementations
└── README.md          # This documentation
```

## 🎯 Core Traits

### `FileSystemOperations`
Handles platform-specific file system operations:
- `reveal_in_file_manager()` - Show file/folder in platform file manager
- `open_terminal()` - Open terminal at specified directory

### `SystemIntegration`
Provides system-level integration:
- `platform_name()` - Get platform identifier
- `supports_feature()` - Check feature availability
- `get_platform_config()` - Get platform-specific configuration

### `ClipboardOperations`
Manages clipboard functionality:
- Text, HTML, and binary content support
- Platform-specific limitations and capabilities
- Clipboard history and monitoring (where supported)

### `PlatformProvider`
Combined trait that all platform implementations must provide:
- Initialization and cleanup lifecycle
- All file system and system integration operations

## 🔧 Usage Examples

### Basic Platform Detection
```rust
use crate::platform::get_platform_provider;

let provider = get_platform_provider();
println!("Running on: {}", provider.platform_name());

if provider.supports_feature(PlatformFeature::QuickLook) {
    // macOS-specific QuickLook functionality
}
```

### File Operations
```rust
use crate::platform::get_platform_provider;
use std::path::Path;

let provider = get_platform_provider();
let path = Path::new("/Users/example/Documents");

// Cross-platform file manager reveal
provider.reveal_in_file_manager(path)?;

// Cross-platform terminal opening
provider.open_terminal(path)?;
```

### Error Handling
```rust
use crate::platform::errors::{PlatformError, PlatformErrorKind};

match provider.reveal_in_file_manager(path) {
    Ok(()) => println!("File revealed successfully"),
    Err(PlatformError { kind: PlatformErrorKind::PermissionDenied, .. }) => {
        println!("Permission denied - check your access rights");
    }
    Err(PlatformError { kind: PlatformErrorKind::ApplicationNotFound, .. }) => {
        println!("File manager not found");
    }
    Err(err) => println!("Error: {}", err.user_message()),
}
```

### Feature Detection
```rust
use crate::platform::{get_platform_provider, PlatformFeature};

let provider = get_platform_provider();

if provider.supports_feature(PlatformFeature::CustomTerminal) {
    // Multiple terminal options available
    let config = provider.get_platform_config();
    println!("Preferred terminal: {:?}", config.preferred_terminal);
}
```

## 🖥️ Platform-Specific Features

### macOS (`macos.rs`)
- **File Manager**: Finder with `-R` (reveal) support
- **Terminal**: Auto-detection of Terminal.app, iTerm2, Warp
- **Special Features**: QuickLook support, Apple Silicon detection
- **Path Style**: Unix-style (`/`)

#### macOS-Specific Extensions
```rust
use crate::platform::macos::MacOsPlatform;

let macos = MacOsPlatform::new();
macos.quick_look(&path)?;  // Open file in QuickLook
macos.is_apple_silicon();  // Check if running on Apple Silicon
```

### Windows (`windows.rs`)
- **File Manager**: Windows Explorer with `/select` support
- **Terminal**: Windows Terminal → PowerShell → Command Prompt fallback
- **Special Features**: Clipboard history support (Windows 10+)
- **Path Style**: Windows-style (`\`)

#### Windows-Specific Considerations
- Handles Windows Terminal detection and preference
- PowerShell integration for advanced terminal operations
- Windows-specific error codes and messages

### Linux (`linux.rs`)
- **File Manager**: Auto-detection based on desktop environment
  - GNOME: Nautilus
  - KDE: Dolphin  
  - XFCE: Thunar
  - Fallback: xdg-open
- **Terminal**: Desktop environment-aware selection
  - GNOME: gnome-terminal, tilix
  - KDE: konsole
  - Modern: kitty, alacritty
  - Fallback: xterm
- **Desktop Detection**: XDG_CURRENT_DESKTOP and fallback detection
- **Display Server**: Wayland/X11 detection

#### Linux-Specific Extensions
```rust
use crate::platform::linux::LinuxPlatform;

let linux = LinuxPlatform::new();
linux.is_wayland();                    // Check if running on Wayland
linux.get_distribution_info()?;        // Get Linux distribution info
linux.get_desktop_environment();       // Get detected DE
linux.open_with_default_app(&path)?;   // Open with xdg-open
```

## ⚠️ Error Handling

The platform layer uses a comprehensive error system defined in `errors.rs`:

### Error Types
- `FileSystem` - File/directory operation errors
- `PermissionDenied` - Access permission issues
- `ApplicationNotFound` - Required applications missing
- `Network` - Network-related errors
- `Unsupported` - Feature not supported on platform
- `System` - General system errors
- `InvalidInput` - Invalid parameters provided

### Platform-Specific Error Messages
Error messages are automatically localized for each platform:
- **Windows**: "Access to the path is denied"
- **macOS**: "Permission denied"
- **Linux**: "Permission denied"

### Usage
```rust
use crate::platform::errors::{PlatformError, ErrorMessages};

// Create platform-appropriate error messages
let error = PlatformError::file_system(
    ErrorMessages::file_not_found("/path/to/file"),
    "reveal_operation"
);

// Get user-friendly message
println!("{}", error.user_message());
```

## 🔄 Integration with Tauri Commands

The platform layer integrates seamlessly with Tauri commands through the handler modules:

### Enhanced File Handlers (`handlers/platform_files.rs`)
```rust
#[tauri::command]
pub fn platform_reveal_in_file_manager(path: String) -> Result<(), String> {
    let provider = get_platform_provider();
    provider.reveal_in_file_manager(Path::new(&path))
        .map_err(|err| err.user_message())
}
```

### Enhanced Clipboard (`clipboard_platform.rs`)
```rust
#[tauri::command]
pub async fn clipboard_write_text_enhanced(
    app: AppHandle, 
    text: String
) -> Result<(), String> {
    // Platform-aware clipboard operations with enhanced error handling
}
```

## 🧪 Testing

Each platform module includes comprehensive tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_creation() {
        let platform = Platform::new();
        assert_eq!(platform.platform_name(), "ExpectedPlatform");
    }
    
    #[test]
    fn test_feature_support() {
        let platform = Platform::new();
        assert!(platform.supports_feature(PlatformFeature::FileManagerReveal));
    }
}
```

### Running Tests
```bash
# Run all platform tests
cargo test platform

# Run specific platform tests
cargo test platform::macos
cargo test platform::windows  
cargo test platform::linux
```

## 🚀 Performance Considerations

### Lazy Initialization
Platform providers use lazy initialization to avoid startup overhead:
```rust
static PLATFORM_PROVIDER: OnceLock<Box<dyn PlatformProvider>> = OnceLock::new();
```

### Caching
- Platform detection results are cached
- Application availability checks are cached where appropriate
- Configuration is computed once and reused

### Resource Management
- Platform providers implement proper cleanup
- File handles and system resources are properly managed
- Background processes are tracked and cleaned up

## 🔮 Future Enhancements

### Planned Features
1. **Plugin System Integration**: Allow plugins to register platform-specific handlers
2. **Advanced Clipboard**: Support for custom clipboard formats
3. **System Notifications**: Platform-native notification support
4. **File Associations**: Register and manage file type associations
5. **System Tray**: Platform-specific system tray implementations

### Extension Points
The platform system is designed for easy extension:
- Add new traits for additional capabilities
- Implement platform-specific optimizations
- Add support for new platforms (FreeBSD, etc.)

## 📖 API Reference

### Core Functions
- `get_platform_provider()` - Get platform provider for current OS
- `PlatformProvider::initialize()` - Initialize platform resources
- `PlatformProvider::cleanup()` - Clean up platform resources

### Feature Detection
- `supports_feature(PlatformFeature)` - Check if feature is supported
- `get_platform_config()` - Get platform configuration
- `platform_name()` - Get platform identifier string

### Error Handling
- `PlatformError::user_message()` - Get user-friendly error message
- `ErrorMessages::*` - Platform-specific error message generators

## 🤝 Contributing

When adding new platform features:

1. **Define the trait** in `mod.rs` with clear documentation
2. **Implement for all platforms** in respective modules
3. **Add comprehensive tests** for the new functionality
4. **Update error handling** if new error types are needed
5. **Document the feature** with examples and platform differences

### Code Style
- Use descriptive error messages with context
- Include platform-specific optimizations where beneficial
- Always provide fallbacks for unsupported features
- Document platform differences clearly

---

*This platform abstraction layer ensures Lokus provides consistent, reliable functionality across all supported operating systems while leveraging the unique capabilities of each platform.*