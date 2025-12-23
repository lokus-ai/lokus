<div align="center">

<img src="assets/lokus-logo.svg" alt="Lokus" width="120" height="120" />

# Lokus

**The Open Source Note-Taking App for People Who Own Their Data**

Local-first. Privacy-focused. Blazing fast.

[Website](https://lokusmd.com) · [Documentation](https://docs.lokusmd.com) · [Changelog](https://github.com/lokus-ai/lokus/releases)

---

[![GitHub Stars](https://img.shields.io/github/stars/lokus-ai/lokus?style=flat&logo=github&labelColor=1a1a2e&color=6366f1)](https://github.com/lokus-ai/lokus/stargazers)
[![License](https://img.shields.io/badge/License-BSL_1.1-blue?style=flat&labelColor=1a1a2e&color=6366f1)](LICENSE)
[![Release](https://img.shields.io/github/v/release/lokus-ai/lokus?include_prereleases&style=flat&labelColor=1a1a2e&color=6366f1)](https://github.com/lokus-ai/lokus/releases)
[![Downloads](https://img.shields.io/github/downloads/lokus-ai/lokus/total?style=flat&labelColor=1a1a2e&color=6366f1)](https://github.com/lokus-ai/lokus/releases)

<br />

<img src="assets/screenshots/hero-screenshot.png" alt="Lokus Screenshot" width="800" />

</div>

<br />

## Why Lokus?

Most note-taking apps fall into two categories: **powerful but closed-source** (Obsidian) or **open but cloud-dependent** (Notion). Lokus is neither.

- **Truly Open Source** — MIT licensed. Read every line. Fork it. Make it yours.
- **Local-First** — Your notes are markdown files on YOUR device. No proprietary format.
- **Fast** — Built with Tauri & Rust. ~50MB RAM vs 300MB+ for Electron apps.
- **No Subscription** — Free forever. No $10/month sync tax.

<br />

## Features

<table>
<tr>
<td width="50%">

### Editor
- Rich text with live markdown preview
- Wiki links with `[[autocomplete]]`
- LaTeX math rendering (KaTeX)
- 100+ language syntax highlighting
- Tables with resize & sort
- Task lists with 18 states
- Smart paste (HTML → Markdown)

</td>
<td width="50%">

### Organization
- Graph view (2D & 3D)
- Infinite canvas (TLDraw)
- Database views (Notion-style)
- Template system (90+ features)
- Daily notes
- Full-text search
- Tags & folders

</td>
</tr>
<tr>
<td width="50%">

### Integration
- MCP server for AI assistants
- Plugin marketplace
- Theme customization
- Keyboard-first design
- 40+ slash commands

</td>
<td width="50%">

### Privacy
- Zero telemetry
- No account required
- Works 100% offline
- Standard markdown files
- P2P sync (coming soon)

</td>
</tr>
</table>

<br />

## Installation

<table>
<tr>
<td align="center" width="33%">
<img src="https://cdn.simpleicons.org/apple/white" width="24" height="24" alt="macOS" />
<br />
<b>macOS</b>
<br />
<a href="https://github.com/lokus-ai/lokus/releases/latest">Download .dmg</a>
<br />
<sub>Intel & Apple Silicon</sub>
</td>
<td align="center" width="33%">
<img src="https://cdn.simpleicons.org/windows/white" width="24" height="24" alt="Windows" />
<br />
<b>Windows</b>
<br />
<a href="https://github.com/lokus-ai/lokus/releases/latest">Download .exe</a>
<br />
<sub>Windows 10/11 x64</sub>
</td>
<td align="center" width="33%">
<img src="https://cdn.simpleicons.org/linux/white" width="24" height="24" alt="Linux" />
<br />
<b>Linux</b>
<br />
<a href="https://github.com/lokus-ai/lokus/releases/latest">Download .AppImage</a>
<br />
<sub>.deb and .rpm also available</sub>
</td>
</tr>
</table>

```bash
# Or build from source
git clone https://github.com/lokus-ai/lokus.git
cd lokus && npm install && npm run tauri build
```

<br />

## Quick Start

```
1. Download and install Lokus
2. Create a new workspace (or open existing markdown folder)
3. Start writing
```

**Coming from Obsidian?** Just point Lokus at your vault. It works with your existing notes.

<br />

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TipTap 3, Tailwind CSS, Vite 7 |
| Backend | Rust, Tauri 2.0, Tokio |
| Editor | TipTap (ProseMirror), KaTeX, Shiki |
| Canvas | TLDraw |
| Graph | Three.js, D3-force |
| Testing | Vitest, Playwright |

<br />

## Development

### Prerequisites

- Node.js 18+
- Rust (via rustup)
- Platform-specific dependencies ([see docs](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
# Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install dependencies
npm install

# Start development server
npm run tauri dev

# Run tests
npm test
```

### Project Structure

```
lokus/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── core/               # Core functionality
│   ├── editor/             # TipTap editor
│   └── views/              # Main views
├── src-tauri/              # Rust backend
│   └── src/                # Tauri commands
├── tests/                  # Test suites
└── docs/                   # Documentation
```

<br />

## Roadmap

### Current (v1.0.0-beta)
- [x] Rich markdown editor
- [x] Wiki links & graph view
- [x] Canvas & database views
- [x] Template system
- [x] Plugin marketplace
- [x] MCP server integration

### Next
- [ ] P2P sync (Iroh)
- [ ] Mobile apps (iOS & Android)
- [ ] Collaborative editing
- [ ] End-to-end encryption
- [ ] Calendar view for databases

<br />

## Contributing

We welcome contributions of all kinds:

- **Bug reports** — [Open an issue](https://github.com/lokus-ai/lokus/issues)
- **Feature requests** — [Start a discussion](https://github.com/lokus-ai/lokus/discussions)
- **Code contributions** — Fork, code, submit PR
- **Documentation** — Help us improve the docs

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

<br />

## Community

- [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions) — Questions & ideas
- [Discord](https://discord.gg/lokus) — Real-time chat
- [Twitter](https://twitter.com/lokusmd) — Updates & news

<br />

## Support

If you find Lokus useful, consider:

- Starring this repository
- [Sponsoring on Open Collective](https://opencollective.com/lokus)
- Spreading the word

<br />

## License

Lokus is licensed under the [Business Source License 1.1](LICENSE).

- **Free for personal use** — Always
- **Free for small teams** — Under 10 users
- **Enterprise licensing** — Contact us for larger deployments

The license converts to MIT after 4 years.

<br />

---

<div align="center">

**[Download Lokus](https://github.com/lokus-ai/lokus/releases)** · **[Read the Docs](https://docs.lokusmd.com)** · **[Join Discord](https://discord.gg/lokus)**

<sub>Built with care by the Lokus team and contributors.</sub>

</div>
