import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Layout Slice
// ---------------------------------------------------------------------------
const createLayoutSlice = (set) => ({
  // State
  showLeft: true,
  showRight: true,
  leftW: 280,
  rightW: 280,
  bottomPanelHeight: 250,
  bottomPanelTab: 'terminal',

  // Actions
  toggleLeft: () => set((s) => ({ showLeft: !s.showLeft })),
  toggleRight: () => set((s) => ({ showRight: !s.showRight })),
  setLeftW: (px) => set({ leftW: px }),
  setRightW: (px) => set({ rightW: px }),
  setBottomHeight: (px) => set({ bottomPanelHeight: px }),
  setBottomTab: (tab) => set({ bottomPanelTab: tab }),
});

// ---------------------------------------------------------------------------
// Panels Slice
// ---------------------------------------------------------------------------

// Maps each panel name to the state key(s) it controls. Panels that carry
// auxiliary "data" payloads map to [flagKey, dataKey]; simple boolean panels
// map to just the flag key string.
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
};

const createPanelsSlice = (set) => ({
  // State
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

  // Actions
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
});

// ---------------------------------------------------------------------------
// Views Slice
// ---------------------------------------------------------------------------

const VIEW_KEYS = [
  'showGraphView',
  'showKanban',
  'showPlugins',
  'showBases',
  'showMarketplace',
  'showCalendarPanel',
  'showDailyNotesPanel',
  'showTerminalPanel',
  'showOutputPanel',
];

const createViewsSlice = (set) => ({
  // State
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

  // Actions
  switchView: (view) => set({ currentView: view }),

  toggleView: (name) =>
    set((s) => ({ [name]: !s[name] })),

  closeAllViews: () =>
    set(Object.fromEntries(VIEW_KEYS.map((k) => [k, false]))),
});

// ---------------------------------------------------------------------------
// Tabs Slice
// ---------------------------------------------------------------------------

const MAX_TABS = 10;
const MAX_RECENT_CLOSED = 20;
const MAX_RECENT_FILES = 50;

const createTabsSlice = (set, get) => ({
  // State
  openTabs: [],
  activeFile: null,
  unsavedChanges: new Set(),
  recentlyClosedTabs: [],
  recentFiles: [],

  // Actions
  openTab: (path, name) => {
    const { openTabs } = get();
    const exists = openTabs.find((t) => t.path === path);
    if (exists) {
      set({ activeFile: path });
      return;
    }
    const newTab = { path, name: name ?? path };
    const trimmed =
      openTabs.length >= MAX_TABS ? openTabs.slice(1) : openTabs;
    set({ openTabs: [...trimmed, newTab], activeFile: path });
  },

  closeTab: (path) => {
    const { openTabs, activeFile, recentlyClosedTabs } = get();
    const idx = openTabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    const closedTab = openTabs[idx];
    const nextTabs = openTabs.filter((t) => t.path !== path);

    let nextActive = activeFile;
    if (activeFile === path) {
      if (nextTabs.length === 0) {
        nextActive = null;
      } else {
        // prefer the tab to the right, fall back to the left
        nextActive = (nextTabs[idx] ?? nextTabs[idx - 1]).path;
      }
    }

    const nextRecentlyClosed = [
      closedTab,
      ...recentlyClosedTabs,
    ].slice(0, MAX_RECENT_CLOSED);

    set({
      openTabs: nextTabs,
      activeFile: nextActive,
      recentlyClosedTabs: nextRecentlyClosed,
    });
  },

  switchTab: (path) => set({ activeFile: path }),

  reopenClosed: () => {
    const { recentlyClosedTabs, openTabs } = get();
    if (recentlyClosedTabs.length === 0) return;
    const [last, ...rest] = recentlyClosedTabs;
    const alreadyOpen = openTabs.find((t) => t.path === last.path);
    if (alreadyOpen) {
      set({ activeFile: last.path, recentlyClosedTabs: rest });
      return;
    }
    const trimmed =
      openTabs.length >= MAX_TABS ? openTabs.slice(1) : openTabs;
    set({
      openTabs: [...trimmed, last],
      activeFile: last.path,
      recentlyClosedTabs: rest,
    });
  },

  markUnsaved: (path) =>
    set((s) => ({ unsavedChanges: new Set([...s.unsavedChanges, path]) })),

  markSaved: (path) =>
    set((s) => {
      const next = new Set(s.unsavedChanges);
      next.delete(path);
      return { unsavedChanges: next };
    }),

  updateTabName: (oldPath, newPath) =>
    set((s) => {
      const openTabs = s.openTabs.map((t) =>
        t.path === oldPath ? { ...t, path: newPath } : t
      );
      const unsavedChanges = new Set(
        [...s.unsavedChanges].map((p) => (p === oldPath ? newPath : p))
      );
      return {
        openTabs,
        unsavedChanges,
        activeFile: s.activeFile === oldPath ? newPath : s.activeFile,
      };
    }),

  addRecentFile: (path) =>
    set((s) => {
      const filtered = s.recentFiles.filter((p) => p !== path);
      return {
        recentFiles: [path, ...filtered].slice(0, MAX_RECENT_FILES),
      };
    }),
});

