# WS-F1 — Stop the Bleeding · Report

Branch `lokus-wsf1` · 9 commits (`081d3ad..534587a` + `f5389fd`) · not deployed/released.

## What shipped (one commit per fix)

| # | Fix | Commit | Files |
|---|---|---|---|
| 1 | Fresh-install won't-open: deleted the dead `StoreBuilder().unwrap()` in the setup path, menu/tray init made best-effort (log + continue), tray icon no longer unwraps a missing icon, final guard shows+focuses `main` if no window ended up visible | `081d3ad` | `lib.rs` |
| 2 | Dock reopen + Cmd+Q: `RunEvent::Reopen` shows+focuses a window; quit is a custom menu item routed through `app.exit(0)` so `ExitRequested` distinguishes user quit (`code=Some` → exits) from last-window-close (`code=None` → stays in tray). Secondary `ws-*`/launcher windows now destroy instead of orphaning. Every close/quit path emits `lokus:flush-dirty` first | `42e6ea9` | `lib.rs`, `menu.rs` |
| 3 | Autosave + crash-flush: debounced 1.5 s autosave; per-group EditorState providers let `tabSaver` serialize background tabs; `useAutosaveFlush` flushes all dirty tabs on `lokus:flush-dirty`, `visibilitychange:hidden`, `pagehide` | `7c92172`, `d5f04eb` | `tabSaver.js`, `useAutosaveFlush.js`, `EditorGroup.jsx`, `Workspace.jsx` |
| 4 | One dirty-aware close path: `closeTabWithGuard` — the dirty check previously existed only in a hook that was wired **nowhere**; Cmd+W, titlebar tab X, pane tab X, and the command palette all discarded silently. All routes now go through the guard | `225addd` | `closeGuard.js`, `useShortcuts.js`, `Toolbar.jsx`, `ModalLayer.jsx`, `useTabs.js`, `EditorGroup.jsx` |
| 5 | Sync data-loss: last-write-wins replaced with last-synced-hash three-way diff — two-sided divergence keeps **both** copies (`<name>.conflict-<ts>.<ext>`, uploaded so devices converge); scan-miss requires a positive existence check before deleting (unknown → skip); editor saves and sync are mutually exclusive (`SyncLock` begin/endSave + bounded waits); downloads re-hash local before overwriting (mid-save divergence → conflict copy); `pullWorkspace` seeds the sync cache | `f5389fd` | `ManifestManager.js`, `SyncEngine.js`, `SyncLock.js`, `useSave.js`, `guardedWrite.js` + 2 test files |
| 6 | Binary/large-file corruption: `read_file_content` refuses >10 MB (`FILE_TOO_LARGE`) and NUL-in-first-8KB (`BINARY_FILE`); a failed load marks the tab `loadError` → explicit error panel (not a blank pane), edit-tracking disabled, Cmd+S **and** autosave refuse to write (previously Cmd+S wrote the *previous tab's content* over the original) | `00e4971`, `d5f04eb` | `handlers/files.rs`, `EditorGroup.jsx`, `useSave.js` |
| 7 | Wrong-workspace focus: window label = basename + 8-hex hash of the **full** path (`/work/notes` ≠ `/personal/notes`). No JS depends on the label format (verified) | `8b561c7` | `window_manager.rs` |
| 8 | Build + killer feature (critical path): graphIndex split into pure core + Node adapter (MCP server) + **real Tauri adapter** (renderer, via `read_workspace_files`/`read_file_content` invokes — plugin-fs scopes don't cover arbitrary workspace paths). PR #536's alias mechanism landed but pointed at the real implementation instead of its dead stub. MCP bundles regenerated | `534587a` | `graphIndex{,.core,.tauri}.js`, `vite.config.js`, `mcp-bundle/*` |
| 9 | Looks-broken renders: layout root is always a `container` so the first split no longer remounts every editor (undo/cursor preserved, no reload flash); graph hotkey opens the `__graph__` tab instead of blanking the center; flag-off restored special tabs render a "feature is disabled" panel | `6dc8f14`, `d5f04eb` | `EditorGroupsView.jsx`, `EditorGroupsContainer.jsx`, `useShortcuts.js`, `EditorGroup.jsx` |

## Acceptance — verification status

| Criterion | Status | Evidence |
|---|---|---|
| Fresh install opens a visible window every run; a failing setup step still shows a window | ✅ code-verified | dead unwrap deleted; all fallible setup steps best-effort; unconditional show-guard at setup end. `cargo check` clean |
| Close window → dock reopens; Cmd+Q / File→Quit quits | ✅ code-verified | `Reopen` handler + `code`-conditional `prevent_exit` (semantics confirmed against vendored tauri 2.11.2 source: `app.exit()` → `code=Some`, last-window-destroy → `code=None`) |
| Kill app mid-edit → relaunch recovers the edit | ✅ by design | 1.5 s debounced autosave writes to the real file; flush on hide/close/quit. Residual: a hard kill inside the 1.5 s debounce window can lose ≤1.5 s of typing |
| Closing a dirty tab any way is guarded | ✅ (semantics note) | all 4 paths route through `closeTabWithGuard`. Deliberate deviation: a dirty tab is **saved** on close (autosave semantics — "discard on close" is meaningless when edits autosave every 1.5 s); a prompt appears only if the save fails, defaulting to keep-open. Nothing is ever silently discarded |
| Sync never silently overwrites newer local edits | ✅ code + unit-tested | conflict copies, positive delete signal, save/sync mutual exclusion; 15 new unit tests pass |
| `npm run build` passes; resurfacing panel doesn't throw | ✅ verified | `vite build` exit 0, 0 externalization warnings; ResurfacingProvider 15/15, ContextAssembler 17/17, actionContext 10/10 |
| Split preserves undo + cursor; graph hotkey shows the graph | ✅ code-verified | stable container root (same element types + keys across split); hotkey mirrors the sidebar's add-tab path |

Tests: **810/810** unit tests pass (30 files) incl. 19 new (sync diff/lock 15, graphIndex core 4). `cargo check` clean. `cargo test`: 106 pass, 3 pre-existing failures in untouched platform files (`file_manager_reveal` feature assertions — environment-dependent, present before WS-F1).

## Deferred / residuals (explicit)

- **Manual UI verification not run** (fresh-install boot, dock-click, kill-mid-edit) — code-level verification only; the WS-Q1 e2e harness should prove these on a real build.
- `read_file_content` guard applies to **all** callers of that command (importers, sync text reads) — a >10 MB *text* note would stop syncing/opening. Rare; an editor-only command split belongs in WS-F2's IPC boundary.
- Title-rename on save still only happens on explicit Cmd+S (autosave intentionally never renames files mid-typing).
- Excalidraw/kanban/canvas tabs aren't covered by `tabSaver` (they have their own save paths); a dirty one that can't be auto-saved prompts before close instead.
- A mid-sync divergent download defers reconciliation one cycle (extra conflict copy at worst, never a discard).
- `vault-actions.js`→`notes.js` still imports `fs/promises` but is tree-shaken (nothing in the browser graph imports it). If WS-A1 wires it into the renderer it needs the graphIndex treatment.
- `useSplitPanes.js` and other dead close paths untouched (WS-H1 deletes them).
