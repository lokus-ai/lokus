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
  contentByTab: {},
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
  const dirty = entries.filter(([, v]) => v.dirty);
  const clean = entries.filter(([, v]) => !v.dirty);
  clean.sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));
  return Object.fromEntries([...dirty, ...clean.slice(0, MAX_CACHED_TABS - dirty.length)]);
};

const defaultGroup = createGroup([], null);

export const useEditorGroupStore = create(
  subscribeWithSelector((set, get) => ({
    layout: defaultGroup,
    focusedGroupId: defaultGroup.id,
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
        const maxId = JSON.stringify(layoutJson).match(/(?:group|container)-(\d+)/g)?.reduce((max, match) => {
          const num = parseInt(match.split('-')[1]);
          return Math.max(max, num);
        }, 0) || 0;
        idCounter = maxId;
        const ensureContentByTab = (node) => {
          if (node.type === 'group' && !node.contentByTab) node.contentByTab = {};
          if (node.type === 'container') node.children?.forEach(ensureContentByTab);
          return node;
        };
        ensureContentByTab(layoutJson);
        const groups = getAllGroupsFromTree(layoutJson);
        set({ layout: layoutJson, focusedGroupId: groups[0]?.id || null });
      } catch {
        const group = createGroup([], null);
        set({ layout: group, focusedGroupId: group.id });
      }
    },
  }))
);
