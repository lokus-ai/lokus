# Lokus 📝

> A modern, highly customizable markdown editor inspired by Obsidian, built with Tauri and React.

[![Tests](https://github.com/CodeWithInferno/Lokus/workflows/Tests/badge.svg)](https://github.com/CodeWithInferno/Lokus/actions)
[![Build](https://github.com/CodeWithInferno/Lokus/workflows/Build/badge.svg)](https://github.com/CodeWithInferno/Lokus/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

## ✨ Features

- **Real-time Editor Customization** - Customize fonts, colors, spacing, and themes with live preview
- **Wiki-style Linking** - Connect your notes with `[[Wiki Links]]` and bidirectional linking
- **Advanced Math Support** - LaTeX math rendering with KaTeX for inline `$E=mc^2$` and block equations
- **Rich Markdown Support** - Full markdown compatibility with extensions for tables, task lists, and more
- **Modern UI** - Clean, distraction-free interface with dark/light theme support
- **Cross-platform** - Built with Tauri for native performance on Windows, macOS, and Linux
- **Extensible** - Plugin architecture for custom functionality
- **Fast Search** - Quick file navigation and content search
- **Local-first** - Your data stays on your device

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific dependencies:
  - **Linux**: `libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio C++ Build Tools

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/CodeWithInferno/Lokus.git
   cd Lokus
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

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

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test && npm run test:e2e`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- We use ESLint and Prettier for code formatting
- Follow React hooks best practices
- Write tests for new features
- Keep commits atomic and descriptive

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

---

<div align="center">

**[Website](https://lokus.app) • [Documentation](https://docs.lokus.app) • [Community](https://discord.gg/lokus)**

Made with ❤️ by the Lokus team

</div>