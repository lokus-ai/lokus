<div align="center">

![Lokus Logo](assets/lokus-logo.svg)

# Lokus

**A sophisticated, local-first markdown note-taking application with built-in database views, AI integration, and VS Code-level extensibility**

Built with React and Rust. Zero lock-in. All data stays on your device.

[![GitHub Stars](https://img.shields.io/github/stars/lokus-ai/lokus?style=social)](https://github.com/lokus-ai/lokus/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289DA?logo=discord&logoColor=white)](https://discord.gg/lokus)
[![Dev Container](https://img.shields.io/badge/Dev_Container-Ready-blue?logo=docker&logoColor=white)](https://github.com/lokus-ai/lokus/tree/main/.devcontainer)

[Quick Start](#quick-start) • [Features](#features) • [Screenshots](#screenshots) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## About

Lokus is a next-generation knowledge management platform that combines advanced rich text editing, wiki-style linking, powerful visualization, and AI integration into a single, cohesive application.

**Why Lokus?**
- **Everything built-in** - No plugin dependencies for core functionality
- **Local-first** - Your data stays on your device, sync with any cloud provider
- **Lightning fast** - Rust-powered backend with Quantum-inspired indexing (100x faster searches)
- **AI-ready** - Built-in MCP server with 68+ tools for AI assistants
- **VS Code-level extensibility** - Powerful plugin system for developers
- **Privacy-focused** - No telemetry, no tracking, no cloud lock-in

---

## Why Lokus vs Obsidian?

| Feature | Obsidian | Lokus |
|---------|----------|-------|
| **Database Views** | Requires Dataview plugin | Built-in Bases with inline editing |
| **Graph View** | Basic 2D | Interactive 2D/3D with clustering |
| **Canvas** | Via plugin | Infinite canvas built-in |
| **AI Integration** | Via plugins | Native MCP server (68+ tools) |
| **Sync** | $10/month | Free (use your own cloud) |
| **Size** | ~100MB | ~10MB |
| **Performance** | Electron-based | Rust-powered (Tauri) |
| **Plugin System** | Limited API | VS Code-level extensibility |
| **Search** | Basic | Quantum architecture (100x faster) |

---

## Screenshots

<div align="center">

### Rich Markdown Editor with Real-time Preview
![Editor View](assets/screenshots/screenshot-1.png)

### 3D Knowledge Graph Visualization
![Graph View](assets/screenshots/screenshot-2.png)

### Bases - Database Views with Inline Editing
![Bases Database](assets/screenshots/screenshot-3.png)

### Interactive Graph Navigation
![Graph View 2](assets/screenshots/screenshot-4.png)

### Advanced Markdown Editing
![Markdown Editing](assets/screenshots/screenshot-5.png)

</div>

---

## Features

### Core Writing & Editing

**Rich Text Editor (TipTap 3.4)**
- Full GitHub Flavored Markdown support
- 100+ languages syntax highlighting
- Smart paste (HTML to Markdown conversion)
- Split pane editing (Cmd/Ctrl + \\)
- Real-time preview
- Vim mode (optional)

**Wiki Links & Backlinks**
- Bidirectional linking with `[[Note Name]]` syntax
- Fuzzy search autocomplete
- Alias support: `[[Note|Display Text]]`
- Header links: `[[Note#Section]]`
- Block references
- Real-time backlink updates (5x faster in v1.3)

**LaTeX Math (KaTeX)**
- Inline equations: `$x^2 + y^2 = z^2$`
- Block equations: `$$E = mc^2$$`
- Custom macros
- Auto-sizing delimiters
- Copy LaTeX source

**Advanced Features**
- Task lists with multiple statuses
- Tables with column resize, sorting, Excel paste
- Code blocks with line numbers, copy button
- Images with lazy loading, auto-compression
- Callouts and admonitions
- Footnotes and citations

### Bases - Database System

Transform markdown files into powerful databases:

- **Table Views** with inline editing
- **YAML Frontmatter** as database properties
- **8 Property Types**: Text, Number, Date, Select, Multi-select, Checkbox, URL, Email
- **Advanced Filtering**: AND/OR logic, 15+ operators
- **Sorting & Grouping** across columns
- **Formula Support** (coming soon)
- **Multiple Views** per base
- **Quantum Search Integration** for instant queries

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

Your note content here...
```

View and edit this as a database table with sortable columns, filters, and inline editing.

### Knowledge Graph

**2D & 3D Visualization**
- Toggle between flat and spatial views
- Interactive navigation (click nodes to open notes)
- Link strength visualization
- Community detection and clustering
- Filter by tags, paths, or custom queries
- Export as PNG/SVG
- Force-directed layout with physics simulation
- Real-time updates

**Performance**
- Handles 10,000+ notes
- Under 100ms rendering
- WebGL-accelerated 3D
- Optimized edge bundling

### AI Integration - MCP Server

**Built-in Model Context Protocol Server (v1.3)**
- Auto-starts with Lokus (zero configuration)
- **68+ tools** across 6 categories:
  - **Note Management** (11 tools): Create, read, update, delete notes
  - **Workspace Operations** (12 tools): File operations, workspace stats
  - **Advanced Search** (16 tools): Quantum search, filtering, queries
  - **AI Analysis** (10 tools): Analyze content, suggest links, extract keywords
  - **File Operations** (6 tools): Move, rename, organize files
  - **Editor Enhancements** (10 tools): Format, validate, transform content
- **Dual Transport**: stdio (local) and HTTP (remote)
- **Custom MCP Plugins**: Extend with your own tools

**Connect Any AI Assistant:**
- Works with desktop apps
- Command-line integration
- Web-based AI tools
- Custom integrations via MCP protocol

### Gmail Integration

**OAuth 2.0 + PKCE Authentication**
- Secure authentication with industry-standard OAuth 2.0
- No password storage (uses macOS Keychain / Windows Credential Manager)
- Automatic token refresh
- Hybrid redirect flow (deep links + localhost fallback)

**Email Operations**
- Import emails as markdown notes
- Preserve threading and conversation context
- Attachment handling with local storage
- Full-text email search within Lokus
- Compose emails in markdown
- Offline queue for operations

### Plugin System

**VS Code-Level Extensibility**
- **8 specialized APIs**: Commands, Editor, UI, Workspace, FileSystem, Network, Storage, Events
- **TypeScript-first** with full type definitions
- **Hot reload** during development
- **Sandboxed execution** for security
- **WebAssembly support** for performance (10x+ speedups)
- **Worker threads** for background processing
- **Plugin Marketplace** at registry.lokus.dev

**Create Plugins For:**
- Custom editor extensions
- UI panels and sidebars
- Data providers (Jira, GitHub, Trello)
- AI integrations via MCP
- Theme customization
- Command automation

### Quantum Performance Architecture

**100x Faster Search**
- Quantum Superposition Index (QSI) with O(1) lookups
- Neural Semantic Cache for predictive search
- Hierarchical Temporal Memory (HTM)
- Stream Processing Engine
- WebAssembly compute for hot paths

**Benchmarks:**
- 10,000 files: 22ms search (vs 2,400ms standard)
- 90% less memory usage
- Sub-millisecond query latency
- 40% faster initial load time

### Canvas & Whiteboard

**Infinite Canvas (TLDraw)**
- Freeform spatial thinking
- Embed notes directly
- Draw diagrams and flowcharts
- Sticky notes and text
- Arrow connections
- Export as SVG/PNG

### Kanban Boards

**Visual Task Management**
- Drag-and-drop cards
- Multiple boards per workspace
- HashMap-backed for performance
- Keyboard-first navigation
- Markdown in cards
- Export to JSON

### Templates

**Reusable Note Structures**
- Date/time variables: `{{date}}`, `{{time}}`
- Cursor positioning: `{{cursor}}`
- Custom variables
- Template library (built-in + community)
- Template hotkeys

### Theme System

**Customization**
- Real-time theme editor
- Dark/Light mode
- Custom color schemes
- Font control (family, size, line height)
- Layout options (sidebar positions, panel sizes)
- Import/export themes
- Community theme marketplace

### Search

**Quantum-Powered Search**
- Full-text search across all notes
- Advanced query syntax (AND, OR, NOT, parentheses)
- Tag search: `tag:important`
- Date search: `date:>2024-01-01`
- Path search: `path:projects/`
- Regex support
- Search in specific properties
- Fuzzy matching

---

## Quick Start

### Download Pre-built Binaries

**macOS** (Apple Silicon & Intel)
```bash
# Download latest .dmg from releases
# https://github.com/lokus-ai/lokus/releases/latest
```

**Windows** (x64)
```bash
# Download installer (.exe) or portable (.zip)
# https://github.com/lokus-ai/lokus/releases/latest
```

**Linux**
```bash
# AppImage (universal)
wget https://github.com/lokus-ai/lokus/releases/latest/download/lokus.AppImage
chmod +x lokus.AppImage
./lokus.AppImage
```

### Build from Source

#### Option 1: Dev Container (Recommended for Contributors) 🐳

The **easiest way** to start contributing! Just install Docker Desktop + VS Code:

```bash
# 1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
# 2. Install VS Code: https://code.visualstudio.com/
# 3. Clone and open
git clone https://github.com/lokus-ai/lokus.git
cd lokus
code .
# 4. Click "Reopen in Container" → Done! 🎉
```

All dependencies (Node.js, Rust, Tauri) are automatically installed in the container!

**See [CONTRIBUTING.md](CONTRIBUTING.md#-quick-start-with-dev-containers-recommended) for full setup guide.**

#### Option 2: Manual Setup

**Prerequisites**
- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific requirements (see [Installation Guide](INSTALLATION.md))

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

## Roadmap

### v1.3 "Quantum Leap" (Current - October 2025)

**Major Features:**
- [x] Bases - Database system with inline editing
- [x] MCP Server - Built-in AI integration (68+ tools)
- [x] OAuth 2.0 + PKCE - Secure authentication
- [x] Quantum Architecture - 100x faster search
- [x] Windows Support - Full cross-platform compatibility
- [x] Plugin System v2 - VS Code-level extensibility
- [x] Split Pane Editing - Multi-document workflow
- [x] Enhanced Kanban - HashMap backend, keyboard nav
- [x] Gmail Integration - Full email operations

**Statistics:**
- 50,000+ lines of new code
- 100+ bug fixes
- 8 property types for Bases
- 68 MCP tools
- 40% faster initial load
- 10x Base rendering performance

### v1.4 - Next (Q1 2026)

**Planned:**
- [ ] Mobile apps (iOS & Android via Tauri Mobile)
- [ ] Calendar view for Bases
- [ ] Formula support in Bases (spreadsheet-like)
- [ ] PDF annotations and highlights
- [ ] Web clipper browser extension
- [ ] End-to-end encryption (optional)
- [ ] Real-time collaboration (optional)
- [ ] Advanced graph analytics

### v1.5 - Future (Q2 2026)

**Exploring:**
- [ ] Obsidian plugin compatibility layer
- [ ] Multi-vault support
- [ ] Template marketplace
- [ ] AI-powered writing assistant
- [ ] Export to PDF/DOCX with formatting
- [ ] Custom property types in Bases
- [ ] Workflow automation

### Community Requests

[View & Vote on Feature Requests](https://github.com/lokus-ai/lokus/discussions/categories/roadmap)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TipTap 3.4, Tailwind CSS, Vite |
| **Backend** | Tauri 2.0 (Rust), Tokio async runtime |
| **Storage** | JSON files (local-first), optional SQLite |
| **Graph** | react-force-graph, Three.js, Sigma.js |
| **Canvas** | TLDraw 2.0 |
| **Math** | KaTeX 0.16+ |
| **Search** | Custom Quantum index + FlexSearch |
| **Testing** | Vitest (unit), Playwright (E2E), 500+ tests |
| **Build** | Vite (frontend), Cargo (backend) |

---

## Documentation

**User Documentation**
- [Official Docs](https://docs.lokus.dev) - Complete user guide
- [Getting Started](https://docs.lokus.dev/getting-started) - Quick start tutorial
- [Features](https://docs.lokus.dev/features) - Detailed feature documentation
- [FAQ](https://docs.lokus.dev/faq) - Frequently asked questions

**Developer Documentation**
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Development Setup](https://docs.lokus.dev/developers/setup) - Build from source
- [Architecture](https://docs.lokus.dev/developers/architecture) - System architecture
- [Plugin Development](https://docs.lokus.dev/developers/plugins) - Create plugins
- [MCP Integration](https://docs.lokus.dev/developers/mcp) - AI integration guide
- [API Reference](https://docs.lokus.dev/reference/plugin-api) - Complete API docs

**Advanced Topics**
- [Performance](https://docs.lokus.dev/advanced/performance) - Quantum architecture
- [Security](https://docs.lokus.dev/advanced/security) - OAuth 2.0 + PKCE
- [Customization](https://docs.lokus.dev/advanced/customization) - Themes & settings

---

## Contributing

We welcome all contributions! Whether you're:

**Reporting Issues**
- [Bug reports](https://github.com/lokus-ai/lokus/issues/new?template=bug_report.md)
- [Feature requests](https://github.com/lokus-ai/lokus/discussions/new?category=ideas)

**Contributing Code**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with clear commit messages
4. Add tests for new functionality
5. Run tests: `npm test`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

**Other Ways to Help**
- Improve documentation
- Create plugins
- Design themes
- Translate to other languages
- Help others in discussions
- Star the repo and spread the word

See our [Contributing Guide](CONTRIBUTING.md) for detailed instructions.

---

## Community

**Get Help & Discuss**
- [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions) - Q&A, ideas, show & tell
- [Discord Server](https://discord.gg/lokus) - Real-time chat
- [Reddit Community](https://reddit.com/r/lokus) - Community discussions

**Stay Updated**
- [Release Notes](https://github.com/lokus-ai/lokus/releases) - Latest changes
- [Roadmap](https://github.com/lokus-ai/lokus/discussions/categories/roadmap) - Upcoming features
- [Twitter](https://twitter.com/lokus_ai) - News and updates

---

## FAQ

**Q: Is Lokus compatible with Obsidian vaults?**
A: Yes! Lokus uses standard markdown files. Point it at your existing Obsidian vault and everything works.

**Q: Will my Obsidian plugins work?**
A: Not directly, but most popular plugin features are built-in (Dataview, Canvas, Graph, Tasks). We're exploring a compatibility layer.

**Q: Is sync really free?**
A: Yes! Use any cloud storage provider (Dropbox, Google Drive, iCloud, Syncthing, etc.). No vendor lock-in. Optional paid sync coming later.

**Q: Why not just use Obsidian?**
A: Obsidian is great! Lokus is for users who want built-in features without managing 10+ plugins, plus advanced features like database views, AI integration, and Quantum search.

**Q: How do I migrate from Obsidian?**
A: Just point Lokus at your vault folder. All notes, links, and attachments work immediately. No migration needed.

**Q: Mobile apps?**
A: Coming in v1.4 (Q1 2026) for iOS and Android via Tauri Mobile.

**Q: Can I use Lokus offline?**
A: Yes! Lokus is 100% local-first. Internet only needed for Gmail integration and future optional sync.

**Q: What about my privacy?**
A: All data stays on your device. No telemetry, no tracking, no analytics. Optional cloud features (Gmail, future sync) use industry-standard security (OAuth 2.0, E2EE).

**Q: Is it really 10x smaller than Obsidian?**
A: Yes! Lokus is ~10MB thanks to Tauri (Rust) vs Obsidian's ~100MB (Electron). Launch time is also faster.

---

## Performance Benchmarks

**Search Performance (10,000 files):**
- Obsidian: ~2,400ms
- Lokus (Quantum): ~22ms
- **Speedup: 109x**

**Memory Usage:**
- Obsidian: ~300MB
- Lokus: ~30MB
- **Reduction: 90%**

**Application Size:**
- Obsidian: ~100MB
- Lokus: ~10MB
- **Reduction: 90%**

**Startup Time:**
- Obsidian: 2-3 seconds
- Lokus: <1 second
- **Speedup: 3x**

*Benchmarks on MacBook Pro M1, 10,000 markdown files, 50MB total*

---

## License

Licensed under the [MIT License](LICENSE).

Free to use, modify, and distribute for personal and commercial projects.

---

## Acknowledgments

Built with inspiration and gratitude:

- [Obsidian](https://obsidian.md/) - For pioneering local-first knowledge management
- [Notion](https://notion.so/) - For database views and UX inspiration
- [TipTap](https://tiptap.dev/) - For the amazing editor framework
- [Tauri](https://tauri.app/) - For making desktop apps lightweight and fast
- [React](https://react.dev/) - For the powerful UI library
- [Rust](https://rust-lang.org/) - For performance and safety

Special thanks to our contributors and the open-source community.

---

<div align="center">

### Made by developers who love note-taking

[Star this repo](https://github.com/lokus-ai/lokus) • [Report Bug](https://github.com/lokus-ai/lokus/issues) • [Request Feature](https://github.com/lokus-ai/lokus/discussions) • [Join Discord](https://discord.gg/lokus)

**If you find Lokus useful, please star the repo!**

</div>
