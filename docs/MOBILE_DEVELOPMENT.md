# Mobile Development Guide

This guide explains how to set up your local environment to develop and test the Lokus mobile app on iOS and Android.

## Overview

Lokus uses **Tauri 2.0** for both desktop and mobile platforms. This means the same React frontend and Rust backend code runs on iOS and Android with minimal platform-specific code.

## Prerequisites

### All Platforms
- Node.js 20+ (`node --version`)
- npm or pnpm
- Rust (latest stable) - `rustup update stable`
- Tauri CLI - `cargo install tauri-cli --version "^2.0"`

### iOS Development (macOS only)

**Required:**
1. **Xcode 15+** - Download from Mac App Store
2. **Xcode Command Line Tools** - `xcode-select --install`
3. **iOS Simulator** - Comes with Xcode

**Install Rust iOS targets:**
```bash
rustup target add aarch64-apple-ios        # iPhone/iPad (ARM64)
rustup target add aarch64-apple-ios-sim    # Simulator on Apple Silicon
rustup target add x86_64-apple-ios         # Simulator on Intel Mac
```

### Android Development (All platforms)

**Required:**
1. **Android Studio** - Download from https://developer.android.com/studio
2. **JDK 17+** - Usually bundled with Android Studio
3. **Android SDK** - Install via Android Studio SDK Manager
4. **Android NDK** - Version 25.2.9519653 recommended

**Install Rust Android targets:**
```bash
rustup target add aarch64-linux-android    # ARM64 devices
rustup target add armv7-linux-androideabi  # ARM32 devices
rustup target add i686-linux-android       # x86 emulator
rustup target add x86_64-linux-android     # x86_64 emulator
```

**Environment variables (add to `.bashrc`/`.zshrc`):**
```bash
export ANDROID_HOME="$HOME/Android/Sdk"          # or ~/Library/Android/sdk on macOS
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/25.2.9519653"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/tools/bin"
```

## Quick Start (Automated Setup)

We have setup scripts that handle everything for you!

### Android Setup (Any OS)

```bash
git clone https://github.com/lokus-ai/lokus.git
cd lokus
npm install

# Run the automated setup script
npm run setup:android
```

This script will:
- Install Rust Android targets
- Check/configure Android SDK & NDK
- Set up environment variables
- Install Tauri CLI
- Initialize the Android project

### iOS Setup (macOS only)

```bash
npm run setup:ios
```

This script will:
- Check Xcode installation
- Install Rust iOS targets
- Install Tauri CLI
- Initialize the iOS project

### Running the App

After setup, just run:

```bash
# Android (start emulator first)
npm run dev:android

# iOS (start simulator first)
npm run dev:ios
```

---

## Manual Setup (Alternative)

If you prefer to set things up manually:

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/lokus-ai/lokus.git
cd lokus
npm install
```

### 2. Initialize Mobile Targets

**Initialize Android:**
```bash
cargo tauri android init
```

**Initialize iOS (macOS only):**
```bash
cargo tauri ios init
```

This creates platform-specific project files in `src-tauri/gen/`.

### 3. Run on Device/Emulator

**Android:**
```bash
# Start an emulator first (via Android Studio AVD Manager)
# Or connect a physical device with USB debugging enabled

npm run dev:android
```

**iOS:**
```bash
# Start iOS Simulator first
open -a Simulator

npm run dev:ios
```

## Setting Up Emulators

### Android Emulator

1. Open Android Studio
2. Go to **Tools > Device Manager**
3. Click **Create Device**
4. Select a device (e.g., Pixel 6)
5. Select a system image (API 31+ recommended)
6. Finish and start the emulator

**Command line alternative:**
```bash
# List available AVDs
emulator -list-avds

# Start an AVD
emulator -avd Pixel_6_API_31
```

### iOS Simulator (macOS)

```bash
# List available simulators
xcrun simctl list devices

# Boot a specific simulator
xcrun simctl boot "iPhone 15"

