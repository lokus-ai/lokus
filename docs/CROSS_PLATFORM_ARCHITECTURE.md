# Cross-Platform Architecture: Desktop + Mobile

> A comprehensive guide for adding mobile (iOS/Android) support to Lokus while maintaining the existing desktop (Windows/macOS/Linux) application in a single monorepo.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Mobile Strategy Options](#mobile-strategy-options)
4. [Recommended Architecture](#recommended-architecture)
5. [Monorepo Structure](#monorepo-structure)
6. [CI/CD Pipeline Design](#cicd-pipeline-design)
7. [Testing Strategy](#testing-strategy)
8. [Contributor Experience](#contributor-experience)
9. [Implementation Roadmap](#implementation-roadmap)
10. [References & Research](#references--research)

---

## Executive Summary

This document outlines the architecture for expanding Lokus from a desktop-only application to a cross-platform solution supporting:

- **Desktop**: Windows, macOS, Linux (existing - Tauri 2.0)
- **Mobile**: iOS, Android (new)

### Key Decisions

| Aspect | Recommendation | Rationale |
|--------|---------------|-----------|
| Mobile Framework | **Tauri 2.0 Mobile** | Already using Tauri, code sharing maximized, same Rust backend |
| Monorepo Tool | **Turborepo** | Modern, fast caching, works well with npm/pnpm |
| CI/CD | **GitHub Actions** | Already in use, good mobile support with matrix builds |
| Mobile Testing | **Detox + Firebase Test Lab** | Gray-box testing for React, cloud device testing |
| Local Dev | **Dev containers + Scripts** | Simplify emulator setup for contributors |

---

## Current Architecture Analysis

### Tech Stack (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│                    LOKUS DESKTOP                        │
├─────────────────────────────────────────────────────────┤
│  Frontend (React 19 + Vite)                             │
│  ├── 154 React components                               │
│  ├── TipTap editor, TLDraw, React Sigma                │
│  ├── Tailwind CSS styling                               │
│  └── Platform-specific code (src/platform/)             │
├─────────────────────────────────────────────────────────┤
│  Backend (Rust/Tauri 2.0)                               │
│  ├── File system operations                             │
│  ├── Iroh P2P sync                                      │
│  ├── MCP server                                         │
│  ├── Secure storage (Keyring)                           │
│  └── Platform-specific (macOS/Windows handlers)         │
├─────────────────────────────────────────────────────────┤
│  Platforms: Windows, macOS, Linux                       │
│  Packaging: MSI, DMG, DEB, RPM, AppImage               │
└─────────────────────────────────────────────────────────┘
```

### Existing CI/CD

- **test.yml**: Unit tests on Windows/macOS/Linux, build verification
- **e2e-tests-new.yml**: Playwright E2E tests across platforms
- **build-multi-platform.yml**: Parallel desktop builds
- **release.yml**: Tagged releases with code signing, App Store builds

### Code Sharing Potential

| Layer | Shareable | Notes |
|-------|-----------|-------|
| React Components | ~70% | Need responsive/touch adaptations |
| Business Logic (JS) | ~90% | Core logic is platform-agnostic |
| Rust Backend | ~60-80% | Mobile needs different storage APIs |
| Styling | ~40% | Mobile needs different layouts |
| Platform Code | 0% | Separate per platform |

---

## Mobile Strategy Options

### Option 1: Tauri 2.0 Mobile (Recommended ⭐)

**Since Tauri 2.0 (October 2024), mobile is officially supported and stable.**

```
Pros:
✅ Maximum code sharing with existing desktop app
✅ Same Rust backend for iOS and Android
✅ Single codebase for all 5 platforms
✅ Already have Tauri expertise
✅ Lightweight (no Electron bloat)
✅ Native WebView performance

Cons:
⚠️ Mobile tooling less mature than React Native
⚠️ Smaller community for mobile-specific issues
⚠️ Some plugins may not support mobile yet
```

**Effort**: Medium (3-4 months to MVP)

### Option 2: React Native + Expo

```
Pros:
✅ Mature mobile ecosystem
✅ Large community and resources
✅ EAS Build for cloud CI/CD
✅ Over-the-air updates
✅ Excellent developer experience

Cons:
❌ Separate codebase from desktop
❌ Need to rewrite Rust backend in JS/TS
❌ Cannot share Tauri plugins
❌ Two different runtime environments
```

**Effort**: High (6-9 months to MVP)

### Option 3: Capacitor (Obsidian's approach)

```
Pros:
✅ Web-first approach
✅ Can wrap existing Vite app
✅ Simpler than React Native

Cons:
❌ Cannot use Rust backend on mobile
❌ Limited native capabilities
❌ Performance concerns for heavy apps
```

**Effort**: Medium-Low (2-3 months to MVP)

### Option 4: Flutter

```
Pros:
✅ Excellent cross-platform support
✅ Great performance
✅ Can use Rust via FFI

Cons:
❌ Completely separate codebase (Dart)
❌ Cannot share React components
❌ Learning curve for team
```

**Effort**: Very High (9-12 months to MVP)

### Recommendation Matrix

| Criteria | Weight | Tauri Mobile | React Native | Capacitor | Flutter |
|----------|--------|--------------|--------------|-----------|---------|
| Code Sharing | 30% | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Backend Reuse | 25% | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐ |
| Time to MVP | 20% | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Community | 15% | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Performance | 10% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Total** | 100% | **4.35** | 2.7 | 2.55 | 2.35 |

**Winner: Tauri 2.0 Mobile** - Maximizes existing investment and code sharing.

---

## Recommended Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOKUS MONOREPO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SHARED PACKAGES                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  @lokus/core         - Business logic, state management  │   │
│  │  @lokus/ui           - Shared React components           │   │
│  │  @lokus/editor       - TipTap editor configuration       │   │
│  │  @lokus/markdown     - Markdown processing               │   │
│  │  @lokus/types        - TypeScript type definitions       │   │
│  │  @lokus/utils        - Utility functions                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│              ┌───────────────┼───────────────┐                 │
│              ▼               ▼               ▼                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │   DESKTOP     │  │     iOS       │  │   ANDROID     │      │
│  │   (Tauri)     │  │   (Tauri)     │  │   (Tauri)     │      │
│  ├───────────────┤  ├───────────────┤  ├───────────────┤      │
│  │ Platform UI   │  │ Platform UI   │  │ Platform UI   │      │
│  │ Rust Backend  │  │ Rust Backend  │  │ Rust Backend  │      │
│  │ Native APIs   │  │ Native APIs   │  │ Native APIs   │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Sharing Strategy

```javascript
// packages/ui/src/components/NoteCard.jsx
// Shared component with platform-specific variants

import { Platform } from '@lokus/core';

export function NoteCard({ note, onPress }) {
  const isMobile = Platform.isMobile();

  return (
    <div
      className={cn(
        "note-card",
        isMobile ? "touch-target-48" : "hover:bg-gray-100"
      )}
      onClick={!isMobile ? onPress : undefined}
      onTouchEnd={isMobile ? onPress : undefined}
    >
      {/* Shared content */}
    </div>
  );
}
```

### Platform Abstraction Layer

```javascript
// packages/core/src/platform/index.js

export const Platform = {
  isDesktop: () => ['windows', 'macos', 'linux'].includes(getPlatform()),
  isMobile: () => ['ios', 'android'].includes(getPlatform()),
  isIOS: () => getPlatform() === 'ios',
  isAndroid: () => getPlatform() === 'android',
  isMac: () => getPlatform() === 'macos',
  isWindows: () => getPlatform() === 'windows',

  // Storage abstraction
  storage: {
    async get(key) { /* platform-specific */ },
    async set(key, value) { /* platform-specific */ },
  },

  // File system abstraction
  fs: {
    async readFile(path) { /* platform-specific */ },
    async writeFile(path, content) { /* platform-specific */ },
  },
};
```

---

## Monorepo Structure

### Proposed Directory Layout

```
lokus/
├── .github/
│   └── workflows/
│       ├── test.yml                    # Unit tests (all platforms)
│       ├── build-desktop.yml           # Desktop builds
│       ├── build-mobile.yml            # Mobile builds (iOS/Android)
│       ├── e2e-desktop.yml             # Desktop E2E tests
│       ├── e2e-mobile.yml              # Mobile E2E tests (Detox)
│       └── release.yml                 # Full release pipeline
│
├── apps/
│   ├── desktop/                        # Tauri desktop app
│   │   ├── src/                        # Desktop-specific React code
│   │   ├── src-tauri/                  # Rust backend (desktop)
│   │   ├── tauri.conf.json
│   │   └── package.json
│   │
│   ├── mobile/                         # Tauri mobile app
│   │   ├── src/                        # Mobile-specific React code
│   │   ├── src-tauri/                  # Rust backend (mobile)
│   │   │   ├── gen/
│   │   │   │   ├── android/            # Android project
│   │   │   │   └── apple/              # iOS project
│   │   │   └── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── package.json
│   │
│   └── web/                            # (Optional) Web version
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── core/                           # Shared business logic
│   │   ├── src/
│   │   │   ├── blocks/                 # Block/content management
│   │   │   ├── tasks/                  # Task management
│   │   │   ├── workspace/              # Workspace logic
│   │   │   ├── markdown/               # Markdown processing
│   │   │   ├── platform/               # Platform abstractions
│   │   │   └── index.js
│   │   └── package.json
│   │
│   ├── ui/                             # Shared UI components
│   │   ├── src/
│   │   │   ├── components/             # Shared React components
│   │   │   ├── hooks/                  # Shared hooks
│   │   │   └── styles/                 # Shared styles
│   │   └── package.json
│   │
│   ├── editor/                         # TipTap editor package
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── plugin-sdk/                     # (Existing) Plugin SDK
│   └── lokus-plugin-cli/               # (Existing) Plugin CLI
│
├── rust/                               # Shared Rust code
│   ├── lokus-core/                     # Core Rust library
│   │   ├── src/
│   │   │   ├── storage/                # Storage abstractions
│   │   │   ├── sync/                   # Iroh sync
│   │   │   ├── crypto/                 # Encryption
│   │   │   └── lib.rs
│   │   └── Cargo.toml
│   │
│   └── lokus-mobile/                   # Mobile-specific Rust
│       ├── src/
│       └── Cargo.toml
│
├── tests/
│   ├── unit/                           # Shared unit tests
│   ├── e2e/
│   │   ├── desktop/                    # Playwright desktop tests
│   │   └── mobile/                     # Detox mobile tests
│   └── integration/
│
├── scripts/
│   ├── setup-dev-env.sh                # Development setup
│   ├── setup-ios.sh                    # iOS environment setup
│   ├── setup-android.sh                # Android environment setup
│   └── ci/
│       ├── build-android.sh
│       └── build-ios.sh
│
├── docs/
│   ├── CONTRIBUTING.md
│   ├── MOBILE_DEVELOPMENT.md           # Mobile dev guide
│   └── ARCHITECTURE.md
│
├── turbo.json                          # Turborepo configuration
├── package.json                        # Root package.json
└── pnpm-workspace.yaml                 # pnpm workspaces
```

### Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "build:desktop": {
      "dependsOn": ["^build"],
      "outputs": ["apps/desktop/src-tauri/target/**"]
    },
    "build:ios": {
      "dependsOn": ["^build"],
      "outputs": ["apps/mobile/src-tauri/gen/apple/**"]
    },
    "build:android": {
      "dependsOn": ["^build"],
      "outputs": ["apps/mobile/src-tauri/gen/android/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e:desktop": {
      "dependsOn": ["build:desktop"]
    },
    "test:e2e:mobile": {
      "dependsOn": ["build:ios", "build:android"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## CI/CD Pipeline Design

### Pipeline Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    CI/CD PIPELINE FLOW                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                │
│  │  Lint    │───▶│  Test    │───▶│  Build   │                │
│  │  Check   │    │  Unit    │    │  All     │                │
│  └──────────┘    └──────────┘    └──────────┘                │
│                                       │                        │
│       ┌───────────────────────────────┼────────────────┐      │
│       ▼               ▼               ▼                ▼      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ Windows │    │  macOS  │    │  Linux  │    │ Mobile  │   │
│  │  Build  │    │  Build  │    │  Build  │    │  Build  │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│       │               │               │         │      │      │
│       │               │               │    ┌────┴──────┤      │
│       │               │               │    ▼           ▼      │
│       │               │               │ ┌─────┐    ┌─────┐   │
│       │               │               │ │ iOS │    │ And │   │
│       │               │               │ │Build│    │Build│   │
│       │               │               │ └─────┘    └─────┘   │
│       ▼               ▼               ▼    │           │      │
│  ┌──────────────────────────────────────┐  │           │      │
│  │          E2E Tests (Desktop)          │  │           │      │
│  │          Playwright                   │  │           │      │
│  └──────────────────────────────────────┘  │           │      │
│                                            ▼           ▼      │
│                    ┌───────────────────────────────────┐      │
│                    │     E2E Tests (Mobile)            │      │
│                    │  Detox + Firebase Test Lab        │      │
│                    └───────────────────────────────────┘      │
│                                       │                        │
│                                       ▼                        │
│                    ┌───────────────────────────────────┐      │
│                    │         Release                   │      │
│                    │   Code Signing + Distribution     │      │
│                    └───────────────────────────────────┘      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Workflow: Mobile Builds (`.github/workflows/build-mobile.yml`)

```yaml
name: Mobile Builds

on:
  push:
    branches: [main, develop]
    paths:
      - 'apps/mobile/**'
      - 'packages/**'
      - 'rust/**'
  pull_request:
    branches: [main]
    paths:
      - 'apps/mobile/**'
      - 'packages/**'
      - 'rust/**'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ─────────────────────────────────────────────────────────────
  # Android Build
  # ─────────────────────────────────────────────────────────────
  build-android:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Setup NDK
        run: |
          sdkmanager "ndk;25.2.9519653"
          echo "ANDROID_NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653" >> $GITHUB_ENV

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-linux-android,armv7-linux-androideabi,i686-linux-android,x86_64-linux-android

      - name: Rust Cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: 'apps/mobile/src-tauri -> target'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install

      - name: Build Android
        run: |
          cd apps/mobile
          pnpm tauri android build
        env:
          ANDROID_KEYSTORE_PATH: ${{ secrets.ANDROID_KEYSTORE_PATH }}
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: android-apk
          path: apps/mobile/src-tauri/gen/android/app/build/outputs/apk/
          retention-days: 7

  # ─────────────────────────────────────────────────────────────
  # iOS Build
  # ─────────────────────────────────────────────────────────────
  build-ios:
    runs-on: macos-14  # M1 runner for faster builds

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.2'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-ios,aarch64-apple-ios-sim,x86_64-apple-ios

      - name: Rust Cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: 'apps/mobile/src-tauri -> target'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install

      - name: Install iOS Certificate
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)

          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          echo "$APPLE_CERTIFICATE" | base64 --decode > $RUNNER_TEMP/certificate.p12
          security import $RUNNER_TEMP/certificate.p12 -P "$APPLE_CERTIFICATE_PASSWORD" \
            -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH

      - name: Install Provisioning Profile
        env:
          PROVISIONING_PROFILE: ${{ secrets.IOS_PROVISIONING_PROFILE }}
        run: |
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          echo "$PROVISIONING_PROFILE" | base64 --decode > \
            ~/Library/MobileDevice/Provisioning\ Profiles/lokus.mobileprovision

      - name: Build iOS
        run: |
          cd apps/mobile
          pnpm tauri ios build
        env:
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}

      - name: Upload IPA
        uses: actions/upload-artifact@v4
        with:
          name: ios-ipa
          path: apps/mobile/src-tauri/gen/apple/build/
          retention-days: 7
```

### Workflow: Mobile E2E Tests (`.github/workflows/e2e-mobile.yml`)

```yaml
name: Mobile E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  # ─────────────────────────────────────────────────────────────
  # Android E2E Tests with Detox
  # ─────────────────────────────────────────────────────────────
  e2e-android:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install

      - name: Build Android (Debug)
        run: |
          cd apps/mobile
          pnpm detox build --configuration android.emu.debug

      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: Run Android Emulator and Tests
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 31
          target: google_apis
          arch: x86_64
          profile: Pixel 6
          script: |
            cd apps/mobile
            pnpm detox test --configuration android.emu.debug \
              --headless \
              --record-logs failing \
              --record-videos failing

      - name: Upload Test Artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: android-e2e-artifacts
          path: apps/mobile/artifacts/
          retention-days: 7

  # ─────────────────────────────────────────────────────────────
  # iOS E2E Tests with Detox
  # ─────────────────────────────────────────────────────────────
  e2e-ios:
    runs-on: macos-13  # Use macos-13 for stability

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.2'

      - name: Install applesimutils
        run: |
          brew tap wix/brew
          brew install applesimutils

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install Dependencies
        run: pnpm install

      - name: Build iOS (Debug)
        run: |
          cd apps/mobile
          pnpm detox build --configuration ios.sim.debug

      - name: Run iOS Simulator Tests
        run: |
          cd apps/mobile
          pnpm detox test --configuration ios.sim.debug \
            --headless \
            --record-logs failing \
            --record-videos failing \
            --take-screenshots failing

      - name: Upload Test Artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: ios-e2e-artifacts
          path: apps/mobile/artifacts/
          retention-days: 7

  # ─────────────────────────────────────────────────────────────
  # Firebase Test Lab (Real Devices)
  # ─────────────────────────────────────────────────────────────
  firebase-test-lab:
    runs-on: ubuntu-latest
    needs: [e2e-android]  # Only run after emulator tests pass
    if: github.ref == 'refs/heads/main'  # Only on main branch

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download Android APK
        uses: actions/download-artifact@v4
        with:
          name: android-apk
          path: ./apk

      - name: Authenticate with Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Setup gcloud CLI
        uses: google-github-actions/setup-gcloud@v2

      - name: Run Firebase Test Lab
        run: |
          gcloud firebase test android run \
            --type instrumentation \
            --app ./apk/debug/app-debug.apk \
            --test ./apk/androidTest/debug/app-debug-androidTest.apk \
            --device model=Pixel6,version=31 \
            --device model=Pixel4,version=30 \
            --timeout 15m \
            --results-bucket gs://lokus-test-results
```

### Workflow: Full Release (`.github/workflows/release.yml`)

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  # ─────────────────────────────────────────────────────────────
  # Desktop Releases (Windows, macOS, Linux)
  # ─────────────────────────────────────────────────────────────
  release-desktop:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            name: macOS
          - platform: ubuntu-22.04
            name: Linux
          - platform: windows-latest
            name: Windows

    runs-on: ${{ matrix.platform }}

    steps:
      # ... (existing desktop release steps)

  # ─────────────────────────────────────────────────────────────
  # Mobile Releases (iOS, Android)
  # ─────────────────────────────────────────────────────────────
  release-android:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # ... (Android build steps)

      - name: Upload to Play Store (Internal Track)
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          packageName: io.lokus.app
          releaseFiles: apps/mobile/src-tauri/gen/android/app/build/outputs/bundle/release/*.aab
          track: internal
          status: completed

  release-ios:
    runs-on: macos-14

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # ... (iOS build steps)

      - name: Upload to TestFlight
        env:
          APPLE_API_KEY_PATH: ${{ secrets.APPLE_API_KEY_PATH }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
        run: |
          xcrun altool --upload-app \
            --type ios \
            --file apps/mobile/src-tauri/gen/apple/build/Lokus.ipa \
            --apiKey "$APPLE_API_KEY" \
            --apiIssuer "$APPLE_API_ISSUER"

  # ─────────────────────────────────────────────────────────────
  # App Store Release (Production)
  # ─────────────────────────────────────────────────────────────
  release-appstore:
    needs: [release-ios]
    runs-on: macos-14
    if: ${{ !contains(github.ref_name, 'beta') && !contains(github.ref_name, 'alpha') }}

    steps:
      # ... (App Store submission steps using Transporter or altool)
```

### CI/CD Cost Optimization

| Platform | Runner | Cost/min | Optimization |
|----------|--------|----------|--------------|
| Windows | windows-latest | $0.008 | Use build caching |
| Linux | ubuntu-latest | $0.008 | Primary for Android |
| macOS Intel | macos-13 | $0.08 | Use for iOS simulator tests |
| macOS M1 | macos-14 | $0.16 | Use only for release builds |

**Cost-saving strategies:**
1. Run Android builds on Linux (10x cheaper than macOS)
2. Use build caching aggressively (Turborepo + Rust cache)
3. Run expensive tests only on main branch
4. Use matrix builds to parallelize
5. Cancel in-progress runs on new pushes

---

## Testing Strategy

### Testing Pyramid for Cross-Platform

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Fewest, slowest
                    │  (Real Devices) │    Firebase Test Lab
                    ├─────────────────┤
                    │   E2E Tests     │
                    │  (Simulators)   │    Detox / Playwright
                    ├─────────────────┤
                    │  Integration    │
                    │     Tests       │    Vitest + Tauri mocks
                    ├─────────────────┤
                    │   Unit Tests    │  ← Most, fastest
                    │                 │    Vitest
                    └─────────────────┘
```

### Test Distribution

| Test Type | Desktop | Mobile | Shared |
|-----------|---------|--------|--------|
| Unit Tests | Vitest | Vitest | 100% shared |
| Component Tests | Testing Library | Testing Library | ~80% shared |
| Integration Tests | Vitest + Tauri | Vitest + Tauri | ~60% shared |
| E2E Tests | Playwright | Detox | ~20% shared |
| Device Tests | N/A | Firebase Test Lab | Mobile only |

### Detox Configuration for Mobile

```javascript
// apps/mobile/.detoxrc.js
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },

  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'src-tauri/gen/apple/build/Debug-iphonesimulator/Lokus.app',
      build: 'cd src-tauri && cargo tauri ios build --debug',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'src-tauri/gen/apple/build/Release-iphonesimulator/Lokus.app',
      build: 'cd src-tauri && cargo tauri ios build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd src-tauri && cargo tauri android build --debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd src-tauri && cargo tauri android build',
    },
  },

  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_6_API_31',
      },
    },
  },

  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
