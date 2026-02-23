# Workspace.jsx Decomposition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break the 6000-line monolithic Workspace.jsx into self-contained feature modules with Zustand state management.

**Architecture:** Feature-folder structure under `src/features/` with a single Zustand store split into 8 slices. Each feature owns its store slice, hooks, and components. Workspace.jsx becomes a ~150-line composition shell.

**Tech Stack:** React 19, Zustand 5, Vite 7, Tauri 2.0, Vitest

**Design Doc:** `docs/plans/2026-02-22-workspace-refactor-design.md`

---

## Phase 1: Foundation (Store + Layout)

### Task 1: Install Zustand and Create Store Skeleton

**Files:**
- Modify: `package.json`
- Create: `src/stores/workspace.js`

**Step 1: Install Zustand**

Run: `npm install zustand`

**Step 2: Create the store with all 8 slice stubs**

Create `src/stores/workspace.js`:

```javascript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// --- Layout Slice ---
const createLayoutSlice = (set) => ({
  showLeft: true,
  showRight: true,
  leftW: 280,
  rightW: 280,
  bottomPanelHeight: 250,
  bottomPanelTab: 'terminal',

  toggleLeft: () => set((s) => ({ showLeft: !s.showLeft })),
  toggleRight: () => set((s) => ({ showRight: !s.showRight })),
  setLeftW: (px) => set({ leftW: px }),
  setRightW: (px) => set({ rightW: px }),
  setBottomHeight: (px) => set({ bottomPanelHeight: px }),
  setBottomTab: (tab) => set({ bottomPanelTab: tab }),
});

// --- Panels Slice ---
const createPanelsSlice = (set) => ({
  showCommandPalette: false,
  showInFileSearch: false,
  showShortcutHelp: false,
  showTemplatePicker: false,
  templatePickerData: null,
  showCreateTemplate: false,
  createTemplateContent: '',
  showGlobalSearch: false,
  showTagModal: false,
  tagModalFile: null,
  showAboutDialog: false,
  selectedFileForCompare: null,
  showDatePickerModal: false,
  currentDailyNoteDate: null,
  showVersionHistory: false,
  versionHistoryFile: null,
  canvasPreview: null,
  referenceUpdateModal: {
    isOpen: false,
    oldPath: null,
    newPath: null,
    affectedFiles: [],
    isProcessing: false,
    result: null,
    pendingOperation: null,
  },

  openPanel: (name, data) => set((s) => ({ [name]: true, ...(data || {}) })),
  closePanel: (name) => set({ [name]: false }),
  togglePanel: (name) => set((s) => ({ [name]: !s[name] })),
  setReferenceUpdateModal: (modal) => set({ referenceUpdateModal: modal }),
});

// --- Views Slice ---
const createViewsSlice = (set) => ({
  currentView: 'editor',
  showGraphView: false,
  showKanban: false,
  showPlugins: false,
  showBases: false,
  showMarketplace: false,
  showCalendarPanel: false,
  showDailyNotesPanel: false,
  showTerminalPanel: false,
  showOutputPanel: false,

  switchView: (view) => set({ currentView: view }),
  toggleView: (name) => set((s) => ({ [name]: !s[name] })),
  closeAllViews: () => set({
    showGraphView: false,
    showKanban: false,
    showPlugins: false,
    showBases: false,
    showMarketplace: false,
    showCalendarPanel: false,
    showDailyNotesPanel: false,
    showTerminalPanel: false,
    showOutputPanel: false,
  }),
});

// --- Tabs Slice ---
const createTabsSlice = (set, get) => ({
  openTabs: [],
  activeFile: null,
  unsavedChanges: new Set(),
  recentlyClosedTabs: [],
  recentFiles: [],

  openTab: (path, name) => {
    const { openTabs } = get();
    const exists = openTabs.find((t) => t.path === path);
    if (exists) {
      set({ activeFile: path });
      return;
    }
    const MAX_OPEN_TABS = 10;
    let newTabs = [...openTabs, { path, name }];
    if (newTabs.length > MAX_OPEN_TABS) {
      newTabs = newTabs.slice(newTabs.length - MAX_OPEN_TABS);
    }
    set({ openTabs: newTabs, activeFile: path });
  },

  closeTab: (path) => {
    const { openTabs, activeFile, recentlyClosedTabs } = get();
    const tab = openTabs.find((t) => t.path === path);
    const newTabs = openTabs.filter((t) => t.path !== path);
    let newActive = activeFile;
    if (activeFile === path) {
      const idx = openTabs.findIndex((t) => t.path === path);
      newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.path || null;
    }
    set({
      openTabs: newTabs,
      activeFile: newActive,
      recentlyClosedTabs: tab
        ? [tab, ...recentlyClosedTabs].slice(0, 20)
        : recentlyClosedTabs,
    });
  },

  switchTab: (path) => set({ activeFile: path }),

  reopenClosed: () => {
    const { recentlyClosedTabs } = get();
    if (recentlyClosedTabs.length === 0) return;
    const [tab, ...rest] = recentlyClosedTabs;
    set({ recentlyClosedTabs: rest });
    get().openTab(tab.path, tab.name);
  },

  markUnsaved: (path) =>
    set((s) => {
      const next = new Set(s.unsavedChanges);
      next.add(path);
      return { unsavedChanges: next };
    }),

  markSaved: (path) =>
    set((s) => {
      const next = new Set(s.unsavedChanges);
      next.delete(path);
      return { unsavedChanges: next };
    }),

  updateTabName: (oldPath, newPath) => {
    const newName = newPath.split('/').pop();
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === oldPath ? { path: newPath, name: newName } : t
      ),
      activeFile: s.activeFile === oldPath ? newPath : s.activeFile,
    }));
  },

  addRecentFile: (path) =>
    set((s) => ({
      recentFiles: [path, ...s.recentFiles.filter((f) => f !== path)].slice(0, 5),
    })),
});

// --- FileTree Slice ---
const createFileTreeSlice = (set) => ({
  fileTree: [],
  expandedFolders: new Set(),
  selectedPath: null,
  selectedPaths: new Set(),
  creatingItem: null,
  renamingPath: null,
  refreshId: 0,

  setFileTree: (tree) => set({ fileTree: tree }),
  toggleFolder: (path) =>
    set((s) => {
      const next = new Set(s.expandedFolders);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedFolders: next };
    }),
  closeAllFolders: () => set({ expandedFolders: new Set() }),
  selectEntry: (path) => set({ selectedPath: path }),
  selectMultiple: (paths) => set({ selectedPaths: new Set(paths) }),
  startCreate: (type, targetPath) => set({ creatingItem: { type, targetPath } }),
  cancelCreate: () => set({ creatingItem: null }),
  startRename: (path) => set({ renamingPath: path }),
  cancelRename: () => set({ renamingPath: null }),
  refreshTree: () => set((s) => ({ refreshId: s.refreshId + 1 })),
});

// --- Editor Slice ---
const createEditorSlice = (set) => ({
  editorContent: '',
  savedContent: '',
  editorTitle: '',
  isLoadingContent: false,
  editor: null,

  setContent: (html) => set({ editorContent: html }),
  setSavedContent: (html) => set({ savedContent: html }),
  setTitle: (name) => set({ editorTitle: name }),
  setLoading: (bool) => set({ isLoadingContent: bool }),
  setEditor: (editor) => set({ editor }),
});

// --- SplitView Slice ---
const createSplitViewSlice = (set) => ({
  useSplitView: false,
  splitDirection: 'vertical',
  leftPaneSize: 50,
  rightPaneFile: null,
  rightPaneContent: '',
  rightPaneTitle: '',
  syncScrolling: false,
  draggedTabForSplit: null,
  splitInitData: null,

  toggleSplit: () => set((s) => ({ useSplitView: !s.useSplitView })),
  toggleDirection: () =>
    set((s) => ({
      splitDirection: s.splitDirection === 'vertical' ? 'horizontal' : 'vertical',
    })),
  setPaneSize: (pct) => set({ leftPaneSize: pct }),
  resetPaneSize: () => set({ leftPaneSize: 50 }),
  openInSplit: (path, content, title) =>
    set({ useSplitView: true, rightPaneFile: path, rightPaneContent: content, rightPaneTitle: title }),
  setSyncScrolling: (bool) => set({ syncScrolling: bool }),
  setDraggedTabForSplit: (tab) => set({ draggedTabForSplit: tab }),
  setSplitInitData: (data) => set({ splitInitData: data }),
});

// --- Graph Slice ---
const createGraphSlice = (set) => ({
  graphData: null,
  isLoadingGraph: false,
  graphSidebarData: {
    selectedNodes: [],
    hoveredNode: null,
    graphData: { nodes: [], links: [] },
    stats: {},
  },

  setGraphData: (data) => set({ graphData: data }),
  setLoadingGraph: (bool) => set({ isLoadingGraph: bool }),
  setGraphSidebar: (data) => set({ graphSidebarData: data }),
});

// --- Combined Store ---
export const useWorkspaceStore = create(
  subscribeWithSelector((...a) => ({
    ...createLayoutSlice(...a),
    ...createPanelsSlice(...a),
    ...createViewsSlice(...a),
    ...createTabsSlice(...a),
    ...createFileTreeSlice(...a),
    ...createEditorSlice(...a),
    ...createSplitViewSlice(...a),
    ...createGraphSlice(...a),
  }))
);
```