# Or simply open Simulator app
open -a Simulator
```

## Building for Release

### Android APK

```bash
cargo tauri android build --config src-tauri/tauri.android.conf.json
```

Output: `src-tauri/gen/android/app/build/outputs/apk/`

### iOS IPA

```bash
cargo tauri ios build --config src-tauri/tauri.ios.conf.json
```

Output: `src-tauri/gen/apple/build/`

Note: Release builds require proper code signing. See CI/CD workflows for details.

## Running E2E Tests Locally

We use **Maestro** for mobile E2E testing.

### Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Run Tests

**Android:**
```bash
# Build and install the debug APK first
cargo tauri android build --debug --config src-tauri/tauri.android.conf.json
adb install src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk

# Run smoke test
maestro test tests/e2e/mobile/smoke.yaml
```

**iOS:**
```bash
# Build for simulator
cargo tauri ios build --debug --config src-tauri/tauri.ios.conf.json

# Install on simulator
xcrun simctl install booted src-tauri/gen/apple/build/Debug-iphonesimulator/Lokus.app

# Run smoke test
maestro test tests/e2e/mobile/smoke.yaml
```

## Project Structure (Mobile)

```
src-tauri/
├── tauri.conf.json          # Base config (desktop)
├── tauri.ios.conf.json      # iOS-specific config
├── tauri.android.conf.json  # Android-specific config
├── gen/                     # Generated mobile projects (gitignored)
│   ├── android/             # Android Studio project
│   │   ├── app/
│   │   └── build.gradle
│   └── apple/               # Xcode project
│       └── Lokus.xcodeproj
└── icons/
    ├── ios/                 # iOS app icons
    └── android/             # Android app icons

tests/e2e/mobile/
├── smoke.yaml               # Basic smoke test
├── launcher.yaml            # Launcher flow test
└── workspace.yaml           # Workspace operations test
```

## Troubleshooting

### "SDK not found" or "NDK not found"

Make sure environment variables are set:
```bash
echo $ANDROID_HOME
echo $ANDROID_NDK_HOME
```

If empty, set them as described in Prerequisites.

### "No connected devices found"

**Android:**
- Ensure emulator is running or device is connected
- Run `adb devices` to verify connection
- For physical devices, enable USB debugging in Developer Options

**iOS:**
- Ensure Simulator is running: `open -a Simulator`
- Check available simulators: `xcrun simctl list devices`

### Build fails with signing errors (iOS)

For development/debugging, use the `--debug` flag which doesn't require signing:
```bash
cargo tauri ios build --debug
```

For release builds, you need an Apple Developer account and proper certificates.

### Slow emulator performance

**Android:**
- Enable hardware acceleration (HAXM on Intel, Hypervisor Framework on Apple Silicon)
- Use x86_64 system images instead of ARM
- Allocate more RAM in AVD settings

**iOS:**
- Simulator performance depends on your Mac's specs
- Close other resource-heavy applications

### "Unable to boot device in current state"

The simulator might already be running. Try:
```bash
xcrun simctl shutdown all
xcrun simctl boot "iPhone 15"
```

## CI/CD Workflows

Mobile builds and tests run automatically on GitHub Actions:

- **build-mobile.yml** - Builds debug APK/IPA on every push
- **e2e-mobile.yml** - Runs Maestro E2E tests on emulators
- **release.yml** - Builds signed release versions on tags

## New Secrets Required for Mobile CI/CD

Add these secrets to your GitHub repository settings:

### Android
- `ANDROID_KEYSTORE_BASE64` - Base64 encoded `.jks` keystore file
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias in keystore
- `ANDROID_KEY_PASSWORD` - Key password

### iOS
- `APPLE_IOS_CERTIFICATE` - Base64 encoded iOS distribution certificate
- `IOS_PROVISIONING_PROFILE` - Base64 encoded provisioning profile

## Tips for Contributors

1. **Test on both platforms** - If you have access to both iOS and Android, test your changes on both
2. **Use debug builds** - They're faster and don't require signing
3. **Check responsive layout** - Mobile screens are smaller, ensure UI adapts
4. **Mind touch targets** - Buttons should be at least 44x44 points for touchability
5. **Test offline** - Mobile users often have spotty connectivity

## Getting Help

- Create an issue on GitHub with the `mobile` label
- Check existing issues for known problems
- Include logs from `cargo tauri android dev` or `cargo tauri ios dev`
