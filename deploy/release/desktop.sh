#!/bin/sh
# Build Lokus for release on the computer this runs on, when that is Windows (the installer)
# or Linux (the AppImage), with the signed update file beside it. Run from the repo root; on
# Windows, from Git Bash. The Mac has its own script, mac.sh.
#
#   sh deploy/release/desktop.sh 2.0.0-alpha.1 https://relay.example
#
# Needs the update signing key in TAURI_SIGNING_PRIVATE_KEY. The Windows installer carries no
# Windows certificate, so Windows asks before running it ("More info", then "Run anyway").
#
# It publishes nothing. Upload what it prints, then run `lokus release` (docs/releasing.md).
set -e
VERSION="$1"
SERVER="$2"
[ -n "$VERSION" ] && [ -n "$SERVER" ] || { echo "usage: desktop.sh VERSION RELAY_ADDRESS"; exit 2; }
case "$SERVER" in https://*) ;; *) echo "the relay address must start with https://"; exit 2 ;; esac
[ -n "$TAURI_SIGNING_PRIVATE_KEY" ] || { echo "set TAURI_SIGNING_PRIVATE_KEY to the update signing key"; exit 2; }
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
export VITE_LOKUS_UPDATES="$SERVER" VITE_LOKUS_RELAY="$SERVER"
# What Tauri names the file it builds.
case "$(uname -s)" in
  Linux) KIND=appimage; NAME="Lokus_${VERSION}_amd64.AppImage" ;;
  *) KIND=nsis; NAME="Lokus_${VERSION}_x64-setup.exe" ;;
esac

# The version goes in by a file: quotes on a command line do not survive Windows.
DIST="dist-release/$VERSION"
mkdir -p "$DIST"
printf '{"version":"%s"}' "$VERSION" > "$DIST/version.json"
pnpm tauri build --bundles "$KIND" --config apps/desktop/release.conf.json --config "$DIST/version.json"
rm "$DIST/version.json"

BUILT="${CARGO_TARGET_DIR:-target}/release/bundle/$KIND/$NAME"
[ -f "$BUILT" ] && [ -f "$BUILT.sig" ] || { echo "the build did not leave $BUILT and its signed update file"; exit 1; }
cp "$BUILT" "$DIST/$NAME"
cp "$BUILT.sig" "$DIST/$NAME.sig"
echo "Ready in $DIST:"
ls -la "$DIST"
