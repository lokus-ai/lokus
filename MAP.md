# MAP: this kind of change goes here

> Generated from `parts.json` by `node checks/gen-map.mjs`. Do not edit by hand.
> If a directory is not listed, it is not approved: add a part to `parts.json` first.

| What you are changing | Where it lives | Part |
|---|---|---|
| Pure-Rust engine. No Tauri, no networking. | `crates/lokus-core/` | `core` |
| Open a vault, list the tree, read and write notes atomically, fidelity check. | `crates/lokus-core/src/vault` | `core.vault` |
| The command registry: every core feature is a named command with JSON in and out. | `crates/lokus-core/src/commands` | `core.commands` |
| File watcher: report changes made outside the app. | `crates/lokus-core/src/watch` | `core.watch` |
| The `lokus` binary: run any core command against a real vault. | `crates/lokus-cli/` | `cli` |
| Tauri shell. Thin: forwards commands to the core, owns windows and the dev channel. | `apps/desktop/` | `desktop` |
| App frame: layout, tabs, command palette, quick switcher, design tokens, UI command registry. | `ui/src/shell/`, `ui/src/main` | `ui.shell` |
| The only UI code that talks to Rust, the network, Supabase or PostHog. | `ui/src/bridge/` | `ui.bridge` |
| CodeMirror 6 editor: live preview, auto-pairing, markdown commands. | `ui/src/editor/` | `ui.editor` |
| Sidebar file tree. | `ui/src/features/file-tree/` | `ui.file-tree` |
| Page header: cover, icon, title, properties (stored in frontmatter). | `ui/src/features/page-header/` | `ui.page-header` |
| Login screen and session state. | `ui/src/features/auth/` | `ui.auth` |
| Product analytics events and the opt-out. Never sends note content. | `ui/src/features/analytics/` | `ui.analytics` |
| Scripts that enforce the hard rules. | `checks/` | `checks` |

Every source file starts with its part marker: `//! @part-of <part>` in Rust,
`/** @part-of <part> */` in TypeScript and JavaScript. The longest matching path wins.
