#!/bin/bash
# iOS Development Setup Script for Lokus (macOS only)
# Run this once to set up your iOS development environment

set -e

echo "🍎 Setting up iOS development environment for Lokus..."
echo ""

# Check if running on macOS
if [ "$(uname -s)" != "Darwin" ]; then
    echo "❌ iOS development requires macOS."
    echo "   You can still contribute to iOS by pushing code and letting CI build it."
    exit 1
fi

# Check for required tools
check_command() {
    if command -v "$1" &> /dev/null; then
        echo "✅ $1 found"
        return 0
    else
        echo "❌ $1 not found"
        return 1
    fi
}

# Step 1: Check for Xcode
echo "📦 Step 1: Checking Xcode installation..."
if check_command xcodebuild; then
    XCODE_VERSION=$(xcodebuild -version | head -n1)
    echo "   $XCODE_VERSION"

    # Check minimum version (15+)
    MAJOR_VERSION=$(echo "$XCODE_VERSION" | grep -oE '[0-9]+' | head -1)
    if [ "$MAJOR_VERSION" -lt 15 ]; then
        echo "⚠️  Xcode 15+ recommended for Tauri mobile development"
    fi
else
    echo "❌ Xcode not found!"
    echo ""
    echo "Please install Xcode from the Mac App Store:"
    echo "   https://apps.apple.com/app/xcode/id497799835"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi
echo ""

# Step 2: Check Xcode Command Line Tools
echo "📦 Step 2: Checking Xcode Command Line Tools..."
if xcode-select -p &> /dev/null; then
    echo "✅ Command Line Tools installed at: $(xcode-select -p)"
else
    echo "   Installing Command Line Tools..."
    xcode-select --install
    echo "   Please complete the installation popup, then run this script again."
    exit 1
fi
echo ""

# Step 3: Accept Xcode license
echo "📦 Step 3: Checking Xcode license..."
if sudo xcodebuild -license check &> /dev/null; then
    echo "✅ Xcode license accepted"
else
    echo "   Please accept the Xcode license:"
    sudo xcodebuild -license accept
fi
echo ""

# Step 4: Check/Install Rust
echo "📦 Step 4: Checking Rust installation..."
if check_command rustc; then
    echo "   Rust version: $(rustc --version)"
else
    echo "   Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo ""

# Step 5: Install Rust iOS targets
echo "📦 Step 5: Installing Rust iOS targets..."
rustup target add aarch64-apple-ios        # Physical devices
rustup target add aarch64-apple-ios-sim    # Simulator on Apple Silicon
rustup target add x86_64-apple-ios         # Simulator on Intel Mac
echo "✅ Rust iOS targets installed"
echo ""

# Step 6: Install Tauri CLI
echo "📦 Step 6: Checking Tauri CLI..."
if cargo tauri --version &> /dev/null; then
    echo "✅ Tauri CLI already installed: $(cargo tauri --version)"
else
    echo "   Installing Tauri CLI (this may take a few minutes)..."
    cargo install tauri-cli --version "^2.0"
    echo "✅ Tauri CLI installed"
fi
echo ""

# Step 7: Initialize iOS project
echo "📦 Step 7: Initializing Tauri iOS project..."
cd "$(dirname "$0")/../.."
if [ -d "src-tauri/gen/apple" ]; then
    echo "✅ iOS project already initialized"
else
    cargo tauri ios init
    echo "✅ iOS project initialized"
fi
echo ""

# Step 8: List available simulators
echo "📦 Step 8: Available iOS Simulators..."
echo ""
xcrun simctl list devices available | grep -E "iPhone|iPad" | head -10
echo ""

# Done!
echo "════════════════════════════════════════════════════════════"
echo "✅ iOS setup complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Start an iOS Simulator:"
echo "   open -a Simulator"
echo ""
echo "2. Run the app on iOS:"
echo "   npm run dev:ios"
echo ""
echo "   Or manually:"
echo "   cargo tauri ios dev --config src-tauri/tauri.ios.conf.json"
echo ""
echo "Note: Debug builds don't require code signing."
echo "      Release builds require an Apple Developer account."
echo ""
