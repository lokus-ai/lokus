# Workspace Architecture Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decompose the monolithic Workspace.jsx into VSCode-style independent editor groups with 4 Zustand stores, @tiptap/markdown pipeline, error boundaries, and a reference worker — fixing all 4 critical bugs.

**Architecture:** 4 independent Zustand stores (layout, editorGroups, views, fileTree) replace the single mega-store. Each editor group owns its own TipTap instance, ProseMirror JSON cache, and save handler. Views use an exclusive state machine. Error boundaries isolate crashes per zone.

**Tech Stack:** React 18, Zustand 4, TipTap 3, @tiptap/markdown, Tauri 2 (Rust), Web Workers

---

## Pre-Implementation: Push & Clean Worktree

### Task 0: Push existing worktree commits and prepare fresh branch

**Files:**
- No file changes — git operations only

**Step 1: Push worktree changes to remote**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor
git push origin refactor/workspace-decomposition
```

**Step 2: Switch to main repo and delete worktree**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus
git worktree remove .claude/worktrees/workspace-refactor
```

**Step 3: Create fresh worktree from the pushed branch**

Run:
```bash
git worktree add .claude/worktrees/workspace-refactor refactor/workspace-decomposition
```

**Step 4: Verify fresh worktree**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor
git log --oneline -3
```

**Step 5: Commit** — N/A (no code changes)

---

## Parallel Stream A: Foundation Stores (blocks everything)

These 4 stores are the foundation. They can be built in parallel with each other, but almost everything else depends on at least one of them existing.

### Task 1: Create useLayoutStore

**Files:**
- Create: `src/stores/layout.js`

**Step 1: Create the store**

```js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useLayoutStore = create(
  subscribeWithSelector((set) => ({
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
  }))
);
```

**Step 2: Verify it imports without error**

Run: `cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor && node -e "import('./src/stores/layout.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

**Step 3: Commit**

```bash
git add src/stores/layout.js
git commit -m "feat: create useLayoutStore — independent layout state"
```

---

### Task 2: Create useFileTreeStore

**Files:**
- Create: `src/stores/fileTree.js`

**Step 1: Create the store**

Extract the FileTree Slice from `src/stores/workspace.js:278-329` into its own store. The state and actions are identical — only the store boundary changes.

```js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useFileTreeStore = create(
  subscribeWithSelector((set) => ({
    fileTree: [],
    expandedFolders: new Set(),
    selectedPath: null,
    selectedPaths: new Set(),
    creatingItem: null,
    renamingPath: null,
    refreshId: 0,
    hoveredFolder: null,
    isExternalDragActive: false,
    keymap: {},

    setFileTree: (tree) => set({ fileTree: tree }),

    toggleFolder: (path) =>
      set((s) => {
        const next = new Set(s.expandedFolders);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return { expandedFolders: next };
      }),

    closeAllFolders: () => set({ expandedFolders: new Set() }),

    selectEntry: (path) =>
      set({ selectedPath: path, selectedPaths: new Set([path]) }),

    selectMultiple: (paths) =>
      set({ selectedPaths: new Set(paths) }),

    startCreate: (type, targetPath) =>
      set({ creatingItem: { type, targetPath } }),

    cancelCreate: () => set({ creatingItem: null }),
    startRename: (path) => set({ renamingPath: path }),
    cancelRename: () => set({ renamingPath: null }),
    refreshTree: () => set((s) => ({ refreshId: s.refreshId + 1 })),
    setHoveredFolder: (path) => set({ hoveredFolder: path }),
    setExternalDragActive: (bool) => set({ isExternalDragActive: bool }),
    setKeymap: (map) => set({ keymap: map }),
  }))
);
```

**Step 2: Commit**

```bash
git add src/stores/fileTree.js
git commit -m "feat: create useFileTreeStore — independent file tree state"
```

---

### Task 3: Create useViewStore (exclusive state machine + panels)

**Files:**
- Create: `src/stores/views.js`

**Step 1: Create the store**

Merge the Views Slice (`workspace.js:121-158`) and Panels Slice (`workspace.js:25-119`) into one store, BUT replace the 9 boolean view flags with a single `currentView` enum.

```js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const PANEL_MAP = {
  commandPalette:   'showCommandPalette',
  inFileSearch:     'showInFileSearch',
  shortcutHelp:     'showShortcutHelp',
  templatePicker:   ['showTemplatePicker', 'templatePickerData'],
  createTemplate:   'showCreateTemplate',
  globalSearch:     'showGlobalSearch',
  tagModal:         ['showTagModal', 'tagModalFile'],
  aboutDialog:      'showAboutDialog',
  datePickerModal:  'showDatePickerModal',
  versionHistory:   ['showVersionHistory', 'versionHistoryFile'],
  // Also accept raw keys
  showCommandPalette:   'showCommandPalette',
  showInFileSearch:     'showInFileSearch',
  showShortcutHelp:     'showShortcutHelp',
  showTemplatePicker:   ['showTemplatePicker', 'templatePickerData'],
  showCreateTemplate:   'showCreateTemplate',
  showGlobalSearch:     'showGlobalSearch',
  showTagModal:         ['showTagModal', 'tagModalFile'],
  showAboutDialog:      'showAboutDialog',
  showDatePickerModal:  'showDatePickerModal',
  showVersionHistory:   ['showVersionHistory', 'versionHistoryFile'],
};

export const useViewStore = create(
  subscribeWithSelector((set, get) => ({
    // View state machine — exactly ONE active at a time
    currentView: 'editor', // 'editor' | 'graph' | 'kanban' | 'bases' | 'calendar' | 'marketplace'

    // Panel state (modals/overlays — independent of view)
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
      isOpen: false, oldPath: null, newPath: null,
      affectedFiles: [], isProcessing: false, result: null, pendingOperation: null,
    },

    // View actions
    switchView: (view) => set({ currentView: view }),

    // Panel actions
    openPanel: (name, data) => {
      const entry = PANEL_MAP[name];
      if (!entry) return;
      if (Array.isArray(entry)) {
        const [flagKey, dataKey] = entry;
        set({ [flagKey]: true, [dataKey]: data ?? null });
      } else {
        set({ [entry]: true });
      }
    },

    closePanel: (name) => {
      const entry = PANEL_MAP[name];
      if (!entry) return;
      if (Array.isArray(entry)) {
        const [flagKey, dataKey] = entry;
        set({ [flagKey]: false, [dataKey]: null });
      } else {
        set({ [entry]: false });
      }
    },

    togglePanel: (name) => {
      const entry = PANEL_MAP[name];
      if (!entry) return;
      const flagKey = Array.isArray(entry) ? entry[0] : entry;
      set((s) => ({ [flagKey]: !s[flagKey] }));
    },

    setReferenceUpdateModal: (modal) =>
      set((s) => ({
        referenceUpdateModal: { ...s.referenceUpdateModal, ...modal },
      })),
  }))
);
```

