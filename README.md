# 🚀 Lokus - The Future of Note-Taking

<div align="center">

![Lokus Logo](Group.svg)

**A lightning-fast, extensible markdown editor that puts you in control**

*Why settle for rigid note-taking tools when you can have infinite customization?*

[![Tests](https://github.com/CodeWithInferno/Lokus/workflows/Tests/badge.svg)](https://github.com/CodeWithInferno/Lokus/actions)
[![Build](https://github.com/CodeWithInferno/Lokus/workflows/Build/badge.svg)](https://github.com/CodeWithInferno/Lokus/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Contributors](https://img.shields.io/github/contributors/CodeWithInferno/Lokus)](https://github.com/CodeWithInferno/Lokus/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/CodeWithInferno/Lokus)](https://github.com/CodeWithInferno/Lokus/stargazers)

[🎯 Features](#-features) • [🚀 Quick Start](#-quick-start) • [🎨 Showcase](#-showcase) • [🤝 Contributing](#-contributing) • [💬 Community](#-community)

</div>

---

## 🎨 Showcase

<div align="center">

### ✨ Math Equations That Actually Work
*LaTeX rendering so smooth, you'll forget it's not native*

![Math Demo](docs-screenshots/math-demo.png)

### 🔗 Wiki Links with Intelligence
*Connect your thoughts with autocomplete suggestions*

![Wiki Links Demo](docs-screenshots/wiki-demo.png)

### 🎨 Themes That Adapt to You
*Real-time customization with live preview*

![Theme Demo](docs-screenshots/theme-demo.png)

</div>

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

[💾 Download for macOS](https://github.com/CodeWithInferno/Lokus/releases) • [💾 Windows](https://github.com/CodeWithInferno/Lokus/releases) • [💾 Linux](https://github.com/CodeWithInferno/Lokus/releases)

</div>

---

### 🛠️ Development Setup

<details>
<summary><b>🏗️ Prerequisites (Click to expand)</b></summary>

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rustup.rs/) (latest stable)  
- Platform-specific dependencies:
  - **Linux**: `libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio C++ Build Tools

</details>

### ⚡ One-Command Setup

```bash
# Clone and run Lokus in development mode
git clone https://github.com/CodeWithInferno/Lokus.git && cd Lokus && npm install && npm run tauri dev
```

### 📋 Step by Step

```bash
# 1. Clone the repository
git clone https://github.com/CodeWithInferno/Lokus.git
cd Lokus

# 2. Install dependencies  
npm install

# 3. Run in development mode
npm run tauri dev

# 4. Build for production (optional)
npm run tauri build
```

### 🎉 First Launch

1. **Create your first note**: Press `Ctrl+N` or start typing
2. **Try wiki links**: Type `[[My New Note]]` and see the magic
3. **Write some math**: Try `$E = mc^2$` or `$$\int_0^∞ e^{-x} dx$$`  
4. **Customize everything**: Press `Ctrl+,` to open preferences
5. **Need help?**: Check our [📚 Wiki](https://github.com/CodeWithInferno/Lokus/wiki) or join [💬 Discussions](https://github.com/CodeWithInferno/Lokus/discussions)

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
- **Backend**: Tauri (Rust)
- **Testing**: Vitest, Playwright
- **Math**: KaTeX
- **Build**: Vite
- **CI/CD**: GitHub Actions

## 🤝 Contributing

<div align="center">

**Join 50+ developers building the future of note-taking!**

[![Contributors](https://contrib.rocks/image?repo=CodeWithInferno/Lokus)](https://github.com/CodeWithInferno/Lokus/graphs/contributors)

*Every contribution matters - from bug reports to feature requests to code improvements*

</div>

### 🌟 Ways to Contribute

| 🐛 **Found a Bug?** | 💡 **Have an Idea?** | 🛠️ **Want to Code?** |
|:---:|:---:|:---:|
| [Report it](https://github.com/CodeWithInferno/Lokus/issues/new?template=bug_report.md) | [Share it](https://github.com/CodeWithInferno/Lokus/issues/new?template=feature_request.md) | [Build it](CONTRIBUTING.md) |
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

New to the project? Look for issues labeled [`good first issue`](https://github.com/CodeWithInferno/Lokus/labels/good%20first%20issue) - they're designed to be beginner-friendly!

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

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/CodeWithInferno/Lokus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CodeWithInferno/Lokus/discussions)
- **Documentation**: [Wiki](https://github.com/CodeWithInferno/Lokus/wiki)

## 💬 Community

<div align="center">

**Join thousands of writers, researchers, and developers**

[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/lokus)
[![Twitter](https://img.shields.io/badge/Twitter-Follow%20Us-1da1f2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/lokusapp)

| 🎯 **GitHub Discussions** | 💬 **Discord Server** | 🐦 **Twitter** |
|:---:|:---:|:---:|
| [Ask questions & share ideas](https://github.com/CodeWithInferno/Lokus/discussions) | [Real-time chat with the community](https://discord.gg/lokus) | [Follow for updates & tips](https://twitter.com/lokusapp) |
| Feature requests & feedback | Get help from other users | Latest news & releases |

</div>

---

<div align="center">

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CodeWithInferno/Lokus&type=Date)](https://star-history.com/#CodeWithInferno/Lokus&Date)

---

### 💝 Support the Project

**Love Lokus? Here's how you can help:**

⭐ [Star this repo](https://github.com/CodeWithInferno/Lokus) • 🐛 [Report bugs](https://github.com/CodeWithInferno/Lokus/issues) • 💡 [Suggest features](https://github.com/CodeWithInferno/Lokus/discussions) • 🤝 [Contribute code](CONTRIBUTING.md) • 🗣️ [Spread the word](https://twitter.com/intent/tweet?text=Check%20out%20Lokus%20-%20a%20lightning-fast%20markdown%20editor%20with%20infinite%20customization!&url=https://github.com/CodeWithInferno/Lokus)

---

**Made with ❤️ and countless cups of ☕ by the Lokus community**

*Building the tools that help you think better, one commit at a time.*

</div>