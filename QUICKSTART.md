# Lokus Quickstart

This guide walks through installing Lokus, creating your first workspace, and discovering the core features in under ten minutes.

---

## 1. Install the desktop app

| Platform | Steps |
| --- | --- |
| **macOS** | Download the `.dmg` from the [latest release](https://github.com/lokus-ai/lokus/releases/latest), open it, and drag **Lokus.app** into `Applications`. Gatekeeper may require you to approve the app in **System Settings → Privacy & Security** the first time you run it. |
| **Windows** | Download the `.msi` installer from the [latest release](https://github.com/lokus-ai/lokus/releases/latest) and follow the installation wizard. If SmartScreen appears, choose **More info → Run anyway**. |
| **Linux** | Download the `.AppImage` from the [latest release](https://github.com/lokus-ai/lokus/releases/latest), then run:
```bash
chmod +x lokus.AppImage
./lokus.AppImage
```
AppImageLauncher or similar tools can integrate the app into your launcher menu. |

> Check the release notes for platform-specific caveats (code signing requirements, additional libraries on Linux, etc.).

---

## 2. Create a workspace

1. Launch **Lokus**.
2. Choose **Create workspace** and select (or create) a folder on disk. Lokus stores all notes, Bases metadata, and configuration in that directory.
3. The workspace opens with a welcome note and sidebar navigation for Notes, Bases, Graph, and Settings.

You can create multiple workspaces and switch between them from the workspace picker on the home screen.

---

## 3. Add your first note

- Press `Cmd/Ctrl + N` to create a note anywhere.
- Give it a title and start typing in Markdown. Formatting helpers appear in the toolbar when text is selected.
- Use frontmatter to capture structured data:

```markdown
---
status: In Progress
due: 2025-10-30
---

# Kick off redesign

- [ ] Outline requirements
- [ ] Share draft with stakeholders
```

Frontmatter fields automatically show up inside the **Bases** view as sortable columns.

---

## 4. Explore the core views

| View | What it does | Try this |
| --- | --- | --- |
| **Bases** | Turns note frontmatter into a spreadsheet-like table. | Filter by `status`, edit properties inline, or create saved views for recurring filters. |
| **Graph** | Visualises relationships across notes using wiki links. | Hover to preview, drag nodes to reorganise, and switch between 2D and 3D layouts. |
| **Canvas** | Spatial canvas for arranging blocks of content (beta). | Drop notes onto the canvas and connect them with arrows for project planning. |
| **Command palette** | Quick actions and navigation (`Cmd/Ctrl + K`). | Jump to notes, toggle panes, or trigger plugins without leaving the keyboard. |

---

## 5. Bring in existing content

- **Import Markdown:** drag files or folders onto the sidebar, or choose **Workspace → Import files**.
- **Clone a repo:** sync a git repository into your workspace directory to keep notes under version control.
- **Templates:** create reusable note scaffolds from the **Templates** panel inside the editor.

---

## 6. Optional: enable AI integrations

Lokus ships with an embedded Model Context Protocol (MCP) server that exposes read/write actions over your workspace.

1. Open **Settings → Integrations** and ensure **MCP server** is enabled.
2. Point your AI assistant (Claude Desktop, Cursor, etc.) at the connection info shown in the settings pane.
3. Use the provided commands to list notes, create tasks, or run custom scripts.

See the [MCP Integration Guide](docs/MCP_INTEGRATION_GUIDE.md) for connection examples and security tips.

---

## 7. Learn more

- Browse the [feature guides](docs/features/) for deep dives into the editor, Bases, graph navigation, and more.
- Visit the [Troubleshooting guide](docs/user-guide/troubleshooting.md) if something doesn’t behave as expected.
- Join the [Discord community](https://discord.gg/lokus) to share setups and request features.

Happy writing!