**Step 2: Commit**

```bash
git add src/stores/views.js
git commit -m "feat: create useViewStore — exclusive view state machine + panels"
```

---

### Task 4: Create useEditorGroupStore (the core)

**Files:**
- Create: `src/stores/editorGroups.js`

**Step 1: Create the store**

This is the most complex store. It combines the tree-based layout from `useEditorGroups.js` (381 lines) with per-tab content caching (ProseMirror JSON), LRU eviction, graph state, and dirty tracking. The layout tree operations come from the existing hook — we're migrating them into Zustand.

```js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const MAX_CACHED_TABS = 20;
const MAX_RECENT_CLOSED = 20;
const MAX_RECENT_FILES = 50;

let idCounter = 0;
const genGroupId = () => `group-${++idCounter}`;
const genContainerId = () => `container-${++idCounter}`;

const createGroup = (tabs = [], activeTab = null) => ({
  id: genGroupId(),
  type: 'group',
  tabs,
  activeTab,
  contentByTab: {}, // { [path]: { prosemirrorDoc, rawMarkdown, scrollY, cursorPos, undoStack, dirty, lastAccessed } }
});

const createContainer = (direction, children, sizes = null) => ({
  id: genContainerId(),
  type: 'container',
  direction,
  children,
  sizes: sizes || children.map(() => 100 / children.length),
});

// Tree traversal helpers (pure functions, no React dependency)
const findGroupInTree = (node, groupId) => {
  if (node.type === 'group' && node.id === groupId) return node;
  if (node.type === 'container') {
    for (const child of node.children) {
      const found = findGroupInTree(child, groupId);
      if (found) return found;
    }
  }
  return null;
};

const getAllGroupsFromTree = (node) => {
  if (node.type === 'group') return [node];
  if (node.type === 'container') return node.children.flatMap(getAllGroupsFromTree);
  return [];
};

const updateGroupInTree = (node, groupId, updater) => {
  if (node.type === 'group' && node.id === groupId) {
    return typeof updater === 'function' ? updater(node) : { ...node, ...updater };
  }
  if (node.type === 'container') {
    return { ...node, children: node.children.map((c) => updateGroupInTree(c, groupId, updater)) };
  }
  return node;
};

const removeGroupFromTree = (node, groupId) => {
  if (node.type === 'group' && node.id === groupId) return null;
  if (node.type === 'container') {
    const newChildren = node.children.map((c) => removeGroupFromTree(c, groupId)).filter(Boolean);
    if (newChildren.length === 0) return null;
    if (newChildren.length === 1) return newChildren[0];
    return { ...node, children: newChildren, sizes: newChildren.map(() => 100 / newChildren.length) };
  }
  return node;
};

// LRU eviction: remove least-recently-accessed entries beyond MAX_CACHED_TABS
const evictLRU = (contentByTab) => {
  const entries = Object.entries(contentByTab);
  if (entries.length <= MAX_CACHED_TABS) return contentByTab;
  entries.sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));
  return Object.fromEntries(entries.slice(0, MAX_CACHED_TABS));
};

export const useEditorGroupStore = create(
  subscribeWithSelector((set, get) => ({
    layout: createGroup([], null),
    focusedGroupId: null, // set after first group created
    globalRecentFiles: [],
    recentlyClosedTabs: [],

    // Graph state (owned here since graph data relates to file content)
    graphData: null,
    isLoadingGraph: false,
    graphSidebarData: { selectedNodes: [], hoveredNode: null, graphData: { nodes: [], links: [] }, stats: {} },
    allImageFiles: [],

    // --- Tab operations ---
    addTab: (groupId, tab, makeActive = true) =>
      set((s) => ({
        layout: updateGroupInTree(s.layout, groupId, (g) => {
          const exists = g.tabs.find((t) => t.path === tab.path);
          if (exists) return makeActive ? { ...g, activeTab: tab.path } : g;
          return { ...g, tabs: [...g.tabs, tab], activeTab: makeActive ? tab.path : g.activeTab };
        }),
      })),

    removeTab: (groupId, tabPath) =>
      set((s) => ({
        layout: updateGroupInTree(s.layout, groupId, (g) => {
          const newTabs = g.tabs.filter((t) => t.path !== tabPath);
          const newActive = g.activeTab === tabPath ? (newTabs[0]?.path || null) : g.activeTab;
          const newContent = { ...g.contentByTab };
          delete newContent[tabPath];
          return { ...g, tabs: newTabs, activeTab: newActive, contentByTab: newContent };
        }),
      })),

    setActiveTab: (groupId, tabPath) =>
      set((s) => ({
        layout: updateGroupInTree(s.layout, groupId, (g) => ({
          ...g,
          activeTab: tabPath,
          contentByTab: {
            ...g.contentByTab,
            ...(g.contentByTab[tabPath]
              ? { [tabPath]: { ...g.contentByTab[tabPath], lastAccessed: Date.now() } }
              : {}),
          },
        })),
        focusedGroupId: groupId,
      })),

    // Cache ProseMirror doc for a tab
    setTabContent: (groupId, tabPath, content) =>
      set((s) => ({
        layout: updateGroupInTree(s.layout, groupId, (g) => ({
          ...g,
          contentByTab: evictLRU({
            ...g.contentByTab,
            [tabPath]: { ...(g.contentByTab[tabPath] || {}), ...content, lastAccessed: Date.now() },
          }),
        })),
      })),

    markTabDirty: (groupId, tabPath, dirty) =>
      set((s) => ({
        layout: updateGroupInTree(s.layout, groupId, (g) => ({
          ...g,
          contentByTab: {
            ...g.contentByTab,
            [tabPath]: { ...(g.contentByTab[tabPath] || {}), dirty, lastAccessed: Date.now() },
          },
        })),
      })),

    // --- Split operations ---
    splitGroup: (groupId, direction, position = 'after', newGroupTab = null) =>
      set((s) => {
        const newGroup = createGroup(newGroupTab ? [newGroupTab] : [], newGroupTab?.path || null);
        const split = (node) => {
          if (node.type === 'group' && node.id === groupId) {
            const children = position === 'before' ? [newGroup, node] : [node, newGroup];
            return createContainer(direction, children);
          }
          if (node.type === 'container') {
            // If same direction, insert sibling
            if (node.direction === direction) {
              const idx = node.children.findIndex((c) => c.type === 'group' && c.id === groupId);
              if (idx !== -1) {
                const newChildren = [...node.children];
                newChildren.splice(position === 'before' ? idx : idx + 1, 0, newGroup);
                return { ...node, children: newChildren, sizes: newChildren.map(() => 100 / newChildren.length) };
              }
            }
            return { ...node, children: node.children.map(split) };
          }
          return node;
        };
        return { layout: split(s.layout), focusedGroupId: newGroup.id };
      }),

    closeGroup: (groupId) =>
      set((s) => {
        if (s.layout.type === 'group' && s.layout.id === groupId) {
          return { layout: { ...s.layout, tabs: [], activeTab: null, contentByTab: {} } };
        }
        const result = removeGroupFromTree(s.layout, groupId);
        return { layout: result || createGroup([], null) };
      }),

    updateSizes: (containerId, sizes) =>
      set((s) => {
        const update = (node) => {
          if (node.type === 'container' && node.id === containerId) return { ...node, sizes };
          if (node.type === 'container') return { ...node, children: node.children.map(update) };
          return node;
        };
        return { layout: update(s.layout) };
      }),

    moveTab: (fromGroupId, toGroupId, tabPath) => {
      const { layout } = get();
      const fromGroup = findGroupInTree(layout, fromGroupId);
      if (!fromGroup) return;
      const tab = fromGroup.tabs.find((t) => t.path === tabPath);
      if (!tab) return;
      // Carry over cached content
      const cachedContent = fromGroup.contentByTab?.[tabPath];
      set((s) => {
        let newLayout = updateGroupInTree(s.layout, fromGroupId, (g) => {
          const newTabs = g.tabs.filter((t) => t.path !== tabPath);
          const newContent = { ...g.contentByTab };
          delete newContent[tabPath];
          return {
            ...g,
            tabs: newTabs,
            activeTab: g.activeTab === tabPath ? (newTabs[0]?.path || null) : g.activeTab,
            contentByTab: newContent,
          };
        });
        newLayout = updateGroupInTree(newLayout, toGroupId, (g) => ({
          ...g,
          tabs: [...g.tabs, tab],
          activeTab: tab.path,
          contentByTab: cachedContent
            ? { ...g.contentByTab, [tabPath]: cachedContent }
            : g.contentByTab,
        }));
        return { layout: newLayout };
      });
    },

    updateTabPath: (oldPath, newPath) => {
      const newName = newPath.split('/').pop() || newPath;
      set((s) => {
        const update = (node) => {
          if (node.type === 'group') {
            const newTabs = node.tabs.map((t) => (t.path === oldPath ? { ...t, path: newPath, name: newName } : t));
            const newContent = { ...node.contentByTab };
            if (newContent[oldPath]) {
              newContent[newPath] = newContent[oldPath];
              delete newContent[oldPath];
            }
            return {
              ...node,
              tabs: newTabs,
              activeTab: node.activeTab === oldPath ? newPath : node.activeTab,
              contentByTab: newContent,
            };
          }
          if (node.type === 'container') return { ...node, children: node.children.map(update) };
          return node;
        };
        return { layout: update(s.layout) };
      });
    },

    setFocusedGroupId: (id) => set({ focusedGroupId: id }),

    addRecentFile: (path) =>
      set((s) => {
        const filtered = s.globalRecentFiles.filter((p) => p !== path);
        return { globalRecentFiles: [path, ...filtered].slice(0, MAX_RECENT_FILES) };
      }),

    addRecentlyClosed: (tab) =>
      set((s) => ({
        recentlyClosedTabs: [tab, ...s.recentlyClosedTabs].slice(0, MAX_RECENT_CLOSED),
      })),

    reopenClosed: (groupId) =>
      set((s) => {
        if (s.recentlyClosedTabs.length === 0) return {};
        const [last, ...rest] = s.recentlyClosedTabs;
        const targetGroup = groupId || s.focusedGroupId;
        return {
          recentlyClosedTabs: rest,
          layout: updateGroupInTree(s.layout, targetGroup, (g) => {
            const exists = g.tabs.find((t) => t.path === last.path);
            if (exists) return { ...g, activeTab: last.path };
            return { ...g, tabs: [...g.tabs, last], activeTab: last.path };
          }),
        };
      }),

    // Graph actions
    setGraphData: (data) => set({ graphData: data }),
    setLoadingGraph: (bool) => set({ isLoadingGraph: bool }),
    setGraphSidebar: (data) => set((s) => ({ graphSidebarData: { ...s.graphSidebarData, ...data } })),
    setAllImageFiles: (files) => set({ allImageFiles: files }),

    // Queries (not actions — call on get())
    findGroup: (groupId) => findGroupInTree(get().layout, groupId),
    getAllGroups: () => getAllGroupsFromTree(get().layout),
    getFocusedGroup: () => {
      const { layout, focusedGroupId } = get();
      return focusedGroupId ? findGroupInTree(layout, focusedGroupId) : null;
    },

    // Initialize layout (from session or default)
    initLayout: (tabs = [], activeTab = null) => {
      const group = createGroup(tabs, activeTab);
      set({ layout: group, focusedGroupId: group.id });
    },

    // Restore layout from session JSON
    restoreLayout: (layoutJson) => {
      if (!layoutJson) return;
      try {
        // Restore IDs to counter to avoid collisions
        const maxId = JSON.stringify(layoutJson).match(/(?:group|container)-(\d+)/g)?.reduce((max, match) => {
          const num = parseInt(match.split('-')[1]);
          return Math.max(max, num);
        }, 0) || 0;
        idCounter = maxId;
        // Ensure all groups have contentByTab
        const ensureContentByTab = (node) => {
          if (node.type === 'group' && !node.contentByTab) node.contentByTab = {};
          if (node.type === 'container') node.children?.forEach(ensureContentByTab);
          return node;
        };
        ensureContentByTab(layoutJson);
        const groups = getAllGroupsFromTree(layoutJson);
        set({ layout: layoutJson, focusedGroupId: groups[0]?.id || null });
      } catch {
        // Fallback to empty layout
        const group = createGroup([], null);
        set({ layout: group, focusedGroupId: group.id });
      }
    },
  }))
);
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor && node -e "import('./src/stores/editorGroups.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

**Step 3: Commit**

```bash
git add src/stores/editorGroups.js
git commit -m "feat: create useEditorGroupStore — VSCode-style groups with content cache"
```

---

## Parallel Stream B: ErrorBoundary (independent)

### Task 5: Create reusable ErrorBoundary component

**Files:**
- Create: `src/components/ErrorBoundary.jsx`

**Step 1: Create the component**

```jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.name || 'unknown'}]`, error, info);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, recover: this.handleRecover });
      }
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-app-muted">
          <p className="text-sm font-medium mb-2">
            {this.props.message || 'Something crashed'}
          </p>
          <button
            onClick={this.handleRecover}
            className="px-3 py-1 text-xs rounded bg-app-accent text-white hover:opacity-90"
          >
            Click to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Step 2: Commit**

```bash
git add src/components/ErrorBoundary.jsx
git commit -m "feat: add reusable ErrorBoundary with recovery UI"
```

---

## Parallel Stream C: @tiptap/markdown Integration (independent)

### Task 6: Install @tiptap/markdown

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor
npm install @tiptap/markdown
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @tiptap/markdown for direct md<->ProseMirror"
```

