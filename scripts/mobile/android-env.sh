#!/bin/bash
# Android Environment Loader
# Sources Android SDK environment variables automatically
# Used by npm scripts to ensure environment is configured

# Try to find Android SDK
if [ -z "$ANDROID_HOME" ]; then
    # Common locations
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "/usr/local/lib/android/sdk" ]; then
        export ANDROID_HOME="/usr/local/lib/android/sdk"
    fi
fi

if [ -z "$ANDROID_HOME" ]; then
    echo "❌ Android SDK not found. Run: npm run setup:android"
    exit 1
fi

# Find latest NDK version
if [ -z "$ANDROID_NDK_HOME" ] && [ -d "$ANDROID_HOME/ndk" ]; then
    NDK_VERSION=$(ls -1 "$ANDROID_HOME/ndk" 2>/dev/null | sort -V | tail -n 1)
    if [ -n "$NDK_VERSION" ]; then
        export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"
        export NDK_HOME="$ANDROID_NDK_HOME"
    fi
fi

# Add to PATH
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

# Run the command passed as arguments
exec "$@"
