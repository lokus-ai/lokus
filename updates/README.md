# Lokus Update Server

This folder contains the `latest.json` file that powers the app's auto-updater.

## How It Works

1. The app checks `https://lokusmd.com/api/updates/latest.json`
2. If the version in latest.json is higher than the installed version, it prompts for update
3. User downloads and installs the new version

## Hosting Setup

The updates endpoint is hosted on the config server at:
```
https://config.lokusmd.com/api/updates/latest.json
```

Server location: `pratham@206.180.209.254:/opt/Lokus-Prod/stacks/config/updates/latest.json`

Make sure the server returns:
- `Content-Type: application/json`
- CORS headers if needed (allow all origins)

## Updating for New Releases

When you release a new version (e.g., `v1.0.0-beta.4`):

1. Build the release with `npm run tauri build`
2. Create a GitHub release and upload artifacts
3. Copy the `latest.json` from the release artifacts (Tauri generates it)
4. Update `updates/latest.json` in this repo
5. Upload to lokusmd.com

### Where to Find latest.json

After building, Tauri creates `latest.json` at:
- macOS: `src-tauri/target/release/bundle/macos/Lokus.app.tar.gz.sig` (signature file)
- The full `latest.json` is uploaded to GitHub releases

Or just copy from the GitHub release:
```bash
curl -sL "https://github.com/lokus-ai/lokus/releases/download/v1.0.0-beta.4/latest.json" > updates/latest.json
```

## Version Format

The `version` field must match what's in `tauri.conf.json` and `Cargo.toml`:
- `1.0.0-beta` → `1.0.0-beta.1` → `1.0.0-beta.2` → `1.0.0` (stable)

## Troubleshooting

### "No updates available" when there should be
- Check the version in latest.json is HIGHER than installed version
- Verify the URL is accessible: `curl https://lokusmd.com/api/updates/latest.json`
- Check CORS headers if running in dev mode

### Signature verification failed
- Make sure you're using the same signing key (`TAURI_SIGNING_PRIVATE_KEY`)
- The public key in `tauri.conf.json` must match the private key used to sign releases
