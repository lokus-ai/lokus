# macOS Code Signing & Notarization Guide for Lokus

> **Status:** Ready for implementation when needed
>
> **Purpose:** Eliminate the need for users to run `xattr -cr Lokus.app` by properly signing and notarizing the app with Apple Developer certificate.

## Overview

When properly signed and notarized, users can:
- ✅ Download Lokus.dmg or .app.tar.gz
- ✅ Open directly without any terminal commands
- ✅ macOS Gatekeeper automatically verifies the signature
- ✅ Shows "Verified Developer" status

---

## Prerequisites

1. **Apple Developer Account** ($99/year) - ✅ You have this!
2. **Developer ID Application Certificate** (create in steps below)
3. **App Store Connect API Key** (for automated notarization)

---

## Step 1: Create Developer ID Application Certificate

### 1.1 Generate Certificate Signing Request (CSR)

On your Mac:
```bash
# Open Keychain Access
# Menu: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
# Fill in:
#   - User Email: your-apple-id@email.com
#   - Common Name: Your Name
#   - Request: Saved to disk
# Save as: CertificateSigningRequest.certSigningRequest
```

### 1.2 Create Certificate at Apple Developer

1. Go to: https://developer.apple.com/account/resources/certificates
2. Click **"+"** to create new certificate
3. Select **"Developer ID Application"** (for distribution outside App Store)
4. Upload your CSR file
5. Download the certificate (.cer file)
6. Double-click to install in Keychain Access

### 1.3 Export Certificate as .p12

```bash
# Open Keychain Access
# In left sidebar, select "login" keychain (important!)
# In "My Certificates" section, find "Developer ID Application: Your Name"
# Right-click → Export "Developer ID Application: Your Name"
# Save as: lokus-certificate.p12
# Set a strong password (you'll need this later)
```

### 1.4 Re-encrypt for GitHub Actions (2025 OpenSSL 3.x Fix)

GitHub Actions uses OpenSSL 3.x which rejects old RC2 encryption:

```bash
cd ~/Desktop

# Extract the certificate and key
openssl pkcs12 -in lokus-certificate.p12 -out temp.pem -nodes

# Re-encrypt with modern AES-256
openssl pkcs12 -export -in temp.pem -out lokus-certificate-modern.p12 \
  -keypbe AES-256-CBC -certpbe AES-256-CBC

# Clean up temporary file
rm temp.pem

# Test the new certificate
openssl pkcs12 -info -in lokus-certificate-modern.p12 -noout
```

### 1.5 Get Your Signing Identity

```bash
security find-identity -v -p codesigning
```

Output will show:
```
1) ABCD1234... "Developer ID Application: Your Name (TEAM123456)"
```

Copy the full text in quotes: `Developer ID Application: Your Name (TEAM123456)`

---

## Step 2: Create App Store Connect API Key

### 2.1 Generate API Key

1. Go to: https://appstoreconnect.apple.com/access/api
2. Click **"Keys"** tab
3. Click **"+"** button
4. Fill in:
   - **Name:** `Tauri Notarization Key`
   - **Access:** `Developer` (minimum required for notarization)
5. Click **"Generate"**
6. **Download the .p8 file** - ⚠️ You can only download this once!
7. Save file as: `AuthKey_XXXXXXXXXX.p8`

### 2.2 Save These Values

From the API Keys page, note:

1. **Issuer ID** (UUID format like `12345678-abcd-1234-abcd-123456789012`)
   - Found above the keys table

2. **Key ID** (10-character string like `ABC123DEFG`)
   - Shown in the table row for your key

3. **Key File Path**
   - Where you saved `AuthKey_XXXXXXXXXX.p8`

---

## Step 3: Create Entitlements File

Create a new file: `src-tauri/entitlements.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Allow outbound network connections (required for Tauri) -->
  <key>com.apple.security.network.client</key>
  <true/>

  <!-- Allow clipboard access (clipboardManager plugin) -->
  <key>com.apple.security.automation.apple-events</key>
  <true/>

  <!-- Allow file access (fs plugin) -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>

  <!-- Disable library validation for plugins -->
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>

  <!-- JIT compilation for JavaScript sandbox -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>

  <!-- Unsigned code execution for dynamic plugins -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

**Validation:**
```bash
plutil -lint src-tauri/entitlements.plist
```

---

## Step 4: Update Tauri Configuration

Edit `src-tauri/tauri.macos.conf.json`:

Find the line:
```json
"signingIdentity": null,
```

Replace with your actual identity from Step 1.5:
```json
"signingIdentity": "Developer ID Application: Your Name (TEAM123456)",
```

The file should look like:
```json
{
  "bundle": {
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.15",
      "signingIdentity": "Developer ID Application: Your Name (TEAM123456)",
      "hardenedRuntime": true,
      "entitlements": "entitlements.plist",
      "dmg": {
        "appPosition": { "x": 180, "y": 170 },
        "applicationFolderPosition": { "x": 480, "y": 170 },
        "windowSize": { "width": 660, "height": 400 }
      }
    }
  }
}
```

---

## Step 5: Setup GitHub Secrets

Go to: `https://github.com/your-username/lokus/settings/secrets/actions`

