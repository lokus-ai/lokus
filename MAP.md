# MAP: this kind of change goes here

> Generated from `parts.json` by `node checks/gen-map.mjs`. Do not edit by hand.
> If a directory is not listed, it is not approved: add a part to `parts.json` first.

| What you are changing | Where it lives | Part |
|---|---|---|
| Pure-Rust engine. No Tauri, no networking. | `crates/lokus-core/` | `core` |
| Open a vault, list the tree, read and write notes atomically, fidelity check. | `crates/lokus-core/src/vault` | `core.vault` |
| The command registry: every core feature is a named command with JSON in and out. | `crates/lokus-core/src/commands` | `core.commands` |
| Disposable SQLite index: full-text search, links, backlinks, graph, tags. | `crates/lokus-core/src/index` | `core.index` |
| Read and change a note's properties without touching the rest of the file. | `crates/lokus-core/src/frontmatter` | `core.frontmatter` |
| Plugins installed in a vault: manifests, install, enable, stored data, and the files served to plugin frames. | `crates/lokus-core/src/plugins` | `core.plugins` |
| File watcher: report changes made outside the app. | `crates/lokus-core/src/watch` | `core.watch` |
| Sync engine: keeps a vault's files and their CRDT documents in step and talks to the relay. | `crates/lokus-sync/` | `sync` |
| The relay: accounts' workspaces, roles, invites, the update log and live fan-out. | `crates/lokus-server/` | `server` |
| The assistant: provider calls with the user's own key, vault tools, MCP tool servers. Keys live in the OS keychain. | `crates/lokus-ai/` | `ai` |
| The `lokus` binary: run any core command against a real vault. | `crates/lokus-cli/` | `cli` |
| Tauri shell. Thin: forwards commands to the core, owns windows and the dev channel. | `apps/desktop/` | `desktop` |
| App frame: layout, tabs, command palette, quick switcher, design tokens, UI command registry. | `ui/src/shell/`, `ui/src/main` | `ui.shell` |
| The only UI code that talks to Rust, the network, Supabase or PostHog. | `ui/src/bridge/` | `ui.bridge` |
| CodeMirror 6 editor: live preview, auto-pairing, markdown commands. | `ui/src/editor/` | `ui.editor` |
| Sidebar file tree. | `ui/src/features/file-tree/` | `ui.file-tree` |
| Page header: cover, icon, title, properties (stored in frontmatter). | `ui/src/features/page-header/` | `ui.page-header` |
| Full-text search palette. | `ui/src/features/search/` | `ui.search` |
| Linked mentions under a note. | `ui/src/features/backlinks/` | `ui.backlinks` |
| Graph of notes and links. Loaded only when opened. | `ui/src/features/graph/` | `ui.graph` |
| Table and board views over the notes in a folder, driven by their properties. | `ui/src/features/database/` | `ui.database` |
| Plugin host: runs each plugin in a sandboxed frame and checks every request against its permissions. | `ui/src/features/plugins/` | `ui.plugins` |
| Assistant panel: the conversation, tool activity, and allowing or declining changes. | `ui/src/features/ai/` | `ui.ai` |
| Settings page: appearance, assistant, plugins, privacy. Loaded only when opened. | `ui/src/features/settings/` | `ui.settings` |
| Team workspaces: connect, create, join, members, invites. | `ui/src/features/teams/` | `ui.teams` |
| Login screen and session state. | `ui/src/features/auth/` | `ui.auth` |
| Product analytics events and the opt-out. Never sends note content. | `ui/src/features/analytics/` | `ui.analytics` |
| Scripts that enforce the hard rules. | `checks/` | `checks` |

Every source file starts with its part marker: `//! @part-of <part>` in Rust,
`/** @part-of <part> */` in TypeScript and JavaScript. The longest matching path wins.
