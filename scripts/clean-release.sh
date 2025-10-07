#!/bin/bash
# Clean all build artifacts

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧹 Cleaning build artifacts..."

# Clean dist-release
rm -rf dist-release
echo "  ✓ Removed dist-release/"

# Clean Tauri target
rm -rf src-tauri/target/release/bundle
echo "  ✓ Removed src-tauri/target/release/bundle/"

# Clean frontend dist
rm -rf dist
echo "  ✓ Removed dist/"

# Clean platform-specific dist folders
rm -rf dist-windows dist-macos dist-linux
echo "  ✓ Removed platform dist folders"

echo "✅ Clean complete!"
