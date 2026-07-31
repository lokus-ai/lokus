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

/** Mirrors linkIndex's attachment rule: an extension of 1–6 chars containing
    at least one letter. Anything else (`.excalidraw`, no extension) is not a
    graph node at all — feeding it would surface junk as if it were a note. */
const ATTACH_EXT_RE = /\.(?=[a-z0-9]{1,6}$)[a-z0-9]*[a-z][a-z0-9]*$/i;

/**
 * Split the file tree into what the index gets seeded with and what actually
 * has to be read.
 *
 * `all` includes attachments (images, PDFs, …) so a `[[cover.png]]` resolves
 * to the real file instead of a permanent "missing attachment" ghost — the
 * index classifies each path itself. Only markdown is read: nothing else has
 * links or tags in it.
 */
function flattenFiles(entries, out = { all: [], markdown: [] }) {
  for (const e of entries || []) {
    if (e.is_directory) { flattenFiles(e.children, out); continue; }
    const path = e.path;
    if (!path) continue;
    if (path.endsWith('.md')) {
      out.all.push(path);
      out.markdown.push(path);
    } else if (ATTACH_EXT_RE.test(path.split('/').pop() || '')) {
      out.all.push(path);
    }
  }
  return out;
}

// Boot generation. A workspace switch (or reset) invalidates any in-flight
// boot so its async tail can never mark the NEW workspace ready — or worse,
// write the old vault's contents into the new index.
let bootToken = 0;

// Saves that land mid-boot: the bulk `read_all_files` snapshot was taken
// before them, so replaying after the snapshot is what keeps the index honest.
let pendingSaves = [];

export const useGraphStore = create((set, get) => ({
  workspacePath: null,
  index: null,
  status: 'idle', // 'idle' | 'booting' | 'ready' | 'error'
  version: 0,     // bumped on every index mutation — cheap reactivity
  error: null,

  /**
   * Boot the index for a workspace. Idempotent per workspacePath.
   *
   * `contents` is an optional promise of the `{path: text}` map for the
   * vault's markdown, so a caller that already has to read every file can
   * hand over its payload instead of making us read the whole vault a second
   * time. Passing a promise rather than a resolved map matters: boot marks
   * itself 'booting' synchronously, which is what arms the pendingSaves
   * replay for the duration of the read.
   */
  async boot(workspacePath, fileTree, contents = null) {
    const { workspacePath: current, status } = get();
    if (current === workspacePath && (status === 'ready' || status === 'booting')) return;

    const index = createLinkIndex();
    index.subscribe(() => set((s) => ({ version: s.version + 1 })));
    const token = ++bootToken;
    pendingSaves = [];
    set({ workspacePath, index, status: 'booting', error: null, version: 0 });

    try {
      const { all, markdown } = flattenFiles(fileTree);
      index.setFiles(all);

      if (markdown.length > 0) {
        const byPath = await (contents ?? invoke('read_all_files', { paths: markdown }));
        if (token !== bootToken) return; // a newer workspace took over
        for (const [path, content] of Object.entries(byPath)) {
          if (typeof content === 'string') index.indexContent(path, content);
        }
      }
      if (token !== bootToken) return;
      for (const [path, content] of pendingSaves) index.indexContent(path, content);
      pendingSaves = [];
      index.bootDone();
      set({ status: 'ready' });
    } catch (error) {
      if (token !== bootToken) return;
      set({ status: 'error', error: String(error?.message || error) });
    }
  },

  /** The single hook for saves: re-parse exactly one file. */
  noteSaved(path, content) {
    const { index, status } = get();
    if (!index) return;
    if (status === 'booting') { pendingSaves.push([path, content]); return; }
    if (status !== 'ready') return;
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
    bootToken++;
    pendingSaves = [];
    set({ workspacePath: null, index: null, status: 'idle', version: 0, error: null });
  },
}));

/** Convenience selectors. */
export const selectGraphNodes = (s) => (s.index ? s.index.nodes() : []);
export const selectGraphLinks = (s) => (s.index ? s.index.links() : []);
export const selectGraphStats = (s) =>
  s.index ? s.index.stats() : { files: 0, links: 0, phantoms: 0 };
