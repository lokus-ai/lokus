#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting App Store Release Build..."

# 1. Build the app for App Store
echo "📦 Building Tauri app..."
npm run build:appstore

# Define paths
APP_PATH="src-tauri/target/release/bundle/macos/Lokus.app"
PKG_PATH="src-tauri/target/release/bundle/macos/Lokus.pkg"
SIGNED_PKG_PATH="src-tauri/target/release/bundle/macos/Lokus-Signed.pkg"
PROVISION_PROFILE="src-tauri/embedded.provisionprofile"
ENTITLEMENTS="src-tauri/entitlements-appstore.plist"

# Signing Identities
APP_IDENTITY="3rd Party Mac Developer Application: Pratham Patel (UH5Z2K4G9H)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Pratham Patel (UH5Z2K4G9H)"

# 2. Copy Provisioning Profile
echo "📄 Copying provisioning profile..."
cp "$PROVISION_PROFILE" "$APP_PATH/Contents/embedded.provisionprofile"

# 3. Remove Quarantine Attributes
echo "🧹 Removing quarantine attributes..."
xattr -d com.apple.quarantine "$APP_PATH/Contents/embedded.provisionprofile" || true

# 4. Codesign the App
echo "🔏 Codesigning application..."
codesign --force --sign "$APP_IDENTITY" --entitlements "$ENTITLEMENTS" "$APP_PATH"

# 5. Build Package
echo "📦 Building installer package..."
productbuild --component "$APP_PATH" /Applications "$PKG_PATH"

# 6. Sign Package
echo "🔏 Signing installer package..."
productsign --sign "$INSTALLER_IDENTITY" "$PKG_PATH" "$SIGNED_PKG_PATH"

echo "✅ Build Complete!"
echo "🎉 Signed Package ready at: $SIGNED_PKG_PATH"
echo ""
echo "Next steps:"
echo "1. Validate the package with Transporter or xcrun altool"
echo "2. Upload to App Store Connect"
