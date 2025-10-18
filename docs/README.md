# Lokus Documentation

The `/docs` directory houses reference material for people using, operating, or extending Lokus. This index explains how the content is organised and points to the best starting points for each audience.

---

## Directory map

```
docs/
├── features/                # Feature spotlights, editor tips, Bases, graph view, etc.
├── developer/               # Architecture notes, build guides, testing strategy
├── user-guide/              # Troubleshooting, FAQ, onboarding walkthroughs
├── mcp-server/              # Model Context Protocol server reference and examples
├── developer/ui-plugin-development-guide.md
├── BUILD_GUIDE.md
├── ENVIRONMENT_VARIABLES.md
└── MCP_INTEGRATION_GUIDE.md
```

---

## Start here

| Audience | Read this first | Why |
| --- | --- | --- |
| New users | [`../QUICKSTART.md`](../QUICKSTART.md) | Install the desktop app and explore the core workflow |
| Returning users | [`features/`](features/) index | Deep dives into Bases, graph view, templates, and other UI features |
| Contributors | [`developer/getting-started.md`](developer/getting-started.md) | Local environment setup, architecture tour, coding conventions |
| Release managers | [`BUILD_GUIDE.md`](BUILD_GUIDE.md) | Platform prerequisites, signing, automation, and release checklists |
| AI integrators | [`MCP_INTEGRATION_GUIDE.md`](MCP_INTEGRATION_GUIDE.md) | How to connect AI assistants to the built-in MCP server |

---

## Maintenance guidelines

- Keep screenshots and diagrams in `assets/` or a nearby folder with descriptive filenames.
- Prefer relative links so content remains valid when viewed on GitHub and inside the app.
- Note version-specific behaviour with callouts (e.g. `> Added in v1.3`).
- When adding a new high-level topic, update this README so contributors can find it quickly.

---

## Contributing to docs

Documentation fixes follow the same pull-request process as code changes:

1. Create a branch and edit the relevant files under `docs/` (or update `README.md`/`QUICKSTART.md` for top-level changes).
2. Run spell-check or linters if your editor provides them.
3. Preview Markdown locally (VS Code, `npm run dev` if embedding inside the app, or `npx serve docs` for static previews).
4. Submit a PR with a concise summary of what changed and screenshots when updating UI guides.

If you are unsure where a new document belongs, open a discussion or ask in Discord before writing large sections—maintainers can help with structure and terminology.

---

## Getting help

- [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions)
- [Discord](https://discord.gg/lokus)
- Project maintainers via `team@lokus.ai`