```

### Sample E2E Test (Shared Pattern)

```javascript
// tests/e2e/mobile/notes.e2e.js
describe('Notes', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should create a new note', async () => {
    // Tap the create button
    await element(by.id('create-note-button')).tap();

    // Type in the editor
    await element(by.id('note-editor')).typeText('My first note');

    // Save
    await element(by.id('save-button')).tap();

    // Verify the note appears in the list
    await expect(element(by.text('My first note'))).toBeVisible();
  });

  it('should open an existing note', async () => {
    // Create a note first
    await element(by.id('create-note-button')).tap();
    await element(by.id('note-editor')).typeText('Test note');
    await element(by.id('save-button')).tap();

    // Tap on the note
    await element(by.text('Test note')).tap();

    // Verify editor opens with content
    await expect(element(by.id('note-editor'))).toHaveText('Test note');
  });

  it('should handle offline mode', async () => {
    // Disconnect network
    await device.setURLBlacklist(['.*']);

    // Create note offline
    await element(by.id('create-note-button')).tap();
    await element(by.id('note-editor')).typeText('Offline note');
    await element(by.id('save-button')).tap();

    // Verify saved locally
    await expect(element(by.text('Offline note'))).toBeVisible();

    // Re-enable network
    await device.setURLBlacklist([]);
  });
});
```

---

## Contributor Experience

### Development Environment Setup

#### Quick Start (All Platforms)

```bash
# Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install dependencies
pnpm install