---

### Task 7: Write custom markdown serializers for 5 node types

**Files:**
- Create: `src/editor/extensions/markdownSerializers.js`
- Reference: `src/editor/extensions/WikiLink.js` (362 lines — WikiLink node schema)
- Reference: `src/editor/extensions/WikiLinkEmbed.js` (219 lines — embed schema)
- Reference: `src/editor/extensions/Callout.js` (235 lines — callout schema)
- Reference: `src/editor/extensions/MermaidDiagram.jsx` (122 lines — mermaid schema)
- Reference: `src/editor/extensions/CanvasLink.js` (238 lines — canvas link schema)

**Step 1: Read each extension's node spec to understand attrs and schema**

Before writing serializers, read each of the 5 extension files to extract the exact ProseMirror node schema (`addNodeView`, `parseHTML`, `renderHTML`, `attrs`). The serializer must match these exactly.

**Step 2: Create the serializers file**

The file exports a function that adds `addStorage()` with `markdown.serialize` and `markdown.parse` handlers to each extension. These handlers tell @tiptap/markdown how to convert between ProseMirror nodes and markdown text.

Key serialization formats (from `markdown-exporter.js` and markdown source files):
- **WikiLink**: `[[target]]` or `[[target|alias]]`, embed form: `![[target]]`
- **WikiLinkEmbed**: `![[file^blockId]]` or `![[file#heading]]`
- **Callout**: `> [!type]- Title\n> content` (blockquote with special first line)
- **MermaidDiagram**: ` ```mermaid\n{code}\n``` ` (fenced code block)
- **CanvasLink**: `![[filename.canvas]]`

