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










---
---
---
 ---
  Step 3: Create Provisioning Profile

  1. Go to https://developer.apple.com/account/resources/profiles/list
  2. Click "+"
  3. Select "Mac App Store" (under Distribution)
  4. Select your App ID: io.lokus.app
  5. Select certificate: "Mac App Distribution" certificate
  6. Name: Lokus Mac App Store
  7. Download and double-click to install

  ---
  Step 4: Create App in App Store Connect

  1. Go to https://appstoreconnect.apple.com
  2. Click "My Apps" → "+" → "New App"
  3. Fill in:
    - Platform: macOS
    - Name: Lokus
    - Primary Language: English (U.S.)
    - Bundle ID: Select io.lokus.app
    - SKU: lokus-macos (unique identifier for your records)
    - User Access: Full Access
  4. Click "Create"

  ---
  Step 5: Build Your App

  Run the build command:

  npm run build:appstore

  Build output location:
  src-tauri/target/universal-apple-darwin/release/bundle/macos/Lokus.app

  The build will:
  - Use sandbox-compliant entitlements
  - Sign with your Mac App Distribution certificate
  - Create a universal binary (Intel + Apple Silicon)
  - Include the privacy manifest

  ---
  Step 6: Create .pkg Installer

  Navigate to the build directory and create the installer:

  cd src-tauri/target/universal-apple-darwin/release/bundle/macos

  productbuild --component Lokus.app /Applications \
    --sign "3rd Party Mac Developer Installer: Pratham Patel (UH5Z2K4G9H)" \
    Lokus.pkg

  Verify the .pkg:
  pkgutil --check-signature Lokus.pkg

  You should see your installer certificate in the output.

  ---
  Step 7: Upload to App Store Connect

  Option 1: Transporter App (Easiest)

  1. Download https://apps.apple.com/app/transporter/id1450874784 from Mac App Store
  2. Open Transporter
  3. Sign in with your Apple ID
  4. Drag Lokus.pkg into Transporter window
  5. Click "Deliver"
  6. Wait for upload (processing takes 10-30 minutes)

  Option 2: Command Line

  xcrun altool --upload-app \
    --type macos \
    --file "Lokus.pkg" \
    --apiKey "FMDQ88Z88Z" \
    --apiIssuer "3eb573cb-25ce-418f-a97b-2c92b7c18636"

  ---
  Step 8: Configure TestFlight

  After Apple processes your upload (10-30 minutes):

  1. Go to https://appstoreconnect.apple.com → Your App → TestFlight
  2. Select your build (version 1.3.3)
  3. Fill in "What to Test" description
  4. Add Export Compliance information:
    - If only using HTTPS, select "No" for encryption
  5. Internal Testing (immediate):
    - Add internal testers
    - They'll receive TestFlight invitation immediately
  6. External Testing (24-48 hours review):
    - Submit for Beta App Review
    - Add external testers after approval

  ---
  Step 9: Prepare App Store Listing

  While TestFlight is being tested, prepare your App Store listing:

  1. Go to App Store Connect → Your App → "App Information"
  2. Fill in:
    - Subtitle (max 30 characters)
    - Privacy Policy URL
    - Category: Productivity
    - Secondary Category: Developer Tools (optional)
  3. Go to "Pricing and Availability":
    - Set price (or Free)
    - Select countries
  4. Go to "1.3.3 Prepare for Submission":
    - Screenshots (Required):
        - 1280x800px minimum
      - 2880x1800px recommended
      - Need at least 3 screenshots
    - Description (max 4000 characters)
    - Keywords (max 100 characters)
    - Support URL
    - Marketing URL (optional)

  ---
  Step 10: Submit for Review

  1. In App Store Connect, go to your app version "1.3.3"
  2. Select your build from TestFlight
  3. Fill in "App Review Information":
    - Contact information
    - Demo account (if needed)
    - Notes for reviewer
  4. Answer "Content Rights" questions
  5. Answer "Advertising Identifier" questions
  6. Click "Submit for Review"

  Review timeline: Typically 24-48 hours

  ---
  🚨 Important Notes

  Sandbox Testing Before Submission

  Test with sandbox restrictions locally:

  cd src-tauri/target/universal-apple-darwin/release/bundle/macos

  # Add quarantine attribute to simulate App Store sandbox
  xattr -w com.apple.quarantine "0181;00000000;TestFlight" Lokus.app

  # Run and test
  open Lokus.app

  Test that these work:
  - File operations (open, save, create)
  - Network requests
  - User preferences
  - All core features

  Note: Global shortcuts won't work in sandbox (Apple restriction).

  Rejection Common Causes

  - Missing or incorrect privacy manifest
  - Using private APIs
  - Incorrect entitlements
  - Crashes on launch
  - Missing functionality descriptions

  ---
  📋 Quick Reference Checklist

  - Mac Installer Distribution certificate created and installed
  - App ID created for io.lokus.app
  - Provisioning Profile created and installed
  - App created in App Store Connect
  - App built with npm run build:appstore
  - Tested with sandbox quarantine attribute
  - .pkg created and signed
  - Uploaded via Transporter or command line
  - TestFlight configured with test info
  - Internal testers added
  - App Store listing completed (screenshots, description)
  - Submitted for App Review

  ---
  Next immediate action: Create the Mac Installer Distribution certificate (Step 1) - this is the only missing piece before you
  can build and upload.