# Run development server (desktop)
pnpm dev:desktop

# Run development server (mobile - requires setup)
pnpm dev:mobile:android
pnpm dev:mobile:ios
```

#### Platform-Specific Setup

**macOS (Full Development)**
```bash
# Prerequisites
brew install node pnpm rust

# iOS Development
xcode-select --install
brew install ios-deploy

# Android Development
brew install --cask android-studio
# Then configure SDK via Android Studio

# Run setup script
./scripts/setup-dev-env.sh
```

**Windows (Desktop + Android)**
```powershell
# Prerequisites
winget install -e --id OpenJS.NodeJS
winget install -e --id Microsoft.VisualStudioCode
winget install -e --id Google.AndroidStudio
winget install -e --id Rustlang.Rustup

# iOS requires macOS - use GitHub Actions for iOS builds
```

**Linux (Desktop + Android)**
```bash
# Prerequisites
sudo apt-get install -y \
  nodejs npm \
  rustup \
  libwebkit2gtk-4.1-dev \
  build-essential

# Android Development
sudo snap install android-studio --classic

# Run setup script
./scripts/setup-dev-env.sh
```

### Development Workflow Scripts

```json
// package.json (root)
{
  "scripts": {
    // Development
    "dev": "turbo dev",
    "dev:desktop": "turbo dev --filter=@lokus/desktop",
    "dev:mobile:android": "turbo dev --filter=@lokus/mobile -- --android",
    "dev:mobile:ios": "turbo dev --filter=@lokus/mobile -- --ios",

    // Building
    "build": "turbo build",
    "build:desktop": "turbo build:desktop",
    "build:android": "turbo build:android",
    "build:ios": "turbo build:ios",

    // Testing
    "test": "turbo test",
    "test:unit": "turbo test --filter=@lokus/*",
    "test:e2e:desktop": "turbo test:e2e:desktop",
    "test:e2e:android": "turbo test:e2e --filter=@lokus/mobile -- --android",
    "test:e2e:ios": "turbo test:e2e --filter=@lokus/mobile -- --ios",

    // Utilities
    "lint": "turbo lint",
    "clean": "turbo clean && rm -rf node_modules",
    "setup": "./scripts/setup-dev-env.sh"
  }
}
```

### Contributor Documentation

Create `docs/MOBILE_DEVELOPMENT.md`:

```markdown
# Mobile Development Guide

