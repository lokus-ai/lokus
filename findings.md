# Workspace Architecture Findings

## Investigation Date: 2026-02-23

## Bug 1: Tab Content Cross-Contamination
- **Root cause**: Single `editorContent`/`savedContent` in store for ALL tabs (workspace.js:337-338)
- **Race**: handleSave snapshots stale `activeFile`, closeTab switches `activeFile` synchronously before save's async IPC resolves (useSave.js:13, useTabs.js:169)
- **Dead code**: `onSave` param in useTabs is never called (useTabs.js:10)
- **No abort guard** in save path after async write (useSave.js:42-46)

## Bug 2: Slow Loading
- **56 Zustand selectors** in WorkspaceWithScope, each fires on ANY store change (Workspace.jsx:153-304)
- **7 separate setState calls** to open one file = 7 × 56 = 392 selector evals (useWorkspaceSession.js:210-231)
- **Double worker IPC**: isMarkdown + compile as 2 round-trips instead of 1 (useWorkspaceSession.js:224-225)
- **New Set() every keystroke** for unsavedChanges = 56 selector evals per keystroke (workspace.js:241)
- **3 synchronous tree traversals** on workspace load (useWorkspaceSession.js:159-188)

## Bug 3: Split Pane Crashes
- **Right pane writes to global store** on every keystroke → full workspace re-render (Workspace.jsx:1113)
- **Both panes overwrite same editor ref** (Workspace.jsx:1010 + 1114)
- **EditorPane feedback loop**: useEffect on editorContent resets TipTap cursor (EditorPane.jsx:41-48)
- **Two competing split systems** coexist — legacy JSX + SplitEditor.jsx

## Bug 4: Graph/Bases View Glitches
- **Dual state**: `showGraphView` boolean vs `activeFile='__graph__'` tab, never synced (workspace.js:125-158, useGraphEngine.js:100-115)
- **Stale closure in cleanup**: graphDataManager is null when cleanup runs → leaks 4 listeners + ResizeObserver (ProfessionalGraphView.jsx:112-166)
- **`isVisible={true}` hardcoded**: graph reload effect fires on every file-tree change even when hidden (Workspace.jsx:1192)

## Existing Editor Groups Infrastructure (Unused)
- `src/hooks/useEditorGroups.js` (381 lines) — complete VSCode-style tree layout, split ops, drag-drop
- `src/components/EditorGroupsContainer.jsx` (165 lines) — recursive renderer with resize
- `src/components/EditorGroup.jsx` (196 lines) — individual group UI
- Instantiated at Workspace.jsx:198 but NEVER rendered. Output ignored.
- Only active usage: `updateTabPath` for file rename (Workspace.jsx:946)
- Gaps: local state duplication, no session persistence, no Zustand integration

## Main Thread Blocking (11 findings)
- **HIGH**: MarkdownPaste.js:43 — `new MarkdownCompiler()` on every paste event (sync, main thread)
- **HIGH**: useSave.js:38 + markdown-exporter.js — sync DOM parse + recursive walk on every Ctrl+S
- **HIGH**: ReferenceManager.js:215 — serial readTextFile + 4 regex scans per file on load (500 files = 500 sequential IPC calls)
- **MEDIUM**: useEditorContent.js:28 — `compiler.compile()` not awaited (returns Promise object, not HTML)
- **MEDIUM**: PropertyIndexer.js:122 — JSON.stringify per-property in O(n^2) hot loop
- **MEDIUM**: useWorkspaceEvents.js:128 — 3 non-cancelling setTimeouts doing querySelectorAll on all headings
- **MEDIUM**: Workspace.jsx:1639 — compiler.processTemplate() not awaited (inserts "[object Promise]")
- **MEDIUM**: TemplatePicker.jsx:16 — imports sync MarkdownCompiler instead of worker client

## tiptap-markdown Assessment
- `tiptap-markdown` (community) — DEPRECATED, maintainer says use official
- `@tiptap/markdown` (official) — v3.20.0, explicitly beta, tables broken (issue #5750)
- App has 5 custom node types needing serializers: WikiLink, WikiLinkEmbed, Callout, MermaidDiagram, CanvasLink
- App has 26 total TipTap extensions, only 5 affect schema
- Current MarkdownExporter (650 lines) already handles all custom nodes including 23 SmartTask states
- **Verdict**: Keep current md pipeline for this overhaul. Direct md↔ProseMirror is a future initiative.

## Session Persistence Assessment
- Current: Rust `SessionState` struct with `open_tabs: Vec<String>`, `expanded_folders`, `recent_files`
- Storage: `tauri_plugin_store` (SQLite-backed), keyed by `session_state_{hash(workspace_path)}`
- **New layout is a SIMPLE EXTENSION**: add optional `editor_layout: Option<serde_json::Value>` field
- Zero new Tauri commands needed — serde auto-serializes
- Backward compatible: old sessions fall back to single-group layout
- Do NOT store ProseMirror JSON in session (2-5x larger than source md, goes stale)
- Store only: layout tree + lightweight metadata (scrollTop, selection per tab)
