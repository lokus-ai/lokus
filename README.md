<div align="center">

![Lokus Logo](assets/lokus-logo.svg)

# Lokus

### Local-first markdown note-taking app with database views, AI integration, and blazing-fast search

**Built with React + Rust. Zero vendor lock-in. All data stays on your device.**

---

[![GitHub Stars](https://img.shields.io/github/stars/lokus-ai/lokus?style=for-the-badge&logo=github)](https://github.com/lokus-ai/lokus/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/lokus-ai/lokus?style=for-the-badge&logo=github)](https://github.com/lokus-ai/lokus/releases)
[![Downloads](https://img.shields.io/github/downloads/lokus-ai/lokus/total?style=for-the-badge&logo=github)](https://github.com/lokus-ai/lokus/releases)

[![Open Collective](https://img.shields.io/opencollective/all/lokus?style=for-the-badge&logo=opencollective&label=Sponsors)](https://opencollective.com/lokus)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/lokus)
[![Dev Container](https://img.shields.io/badge/Dev_Container-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](.devcontainer)

[📥 Download](#-download) • [✨ Features](#-features) • [📸 Screenshots](#-screenshots) • [🚀 Quick Start](#-quick-start) • [💬 Community](#-community) • [🤝 Contributing](#-contributing)

</div>

---

## 🎯 What is Lokus?

Lokus is a **next-generation note-taking app** for developers, writers, and knowledge workers who want:

- ✅ **Database views** (like Notion) without plugins
- ✅ **3D/2D knowledge graphs** that actually work
- ✅ **AI integration** (MCP server with 68+ tools)
- ✅ **Lightning-fast search** (100x faster than alternatives)
- ✅ **Local-first** (your data, your device, your control)
- ✅ **Obsidian compatible** (just point it at your vault)
- ✅ **Tiny & fast** (10MB download, Rust-powered)

**No vendor lock-in. No cloud required. No subscription fees.**

---

## 🆚 Why Lokus vs Obsidian?

| Feature | Obsidian | Lokus |
|---------|----------|-------|
| **Database Views** | Requires Dataview plugin | ✅ Built-in |
| **Graph View** | Basic 2D | ✅ Interactive 2D/3D |
| **Canvas** | Via plugin | ✅ Built-in |
| **AI Integration** | Various plugins | ✅ Native MCP server |
| **Sync** | $10/month | ✅ Free (use any cloud) |
| **App Size** | ~100MB (Electron) | ✅ ~10MB (Rust/Tauri) |
| **Search Speed** | Standard | ✅ 100x faster (Quantum architecture) |
| **Startup Time** | 2-3 seconds | ✅ <1 second |
| **Memory Usage** | ~300MB | ✅ ~30MB |

---

## 📥 Download

<div align="center">

### Pre-built Binaries

[![Download for macOS](https://img.shields.io/badge/macOS-Download-000000?style=for-the-badge&logo=apple)](https://github.com/lokus-ai/lokus/releases/latest)
[![Download for Windows](https://img.shields.io/badge/Windows-Download-0078D6?style=for-the-badge&logo=windows)](https://github.com/lokus-ai/lokus/releases/latest)
[![Download for Linux](https://img.shields.io/badge/Linux-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/lokus-ai/lokus/releases/latest)

**Latest Version:** v1.3.3 | [View All Releases](https://github.com/lokus-ai/lokus/releases)

</div>

### Installation

**macOS** (Apple Silicon & Intel)
```bash
# Download .dmg from releases
# Drag Lokus to Applications folder
```

**Windows** (x64)
```bash
# Download .exe installer or .zip portable
```
> **Note**: Windows may show a SmartScreen warning for the first few weeks after release. This is normal for new applications and will disappear as we build reputation. The app is safe - it's open-source and signed.

**Linux** (AppImage)
```bash
wget https://github.com/lokus-ai/lokus/releases/latest/download/lokus.AppImage
chmod +x lokus.AppImage
./lokus.AppImage
```

---

## ✨ Features

<details open>
<summary><b>📝 Rich Markdown Editor</b></summary>

- **TipTap 3.4** - Industry-leading rich text editor
- **100+ languages** syntax highlighting
- **LaTeX math** - inline `$x^2$` and block `$$E=mc^2$$`
- **Wiki links** - `[[Note Name]]` with autocomplete
- **Tables** - Resizable columns, sorting, Excel paste
- **Code blocks** - Line numbers, copy button
- **Task lists** - Multiple statuses
- **Images** - Lazy loading, auto-compression
- **Smart paste** - HTML → Markdown conversion
- **Split pane** editing (Cmd/Ctrl + \\)
- **Vim mode** (optional)

</details>

<details>
<summary><b>🗄️ Database Views (Bases)</b></summary>

Transform markdown files into **Notion-style databases**:

- **8 property types**: Text, Number, Date, Select, Multi-select, Checkbox, URL, Email
- **YAML frontmatter** as database properties
- **Inline editing** - Click to edit cells
- **Advanced filtering** - AND/OR logic, 15+ operators
- **Sorting & grouping** - Multi-column support
- **Multiple views** per base
- **Quantum search** integration

**Example:**
```markdown
---
title: Build Landing Page
status: In Progress
priority: High
due_date: 2025-10-30
tags: [web, design]
---

# Build Landing Page
Your note content...
```

View and edit as a sortable, filterable table!

</details>

<details>
<summary><b>🕸️ Knowledge Graph</b></summary>

- **2D & 3D visualization** - Toggle between views
- **Interactive navigation** - Click nodes to open notes
- **Community detection** - Auto-clustering
- **Filter by tags/paths** - Custom queries
- **Export** as PNG/SVG
- **Force-directed layout** - Physics simulation
- **Real-time updates** - See changes instantly
- **Handles 10,000+ notes** - Sub-100ms rendering

</details>

<details>
<summary><b>🤖 AI Integration (MCP Server)</b></summary>

**Built-in Model Context Protocol server** with **68+ tools**:

- ✅ Auto-starts with Lokus (zero config)
- ✅ **Note Management** (11 tools) - CRUD operations
- ✅ **Workspace Operations** (12 tools) - File management
- ✅ **Advanced Search** (16 tools) - Quantum search
- ✅ **AI Analysis** (10 tools) - Content analysis, suggestions
- ✅ **File Operations** (6 tools) - Move, rename, organize
- ✅ **Editor Enhancements** (10 tools) - Format, validate

**Connects to any AI assistant** via MCP protocol!

</details>

<details>
<summary><b>⚡ Quantum Search</b></summary>

**100x faster** than traditional search:

- **Quantum Superposition Index** - O(1) lookups
- **Neural Semantic Cache** - Predictive search
- **Benchmarks** - 10,000 files in 22ms vs 2,400ms
- **90% less memory** usage
- **Sub-millisecond** query latency
- **Full-text search** with regex
- **Advanced queries** - AND/OR/NOT logic
- **Tag/date/path** search

</details>

<details>
<summary><b>🎨 Canvas & More</b></summary>

- **Infinite Canvas** - Freeform spatial thinking (TLDraw)
- **Kanban Boards** - Visual task management
- **Templates** - Date/time variables, cursor positioning
- **Theme System** - Real-time editor, dark/light mode
- **Gmail Integration** - OAuth 2.0, import emails as notes
- **Plugin System** - VS Code-level extensibility

</details>

---

## 📸 Screenshots

<div align="center">

### Rich Markdown Editor
![Editor](assets/screenshots/screenshot-1.png)

### 3D Knowledge Graph
![Graph](assets/screenshots/screenshot-2.png)

### Database Views (Bases)
![Bases](assets/screenshots/screenshot-3.png)

### Interactive Navigation
![Navigation](assets/screenshots/screenshot-4.png)

</div>

---

## 🚀 Quick Start

### For Users

1. **Download** pre-built binary from [releases](https://github.com/lokus-ai/lokus/releases)
2. **Install** and open Lokus
3. **Point it** at your existing vault (or create new workspace)
4. **Start writing!**

### For Contributors

**Option 1: Dev Container** (Recommended) 🐳

```bash
# 1. Install Docker Desktop + VS Code
# 2. Clone repo
git clone https://github.com/lokus-ai/lokus.git
cd lokus
code .
# 3. Click "Reopen in Container" → Done! 🎉
```

All dependencies (Node.js, Rust, Tauri) install automatically!

**Option 2: Manual Setup**

```bash
# Prerequisites: Node.js 18+, Rust (rustup)
git clone https://github.com/lokus-ai/lokus.git
cd lokus
npm install

# Run development server
npm run tauri dev

# Build for production
npm run tauri build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup guide.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TipTap](https://img.shields.io/badge/TipTap-3.4-000?logo=tiptap) ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css) ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite) |
| **Backend** | ![Rust](https://img.shields.io/badge/Rust-Tauri_2.0-000000?logo=rust) ![Tokio](https://img.shields.io/badge/Tokio-async-000?logo=rust) |
| **Storage** | JSON (local-first) + SQLite (optional) |
| **Graph** | Three.js, Sigma.js, react-force-graph |
| **Canvas** | TLDraw 2.0 |
| **Math** | KaTeX 0.16+ |
| **Search** | Custom Quantum index + FlexSearch |
| **Testing** | ![Vitest](https://img.shields.io/badge/Vitest-unit-729B1B?logo=vitest) ![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright) (500+ tests) |

---

## 📊 Performance

<div align="center">

| Metric | Obsidian | Lokus | Improvement |
|--------|----------|-------|-------------|
| **Search (10k files)** | 2,400ms | 22ms | **109x faster** ⚡ |
| **Memory Usage** | ~300MB | ~30MB | **90% less** 💾 |
| **App Size** | ~100MB | ~10MB | **90% smaller** 📦 |
| **Startup Time** | 2-3s | <1s | **3x faster** 🚀 |

*Benchmarks: MacBook Pro M1, 10,000 markdown files*

</div>

---

## 💬 Community

<div align="center">

[![GitHub Discussions](https://img.shields.io/badge/GitHub-Discussions-181717?style=for-the-badge&logo=github)](https://github.com/lokus-ai/lokus/discussions)
[![Discord](https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/lokus)
[![Reddit](https://img.shields.io/badge/Reddit-r/lokus-FF4500?style=for-the-badge&logo=reddit&logoColor=white)](https://reddit.com/r/lokus)

**Get help, share workflows, and connect with other users!**

</div>

**Stay Updated:**
- 🐦 [Twitter](https://twitter.com/lokus_ai) - News & updates
- 📝 [Blog](https://lokusmd.com/blog) - Tutorials & deep dives
- 📺 [YouTube](https://youtube.com/@lokus) - Video guides

---

## 🤝 Contributing

We welcome all contributions! Whether you're:

- 🐛 **Reporting bugs**
- 💡 **Suggesting features**
- 💻 **Contributing code**
- 📖 **Improving docs**
- 🎨 **Designing themes**
- 🔌 **Building plugins**

**Quick Start for Contributors:**

1. ⭐ Star the repo
2. 🍴 Fork it
3. 🐳 Use Dev Container (easiest) or manual setup
4. 🔨 Make your changes
5. ✅ Run tests: `npm test`
6. 📤 Submit PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guide.

### 🎯 Good First Issues

New to the project? Start here:

[![Good First Issues](https://img.shields.io/github/issues/lokus-ai/lokus/good%20first%20issue?label=Good%20First%20Issues&color=7057ff&style=for-the-badge)](https://github.com/lokus-ai/lokus/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

---

## 💖 Sponsor

Lokus is **100% free and open source**, built by developers who believe in local-first software.

Support development and help us build features faster:

<div align="center">

[![Sponsor on Open Collective](https://img.shields.io/badge/Sponsor-Open%20Collective-7FADF2?style=for-the-badge&logo=opencollective)](https://opencollective.com/lokus)

**[Become a Sponsor →](https://opencollective.com/lokus)**

</div>

Your sponsorship helps:
- 🚀 Faster feature development
- 🐛 Quicker bug fixes
- 📱 Mobile apps (coming Q1 2026)
- 📚 Better documentation
- 🎨 Professional design
- ⚡ Infrastructure costs

**100% transparent** - All expenses visible on Open Collective.

### 💎 Sponsors

<a href="https://opencollective.com/lokus#sponsors" target="_blank"><img src="https://opencollective.com/lokus/sponsors.svg?width=890"></a>

### ☕ Backers

<a href="https://opencollective.com/lokus#backers" target="_blank"><img src="https://opencollective.com/lokus/backers.svg?width=890"></a>

---

## 🗺️ Roadmap

### ✅ v1.3 "Quantum Leap" (Current)

- [x] Bases - Database system
- [x] MCP Server - AI integration (68+ tools)
- [x] Quantum Architecture - 100x faster search
- [x] Windows Support - Full cross-platform
- [x] Plugin System v2 - VS Code-level extensibility
- [x] Gmail Integration - OAuth 2.0

### 🚧 v1.4 - Next (Q1 2026)

- [ ] 📱 **Mobile apps** (iOS & Android via Tauri Mobile)
- [ ] 📅 Calendar view for Bases
- [ ] 🧮 Formula support (spreadsheet-like)
- [ ] 📄 PDF annotations
- [ ] 🌐 Web clipper extension
- [ ] 🔒 E2E encryption (optional)

### 🔮 v1.5 - Future (Q2 2026)

- [ ] 🔌 Obsidian plugin compatibility layer
- [ ] 📚 Multi-vault support
- [ ] 🤖 AI writing assistant
- [ ] 📤 Export to PDF/DOCX with formatting
- [ ] ⚙️ Workflow automation

[Vote on features →](https://github.com/lokus-ai/lokus/discussions/categories/roadmap)

---

## ❓ FAQ

<details>
<summary><b>Is Lokus compatible with Obsidian?</b></summary>

**Yes!** Lokus uses standard markdown files. Point it at your Obsidian vault and everything works (notes, links, attachments). No migration needed.
</details>

<details>
<summary><b>Is sync really free?</b></summary>

**Yes!** Use any cloud provider (Dropbox, Google Drive, iCloud, Syncthing). No vendor lock-in. Optional paid sync coming later.
</details>

<details>
<summary><b>Can I use Lokus offline?</b></summary>

**100% yes!** Lokus is local-first. Internet only needed for Gmail integration and optional future sync.
</details>

<details>
<summary><b>What about my privacy?</b></summary>

All data stays on your device. **No telemetry, no tracking, no analytics.** Optional cloud features use industry-standard security (OAuth 2.0).
</details>

<details>
<summary><b>When are mobile apps coming?</b></summary>

**Q1 2026** for iOS and Android via Tauri Mobile. [Track progress →](https://github.com/lokus-ai/lokus/discussions)
</details>

---

## 📄 License

Licensed under [MIT License](LICENSE) - Free to use, modify, and distribute.

---

## 🙏 Acknowledgments

Built with inspiration from:

- [Obsidian](https://obsidian.md) - Pioneering local-first knowledge management
- [Notion](https://notion.so) - Database views & UX
- [TipTap](https://tiptap.dev) - Amazing editor framework
- [Tauri](https://tauri.app) - Lightweight desktop apps
- [Rust](https://rust-lang.org) - Performance & safety

Special thanks to our [contributors](https://github.com/lokus-ai/lokus/graphs/contributors) and the open source community! 💙

---

<div align="center">

### ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lokus-ai/lokus&type=Date)](https://star-history.com/#lokus-ai/lokus&Date)

---

**Made with ❤️ by developers who love note-taking**

[⭐ Star this repo](https://github.com/lokus-ai/lokus) • [🐛 Report Bug](https://github.com/lokus-ai/lokus/issues) • [💡 Request Feature](https://github.com/lokus-ai/lokus/discussions) • [💬 Join Discord](https://discord.gg/lokus)

**If you find Lokus useful, please star the repo! It helps others discover the project.**

</div>
