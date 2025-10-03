<div align="center">

![Lokus Logo](assets/lokus-logo.svg)

# Lokus

**A lightning-fast, privacy-first knowledge management system built with Tauri and React**

*Why settle for 10+ plugins when you can have everything built-in?*

[![GitHub Stars](https://img.shields.io/github/stars/lokus-ai/lokus?style=for-the-badge&logo=github&color=yellow)](https://github.com/lokus-ai/lokus/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/lokus-ai/lokus?style=for-the-badge&logo=github&color=blue)](https://github.com/lokus-ai/lokus/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/lokus-ai/lokus?style=for-the-badge&logo=github&color=red)](https://github.com/lokus-ai/lokus/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[![Downloads](https://img.shields.io/github/downloads/lokus-ai/lokus/total?style=flat-square&logo=github&color=brightgreen)](https://github.com/lokus-ai/lokus/releases)
[![Latest Release](https://img.shields.io/github/v/release/lokus-ai/lokus?style=flat-square&logo=github)](https://github.com/lokus-ai/lokus/releases/latest)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289DA?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/lokus)

[🚀 Quick Start](#-quick-start) • [✨ Features](#-features) • [📸 Screenshots](#-screenshots) • [🗺️ Roadmap](#️-roadmap) • [🤝 Contributing](#-contributing)

</div>

---

## 🎯 Why Lokus?

Built by an Obsidian user who got tired of plugin dependencies. Lokus gives you **everything you need out of the box**:

| Obsidian | Lokus |
|----------|-------|
| ❌ Requires Dataview plugin | ✅ Built-in database views |
| ❌ Basic graph view | ✅ 2D/3D interactive graphs |
| ❌ Canvas via plugin | ✅ Infinite canvas built-in |
| ❌ $10/month for sync | ✅ Free sync via your cloud |
| ⚡ ~100MB download | ⚡ ~10MB download |
| 🐌 Electron-based | 🚀 Rust-powered (Tauri) |

---

## 📸 Screenshots

<div align="center">

### 📝 Rich Markdown Editor with Real-time Preview
![Editor View](assets/screenshots/screenshot-1.png)

### 🕸️ 3D Knowledge Graph Visualization
![Graph View](assets/screenshots/screenshot-2.png)

### 📊 Bases - Notion-like Database Views
![Bases Database](assets/screenshots/screenshot-3.png)

### 🎨 Interactive Graph Navigation
![Graph View 2](assets/screenshots/screenshot-4.png)

### ✍️ Advanced Markdown Editing
![Markdown Editing](assets/screenshots/screenshot-5.png)

</div>

---

## ✨ Features

### 📝 **Core Writing**
- **Rich Markdown Editor** - Full GitHub Flavored Markdown support
- **Wiki Links** - Bidirectional linking with `[[Note Name]]` syntax
- **LaTeX Math** - Inline `$x^2$` and block `$$E=mc^2$$` equations
- **Code Blocks** - Syntax highlighting for 100+ languages
- **Tables** - Sortable, resizable tables with CSV export
- **Task Lists** - `- [ ]` checkbox support with progress tracking

### 📊 **Database Views (Bases)**
- **Notion-like Tables** - Sort, filter, and group your notes
- **Multiple Views** - Table, Gallery, Calendar (coming soon)
- **Custom Properties** - Add metadata without frontmatter
- **Smart Filters** - Query notes by tags, dates, properties
- **Auto-create** - Default "All Notes" base on first use

### 🕸️ **Knowledge Graph**
- **2D & 3D Graphs** - Toggle between flat and spatial views
- **Interactive Navigation** - Click nodes to open notes
- **Link Strength** - Visual weight based on connections
- **Filter by Tags** - Focus on specific topics
- **Export** - Save graph as PNG/SVG

### 🎨 **Customization**
- **Theme Editor** - Real-time theme customization
- **Dark/Light Mode** - With custom color schemes
- **Font Control** - Choose your preferred fonts
- **Layout Options** - Sidebar positions, panel sizes

### 📧 **Gmail Integration**
- **Import Emails** - Save emails as markdown notes
- **Send from Notes** - Compose emails in markdown
- **Attachment Support** - Keep email attachments
- **Thread Tracking** - Maintain email context

### 🚀 **Performance**
- **Rust Backend** - Native performance with Tauri
- **Instant Search** - Fast full-text search
- **Small Footprint** - ~10MB vs Obsidian's ~100MB
- **Quick Launch** - Sub-second startup time
- **Local-First** - All data stays on your device

### 🔌 **Extensibility**
- **Plugin System** - VS Code-like extension API
- **Hot Reload** - Develop plugins without restart
- **Custom Commands** - Add keyboard shortcuts
- **Editor Extensions** - Create custom markdown syntax

---

## 🚀 Quick Start

### 📦 Download Pre-built Binaries

**macOS** (Apple Silicon & Intel)
```bash
# Download latest .dmg from releases
# Or install via Homebrew (coming soon)
```

**Windows**
```bash
# Download installer from releases
# Portable version available
```

**Linux**
```bash
# AppImage (universal)
wget https://github.com/lokus-ai/lokus/releases/latest/download/lokus.AppImage
chmod +x lokus.AppImage
./lokus.AppImage

# Flatpak (coming soon)
```

### 🛠️ Build from Source

**Prerequisites**
- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (latest stable)

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

---

## 🗺️ Roadmap

### ✅ **v1.0 - Current** (Released)
- [x] Rich markdown editor
- [x] Wiki links & backlinks
- [x] 2D/3D knowledge graph
- [x] Database views (Bases)
- [x] Theme customization
- [x] Gmail integration
- [x] Plugin system

### 🚧 **v1.1 - Next** (In Progress)
- [ ] Mobile apps (iOS & Android)
- [ ] Calendar view for Bases
- [ ] Kanban board improvements
- [ ] PDF annotations
- [ ] Vim mode
- [ ] Frontmatter support for Bases

### 🔮 **v1.2 - Future**
- [ ] End-to-end encryption
- [ ] Web clipper extension
- [ ] Collaboration features
- [ ] AI-powered search
- [ ] Template marketplace
- [ ] Multi-vault support

### 💡 **Community Requests**
- [ ] Portable Windows version
- [ ] Flatpak distribution
- [ ] Obsidian plugin compatibility layer
- [ ] Export to PDF/DOCX

[📋 View Full Roadmap & Vote on Features](https://github.com/lokus-ai/lokus/discussions/categories/roadmap)

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TipTap Editor, Tailwind CSS |
| **Backend** | Tauri 2.0 (Rust), Tokio (async runtime) |
| **Database** | JSON-based (local files) |
| **Graph** | react-force-graph, Three.js |
| **Math** | KaTeX |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **Build** | Vite, Cargo |

---

## 📖 Documentation

- 📚 [**User Guide**](https://docs.lokus.ai) - Learn how to use Lokus
- 🔧 [**Installation Guide**](INSTALLATION.md) - Platform-specific setup
- 💻 [**Developer Guide**](CONTRIBUTING.md) - Build and contribute
- 🔌 [**Plugin API**](docs/PLUGIN_API.md) - Create extensions
- 🎨 [**Theme Guide**](docs/THEMES.md) - Customize appearance

---

## 🤝 Contributing

We love contributions! Whether it's:

- 🐛 **Bug reports** - Help us squash bugs
- 💡 **Feature requests** - Share your ideas
- 📝 **Documentation** - Improve our docs
- 🔧 **Code** - Submit a PR
- 🎨 **Themes** - Design new themes
- 🔌 **Plugins** - Build extensions

**Quick start for contributors:**

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See our [Contributing Guide](CONTRIBUTING.md) for detailed instructions.

---

## 📊 Project Stats

<div align="center">

### 🌟 Real-time GitHub Stats

<a href="https://github.com/lokus-ai/lokus/stargazers">
  <img src="https://img.shields.io/github/stars/lokus-ai/lokus?style=for-the-badge&logo=github&label=Stars&color=yellow" alt="GitHub stars">
</a>
<a href="https://github.com/lokus-ai/lokus/network/members">
  <img src="https://img.shields.io/github/forks/lokus-ai/lokus?style=for-the-badge&logo=github&label=Forks&color=blue" alt="GitHub forks">
</a>
<a href="https://github.com/lokus-ai/lokus/watchers">
  <img src="https://img.shields.io/github/watchers/lokus-ai/lokus?style=for-the-badge&logo=github&label=Watchers&color=green" alt="GitHub watchers">
</a>

<br/>

<a href="https://github.com/lokus-ai/lokus/releases">
  <img src="https://img.shields.io/github/downloads/lokus-ai/lokus/total?style=for-the-badge&logo=github&label=Downloads&color=brightgreen" alt="Total downloads">
</a>
<a href="https://github.com/lokus-ai/lokus/graphs/contributors">
  <img src="https://img.shields.io/github/contributors/lokus-ai/lokus?style=for-the-badge&logo=github&label=Contributors&color=orange" alt="Contributors">
</a>
<a href="https://github.com/lokus-ai/lokus/graphs/commit-activity">
  <img src="https://img.shields.io/github/commit-activity/m/lokus-ai/lokus?style=for-the-badge&logo=github&label=Commits&color=purple" alt="Commit activity">
</a>

<br/>

### 📈 Growth Tracker

[![Star History Chart](https://api.star-history.com/svg?repos=lokus-ai/lokus&type=Timeline)](https://star-history.com/#lokus-ai/lokus&Timeline)

*All stats update automatically in real-time • Last cache: ~5 minutes*

</div>

---

## ❓ FAQ

**Q: Is Lokus compatible with Obsidian vaults?**
A: Yes! Lokus uses standard markdown files. You can open existing Obsidian vaults.

**Q: Will my Obsidian plugins work?**
A: Not directly, but we're building a compatibility layer. Core features (Dataview, Canvas, Graph) are built-in.

**Q: Is sync really free?**
A: Yes! Use any cloud storage (Dropbox, Google Drive, iCloud, Syncthing). No lock-in.

**Q: Why not just use Obsidian?**
A: If Obsidian works for you, great! Lokus is for those who want built-in features without plugin dependencies.

**Q: How do I migrate from Obsidian?**
A: Just point Lokus at your existing vault folder. All notes work immediately.

**Q: Mobile apps?**
A: Coming in v1.1! iOS and Android in development.

---

## 📄 License

Licensed under the [MIT License](LICENSE). Free to use, modify, and distribute.

---

## 🙏 Acknowledgments

Built with inspiration from:
- [Obsidian](https://obsidian.md/) - For pioneering local-first knowledge management
- [Notion](https://notion.so/) - For database views UX
- [TipTap](https://tiptap.dev/) - For the amazing editor framework
- [Tauri](https://tauri.app/) - For making desktop apps lightweight
- [KaTeX](https://katex.org/) - For beautiful math rendering

---

<div align="center">

### **Made with ❤️ by developers who love note-taking**

[⭐ Star this repo](https://github.com/lokus-ai/lokus) • [🐛 Report Bug](https://github.com/lokus-ai/lokus/issues) • [💡 Request Feature](https://github.com/lokus-ai/lokus/discussions) • [💬 Join Discord](https://discord.gg/lokus)

**Don't forget to star the repo if you find it useful! ⭐**

</div>