Also write a **table serializer** to work around tiptap #5750.

**Step 3: Write tests for round-trip fidelity**

Create `src/editor/extensions/markdownSerializers.test.js` with round-trip tests for each node type:
- Parse markdown → ProseMirror → serialize back to markdown
- Verify output matches input for each of the 5 custom nodes

**Step 4: Run tests**

Run: `npx vitest run src/editor/extensions/markdownSerializers.test.js`

**Step 5: Commit**

```bash
git add src/editor/extensions/markdownSerializers.js src/editor/extensions/markdownSerializers.test.js
git commit -m "feat: custom @tiptap/markdown serializers for 5 node types + tables"
```

---

## Parallel Stream D: Reference Worker (independent)

### Task 8: Create reference.worker.js

**Files:**
- Create: `src/workers/reference.worker.js`
- Reference: `src/core/references/ReferenceManager.js:215-225` (the serial buildIndex loop to replace)

**Step 1: Create workers directory and worker file**

The worker receives file paths in batches of 20, reads them via Tauri IPC (postMessage to main thread for invoke), extracts references via regex, and builds an index. The main thread sends `{ type: 'buildIndex', files: [...] }` and receives `{ type: 'indexReady', index: {...} }`.

Key regex patterns to extract (from ReferenceManager.js):
- WikiLinks: `\[\[([^\]]+)\]\]`
- Tags: `#([a-zA-Z0-9_/-]+)`
- Block refs: `\^([a-zA-Z0-9-]+)`

