# Lokus

A local-first knowledge workspace that combines a rich markdown editor, structured "Bases" views, visual graph exploration, and desktop integrations. Lokus pairs a Vite/React front end with a Tauri (Rust) shell so you can keep your notes, plugins, and AI tooling on your own machine.

<p align="center">
  <a href="https://github.com/lokus-ai/lokus/releases/latest"><img alt="Download Lokus" src="assets/lokus-logo.svg" width="120" /></a>
</p>

[Download](#download) • [Highlights](#highlights) • [Quick start](#quick-start) • [Local development](#local-development) • [Testing](#testing) • [Documentation](#documentation) • [Contributing](#contributing)

---

## Download

Desktop builds for macOS, Windows, and Linux are published on the [GitHub Releases page](https://github.com/lokus-ai/lokus/releases/latest). Each release contains:

- `.dmg` installer for Apple Silicon & Intel macOS
- `.msi` installer for Windows 10/11
- `.AppImage` for modern Linux distributions (tested on Ubuntu & Fedora)

> **Tip:** Verify downloaded binaries using the checksums attached to each release before installing in production environments.

---

## Highlights

- **Local-first by design** – Workspaces live on disk, sync is left up to your preferred cloud or git workflow.
- **Markdown + rich editing** – TipTap powered editor supports callouts, tables, math, code blocks with syntax highlighting, and Vim mode.
- **Structured data with Bases** – Promote frontmatter into filterable and sortable views for lightweight database-style queries.
- **Graph navigation** – Explore note relationships in interactive 2D/3D visualisations powered by graphology and three.js.
- **Automation-friendly** – Built-in Model Context Protocol (MCP) server exposes 60+ workspace commands for AI or CLI clients.
- **Extensible** – Plugin system inspired by VS Code makes it possible to bundle custom panels, commands, or integrations.

Screenshots and feature deep dives live in [`docs/features/`](docs/features/).

---

## Quick start

1. **Install** the desktop build for your platform from the latest release.
2. **Launch Lokus** and pick an existing directory or create a new workspace folder.
3. **Create your first note** with `Cmd/Ctrl + N`, or import existing markdown files from the workspace menu.
4. **Explore Bases** from the left navigation to see frontmatter rendered as a table.
5. **Open the graph view** to visualise links across the workspace.

Need more detail? The [Quickstart guide](QUICKSTART.md) walks through each step with screenshots.

---

## Local development

### Prerequisites

- Node.js **20 LTS** (managed with nvm is recommended)
- npm (ships with Node 20) – the repository includes a `package-lock.json`
- Rust **1.77+** with the `cargo` toolchain
- Platform dependencies for Tauri (GTK/WebKit on Linux, Xcode CLT on macOS, Visual Studio Build Tools on Windows)

### Install dependencies

```bash
npm install
```

### Run the web client

```bash
npm run dev
```

The Vite dev server starts on [http://localhost:5173](http://localhost:5173). UI changes hot reload automatically.

### Run the desktop shell

```bash
npm run tauri dev
```

Use the platform-specific scripts (`dev:windows`, `dev:macos`, `dev:linux`) when you need to test target-specific behaviour.

### Build production bundles

```bash
npm run build
npm run tauri build
```

Bundle scripts in `scripts/` orchestrate multi-platform builds and MCP packaging. See [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md) for advanced options.

---

## Testing

The project uses [Vitest](https://vitest.dev) for unit tests and [Playwright](https://playwright.dev) for end-to-end coverage.

```bash
# Run unit tests
npm test

# Watch mode
npm run test:watch

# Playwright E2E suite
npm run test:e2e
```

> Tests are a work in progress. Some suites are marked as flaky in CI while we backfill coverage—please run relevant tests locally before submitting a pull request.

GitHub Actions definitions for unit tests and cross-platform build verification are in [`.github/workflows/test.yml`](.github/workflows/test.yml).

---

## Repository structure

```
.
├── src/                 # React application (routes, components, hooks)
├── src-tauri/           # Rust commands and Tauri configuration
├── packages/            # Shared UI kits and utilities used by the app & plugins
├── docs/                # User guides, developer docs, and feature deep dives
├── scripts/             # Build, release, and maintenance scripts
├── tests/               # E2E Playwright specs and fixtures
└── assets/              # Logos, icons, and marketing imagery
```

---

## Documentation

| Audience | Start here | Highlights |
| --- | --- | --- |
| Users | [Quickstart](QUICKSTART.md) | Installation, workspace basics, key UI concepts |
| Power users | [`docs/features/`](docs/features/) | In-depth feature guides (graph view, Bases, editor tips) |
| Contributors | [`docs/developer/getting-started.md`](docs/developer/getting-started.md) | Architecture overview, environment setup |
| Release managers | [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md) | Build matrix, signing, and release checklist |
| MCP/AI integrations | [`docs/MCP_INTEGRATION_GUIDE.md`](docs/MCP_INTEGRATION_GUIDE.md) | Using the bundled Model Context Protocol server |

Additional reference material—including environment variables, plugin development, and troubleshooting—lives under the [`docs/`](docs) directory.

---

## Contributing

We welcome bug reports, feature proposals, documentation improvements, and plugin examples. Read the [contribution guidelines](CONTRIBUTING.md) and review our [Code of Conduct](CODE_OF_CONDUCT.md) before opening an issue or pull request.

- [Open an issue](https://github.com/lokus-ai/lokus/issues) for bugs or feature ideas.
- Join the conversation in [Discussions](https://github.com/lokus-ai/lokus/discussions) or on [Discord](https://discord.gg/lokus).

---

## License

Lokus is licensed under the [MIT License](LICENSE).
