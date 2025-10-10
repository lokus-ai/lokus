# Windows Code Signing Guide

Complete guide for signing Windows builds of Lokus for distribution.

## Why Code Sign?

Windows code signing is essential for:
- **Windows SmartScreen**: Prevents "Unknown Publisher" warnings
- **User Trust**: Shows verified publisher identity
- **Enterprise Deployment**: Required by many corporate environments
- **Microsoft Store**: Mandatory for Store submissions

Without code signing, users see scary warnings like:
```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

## Overview

Windows code signing requires:
1. **Code Signing Certificate** - From a trusted Certificate Authority (CA)
2. **SignTool** - Microsoft's signing utility (comes with Windows SDK)
3. **Timestamping** - Ensures signature remains valid after cert expires

## Step 1: Obtain a Code Signing Certificate

### Option A: Standard Code Signing Certificate (~$200-400/year)

**Recommended CAs:**
- **Sectigo (formerly Comodo)** - $200/year - https://sectigo.com
- **DigiCert** - $400/year - https://digicert.com
- **GlobalSign** - $300/year - https://globalsign.com

**Validation Process:**
1. Company validation (if signing as organization)
2. Identity verification (phone, email, business documents)
3. Download certificate (.pfx file) after approval (1-3 days)

### Option B: EV Code Signing Certificate (~$300-500/year)

**Extended Validation (EV) benefits:**
- ✅ **Immediate SmartScreen reputation** (no reputation build-up needed)
- ✅ **Higher trust level** (requires hardware token/HSM)
- ✅ **Kernel-mode driver signing** (if needed)
- ❌ **More expensive** and complex setup

**Process:**
1. Purchase EV certificate from CA
2. Identity verification (more thorough than standard)
3. Receive USB hardware token with certificate (cannot be exported)

### For Individual Developers

If you're an individual (not a company):
- Use your personal name on the certificate
- Some CAs (like Certum) offer affordable individual certificates (~$100/year)
- Windows will show your name as the publisher

## Step 2: Install Certificate (Standard Certificate Only)

If you have a standard .pfx certificate file:

```powershell
# Import certificate to Windows Certificate Store
certutil -user -p <password> -importPFX <path-to-cert.pfx>

# Or use the Windows Certificate Manager GUI:
# 1. Double-click .pfx file
# 2. Follow import wizard
# 3. Select "Current User" or "Local Machine"
# 4. Enter password
# 5. Store in "Personal" certificates
```

**For EV Certificates:**
- Certificate is already on the hardware token
- Just plug in the USB token when signing

## Step 3: Install Windows SDK (for SignTool)

**Download Windows SDK:**
https://developer.microsoft.com/windows/downloads/windows-sdk/

**Or install via Visual Studio:**
- Install Visual Studio Community (free)
- Select "Desktop development with C++"
- SignTool will be at: `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\signtool.exe`

**Or via Chocolatey:**
```powershell
choco install windows-sdk-10
```

**Verify installation:**
```powershell
# Add to PATH or use full path
signtool /?
```

## Step 4: Configure Tauri for Code Signing

### Option A: Using Certificate Store (Standard Certificate)

Edit `src-tauri/tauri.windows.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "signCommand": {
        "cmd": "signtool",
        "args": [
          "sign",
          "/sha1", "YOUR_CERT_THUMBPRINT_HERE",
          "/fd", "sha256",
          "/tr", "http://timestamp.digicert.com",
          "/td", "sha256",
          "/d", "Lokus - Lightning-fast note-taking",
          "/du", "https://lokusmd.com"
        ]
      },
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT_HERE"
    }
  }
}
```

**Find your certificate thumbprint:**
```powershell
# Method 1: Certificate Manager GUI
# 1. Run: certmgr.msc
# 2. Personal → Certificates
# 3. Double-click your certificate
# 4. Details tab → Thumbprint field
# 5. Copy the hex string (remove spaces)

# Method 2: PowerShell
Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Subject -like "*YourName*"}
```

### Option B: Using .pfx File Directly

Create a build script that sets environment variables:

**`scripts/build-windows-signed.bat`:**
```batch
@echo off
SET PFX_PATH=C:\certs\lokus-code-signing.pfx
SET PFX_PASSWORD=YourSecurePassword

npm run build
tauri build --config src-tauri/tauri.windows.conf.json
```

**Configure signing in tauri config:**
```json
{
  "bundle": {
    "windows": {
      "signCommand": {
        "cmd": "signtool",
        "args": [
          "sign",
          "/f", "%PFX_PATH%",
          "/p", "%PFX_PASSWORD%",
          "/fd", "sha256",
          "/tr", "http://timestamp.digicert.com",
          "/td", "sha256"
        ]
      }
    }
  }
}
```

### Option C: Using EV Certificate (Hardware Token)

```json
{
  "bundle": {
    "windows": {
      "signCommand": {
        "cmd": "signtool",
        "args": [
          "sign",
          "/n", "Your Company Name",
          "/fd", "sha256",
          "/tr", "http://timestamp.digicert.com",
          "/td", "sha256",
          "/d", "Lokus"
        ]
      }
    }
  }
}
```

## Step 5: Sign Your Build

### Automatic Signing (Tauri)

If configured in `tauri.*.conf.json`:
```bash
npm run build:windows
# Or
tauri build --config src-tauri/tauri.windows.conf.json
```

Tauri will automatically sign `.exe` and `.msi` files during build.

### Manual Signing (Recommended for Testing)

**Sign .exe file:**
```powershell
signtool sign /sha1 YOUR_THUMBPRINT_HERE `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /d "Lokus" `
  /du "https://lokusmd.com" `
  "src-tauri\target\release\lokus.exe"
```

