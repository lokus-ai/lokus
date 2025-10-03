<div align="center">

![Lokus Logo](assets/lokus-logo.svg)

# Lokus

**A fast, extensible markdown editor built with Tauri and React**

I got tired of installing 10+ Obsidian plugins just to get basic features working. So I built Lokus with everything you need already included.

[![GitHub Stars](https://img.shields.io/github/stars/lokus-ai/lokus?style=for-the-badge&logo=github&color=yellow)](https://github.com/lokus-ai/lokus/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/lokus-ai/lokus?style=for-the-badge&logo=github&color=blue)](https://github.com/lokus-ai/lokus/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/lokus-ai/lokus?style=for-the-badge&logo=github&color=red)](https://github.com/lokus-ai/lokus/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[![Downloads](https://img.shields.io/github/downloads/lokus-ai/lokus/total?style=flat-square&logo=github&color=brightgreen)](https://github.com/lokus-ai/lokus/releases)
[![Latest Release](https://img.shields.io/github/v/release/lokus-ai/lokus?style=flat-square&logo=github)](https://github.com/lokus-ai/lokus/releases/latest)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289DA?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/lokus)

[Quick Start](#quick-start) • [Features](#what-makes-it-different) • [Screenshots](#screenshots) • [Roadmap](#roadmap) • [Contributing](#contributing)

</div>

---

## Why I Built This

I used Obsidian for 2 years. It's great, but I kept hitting the same frustrations:

- Need database views? Install Dataview plugin
- Want better graphs? Install another plugin
- Canvas mode? Yet another plugin
- Sync costs $10/month (or configure Syncthing manually)
- Graph view works, but it's pretty basic
- 100MB+ download size

After installing my 15th plugin, I thought: why isn't this stuff just built-in?

So I spent 6 months building Lokus. Same philosophy (local markdown files, privacy-first), but with the features you actually want included from day one.

## What Makes It Different

Here's what you get without installing any plugins:

### The Basics (That Should Be Built-In)

**Rich Markdown Editor**
- Everything you'd expect: headings, lists, tables, code blocks
- LaTeX math rendering: `$x^2$` for inline, `$$E=mc^2$$` for blocks
- Syntax highlighting for 100+ languages
- Real-time preview

**Wiki Links**
- Type `[[` and autocomplete pops up
- Bidirectional linking works like you'd expect
- Backlinks panel shows what links to current note

**Knowledge Graph**
- Both 2D and 3D views (toggle with one click)
- Actually interactive - click nodes to jump to notes
- Filter by tags
- Shows link strength visually

### The Good Stuff (That's Actually Built-In)

**Database Views (Bases)**
- Think Notion, but for your local markdown files
- Create table views of your notes
- Sort, filter, group by properties
- Add custom metadata without touching frontmatter
- Multiple views per base (table, gallery, calendar coming soon)
- Automatically creates an "All Notes" base when you first open a workspace

**Canvas Mode**
- Infinite whiteboard for visual thinking
- Drag files onto it
- Draw connections between ideas
- No plugin needed

**Kanban Boards**
- Built-in task management
- Drag and drop between columns
- Markdown-based (can edit in any text editor)

**Gmail Integration**
- Import emails as markdown notes
- Send emails from notes (write in markdown, send as formatted email)
- Keep attachments with notes
- Track email threads

### Performance Stuff

**Why It's Fast**
- Built with Rust (Tauri framework) instead of Electron
- ~10MB download vs Obsidian's ~100MB
- Starts in under a second
- Full-text search is instant (powered by Rust)

**Local-First**
- Everything stays on your computer
- Use your own cloud storage for sync (Dropbox, Google Drive, iCloud, Syncthing - whatever you want)
- No vendor lock-in
- Your files are just markdown

### Customization

**Themes**
- Built-in theme editor with live preview
- Dark/light mode
- Custom color schemes
- Change fonts, spacing, colors - everything

**Plugin System**
- VS Code-style extension API
- Hot reload during development
- Add custom commands and shortcuts
- Create custom markdown syntax

---

## Screenshots

<div align="center">

### Rich Markdown Editor
![Editor View](assets/screenshots/screenshot-1.png)

### 3D Knowledge Graph
![Graph View](assets/screenshots/screenshot-2.png)

### Database Views (Bases)
![Bases Database](assets/screenshots/screenshot-3.png)

### Interactive Graph
![Graph View 2](assets/screenshots/screenshot-4.png)

### Advanced Editing
![Markdown Editing](assets/screenshots/screenshot-5.png)

</div>

---

## Quick Start

### Download

**macOS** (Apple Silicon & Intel)
- Download the latest `.dmg` from [releases](https://github.com/lokus-ai/lokus/releases)
- Drag to Applications folder
- First time: Right-click → Open (to bypass Gatekeeper)

**Windows**
- Download the installer from [releases](https://github.com/lokus-ai/lokus/releases)
- Run the installer
- Note: Windows Defender might complain (code isn't signed yet - working on it)
- Portable version also available if you prefer

**Linux**
- Download the `.AppImage` from [releases](https://github.com/lokus-ai/lokus/releases)
- Make it executable: `chmod +x lokus.AppImage`
- Run it: `./lokus.AppImage`
- Flatpak coming soon

### Build from Source

Need Node.js 18+ and Rust installed.

```bash
git clone https://github.com/lokus-ai/lokus.git
cd lokus
npm install
npm run tauri dev
```

For production build:
```bash
npm run tauri build
```

---

## Comparison with Obsidian

Look, Obsidian is great. This isn't meant to replace it for everyone. But here's how they differ:

| Feature | Obsidian | Lokus |
|---------|----------|-------|
| Database views | Need Dataview plugin | Built-in |
| Canvas mode | Need Excalidraw plugin | Built-in |
| Graph view | 2D only | 2D and 3D |
| Kanban boards | Need plugin | Built-in |
| Sync | $10/month OR configure Syncthing | Use any cloud storage |
| Download size | ~100MB | ~10MB |
| Technology | Electron | Tauri (Rust) |
| Plugin ecosystem | Huge (3000+) | Growing (new) |
| Mobile apps | Yes | Coming in v1.1 |
| Stability | Very stable | Stable, but newer |

**Should you switch?**
- If you're happy with Obsidian: probably not
- If you're tired of plugin management: try Lokus
- If you want built-in database views: try Lokus
- If you need mobile apps right now: stick with Obsidian (for now)

---

## Roadmap

### What's Working Now (v1.0)
- Rich markdown editor
- Wiki links and backlinks
- 2D/3D knowledge graph
- Database views (Bases)
- Canvas mode
- Kanban boards
- Gmail integration
- Theme customization
- Plugin system
- Full-text search

### Coming Soon (v1.1 - Next 2-3 Months)
- Mobile apps (iOS and Android)
- Calendar view for Bases
- Improved Kanban boards
- PDF annotations
- Vim mode
- Frontmatter support in Bases
- Better graph performance

### Future Plans (v1.2+)
- End-to-end encryption
- Browser extension for web clipping
- Collaboration features (maybe - needs thought)
- AI-powered search
- Template marketplace
- Multi-vault support

### Community Requests
Things people have asked for:
- Portable Windows version (working on it)
- Flatpak distribution (planned)
- Obsidian plugin compatibility layer (investigating)
- Export to PDF/DOCX (planned)

Want to vote on features or suggest new ones? Check out the [discussions](https://github.com/lokus-ai/lokus/discussions).

---

## Tech Stack

**Frontend**
- React 19 for the UI
- TipTap for the editor (it's really good)
- Tailwind CSS for styling
- react-force-graph for the graph views

**Backend**
- Tauri 2.0 (Rust)
- Tokio for async operations
- File-based storage (plain JSON and markdown files)

**Testing**
- Vitest for unit tests
- Playwright for end-to-end tests

**Math & Graphs**
- KaTeX for LaTeX rendering
- Three.js for 3D graphs

---

## Documentation

- [Installation Guide](INSTALLATION.md) - Detailed setup instructions
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Platform Guide](docs/PLATFORM_GUIDE.md) - Platform-specific info
- [Build Guide](docs/BUILD_GUIDE.md) - Building from source
- [Plugin API](docs/PLUGIN_API.md) - Creating plugins

---

## Contributing

I'd love your help! Whether that's:

- Reporting bugs
- Suggesting features
- Writing documentation
- Fixing bugs
- Adding features
- Creating themes
- Building plugins

To contribute code:
1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Test everything
5. Push and open a PR

Check [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

---

## Project Stats

<div align="center">

### Real-time GitHub Stats

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

### Growth Over Time

[![Star History Chart](https://api.star-history.com/svg?repos=lokus-ai/lokus&type=Timeline)](https://star-history.com/#lokus-ai/lokus&Timeline)

*Stats update every ~5 minutes*

</div>

---

## FAQ

**Q: Will my Obsidian vault work in Lokus?**
A: Yes! Lokus uses standard markdown files. Just point it at your existing Obsidian vault folder and everything should work. Your files won't be modified in any way that breaks Obsidian compatibility.

**Q: What about my Obsidian plugins?**
A: They won't work directly. But the most popular ones (Dataview, Canvas, Kanban) are built into Lokus. For others, we're working on a compatibility layer. You can also build equivalent plugins using our plugin API.

**Q: How do I sync between devices?**
A: Use any cloud storage service. Put your vault folder in Dropbox, Google Drive, iCloud Drive, or use Syncthing for more control. No proprietary sync needed.

**Q: Is it stable enough for daily use?**
A: I use it daily. That said, it's newer than Obsidian (6 months vs 5+ years). Make backups. Use version control if you want extra safety.

**Q: When will mobile apps be ready?**
A: iOS and Android apps are in development. Target: 2-3 months. They're taking longer than expected because I want them to be actually good, not just a webview wrapper.

**Q: Why not just contribute to Obsidian?**
A: Obsidian isn't open source. I wanted something the community could modify, fork, and improve together.

**Q: Can I use this for my novel/thesis/work?**
A: Yes, but make backups. It's stable, but it's still relatively new software.

**Q: How do I migrate from Notion/Evernote/etc?**
A: Export to markdown, put files in a folder, point Lokus at it. That's it. There's no import process because it just works with regular markdown files.

---

## Known Issues

- Windows Defender flags the installer (code isn't signed yet - costs $400/year)
- Graph can get slow with 1000+ notes (working on it)
- Some keyboard shortcuts conflict with system shortcuts on Windows (mostly fixed)
- Bases doesn't support all frontmatter formats yet

See [open issues](https://github.com/lokus-ai/lokus/issues) for the full list.

---

## License

MIT License - see [LICENSE](LICENSE) file.

Free to use, modify, and distribute. Commercial use is fine. Just keep the license notice.

---

## Acknowledgments

Built with help from:
- [Obsidian](https://obsidian.md/) for the inspiration and proving local-first can work
- [Notion](https://notion.so/) for showing how good database views can be
- [TipTap](https://tiptap.dev/) for the excellent editor framework
- [Tauri](https://tauri.app/) for making it possible to build small, fast desktop apps
- [KaTeX](https://katex.org/) for beautiful math rendering
- Everyone who's contributed, reported bugs, or suggested features

---

<div align="center">

### Built by someone who loves note-taking

[⭐ Star this repo](https://github.com/lokus-ai/lokus) • [🐛 Report Bug](https://github.com/lokus-ai/lokus/issues) • [💡 Request Feature](https://github.com/lokus-ai/lokus/discussions) • [💬 Discord](https://discord.gg/lokus)

**If this helps you, star it! More stars = more motivation to keep building**

</div>
