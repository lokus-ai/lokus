# Workspace.jsx Decomposition Design

**Date**: 2026-02-22
**Goal**: Break down the 6000-line monolithic Workspace.jsx into self-contained feature modules with Zustand state management.
**Approach**: Feature-Folder Architecture with Zustand store slices.

## Decisions

- **State management**: Zustand (single store, 8 slices)
- **Language**: Stay JSX (no TypeScript migration)
- **Scope**: Full restructure into `src/features/` folders
- **Existing code**: Components in `src/components/` stay in place; feature folders wrap them

## Current State

Workspace.jsx contains:
- 67 useState hooks
- 35+ useEffect hooks
- 13+ useRef hooks
- 30+ useCallback hooks
- 50+ Tauri event listeners
- 10+ window event listeners
- 25+ integrated components
- 5,997 lines

## Zustand Store Architecture

Single store at `src/stores/workspace.js` with 8 slices:

### 1. `tabs` slice
**State**: `openTabs`, `activeFile`, `unsavedChanges` (Set), `recentlyClosedTabs`, `recentFiles`
**Actions**: `openTab(path, name)`, `closeTab(path)`, `switchTab(path)`, `reopenClosed()`, `markUnsaved(path)`, `markSaved(path)`, `updateTabName(oldPath, newPath)`

### 2. `fileTree` slice
**State**: `fileTree`, `expandedFolders` (Set), `selectedPath`, `selectedPaths` (Set), `creatingItem`, `renamingPath`, `refreshId`
**Actions**: `refreshTree()`, `toggleFolder(path)`, `closeAllFolders()`, `selectEntry(path)`, `selectMultiple(paths)`, `startCreate(type, targetPath)`, `startRename(path)`, `cancelCreate()`, `cancelRename()`

### 3. `editor` slice
**State**: `editorContent`, `savedContent`, `editorTitle`, `isLoadingContent`
**Actions**: `loadFile(path, workspacePath)`, `setContent(html)`, `setSavedContent(html)`, `setTitle(name)`, `setLoading(bool)`

### 4. `layout` slice
**State**: `showLeft`, `showRight`, `leftW`, `rightW`, `bottomPanelHeight`, `bottomPanelTab`
**Actions**: `toggleLeft()`, `toggleRight()`, `setLeftW(px)`, `setRightW(px)`, `setBottomHeight(px)`, `setBottomTab(name)`

### 5. `panels` slice
**State**: `showCommandPalette`, `showInFileSearch`, `showShortcutHelp`, `showTemplatePicker`, `templatePickerData`, `showCreateTemplate`, `createTemplateContent`, `showGlobalSearch`, `showTagModal`, `tagModalFile`, `showAboutDialog`, `selectedFileForCompare`, `showDatePickerModal`, `currentDailyNoteDate`, `referenceUpdateModal`, `showVersionHistory`, `versionHistoryFile`, `canvasPreview`
**Actions**: `openPanel(name, data?)`, `closePanel(name)`, `togglePanel(name)`

### 6. `graph` slice
**State**: `graphData`, `isLoadingGraph`, `graphSidebarData`
**Actions**: `buildGraph(workspacePath)`, `updateGraphNode(path, content)`, `setGraphSidebar(data)`, `selectNode(node)`

### 7. `splitView` slice
**State**: `useSplitView`, `splitDirection`, `leftPaneSize`, `rightPaneFile`, `rightPaneContent`, `rightPaneTitle`, `syncScrolling`, `draggedTabForSplit`, `splitInitData`
**Actions**: `toggleSplit()`, `toggleDirection()`, `setPaneSize(pct)`, `resetPaneSize()`, `openInSplit(path)`, `setSyncScrolling(bool)`

### 8. `views` slice
**State**: `currentView`, `showGraphView`, `showKanban`, `showPlugins`, `showBases`, `showMarketplace`, `showCalendarPanel`, `showDailyNotesPanel`, `showTerminalPanel`, `showOutputPanel`
**Actions**: `switchView(name)`, `toggleView(name)`, `closeAllViews()`

## Feature Folder Structure

