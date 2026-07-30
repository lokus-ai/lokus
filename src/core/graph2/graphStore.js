/**
 * graphStore — the app-facing singleton around linkIndex.
 *
 * One index per workspace. Boot: structure from the file-tree store (free,
 * already loaded), contents in one bulk `read_all_files` pass. After boot,
 * everything is incremental:
 *   - saveTab          → updateContent(path, serialized)   (re-parses 1 file)
 *   - file-tree ops    → addFile / removeFile / renameFile
 *   - components       → useGraphStore(selector) / subscribe()
 *
 * No filesystem watcher, no reload loop, no O(vault) work per save.
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { createLinkIndex } from './linkIndex.js';

function flattenMdPaths(entries, out = []) {
  for (const e of entries || []) {
    if (e.is_directory) flattenMdPaths(e.children, out);
    else if (e.path?.endsWith('.md')) out.push(e.path);
  }
  return out;
}

export const useGraphStore = create((set, get) => ({
  workspacePath: null,
  index: null,
  status: 'idle', // 'idle' | 'booting' | 'ready' | 'error'
  version: 0,     // bumped on every index mutation — cheap reactivity
  error: null,

  /** Boot the index for a workspace. Idempotent per workspacePath. */
  async boot(workspacePath, fileTree) {
    const { workspacePath: current, status } = get();
    if (current === workspacePath && (status === 'ready' || status === 'booting')) return;

    const index = createLinkIndex();
    index.subscribe(() => set((s) => ({ version: s.version + 1 })));
    set({ workspacePath, index, status: 'booting', error: null, version: 0 });

    try {
      const paths = flattenMdPaths(fileTree);
      index.setFiles(paths);

      if (paths.length > 0) {
        const contents = await invoke('read_all_files', { paths });
        for (const [path, content] of Object.entries(contents)) {
          if (typeof content === 'string') index.indexContent(path, content);
        }
      }
      index.bootDone();
      set({ status: 'ready' });
    } catch (error) {
      set({ status: 'error', error: String(error?.message || error) });
    }
  },

  /** The single hook for saves: re-parse exactly one file. */
  noteSaved(path, content) {
    const { index, status } = get();
    if (!index || status !== 'ready') return;
    index.updateContent(path, content);
  },

  fileCreated(path) {
    get().index?.addFile(path);
  },

  fileRemoved(path) {
    get().index?.removeFile(path);
  },

  fileRenamed(oldPath, newPath) {
    get().index?.renameFile(oldPath, newPath);
  },

  /** Full reset (workspace switch / sign-out). */
  reset() {
    set({ workspacePath: null, index: null, status: 'idle', version: 0, error: null });
  },
}));

/** Convenience selectors. */
export const selectGraphNodes = (s) => (s.index ? s.index.nodes() : []);
export const selectGraphLinks = (s) => (s.index ? s.index.links() : []);
export const selectGraphStats = (s) =>
  s.index ? s.index.stats() : { files: 0, links: 0, phantoms: 0 };
