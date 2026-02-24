# Workspace Architecture Overhaul — Design Document

**Date:** 2026-02-23
**Branch:** `refactor/workspace-decomposition`
**Issue:** #422 — Decompose monolithic Workspace.jsx into feature modules with Zustand

---

## Problem Statement

The workspace has four critical bugs rooted in a shared-state monolithic architecture:

1. **Tab cross-contamination** — Single `editorContent` string for all tabs. Save+close race condition writes content to the wrong file.
2. **Slow loading** — 56 Zustand selectors in one component, 7 setState calls per file open (392 selector evaluations), new Set per keystroke.
3. **Split pane crashes** — Two competing split systems sharing global state. Every keystroke in one pane re-renders the entire workspace.
4. **Graph/Bases glitches** — 9 boolean view flags (can all be true simultaneously), graph effects leak after unmount, stale closures in cleanup.

Additionally: 11 main-thread-blocking operations, zero Error Boundaries, lossy md→HTML→md round-trip pipeline, and an unused but complete EditorGroups implementation (381 lines).

---

## Architecture: VSCode-Style Editor Groups

### State Architecture — 4 Independent Zustand Stores

```
useLayoutStore
  showLeft, showRight, leftW, rightW, bottomPanelHeight, bottomPanelTab

useEditorGroupStore
  layout: Tree {
    type: 'group' | 'container'
    if group → { id, tabs[], activeTab, contentByTab: Map<path, TabState> }
    if container → { direction, children[], sizes[] }
  }
  focusedGroupId: string
  globalRecentFiles: string[]

useViewStore
  currentView: 'editor' | 'graph' | 'kanban' | 'bases' | 'calendar' | 'marketplace'
  panels: { commandPalette, inFileSearch, shortcutHelp, templatePicker, ... }

useFileTreeStore
  fileTree[], expandedFolders, selectedPath, selectedPaths,
  creatingItem, renamingPath, refreshId, hoveredFolder, keymap
```

Each group's `contentByTab` entry:

```js
{
  prosemirrorDoc: JSON,   // native editor state — instant restore
  rawMarkdown: string,    // what's on disk (dirty detection)
  scrollY: number,        // scroll position
  cursorPos: number,      // cursor position
  undoStack: JSON,        // undo/redo history
  dirty: boolean,         // unsaved changes
  lastAccessed: number,   // LRU eviction timestamp
}
```

LRU eviction at ~20 cached tabs per group. Evicted tabs reload from disk on next visit.

### Component Decomposition

```
<Workspace path={path}>
  <WorkspaceShell>                        subscribes to: useLayoutStore
    <Toolbar />                           subscribes to: focused group's tabs
    <IconSidebar />                       subscribes to: useViewStore.currentView
    <ErrorBoundary>
      <LeftSidebar />                     subscribes to: useFileTreeStore
    </ErrorBoundary>
    <ErrorBoundary>
      <MainContent />                     subscribes to: useViewStore.currentView
        if editor → <EditorGroupsContainer />
          <ErrorBoundary key={group.id}>
            <EditorGroup />               subscribes to: own group in useEditorGroupStore
          </ErrorBoundary>
        if graph → <ProfessionalGraphView />   MOUNTED ONLY when active
        if kanban → <KanbanBoard />
        if bases → <BasesView />
        if calendar → <CalendarView />
    </ErrorBoundary>
    <ErrorBoundary>
      <RightSidebar />                    subscribes to: useEditorGroupStore (focused group)
    </ErrorBoundary>
    <BottomPanel />
    <ErrorBoundary>
      <ModalLayer />                      subscribes to: useViewStore.panels
    </ErrorBoundary>
  </WorkspaceShell>
  <ShortcutListener />                    operates on focused group
</Workspace>
```

Principles:
- Each component subscribes to 1 store (max 2), ~8 selectors max
- Views are mounted/unmounted, not hidden — no leaked effects
- Each EditorGroup is fully self-contained with its own error boundary
- Crash in one pane does not affect other panes, sidebar, or modals

### Markdown Pipeline — Direct md↔ProseMirror via @tiptap/markdown

**Old pipeline (4 hops, lossy):**
```
LOAD: disk (md) → markdown-it (md→HTML) → TipTap (HTML→ProseMirror)
SAVE: TipTap (ProseMirror→HTML) → MarkdownExporter (HTML→md) → disk
```

**New pipeline (2 hops, direct):**
```
LOAD: disk (md) → @tiptap/markdown (md→ProseMirror doc directly)
SAVE: @tiptap/markdown (ProseMirror doc→md directly) → disk
```

Custom `renderMarkdown` extensions required for 5 node types:
- **WikiLink** → `[[target|alias]]`, `![[image]]`
- **WikiLinkEmbed** → `![[file^blockId]]`
- **Callout** → `> [!type]- Title\n> content`
- **MermaidDiagram** → ` ```mermaid\n{code}\n``` `
- **CanvasLink** → `![[canvas.canvas]]`

