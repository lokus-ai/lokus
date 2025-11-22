# Lokus Production Deployment Plan

**Timeline**: 7 days to release
**Cost**: $99 (Apple Developer - PAID)
**Target Version**: v1.3.4

---

## 🎯 Current Status

### ✅ What We Have
- [x] Apple Developer Account ($99 paid)
- [x] Excellent codebase and documentation
- [x] Professional README and marketing materials
- [x] Comprehensive CI/CD infrastructure (.github/workflows/)
- [x] MIT License
- [x] Changelog (needs date fixes)
- [x] Contributing guidelines
- [x] Code signing documentation (docs/MACOS_CODE_SIGNING.md)
- [x] Icons for all platforms
- [x] Updater plugin configured (currently disabled)

### ❌ What We Need
- [ ] Apple Developer ID Application Certificate
- [ ] App Store Connect API Key (for notarization)
- [ ] GitHub Secrets (6 for macOS)
- [ ] Legal documents (Privacy, Terms, Security, CoC)
- [ ] entitlements.plist
- [ ] Config updates (signing identity, enable updater)
- [ ] Testing and verification

---

## 📋 DAY-BY-DAY PLAN

### **DAY 1-2: Apple Developer Certificate Setup (4 hours)**

#### Step 1: Create Certificate Signing Request (CSR)
**Time**: 10 minutes

1. Open **Keychain Access** (Applications/Utilities/)
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**
3. Fill in:
   - **User Email Address**: your email
   - **Common Name**: Pratham Patel
   - **CA Email Address**: leave blank
   - **Request is**: Saved to disk
   - **Let me specify key pair information**: CHECK THIS
4. Click Continue
5. Key Pair Information:
   - **Key Size**: 2048 bits
   - **Algorithm**: RSA
6. Save as: `CertificateSigningRequest.certSigningRequest`

- [ ] CSR created and saved

#### Step 2: Create Developer ID Application Certificate
**Time**: 15 minutes

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Click **"Certificates, IDs & Profiles"**
3. Click **"Certificates"** in left sidebar
4. Click **"+" button** (top right)
5. Select **"Developer ID Application"** (under Software section)
   - ⚠️ NOT "Development" - we want "Distribution"
   - ⚠️ NOT "Mac App Store" - we want "Developer ID" for direct distribution
6. Click Continue
7. Upload your `CertificateSigningRequest.certSigningRequest`
8. Click Continue
9. Download the certificate file (e.g., `developerID_application.cer`)
10. **Double-click the .cer file** to install in Keychain Access

- [ ] Developer ID Application certificate created
- [ ] Certificate installed in Keychain

#### Step 3: Export Certificate as .p12
**Time**: 10 minutes

1. Open **Keychain Access**
2. Select **"My Certificates"** category (left sidebar)
3. Find certificate named: **"Developer ID Application: Pratham Patel"** (or your name)
4. **Right-click** → **Export "Developer ID Application: ..."**
5. Save as: `Developer_ID.p12`
6. **Set a STRONG password** and remember it!
   - Example: Generate random password in 1Password/LastPass
   - You'll need this password for GitHub secrets
