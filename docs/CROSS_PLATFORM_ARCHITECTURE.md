# Cross-Platform Architecture: Desktop + Mobile

> Lokus supports iOS and Android in addition to Windows, macOS, and Linux - all from the same codebase using Tauri 2.0.

## Platform Support

| Platform | Status | Build Workflow |
|----------|--------|----------------|
| Windows | ✅ Production | `release.yml` |
| macOS | ✅ Production | `release.yml` |
| Linux | ✅ Production | `release.yml` |
| iOS | ✅ New | `build-mobile.yml`, `release.yml` |
| Android | ✅ New | `build-mobile.yml`, `release.yml` |

---

## Architecture Overview

Lokus uses **Tauri 2.0** which natively supports all 5 platforms from a single codebase.

```
┌─────────────────────────────────────────────────────────────┐
│                        LOKUS                                │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + Vite) - SHARED                           │
│  └── src/                                                   │
├─────────────────────────────────────────────────────────────┤
│  Backend (Rust/Tauri) - SHARED                              │
│  └── src-tauri/src/                                         │
├─────────────────────────────────────────────────────────────┤
│  Platform Configs                                           │
│  ├── tauri.conf.json         → Base / Linux                 │
│  ├── tauri.windows.conf.json → Windows                      │
│  ├── tauri.macos.conf.json   → macOS                        │
│  ├── tauri.ios.conf.json     → iOS (NEW)                    │
│  └── tauri.android.conf.json → Android (NEW)                │
├─────────────────────────────────────────────────────────────┤
│  Generated Mobile Projects (gitignored)                     │
│  └── src-tauri/gen/                                         │
│      ├── android/  → Android Studio project                 │
│      └── apple/    → Xcode project                          │
└─────────────────────────────────────────────────────────────┘
```

---

## New Files Added

```
src-tauri/
├── tauri.ios.conf.json          # iOS-specific Tauri config
└── tauri.android.conf.json      # Android-specific Tauri config

.github/workflows/
├── build-mobile.yml             # CI builds for iOS/Android
└── e2e-mobile.yml               # E2E tests on emulators

tests/e2e/mobile/
├── smoke.yaml                   # Basic smoke test (Maestro)
├── launcher.yaml                # Launcher flow test
└── workspace.yaml               # Workspace operations test

docs/
└── MOBILE_DEVELOPMENT.md        # Contributor guide for mobile
```

---

## CI/CD Pipeline

### On Every Push (`build-mobile.yml`)
```
Push to main/develop
       │
       ├──► Android Build (Ubuntu - cheap)
       │    └── Debug APK artifact
       │
       └──► iOS Build (macOS-14)
            └── Debug App artifact
```

### On Tag Release (`release.yml`)
```
Tag v*
  │
  ├──► Desktop Builds (existing)
  │    ├── Windows (MSI, EXE)
  │    ├── macOS (DMG, App Store PKG)
  │    └── Linux (DEB, RPM, AppImage)
  │
  ├──► Android Release (NEW)
  │    └── Signed APK → GitHub Release
  │
  └──► iOS Release (NEW)
       ├── Signed IPA → GitHub Release
       └── Upload to TestFlight (optional)
```

### E2E Testing (`e2e-mobile.yml`)
```
Push to main
  │
  ├──► Android E2E
  │    ├── Build Debug APK
  │    ├── Start Emulator (API 31)
  │    └── Run Maestro Tests
  │
  └──► iOS E2E
       ├── Build Debug App
       ├── Boot Simulator (iPhone 15)
       └── Run Maestro Tests
```

---

## Local Development

### Initialize Mobile Targets (First Time)

```bash
# Android
cargo tauri android init

# iOS (macOS only)
cargo tauri ios init
```

### Run on Emulator/Simulator

```bash
# Android
cargo tauri android dev --config src-tauri/tauri.android.conf.json

# iOS
cargo tauri ios dev --config src-tauri/tauri.ios.conf.json
```

### Build for Release

```bash
# Android APK
cargo tauri android build --config src-tauri/tauri.android.conf.json

# iOS IPA
cargo tauri ios build --config src-tauri/tauri.ios.conf.json
```

---

## Testing Strategy

| Test Type | Tool | Platforms |
|-----------|------|-----------|
| Unit Tests | Vitest | All (runs in Node) |
| Desktop E2E | Playwright | Windows, macOS, Linux |
| Mobile E2E | Maestro | iOS, Android |

### Running Mobile E2E Tests Locally

```bash
# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Run smoke test
maestro test tests/e2e/mobile/smoke.yaml
```

---

## Required Secrets

### Existing (Desktop)
- `APPLE_CERTIFICATE` - macOS code signing
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH_BASE64`
- `TAURI_SIGNING_PRIVATE_KEY`

### New (Mobile)

**Android:**
- `ANDROID_KEYSTORE_BASE64` - Base64 encoded keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

**iOS:**
- `APPLE_IOS_CERTIFICATE` - iOS distribution certificate
- `IOS_PROVISIONING_PROFILE` - App provisioning profile

---

## Code Sharing

| Component | Shared? |
|-----------|---------|
| React UI (`src/`) | ✅ Yes |
| Rust Backend (`src-tauri/src/`) | ✅ Yes (with `#[cfg]` for platform-specific) |
| Styles (Tailwind) | ✅ Yes |
| Business Logic | ✅ Yes |
| Platform Configs | ❌ Separate per platform |
| Native Code (`gen/`) | ❌ Platform-specific |

---

## Documentation

- **[Mobile Development Guide](./MOBILE_DEVELOPMENT.md)** - Local setup for contributors
- **[Tauri Mobile Docs](https://v2.tauri.app/develop/)** - Official documentation
- **[Maestro Docs](https://maestro.mobile.dev/)** - E2E testing framework

---

## Research Notes

### Why Tauri 2.0 Mobile?

We evaluated several options:

| Framework | Code Sharing | Backend Reuse | Community | Decision |
|-----------|--------------|---------------|-----------|----------|
| **Tauri 2.0 Mobile** | ~80% | ✅ Same Rust | Growing | ✅ Selected |
| React Native | ~30% | ❌ Rewrite | Large | ❌ Too much rework |
| Capacitor | ~60% | ❌ No Rust | Medium | ❌ Limited capabilities |
| Flutter | ~10% | ❌ Dart only | Large | ❌ Complete rewrite |

### Key Benefits

1. **Same codebase** - React frontend + Rust backend work on all 5 platforms
2. **Tauri 2.0 is stable** - Mobile support released October 2024
3. **Minimal changes** - No monorepo restructuring needed
4. **Cost efficient** - Android builds on Ubuntu (10x cheaper than macOS)

### References

- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/)
- [Tauri GitHub Actions](https://v2.tauri.app/distribute/pipelines/github/)
- [Maestro E2E Testing](https://maestro.mobile.dev/)

---

*Last Updated: January 2025*
