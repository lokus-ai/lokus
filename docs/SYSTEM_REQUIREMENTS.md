# System Requirements for Lokus

This document outlines the minimum system requirements and prerequisites needed to build and run Lokus across different platforms.

## Minimum System Specifications

### Hardware
- **CPU**: 64-bit processor (x86_64 or ARM64)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**:
  - 2GB for dependencies and build artifacts
  - 500MB for the compiled application
- **Display**: 1024x768 minimum resolution

### Operating Systems
- **macOS**: 11.0 (Big Sur) or later
- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 36+, or equivalent
- **Windows**: Windows 10 (1809 or later) or Windows 11

## Build Prerequisites

### macOS

#### Required Tools
1. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Homebrew** (Package Manager)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. **Rust** (via rustup)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

4. **Node.js 18+**
   ```bash
   brew install node
   ```

#### Optional (for cross-compilation)
- **Docker Desktop**: For Linux builds on macOS
- **cargo-xwin**: For Windows builds on macOS
  ```bash
  cargo install cargo-xwin
  ```

### Linux (Ubuntu/Debian)

#### Required Packages
```bash
sudo apt-get update && sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    libgit2-dev \
    libsecret-1-dev
```

#### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Linux (Fedora/RHEL)

#### Required Packages
```bash
sudo dnf install -y \
    curl \
    wget \
    git \
    gcc \
    gcc-c++ \
    make \
    pkg-config \
    openssl-devel \
    gtk3-devel \
    webkit2gtk4.0-devel \
    webkit2gtk4.1-devel \
    libayatana-appindicator-gtk3-devel \
    librsvg2-devel \
    patchelf \
    libgit2-devel \
    libsecret-devel
```

### Windows

#### Required Tools
1. **Visual Studio Build Tools 2019 or 2022**
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Select "Desktop development with C++" workload
   - Include Windows 10 SDK (10.0.19041.0 or later)

2. **Rust** (via rustup)
   - Download and run: https://win.rustup.rs/x86_64
   - Ensure `msvc` toolchain is installed

3. **Node.js 18+**
   - Download from: https://nodejs.org/
   - LTS version recommended

4. **Git for Windows**
   - Download from: https://git-scm.com/download/win

#### End-User Requirement
- **WebView2 Runtime**: Automatically installed by the installer, but can be manually downloaded from:
  https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## Build Time Estimates

### First Build (Clean)
- **Frontend dependencies**: 2-3 minutes
- **Rust dependencies**: 8-12 minutes
- **Native modules** (isolated-vm): 5-10 minutes (if used)
- **Total**: 15-25 minutes

### Incremental Builds
- **With changes**: 30-90 seconds
- **No changes**: 10-15 seconds

### CI/CD (with caching)
- **Cached dependencies**: 3-5 minutes
- **No cache**: 15-20 minutes

## Common Issues and Solutions

### macOS

**Issue**: "xcrun: error: invalid active developer path"
```bash
# Solution: Install Xcode Command Line Tools
xcode-select --install
```

**Issue**: "ld: library not found for -lgit2"
```bash
# Solution: Install libgit2 via Homebrew
brew install libgit2
```

**Issue**: "gyp: No Xcode or CLT version detected"
```bash
# Solution: Accept Xcode license and verify installation
sudo xcodebuild -license accept
xcode-select --print-path
```

### Linux

**Issue**: "Package libwebkit2gtk-4.0-dev not found"
```bash
# Solution: Update package lists and try alternative package name
sudo apt-get update
sudo apt-get install libwebkit2gtk-4.1-dev
```

**Issue**: "error: linker 'cc' not found"
```bash
# Solution: Install build-essential
sudo apt-get install build-essential
```

**Issue**: "pkg-config not found"
```bash
# Solution: Install pkg-config
sudo apt-get install pkg-config
```

### Windows

**Issue**: "error: Microsoft Visual C++ 14.0 or greater is required"
- **Solution**: Install Visual Studio Build Tools with C++ workload

**Issue**: "LINK : fatal error LNK1181: cannot open input file 'kernel32.lib'"
- **Solution**: Ensure Windows SDK is installed via Visual Studio Installer

**Issue**: "npm install fails with node-gyp error"
- **Solution**: Run PowerShell as Administrator and execute:
  ```powershell
  npm install --global windows-build-tools
  ```

## Dependency Notes

### Bundled Dependencies (No System Installation Required)
The following dependencies are vendored/bundled and don't require system installation:
- **OpenSSL**: Compiled from source (vendored feature)
- **libgit2**: Compiled from source (vendored feature added)

### Platform-Specific Notes

#### isolated-vm Package
- **macOS**: Requires Xcode Command Line Tools
- **Linux**: Requires build-essential and Python 3
- **Windows**: Requires Visual Studio Build Tools
- **Build time**: 5-10 minutes on first install
- **Note**: Currently optional - not used in production code

#### keyring Package
- **macOS**: Uses Security.framework (built-in)
- **Linux**: Requires libsecret-1-dev
- **Windows**: Uses Windows Credential Manager (built-in)

## Development vs Production

### Development Requirements
All of the above requirements are needed for development builds.

### Production/End-User Requirements
End users only need:
- **macOS**: macOS 11.0+ (no additional dependencies)
- **Linux**: GTK3 and WebKitGTK (usually pre-installed on desktop distros)
- **Windows**: Windows 10 1809+ with WebView2 Runtime

## Troubleshooting Build Issues

### Check Your Setup
Run this diagnostic script to verify your environment:
```bash
# Check Node version
node --version  # Should be 18.0.0 or higher

# Check Rust version
rustc --version  # Should be 1.70.0 or higher

# Check cargo
cargo --version

# Check npm
npm --version

# Check git
git --version
```

### Clean Build
If you encounter persistent issues:
```bash
# Clean npm cache and node_modules
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Clean Rust build artifacts
cargo clean

# Clean Tauri build cache
rm -rf src-tauri/target
```

### Platform-Specific Diagnostics

**macOS**:
```bash
# Verify Xcode CLI tools
xcode-select -p

# Check Homebrew
brew doctor
```

**Linux**:
```bash
# Verify GTK and WebKit
pkg-config --modversion gtk+-3.0
pkg-config --modversion webkit2gtk-4.0
```

**Windows**:
```powershell
# Verify Visual Studio Build Tools
where cl.exe

# Check Windows SDK
dir "C:\Program Files (x86)\Windows Kits\10\Include"
```

## Security Notes

### Dependency Auditing
```bash
# Check for npm vulnerabilities
npm audit

# Check for Rust vulnerabilities
cargo audit
```

### Keeping Dependencies Updated
```bash
# Update npm packages
npm update

# Update Rust packages
cargo update
```

## Additional Resources

- **Tauri Prerequisites**: https://tauri.app/v1/guides/getting-started/prerequisites
- **Rust Installation**: https://www.rust-lang.org/tools/install
- **Node.js Downloads**: https://nodejs.org/en/download/
- **Docker Desktop**: https://www.docker.com/products/docker-desktop

## Getting Help

If you encounter issues not covered in this document:
1. Check the [GitHub Issues](https://github.com/lokus-ai/lokus/issues)
2. Search existing discussions
3. Open a new issue with:
   - Operating system and version
   - Node.js version (`node --version`)
   - Rust version (`rustc --version`)
   - Complete error message
   - Build logs

---

**Last Updated**: November 2025
**Lokus Version**: 1.3.3