**Step 3: Verify the store loads without errors**

Run: `npm run dev` — confirm the app starts (store isn't connected yet, just importable).

**Step 4: Commit**

```bash
git add package.json package-lock.json src/stores/workspace.js
git commit -m "feat: add Zustand store with 8 slices for workspace decomposition"
```

---

### Task 2: Extract Layout — useColumnResize Hook

**Files:**
- Create: `src/features/layout/hooks/useColumnResize.js`
- Create: `src/features/layout/hooks/useBottomPanelResize.js`
- Create: `src/features/layout/index.js`

**Step 1: Create useColumnResize hook**

Extract `useDragColumns` from Workspace.jsx (lines 228-270) into `src/features/layout/hooks/useColumnResize.js`. This hook reads/writes `leftW` and `rightW` from the Zustand store instead of local state:

```javascript
import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';

export function useColumnResize({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500 }) {
  const dragRef = useRef(null);
  const leftW = useWorkspaceStore((s) => s.leftW);
  const rightW = useWorkspaceStore((s) => s.rightW);
  const setLeftW = useWorkspaceStore((s) => s.setLeftW);
  const setRightW = useWorkspaceStore((s) => s.setRightW);

  const startLeftDrag = useCallback((e) => {
    const startX = e.clientX;
    const startW = useWorkspaceStore.getState().leftW;

    function onMove(e) {
      setLeftW(Math.min(maxLeft, Math.max(minLeft, startW + (e.clientX - startX))));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [maxLeft, minLeft, setLeftW]);

  const startRightDrag = useCallback((e) => {
    const startX = e.clientX;
    const startW = useWorkspaceStore.getState().rightW;

    function onMove(e) {
      setRightW(Math.min(maxRight, Math.max(minRight, startW - (e.clientX - startX))));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [maxRight, minRight, setRightW]);

  return { leftW, rightW, startLeftDrag, startRightDrag };
}
```

**Step 2: Create useBottomPanelResize hook**

```javascript
import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';

export function useBottomPanelResize({ min = 150, max = 600 }) {
  const isResizingRef = useRef(false);
  const setBottomHeight = useWorkspaceStore((s) => s.setBottomHeight);

  const startResize = useCallback((e) => {
    isResizingRef.current = true;
    const startY = e.clientY;
    const startH = useWorkspaceStore.getState().bottomPanelHeight;

    function onMove(e) {
      if (!isResizingRef.current) return;
      const newH = Math.min(max, Math.max(min, startH - (e.clientY - startY)));
      setBottomHeight(newH);
    }
    function onUp() {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [min, max, setBottomHeight]);

  return { startResize };
}
```

**Step 3: Create index.js barrel export**

```javascript
export { useColumnResize } from './hooks/useColumnResize';
export { useBottomPanelResize } from './hooks/useBottomPanelResize';
```

**Step 4: Commit**

```bash
git add src/features/layout/
git commit -m "feat: extract layout hooks (column resize, bottom panel resize)"
```

---

## Phase 2: Extract Simple Slices (Panels, Views)

### Task 3: Wire Layout Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`

**Step 1: Import store and replace layout useState calls**

In Workspace.jsx, replace the layout-related `useState` calls with Zustand selectors. Find and replace:

```javascript
// REMOVE these lines:
const [showLeft, setShowLeft] = useState(layoutDefaults.left_sidebar_visible);
const [showRight, setShowRight] = useState(layoutDefaults.right_sidebar_visible);
const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
const [bottomPanelTab, setBottomPanelTab] = useState('terminal');

// REMOVE the useDragColumns hook definition and call
// REMOVE the bottom panel resize handler

// ADD at top of WorkspaceWithScope:
import { useWorkspaceStore } from '../stores/workspace';
import { useColumnResize } from '../features/layout';

// ADD inside WorkspaceWithScope:
const showLeft = useWorkspaceStore((s) => s.showLeft);
const showRight = useWorkspaceStore((s) => s.showRight);
const toggleLeft = useWorkspaceStore((s) => s.toggleLeft);
const toggleRight = useWorkspaceStore((s) => s.toggleRight);
const bottomPanelHeight = useWorkspaceStore((s) => s.bottomPanelHeight);
const bottomPanelTab = useWorkspaceStore((s) => s.bottomPanelTab);
const setBottomTab = useWorkspaceStore((s) => s.setBottomTab);

const { leftW, rightW, startLeftDrag, startRightDrag } = useColumnResize({
  minLeft: 220, maxLeft: 500, minRight: 220, maxRight: 500
});
```

**Step 2: Update all references from `setShowLeft(v => !v)` to `toggleLeft()`**

Search and replace throughout Workspace.jsx:
- `setShowLeft(v => !v)` → `toggleLeft()`
- `setShowRight(v => !v)` → `toggleRight()`
- `setBottomPanelTab(...)` → `setBottomTab(...)`
- `setBottomPanelHeight(...)` → `useWorkspaceStore.getState().setBottomHeight(...)`

**Step 3: Initialize store defaults from remote config**

Add a useEffect that sets layout defaults from `layoutDefaults`:

```javascript
useEffect(() => {
  const store = useWorkspaceStore.getState();
  if (layoutDefaults.left_sidebar_visible !== undefined) {
    useWorkspaceStore.setState({ showLeft: layoutDefaults.left_sidebar_visible });
  }
  if (layoutDefaults.right_sidebar_visible !== undefined) {
    useWorkspaceStore.setState({ showRight: layoutDefaults.right_sidebar_visible });
  }
}, [layoutDefaults]);
```

**Step 4: Remove the inline `useDragColumns` function definition** (lines 228-270)

**Step 5: Verify app works**

Run: `npm run dev` — toggle sidebars, resize columns, open bottom panel. All must work as before.

**Step 6: Commit**

```bash
git add src/views/Workspace.jsx src/stores/workspace.js
git commit -m "refactor: wire layout store into Workspace, extract column resize"
```

---

### Task 4: Wire Panels Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`

**Step 1: Replace all 15+ panel/modal useState calls with store selectors**

```javascript
// REMOVE these lines:
const [showCommandPalette, setShowCommandPalette] = useState(false);
const [showInFileSearch, setShowInFileSearch] = useState(false);
const [showShortcutHelp, setShowShortcutHelp] = useState(false);
const [showTemplatePicker, setShowTemplatePicker] = useState(false);
const [templatePickerData, setTemplatePickerData] = useState(null);
const [showCreateTemplate, setShowCreateTemplate] = useState(false);
const [createTemplateContent, setCreateTemplateContent] = useState('');
const [showGlobalSearch, setShowGlobalSearch] = useState(false);
const [showTagModal, setShowTagModal] = useState(false);
const [tagModalFile, setTagModalFile] = useState(null);
const [showAboutDialog, setShowAboutDialog] = useState(false);
const [selectedFileForCompare, setSelectedFileForCompare] = useState(null);
const [showDatePickerModal, setShowDatePickerModal] = useState(false);
const [currentDailyNoteDate, setCurrentDailyNoteDate] = useState(null);
const [showVersionHistory, setShowVersionHistory] = useState(false);
const [versionHistoryFile, setVersionHistoryFile] = useState(null);
const [canvasPreview, setCanvasPreview] = useState(null);
const [referenceUpdateModal, setReferenceUpdateModal] = useState({...});

// ADD store selectors (group them):
const showCommandPalette = useWorkspaceStore((s) => s.showCommandPalette);
const showInFileSearch = useWorkspaceStore((s) => s.showInFileSearch);
const showShortcutHelp = useWorkspaceStore((s) => s.showShortcutHelp);
const showTemplatePicker = useWorkspaceStore((s) => s.showTemplatePicker);
const templatePickerData = useWorkspaceStore((s) => s.templatePickerData);
const showCreateTemplate = useWorkspaceStore((s) => s.showCreateTemplate);
const createTemplateContent = useWorkspaceStore((s) => s.createTemplateContent);
const showGlobalSearch = useWorkspaceStore((s) => s.showGlobalSearch);
const showTagModal = useWorkspaceStore((s) => s.showTagModal);
const tagModalFile = useWorkspaceStore((s) => s.tagModalFile);
const showAboutDialog = useWorkspaceStore((s) => s.showAboutDialog);
const selectedFileForCompare = useWorkspaceStore((s) => s.selectedFileForCompare);
const showDatePickerModal = useWorkspaceStore((s) => s.showDatePickerModal);
const currentDailyNoteDate = useWorkspaceStore((s) => s.currentDailyNoteDate);
const showVersionHistory = useWorkspaceStore((s) => s.showVersionHistory);
const versionHistoryFile = useWorkspaceStore((s) => s.versionHistoryFile);
const canvasPreview = useWorkspaceStore((s) => s.canvasPreview);
const referenceUpdateModal = useWorkspaceStore((s) => s.referenceUpdateModal);
const setReferenceUpdateModal = useWorkspaceStore((s) => s.setReferenceUpdateModal);
```

**Step 2: Replace all `setShowX(true/false)` calls with store actions**

Pattern: `setShowCommandPalette(true)` → `useWorkspaceStore.getState().openPanel('showCommandPalette')`
Pattern: `setShowCommandPalette(false)` → `useWorkspaceStore.getState().closePanel('showCommandPalette')`
Pattern: `setShowCommandPalette(v => !v)` → `useWorkspaceStore.getState().togglePanel('showCommandPalette')`

For compound state updates like `setShowTagModal(true); setTagModalFile(path)`:
→ `useWorkspaceStore.setState({ showTagModal: true, tagModalFile: path })`

**Step 3: Verify all modals open/close correctly**

Run: `npm run dev` — test Cmd+K (command palette), Cmd+F (search), template picker, about dialog, etc.

**Step 4: Commit**

```bash
git add src/views/Workspace.jsx
git commit -m "refactor: migrate panel/modal state to Zustand store"
```

---

### Task 5: Wire Views Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`

**Step 1: Replace view state with store selectors**

```javascript
// REMOVE:
const [currentView, setCurrentView] = useState('editor');
const [showGraphView, setShowGraphView] = useState(false);
const [showKanban, setShowKanban] = useState(false);
const [showPlugins, setShowPlugins] = useState(false);
const [showBases, setShowBases] = useState(false);
const [showMarketplace, setShowMarketplace] = useState(false);
const [showCalendarPanel, setShowCalendarPanel] = useState(false);
const [showDailyNotesPanel, setShowDailyNotesPanel] = useState(false);
const [showTerminalPanel, setShowTerminalPanel] = useState(false);
const [showOutputPanel, setShowOutputPanel] = useState(false);

// ADD:
const currentView = useWorkspaceStore((s) => s.currentView);
const showGraphView = useWorkspaceStore((s) => s.showGraphView);
const showKanban = useWorkspaceStore((s) => s.showKanban);
const showPlugins = useWorkspaceStore((s) => s.showPlugins);
const showBases = useWorkspaceStore((s) => s.showBases);
const showMarketplace = useWorkspaceStore((s) => s.showMarketplace);
const showCalendarPanel = useWorkspaceStore((s) => s.showCalendarPanel);
const showDailyNotesPanel = useWorkspaceStore((s) => s.showDailyNotesPanel);
const showTerminalPanel = useWorkspaceStore((s) => s.showTerminalPanel);
const showOutputPanel = useWorkspaceStore((s) => s.showOutputPanel);
const switchView = useWorkspaceStore((s) => s.switchView);
const toggleView = useWorkspaceStore((s) => s.toggleView);
```

**Step 2: Replace setters with store actions**

- `setCurrentView('editor')` → `switchView('editor')`
- `setShowKanban(true)` → `toggleView('showKanban')` (or `useWorkspaceStore.setState({ showKanban: true })`)
- Same pattern for all view toggles

**Step 3: Verify view switching**

Run: `npm run dev` — switch between editor, graph, kanban, bases, calendar views.

**Step 4: Commit**

```bash
git add src/views/Workspace.jsx
git commit -m "refactor: migrate view state to Zustand store"
```

---

## Phase 3: Extract Core Slices (Tabs, FileTree, Editor)

### Task 6: Wire Tabs Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`
- Create: `src/features/tabs/hooks/useTabs.js`
- Create: `src/features/tabs/index.js`

**Step 1: Create useTabs hook**

This hook wraps store actions with side effects (Tauri file loading, confirmation dialogs):

```javascript
import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getMarkdownCompiler } from '../../../core/markdown/compiler';

export function useTabs({ workspacePath }) {
  const openTab = useWorkspaceStore((s) => s.openTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const switchTab = useWorkspaceStore((s) => s.switchTab);
  const reopenClosed = useWorkspaceStore((s) => s.reopenClosed);
  const addRecentFile = useWorkspaceStore((s) => s.addRecentFile);

  const handleFileOpen = useCallback(async (path, inBackground = false) => {
    const name = path.split('/').pop();
    openTab(path, name);
    addRecentFile(path);

    if (!inBackground) {
      // Load file content into editor store
      const store = useWorkspaceStore.getState();
      store.setLoading(true);
      try {
        const content = await invoke('read_file_content', { path });
        const compiler = getMarkdownCompiler();
        const html = path.endsWith('.md') ? compiler.compile(content) : content;
        store.setContent(html);
        store.setSavedContent(html);
        store.setTitle(name.replace(/\.md$/, ''));
      } catch (e) {
        console.error('Failed to load file:', e);
      } finally {
        store.setLoading(false);
      }
    }
  }, [workspacePath, openTab, addRecentFile]);

  const handleTabClose = useCallback(async (path) => {
    const { unsavedChanges } = useWorkspaceStore.getState();
    if (unsavedChanges.has(path)) {
      const shouldClose = await confirm('You have unsaved changes. Close anyway?', {
        title: 'Unsaved Changes',
        kind: 'warning',
      });
      if (!shouldClose) return;
    }
    closeTab(path);
  }, [closeTab]);

  return {
    handleFileOpen,
    handleTabClose,
    handleTabSwitch: switchTab,
    handleReopenClosed: reopenClosed,
  };
}
```

**Step 2: Replace tab useState calls in Workspace.jsx**

```javascript
// REMOVE:
const [openTabs, setOpenTabs] = useState([]);
const [activeFile, setActiveFile] = useState(null);
const [unsavedChanges, setUnsavedChanges] = useState(new Set());
const [recentlyClosedTabs, setRecentlyClosedTabs] = useState([]);
const [recentFiles, setRecentFiles] = useState([]);

// ADD:
const openTabs = useWorkspaceStore((s) => s.openTabs);
const activeFile = useWorkspaceStore((s) => s.activeFile);
const unsavedChanges = useWorkspaceStore((s) => s.unsavedChanges);
```

**Step 3: Verify tab operations**

Run: `npm run dev` — open files, switch tabs, close tabs (with unsaved), reopen closed tabs.

**Step 4: Commit**

```bash
git add src/features/tabs/ src/views/Workspace.jsx
git commit -m "refactor: migrate tab state to Zustand store with useTabs hook"
```

---

### Task 7: Wire FileTree Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`
- Create: `src/features/file-tree/hooks/useFileTree.js`
- Create: `src/features/file-tree/hooks/useFileOperations.js`
- Create: `src/features/file-tree/NewItemInput.jsx`
- Create: `src/features/file-tree/index.js`

**Step 1: Extract NewItemInput component**

Move the `NewItemInput` component from Workspace.jsx (lines 273-305) to `src/features/file-tree/NewItemInput.jsx`. No changes needed beyond adding the import for Icon.

**Step 2: Create useFileTree hook**

```javascript
import { useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';

export function useFileTree({ workspacePath }) {
  const setFileTree = useWorkspaceStore((s) => s.setFileTree);
  const refreshId = useWorkspaceStore((s) => s.refreshId);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const toggleFolder = useWorkspaceStore((s) => s.toggleFolder);
  const closeAllFolders = useWorkspaceStore((s) => s.closeAllFolders);

  const loadFileTree = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const tree = await invoke('list_files', { path: workspacePath });
      setFileTree(tree);
    } catch (e) {
      console.error('Failed to load file tree:', e);
    }
  }, [workspacePath, setFileTree]);

  // Reload tree when refreshId changes
  useEffect(() => {
    loadFileTree();
  }, [refreshId, loadFileTree]);

  return { loadFileTree, refreshTree, toggleFolder, closeAllFolders };
}
```

**Step 3: Create useFileOperations hook**

Extract `handleFileContextAction`, `handleCreateFile`, `handleCreateFolder`, `handleConfirmCreate`, `handleCheckReferences`, `handleConfirmReferenceUpdate` from Workspace.jsx into this hook. Each function reads from and writes to the store.

**Step 4: Replace fileTree useState calls in Workspace.jsx**

```javascript
// REMOVE:
const [selectedPath, setSelectedPath] = useState(null);
const [fileTree, setFileTree] = useState([]);
const [expandedFolders, setExpandedFolders] = useState(new Set());
const [creatingItem, setCreatingItem] = useState(null);
const [renamingPath, setRenamingPath] = useState(null);
const [refreshId, setRefreshId] = useState(0);

// ADD:
const fileTree = useWorkspaceStore((s) => s.fileTree);
const selectedPath = useWorkspaceStore((s) => s.selectedPath);
const expandedFolders = useWorkspaceStore((s) => s.expandedFolders);
const creatingItem = useWorkspaceStore((s) => s.creatingItem);
const renamingPath = useWorkspaceStore((s) => s.renamingPath);
```

**Step 5: Verify file tree operations**

Run: `npm run dev` — expand folders, create files, rename, delete, drag-drop.

**Step 6: Commit**

```bash
git add src/features/file-tree/ src/views/Workspace.jsx
git commit -m "refactor: migrate file tree state to Zustand store"
```

---

### Task 8: Wire Editor Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`
- Create: `src/features/editor/hooks/useEditorContent.js`
- Create: `src/features/editor/hooks/useSave.js`
- Create: `src/features/editor/hooks/useVersionTracking.js`
- Create: `src/features/editor/EditorModeSwitcher.jsx`
- Create: `src/features/editor/index.js`

**Step 1: Extract EditorModeSwitcher**

Move from Workspace.jsx lines 105-218 to `src/features/editor/EditorModeSwitcher.jsx`.

**Step 2: Create useEditorContent hook**

```javascript
import { useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { getMarkdownCompiler } from '../../../core/markdown/compiler';

export function useEditorContent({ workspacePath }) {
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const setContent = useWorkspaceStore((s) => s.setContent);
  const setSavedContent = useWorkspaceStore((s) => s.setSavedContent);
  const setTitle = useWorkspaceStore((s) => s.setTitle);
  const setLoading = useWorkspaceStore((s) => s.setLoading);

  // Load file content when activeFile changes
  useEffect(() => {
    if (!activeFile || activeFile.startsWith('__')) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const content = await invoke('read_file_content', { path: activeFile });
        if (cancelled) return;

        const compiler = getMarkdownCompiler();
        const html = activeFile.endsWith('.md') ? compiler.compile(content) : content;
        setContent(html);
        setSavedContent(html);
        setTitle(activeFile.split('/').pop().replace(/\.md$/, ''));
      } catch (e) {
        console.error('Failed to load file:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeFile, workspacePath]);

  const handleEditorChange = useCallback((newContent) => {
    const store = useWorkspaceStore.getState();
    store.setContent(newContent);
    if (!store.activeFile) return;
    if (newContent !== store.savedContent) {
      store.markUnsaved(store.activeFile);
    } else {
      store.markSaved(store.activeFile);
    }
  }, []);

  return { handleEditorChange };
}
```

**Step 3: Create useSave hook**

Extract `handleSave` and `handleSaveAs` from Workspace.jsx, reading from Zustand store instead of `stateRef.current`.

**Step 4: Create useVersionTracking hook**

Extract version save logic (lastVersionContentRef, lastVersionSaveRef) into its own hook.

**Step 5: Replace editor useState calls in Workspace.jsx**

```javascript
// REMOVE:
const [editorContent, setEditorContent] = useState("");
const [editorTitle, setEditorTitle] = useState("");
const [savedContent, setSavedContent] = useState("");
const [isLoadingContent, setIsLoadingContent] = useState(false);

// ADD:
const editorContent = useWorkspaceStore((s) => s.editorContent);
const editorTitle = useWorkspaceStore((s) => s.editorTitle);
const savedContent = useWorkspaceStore((s) => s.savedContent);
const isLoadingContent = useWorkspaceStore((s) => s.isLoadingContent);
const setEditorInstance = useWorkspaceStore((s) => s.setEditor);
```

**Step 6: Remove the stateRef pattern**

The `stateRef` pattern was used to access current state in callbacks without stale closures. With Zustand, use `useWorkspaceStore.getState()` instead — always fresh.

Delete: `const stateRef = useRef({})` and the useEffect that syncs it.

**Step 7: Verify editing works**

Run: `npm run dev` — open file, edit, save (Cmd+S), save as, check unsaved indicator.

**Step 8: Commit**

```bash
git add src/features/editor/ src/views/Workspace.jsx
git commit -m "refactor: migrate editor state to Zustand store with save hooks"
```

---

## Phase 4: Extract Remaining Slices

### Task 9: Wire SplitView Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`
- Create: `src/features/split-view/hooks/useSplitView.js`
- Create: `src/features/split-view/index.js`

**Step 1: Create useSplitView hook**

Extract split view logic (toggle, direction, resize, scroll sync, drag-to-split) from Workspace.jsx.

**Step 2: Replace splitView useState calls**

```javascript
// REMOVE all 9 split view useState calls
// ADD store selectors
const useSplitView = useWorkspaceStore((s) => s.useSplitView);
const splitDirection = useWorkspaceStore((s) => s.splitDirection);
const leftPaneSize = useWorkspaceStore((s) => s.leftPaneSize);
// ... etc
```

**Step 3: Verify split view**

Run: `npm run dev` — toggle split, change direction, resize panes, sync scrolling.

**Step 4: Commit**

```bash
git add src/features/split-view/ src/views/Workspace.jsx
git commit -m "refactor: migrate split view state to Zustand store"
```

---

### Task 10: Wire Graph Store into Workspace.jsx

**Files:**
- Modify: `src/views/Workspace.jsx`
- Create: `src/features/graph/hooks/useGraphEngine.js`
- Create: `src/features/graph/index.js`

**Step 1: Create useGraphEngine hook**

Extract graph initialization (GraphEngine, GraphDataProcessor, GraphData refs), `buildGraphData`, `handleGraphStateChange`, `handleGraphNodeClick`, and the graph-related useEffects.

```javascript
import { useRef, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { GraphDataProcessor } from '../../../core/graph/GraphDataProcessor';
import { GraphData } from '../../../core/graph/GraphData';
import { GraphEngine } from '../../../core/graph/GraphEngine';

export function useGraphEngine({ workspacePath }) {
  const graphProcessorRef = useRef(null);
  const graphDataInstanceRef = useRef(null);
  const persistentGraphEngineRef = useRef(null);

  const setGraphData = useWorkspaceStore((s) => s.setGraphData);
  const setLoadingGraph = useWorkspaceStore((s) => s.setLoadingGraph);
  const setGraphSidebar = useWorkspaceStore((s) => s.setGraphSidebar);

  const buildGraphData = useCallback(async () => {
    if (!workspacePath) return;
    setLoadingGraph(true);
    try {
      if (!graphProcessorRef.current) {
        graphProcessorRef.current = new GraphDataProcessor(workspacePath);
        await graphProcessorRef.current.initialize();
      }
      const data = graphProcessorRef.current.buildGraphStructure();
      setGraphData(data);
    } catch (e) {
      console.error('Graph build failed:', e);
    } finally {
      setLoadingGraph(false);
    }
  }, [workspacePath, setGraphData, setLoadingGraph]);

  // Expose processor ref for save-triggered updates
  return { buildGraphData, graphProcessorRef, graphDataInstanceRef };
}
```

**Step 2: Replace graph useState calls and move graph useEffects**

**Step 3: Verify graph view**

Run: `npm run dev` — open graph view, click nodes, check sidebar data.

**Step 4: Commit**

```bash
git add src/features/graph/ src/views/Workspace.jsx
git commit -m "refactor: migrate graph state to Zustand store with useGraphEngine"
```

---

### Task 11: Extract Shortcuts into ShortcutListener

**Files:**
- Create: `src/features/shortcuts/ShortcutListener.jsx`
- Create: `src/features/shortcuts/hooks/useShortcuts.js`
- Create: `src/features/shortcuts/index.js`
- Modify: `src/views/Workspace.jsx`

**Step 1: Create useShortcuts hook**

This hook registers all 50+ Tauri event listeners. Each listener calls the appropriate store action:

```javascript
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaceStore } from '../../../stores/workspace';

export function useShortcuts({ workspacePath, editorRef, editorGroupsRef }) {
  useEffect(() => {
    const unlisten = [];

    // File operations
    unlisten.push(listen('lokus:save-file', () => {
      // Call save from editor feature
      // This will be passed as a callback or read from a ref
    }));

    unlisten.push(listen('lokus:close-tab', () => {
      const { activeFile } = useWorkspaceStore.getState();
      if (activeFile) useWorkspaceStore.getState().closeTab(activeFile);
    }));

    unlisten.push(listen('lokus:new-file', () => {
      useWorkspaceStore.getState().startCreate('file', workspacePath);
    }));

    unlisten.push(listen('lokus:toggle-sidebar', () => {
      useWorkspaceStore.getState().toggleLeft();
    }));

    unlisten.push(listen('lokus:command-palette', () => {
      useWorkspaceStore.getState().togglePanel('showCommandPalette');
    }));

    unlisten.push(listen('lokus:in-file-search', () => {
      useWorkspaceStore.getState().togglePanel('showInFileSearch');
    }));

    unlisten.push(listen('lokus:graph-view', () => {
      useWorkspaceStore.getState().toggleView('showGraphView');
    }));

    // ... register all 50+ listeners following same pattern

    // Keyboard fallback for web
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        // trigger save
      }
    };
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      Promise.all(unlisten.map((u) => u.then((fn) => fn())));
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [workspacePath]);
}
```

**Step 2: Create ShortcutListener component**

A headless component that renders nothing but runs the hook:

```javascript
import { useShortcuts } from './hooks/useShortcuts';

export function ShortcutListener({ workspacePath, editorRef, onSave }) {
  useShortcuts({ workspacePath, editorRef, onSave });
  return null;
}
```

**Step 3: Remove the massive useEffect from Workspace.jsx**

Delete the ~400 line useEffect block (lines 3916-4259) and the keydown handler (lines 3884-3914).

**Step 4: Add `<ShortcutListener />` to Workspace.jsx render**

**Step 5: Verify all shortcuts**

Run: `npm run dev` — test Cmd+S, Cmd+K, Cmd+F, Cmd+N, Cmd+W, sidebar toggle, etc.

**Step 6: Commit**

```bash
git add src/features/shortcuts/ src/views/Workspace.jsx
git commit -m "refactor: extract 50+ keyboard shortcuts into ShortcutListener"
```

---

## Phase 5: Create Feature Components

### Task 12: Create Feature Container Components

**Files:**
- Create: `src/features/workspace/Workspace.jsx`
- Create: `src/features/workspace/WorkspaceProviders.jsx`
- Create: `src/features/workspace/WorkspaceLayout.jsx`
- Create: `src/features/panels/ModalContainer.jsx`
- Create: `src/features/panels/BottomPanelContainer.jsx`
- Create: `src/features/panels/PanelContainer.jsx`
- Create: `src/features/panels/index.js`

**Step 1: Create ModalContainer**

Extract all modal renders from Workspace.jsx JSX into one component:

```javascript
import { useWorkspaceStore } from '../../../stores/workspace';
import CommandPalette from '../../../components/CommandPalette';
import InFileSearch from '../../../components/InFileSearch';
import ShortcutHelpModal from '../../../components/ShortcutHelpModal';
import TemplatePicker from '../../../components/TemplatePicker';
// ... other modal imports

export function ModalContainer({ workspacePath, editorRef }) {
  const showCommandPalette = useWorkspaceStore((s) => s.showCommandPalette);
  const showInFileSearch = useWorkspaceStore((s) => s.showInFileSearch);
  const showShortcutHelp = useWorkspaceStore((s) => s.showShortcutHelp);
  // ... all panel booleans

  return (
    <>
      {showCommandPalette && (
        <CommandPalette
          onClose={() => useWorkspaceStore.getState().closePanel('showCommandPalette')}
          // ... props
        />
      )}
      {showInFileSearch && (
        <InFileSearch
          onClose={() => useWorkspaceStore.getState().closePanel('showInFileSearch')}
          editorRef={editorRef}
        />
      )}
      {/* ... all other modals */}
    </>
  );
}
```

**Step 2: Create BottomPanelContainer**

Extract terminal + output panel rendering.

**Step 3: Create PanelContainer**

Extract right sidebar (DocumentOutline, BacklinksPanel, GraphSidebar, VersionHistoryPanel, EditorModeSwitcher).

**Step 4: Create WorkspaceLayout**

The 3-column grid layout that composes FileTreePanel, main content, and PanelContainer:

```javascript
import { useWorkspaceStore } from '../../../stores/workspace';
import { useColumnResize } from '../../layout';

export function WorkspaceLayout({ workspacePath, children }) {
  const showLeft = useWorkspaceStore((s) => s.showLeft);
  const showRight = useWorkspaceStore((s) => s.showRight);
  const { leftW, rightW, startLeftDrag, startRightDrag } = useColumnResize({});

  return (
    <div
      className="flex h-full"
      style={{
        gridTemplateColumns: `${showLeft ? leftW + 'px' : '0'} 4px 1fr 4px ${showRight ? rightW + 'px' : '0'}`,
      }}
    >
      {children}
    </div>
  );
}
```

**Step 5: Create WorkspaceProviders**

Wraps with DndContext, FolderScopeProvider, BasesProvider, PanelManager:

```javascript
export function WorkspaceProviders({ workspacePath, children }) {
  return (
    <FolderScopeProvider workspacePath={workspacePath}>
      <BasesProvider workspacePath={workspacePath}>
        <DndContext>
          <PanelManager>
            {children}
          </PanelManager>
        </DndContext>
      </BasesProvider>
    </FolderScopeProvider>
  );
}
```

**Step 6: Create new thin Workspace.jsx**

```javascript
import { WorkspaceProviders } from './WorkspaceProviders';
import { WorkspaceLayout } from './WorkspaceLayout';
import { ShortcutListener } from '../shortcuts';
import { ModalContainer } from '../panels';
import { BottomPanelContainer } from '../panels';
// ... other feature imports

export function Workspace({ workspacePath }) {
  return (
    <WorkspaceProviders workspacePath={workspacePath}>
      <ShortcutListener workspacePath={workspacePath} />
      <WorkspaceLayout workspacePath={workspacePath}>
        {/* Left sidebar, main content, right sidebar composed here */}
      </WorkspaceLayout>
      <ModalContainer workspacePath={workspacePath} />
      <BottomPanelContainer />
    </WorkspaceProviders>
  );
}
```

**Step 7: Verify full app works**

Run: `npm run dev` — test all major flows end-to-end.

**Step 8: Commit**

```bash
git add src/features/workspace/ src/features/panels/
git commit -m "refactor: create feature container components for workspace composition"
```

---

### Task 13: Update src/views/Workspace.jsx to Re-export

**Files:**
- Modify: `src/views/Workspace.jsx`

**Step 1: Replace 6000-line Workspace.jsx with re-export**

```javascript
// src/views/Workspace.jsx
// Re-export from features for backwards compatibility with App.jsx routing
export { default } from '../features/workspace/Workspace';
```

**Step 2: Delete the old Workspace.jsx content**

The old file is replaced entirely.

**Step 3: Verify app routing still works**

Run: `npm run dev` — the app should load exactly as before.

**Step 4: Run existing tests**

Run: `npm test` — all existing tests must pass.

**Step 5: Commit**

```bash
git add src/views/Workspace.jsx
git commit -m "refactor: replace monolithic Workspace.jsx with thin re-export"
```

---

## Phase 6: Cleanup and Verification

### Task 14: Run Full Test Suite and Fix Imports

**Files:**
- Various (fix broken imports)

**Step 1: Run all tests**

Run: `npm test -- --reporter=verbose`

**Step 2: Fix any broken imports**

Any test or component that imported from `Workspace.jsx` directly may need path updates.

**Step 3: Run E2E tests**

Run: `npm run test:e2e`

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve broken imports after workspace decomposition"
```

---

### Task 15: Final Cleanup — Remove Dead Code

**Files:**
- Various

**Step 1: Search for unused imports in old Workspace.jsx location**

Run: `grep -r "from.*views/Workspace" src/` — update any stale references.

**Step 2: Remove any commented-out code left from the migration**

**Step 3: Verify final line count**

The new `src/features/workspace/Workspace.jsx` should be ~150 lines.
The old `src/views/Workspace.jsx` should be ~3 lines (re-export).

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup dead code after workspace decomposition"
```

---

## Summary

| Phase | Tasks | What Gets Extracted |
|-------|-------|-------------------|
| 1: Foundation | 1-2 | Zustand store + layout hooks |
| 2: Simple Slices | 3-5 | Layout, panels, views wired to store |
| 3: Core Slices | 6-8 | Tabs, file tree, editor wired to store |
| 4: Remaining | 9-11 | Split view, graph, shortcuts extracted |
| 5: Components | 12-13 | Feature containers + thin shell |
| 6: Cleanup | 14-15 | Tests, imports, dead code |

**Result:** Workspace.jsx goes from **5,997 lines → ~150 lines**. 67 useState → 0 useState (all in Zustand). Each feature independently testable and modifiable.
