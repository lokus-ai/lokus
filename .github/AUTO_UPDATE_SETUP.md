# Auto-Update System Setup Guide

This guide explains how to configure Lokus's auto-update system using Tauri's updater plugin.

## Overview

Lokus uses Tauri's secure updater with cryptographic signature verification. Updates are:
- Downloaded in the background
- Verified using public/private key cryptography
- Installed when the user restarts the app
- Safe - your data and settings are never affected

## Prerequisites

- Tauri CLI installed: `npm install -g @tauri-apps/cli`
- GitHub repository with releases enabled
- GitHub Actions permissions to create releases

## Step 1: Generate Signing Keys

Generate a public/private key pair for signing updates:

```bash
tauri signer generate -w ~/.tauri/lokus.key
```

This creates a key file at `~/.tauri/lokus.key` with both keys. The output looks like:

```
Generating key pair...
Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFCQ0RFRjEyMzQ1Njc4OTAK...
Private key: base64-encoded-private-key...

Keys saved to: ~/.tauri/lokus.key
```

**IMPORTANT:** Keep the private key secret! Never commit it to version control.

## Step 2: Add Public Key to Tauri Config

1. Copy the public key from the output above
2. Open `src-tauri/tauri.conf.json`
3. Replace `"PLACEHOLDER_FOR_NOW"` on line 75 with your public key:

```json
"updater": {
  "active": true,
  "dialog": false,
  "endpoints": [
    "https://github.com/lokus-ai/lokus/releases/latest/download/latest.json"
  ],
  "pubkey": "YOUR_PUBLIC_KEY_HERE",
  "windows": {
    "installMode": "passive"
  }
}
```

## Step 3: Add Private Key to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `TAURI_SIGNING_PRIVATE_KEY`
5. Value: Paste your private key (the base64-encoded string)
6. Click **Add secret**

## Step 4: Configure GitHub Actions

The release workflow (`.github/workflows/release.yml`) needs to:

1. **Build signed binaries** for all platforms (macOS, Windows, Linux)
2. **Generate update manifest** (`latest.json`) with version info and signatures
3. **Upload artifacts** to the GitHub release

Key workflow sections:

```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "" # Add password if you set one

jobs:
  release:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]

    steps:
      - name: Build Tauri App
        run: npm run tauri build

      - name: Upload Release Assets
        uses: softprops/action-gh-release@v1
        with:
          files: |
            src-tauri/target/release/bundle/**/*.dmg
            src-tauri/target/release/bundle/**/*.app.tar.gz
            src-tauri/target/release/bundle/**/*.msi
            src-tauri/target/release/bundle/**/*.AppImage
            src-tauri/target/release/bundle/**/*.sig
            latest.json
```

## Step 5: Testing

### Manual Testing

1. Create a test release with version > current version
2. Run the app
3. Check the Updates preferences page
4. Click "Check Now"
5. Verify the update notification appears

### Automated Testing

```bash
# Build the app
npm run tauri build

# Check the signature file is created
ls src-tauri/target/release/bundle/**/*.sig

# Verify the manifest is generated
cat latest.json
```

## Update Flow

### For Users:
1. App checks for updates (on startup or every 6 hours)
2. If available, shows notification with release notes
3. User clicks "Update Now" → downloads in background
4. When ready, user clicks "Restart Now" → app restarts with new version

### For Developers:
1. Merge PR to main branch
2. Create GitHub release with new version tag (e.g., `v1.4.0`)
3. GitHub Actions builds signed binaries automatically
4. Uploads binaries + `latest.json` to release
5. Users receive update notification automatically

## Configuration Options

### Update Check Frequency

Users can configure in **Preferences → Updates**:
- **On Startup** (default)
- **Every 6 Hours**
- **Daily**

### Backend Config

Located in `src-tauri/tauri.conf.json`:

```json
"updater": {
  "active": true,           // Enable/disable updater
  "dialog": false,          // Use custom UI (true = native dialog)
  "endpoints": [...],       // Where to check for updates
  "pubkey": "...",         // Public key for verification
  "windows": {
    "installMode": "passive"  // Silent install on Windows
  }
}
```

### Frontend Config

Located in `src/core/config/store.js`:

```json
"updates": {
  "autoCheck": true,              // Auto-check enabled
  "checkFrequency": "startup"     // When to check
}
```

## Troubleshooting

### "Update verification failed"
- Ensure public key in `tauri.conf.json` matches the private key used to sign
- Check that `TAURI_SIGNING_PRIVATE_KEY` secret is set correctly

### "No updates available" when update exists
- Verify `latest.json` is uploaded to release
- Check endpoint URL in `tauri.conf.json` matches release location
- Ensure new version > current version (semantic versioning)

### Update downloads but won't install
- Check file permissions on downloaded update
- On Windows: ensure installMode is "passive" or "quiet"
- On macOS: verify app is not in quarantine

## Security Notes

1. **Private key storage**: Store only in GitHub Secrets, never in code
2. **Signature verification**: Always enabled - cannot be bypassed
3. **HTTPS only**: Update endpoints must use HTTPS
4. **Code signing**: Consider adding platform-specific code signing:
   - macOS: Apple Developer certificate
   - Windows: Authenticode certificate

## References

- [Tauri Updater Plugin Docs](https://v2.tauri.app/plugin/updater/)
- [Tauri Signer CLI](https://v2.tauri.app/reference/cli/#signer)
- [GitHub Actions for Tauri](https://v2.tauri.app/distribute/github/)

---

**Last Updated:** 2025-10-28
**Lokus Version:** 1.3.3+
