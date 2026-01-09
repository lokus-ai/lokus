#!/bin/bash
# Android Development Setup Script for Lokus
# Run this once to set up your Android development environment

set -e

echo "🤖 Setting up Android development environment for Lokus..."
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="macos";;
    MINGW*|CYGWIN*|MSYS*) PLATFORM="windows";;
    *)          echo "❌ Unsupported OS: $OS"; exit 1;;
esac

echo "📍 Detected platform: $PLATFORM"
echo ""

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

# Step 1: Check/Install Rust
echo "📦 Step 1: Checking Rust installation..."
if check_command rustc; then
    echo "   Rust version: $(rustc --version)"
else
    echo "   Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo ""

# Step 2: Install Rust Android targets
echo "📦 Step 2: Installing Rust Android targets..."
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
echo "✅ Rust Android targets installed"
echo ""

# Step 3: Check for Android Studio / SDK
echo "📦 Step 3: Checking Android SDK..."

# Common Android SDK locations
if [ -n "$ANDROID_HOME" ]; then
    ANDROID_SDK="$ANDROID_HOME"
elif [ -d "$HOME/Android/Sdk" ]; then
    ANDROID_SDK="$HOME/Android/Sdk"
elif [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_SDK="$HOME/Library/Android/sdk"
elif [ -d "/usr/local/lib/android/sdk" ]; then
    ANDROID_SDK="/usr/local/lib/android/sdk"
else
    echo "❌ Android SDK not found!"
    echo ""
    echo "Please install Android Studio from:"
    echo "   https://developer.android.com/studio"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

echo "✅ Android SDK found at: $ANDROID_SDK"
echo ""

# Step 4: Check for any installed NDK
echo "📦 Step 4: Checking Android NDK..."

# Find any installed NDK version
if [ -d "$ANDROID_SDK/ndk" ]; then
    NDK_VERSION=$(ls -1 "$ANDROID_SDK/ndk" 2>/dev/null | sort -V | tail -n 1)
fi

if [ -n "$NDK_VERSION" ] && [ -d "$ANDROID_SDK/ndk/$NDK_VERSION" ]; then
    echo "✅ NDK found: $NDK_VERSION"
else
    echo "❌ No NDK installed. Please install NDK via Android Studio:"
    echo "   Android Studio → Settings → SDK Manager → SDK Tools → NDK (Side by side)"
    exit 1
fi
echo ""

# Step 5: Set up environment variables
echo "📦 Step 5: Setting up environment variables..."

# Determine shell config file
if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

# Check if already configured
if grep -q "ANDROID_HOME" "$SHELL_RC" 2>/dev/null; then
    echo "✅ Environment variables already in $SHELL_RC"
else
    echo "" >> "$SHELL_RC"
    echo "# Android SDK (added by Lokus setup)" >> "$SHELL_RC"
    echo "export ANDROID_HOME=\"$ANDROID_SDK\"" >> "$SHELL_RC"
    echo "export ANDROID_NDK_HOME=\"$ANDROID_SDK/ndk/$NDK_VERSION\"" >> "$SHELL_RC"
    echo "export NDK_HOME=\"\$ANDROID_NDK_HOME\"" >> "$SHELL_RC"
    echo "export PATH=\"\$PATH:\$ANDROID_HOME/platform-tools\"" >> "$SHELL_RC"
    echo "export PATH=\"\$PATH:\$ANDROID_HOME/emulator\"" >> "$SHELL_RC"
    echo "✅ Added environment variables to $SHELL_RC"
fi

# Export for current session
export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_NDK_HOME="$ANDROID_SDK/ndk/$NDK_VERSION"
export NDK_HOME="$ANDROID_NDK_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"
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

# Step 7: Initialize Android project
echo "📦 Step 7: Initializing Tauri Android project..."
cd "$(dirname "$0")/../.."
if [ -d "src-tauri/gen/android" ]; then
    echo "✅ Android project already initialized"
else
    cargo tauri android init
    echo "✅ Android project initialized"
fi
echo ""

# Done!
echo "════════════════════════════════════════════════════════════"
echo "✅ Android setup complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Restart your terminal (or run: source $SHELL_RC)"
echo ""
echo "2. Create an Android emulator:"
echo "   • Open Android Studio"
echo "   • Go to Tools → Device Manager"
echo "   • Click 'Create Device'"
echo "   • Select 'Pixel 6' → 'API 31' → Finish"
echo ""
echo "3. Run the app on Android:"
echo "   npm run dev:android"
echo ""
echo "   Or manually:"
echo "   cargo tauri android dev --config src-tauri/tauri.android.conf.json"
echo ""