// ---------------------------------------------------------------------------
// FileTree Slice
// ---------------------------------------------------------------------------

const createFileTreeSlice = (set) => ({
  // State
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

  // Actions
  setFileTree: (tree) => set({ fileTree: tree }),

  toggleFolder: (path) =>
    set((s) => {
      const next = new Set(s.expandedFolders);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
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
});

// ---------------------------------------------------------------------------
// Editor Slice
// ---------------------------------------------------------------------------

const createEditorSlice = (set) => ({
  // State
  editorContent: '',
  savedContent: '',
  editorTitle: '',
  isLoadingContent: false,
  editor: null,
  versionRefreshKey: 0,

  // Actions
  setContent: (html) => set({ editorContent: html }),
  setSavedContent: (html) => set({ savedContent: html }),
  setTitle: (name) => set({ editorTitle: name }),
  setLoading: (bool) => set({ isLoadingContent: bool }),
  setEditor: (editor) => set({ editor }),
  incrementVersionRefreshKey: () =>
    set((s) => ({ versionRefreshKey: s.versionRefreshKey + 1 })),
});

// ---------------------------------------------------------------------------
// SplitView Slice
// ---------------------------------------------------------------------------

const createSplitViewSlice = (set) => ({
  // State
  useSplitView: false,
  splitDirection: 'vertical',
  leftPaneSize: 50,
  rightPaneFile: null,
  rightPaneContent: '',
  rightPaneTitle: '',
  syncScrolling: false,
  draggedTabForSplit: null,
  splitInitData: null,

  // Actions
  toggleSplit: () => set((s) => ({ useSplitView: !s.useSplitView })),

  toggleDirection: () =>
    set((s) => ({
      splitDirection: s.splitDirection === 'vertical' ? 'horizontal' : 'vertical',
    })),

  setPaneSize: (pct) => set({ leftPaneSize: pct }),

  resetPaneSize: () => set({ leftPaneSize: 50 }),

  openInSplit: (path, content, title) =>
    set({
      useSplitView: true,
      rightPaneFile: path,
      rightPaneContent: content,
      rightPaneTitle: title,
    }),

  setSyncScrolling: (bool) => set({ syncScrolling: bool }),

  setDraggedTabForSplit: (tab) => set({ draggedTabForSplit: tab }),

  setSplitInitData: (data) => set({ splitInitData: data }),
});

// ---------------------------------------------------------------------------
// Graph Slice
// ---------------------------------------------------------------------------

const createGraphSlice = (set) => ({
  // State
  graphData: null,
  isLoadingGraph: false,
  graphSidebarData: {
    selectedNodes: [],
    hoveredNode: null,
    graphData: { nodes: [], links: [] },
    stats: {},
  },
  allImageFiles: [],

  // Actions
  setGraphData: (data) => set({ graphData: data }),
  setLoadingGraph: (bool) => set({ isLoadingGraph: bool }),
  setGraphSidebar: (data) =>
    set((s) => ({ graphSidebarData: { ...s.graphSidebarData, ...data } })),
  setAllImageFiles: (files) => set({ allImageFiles: files }),
});

// ---------------------------------------------------------------------------
// Combined store
// ---------------------------------------------------------------------------

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
