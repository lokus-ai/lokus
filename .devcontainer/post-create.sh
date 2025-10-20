#!/bin/bash

set -e

echo "🚀 Setting up Lokus development environment..."
echo ""

# Verify installations
echo "✅ Verifying installations..."
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"
echo "   Rust: $(rustc --version)"
echo "   Cargo: $(cargo --version)"
echo "   Tauri CLI: $(cargo tauri --version)"
echo ""

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install
echo ""

# Verify Tauri dependencies
echo "🔍 Checking Tauri dependencies..."
cargo tauri info || echo "⚠️  Tauri info check skipped (run manually if needed)"
echo ""

# Display welcome message
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✨ Lokus Development Environment Ready! ✨              ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Quick Start Commands:"
echo ""
echo "   npm run tauri dev       # Start development server"
echo "   npm run build           # Build the app"
echo "   npm test                # Run unit tests"
echo "   npm run test:e2e        # Run E2E tests"
echo ""
echo "📚 Documentation:"
echo "   - See CONTRIBUTING.md for contribution guidelines"
echo "   - See CLAUDE.md for development guide"
echo ""
echo "💡 Tip: The Tauri app will open in a window when you run 'npm run tauri dev'"
echo "    (Note: GUI apps in containers may require X11 forwarding)"
echo ""
echo "Happy coding! 🎉"
echo ""
