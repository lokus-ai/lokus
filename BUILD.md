# Building Lokus Locally

Guide for building Lokus installers for all platforms on your Mac.

## Quick Start

### 1. One-Time Setup
```bash
npm run install:build:deps
```

This installs:
- Docker Desktop (for Linux builds)
- cargo-xwin (for Windows cross-compilation)
- Required Rust targets

**Note:** After Docker installs, open Docker Desktop app and wait for it to start, then run the command again.

### 2. Build Everything
```bash
npm run build:all:local
```

Builds for:
- ✅ **macOS**: Native build (works perfectly)
- ✅ **Linux**: Docker build (works perfectly)
- ⚠️ **Windows**: Use GitHub Actions (see below)

Build time: ~20-30 minutes

### 3. Get Your Installers

All installers will be in `dist-release/`:

```
dist-release/
├── macos/
│   └── Lokus_1.2.0_universal.dmg
├── windows/
│   └── (use GitHub Actions)
└── linux/
    ├── lokus_1.2.0_amd64.deb
    ├── lokus_1.2.0_x86_64.rpm
    └── lokus_1.2.0_amd64.AppImage
```

## Platform-Specific Builds

### macOS Only
```bash
npm run build:macos
```
Output: `src-tauri/target/release/bundle/dmg/`

### Linux Only
```bash
npm run build:linux:docker
```
Output: `src-tauri/target/release/bundle/deb/`, `rpm/`, `appimage/`

### Windows (GitHub Actions)

Windows builds require Windows environment. Use GitHub Actions:

1. Push your code to GitHub
2. GitHub Actions will build Windows automatically
3. Download artifacts from Actions tab

**Or** create a release:
```bash
git tag v1.2.1
git push origin v1.2.1
```

GitHub will create release with all platform installers.

## Clean Up

### Quick Cleanup

```bash
# Clean release artifacts
npm run clean:release

# Clean everything (including node_modules)
npm run clean:build
```

### Rust Build Artifacts

The Rust backend generates significant build artifacts in `src-tauri/target/` (can reach 15GB+). These files are ignored by git but consume disk space locally.

**Clean Rust artifacts:**
```bash
cd src-tauri && cargo clean
```

**Or from project root:**
```bash
cargo clean --manifest-path src-tauri/Cargo.toml
```

This removes:
- Compiled binaries
- Incremental compilation cache
- Debug symbols
- Dependencies artifacts

**Note:** Next build will be slower as Rust recompiles everything. The `target/` directory is automatically excluded from version control via `.gitignore`.

## Environment Variables

For production builds, credentials are loaded from `.env.production`:

```bash
# .env.production
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
VITE_AUTH_BASE_URL=https://lokusmd.com
```

The script automatically copies from `.env` if `.env.production` doesn't exist.

## Troubleshooting

### Docker not running
```bash
# Start Docker Desktop app
open /Applications/Docker.app
# Wait for it to start, then try again
```

### Linux build fails
```bash
# Rebuild Docker image
docker build -t lokus-linux-builder -f docker/Dockerfile.linux-builder .
# Try build again
npm run build:linux:docker
```

### macOS build fails
```bash
# Clean and retry
npm run clean
npm run build:macos
```

### Missing dependencies
```bash
# Reinstall everything
npm run install:build:deps
```

## GitHub Actions Workflow

The project has two workflows:

### 1. Build Multi-Platform (`.github/workflows/build-multi-platform.yml`)
- Runs on every push to `main` or `develop`
- Builds for Windows, macOS, Linux
- Uploads artifacts (available for 7 days)
- Use this to test before releasing

### 2. Release (`.github/workflows/release.yml`)
- Runs when you push a tag (e.g., `v1.2.1`)
- Creates GitHub Release
- Attaches all platform installers
- Use this for official releases

## Release Process

1. **Test locally:**
   ```bash
   npm run build:all:local
   ```

2. **Test installers** on other machines

3. **Update version** in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/tauri.*.conf.json`

4. **Commit changes:**
   ```bash
   git add .
   git commit -m "Release v1.2.1"
   git push
   ```

5. **Create release:**
   ```bash
   git tag v1.2.1
   git push origin v1.2.1
   ```

6. **Wait for GitHub Actions** (~30 mins)

7. **Download from Releases page** and test

8. **Publish release** when ready

## Tips

- **Parallel builds:** Can't run macOS and Linux builds simultaneously (both use heavy resources)
- **Cache:** Rust builds are cached, subsequent builds are faster
- **Disk space:** Build artifacts in `src-tauri/target/` can reach 15GB+. Run `cargo clean --manifest-path src-tauri/Cargo.toml` to free up space
- **Testing:** Test installers on real machines, not VMs if possible

## Need Help?

- Check GitHub Actions logs for build errors
- Ensure all dependencies are installed
- Verify `.env.production` has correct credentials
- Try cleaning and rebuilding

## Architecture Support

### macOS
- Universal binary (Intel + Apple Silicon)
- Minimum: macOS 10.15+

### Linux
- x86_64 (amd64)
- DEB: Ubuntu, Debian
- RPM: Fedora, RHEL, CentOS
- AppImage: Universal

### Windows
- x86_64 (64-bit)
- MSI: Traditional installer
- NSIS: Modern installer with auto-updater
- Portable: Standalone .exe (no install)

## Credits

Built with:
- [Tauri](https://tauri.app/) - Desktop framework
- [Rust](https://rust-lang.org/) - Backend
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) - Frontend