The worker processes files in parallel batches of 20 using `Promise.all` instead of the current serial `for...await` loop.

**Step 2: Create worker client**

Create `src/workers/referenceWorkerClient.js` — a thin wrapper that posts messages to the worker and returns promises. Replaces direct `ReferenceManager.buildIndex()` calls from the main thread.

**Step 3: Commit**

```bash
git add src/workers/reference.worker.js src/workers/referenceWorkerClient.js
git commit -m "feat: reference worker for parallel index builds off main thread"
```

---

## Parallel Stream E: Rust Session Extension (independent)

### Task 9: Extend Rust SessionState struct

**Files:**
- Modify: `src-tauri/src/lib.rs:57-62` (SessionState struct)
- Modify: `src-tauri/src/lib.rs:318-332` (save_session_state command)
- Modify: `src-tauri/src/lib.rs:335-347` (load_session_state command)

**Step 1: Add new optional fields to SessionState**

At `src-tauri/src/lib.rs:57`:

```rust
use std::collections::HashMap;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct TabMetadata {
    #[serde(default)]
    scroll_top: f64,
    #[serde(default)]
    cursor_pos: usize,
    #[serde(default)]
    selection: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct SessionState {
    open_tabs: Vec<String>,
    expanded_folders: Vec<String>,
    #[serde(default)]
    recent_files: Vec<String>,

    // New — editor group layout tree (JSON blob)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    editor_layout: Option<serde_json::Value>,

    // New — per-tab metadata (scroll, cursor)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    editor_metadata: Option<HashMap<String, TabMetadata>>,
}
```

**Step 2: Update save_session_state to accept new params**

The new params are optional — the JS side sends them when available. Old callers that don't send them still work (serde defaults).

Update the command signature at `lib.rs:318`:

```rust
#[tauri::command]
fn save_session_state(
    app: tauri::AppHandle,
    workspace_path: String,
    open_tabs: Vec<String>,
    expanded_folders: Vec<String>,
    recent_files: Vec<String>,
    editor_layout: Option<serde_json::Value>,
    editor_metadata: Option<HashMap<String, TabMetadata>>,
) {
    // ... same store logic, just include new fields in SessionState
    let session = SessionState {
        open_tabs, expanded_folders, recent_files,
        editor_layout, editor_metadata,
    };
    // ... rest unchanged
}
```

**Step 3: Verify Rust compiles**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor
cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: compiles with no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: extend SessionState with editor_layout and editor_metadata"
```

---

## Sequential Stream F: Component Decomposition (depends on Tasks 1-4)

### Task 10: Create WorkspaceShell — the CSS grid layout container

**Files:**
- Create: `src/views/WorkspaceShell.jsx`

**Step 1: Create the shell**

This is the outermost layout component. It reads from `useLayoutStore` only and renders a CSS grid with slots for each zone. It replaces the `<div className="workspace-shell">` from Workspace.jsx.

```jsx
import React from 'react';
import { useLayoutStore } from '../stores/layout';

