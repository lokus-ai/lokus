# Lokus design

One living document. It describes the system as it is designed today and is edited in place;
there are no amendments. Why a choice was made, and who made it, is in
[`decisions.md`](./decisions.md).

Status words used below: **built** (in this branch and runnable), **building** (the current
slice), **planned** (designed, no code).

## 1. Goal

A notes app for teams that feels like Notion and Obsidian together: plain markdown files on your
disk, a fast live-preview editor, and real-time collaboration. Local-first: every device has a
full copy and works offline; the server is where devices meet. Light and quick, without giving
up features or UX to get there.

This is a ground-up rewrite. The previous app is kept at tag `v1-legacy` for reference only;
none of its code is carried over.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Tauri 2 | One Rust codebase for macOS, Windows, Linux, iOS and Android; uses the system webview |
| Logic | Pure-Rust `lokus-core` | Files, index, search, links and sync live here; no Tauri and no networking inside it |
| UI | React + TypeScript | A view layer only: it renders and sends commands |
| Editor | CodeMirror 6 | The markdown text is the document, so saving cannot corrupt a file; gives live preview |
| Collaboration | Yjs in the editor, `yrs` in Rust | Same format on both sides; offline merge and live cursors |
| Server | Supabase (auth, Postgres, storage) + one Rust websocket relay | Supabase alone cannot relay durable edits |
| Analytics | PostHog | Product events only, with an opt-out; note content is never sent |

## 3. Repo layout

```text
crates/
  lokus-core/     vault, commands, watcher; later index, search, links   (building)
  lokus-cli/      the `lokus` binary: run core commands on a real vault  (building)
  lokus-sync/     CRDT documents, local update store, sync client         (planned)
  lokus-server/   websocket relay, roles, persistence                     (planned)
apps/
  desktop/        Tauri shell: thin, forwards commands                    (building)
  mobile/         the same shell on mobile targets                        (planned)
ui/src/
  bridge/         the only code that calls Rust, the network, Supabase or PostHog
  shell/          layout, tabs, command palette, quick switcher, tokens
  editor/         CodeMirror extensions
  features/       one folder per feature (file-tree, page-header, auth, analytics, ...)
checks/           the scripts that enforce the hard rules
docs/             this file and the decision log
parts.json        which part owns which folder; MAP.md is generated from it
```

## 4. Data pipeline

1. A keystroke becomes a CRDT update in the editor.
2. The core stores the update in local SQLite and writes the plain `.md` file shortly after.
3. The core updates the search index and the link and backlink index.
4. The sync client sends the update over a websocket; the relay stores it and fans it out.
5. Other devices apply it and rewrite their `.md` file.

Today (**building**): steps 1 to 2 without the CRDT. The editor holds the text, the core writes
it atomically (temp file, then rename), and a watcher reports outside changes. Steps 3 to 5 are
**planned**.

The vault is plain markdown. Page cover, icon and properties live in YAML frontmatter, so a note
is still a normal file in any other editor. App state lives in `.lokus/` inside the vault.

## 5. Commands, and how we test

Every feature is a named command with JSON in and JSON out: `note.create`, `vault.tree`,
`editor.toggleBold`, `team.invite`. The same commands power the command palette, keyboard
shortcuts, plugins and AI tools.

- **Core commands** are registered in `lokus-core`. The Tauri shell exposes a single `run`
  entry that forwards to that registry.
- **UI commands** (editor and shell actions) are registered in the UI.
- **`lokus` CLI** runs any core command against a real vault:
  `lokus note.read --vault ~/notes '{"path":"Welcome.md"}'`.
- **Dev channel** (debug builds only): a unix socket in the running app that runs any command,
  core or UI, and returns the real result.

Testing is running real commands on real files and checking the real result, plus a small set of
scripted flows. We do not write piles of generated unit tests. The one always-on check is
fidelity: `vault.fidelity` reads and rewrites every note in a deliberately nasty fixture vault
and fails unless every file is byte-identical.

## 6. Sync and the server (built, M3)

As built: the relay stores its log in one SQLite file (not Postgres), so it runs as a single
binary or container with a volume. `lokus-sync` holds the engine and the connection; the app's
editor binds to a Yjs document and passes updates to the engine, which writes the file. Two
scripted flows exercise it: `checks/flows/sync-devices.sh` and `checks/flows/live-coedit.sh`.
The paragraphs below are the original plan and still describe the intent.

Client-server; no peer-to-peer.

| Piece | Does | Built on |
|---|---|---|
| Accounts | Sign-up, login, sessions | Supabase Auth |
| Database | Users, workspaces, members, roles, invites; each note's update log and snapshots | Supabase Postgres |
| Relay | One websocket per device; relays edits, saves them, checks the role | Our own small Rust service (axum + `yrs`) |
| Attachments | Images, PDFs, other files | Supabase Storage with signed links |

- We write the relay. Existing servers were checked on 2026-11-12: Y-Sweet has stalled, the Rust
  websocket helper crates lag `yrs`, and the maintained ones are Node, Cloudflare-only or need
  Redis.
- A device connects with its Supabase token; the relay verifies it against Supabase's public
  keys and looks up the workspace role **once per connection**, not per edit.
- Device and relay exchange state vectors and send only what the other is missing. After that
  edits are relayed live and appended in batches.