7. Save in secure location (don't commit to git!)

- [ ] Certificate exported as .p12
- [ ] Password saved securely

**Note down your signing identity:**
```bash
# Run this command to find your identity:
security find-identity -v -p codesigning
```

Look for something like: `Developer ID Application: Pratham Patel (TEAM_ID)`

Your signing identity is: `________________________` (fill this in)

#### Step 4: Create App Store Connect API Key
**Time**: 15 minutes

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **Users and Access** (top menu)
3. Click **Keys** tab (or **Integrations** → **App Store Connect API**)
4. Click **"+"** to generate a new key
5. Give it a name: `Lokus Notarization Key`
6. Select **Access**: Admin (or Developer)
7. Click **Generate**
8. **IMMEDIATELY DOWNLOAD** the .p8 file (you can only do this ONCE!)
   - Save as: `AuthKey_KEYID.p8`
9. **Note down** (these appear on screen after generation):
   - **Issuer ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Key ID**: `XXXXXXXXXX`

- [ ] API Key created
- [ ] .p8 file downloaded and saved securely
- [ ] Issuer ID noted: `________________________`
- [ ] Key ID noted: `________________________`

---

### **DAY 3: GitHub Secrets Configuration (1 hour)**

#### Prepare Certificate Files for GitHub

**Convert .p12 to base64:**
```bash
cd ~/path/to/certificates/
base64 -i Developer_ID.p12 -o Developer_ID_base64.txt
```

**Convert .p8 to base64:**
```bash
base64 -i AuthKey_KEYID.p8 -o AuthKey_base64.txt
```

#### Add GitHub Secrets

1. Go to: https://github.com/lokus-ai/lokus/settings/secrets/actions
2. Click **"New repository secret"**
3. Add each of these secrets:

**Secret 1: APPLE_CERTIFICATE**
- Name: `APPLE_CERTIFICATE`
- Value: Contents of `Developer_ID_base64.txt` (the entire base64 string)

**Secret 2: APPLE_CERTIFICATE_PASSWORD**
- Name: `APPLE_CERTIFICATE_PASSWORD`
- Value: The password you set when exporting .p12

**Secret 3: APPLE_SIGNING_IDENTITY**
- Name: `APPLE_SIGNING_IDENTITY`
- Value: `Developer ID Application: Pratham Patel (TEAM_ID)`
  - Get exact value from: `security find-identity -v -p codesigning`

**Secret 4: APPLE_API_ISSUER**
- Name: `APPLE_API_ISSUER`
- Value: Issuer ID from App Store Connect (UUID format)

**Secret 5: APPLE_API_KEY**
- Name: `APPLE_API_KEY`
- Value: Key ID from App Store Connect (10 character string)

**Secret 6: APPLE_API_KEY_PATH_BASE64**
- Name: `APPLE_API_KEY_PATH_BASE64`
- Value: Contents of `AuthKey_base64.txt` (the entire base64 string)

#### Checklist:
- [ ] All 6 secrets added to GitHub
- [ ] Verified no typos in secret names
- [ ] Base64 files deleted from local machine (security)

---

### **DAY 4: Create Legal Documents (4 hours)**

#### 1. Create PRIVACY.md
**Time**: 2 hours

```markdown
# Privacy Policy for Lokus

**Last Updated**: [Current Date]

## Overview

Lokus is committed to protecting your privacy. This privacy policy explains how Lokus handles your data.

## Data Collection

**Lokus does NOT collect, store, or transmit any personal data to external servers.**

- All your notes, files, and data remain **100% local** on your device
- No telemetry or analytics
- No tracking or usage statistics
- No advertisements

## Local Storage

Lokus stores all data locally in your workspace folder:
- macOS: `~/Desktop/My Knowledge Base/` (or your chosen location)
- Files are stored as plain markdown (.md) files
- You have full control and ownership of your data

## Google OAuth Integration (Optional)

If you choose to use the Gmail integration feature:

**What data is accessed:**
- Read access to your Gmail messages
- Write access to create notes from emails

**How we handle this data:**
- OAuth tokens are stored **locally** in your system keychain (macOS Keychain)
- Tokens are **encrypted** by your operating system
- Lokus does **NOT** upload or share your Gmail data with any third parties
- You can revoke access anytime from your Google Account settings

## File System Permissions

Lokus requires file system access to:
- Read and write markdown files in your workspace
- Save attachments and images
- Create backups (if enabled)

All file operations are local to your machine.

## Updates

Lokus includes an auto-update feature that:
- Checks for new versions from GitHub releases
- Downloads updates only when available
- Does **NOT** send any usage data during update checks

## Cookies and Tracking

The Lokus desktop application does **NOT** use cookies or tracking technologies.

The Lokus website (lokusmd.com) may use:
- Essential cookies for site functionality
- Analytics cookies (with your consent) to improve the website

## Third-Party Services

Lokus integrates with:
- **Google Gmail** (optional, user-initiated, OAuth)
- **GitHub** (for updates, open-source repository)

These services have their own privacy policies.

## GDPR Compliance

For EU users:
- You have the right to access your data (it's in your workspace folder)
- You have the right to delete your data (delete the workspace folder)
- No data portability issues (all files are standard markdown)

## Changes to Privacy Policy

We may update this policy occasionally. Changes will be posted at:
https://lokusmd.com/privacy

## Contact

Privacy questions: privacy@lokusmd.com

## Open Source

Lokus is open-source (MIT License). You can verify our privacy claims by reviewing the source code:
https://github.com/lokus-ai/lokus
```

- [ ] PRIVACY.md created

#### 2. Create TERMS.md
**Time**: 1 hour

```markdown
# Terms of Service for Lokus

**Last Updated**: [Current Date]

## License

Lokus is open-source software licensed under the **MIT License**.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.

## Acceptance of Terms

By downloading, installing, or using Lokus, you agree to these Terms of Service.

## Use of Software

You may:
- Use Lokus for personal or commercial purposes
- Modify the source code
- Distribute modified versions (with attribution)

You may NOT:
- Use Lokus for illegal activities
- Distribute malware or viruses through modified versions
- Misrepresent the origin of the software

## Disclaimer of Warranties

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

## Limitation of Liability

IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Data Loss

While Lokus is designed to be reliable:
- We are **NOT** responsible for data loss
- **Always maintain backups** of important data
- Lokus stores files locally - standard file system risks apply

## Updates and Modifications

- Lokus may receive automatic updates
- We reserve the right to modify or discontinue features
- Continued use after changes constitutes acceptance

## Open Source

Lokus is open-source. You can:
- Review the source code: https://github.com/lokus-ai/lokus
- Report issues: https://github.com/lokus-ai/lokus/issues
- Contribute: https://github.com/lokus-ai/lokus/blob/main/CONTRIBUTING.md

## Governing Law

These terms are governed by the laws of [Your Jurisdiction].

## Changes to Terms

We may update these terms. Changes will be posted at:
https://lokusmd.com/terms

## Contact

Legal inquiries: legal@lokusmd.com

## Acknowledgment

By using Lokus, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
```

- [ ] TERMS.md created

#### 3. Create SECURITY.md
**Time**: 30 minutes

```markdown
# Security Policy

## Supported Versions

Currently supported versions for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | ✅ Yes             |
| < 1.3   | ❌ No              |

## Reporting a Vulnerability

**PLEASE DO NOT** open public GitHub issues for security vulnerabilities.

### How to Report

Email: **security@lokusmd.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)
- Your name/handle for acknowledgment (optional)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-3 days
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next planned release

### Disclosure Policy

- We request 90 days before public disclosure
- We will credit you in the fix release (if you wish)
- We may award recognition in our Hall of Fame

## Security Measures

Lokus implements several security measures:

### Code Signing
- **macOS**: Developer ID Application certificate
- **Verification**: Hardened runtime enabled
- **Notarization**: All macOS builds notarized by Apple

### Data Security
- **Local Storage**: All data stored locally (no cloud sync)
- **Encryption**: System keychain for OAuth tokens
- **Permissions**: Minimal required permissions

### Plugin System (Future)
- **Sandboxing**: Plugins run in restricted environment
- **Permissions**: Explicit permission grants
- **Validation**: Plugin manifest validation

### Build Security
- **CI/CD**: GitHub Actions with secret management
- **Dependencies**: Regular security audits via Dependabot
- **Updates**: Signed updates with public key verification

## Known Security Considerations

1. **OAuth Tokens**: Stored in system keychain (macOS Keychain) - as secure as your OS
2. **File Access**: Lokus requires broad file system access for workspace management
3. **Auto-Updates**: Downloads from GitHub releases (verified via signature)

## Security Best Practices for Users

1. **Keep Lokus Updated**: Enable auto-updates
2. **Secure Your Workspace**: Don't share workspace folders with untrusted users
3. **OAuth Caution**: Review Gmail permissions before connecting
4. **Backups**: Maintain backups (Lokus data is local-only)
5. **System Security**: Keep your OS and security software updated

## Vulnerability Disclosure History

No vulnerabilities disclosed to date.

## Contact

- **Security Issues**: security@lokusmd.com
- **General Support**: support@lokusmd.com
- **GitHub Issues**: https://github.com/lokus-ai/lokus/issues (non-security bugs only)

## Open Source

Lokus is open-source. You can review our security implementation:
https://github.com/lokus-ai/lokus

## Acknowledgments

We thank security researchers who help keep Lokus secure. Responsible disclosures are appreciated and will be credited.
```

- [ ] SECURITY.md created

#### 4. Create CODE_OF_CONDUCT.md
**Time**: 15 minutes

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, caste, color, religion, or sexual
identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment for our
community include:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes,
  and learning from the experience
* Focusing on what is best not just for us as individuals, but for the overall
  community

Examples of unacceptable behavior include:

* The use of sexualized language or imagery, and sexual attention or advances of
  any kind
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or email address,
  without their explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

## Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

Community leaders have the right and responsibility to remove, edit, or reject
comments, commits, code, wiki edits, issues, and other contributions that are
not aligned to this Code of Conduct, and will communicate reasons for moderation
decisions when appropriate.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is officially representing the community in public spaces.
Examples of representing our community include using an official e-mail address,
posting via an official social media account, or acting as an appointed
representative at an online or offline event.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
conduct@lokusmd.com.

All complaints will be reviewed and investigated promptly and fairly.

All community leaders are obligated to respect the privacy and security of the
reporter of any incident.

## Enforcement Guidelines

Community leaders will follow these Community Impact Guidelines in determining
the consequences for any action they deem in violation of this Code of Conduct:

### 1. Correction

**Community Impact**: Use of inappropriate language or other behavior deemed
unprofessional or unwelcome in the community.

**Consequence**: A private, written warning from community leaders, providing
clarity around the nature of the violation and an explanation of why the
behavior was inappropriate. A public apology may be requested.

### 2. Warning

**Community Impact**: A violation through a single incident or series of
actions.

**Consequence**: A warning with consequences for continued behavior. No
interaction with the people involved, including unsolicited interaction with
those enforcing the Code of Conduct, for a specified period of time. This
includes avoiding interactions in community spaces as well as external channels
like social media. Violating these terms may lead to a temporary or permanent
ban.

### 3. Temporary Ban

**Community Impact**: A serious violation of community standards, including
sustained inappropriate behavior.

**Consequence**: A temporary ban from any sort of interaction or public
communication with the community for a specified period of time. No public or
private interaction with the people involved, including unsolicited interaction
with those enforcing the Code of Conduct, is allowed during this period.
Violating these terms may lead to a permanent ban.

### 4. Permanent Ban

**Community Impact**: Demonstrating a pattern of violation of community
standards, including sustained inappropriate behavior, harassment of an
individual, or aggression toward or disparagement of classes of individuals.

**Consequence**: A permanent ban from any sort of public interaction within the
community.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage],
version 2.1, available at
[https://www.contributor-covenant.org/version/2/1/code_of_conduct.html][v2.1].

Community Impact Guidelines were inspired by
[Mozilla's code of conduct enforcement ladder][Mozilla CoC].

For answers to common questions about this code of conduct, see the FAQ at
[https://www.contributor-covenant.org/faq][FAQ]. Translations are available at
[https://www.contributor-covenant.org/translations][translations].

[homepage]: https://www.contributor-covenant.org
[v2.1]: https://www.contributor-covenant.org/version/2/1/code_of_conduct.html
[Mozilla CoC]: https://github.com/mozilla/diversity
[FAQ]: https://www.contributor-covenant.org/faq
[translations]: https://www.contributor-covenant.org/translations
```

- [ ] CODE_OF_CONDUCT.md created

---

### **DAY 5: Configuration Changes (2 hours)**

#### 1. Create entitlements.plist
**Time**: 15 minutes

Create: `src-tauri/entitlements.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Required for hardened runtime -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>

    <!-- Required for unsigned code (development) -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>

    <!-- Required for dynamic library loading -->
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>

    <!-- Required if your app loads plugins/extensions -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>

    <!-- Network access (if needed) -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- Outgoing network connections -->
    <key>com.apple.security.network.server</key>
    <false/>

    <!-- File access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- Full disk access (if needed for workspace) -->
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
</dict>
</plist>
```

- [ ] entitlements.plist created

#### 2. Update tauri.macos.conf.json
**Time**: 10 minutes

Find your signing identity:
```bash
security find-identity -v -p codesigning
```

Edit `src-tauri/tauri.macos.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Pratham Patel (YOUR_TEAM_ID)",
      "providerShortName": "YOUR_TEAM_ID",
      "entitlements": "entitlements.plist",
      "exceptionDomain": null,
      "frameworks": [],
      "minimumSystemVersion": "10.13"
    }
  }
}
```

Replace:
- `Pratham Patel` with your actual name
- `YOUR_TEAM_ID` with your actual Team ID (from signing identity)

- [ ] tauri.macos.conf.json updated with signing identity

#### 3. Enable Auto-Updater
**Time**: 10 minutes

Edit `src-tauri/tauri.conf.json`:

Find the updater section (around line 130):

```json
"updater": {
  "active": true,  // ← CHANGE FROM false TO true
  "pubkey": "dW50cnVzdGVkIGNvbW1lbnQgbWluaXNpZ24gcHVibGljIGtleTogRkIyN0YyQUY5Mjc1M0IzNApSV1NVQ25RZWlKb2w3Z0FJYTZTSDhGWi9DWDhLMlhxTWVrRm1nbXhxNWhQU2lBR0drTDNPWDU3c0Q0cmxSTkJFCg==",
  "endpoints": [
    "https://github.com/lokus-ai/lokus/releases/latest/download/latest.json"
  ]
}
```

Verify the pubkey matches your `TAURI_SIGNING_PRIVATE_KEY` GitHub secret.

- [ ] Auto-updater enabled in tauri.conf.json
- [ ] Endpoints verified
- [ ] Pubkey verified

#### 4. Update .github/workflows/release.yml
**Time**: 30 minutes

Add Apple environment variables for macOS build job.

Find the macOS build section and add:

```yaml
    - name: Build Tauri App
      uses: tauri-apps/tauri-action@v0
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

        # Apple Code Signing
        APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
        APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
        APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
        APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
        APPLE_API_KEY_PATH_BASE64: ${{ secrets.APPLE_API_KEY_PATH_BASE64 }}

        # Other
        GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
        GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
```

- [ ] release.yml updated with Apple env vars

#### 5. Fix CHANGELOG.md Dates
**Time**: 10 minutes

Check `CHANGELOG.md` for any future dates (found: 2025-09-18 should probably be 2024-09-18).

Update all dates to correct values.

- [ ] CHANGELOG.md dates fixed

#### 6. Update README.md
**Time**: 15 minutes

Remove the xattr instructions for macOS (no longer needed with proper signing):

Find and remove/update this section:
```markdown
### macOS Installation
Download the .dmg file and drag Lokus to Applications.

~~If macOS says the app is damaged, run:~~
~~`xattr -cr /Applications/Lokus.app`~~

✅ Our macOS builds are now properly signed and notarized by Apple!
```

Add note about Windows SmartScreen:
```markdown
### Windows Installation
Download the .msi installer and run it.

**Note**: Windows may show a SmartScreen warning for the first few weeks after release. This is normal for new applications and will disappear as we build reputation. The app is safe - it's open-source and signed.
```

- [ ] README.md updated (removed xattr, added Windows note)

---

### **DAY 6: Local Testing (3 hours)**

#### Test macOS Signing Locally (Optional but Recommended)

**Time**: 1 hour

1. Build locally:
```bash
cd /Users/pratham/Programming/Lokud\ Dir/Lokus-Main
npm run tauri build
```

2. Verify code signing:
```bash
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/Lokus.app
```

Look for:
- `Authority=Developer ID Application: Pratham Patel (TEAM_ID)`
- `Sealed Resources version=2`
- `Signed Time=...` (recent timestamp)

3. Test the app:
```bash
open src-tauri/target/release/bundle/macos/Lokus.app
```

- [ ] Local build succeeds
- [ ] Code signing verified
- [ ] App opens without xattr command
- [ ] No security warnings

#### Test Windows Build (Optional)

**Time**: 30 minutes

```bash
npm run build:windows
```

- [ ] Windows build succeeds
- [ ] .msi installer created
- [ ] Accept that SmartScreen warnings will appear (normal for unsigned)

#### Test Linux Build (Optional)

**Time**: 30 minutes

```bash
npm run build:linux
```

- [ ] Linux build succeeds
- [ ] AppImage created

---

### **DAY 7: Release Day (2 hours)**

#### Pre-Release Checklist

- [ ] All GitHub secrets added and verified
- [ ] All legal documents created and committed
- [ ] entitlements.plist created
- [ ] tauri.macos.conf.json updated
- [ ] tauri.conf.json updater enabled
- [ ] release.yml updated
- [ ] CHANGELOG.md fixed
- [ ] README.md updated
- [ ] Local testing passed (if done)
- [ ] Version numbers consistent (1.3.4 everywhere)
- [ ] All changes committed and pushed to main

#### Create Release

**Time**: 2 hours

1. **Create and push tag:**
```bash
cd /Users/pratham/Programming/Lokud\ Dir/Lokus-Main

# Make sure on main branch
git checkout main
git pull origin main

# Create tag
git tag -a v1.3.4 -m "Release v1.3.4 - Production ready with code signing

✅ macOS: Properly signed and notarized
✅ Auto-updates enabled
✅ Privacy policy and legal docs
✅ No more xattr commands needed
⚠️ Windows: SmartScreen warnings normal for first weeks"

# Push tag
git push origin v1.3.4
```

2. **Monitor GitHub Actions:**
   - Go to: https://github.com/lokus-ai/lokus/actions
   - Watch the release workflow
   - **macOS notarization takes 5-60 minutes** (this is normal!)
   - Wait for all builds to complete (green checkmarks)

3. **Verify release artifacts:**
   - Go to: https://github.com/lokus-ai/lokus/releases/tag/v1.3.4
   - Download macOS .dmg
   - Download Windows .msi
   - Download Linux .AppImage
   - Test macOS app (no xattr needed!)
   - Test Windows app (expect SmartScreen warning)

4. **Publish release:**
   - Click "Edit" on draft release
   - Review release notes
   - Check "Set as latest release"
   - Click "Publish release"

#### Post-Release Announcements

**Time**: 30 minutes

1. **Discord**: Announce in community channel
2. **Reddit**: Post to r/selfhosted, r/productivity, r/obsidianmd
3. **Twitter/X**: Tweet with screenshots
4. **GitHub**: Update README.md if needed
5. **Website**: Update lokusmd.com when it's back up

#### Submit to Directories

- [ ] [Product Hunt](https://www.producthunt.com/posts/new)
- [ ] [AlternativeTo](https://alternativeto.net/software/lokus/)
- [ ] [Hacker News Show HN](https://news.ycombinator.com/submit)
- [ ] [Reddit r/SideProject](https://www.reddit.com/r/SideProject/)

---

## 🧪 VERIFICATION COMMANDS

### Verify Code Signing (macOS)
```bash
codesign -dv --verbose=4 /path/to/Lokus.app
codesign --verify --deep --strict --verbose=2 /path/to/Lokus.app
spctl -a -vvv -t install /path/to/Lokus.app
```

### Verify Notarization (macOS)
```bash
spctl -a -vv /path/to/Lokus.app
# Should say: "source=Notarized Developer ID"
```

### Check Certificate
```bash
security find-identity -v -p codesigning
```

### Verify Update Signature
```bash
# After release, check that latest.json is accessible:
curl -L https://github.com/lokus-ai/lokus/releases/latest/download/latest.json
```

---

## 🚨 TROUBLESHOOTING

### Problem: "No identity found"
**Solution**: Make sure certificate is in "My Certificates" in Keychain Access

### Problem: "Developer cannot be verified"
**Solution**: Certificate not properly installed or expired

### Problem: Notarization fails
**Solutions**:
- Check App Store Connect API key is valid
- Verify APPLE_API_ISSUER and APPLE_API_KEY are correct
- Check entitlements.plist is valid XML
- Review notarization logs in CI output

### Problem: Build fails with "xcrun: error"
**Solution**: Install Xcode command line tools: `xcode-select --install`

### Problem: Windows SmartScreen warnings
**Solution**: This is NORMAL for new apps. Will resolve after:
- 2-3 months of downloads
- ~2,000+ downloads
- Building reputation
- Or buy EV certificate (expensive)

### Problem: Auto-updater not working
**Solutions**:
- Verify `active: true` in tauri.conf.json
- Check TAURI_SIGNING_PRIVATE_KEY secret exists
- Verify pubkey matches private key
- Check latest.json endpoint is accessible

---

## 💰 COST SUMMARY

| Item | Cost | Frequency | Status |
|------|------|-----------|--------|
| Apple Developer Program | $99 | Yearly | ✅ PAID |
| **Total Year 1** | **$99** | | ✅ PAID |

Future optional costs:
- Windows EV Certificate: $300-500/year (for instant SmartScreen trust)
- Custom domain SSL: $0 (Let's Encrypt) or $10-50/year
- Hosting: $0 (Vercel/Netlify free tier)

---

## 📊 POST-RELEASE MONITORING

### Week 1
- [ ] Monitor GitHub Issues for critical bugs
- [ ] Check Discord/Reddit for user feedback
- [ ] Verify download statistics
- [ ] Test auto-updater on existing installations
- [ ] Respond to user questions

### Week 2-4
- [ ] Review crash reports (if any)
- [ ] Plan v1.3.5 for critical fixes
- [ ] Start v1.4 feature planning
- [ ] Windows SmartScreen reputation building

### Month 2-3
- [ ] Windows SmartScreen should start trusting (after ~2000 downloads)
- [ ] Review analytics (if implemented)
- [ ] Community feedback incorporation
- [ ] Plan v2.0 features

---

## ✅ FINAL CHECKLIST (Before Tagging Release)

### Code & Config
- [ ] Version in package.json: 1.3.4
- [ ] Version in tauri.conf.json: 1.3.4
- [ ] CHANGELOG.md updated with v1.3.4
- [ ] entitlements.plist exists
- [ ] tauri.macos.conf.json has signing identity
- [ ] Auto-updater enabled (`active: true`)
- [ ] release.yml has all Apple env vars

### GitHub
- [ ] All 6 Apple secrets added
- [ ] TAURI_SIGNING_PRIVATE_KEY exists
- [ ] TAURI_SIGNING_PRIVATE_KEY_PASSWORD exists

### Legal & Docs
- [ ] PRIVACY.md created
- [ ] TERMS.md created
- [ ] SECURITY.md created
- [ ] CODE_OF_CONDUCT.md created
- [ ] README.md updated (no xattr, Windows note)

### Testing
- [ ] Local build tested (optional)
- [ ] Code signing verified (optional)
- [ ] CI builds passing

### Release
- [ ] All changes committed
- [ ] All changes pushed to main
- [ ] Ready to create tag

---

## 📞 SUPPORT CONTACTS

**Created emails to set up:**
- security@lokusmd.com (for security reports)
- privacy@lokusmd.com (for privacy questions)
- conduct@lokusmd.com (for code of conduct violations)
- legal@lokusmd.com (for legal inquiries)
- support@lokusmd.com (for general support)

**Or use existing:**
- GitHub Issues: https://github.com/lokus-ai/lokus/issues
- Discord: [Your Discord link]
- Email: [Your existing email]

---

## 🎉 SUCCESS CRITERIA

You'll know the release is successful when:

✅ macOS users can download and open without any xattr commands
✅ App is notarized (verify with `spctl -a -vv`)
✅ Auto-updates work for subsequent releases
✅ No critical bugs in first week
✅ Windows users understand SmartScreen warnings are temporary
✅ All platforms have downloadable installers
✅ GitHub release is published
✅ Community is excited!

---

**Last Updated**: [Current Date]
**Status**: Ready to execute
**Estimated Total Time**: 18 hours over 7 days
**Total Cost**: $99 (already paid)