### 5.1 Certificate Secrets

**APPLE_CERTIFICATE**
```bash
# Convert .p12 to base64
base64 -i lokus-certificate-modern.p12 | pbcopy
# Paste into GitHub secret
```

**APPLE_CERTIFICATE_PASSWORD**
```
The password you used when exporting the .p12 file
```

**APPLE_SIGNING_IDENTITY**
```
Developer ID Application: Your Name (TEAM123456)
```

### 5.2 Notarization Secrets (Option 1: Apple ID - Simpler)

**APPLE_ID**
```
your-apple-id@email.com
```

**APPLE_PASSWORD**
```
# Generate app-specific password:
# 1. Go to: https://appleid.apple.com/account/manage
# 2. Sign in with your Apple ID
# 3. Security section → App-Specific Passwords
# 4. Click "+" to generate new password
# 5. Name it: "Lokus GitHub Actions"
# 6. Copy the password (format: xxxx-xxxx-xxxx-xxxx)
```

**APPLE_TEAM_ID**
```
TEAM123456
# Found in parentheses of your signing identity
```

### 5.3 Notarization Secrets (Option 2: API Key - Recommended)

**APPLE_API_ISSUER**
```
12345678-abcd-1234-abcd-123456789012
# Issuer ID from Step 2.2
```

**APPLE_API_KEY**
```
ABC123DEFG
# Key ID from Step 2.2
```

**APPLE_API_KEY_PATH_BASE64**
```bash
# Convert .p8 to base64
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
# Paste into GitHub secret
```

---

## Step 6: Update GitHub Actions Workflow

Edit `.github/workflows/release.yml`:

Find the `tauri-action` step and add these environment variables:

```yaml
- name: Build the app
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    # Existing Windows/Linux vars...
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

    # macOS Code Signing (add these)
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}

    # macOS Notarization - Choose ONE option:

    # Option 1: Apple ID (simpler)
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

    # Option 2: API Key (more secure, recommended)
    # APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
    # APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
    # APPLE_API_KEY_PATH: /tmp/AuthKey.p8
  with:
    # ... existing with parameters
```

**If using API Key method**, add this step BEFORE the build step:

```yaml
- name: Setup Apple API Key
  if: matrix.platform == 'macos-latest'
  run: |
    echo "${{ secrets.APPLE_API_KEY_PATH_BASE64 }}" | base64 --decode > /tmp/AuthKey.p8
    chmod 600 /tmp/AuthKey.p8
```

---

## Step 7: Update Release Notes

Edit `.github/workflows/release.yml` around line 124-136:

**REMOVE these lines:**
```markdown
## ⚠️ macOS Users: Remove Quarantine Attribute

Since this app is unsigned, macOS will block it by default. After downloading, run:

```bash
xattr -cr /Applications/Lokus.app
```

Or for the DMG:
```bash
xattr -cr ~/Downloads/Lokus.dmg
open ~/Downloads/Lokus.dmg
```
```

**REPLACE WITH:**
```markdown
## 🍎 macOS Installation

This release is **code signed and notarized** by Apple Developer Program.

**Installation Steps:**
1. Download `Lokus_x64.app.tar.gz` or `Lokus.dmg`
2. Open the DMG or extract the tarball
3. Drag `Lokus.app` to Applications folder
4. Open normally - macOS Gatekeeper will verify automatically ✓

**Universal Binary:** Supports both Intel and Apple Silicon Macs (M1/M2/M3).

**Security:** Verified by Apple. No quarantine removal needed.
```

---

## Step 8: Update .gitignore

Add to `.gitignore`:

```gitignore
# Apple Developer Certificates (NEVER COMMIT THESE!)
*.p12
*.p8
**/certs/**
AuthKey_*.p8

# Environment files with secrets
.env.production
.env.local
```

---

## Step 9: Local Testing (Optional but Recommended)

Before pushing to GitHub Actions, test signing locally:

### 9.1 Set Environment Variables

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM123456)"

# For notarization - Option 1: Apple ID
export APPLE_ID="your-apple-id@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="TEAM123456"

# OR Option 2: API Key
export APPLE_API_ISSUER="12345678-abcd-1234-abcd-123456789012"
export APPLE_API_KEY="ABC123DEFG"
export APPLE_API_KEY_PATH="/path/to/AuthKey_XXXXXXXXXX.p8"
```

### 9.2 Build

```bash
npm run tauri build
```

### 9.3 Verify Signing

```bash
# Check code signature
codesign -dv --verbose=4 "src-tauri/target/release/bundle/macos/Lokus.app"

# Verify hardened runtime
codesign -d --entitlements - "src-tauri/target/release/bundle/macos/Lokus.app"

