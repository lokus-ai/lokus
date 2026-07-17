import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * tabMeta — per-tab metadata, keyed `${groupId}${path}` (same
 * separator style as tabModels).
 *
 * { [key]: { dirty, savedContent, title, lastAccessed } }
 *
 * Lives OUTSIDE the layout tree so transition-guarded updates (dirty flag,
 * title commit, save) never rebuild `layout` — and unchanged-value writes
 * (e.g. a per-keystroke dirty check reporting the same flag) do not notify
 * subscribers at all.
 *
 * Subscriber selectors must select a single key or a primitive (or a
 * shallow-compared array of paths) — never the whole map.
 */

const key = (groupId, path) => `${groupId}\u0000${path}`;

export const useTabMetaStore = create(
  subscribeWithSelector((set, get) => ({
    tabs: {},

    // Transition-only: an unchanged dirty flag returns state untouched, so
    // no notification fires.
    setDirty: (groupId, path, dirty) =>
      set((s) => {
        const k = key(groupId, path);
        const entry = s.tabs[k];
        if ((entry?.dirty ?? false) === dirty) return s;
        return { tabs: { ...s.tabs, [k]: { ...entry, dirty } } };
      }),

    setSaved: (groupId, path, savedContent) =>
      set((s) => ({
        tabs: { ...s.tabs, [key(groupId, path)]: { ...s.tabs[key(groupId, path)], savedContent } },
      })),

    setTitle: (groupId, path, title) =>
      set((s) => ({
        tabs: { ...s.tabs, [key(groupId, path)]: { ...s.tabs[key(groupId, path)], title } },
      })),

    touch: (groupId, path) =>
      set((s) => ({
        tabs: { ...s.tabs, [key(groupId, path)]: { ...s.tabs[key(groupId, path)], lastAccessed: Date.now() } },
      })),

    remove: (groupId, path) =>
      set((s) => {
        const k = key(groupId, path);
        if (!(k in s.tabs)) return s;
        const tabs = { ...s.tabs };
        delete tabs[k];
        return { tabs };
      }),

    // Re-key a file's metadata in every group (mirrors renameTabModel).
    renameKey: (oldPath, newPath) =>
      set((s) => {
        const suffix = `\u0000${oldPath}`;
        let tabs = s.tabs;
        for (const [k, meta] of Object.entries(s.tabs)) {
          if (k.endsWith(suffix)) {
            if (tabs === s.tabs) tabs = { ...s.tabs };
            delete tabs[k];
            tabs[k.slice(0, -oldPath.length) + newPath] = meta;
          }
        }
        return tabs === s.tabs ? s : { tabs };
      }),

    clearGroup: (groupId) =>
      set((s) => {
        const prefix = `${groupId}\u0000`;
        let tabs = s.tabs;
        for (const k of Object.keys(s.tabs)) {
          if (k.startsWith(prefix)) {
            if (tabs === s.tabs) tabs = { ...s.tabs };
            delete tabs[k];
          }
        }
        return tabs === s.tabs ? s : { tabs };
      }),

    clearAll: () => set({ tabs: {} }),
  }))
);

/** Non-reactive single-entry read (save paths, close guard, export). */
export function getTabMeta(groupId, path) {
  return useTabMetaStore.getState().tabs[key(groupId, path)] ?? null;
}

/**
 * Selector factory: dirty paths of one group, as an array (stable between
 * renders when paired with useShallow). Never returns the whole map.
 */
export const selectGroupDirtyPaths = (groupId) => (s) => {
  const paths = [];
  if (!groupId) return paths;
  const prefix = `${groupId}\u0000`;
  for (const [k, meta] of Object.entries(s.tabs)) {
    if (k.startsWith(prefix) && meta?.dirty) paths.push(k.slice(prefix.length));
  }
  return paths;
};

/** Selector: dirty paths across every group (pair with useShallow). */
export const selectAllDirtyPaths = (s) => {
  const paths = [];
  for (const [k, meta] of Object.entries(s.tabs)) {
    if (meta?.dirty) paths.push(k.slice(k.indexOf('\u0000') + 1));
  }
  return paths;
};
