# Lokus

**A lightning-fast, extensible markdown editor built with Tauri and React**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Screenshots

<div align="center">

### Rich Markdown Editor
![Editor View](assets/screenshots/screenshot-1.png)

### Knowledge Graph Visualization
![Graph View](assets/screenshots/screenshot-2.png)

### Bases - Database View for Notes
![Bases Database](assets/screenshots/screenshot-3.png)

### Interactive Graph Navigation
![Graph View 2](assets/screenshots/screenshot-4.png)

### Advanced Markdown Editing
![Markdown Editing](assets/screenshots/screenshot-5.png)

</div>

---

## ✨ Features

- **📝 Rich Markdown Editor** - Full-featured editing with TipTap
- **🔗 Wiki Links** - Bidirectional linking with `[[Note Name]]` syntax
- **📊 Bases Database** - Notion-like database views for your notes
- **🕸️ Knowledge Graph** - Visualize connections between your notes
- **🎨 Custom Themes** - Dark/light themes with full customization
- **🧮 Math Support** - LaTeX math rendering with KaTeX
- **💻 Code Highlighting** - Syntax highlighting for 100+ languages
- **⚡ Native Performance** - Built with Rust and Tauri for speed
- **🔒 Privacy First** - All data stays local on your device

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (latest stable)

### Installation

```bash
# Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## 🛠️ Development

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

## 📖 Documentation

- **[Installation Guide](INSTALLATION.md)** - Detailed installation instructions
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to Lokus
- **[Platform Guide](docs/PLATFORM_GUIDE.md)** - Platform-specific information
- **[Build Guide](docs/BUILD_GUIDE.md)** - Complete build instructions

## 🏗️ Tech Stack

- **Frontend**: React 19, TipTap, Tailwind CSS
- **Backend**: Tauri 2.0 (Rust)
- **Testing**: Vitest, Playwright
- **Math**: KaTeX
- **Build**: Vite, Cargo

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md/) for inspiration
- [TipTap](https://tiptap.dev/) for the editor framework
- [Tauri](https://tauri.app/) for the desktop framework
- [KaTeX](https://katex.org/) for math rendering

---

<div align="center">

**Made with ❤️ by the Lokus community**

[⭐ Star this repo](https://github.com/lokus-ai/lokus) • [🐛 Report Bug](https://github.com/lokus-ai/lokus/issues) • [💡 Request Feature](https://github.com/lokus-ai/lokus/issues)

</div>
