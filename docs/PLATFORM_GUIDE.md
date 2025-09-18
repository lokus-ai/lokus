# Platform Support Guide

This guide provides comprehensive information about developing, building, and distributing Lokus across different platforms.

## 📋 Table of Contents

- [Platform Support Matrix](#platform-support-matrix)
- [API Compatibility](#api-compatibility)
- [Known Platform Limitations](#known-platform-limitations)
- [Performance Considerations](#performance-considerations)
- [Development Tips](#development-tips)
- [Troubleshooting](#troubleshooting)

## 🎯 Platform Support Matrix

### Supported Platforms

| Platform | Min Version | Architecture | Status | Notes |
|----------|-------------|--------------|---------|-------|
| **Windows** | Windows 10 (1903+) | x64, arm64 | ✅ Stable | WebView2 required |
| **macOS** | macOS 10.15 (Catalina) | x64, arm64 (Apple Silicon) | ✅ Stable | Xcode tools required |
| **Linux** | Ubuntu 20.04+ | x64, arm64 | ✅ Stable | GTK3, WebKit2GTK required |
| | Fedora 34+ | x64, arm64 | ✅ Stable | |
| | Arch Linux | x64, arm64 | ✅ Stable | |
| | Debian 11+ | x64, arm64 | ✅ Stable | |

### Platform-Specific Features

#### Windows
- **Native Integration**: System notifications, file associations, jump lists
- **WebView2**: Modern web rendering engine
- **Security**: Code signing support for distribution
- **Installation**: MSI installer support

#### macOS  
- **Native Integration**: Touch Bar support, macOS menu bar integration
- **Apple Silicon**: Native ARM64 support with universal binaries
- **Security**: Notarization and App Store compatibility
- **Installation**: DMG and App Store distribution

#### Linux
- **Desktop Integration**: Follows XDG specifications
- **Package Formats**: AppImage, .deb, .rpm support
- **Window Managers**: Works with GNOME, KDE, XFCE, i3, etc.
- **Security**: Sandboxing with Flatpak/Snap support

## 🔧 API Compatibility

### Tauri APIs by Platform

| API Module | Windows | macOS | Linux | Notes |
|------------|---------|-------|-------|-------|
| **File System** | ✅ | ✅ | ✅ | Full support all platforms |
| **Window Management** | ✅ | ✅ | ✅ | Platform-specific behaviors |
| **System Tray** | ✅ | ✅ | ✅ | Different icon formats |
| **Notifications** | ✅ | ✅ | ✅ | Platform native styles |
| **Global Shortcuts** | ✅ | ✅ | ✅ | Key mapping differences |
| **Clipboard** | ✅ | ✅ | ✅ | HTML/RTF support varies |
| **Dialog** | ✅ | ✅ | ✅ | Native dialog styles |
| **Shell** | ✅ | ✅ | ✅ | Command execution |
| **HTTP** | ✅ | ✅ | ✅ | Network requests |
| **Process** | ✅ | ✅ | ✅ | Process management |

### Frontend Compatibility

| Feature | Windows | macOS | Linux | Implementation |
|---------|---------|-------|-------|----------------|
| **Rich Text Editor** | ✅ | ✅ | ✅ | TipTap/ProseMirror |
| **Math Rendering** | ✅ | ✅ | ✅ | KaTeX |
| **Graph Visualization** | ✅ | ✅ | ✅ | D3.js/Sigma.js |
| **File Drag & Drop** | ✅ | ✅ | ✅ | HTML5 APIs |
| **Keyboard Shortcuts** | ✅* | ✅* | ✅* | Platform-specific mappings |
| **Theme System** | ✅ | ✅ | ✅ | CSS custom properties |

*\* Keyboard shortcuts may use different modifier keys (Ctrl vs Cmd)*

## ⚠️ Known Platform Limitations

### Windows Limitations

#### WebView2 Dependencies
```powershell
# WebView2 is required but may not be installed on older systems
# Solution: Include WebView2 bootstrapper in installer
```

#### File Path Limitations
- Maximum path length: 260 characters (unless enabled in registry)
- Case-insensitive file system
- Special character restrictions in filenames

#### Performance Considerations
- Antivirus software may slow file operations
- Windows Defender SmartScreen may block unsigned executables
- UAC prompts for elevated operations

### macOS Limitations

#### Notarization Requirements
```bash
# Apps must be notarized for distribution outside App Store
codesign --force --deep --timestamp --options runtime --sign "Developer ID" app.app
xcrun notarytool submit app.app --apple-id "email" --password "app-password"
```

#### Sandboxing Restrictions
- Limited file system access in sandboxed environments
- Network access restrictions
- Hardened runtime requirements

#### Apple Silicon Compatibility
- Must build universal binaries for Intel + ARM64
- Some dependencies may need specific ARM64 versions

### Linux Limitations

#### Distribution Variations
- Different package managers across distros
- Varying library versions
- Different desktop environments

#### Dependencies
```bash
# GTK and WebKit versions vary by distribution
# Ubuntu 20.04
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev

# Ubuntu 22.04+
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install gtk3-devel webkit2gtk4.0-devel
```

#### Wayland vs X11
- Some features may behave differently on Wayland
- X11 compatibility layer may be needed
- Global shortcuts may require different implementations

## 🚀 Performance Considerations

### Startup Time Optimization

#### Windows
```javascript
// Windows-specific optimizations
const optimizations = {
  preloadModules: ['tauri', 'fs', 'window'],
  lazyLoadComponents: true,
  cacheEnabled: true
};
```

#### macOS
```javascript
// macOS-specific optimizations
const macOSOptimizations = {
  metalRendering: true,
  cocoaOptimizations: true,
  memoryPressureHandling: true
};
```

#### Linux
```javascript
// Linux-specific optimizations
const linuxOptimizations = {
  gtkThemeOptimization: true,
  waylandOptimizations: true,
  systemdIntegration: true
};
```

### Memory Usage Patterns

| Platform | Typical RAM Usage | Peak Usage | Notes |
|----------|-------------------|------------|-------|
| Windows | 150-200 MB | 400 MB | WebView2 overhead |
| macOS | 120-180 MB | 350 MB | Cocoa framework efficient |
| Linux | 100-150 MB | 300 MB | GTK lightweight |

### Build Time Optimizations

#### Parallel Compilation
```bash
# Windows (PowerShell)
$env:CARGO_BUILD_JOBS = [Environment]::ProcessorCount

# macOS/Linux
export CARGO_BUILD_JOBS=$(nproc)
```

#### Incremental Builds
```toml
# Cargo.toml optimization
[profile.dev]
incremental = true
debug = 1

[profile.release]
lto = true
codegen-units = 1
```

## 💡 Development Tips

### Platform-Specific Debugging

#### Windows Development
```powershell
# Enable Rust backtrace
$env:RUST_BACKTRACE = "full"

# Debug WebView2 issues
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--enable-logging --v=1"

# Visual Studio integration
code --install-extension rust-lang.rust-analyzer
```

#### macOS Development
```bash
# Xcode integration
sudo xcode-select --install

# LLDB debugging
lldb target/debug/lokus

# Instruments profiling
instruments -t "Time Profiler" target/debug/lokus
```

#### Linux Development
```bash
# GDB debugging
gdb target/debug/lokus

# Valgrind memory analysis
valgrind --tool=memcheck target/debug/lokus

# GTK debugging
export GTK_DEBUG=interactive
```

### IDE Recommendations

#### Visual Studio Code
```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "tauri-apps.tauri-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

#### Platform-Specific IDEs
- **Windows**: Visual Studio Community, Visual Studio Code
- **macOS**: Xcode, Visual Studio Code, RustRover
- **Linux**: Visual Studio Code, RustRover, Vim/Neovim

### Testing Strategies

#### Cross-Platform Testing
```bash
# Run tests on all platforms
npm run test:cross-platform

# Platform-specific test suites
npm run test:windows
npm run test:macos  
npm run test:linux
```

#### Automated Testing
```yaml
# GitHub Actions matrix testing
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    include:
      - os: ubuntu-latest
        target: x86_64-unknown-linux-gnu
      - os: windows-latest
        target: x86_64-pc-windows-msvc
      - os: macos-latest
        target: x86_64-apple-darwin
```

## 🔧 Troubleshooting

### Common Build Issues

#### Windows Issues
```powershell
# "MSVC not found"
# Install Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools

# "WebView2 SDK not found"
# Install WebView2 SDK
winget install Microsoft.EdgeWebView2
```

#### macOS Issues
```bash
# "No such file or directory: 'cc'"
xcode-select --install

# "Unable to find Xcode"
sudo xcode-select --reset

# Code signing issues
codesign --verify --deep --strict target/release/bundle/macos/Lokus.app
```

#### Linux Issues
```bash
# "Package gtk+-3.0 was not found"
sudo apt install libgtk-3-dev

# "Package webkit2gtk-4.0 was not found"
sudo apt install libwebkit2gtk-4.0-dev

# Wayland issues
export GDK_BACKEND=x11
```

### Runtime Issues

#### File System Permissions
```javascript
// Check platform-specific permissions
const platform = await import('@tauri-apps/api/os');
const platformType = await platform.type();

switch (platformType) {
  case 'Windows':
    // Handle Windows file permissions
    break;
  case 'Darwin':
    // Handle macOS sandbox permissions
    break;
  case 'Linux':
    // Handle Linux file permissions
    break;
}
```

#### Memory Management
```rust
// Platform-specific memory management in Rust
#[cfg(target_os = "windows")]
fn optimize_for_windows() {
    // Windows-specific optimizations
}

#[cfg(target_os = "macos")]
fn optimize_for_macos() {
    // macOS-specific optimizations
}

#[cfg(target_os = "linux")]
fn optimize_for_linux() {
    // Linux-specific optimizations
}
```

### Performance Debugging

#### Profiling Tools
- **Windows**: Visual Studio Diagnostic Tools, PerfView
- **macOS**: Instruments, Activity Monitor
- **Linux**: perf, htop, valgrind

#### Memory Profiling
```bash
# Platform-specific memory profiling
# Windows
dotMemory.exe target/release/lokus.exe

# macOS
instruments -t "Allocations" target/release/lokus

# Linux
valgrind --tool=massif target/release/lokus
```

## 📚 Additional Resources

### Platform Documentation
- **Windows**: [Microsoft Docs](https://docs.microsoft.com/en-us/windows/win32/)
- **macOS**: [Apple Developer](https://developer.apple.com/documentation/)
- **Linux**: [FreeDesktop.org](https://specifications.freedesktop.org/)

### Tauri Resources
- [Tauri Platform Support](https://tauri.app/v1/guides/getting-started/prerequisites)
- [Cross-Platform Development](https://tauri.app/v1/guides/building/cross-platform)
- [Distribution Guide](https://tauri.app/v1/guides/distribution/)

### Community Support
- [Discord](https://discord.gg/lokus) - Real-time help and discussion
- [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions) - Q&A and ideas
- [Stack Overflow](https://stackoverflow.com/questions/tagged/tauri) - Technical questions

---

*This guide is regularly updated as new platform support features are added to Lokus.*