```
src/
├── stores/
│   └── workspace.js                   # Combined Zustand store (all 8 slices)
│
├── features/
│   ├── workspace/                     # Thin shell (~150 lines)
│   │   ├── Workspace.jsx              # Composes all features, renders layout grid
│   │   ├── WorkspaceProviders.jsx     # DndContext, FolderScope, Bases, etc.
│   │   └── WorkspaceLayout.jsx        # 3-column CSS grid
│   │
│   ├── file-tree/
│   │   ├── FileTreePanel.jsx          # Left sidebar container
│   │   ├── FileTreeHeader.jsx         # Search, create buttons, breadcrumbs
│   │   ├── FileEntry.jsx              # Single file/folder row (draggable)
│   │   ├── NewItemInput.jsx           # Inline create input (from Workspace line 273)
│   │   ├── hooks/
│   │   │   ├── useFileOperations.js   # create, rename, delete, duplicate, reveal
│   │   │   ├── useFileDragDrop.js     # DnD kit integration
│   │   │   └── useFileTree.js         # Tree building, expand/collapse, refresh
│   │   └── index.js
│   │
│   ├── tabs/
│   │   ├── TabBarContainer.jsx        # Wraps ResponsiveTabBar with store
│   │   ├── hooks/
│   │   │   └── useTabs.js             # open, close, switch, reopen, max limit
│   │   └── index.js
│   │
│   ├── editor/
│   │   ├── EditorContainer.jsx        # Wraps TipTap Editor
│   │   ├── EditorModeSwitcher.jsx     # Extract from Workspace line 105
│   │   ├── hooks/
│   │   │   ├── useEditorContent.js    # Load file, track changes
│   │   │   ├── useSave.js             # Save, save-as, auto-save
│   │   │   └── useVersionTracking.js  # Version history
│   │   └── index.js
│   │
│   ├── shortcuts/
│   │   ├── ShortcutListener.jsx       # Headless component, all 50+ listeners
│   │   ├── hooks/
│   │   │   └── useShortcuts.js        # Maps Tauri events to store actions
│   │   └── index.js
│   │
│   ├── graph/
│   │   ├── GraphPanel.jsx             # Graph view container
│   │   ├── hooks/
│   │   │   └── useGraphEngine.js      # Initialize, build, update
│   │   └── index.js
│   │
│   ├── split-view/
│   │   ├── SplitViewContainer.jsx     # Wraps SplitEditor
│   │   ├── hooks/
│   │   │   └── useSplitView.js        # Toggle, resize, scroll sync
│   │   └── index.js
│   │
│   ├── panels/
│   │   ├── PanelContainer.jsx         # Right sidebar
│   │   ├── BottomPanelContainer.jsx   # Terminal + output
│   │   ├── ModalContainer.jsx         # All modals
│   │   ├── hooks/
│   │   │   └── usePanels.js           # Open/close/toggle
│   │   └── index.js
│   │
│   └── layout/
│       ├── hooks/
│       │   ├── useColumnResize.js     # Extract useDragColumns
│       │   └── useBottomPanelResize.js
│       └── index.js
│
├── views/
│   └── Workspace.jsx                  # Re-export from features/workspace/
```

## Data Flow

### Before (current):
```
Workspace.jsx (6000 lines)
├── 67 useState → prop drill to 25+ children
├── 35 useEffect → side effects mixed with rendering
└── Everything re-renders on any state change
```

### After:
```
Zustand Store (workspace.js)
├── tabs slice ← TabBarContainer subscribes
├── fileTree slice ← FileTreePanel subscribes
├── editor slice ← EditorContainer subscribes
├── layout slice ← WorkspaceLayout subscribes
├── panels slice ← ModalContainer, PanelContainer subscribe
├── graph slice ← GraphPanel subscribes
├── splitView slice ← SplitViewContainer subscribes
└── views slice ← Workspace shell subscribes

Each component ONLY re-renders when its slice changes.
```

### Cross-feature communication (via store actions):
- File open in tree → `tabs.openTab()` + `editor.loadFile()`
- Tab switch → `tabs.switchTab()` + `editor.loadFile()`
- File rename → `fileTree.startRename()` → on confirm → `tabs.updateTabName()`
- Save → `editor.savedContent = editorContent` + `tabs.markSaved()`
- Graph rebuild → triggered by `editor` save, reads `fileTree` data

## Migration Strategy

Incremental, feature-by-feature. Each step produces a working app:

1. **Install Zustand** + create empty store skeleton
2. **Extract layout slice** (simplest, no cross-feature deps)
3. **Extract panels slice** (15 booleans, straightforward)
4. **Extract views slice** (view toggles)
5. **Extract tabs slice** (moderate complexity)
6. **Extract fileTree slice** (depends on tabs for "open file")
7. **Extract editor slice** (depends on tabs for activeFile)
8. **Extract splitView slice** (depends on editor)
9. **Extract graph slice** (depends on editor for content)
10. **Extract shortcuts** (depends on all other slices — last)
11. **Create feature folder structure** and move files
12. **Final Workspace.jsx** becomes thin composition shell

Each step: extract state + effects + callbacks → into store + hook + component → verify app still works.

## Testing Strategy

- Each hook gets unit tests with Vitest
- Store slices tested independently with Zustand's vanilla API
- Integration: existing E2E tests must still pass after each step
- No new E2E tests needed — this is a refactor, not new features

## Risk Mitigation

- **Working on a git worktree** — isolated branch, main stays clean
- **Incremental migration** — app works after every step
- **No behavior changes** — pure structural refactor
- **Existing tests** as regression safety net
