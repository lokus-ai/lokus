# App Store Submission Setup for Lokus

## Your Apple Developer Account Info

- **Team ID**: `UH5Z2K4G9H`
- **Bundle ID**: `io.lokus.app`
- **App Store Connect API Key ID**: `FMDQ88Z88Z`
- **Issuer ID**: `3eb573cb-25ce-418f-a97b-2c92b7c18636`
- **API Key File**: `/Users/pratham/Documents/Lokus Cet/AuthKey_FMDQ88Z88Z.p8`

## Current Certificates Installed

✅ **Developer ID Application: Pratham Patel (UH5Z2K4G9H)**
- Purpose: Direct distribution (notarization)
- Used for: Downloads from website
- Certificate file: `/Users/pratham/Documents/Lokus Cet/Certificates.p12`
- Password: `Jisalbiren@1`

❌ **Missing: 3rd Party Mac Developer Application**
- Purpose: Mac App Store distribution
- **YOU NEED TO CREATE THIS!**

## What You Need To Do

### Step 1: Create Mac App Store Certificates

Go to [Apple Developer Portal → Certificates](https://developer.apple.com/account/resources/certificates/list)

#### A. Create "Mac App Distribution" Certificate

1. Click "+" to create new certificate
2. Select **"Mac App Distribution"** (under "Software")
3. Upload CSR: Use `/Users/pratham/Documents/Lokus Cet/CertificateSigningRequest.certSigningRequest`
   - If expired, create new CSR:
     - Keychain Access → Certificate Assistant → Request Certificate
     - Email: prathamking687@gmail.com
     - Common Name: Pratham Patel
     - Save to disk
4. Download the certificate (.cer file)
5. Double-click to install in Keychain

#### B. Create "Mac Installer Distribution" Certificate

1. Click "+" again
2. Select **"Mac Installer Distribution"**
3. Upload same CSR
4. Download and double-click to install

### Step 2: Create App ID (if not done)

Go to [Identifiers](https://developer.apple.com/account/resources/identifiers/list)

1. Click "+" to create identifier
2. Select "App IDs" → "App"
3. **Description**: Lokus
4. **Bundle ID**: `io.lokus.app` (Explicit)
5. **Capabilities**:
   - Network (Client)
   - File Access (User Selected)
   - Clipboard

### Step 3: Create Provisioning Profile

Go to [Profiles](https://developer.apple.com/account/resources/profiles/list)

1. Click "+"
2. Select **"Mac App Store"** (Distribution)
3. Select App ID: `io.lokus.app`
4. Select certificate: Your Mac App Distribution certificate
5. Name: "Lokus Mac App Store"
6. Download and double-click to install

### Step 4: Create App in App Store Connect

Go to [App Store Connect](https://appstoreconnect.apple.com)

1. My Apps → "+" → New App
2. **Platform**: macOS
3. **Name**: Lokus
4. **Primary Language**: English
5. **Bundle ID**: io.lokus.app
6. **SKU**: lokus-macos
7. **User Access**: Full Access

## Building for App Store

### Once Certificates Are Installed

```bash
# Verify certificates are installed
security find-identity -v -p codesigning

# Should see:
# "3rd Party Mac Developer Application: Pratham Patel (UH5Z2K4G9H)"
# "3rd Party Mac Developer Installer: Pratham Patel (UH5Z2K4G9H)"
```

### Build Command

```bash
npm run build:appstore
```

The build will be at:
```
src-tauri/target/release/bundle/macos/Lokus.app
```

### Sign Manually (if needed)

```bash
# Navigate to build directory
cd src-tauri/target/release/bundle/macos

# Sign the app
codesign --deep --force --verify --verbose \
  --sign "3rd Party Mac Developer Application: Pratham Patel (UH5Z2K4G9H)" \
  --entitlements ../../../entitlements-appstore.plist \
  Lokus.app

# Verify signature
codesign --verify --deep --strict --verbose=2 Lokus.app
```

### Create .pkg Installer

```bash
# Still in the macos directory
productbuild --component Lokus.app /Applications \
  --sign "3rd Party Mac Developer Installer: Pratham Patel (UH5Z2K4G9H)" \
  Lokus.pkg
```

## Uploading to App Store Connect

### Method 1: Transporter App (Recommended)

1. Download [Transporter](https://apps.apple.com/app/transporter/id1450874784) from Mac App Store
2. Open Transporter
3. Drag `Lokus.pkg` into Transporter
4. Click "Deliver"
5. Wait for upload and processing

### Method 2: Command Line (Using API Key)

```bash
# Upload using xcrun altool
xcrun altool --upload-app \
  --type macos \
  --file "Lokus.pkg" \
  --apiKey "FMDQ88Z88Z" \
  --apiIssuer "3eb573cb-25ce-418f-a97b-2c92b7c18636" \
  --apple-id "YOUR_APPLE_ID"
```

### Method 3: Using App Store Connect API Key File

```bash
# Set environment variables
export API_KEY_PATH="/Users/pratham/Documents/Lokus Cet/AuthKey_FMDQ88Z88Z.p8"
export API_KEY_ID="FMDQ88Z88Z"
export API_ISSUER_ID="3eb573cb-25ce-418f-a97b-2c92b7c18636"

# Upload
xcrun altool --upload-app \
  --type macos \
  --file "Lokus.pkg" \
  --apiKey "$API_KEY_ID" \
  --apiIssuer "$API_ISSUER_ID"
```

## TestFlight Setup

After upload is processed (10-30 minutes):

1. Go to [App Store Connect → Your App → TestFlight](https://appstoreconnect.apple.com)
2. Select your build
3. Add test information:
   - What to Test
   - Beta App Description
   - Feedback Email
   - Privacy Policy URL
4. Export Compliance (if using HTTPS only, select "No")
5. Add internal testers (immediate access)
6. Or submit for Beta App Review (external testers, 24-48 hours)

## Important Notes

### Sandbox Restrictions

The App Store version runs in a **sandbox** which restricts:
- ❌ Global keyboard shortcuts (requires special permission from Apple)
- ❌ File access outside user-selected files
- ❌ Some system APIs

**Test with sandbox before submitting:**

```bash
# Add quarantine attribute to test sandbox
xattr -w com.apple.quarantine "0181;00000000;TestFlight" \
  "src-tauri/target/release/bundle/macos/Lokus.app"

# Run and test
open "src-tauri/target/release/bundle/macos/Lokus.app"
```

### Auto-Updater

❌ Auto-updater is **disabled** in App Store builds (handled in `tauri.appstore.conf.json`)
- App Store apps can only update through the App Store

### Two Build Configurations

You need TWO different builds:
1. **App Store**: `npm run build:appstore` (sandbox, restricted)
2. **Direct Distribution**: `npm run build:macos` (notarized, more features)

## Quick Reference

```bash
# List certificates
security find-identity -v -p codesigning

# Build for App Store
npm run build:appstore

# Create .pkg
cd src-tauri/target/release/bundle/macos
productbuild --component Lokus.app /Applications \
  --sign "3rd Party Mac Developer Installer: Pratham Patel (UH5Z2K4G9H)" \
  Lokus.pkg

# Upload with Transporter app (easiest)
# Or use command line with API key
```

## Troubleshooting

### "No signing identity found"

You need to create the Mac App Distribution certificate in Apple Developer Portal.

### "Provisioning profile doesn't match"

Make sure you:
1. Created provisioning profile for Mac App Store (not Developer ID)
2. Downloaded and double-clicked it to install

### Build fails with entitlements error

The sandbox has restrictions. Check `src-tauri/entitlements-appstore.plist` matches your app's needs.

### Upload fails

- Make sure .pkg is signed with Mac Installer Distribution certificate
- Verify bundle ID matches: `io.lokus.app`
- Check App Store Connect API key is correct

## Files Reference

**Credentials:**
- `/Users/pratham/Documents/Lokus Cet/AuthKey_FMDQ88Z88Z.p8` - API key
- `/Users/pratham/Documents/Lokus Cet/Certificates.p12` - Developer ID cert (not for App Store!)

**Configuration:**
- `src-tauri/tauri.appstore.conf.json` - App Store build config
- `src-tauri/entitlements-appstore.plist` - Sandbox entitlements
- `src-tauri/PrivacyInfo.xcprivacy` - Privacy manifest

---

**Next Steps:**
1. ✅ API Key: Ready
2. ❌ Create Mac App Distribution certificate
3. ❌ Create Mac Installer Distribution certificate
4. ❌ Create provisioning profile
5. ❌ Create app in App Store Connect
6. ✅ Build configuration: Ready
