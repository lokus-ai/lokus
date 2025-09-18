# 🚀 Lokus - The Future of Note-Taking

<div align="center">

![Lokus Logo](Group.svg)

**A lightning-fast, extensible markdown editor that puts you in control**

*Why settle for rigid note-taking tools when you can have infinite customization?*

[![Tests](https://github.com/lokus-ai/lokus/workflows/Tests/badge.svg)](https://github.com/lokus-ai/lokus/actions/workflows/test.yml)
[![E2E Tests](https://github.com/lokus-ai/lokus/workflows/E2E%20Tests/badge.svg)](https://github.com/lokus-ai/lokus/actions/workflows/e2e-tests.yml)
[![Multi-Platform Build](https://github.com/lokus-ai/lokus/workflows/Multi-Platform%20Build/badge.svg)](https://github.com/lokus-ai/lokus/actions/workflows/build-multi-platform.yml)
[![Release](https://github.com/lokus-ai/lokus/workflows/Release/badge.svg)](https://github.com/lokus-ai/lokus/actions/workflows/release.yml)

[![Windows Build](https://img.shields.io/badge/Windows-Build-blue?logo=windows&logoColor=white)](https://github.com/lokus-ai/lokus/actions/workflows/build-multi-platform.yml)
[![macOS Build](https://img.shields.io/badge/macOS-Build-black?logo=apple&logoColor=white)](https://github.com/lokus-ai/lokus/actions/workflows/build-multi-platform.yml)
[![Linux Build](https://img.shields.io/badge/Linux-Build-orange?logo=linux&logoColor=white)](https://github.com/lokus-ai/lokus/actions/workflows/build-multi-platform.yml)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Contributors](https://img.shields.io/github/contributors/lokus-ai/lokus)](https://github.com/lokus-ai/lokus/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/lokus-ai/lokus)](https://github.com/lokus-ai/lokus/stargazers)

[🎯 Features](#-features) • [🚀 Quick Start](#-quick-start) • [🎨 Showcase](#-showcase) • [🤝 Contributing](#-contributing) • [💬 Community](#-community)

</div>

---

## 🎯 Features

<div align="center">

| 🎨 **Infinite Customization** | 🧠 **Smart Connections** | ⚡ **Blazing Performance** |
|:---:|:---:|:---:|
| Real-time theme editor with live preview | Wiki links with intelligent autocomplete | Native performance with Tauri + Rust |
| Custom fonts, colors, and spacing | Bidirectional linking system | Instant file search & navigation |
| Dark/light themes + custom presets | Graph visualization (coming soon) | Local-first - your data stays private |

| ✍️ **Rich Writing Experience** | 🧮 **Advanced Features** | 🔧 **Developer Friendly** |
|:---:|:---:|:---:|
| Full Markdown + extensions | LaTeX math with KaTeX: `$E=mc^2$` | Plugin architecture for extensions |
| Tables, task lists, code blocks | Syntax highlighting for 100+ languages | Comprehensive test suite |
| Smart paste (HTML → Markdown) | Image support (local & web) | CI/CD with GitHub Actions |

</div>

### 🌟 What Makes Lokus Special?

- **🎨 True Customization**: Unlike other editors, you can modify *everything* - fonts, colors, spacing, themes - with instant preview
- **🧠 Intelligent Linking**: Wiki links that actually help you think, with smart suggestions and bidirectional connections
- **⚡ Native Speed**: Built with Rust and Tauri for desktop-class performance that puts web apps to shame  
- **🔒 Privacy First**: Your notes live on your device. No tracking, no cloud dependencies, no data harvesting
- **🛠️ Extensible Core**: Plugin system designed for developers who want to build the perfect writing environment

## 🚀 Quick Start

<div align="center">

### 📦 Download Ready-to-Use Builds

*Coming Soon: Pre-built installers for all platforms*

[💾 Download for macOS](https://github.com/lokus-ai/lokus/releases) • [💾 Windows](https://github.com/lokus-ai/lokus/releases) • [💾 Linux](https://github.com/lokus-ai/lokus/releases)

</div>

---

### 🖥️ Platform Compatibility

<div align="center">

| Platform | Min Version | Architecture | Status | Installation |
|----------|-------------|--------------|---------|-------------|
| **🪟 Windows** | Windows 10 (1903+) | x64, arm64 | ✅ Stable | [Download MSI](https://github.com/lokus-ai/lokus/releases) |
| **🍎 macOS** | macOS 10.15+ | Intel, Apple Silicon | ✅ Stable | [Download DMG](https://github.com/lokus-ai/lokus/releases) |
| **🐧 Linux** | Ubuntu 20.04+ | x64, arm64 | ✅ Stable | [Download AppImage](https://github.com/lokus-ai/lokus/releases) |

*Lokus runs natively on all platforms with full feature parity*

</div>

### 🛠️ Development Setup

<details>
<summary><b>🏗️ Prerequisites (Click to expand)</b></summary>

**Core Requirements:**
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rustup.rs/) (latest stable)

**Platform-Specific Dependencies:**

**🪟 Windows:**
```powershell
# Install Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools

# Install WebView2 (usually pre-installed on Windows 10/11)
winget install Microsoft.EdgeWebView2
```

**🍎 macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Optional: Install full Xcode for iOS development
# Available from Mac App Store
```

**🐧 Linux (Ubuntu/Debian):**
```bash
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    pkg-config
```

**🐧 Linux (Fedora/RHEL):**
```bash
sudo dnf install -y \
    gcc gcc-c++ make \
    gtk3-devel \
    webkit2gtk4.0-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

**🐧 Linux (Arch):**
```bash
sudo pacman -S \
    base-devel \
    webkit2gtk \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
```

</details>

### 💾 System Requirements

<div align="center">

| Component | Windows | macOS | Linux | Notes |
|-----------|---------|-------|-------|-------|
| **RAM** | 4GB minimum, 8GB recommended | 4GB minimum, 8GB recommended | 2GB minimum, 4GB recommended | |
| **Storage** | 500MB free space | 500MB free space | 300MB free space | Plus documents |
| **Display** | 1024x768 minimum | 1024x768 minimum | 1024x768 minimum | High DPI supported |
| **Network** | Optional (for sync) | Optional (for sync) | Optional (for sync) | Local-first design |

</div>

### ⚡ Quick Development Setup

**🚀 One-Command Setup:**
```bash
# Clone and run Lokus in development mode
git clone https://github.com/lokus-ai/lokus.git && cd Lokus && npm install && npm run tauri dev
```

**📋 Step-by-Step Setup:**

<details>
<summary><b>🪟 Windows Development</b></summary>

```powershell
# 1. Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd Lokus

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev:windows
# or: npm run tauri dev

# 4. Build for production (optional)
npm run build:windows
```

**Troubleshooting Windows:**
- Ensure Visual Studio Build Tools are installed
- Run PowerShell as Administrator if needed
- Use Windows Terminal for better experience

</details>

<details>
<summary><b>🍎 macOS Development</b></summary>

```bash
# 1. Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd Lokus

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev:macos
# or: npm run tauri dev

# 4. Build for production (optional)
npm run build:macos
```

**Troubleshooting macOS:**
- Install Xcode Command Line Tools: `xcode-select --install`
- Grant Terminal full disk access in System Preferences
- For Apple Silicon, ensure ARM64 Node.js: `arch -arm64 brew install node`

</details>

<details>
<summary><b>🐧 Linux Development</b></summary>

```bash
# 1. Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd Lokus

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev:linux
# or: npm run tauri dev

# 4. Build for production (optional)
npm run build:linux
```

**Troubleshooting Linux:**
- Install GTK development libraries (see prerequisites above)
- Use `export GDK_BACKEND=x11` if experiencing Wayland issues
- Ensure pkg-config can find webkit2gtk: `pkg-config --exists webkit2gtk-4.0`

</details>

### 🎉 First Launch

1. **Create your first note**: Press `Ctrl+N` or start typing
2. **Try wiki links**: Type `[[My New Note]]` and see the magic
3. **Write some math**: Try `$E = mc^2$` or `$$\int_0^∞ e^{-x} dx$$`  
4. **Customize everything**: Press `Ctrl+,` to open preferences
5. **Need help?**: Check our [📚 Wiki](https://github.com/lokus-ai/lokus/wiki) or join [💬 Discussions](https://github.com/lokus-ai/lokus/discussions)

## 📖 Documentation

### Basic Usage

1. **Creating Notes** - Start typing or use `Ctrl+N` to create a new note
2. **Wiki Links** - Use `[[Page Name]]` to link to other notes
3. **Math Equations** - Write LaTeX: `$E=mc^2$` for inline or `$$\int x dx$$` for blocks
4. **Customization** - Access Preferences with `Ctrl+,` to customize appearance and behavior

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New File | `Ctrl+N` |
| Save | `Ctrl+S` |
| Preferences | `Ctrl+,` |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Code | `Ctrl+E` |

### Configuration

Lokus stores your preferences in the application directory. You can customize:
- **Typography** - Font family, size, line height
- **Colors** - Editor background, text colors, accent colors
- **Behavior** - Auto-save, link behavior, math rendering
- **Themes** - Built-in themes or create custom ones

## 🧪 Testing

We maintain comprehensive test coverage with both unit and E2E tests.

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run E2E tests with UI
npm run test:e2e:ui
```

## 🏗️ Architecture

```
lokus/
├── src/
│   ├── editor/           # TipTap editor components and extensions
│   ├── views/            # Main application views
│   ├── core/             # Core functionality and utilities
│   └── styles/           # Global styles and themes
├── src-tauri/            # Rust backend
├── tests/
│   ├── unit/             # Unit tests
│   └── e2e/              # End-to-end tests
└── .github/              # CI/CD workflows
```

### Tech Stack

- **Frontend**: React 19, TipTap, Tailwind CSS
- **Backend**: Tauri 2.0 (Rust)
- **Desktop Runtime**: 
  - **Windows**: WebView2
  - **macOS**: WKWebView
  - **Linux**: WebKitGTK
- **Testing**: Vitest, Playwright
- **Math**: KaTeX
- **Build**: Vite, Cargo
- **CI/CD**: GitHub Actions (Multi-platform)
- **Distribution**: MSI, DMG, AppImage, DEB, RPM

## 🤝 Contributing

<div align="center">

**Join 50+ developers building the future of note-taking!**

[![Contributors](https://contrib.rocks/image?repo=lokus-ai/lokus)](https://github.com/lokus-ai/lokus/graphs/contributors)

*Every contribution matters - from bug reports to feature requests to code improvements*

</div>

### 🌟 Ways to Contribute

| 🐛 **Found a Bug?** | 💡 **Have an Idea?** | 🛠️ **Want to Code?** |
|:---:|:---:|:---:|
| [Report it](https://github.com/lokus-ai/lokus/issues/new?template=bug_report.md) | [Share it](https://github.com/lokus-ai/lokus/issues/new?template=feature_request.md) | [Build it](CONTRIBUTING.md) |
| Help us squash bugs | Suggest new features | Implement improvements |

### 🚀 Quick Contribution Guide

```bash
# 1. Fork & clone
git clone https://github.com/YourUsername/Lokus.git
cd Lokus

# 2. Create feature branch  
git checkout -b feature/amazing-feature

# 3. Make changes & test
npm install
npm test && npm run test:e2e

# 4. Commit & push
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature

# 5. Open Pull Request 🎉
```

### 🎯 Good First Issues

New to the project? Look for issues labeled [`good first issue`](https://github.com/lokus-ai/lokus/labels/good%20first%20issue) - they're designed to be beginner-friendly!

### 💖 Recognition

All contributors get:
- 🏆 Listed in our README
- 🎉 Special Discord role  
- 📫 Personalized thank you
- 🌟 GitHub achievement badges

*Read our complete [Contributing Guide](CONTRIBUTING.md) for detailed instructions*

## 🗺️ Roadmap

See our [Future Plans](future.md) for upcoming features and SaaS development plans.

### Current Focus
- [ ] Plugin system architecture
- [ ] Cloud sync capabilities
- [ ] Mobile companion app
- [ ] Advanced graph visualization
- [ ] Collaborative editing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md/) for inspiration
- [TipTap](https://tiptap.dev/) for the excellent editor framework
- [Tauri](https://tauri.app/) for the amazing desktop framework
- [KaTeX](https://katex.org/) for math rendering

## 📞 Support & Documentation

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/lokus-ai/lokus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions)
- **Discord**: [Join Community](https://discord.gg/lokus)

### Documentation
- **📱 Platform Guide**: [Platform-specific information](docs/PLATFORM_GUIDE.md)
- **🔨 Build Guide**: [Complete build instructions](docs/BUILD_GUIDE.md)  
- **🤝 Contributing**: [Development setup & guidelines](CONTRIBUTING.md)
- **📚 API Docs**: [Wiki](https://github.com/lokus-ai/lokus/wiki)
- **🧭 User Guide**: [Getting started tutorial](docs/user-guide/)

## 💬 Community

<div align="center">

**Join thousands of writers, researchers, and developers**

[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/lokus)
[![Twitter](https://img.shields.io/badge/Twitter-Follow%20Us-1da1f2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/lokusapp)

| 🎯 **GitHub Discussions** | 💬 **Discord Server** | 🐦 **Twitter** |
|:---:|:---:|:---:|
| [Ask questions & share ideas](https://github.com/lokus-ai/lokus/discussions) | [Real-time chat with the community](https://discord.gg/lokus) | [Follow for updates & tips](https://twitter.com/lokusapp) |
| Feature requests & feedback | Get help from other users | Latest news & releases |

</div>

---

<div align="center">

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lokus-ai/lokus&type=Date)](https://www.star-history.com/#lokus-ai/lokus&Date)

---

### 💝 Support the Project

**Love Lokus? Here's how you can help:**

⭐ [Star this repo](https://github.com/lokus-ai/lokus) • 🐛 [Report bugs](https://github.com/lokus-ai/lokus/issues) • 💡 [Suggest features](https://github.com/lokus-ai/lokus/discussions) • 🤝 [Contribute code](CONTRIBUTING.md) • 🗣️ [Spread the word](https://twitter.com/intent/tweet?text=Check%20out%20Lokus%20-%20a%20lightning-fast%20markdown%20editor%20with%20infinite%20customization!&url=https://github.com/lokus-ai/lokus)

---

**Made with ❤️ and countless cups of ☕ by the Lokus community**

*Building the tools that help you think better, one commit at a time.*

</div>