export default function WorkspaceShell({ children }) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const showRight = useLayoutStore((s) => s.showRight);
  const leftW = useLayoutStore((s) => s.leftW);
  const rightW = useLayoutStore((s) => s.rightW);

  const gridCols = [
    '48px', // icon sidebar
    showLeft ? `${leftW}px` : '0px',
    '1fr', // main
    showRight ? `${rightW}px` : '0px',
  ].join(' ');

  return (
    <div
      className="h-screen w-screen overflow-hidden grid grid-rows-[auto_1fr_auto]"
      style={{ gridTemplateColumns: gridCols }}
    >
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/views/WorkspaceShell.jsx
git commit -m "feat: create WorkspaceShell — CSS grid layout container"
```

---

### Task 11: Create MainContent — view router

**Files:**
- Create: `src/views/workspace/MainContent.jsx`

**Step 1: Create the component**

Reads `currentView` from `useViewStore`. Renders the matching view. Only one view is mounted at a time — switching unmounts the previous.

```jsx
import React, { lazy, Suspense } from 'react';
import { useViewStore } from '../../stores/views';
import ErrorBoundary from '../../components/ErrorBoundary';

const EditorGroupsView = lazy(() => import('./EditorGroupsView'));
const ProfessionalGraphView = lazy(() => import('../ProfessionalGraphView'));
const KanbanBoard = lazy(() => import('../../components/KanbanBoard'));
const BasesView = lazy(() => import('../../bases/BasesView'));
const CalendarView = lazy(() => import('../../components/Calendar').then(m => ({ default: m.CalendarView })));

export default function MainContent({ workspacePath, editorRef }) {
  const currentView = useViewStore((s) => s.currentView);

  const fallback = <div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>;

  return (
    <ErrorBoundary name="MainContent" message="View crashed">
      <Suspense fallback={fallback}>
        {currentView === 'editor' && <EditorGroupsView workspacePath={workspacePath} editorRef={editorRef} />}
        {currentView === 'graph' && <ProfessionalGraphView workspacePath={workspacePath} />}
        {currentView === 'kanban' && <KanbanBoard workspacePath={workspacePath} />}
        {currentView === 'bases' && <BasesView />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'marketplace' && <div>Marketplace</div>}
      </Suspense>
    </ErrorBoundary>
  );
}
```

**Step 2: Commit**

```bash
git add src/views/workspace/MainContent.jsx
git commit -m "feat: create MainContent — exclusive view router with lazy loading"
```

---

### Task 12: Create IconSidebar, Toolbar, LeftSidebar, RightSidebar, BottomPanel, ModalLayer

**Files:**
- Create: `src/views/workspace/IconSidebar.jsx`
- Create: `src/views/workspace/Toolbar.jsx`
- Create: `src/views/workspace/LeftSidebar.jsx`
- Create: `src/views/workspace/RightSidebar.jsx`
- Create: `src/views/workspace/BottomPanel.jsx`
- Create: `src/views/workspace/ModalLayer.jsx`

**Step 1: Extract each component from Workspace.jsx**

Each component is extracted from the corresponding section of `Workspace.jsx`'s render method. Key source locations:
- **IconSidebar**: Workspace.jsx lines ~580-700 (the 48px icon column)
- **Toolbar**: Workspace.jsx lines ~537-580 (the titlebar with tabs)
- **LeftSidebar**: Workspace.jsx lines ~700-850 (file tree, search, daily notes)
- **RightSidebar**: Workspace.jsx lines ~1200-1400 (outline, backlinks, graph sidebar, version history)
- **BottomPanel**: Workspace.jsx lines ~1180-1200 (terminal, output panels)
- **ModalLayer**: Workspace.jsx lines ~1400-1600 (all modals: command palette, search, shortcuts, etc.)

Each component subscribes to at most 2 stores and ~8 selectors.

**Store subscriptions:**
- IconSidebar → `useViewStore` (currentView, switchView)
- Toolbar → `useEditorGroupStore` (focused group's tabs), `useViewStore` (currentView)
- LeftSidebar → `useFileTreeStore` (fileTree, expandedFolders, selectedPath, creatingItem, renamingPath)
- RightSidebar → `useEditorGroupStore` (focused group's activeTab), `useViewStore` (versionHistory)
- BottomPanel → `useLayoutStore` (bottomPanelHeight, bottomPanelTab)
- ModalLayer → `useViewStore` (all panel flags)

**Step 2: Commit**

```bash
git add src/views/workspace/IconSidebar.jsx src/views/workspace/Toolbar.jsx src/views/workspace/LeftSidebar.jsx src/views/workspace/RightSidebar.jsx src/views/workspace/BottomPanel.jsx src/views/workspace/ModalLayer.jsx
git commit -m "feat: extract 6 workspace sub-components from Workspace.jsx"
```

---

### Task 13: Rewrite EditorGroup.jsx with content cache integration

**Files:**
- Modify: `src/components/EditorGroup.jsx` (196 lines → rewrite)

**Step 1: Rewrite to use useEditorGroupStore**

The current EditorGroup uses local `useState` for content — this is the root cause of tab cross-contamination. Rewrite it to:
1. Read its own group from `useEditorGroupStore` via `findGroup(groupId)`
2. Cache ProseMirror JSON via `setTabContent(groupId, tabPath, { prosemirrorDoc, rawMarkdown, ... })`
3. Own its own TipTap editor instance (not shared)
4. Handle save within its own scope (no global `editorContent`)

Key changes:
- Replace `useState('')` for editorContent → read from `group.contentByTab[activeTab]`
- On tab switch: if cached ProseMirror doc exists, restore instantly without disk read
- On first open: read from disk, compile, cache
- On editor change: update `contentByTab` (debounced)
- Save: read ProseMirror doc from local editor, serialize via @tiptap/markdown, write to disk

Remove all content type routing for graph/bases/kanban (those are views now, not tabs).

**Step 2: Commit**

```bash
git add src/components/EditorGroup.jsx
git commit -m "feat: rewrite EditorGroup with content cache and own TipTap instance"
```

---

### Task 14: Update EditorGroupsContainer.jsx for new store

**Files:**
- Modify: `src/components/EditorGroupsContainer.jsx` (165 lines)

**Step 1: Update props to read from store instead of prop drilling**

The current component receives 15+ props. Simplify to read from `useEditorGroupStore` directly. Each `EditorGroup` leaf gets wrapped in an `<ErrorBoundary key={group.id}>`.

Key changes:
- Remove prop drilling for `focusedGroupId`, `unsavedChanges`, `openTabs`
- Wrap each `<EditorGroup>` in `<ErrorBoundary key={group.id} name={group.id} message="This pane crashed">`
- Keep the resize handler logic (it works fine)
- `onSizeChange` calls `useEditorGroupStore.getState().updateSizes(containerId, sizes)`

**Step 2: Commit**

```bash
git add src/components/EditorGroupsContainer.jsx
git commit -m "feat: update EditorGroupsContainer for store-based rendering with error boundaries"
```

---

## Sequential Stream G: Wiring (depends on all above)

### Task 15: Adapt useShortcuts for new stores

**Files:**
- Modify: `src/features/shortcuts/hooks/useShortcuts.js` (193 lines)

**Step 1: Replace all `useWorkspaceStore` references**

Search-and-replace store references:
- `useWorkspaceStore.getState().toggleLeft()` → `useLayoutStore.getState().toggleLeft()`
- `useWorkspaceStore.getState().togglePanel(...)` → `useViewStore.getState().togglePanel(...)`
- `useWorkspaceStore.getState().toggleView(...)` → `useViewStore.getState().switchView(...)` (state machine!)
- `useWorkspaceStore.getState().toggleSplit()` → `useEditorGroupStore.getState().splitGroup(...)` (focused group)
- Tab navigation (next/prev) → operates on focused group from `useEditorGroupStore`
- `closeTab` → `useEditorGroupStore.getState().removeTab(focusedGroupId, path)`
- `reopenClosed` → `useEditorGroupStore.getState().reopenClosed(focusedGroupId)`
- `refreshTree` → `useFileTreeStore.getState().refreshTree()`

Remove all split-view shortcuts (toggleSplit, toggleDirection, resetPaneSize, syncScrolling).

**Step 2: Commit**

```bash
git add src/features/shortcuts/hooks/useShortcuts.js
git commit -m "refactor: adapt useShortcuts to 4 independent stores"
```

---

### Task 16: Adapt useWorkspaceSession for new stores

**Files:**
- Modify: `src/features/workspace/useWorkspaceSession.js` (347 lines)

**Step 1: Replace store references**

- File tree operations → `useFileTreeStore`
- Tab operations → `useEditorGroupStore`
- Content loading → per-group via `useEditorGroupStore.getState().setTabContent()`
- Session save → include `editor_layout` and `editor_metadata` in `invoke('save_session_state', ...)`
- Session load → if `session.editor_layout` exists, call `useEditorGroupStore.getState().restoreLayout(session.editor_layout)`; else build single group from `open_tabs`
- Reference manager → use worker client instead of direct `referenceManager.buildIndex()`

Remove:
- `setContent()` / `setSavedContent()` / `setTitle()` / `setLoading()` calls (global editor state gone)
- The 7-setState file loading sequence (replaced by per-group content cache)

**Step 2: Commit**

```bash
git add src/features/workspace/useWorkspaceSession.js
git commit -m "refactor: adapt useWorkspaceSession to EditorGroupStore + session layout"
```

---

### Task 17: Adapt useWorkspaceEvents for new stores

**Files:**
- Modify: `src/features/workspace/useWorkspaceEvents.js` (435 lines)

**Step 1: Replace store references**

Event handlers that interact with the store need updating:
- `lokus:open-file` → `useEditorGroupStore.getState().addTab(focusedGroupId, tab)`
- Wiki link creation → operates on focused group's editor
- File rename/move → `useEditorGroupStore.getState().updateTabPath()`
- `useWorkspaceStore` → split into appropriate store per action

**Step 2: Commit**

```bash
git add src/features/workspace/useWorkspaceEvents.js
git commit -m "refactor: adapt useWorkspaceEvents to 4 independent stores"
```

---

### Task 18: Adapt useSave for per-group operation

**Files:**
- Modify: `src/features/editor/hooks/useSave.js` (159 lines)

**Step 1: Rewrite to work per-group**

The current `handleSave` reads `activeFile` and `editorContent` from global store — this is the save+close race condition. Rewrite to:
1. Accept `groupId` parameter (or read from focused group)
2. Read content from the group's own TipTap editor instance (not global state)
3. Serialize via @tiptap/markdown (not MarkdownExporter)
4. Remove `MarkdownExporter` import entirely

```js
// NEW: handleSave takes the editor instance and file path directly
const handleSave = useCallback(async (editor, filePath, groupId) => {
  if (!editor || !filePath) return;

  // Get markdown directly from editor via @tiptap/markdown
  const markdown = editor.storage.markdown?.getMarkdown?.()
    || editor.getHTML(); // fallback

  await invoke('write_file_content', { path: filePath, content: markdown });

  useEditorGroupStore.getState().markTabDirty(groupId, filePath, false);
  // ... version history, graph update
}, [...]);
```

**Step 2: Commit**

```bash
git add src/features/editor/hooks/useSave.js
git commit -m "refactor: rewrite useSave for per-group operation with @tiptap/markdown"
```

---

### Task 19: Adapt useTabs for EditorGroupStore

**Files:**
- Modify: `src/features/tabs/hooks/useTabs.js`

**Step 1: Replace store references**

- `openTab` → `useEditorGroupStore.getState().addTab(focusedGroupId, tab)`
- `closeTab` → `useEditorGroupStore.getState().removeTab(focusedGroupId, path)`
- `switchTab` → `useEditorGroupStore.getState().setActiveTab(focusedGroupId, path)`
- Remove `MAX_OPEN_TABS` limit (LRU eviction handles memory)

**Step 2: Commit**

```bash
git add src/features/tabs/hooks/useTabs.js
git commit -m "refactor: adapt useTabs to EditorGroupStore"
```

---

### Task 20: Wire new Workspace.jsx (the slim orchestrator)

**Files:**
- Modify: `src/views/Workspace.jsx` (2102 lines → ~200 lines)

**Step 1: Rewrite Workspace.jsx as thin orchestrator**

The new Workspace.jsx does almost nothing itself. It:
1. Receives `path` prop from App.jsx
2. Wraps everything in context providers (FolderScope, Bases, Plugins, DnD)
3. Renders `<WorkspaceShell>` with the 7 sub-components
4. Renders `<ShortcutListener />`

All 56 Zustand selectors are gone. All inline logic is gone. All JSX layout is in sub-components.

```jsx
import React from 'react';
import WorkspaceShell from './WorkspaceShell';
import Toolbar from './workspace/Toolbar';
import IconSidebar from './workspace/IconSidebar';
import LeftSidebar from './workspace/LeftSidebar';
import MainContent from './workspace/MainContent';
import RightSidebar from './workspace/RightSidebar';
import BottomPanel from './workspace/BottomPanel';
import ModalLayer from './workspace/ModalLayer';
import ErrorBoundary from '../components/ErrorBoundary';
import { ShortcutListener } from '../features/shortcuts';
import { FolderScopeProvider } from '../contexts/FolderScopeContext';
import { BasesProvider } from '../bases/BasesContext';
// ... other providers

export default function Workspace({ path }) {
  return (
    <FolderScopeProvider workspacePath={path}>
      <BasesProvider workspacePath={path}>
        <WorkspaceShell>
          <Toolbar workspacePath={path} />
          <IconSidebar />
          <ErrorBoundary name="LeftSidebar" message="Sidebar crashed">
            <LeftSidebar workspacePath={path} />
          </ErrorBoundary>
          <ErrorBoundary name="MainContent" message="View crashed">
            <MainContent workspacePath={path} />
          </ErrorBoundary>
          <ErrorBoundary name="RightSidebar" message="Panel crashed">
            <RightSidebar workspacePath={path} />
          </ErrorBoundary>
          <BottomPanel />
          <ErrorBoundary name="ModalLayer" message="Modal crashed">
            <ModalLayer workspacePath={path} />
          </ErrorBoundary>
        </WorkspaceShell>
        <ShortcutListener workspacePath={path} />
      </BasesProvider>
    </FolderScopeProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/views/Workspace.jsx
git commit -m "refactor: slim Workspace.jsx to ~200-line orchestrator"
```

---

### Task 21: Fix main-thread blockers

**Files:**
- Modify: `src/editor/extensions/MarkdownPaste.js` — singleton compiler at module scope
- Modify: `src/features/workspace/useWorkspaceSession.js` — use reference worker client
- Modify: `src/core/references/ReferenceManager.js` — delegate to worker

**Step 1: MarkdownPaste — singleton compiler**

Current: `new MarkdownCompiler()` on every paste event (line 43).
Fix: Create compiler once at module scope.

```js
// At top of file, outside any function:
let _compiler = null;
const getCompiler = () => {
  if (!_compiler) _compiler = getMarkdownCompiler();
  return _compiler;
};
```

**Step 2: ReferenceManager — delegate to worker**

Update `buildIndex` to post file list to `reference.worker.js` instead of serial for-loop.

**Step 3: Commit**

```bash
git add src/editor/extensions/MarkdownPaste.js src/core/references/ReferenceManager.js
git commit -m "perf: fix main-thread blockers — singleton compiler, reference worker"
```

---

### Task 22: Delete old code

**Files:**
- Delete: `src/stores/workspace.js` (436 lines)
- Delete: `src/features/split-view/` (entire directory)
- Delete: `src/components/SplitEditor/` (entire directory)
- Delete: `src/core/export/markdown-exporter.js` (511 lines)
- Delete: `src/core/markdown/compiler-logic.js`
- Delete: `src/core/markdown/compiler.js`
- Delete: `src/core/markdown/markdown.worker.js`
- Delete: `src/hooks/useEditorGroups.js` (381 lines — replaced by store)

**Step 1: Delete files**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor
rm src/stores/workspace.js
rm -rf src/features/split-view/
rm -rf src/components/SplitEditor/
rm src/core/export/markdown-exporter.js
rm -f src/core/markdown/compiler-logic.js
rm -f src/core/markdown/compiler.js
rm -f src/core/markdown/markdown.worker.js
rm src/hooks/useEditorGroups.js
```

**Step 2: Fix all broken imports**

Search for every file that imports from deleted modules and update:
- `import { useWorkspaceStore }` → appropriate new store
- `import { MarkdownExporter }` → remove (replaced by @tiptap/markdown)
- `import { getMarkdownCompiler }` → remove or replace
- `import SplitEditor` → remove
- `import { useSplitView }` → remove
- `import { useEditorGroups }` → `import { useEditorGroupStore }`

Run: `grep -r "from.*stores/workspace" src/ --include="*.js" --include="*.jsx" -l` to find all files.

**Step 3: Verify build**

Run:
```bash
npm run build 2>&1 | head -50
```

Fix any remaining import errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete old workspace store, split-view, markdown-exporter, compiler"
```

---

### Task 23: Verify app compiles and runs

**Files:** None — verification only

**Step 1: Full build**

Run:
```bash
cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/workspace-refactor
npm run build
```
Expected: builds with zero errors.

**Step 2: Tauri dev**

Run:
```bash
npm run tauri dev
```
Expected: app launches, workspace loads, can open/edit/save files.

**Step 3: Smoke test the 4 bugs**

1. **Tab cross-contamination**: Open file A, type, open file B, type, save B, close B → verify A's content is preserved
2. **Split pane**: Drag tab to split → verify independent editing, no crashes
3. **View switching**: Switch to graph → back to editor → verify editor state preserved
4. **Performance**: Open file → should feel instant (no 7-setState cascade)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues from workspace overhaul"
```

---

## Parallel Dispatch Map

```
INDEPENDENT (can all run in parallel):
  Stream A: Tasks 1-4  (4 Zustand stores)
  Stream B: Task 5     (ErrorBoundary)
  Stream C: Tasks 6-7  (tiptap/markdown)
  Stream D: Task 8     (Reference worker)
  Stream E: Task 9     (Rust SessionState)

DEPENDS ON Stream A:
  Stream F: Tasks 10-14 (Component decomposition)

DEPENDS ON Streams A + B + C + D + E + F:
  Stream G: Tasks 15-23 (Wiring, cleanup, verification)
```

Dispatch 5 agents in parallel for Streams A-E. Once all 5 complete, dispatch agents for Stream F. Once F completes, dispatch sequential Stream G.