## Prerequisites

### iOS Development (macOS only)
- Xcode 15+ (from Mac App Store)
- iOS Simulator (comes with Xcode)
- CocoaPods: `sudo gem install cocoapods`
- applesimutils: `brew tap wix/brew && brew install applesimutils`

### Android Development (All platforms)
- Android Studio (https://developer.android.com/studio)
- JDK 17+
- Android SDK (API 31+)
- Android Emulator with a configured AVD

### Rust Targets
```bash
# iOS targets
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios

# Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## Running the Mobile App

### Android Emulator
```bash
# Start an emulator (if not running)
emulator -avd Pixel_6_API_31

# Run the app
pnpm dev:mobile:android
```

### iOS Simulator
```bash
# List available simulators
xcrun simctl list devices

# Run the app
pnpm dev:mobile:ios
```

## Troubleshooting

### "SDK not found" errors
Ensure `ANDROID_HOME` and `ANDROID_NDK_HOME` are set:
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/25.2.9519653"
```

### iOS build fails with signing error
For development, use the debug configuration which doesn't require signing:
```bash
cargo tauri ios build --debug
```

### Emulator performance issues
- Enable KVM (Linux): `sudo apt install qemu-kvm`
- Enable HAXM (Windows): Android Studio → SDK Manager → SDK Tools → Intel HAXM
- Use x86_64 system images instead of ARM
```

### VS Code Extension for Mobile

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "tauri-apps.tauri-vscode",
    "rust-lang.rust-analyzer",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "tyriar.vscode-emulator"  // Easily launch emulators
  ]
}
```

### Dev Container for Consistent Environment

Create `.devcontainer/devcontainer.json`:

```json
{
  "name": "Lokus Development",
  "image": "mcr.microsoft.com/devcontainers/rust:1-bullseye",

  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    },
    "ghcr.io/devcontainers/features/java:1": {
      "version": "17"
    }
  },

  "postCreateCommand": "pnpm install && ./scripts/setup-dev-env.sh",

  "customizations": {
    "vscode": {
      "extensions": [
        "tauri-apps.tauri-vscode",
        "rust-lang.rust-analyzer",
        "dbaeumer.vscode-eslint"
      ]
    }
  },

  "forwardPorts": [1420],

  "remoteEnv": {
    "ANDROID_HOME": "/opt/android-sdk",
    "ANDROID_NDK_HOME": "/opt/android-sdk/ndk/25.2.9519653"
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)

- [ ] Restructure to monorepo with Turborepo
- [ ] Extract shared packages (@lokus/core, @lokus/ui)
- [ ] Set up platform abstraction layer
- [ ] Update existing CI/CD to work with monorepo

### Phase 2: Mobile Infrastructure (2-3 weeks)

- [ ] Initialize Tauri mobile project
- [ ] Configure Android build pipeline
- [ ] Configure iOS build pipeline
- [ ] Set up mobile-specific Rust crate

### Phase 3: Core Mobile Features (4-6 weeks)

- [ ] Basic note viewing on mobile
- [ ] Note editing with mobile-optimized editor
- [ ] File system access on mobile
- [ ] Local storage and sync

### Phase 4: Testing & Quality (2-3 weeks)

- [ ] Set up Detox for mobile E2E tests
- [ ] Configure Firebase Test Lab
- [ ] Write core test scenarios
- [ ] Performance benchmarking

### Phase 5: Polish & Release (2-3 weeks)

- [ ] Mobile-specific UI polish
- [ ] App Store / Play Store assets
- [ ] Beta testing with TestFlight / Internal Track
- [ ] Documentation updates

### Total Timeline: 12-18 weeks

---

## References & Research

### Official Documentation
- [Tauri 2.0 Mobile Guide](https://v2.tauri.app/develop/)
- [Tauri GitHub Actions](https://v2.tauri.app/distribute/pipelines/github/)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/)

### Best Practices
- [Monorepo Architecture Guide](https://monorepo.tools/)
- [React Native Environment Setup](https://reactnative.dev/docs/set-up-your-environment)
- [Fastlane Code Signing](https://docs.fastlane.tools/actions/match/)
- [Detox E2E Testing](https://github.com/wix/Detox)

### CI/CD Resources
- [GitHub Actions Mobile CI/CD](https://medium.com/@clarkewertonSilva/from-zero-to-ci-cd-appium-mobile-testing-with-github-actions-and-allure-reports-1fd984a9a5c8)
- [Firebase Test Lab](https://github.com/marketplace/actions/firebase-test-lab-action)
- [Detox with GitHub Actions](https://dev.to/edvinasbartkus/running-react-native-detox-tests-for-ios-and-android-on-github-actions-2ekn)

### Real-World Examples
- [Obsidian Architecture](https://forum.obsidian.md/t/what-framework-are-the-mobile-apps-using-reactnative-native/58571) - Uses Electron + Capacitor
- [React Native Universal Monorepo](https://github.com/mmazzarolo/react-native-universal-monorepo)
- [Expo Monorepo Example](https://github.com/byCedric/expo-monorepo-example)

### Company Monorepo Case Studies
- Google (Bazel), Meta (Buck), Microsoft (Windows Git monorepo)
- [Twitter Pants build system](https://en.wikipedia.org/wiki/Monorepo)
- [CircleCI Monorepo Guide](https://circleci.com/blog/monorepo-dev-practices/)

---

## Secrets & Environment Variables Required

### Existing (Desktop)
- `GITHUB_TOKEN` - GitHub Actions
- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` - macOS signing
- `APPLE_SIGNING_IDENTITY`, `APPLE_API_*` - Notarization
- `TAURI_SIGNING_PRIVATE_KEY` - Update signing
- `VITE_*` - Frontend environment

### New (Mobile)
- `ANDROID_KEYSTORE_PATH` - Android signing keystore
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password
- `IOS_PROVISIONING_PROFILE` - iOS provisioning (base64)
- `GOOGLE_PLAY_SERVICE_ACCOUNT` - Play Store upload
- `GCP_SERVICE_ACCOUNT` - Firebase Test Lab

---

*Document Version: 1.0*
*Last Updated: January 2025*
*Author: Claude Code*
