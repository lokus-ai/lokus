#!/bin/sh
# Build the Mac app for release on this computer: signed with the Developer ID certificate,
# notarized by Apple when credentials are stored, with the signed update file beside it.
# Run from the repo root.
#
#   sh deploy/release/mac.sh 2.0.0-alpha.1 https://relay.example
#
# Needs: the update signing key at ~/.lokus-release/updater.key, a "Developer ID Application"
# certificate in the keychain, and for notarization a stored profile named "lokus":
#   xcrun notarytool store-credentials lokus --apple-id YOU --team-id TEAM
# Without the profile the app is built and signed but not notarized, and says so.
#
# It publishes nothing. Upload what it prints, then run `lokus release` (docs/releasing.md).
set -e
VERSION="$1"
SERVER="$2"
[ -n "$VERSION" ] && [ -n "$SERVER" ] || { echo "usage: mac.sh VERSION RELAY_ADDRESS"; exit 2; }
case "$SERVER" in https://*) ;; *) echo "the relay address must start with https://"; exit 2 ;; esac
KEY="$HOME/.lokus-release/updater.key"
[ -f "$KEY" ] || { echo "no update signing key at $KEY"; exit 2; }
IDENTITY=$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)
[ -n "$IDENTITY" ] || { echo "no Developer ID Application certificate in the keychain"; exit 2; }

export VITE_LOKUS_UPDATES="$SERVER" VITE_LOKUS_RELAY="$SERVER"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
export APPLE_SIGNING_IDENTITY="$IDENTITY"
# An absolute place: the build runs from apps/desktop and would put a relative one there.
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$(pwd)/target/release-build}"
ARCH=$(uname -m | sed 's/arm64/aarch64/')

# Only the app is built here. Tauri's own disk-image step mounts a temporary disk and has to
# unmount it again, which fails on a Mac where something (Spotlight, a file-sync tool) grabs
# every disk that appears; the image is made below in a way that never mounts anything.
pnpm tauri build --bundles app --config apps/desktop/release.conf.json --config "{\"version\":\"$VERSION\"}"

OUT="$CARGO_TARGET_DIR/release/bundle"
APP=$(ls -d "$OUT"/macos/*.app | head -1)
[ -d "$APP" ] && [ -f "$APP.tar.gz.sig" ] || { echo "the build did not leave an app and a signed update file in $OUT"; exit 1; }
codesign --verify --deep --strict "$APP" && echo "signed: $APP"
DMG="$OUT/Lokus_${VERSION}_$ARCH.dmg"

if xcrun notarytool history --keychain-profile lokus >/dev/null 2>&1; then
  # Apple checks a copy of the app; the ticket it gives back is attached to the app itself.
  ZIP="$OUT/notarize.zip"
  ditto -c -k --keepParent "$APP" "$ZIP"
  xcrun notarytool submit "$ZIP" --keychain-profile lokus --wait
  rm -f "$ZIP"
  xcrun stapler staple "$APP"
  # The update file was packed before the ticket was attached; pack and sign it again.
  tar -czf "$APP.tar.gz" -C "$(dirname "$APP")" "$(basename "$APP")"
  pnpm -s tauri signer sign --app-version "$VERSION" "$APP.tar.gz" >/dev/null
  NOTARIZED=yes
  echo "notarized"
else
  NOTARIZED=no
  echo "NOT NOTARIZED: no stored credentials. A downloaded copy will be blocked by macOS until this is done."
fi

# The disk image people download, with its "drag Lokus into Applications" window.
sh "$(dirname "$0")/dmg.sh" "$APP" "$DMG"
codesign --sign "$IDENTITY" "$DMG"
if [ "$NOTARIZED" = yes ]; then
  xcrun notarytool submit "$DMG" --keychain-profile lokus --wait
  xcrun stapler staple "$DMG"
fi

DIST="dist-release/$VERSION"
mkdir -p "$DIST"
cp "$APP.tar.gz" "$DIST/Lokus_$ARCH.app.tar.gz"
cp "$APP.tar.gz.sig" "$DIST/Lokus_$ARCH.app.tar.gz.sig"
cp "$DMG" "$DIST/Lokus_${VERSION}_$ARCH.dmg"
echo "Ready in $DIST:"
ls -la "$DIST"
echo "Upload these, then: lokus release version=$VERSION server=$SERVER darwin-$ARCH=<address of Lokus_$ARCH.app.tar.gz>"