Known upstream issue: table serialization (tiptap #5750) — we write our own table serializer.

### Threading Model

```
MAIN THREAD — React renders + user interaction only
  Zustand stores, component renders, input handlers

REFERENCE WORKER (NEW)
  buildIndex() — parallel file reads + regex (batches of 20, not serial)
  findAffectedFiles() — reference scan for rename/move
  searchReferences() — query index

RUST BACKEND (Tauri IPC, async)
  File I/O, session persistence, version history, workspace validation
```

Heavy work removed from main thread:
- MarkdownExporter eliminated entirely (replaced by @tiptap/markdown in-editor)
- MarkdownPaste: singleton compiler at module scope, single isMarkdown call
- ReferenceManager: moved to dedicated worker with parallel batch reads
- PropertyIndexer: batched with requestIdleCallback

### Session Persistence

Extend Rust `SessionState` (non-breaking, backward compatible):

```rust
#[derive(serde::Serialize, serde::Deserialize)]
struct SessionState {
    // Legacy (backward compat)
    open_tabs: Vec<String>,
    expanded_folders: Vec<String>,
    #[serde(default)]
    recent_files: Vec<String>,

    // New
    #[serde(skip_serializing_if = "Option::is_none")]
    editor_layout: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    editor_metadata: Option<HashMap<String, TabMetadata>>,
}
```

`TabMetadata` per tab: `{ scrollTop, cursorPos, selection }` (~200 bytes/tab).

No ProseMirror JSON in session — content loads fresh from disk. Only layout structure + cursor/scroll metadata persisted.

Old sessions without `editor_layout` fall back to a single-group layout constructed from the flat `open_tabs` array.

### Split Pane — Clean Rewrite

Both existing split systems deleted entirely:
- Legacy inline JSX in Workspace.jsx (lines 980-1124)
- SplitEditor.jsx + EditorPane.jsx + useSplitPanes.js

Replaced by EditorGroup tree in `useEditorGroupStore`:
- Drag tab to split zone → `splitGroup(groupId, direction, position, tab)`
- Each group owns its own TipTap editor instance, content cache, save handler
- Typing in group A has zero effect on group B — different store branches, different refs
- Arbitrary N-way splits via recursive container nesting

### View System — Exclusive State Machine

Replace 9 boolean flags with:
```js
currentView: 'editor' | 'graph' | 'kanban' | 'bases' | 'calendar' | 'marketplace'
```

Only one view active at a time. Switching views unmounts the previous view completely. No `showGraphView` + `activeFile='__graph__'` dual-state confusion.

Graph/Bases/Kanban are no longer "tabs" — they are views. The editor group system handles only files.

### Error Boundaries

Every zone gets its own boundary with recovery UI:
- Each `<EditorGroup>` — "This pane crashed — click to recover"
- `<LeftSidebar>` — "Sidebar crashed"
- `<RightSidebar>` — "Panel crashed"
- `<MainContent>` (wrapping view router) — "View crashed"
- `<ModalLayer>` — "Modal crashed"

ProseMirror JSON in the store survives React crashes (store is outside React tree). Recovery remounts the component and restores from cache.

---

## Independence Matrix

| Action | Other tabs? | Other groups? | Sidebar? | Other views? |
|--------|-------------|---------------|----------|--------------|
| Type in editor | No | No | No | N/A |
| Save file | No | No | No | N/A |
| Close tab | No | No | No | N/A |
| Switch tab | No | No | No | N/A |
| Crash in pane | No | No | No | N/A |
| Switch view | No | Groups preserved in store | No | Previous unmounted |
| Resize sidebar | No | No | Own store | No |

---

## What Gets Deleted

- `src/stores/workspace.js` — entire file (replaced by 4 independent stores)
- `src/features/split-view/` — entire directory
- `src/components/SplitEditor/` — entire directory
- `src/core/export/markdown-exporter.js` — replaced by @tiptap/markdown
- `src/core/markdown/compiler-logic.js` — replaced by @tiptap/markdown
- `src/core/markdown/compiler.js` — worker client no longer needed for main pipeline
- `src/core/markdown/markdown.worker.js` — markdown compilation worker no longer needed
- Legacy split view code in Workspace.jsx (lines 980-1124)
- All `showGraphView`, `showKanban`, `showPlugins`, `showBases`, etc. boolean flags

## What Gets Reused

- `src/hooks/useEditorGroups.js` (381 lines) — salvageable, needs Zustand integration
- `src/components/EditorGroupsContainer.jsx` (165 lines) — recursive renderer, ready
- `src/components/EditorGroup.jsx` (196 lines) — needs content cache integration
- `src/features/shortcuts/` — ShortcutListener adapts to focused group
- `src/features/file-tree/` — untouched, just subscribes to useFileTreeStore
- `src/features/workspace/useWorkspaceEvents.js` — adapted for new store
- All Tauri IPC commands — unchanged

## What Gets Created

- `src/stores/layout.js` — layout store
- `src/stores/editorGroups.js` — editor group store (tree + contentByTab)
- `src/stores/views.js` — view state machine + panel state
- `src/stores/fileTree.js` — file tree store
- `src/views/WorkspaceShell.jsx` — CSS grid layout shell
- `src/views/workspace/Toolbar.jsx`
- `src/views/workspace/IconSidebar.jsx`
- `src/views/workspace/LeftSidebar.jsx`
- `src/views/workspace/MainContent.jsx`
- `src/views/workspace/RightSidebar.jsx`
- `src/views/workspace/BottomPanel.jsx`
- `src/views/workspace/ModalLayer.jsx`
- `src/components/ErrorBoundary.jsx` — reusable with recovery UI
- `src/editor/extensions/markdownSerializers.js` — renderMarkdown for 5 custom nodes
- `src/workers/reference.worker.js` — parallel reference index builder
- Extended `SessionState` in `src-tauri/src/lib.rs`