- Storage: `doc_updates(doc_id, seq, update, user_id, created_at)` plus
  `doc_snapshots(doc_id, upto_seq, state, state_vector)`, compacted every N updates or when the
  last device leaves. Version history is periodic markdown snapshots.
- Cursors and presence pass through memory and are never stored.
- Roles: owner, editor, viewer per workspace. Per-folder permissions come later.
- A personal vault is local-only by default. Turning sync on makes it a one-person workspace on
  the same pipeline.

### Keeping `.md` files and the CRDT in step

The hardest part. Rules, taken from the Obsidian plugin Relay, which hit these bugs first:

1. A file's content enters the CRDT exactly once; after that only minimal diffs are applied.
   Never delete-all and reinsert.
2. Never write to disk while the note is open in the editor.
3. An outside change is three-way merged against the last synced text. A true conflict becomes a
   conflict file.
4. Do not publish local files until the first server sync completes, or stale devices bring
   deleted notes back.
5. Normalise line endings for diffing only; the file on disk keeps its own.

## 7. Plugins (planned, after M3)

The app's own features use the same command and contribution system, so the API is exercised
from M1.

- **Isolation:** each plugin runs in a sandboxed, null-origin iframe and talks to the app through
  a small typed message API. The host checks the manifest's permissions on every call. No direct
  access to the main window, Tauri or the filesystem.
- **Five contribution types:** commands; editor behaviour (decorations, completions, shortcuts,
  described as data, never raw CodeMirror); views (a sidebar or panel is the plugin's own frame);
  settings (a schema the app renders); AI tools (MCP servers).
- **Manifest:**

  ```json
  { "id": "", "version": "", "apiVersion": 1, "main": "main.js",
    "permissions": ["vault:read", "vault:write", "net:api.example.com"],
    "contributes": { "commands": [], "views": [], "settings": {}, "editor": {}, "mcpServers": [] },
    "activation": ["onCommand:x", "onView:y"] }
  ```

- One API and one integer `apiVersion`. No second "trusted" tier.
- Not in the first version: raw editor or DOM access, a plugin CLI, a marketplace (install from a
  URL or folder), plugin-to-plugin calls.

## 8. AI and MCP (planned)

- **Bring your own key first.** Keys live in the OS keychain; every provider call is made from
  Rust, so the UI and plugins never see a key.
- **MCP:** the core owns the client (official Rust SDK), the logins and the tokens, built against
  the 2026-07-28 spec only. Plugins declare which servers they want. Notion's hosted server needs
  no app registration; Slack's requires a published Slack app.
- **Sign in with ChatGPT** exists for open-source, locally run apps. Check the terms before
  promising it; it follows bring-your-own-key.

## 9. UI and design tokens (building)

Tokens are set before screens are built, and every component reads them.

- **Type:** Inter for UI; 16px body at 1.5; 40px page title; editor font switchable between sans,
  serif and mono.
- **Layout:** 720px reading column; sidebar 248px; 28px rows on desktop, 44px on mobile; cover
  240px with a 72px icon overlapping its bottom edge.
- **Surfaces:** slightly warm neutrals, 1px low-contrast borders, layered soft shadows on
  popovers. Radii 4, 6, 8, 12.
- **Colour:** one accent, used only for primary buttons, links, focus and selection.
- **Motion:** 80ms hovers, 140ms menus, 220ms dialogs. Typing and the caret are never animated.
  Honour reduced-motion.
- **Patterns:** chrome that appears on hover; a slash menu showing the markdown shortcut; share
  as a popover; search with a preview pane; settings as a full page.

Most of the reference numbers were estimated from screenshots, so they are a starting point to
tune by eye in the real app.

## 10. Security

Basic and unbloated for now: TLS, Supabase login tokens, workspace roles enforced on the server,
provider encryption at rest. No end-to-end encryption; the server can read content, which is what
later allows web access, share links and server-side search. Advanced security is added when it
is needed.

## 11. Milestones

| # | Slice | Done when | Status |
|---|---|---|---|
| M0 | Skeleton, rules, checks, CI | The empty app builds and the checks pass | built |
| M1 | Single-player editor, file tree, tabs, quick switcher, login, analytics | A real vault opens and saves byte-identical | built (login and analytics not yet tried against the real services) |
| M2 | Search, backlinks, graph, slash menu, embeds | Usable as a daily driver | built |
| M3 | Relay, teams, invites, roles, live cursors, offline merge | Two devices editing one note converge | built and checked locally; not deployed, and real logins are untested |
| M4 | iOS and Android | Builds in TestFlight and the Play internal track | planned |
| M5 | Databases and kanban | Query engine with new UI | planned |

Then plugins, AI and MCP.

## 12. Risks

1. **Mobile keyboard in Tauri.** Open bugs push the webview off screen on iOS and behave
   inconsistently on Android. Prototype during M1, not M4.
2. **Deletes and renames across devices.** Where Relay had most of its bugs.
3. **Three-way merge on large notes** can stall the UI; it runs in Rust, off the UI thread.

## 13. Cut from the rewrite

Calendar, Gmail, MathGraph, the terminal panel, the old templates engine, the old plugin system,
end-to-end encrypted team sync, and the manifest-based personal sync. Existing users of the old
sync get a sunset notice; their notes are plain files and are unaffected.
