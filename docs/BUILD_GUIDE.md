# Build Guide

Complete guide for building Lokus across all supported platforms with step-by-step instructions, troubleshooting, and optimization tips.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Platform-Specific Build Instructions](#platform-specific-build-instructions)
- [Build Configurations](#build-configurations)
- [Common Build Errors](#common-build-errors)
- [Release Build Process](#release-build-process)
- [Build Optimization](#build-optimization)
- [Automation and CI/CD](#automation-and-cicd)

## 🔧 Prerequisites

### Required Tools and Versions

| Tool | Windows | macOS | Linux | Notes |
|------|---------|-------|-------|-------|
| **Node.js** | 22.0+ | 22.0+ | 22.0+ | LTS version recommended |
| **npm** | 8.0+ | 8.0+ | 8.0+ | Comes with Node.js |
| **Rust** | 1.70+ | 1.70+ | 1.70+ | Latest stable recommended |
| **Cargo** | 1.70+ | 1.70+ | 1.70+ | Comes with Rust |
| **Tauri CLI** | 2.0+ | 2.0+ | 2.0+ | Install via cargo |

### Platform-Specific Requirements

#### Windows Requirements
```powershell
# Visual Studio Build Tools 2019/2022
winget install Microsoft.VisualStudio.2022.BuildTools

# WebView2 Runtime (for end users)
winget install Microsoft.EdgeWebView2

# Windows SDK (included with VS Build Tools)
# Minimum: Windows 10 SDK (10.0.19041.0)
```

#### macOS Requirements
```bash
# Xcode Command Line Tools
xcode-select --install

# For App Store distribution
# Full Xcode (from Mac App Store)

# Verify installation
xcode-select -p
xcrun --show-sdk-path
```

#### Linux Requirements

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    pkg-config \
    libssl-dev
```

**Fedora/RHEL/CentOS:**
```bash
sudo dnf install -y \
    gcc gcc-c++ make \
    gtk3-devel \
    webkit2gtk4.0-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    openssl-devel \
    pkg-config
```

**Arch Linux:**
```bash
sudo pacman -S \
    base-devel \
    webkit2gtk \
    gtk3 \
    libappindicator-gtk3 \
    librsvg \
    openssl \
    pkg-config
```

## 🏗️ Platform-Specific Build Instructions

### Windows Build

#### 1. Environment Setup
```powershell
# Set up environment variables
$env:RUST_BACKTRACE = "1"
$env:CARGO_BUILD_JOBS = [Environment]::ProcessorCount

# Verify tools
node --version
npm --version
cargo --version
where cl.exe  # Should find MSVC compiler
```

#### 2. Install Dependencies
```powershell
# Clone repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install Node.js dependencies
npm install

# Install Tauri CLI (if not already installed)
npm install -g @tauri-apps/cli
# or locally: npm install @tauri-apps/cli
```

#### 3. Development Build
```powershell
# Start development server
npm run tauri dev

# Or use platform-specific command
npm run dev:windows
```

#### 4. Production Build
```powershell
# Build for Windows
npm run build:windows

# Or build manually
npm run build
npm run tauri build

# Outputs will be in:
# src-tauri/target/release/bundle/msi/Lokus_1.0.3_x64_en-US.msi
# src-tauri/target/release/bundle/nsis/Lokus_1.0.3_x64-setup.exe
```

#### 5. Code Signing (Optional)
```powershell
# Sign the executable (requires certificate)
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 "lokus.exe"
```

### macOS Build

#### 1. Environment Setup
```bash
# Set up environment variables
export RUST_BACKTRACE=1
export CARGO_BUILD_JOBS=$(sysctl -n hw.ncpu)

# Verify tools
node --version
npm --version
cargo --version
xcode-select -p  # Should show Xcode path
```

#### 2. Install Dependencies
```bash
# Clone repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install Node.js dependencies
npm install

# Install Tauri CLI
npm install -g @tauri-apps/cli
```

#### 3. Development Build
```bash
# Start development server
npm run tauri dev

# Or use platform-specific command
npm run dev:macos
```

#### 4. Production Build
```bash
# Build for macOS
npm run build:macos

# Or build manually
npm run build
npm run tauri build

# Outputs will be in:
# src-tauri/target/release/bundle/macos/Lokus.app
# src-tauri/target/release/bundle/dmg/Lokus_1.0.3_x64.dmg
```

#### 5. Universal Binary (Intel + Apple Silicon)
```bash
# Add ARM64 target
rustup target add aarch64-apple-darwin

# Build universal binary
npm run tauri build -- --target universal-apple-darwin

# Or build for specific architecture
npm run tauri build -- --target x86_64-apple-darwin     # Intel
npm run tauri build -- --target aarch64-apple-darwin    # Apple Silicon
```

#### 6. Code Signing and Notarization
```bash
# Sign the application
codesign --force --deep --timestamp --options runtime \
  --sign "Developer ID Application: Your Name" \
  src-tauri/target/release/bundle/macos/Lokus.app

# Notarize for distribution (requires Apple Developer account)
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/Lokus_1.0.3_x64.dmg \
  --apple-id "your-apple-id@example.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID"
```

### Linux Build

#### 1. Environment Setup
```bash
# Set up environment variables
export RUST_BACKTRACE=1
export CARGO_BUILD_JOBS=$(nproc)

# Verify tools
node --version
npm --version
cargo --version
pkg-config --version
```

#### 2. Install Dependencies
```bash
# Clone repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install Node.js dependencies
npm install

# Install Tauri CLI
npm install -g @tauri-apps/cli
```

#### 3. Development Build
```bash
# Start development server
npm run tauri dev

# Or use platform-specific command
npm run dev:linux
```

#### 4. Production Build
```bash
# Build for Linux
npm run build:linux

# Or build manually
npm run build
npm run tauri build

# Outputs will be in:
# src-tauri/target/release/bundle/deb/lokus_1.0.3_amd64.deb
# src-tauri/target/release/bundle/appimage/lokus_1.0.3_amd64.AppImage
# src-tauri/target/release/bundle/rpm/lokus-1.0.3-1.x86_64.rpm
```

#### 5. Additional Package Formats
```bash
# Build specific package types
npm run tauri build -- --bundles deb
npm run tauri build -- --bundles appimage
npm run tauri build -- --bundles rpm

# Build all formats
npm run tauri build -- --bundles deb,appimage,rpm
```

## ⚙️ Build Configurations

### Tauri Configuration

The build behavior is controlled by `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Lokus",
    "version": "1.0.3"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.lokus.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    }
  }
}
```

### Environment-Specific Builds

#### Development Configuration
```bash
# Fast development builds
export TAURI_DEV=true
npm run tauri dev

# With debug symbols
export RUST_LOG=debug
npm run tauri dev
```

#### Production Configuration
```bash
# Optimized release builds
export NODE_ENV=production
npm run build
npm run tauri build --release

# With custom configuration
npm run tauri build --config-file tauri.production.conf.json
```

#### Debug Builds
```bash
# Build with debug information
npm run tauri build --debug

# Specific debug features
export RUST_LOG=tauri=debug,lokus=debug
npm run tauri dev
```

### Custom Build Scripts

The project includes platform-specific build scripts:

```javascript
// package.json scripts
{
  "build:windows": "node scripts/build-windows.js",
  "build:macos": "node scripts/build-macos.js", 
  "build:linux": "node scripts/check-platform.js && npm run tauri build",
  "build:all": "node scripts/check-platform.js && npm run build:windows && npm run build:macos && npm run build:linux"
}
```

## 🚨 Common Build Errors

### Rust/Cargo Errors

#### "failed to compile" errors
```bash
# Clear cargo cache
cargo clean --manifest-path=src-tauri/Cargo.toml

# Update dependencies
cargo update --manifest-path=src-tauri/Cargo.toml

# Rebuild
npm run tauri build
```

#### "linker not found" (Linux)
```bash
# Install missing linker
sudo apt-get install build-essential

# For cross-compilation
sudo apt-get install gcc-mingw-w64  # Windows cross-compile
```

#### Dependency version conflicts
```bash
# Check for dependency issues
cargo tree --manifest-path=src-tauri/Cargo.toml

# Force specific version
# Edit src-tauri/Cargo.toml and add:
# [dependencies]
# problematic-crate = "=1.0.0"
```

### Node.js/npm Errors

#### "ENOENT" or missing module errors
```bash
# Clear npm cache
npm cache clean --force

# Delete and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for conflicting global packages
npm list -g --depth=0
```

#### Memory issues during build
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### Platform-Specific Errors

#### Windows: "MSVC not found"
```powershell
# Install Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools

# Add to PATH (restart terminal)
$env:PATH += ";C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin"
```

#### macOS: "Xcode not found"
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Reset Xcode path
sudo xcode-select --reset

# Verify installation
xcrun --find clang
```

#### Linux: "gtk not found"
```bash
# Install GTK development headers
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev

# Check pkg-config
pkg-config --exists gtk+-3.0 && echo "GTK OK"
```

### Bundle-Specific Errors

#### Icon generation failures
```bash
# Verify icon files exist
ls -la src-tauri/icons/

# Regenerate icons
npm run tauri icon path/to/icon.png

# Manual icon conversion (ImageMagick)
convert icon.png -resize 32x32 icons/32x32.png
convert icon.png -resize 128x128 icons/128x128.png
```

#### Code signing errors (macOS)
```bash
# List available certificates
security find-identity -v -p codesigning

# Verify certificate
codesign --verify --deep --strict Lokus.app

# Re-sign if necessary
codesign --force --deep --sign "Developer ID" Lokus.app
```

#### Package creation failures (Linux)
```bash
# Install packaging tools
sudo apt-get install rpm build-essential

# Manual .deb creation
dpkg-deb --build lokus_1.0.3_amd64

# Manual AppImage creation
# Use appimagetool from AppImageKit
```

## 📦 Release Build Process

### Automated Release Workflow

#### 1. Pre-release Checklist
```bash
# Run all tests
npm test
npm run test:e2e

# Check build on all platforms
npm run build:all

# Verify version numbers
grep version package.json
grep version src-tauri/Cargo.toml
grep version src-tauri/tauri.conf.json
```

#### 2. Version Management
```bash
# Update version (updates all files)
npm version patch  # or minor/major

# Manual version update
npm run version:update 1.0.4
```

#### 3. Build for Distribution
```bash
# Clean build
npm run clean
npm install

# Build all platforms
npm run build:all

# Create checksums
cd src-tauri/target/release/bundle
sha256sum *.msi *.exe *.dmg *.deb *.AppImage *.rpm > checksums.txt
```

#### 4. Distribution Preparation
```bash
# Sign binaries (platform-specific)
# Windows: Use signtool
# macOS: Use codesign + notarytool
# Linux: GPG signing (optional)

# Create release notes
git log --oneline v1.0.2..HEAD > RELEASE_NOTES.md

# Package for distribution
mkdir release-v1.0.3
cp src-tauri/target/release/bundle/* release-v1.0.3/
```

### Manual Release Process

#### Windows Release
```powershell
# Build Windows installer
npm run build:windows

# Test installer
# Install on clean Windows VM
# Verify all features work

# Upload to GitHub Releases
gh release create v1.0.3 `
  src-tauri/target/release/bundle/msi/Lokus_1.0.3_x64_en-US.msi `
  src-tauri/target/release/bundle/nsis/Lokus_1.0.3_x64-setup.exe
```

#### macOS Release
```bash
# Build macOS app
npm run build:macos

# Create DMG
npm run tauri build -- --bundles dmg

# Sign and notarize
./scripts/sign-and-notarize.sh

# Upload to GitHub Releases
gh release upload v1.0.3 src-tauri/target/release/bundle/dmg/Lokus_1.0.3_x64.dmg
```

#### Linux Release
```bash
# Build Linux packages
npm run build:linux

# Test packages
sudo dpkg -i src-tauri/target/release/bundle/deb/lokus_1.0.3_amd64.deb
./src-tauri/target/release/bundle/appimage/lokus_1.0.3_amd64.AppImage

# Upload to GitHub Releases
gh release upload v1.0.3 \
  src-tauri/target/release/bundle/deb/lokus_1.0.3_amd64.deb \
  src-tauri/target/release/bundle/appimage/lokus_1.0.3_amd64.AppImage \
  src-tauri/target/release/bundle/rpm/lokus-1.0.3-1.x86_64.rpm
```

## 🚀 Build Optimization

### Performance Optimization

#### Rust Compilation
```toml
# src-tauri/Cargo.toml
[profile.release]
lto = true              # Link-time optimization
codegen-units = 1       # Better optimization
panic = "abort"         # Smaller binary size
strip = true            # Remove debug symbols

[profile.dev]
incremental = true      # Faster rebuilds
debug = 1              # Limited debug info
```

#### Parallel Builds
```bash
# Use all CPU cores
export CARGO_BUILD_JOBS=$(nproc)           # Linux
export CARGO_BUILD_JOBS=$(sysctl -n hw.ncpu) # macOS
$env:CARGO_BUILD_JOBS = [Environment]::ProcessorCount # Windows

# Limit if memory constrained
export CARGO_BUILD_JOBS=2
```

#### Caching Strategies
```bash
# Enable cargo caching
export CARGO_HOME="$HOME/.cargo"
export CARGO_TARGET_DIR="$PWD/target"

# Use sccache for distributed caching
cargo install sccache
export RUSTC_WRAPPER=sccache
```

### Bundle Size Optimization

#### Frontend Optimization
```javascript
// vite.config.js
export default {
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          editor: ['@tiptap/react', '@tiptap/starter-kit']
        }
      }
    }
  }
}
```

#### Asset Optimization
```bash
# Optimize images
npm run optimize:images

# Minimize icon sizes
npm run tauri icon --optimize app-icon.png
```

#### Dependency Analysis
```bash
# Analyze bundle size
npm run build:analyze

# Check Rust dependencies
cargo tree --duplicates --manifest-path=src-tauri/Cargo.toml
```

### CI/CD Integration

#### GitHub Actions Workflow
```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]

    runs-on: ${{ matrix.platform }}

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 22
        cache: 'npm'
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        profile: minimal
    
    - name: Install platform dependencies
      if: matrix.platform == 'ubuntu-latest'
      run: |
        sudo apt-get update
        sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run tauri build
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: ${{ matrix.platform }}-build
        path: src-tauri/target/release/bundle/
```

#### Build Caching
```yaml
# Cache Rust dependencies
- name: Cache Rust dependencies
  uses: actions/cache@v3
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      src-tauri/target
    key: ${{ runner.os }}-cargo-${{ hashFiles('src-tauri/Cargo.lock') }}

# Cache Node.js dependencies
- name: Cache Node.js dependencies
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

## 📝 Build Verification

### Quality Assurance Checklist

- [ ] Application starts without errors
- [ ] All features work as expected
- [ ] File operations (open, save, export) function correctly
- [ ] Math rendering displays properly
- [ ] Theme switching works
- [ ] Keyboard shortcuts respond
- [ ] Window operations (minimize, maximize, close) work
- [ ] Installation/uninstallation process is smooth
- [ ] Binary size is reasonable (< 100MB)
- [ ] Memory usage is within acceptable limits
- [ ] No security warnings from antivirus/system

### Automated Testing
```bash
# Run full test suite
npm run test:all

# Platform-specific tests
npm run test:platform

# Performance benchmarks
npm run test:performance

# Security scan
npm audit
cargo audit --manifest-path=src-tauri/Cargo.toml
```

---

*This build guide is maintained alongside the project and updated with each major release.*