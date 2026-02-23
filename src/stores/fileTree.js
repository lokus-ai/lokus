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