# Check notarization status (wait 5-60 minutes after build)
spctl -a -v "src-tauri/target/release/bundle/macos/Lokus.app"
```

Expected output:
```
Lokus.app: accepted
source=Notarized Developer ID
```

### 9.4 Test Gatekeeper

```bash
# Simulate download (add quarantine attribute)
xattr -w com.apple.quarantine "0181;00000000;Chrome" "src-tauri/target/release/bundle/macos/Lokus.app"

# Try to open - should work without xattr -cr
open "src-tauri/target/release/bundle/macos/Lokus.app"
```

If it opens without errors, signing works! 🎉

---

## Step 10: Create Release

Once everything is set up:

1. **Commit all changes**
   ```bash
   git add .
   git commit -m "Setup macOS code signing and notarization"
   git push
   ```

2. **Create a new tag**
   ```bash
   git tag -a v1.3.4 -m "Release v1.3.4 - Properly signed for macOS"
   git push origin v1.3.4
   ```

3. **GitHub Actions will:**
   - Build the app
   - Sign with your Developer ID certificate
   - Enable hardened runtime
   - Apply entitlements
   - Submit to Apple for notarization
   - Wait for approval (5-60 minutes)
   - Staple notarization ticket to DMG
   - Upload signed artifacts to release

4. **Monitor progress:**
   - Go to: https://github.com/your-username/lokus/actions
   - Watch the workflow run
   - Check for any errors in the logs

---

## Verification Checklist

After release is published:

- [ ] Download the DMG from GitHub releases
- [ ] Open DMG without any xattr commands
- [ ] Drag app to Applications folder
- [ ] Open Lokus.app normally
- [ ] macOS should show "Verifying..." then open
- [ ] No "unidentified developer" warnings
- [ ] Right-click → Get Info → Shows "Verified by Apple"

---

## Troubleshooting

### "No identity found" Error

```bash
# List available identities
security find-identity -v -p codesigning

# If missing, re-import certificate
security import lokus-certificate-modern.p12 -k ~/Library/Keychains/login.keychain-db
```

### Notarization Fails

```bash
# Check notarization history
xcrun notarytool history --keychain-profile "AC_PASSWORD"

# Get details on failed submission
xcrun notarytool log <submission-id> --keychain-profile "AC_PASSWORD"
```

### "Developer cannot be verified" on macOS

- Wait 5-60 minutes after build for notarization to complete
- Check Apple's notarization server status: https://developer.apple.com/system-status/
- Verify APPLE_ID/APPLE_PASSWORD or API key is correct

### Certificate Expired

- Certificates last 5 years
- Go to developer.apple.com to renew
- Export new .p12 and update GitHub secrets

### GitHub Actions Fails to Import Certificate

```
Error: security: SecKeychainItemImport: The contents of this item cannot be retrieved.
```

Solution: Re-encrypt .p12 with AES-256 (Step 1.4)

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Yearly |
| Developer ID Certificate | Free | Included with membership |
| Notarization | Free | Unlimited |
| **Total** | **$99/year** | |

---

## Security Best Practices

1. ✅ **NEVER** commit `.p12`, `.p8`, or passwords to git
2. ✅ Store certificates in password manager (1Password, LastPass)
3. ✅ Use app-specific passwords, not main Apple ID password
4. ✅ Enable 2FA on Apple ID
5. ✅ Rotate API keys annually
6. ✅ Review GitHub Actions logs for exposed secrets
7. ✅ Delete old certificates from Keychain after replacing

---

## Additional Resources

- **Tauri v2 macOS Signing Guide**: https://v2.tauri.app/distribute/sign/macos/
- **Apple Code Signing Docs**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- **Notarization with API Key**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow
- **Troubleshooting Notarization**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/resolving_common_notarization_issues

---

## Files Modified Summary

When you're ready to implement:

1. **CREATE:** `src-tauri/entitlements.plist`
2. **MODIFY:** `src-tauri/tauri.macos.conf.json` (update signingIdentity)
3. **MODIFY:** `.github/workflows/release.yml` (add env vars)
4. **MODIFY:** `.gitignore` (add *.p12, *.p8)
5. **MODIFY:** Release notes in workflow (remove xattr instructions)

---

## When You're Ready

Follow these steps in order:

1. ✅ Create Developer ID certificate (Steps 1.1 - 1.5)
2. ✅ Create App Store Connect API key (Step 2)
3. ✅ Create entitlements.plist (Step 3)
4. ✅ Update tauri.macos.conf.json (Step 4)
5. ✅ Add GitHub secrets (Step 5)
6. ✅ Update GitHub Actions workflow (Step 6)
7. ✅ Update release notes (Step 7)
8. ✅ Update .gitignore (Step 8)
9. ✅ Test locally (Step 9) - Optional
10. ✅ Create release (Step 10)

**Estimated time:** 30-45 minutes (first time)

---

**Last Updated:** 2025-11-20
**Version:** 1.0
**Status:** Ready for implementation