**Sign .msi installer:**
```powershell
signtool sign /sha1 YOUR_THUMBPRINT_HERE `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /d "Lokus Installer" `
  /du "https://lokusmd.com" `
  "src-tauri\target\release\bundle\msi\Lokus_1.2.0_x64.msi"
```

**Verify signature:**
```powershell
signtool verify /pa /v "lokus.exe"
```

## Step 6: Timestamp Server URLs

**CRITICAL:** Always use timestamping! This ensures your signature remains valid even after your certificate expires.

**Recommended timestamp servers:**
- DigiCert: `http://timestamp.digicert.com`
- Sectigo: `http://timestamp.sectigo.com`
- GlobalSign: `http://timestamp.globalsign.com`

**Why timestamp?**
- Certificate expires after 1-3 years
- Without timestamp: signature becomes invalid when cert expires
- With timestamp: signature remains valid indefinitely (as long as it was signed while cert was valid)

## Step 7: Build SmartScreen Reputation

Even with code signing, new certificates face **Windows SmartScreen reputation**.

**How SmartScreen works:**
1. First downloads: "This app is not commonly downloaded" warning
2. After ~2,000 downloads from different users: Warning goes away
3. EV certificates: Skip this entirely (instant reputation)

**Tips to build reputation faster:**
1. **Don't change certificate** - Reputation is tied to cert
2. **Distribute widely** - Get users to download (2,000+ unique downloads)
3. **Keep same publisher name** - Consistent branding helps
4. **Submit to Microsoft** - Use Microsoft's submission portal (optional)

**Bypass for testing:**
Users can click "More info" → "Run anyway" to bypass SmartScreen.

## GitHub Actions Workflow

**Automated signing in CI/CD:**

```yaml
name: Build and Sign Windows

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Install dependencies
        run: npm install

      - name: Import code signing certificate
        run: |
          $pfxBytes = [System.Convert]::FromBase64String("${{ secrets.WINDOWS_CERTIFICATE_BASE64 }}")
          $pfxPath = "$env:TEMP\certificate.pfx"
          [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
          $password = ConvertTo-SecureString -String "${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}" -AsPlainText -Force
          Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation Cert:\CurrentUser\My -Password $password
        shell: powershell

      - name: Build and sign
        env:
          GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
          VITE_AUTH_BASE_URL: https://lokusmd.com
        run: npm run build:windows

      - name: Upload signed artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-signed
          path: src-tauri/target/release/bundle/msi/*.msi
```

**Prepare certificate for GitHub Secrets:**
```powershell
# Convert .pfx to base64
$bytes = [System.IO.File]::ReadAllBytes("C:\certs\certificate.pfx")
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
# Now paste into GitHub Secrets as WINDOWS_CERTIFICATE_BASE64
```

## Security Best Practices

### Protecting Your Certificate

1. **Never commit certificates to git**
   ```gitignore
   *.pfx
   *.p12
   *.pem
   **/certs/**
   ```

2. **Use strong passwords** for .pfx files
3. **Backup certificates** securely (encrypted cloud storage)
4. **Revoke immediately** if compromised
5. **Use hardware tokens** for production (EV certificates)

### GitHub Secrets Setup

Add these secrets to your GitHub repository:
- `WINDOWS_CERTIFICATE_BASE64` - Base64-encoded .pfx file
- `WINDOWS_CERTIFICATE_PASSWORD` - Certificate password
- `WINDOWS_CERT_THUMBPRINT` - Certificate thumbprint (optional)

## Troubleshooting

### "No certificates were found that met all the given criteria"

**Solution:**
```powershell
# Check if certificate is installed
certutil -user -store My

# Verify thumbprint is correct (no spaces, uppercase)
Get-ChildItem -Path Cert:\CurrentUser\My
```

### "Signing failed: SignerSign() failed"

**Possible causes:**
1. Wrong password for .pfx file
2. Certificate expired
3. Missing timestamp server
4. Antivirus blocking SignTool

**Solution:**
```powershell
# Test certificate
signtool sign /debug /sha1 YOUR_THUMBPRINT test.exe

# Check certificate expiration
certutil -user -store My YOUR_THUMBPRINT
```

### SmartScreen warning persists after signing

**This is normal!** Code signing ≠ Instant trust.

**Solutions:**
1. Build reputation (2,000+ downloads over weeks/months)
2. Upgrade to EV certificate (instant reputation)
3. Submit to Microsoft for review (optional)
4. Document for users: "Click More info → Run anyway"

### Timestamp server timeout

**Solution:** Try different servers or add retry logic:
```powershell
$servers = @(
  "http://timestamp.digicert.com",
  "http://timestamp.sectigo.com",
  "http://timestamp.globalsign.com"
)

foreach ($server in $servers) {
  signtool sign /tr $server ... lokus.exe
  if ($LASTEXITCODE -eq 0) { break }
}
```

## Cost Summary

| Certificate Type | Annual Cost | Reputation Build-up | Best For |
|-----------------|-------------|---------------------|----------|
| Standard OV/DV | $100-400 | 2-3 months | Small projects, open source |
| EV Certificate | $300-500 | Instant | Commercial, professional apps |

**Tip:** For open-source projects, consider:
- **SignPath** - Free code signing for OSS: https://signpath.io
- **DigiCert Open Source Cert** - Free for qualified projects

## Further Reading

- **Microsoft SignTool Docs**: https://docs.microsoft.com/windows/win32/seccrypto/signtool
- **Tauri Signing Guide**: https://tauri.app/v1/guides/distribution/sign-windows
- **Windows App Certification**: https://docs.microsoft.com/windows/uwp/publish/

---

**Last Updated:** 2025-01-10
**Lokus Version:** 1.3+
