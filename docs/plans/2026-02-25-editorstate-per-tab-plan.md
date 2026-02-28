# EditorState-Per-Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix cross-file content bleed, shared undo history, and race conditions by storing a full ProseMirror EditorState per tab and swapping via `view.updateState()`.

**Architecture:** Each EditorGroup keeps an in-memory `Map<string, EditorState>` (one entry per open file). On tab switch, the departing tab's `view.state` is saved into the map; the arriving tab's EditorState is restored via `view.updateState()`. Zustand store's `contentByTab` retains only serializable metadata (savedContent, title, dirty, lastAccessed). Session persistence saves tab paths only — EditorState is rebuilt from disk on app restart.

**Tech Stack:** ProseMirror (EditorState, EditorView), Zustand, React refs, Tauri IPC

**Design doc:** `docs/plans/2026-02-25-editorstate-per-tab-design.md`

---

### Task 1: Fix LRU eviction to protect dirty tabs

**Files:**
- Modify: `src/stores/editorGroups.js:67-73`

**Step 1: Replace the `evictLRU` function**

```js
// LRU eviction: remove least-recently-accessed CLEAN entries beyond MAX_CACHED_TABS.
// Dirty (unsaved) entries are never evicted — losing unsaved edits silently is unacceptable.
const evictLRU = (contentByTab) => {
  const entries = Object.entries(contentByTab);
  if (entries.length <= MAX_CACHED_TABS) return contentByTab;
  const dirty = entries.filter(([, v]) => v.dirty);
  const clean = entries.filter(([, v]) => !v.dirty);
  clean.sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));
  return Object.fromEntries([...dirty, ...clean.slice(0, MAX_CACHED_TABS - dirty.length)]);
};
```

Replace lines 67-73 with the above.

**Step 2: Verify no tests break**

Run: `cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/fixing-root && npx vitest run --reporter=verbose 2>&1 | tail -30`

**Step 3: Commit**

```
git add src/stores/editorGroups.js
git commit -m "fix: protect dirty tabs from LRU cache eviction"
```

---

### Task 2: Set `__LOKUS_ACTIVE_FILE__` on tab switch

**Files:**
- Modify: `src/components/EditorGroup.jsx:86` (insert after the title effect)

**Step 1: Add the effect**

Insert after line 86 (after the title `useEffect` closing):

```js
  // ── Set global active file for wiki-link resolution, tag indexing, etc. ──
  useEffect(() => {
    if (activeFile) {
      try { globalThis.__LOKUS_ACTIVE_FILE__ = activeFile; } catch {}
    }
  }, [activeFile]);
```

**Step 2: Verify no tests break**

Run: `cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/fixing-root && npx vitest run --reporter=verbose 2>&1 | tail -30`

**Step 3: Commit**

```
git add src/components/EditorGroup.jsx
git commit -m "fix: set __LOKUS_ACTIVE_FILE__ on tab switch for wiki-link resolution"
```

---

### Task 3: Strip `contentByTab` from session persistence

When the layout is saved to disk via `save_session_state`, `contentByTab` is included (it's part of the layout tree). After we move EditorState out of the store, `contentByTab` will only have metadata — but we should explicitly strip it on persist to keep session files clean and avoid serializing stale data.

**Files:**
- Modify: `src/features/workspace/useWorkspaceSession.js:107-126`

**Step 1: Add a layout sanitizer before save**

Replace lines 107-126 with:

```js
      const { layout, getAllGroups, globalRecentFiles } = useEditorGroupStore.getState();
      const { expandedFolders } = useFileTreeStore.getState();
      const { showLeft, showRight, leftW, rightW, bottomPanelHeight, bottomPanelTab } = useLayoutStore.getState();
      const { currentView } = useViewStore.getState();

      // Collect all open tab paths from all groups for backward compatibility
      const allGroups = getAllGroups();
      const tabPaths = allGroups.flatMap(g => g.tabs.map(t => t.path));
      const folderPaths = Array.from(expandedFolders);
      const recentPaths = globalRecentFiles.slice(0, 5);

      // Strip contentByTab from persisted layout — EditorState is rebuilt
      // from disk on restart; cached metadata (json, savedContent) is stale.
      const stripContent = (node) => {
        if (node.type === 'group') {
          const { contentByTab, ...rest } = node;
          return rest;
        }
        if (node.type === 'container') {
          return { ...node, children: node.children.map(stripContent) };
        }
        return node;
      };
      const cleanLayout = stripContent(layout);

      invoke("save_session_state", {
        workspacePath,
        openTabs: tabPaths,
        expandedFolders: folderPaths,
        recentFiles: recentPaths,
        editorLayout: cleanLayout,
        layout: { showLeft, showRight, leftW, rightW, bottomPanelHeight, bottomPanelTab },
        currentView,
      });
```

**Step 2: Commit**

```
git add src/features/workspace/useWorkspaceSession.js
git commit -m "fix: strip contentByTab from persisted session layout"
```

---

### Task 4: Rewrite EditorGroup — EditorState-per-tab core

This is the main task. Replace the doc-JSON snapshot/dispatch approach with full EditorState save/restore.

**Files:**
- Modify: `src/components/EditorGroup.jsx` (lines 1-355, the non-JSX portion)

**Step 1: Add EditorState import and new ref**

At line 1, add `EditorState` to imports. Add a new ref for the states map.

Replace lines 1-61 with:

```js
import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EditorState } from 'prosemirror-state';
import Editor from '../editor';
import Canvas from '../views/Canvas';
import { useEditorGroupStore } from '../stores/editorGroups';
import { useFileTreeStore } from '../stores/fileTree';
import { ResponsiveTabBar } from './TabBar/ResponsiveTabBar';
import WelcomeScreen from './WelcomeScreen';
import { canvasManager } from '../core/canvas/manager';
import { createLokusParser, createLokusSerializer } from '../core/markdown/lokus-md-pipeline';
import { registerEditor } from '../stores/editorRegistry';

/**
 * EditorGroup — a single editor pane with its own tabs, content cache,
 * and ONE persistent ProseMirror EditorView for the group's lifetime.
 *
 * Tab switching strategy (EditorState-per-tab):
 *   1. Save the departing tab's full EditorState into an in-memory Map.
 *   2. Restore the arriving tab's EditorState via view.updateState().
 *      - If cached in Map  → instant restore (undo history, cursor preserved)
 *      - If not cached     → load from disk, parse, create fresh EditorState
 *
 * The <Editor> component is NEVER remounted on tab switches. The EditorView
 * persists for the group's lifetime; only its state is swapped.
 */
export default function EditorGroup({
  group,
  isFocused,
  workspacePath,
  hideTabBar = false,
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onOpenCommandPalette,
  onFileOpen,
}) {
  // ── Refs ─────────────────────────────────────────────────────────────────

  // Raw ProseMirror EditorView instance, set via the onEditorReady callback.
  const rawEditorRef = useRef(null);

  // Forwarded ref handle exposed by <Editor> via useImperativeHandle.
  const editorHandleRef = useRef(null);

  // The active file that was last loaded into the editor DOM.
  // Also used by handleContentChange to avoid reading activeTab from the store (race-free).
  const activeFileRef = useRef(null);

  // Per-tab EditorState cache. Each tab gets its own independent EditorState
  // with its own undo history, selection, and plugin state.
  // Key = file path, Value = EditorState
  const editorStatesRef = useRef(new Map());

  // Lokus markdown→ProseMirror parser, created once when the editor mounts.
  const lokusParserRef = useRef(null);

  // Lokus ProseMirror→markdown serializer, created lazily on first dirty check.
  const lokusSerializerRef = useRef(null);
```

**Step 2: Replace `setEditorContent` and `snapshotTabJSON`**

Replace lines 115-160 (the old `setEditorContent` and `snapshotTabJSON`) with:

```js
  // ── Core imperatives ──────────────────────────────────────────────────────

  /**
   * Restore an EditorState into the shared EditorView.
   * Uses view.updateState() — a single atomic swap of the entire state.
   * No transactions, no undo-stack pollution, no race conditions.
   */
  const restoreEditorState = useCallback((editorState) => {
    const view = rawEditorRef.current;
    if (!view || !editorState) return;
    view.updateState(editorState);
  }, []);

  /**
   * Create a fresh EditorState from a parsed ProseMirror doc.
   * Reuses the current view's plugins so all extensions are active.
   */
  const createEditorStateFromDoc = useCallback((doc) => {
    const view = rawEditorRef.current;
    if (!view) return null;
    return EditorState.create({
      schema: view.state.schema,
      doc,
      plugins: view.state.plugins,
    });
  }, []);

  /**
   * Save the current view's EditorState for the given file path.
   */
  const snapshotEditorState = useCallback((filePath) => {
    const view = rawEditorRef.current;
    if (!view || !filePath || filePath.startsWith('__') || filePath.endsWith('.canvas')) return;
    editorStatesRef.current.set(filePath, view.state);
  }, []);
```

**Step 3: Rewrite the tab-switching effect**

Replace lines 162-242 (the old tab-switching `useEffect`) with:

```js
  // ── Tab-switching effect ──────────────────────────────────────────────────

  useEffect(() => {
    // Canvas / special files don't involve the ProseMirror instance
    if (!activeFile || activeFile.startsWith('__') || activeFile.endsWith('.canvas')) {
      activeFileRef.current = activeFile;
      return;
    }

    const prevFile = activeFileRef.current;
    activeFileRef.current = activeFile;

    // Step 1 — Snapshot the departing tab's full EditorState
    if (
      prevFile &&
      prevFile !== activeFile &&
      !prevFile.startsWith('__') &&
      !prevFile.endsWith('.canvas')
    ) {
      snapshotEditorState(prevFile);
    }

    // Step 2 — Restore the arriving tab
    const cachedState = editorStatesRef.current.get(activeFile);

    // Case A: EditorState cached in memory — instant restore
    if (cachedState) {
      setIsLoading(false);
      restoreEditorState(cachedState);
      return;
    }

    // Case B: No cached state — load from disk
    setIsLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const raw = await invoke('read_file_content', { path: activeFile });
        if (cancelled) return;

        // Ensure parser is ready
        if (!lokusParserRef.current) {
          const view = rawEditorRef.current;
          if (!view) {
            // Editor not mounted yet — store raw markdown for handleEditorReady
            useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
              rawMarkdown: raw,
              savedContent: raw,
              title: activeFile.split('/').pop().replace(/\.md$/, ''),
            });
            return;
          }
          lokusParserRef.current = createLokusParser(view.state.schema);
        }

        // Parse markdown → PM doc → fresh EditorState
        const doc = lokusParserRef.current.parse(raw);
        const newState = createEditorStateFromDoc(doc);
        if (!newState || cancelled) return;

        // Cache the EditorState and store metadata
        editorStatesRef.current.set(activeFile, newState);
        useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
          savedContent: raw,
          title: activeFile.split('/').pop().replace(/\.md$/, ''),
        });

        if (cancelled) return;
        setIsLoading(false);
        restoreEditorState(newState);
      } catch (e) {
        console.error('Failed to load file:', activeFile, e);
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, group.id]);
```

**Step 4: Update `handleTabClose` to clean up EditorState**

Replace lines 250-262 with:

```js
  const handleTabClose = useCallback((path) => {
    // Snapshot before the store removes the entry so we don't lose edits
    if (path === activeFile) {
      snapshotEditorState(path);
    }
    const tab = tabs.find((t) => t.path === path);
    if (tab) {
      useEditorGroupStore.getState().addRecentlyClosed(tab);
    }
    // Clean up cached EditorState for the closed tab
    editorStatesRef.current.delete(path);
    useEditorGroupStore.getState().removeTab(group.id, path);
  }, [group.id, tabs, activeFile, snapshotEditorState]);
```

**Step 5: Rewrite `handleEditorReady`**

Replace lines 278-324 with:

```js
  const handleEditorReady = useCallback((view) => {
    rawEditorRef.current = view;

    if (view) {
      registerEditor(group.id, view);

      // Create the parser and serializer once using the now-available schema.
      if (!lokusParserRef.current) {
        lokusParserRef.current = createLokusParser(view.state.schema);
      }
      if (!lokusSerializerRef.current) {
        lokusSerializerRef.current = createLokusSerializer();
      }

      // If a tab was set active before the editor mounted, load it now.
      const file = activeFileRef.current;
      if (file && !file.startsWith('__') && !file.endsWith('.canvas')) {
        const cachedState = editorStatesRef.current.get(file);
        if (cachedState) {
          restoreEditorState(cachedState);
          setIsLoading(false);
        } else {
          // Check if raw markdown was stored while editor was mounting
          const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[file];
          if (cached?.rawMarkdown) {
            const doc = lokusParserRef.current.parse(cached.rawMarkdown);
            const newState = createEditorStateFromDoc(doc);
            if (newState) {
              editorStatesRef.current.set(file, newState);
              useEditorGroupStore.getState().setTabContent(group.id, file, {
                savedContent: cached.savedContent ?? cached.rawMarkdown,
                title: cached.title ?? file.split('/').pop().replace(/\.md$/, ''),
              });
              restoreEditorState(newState);
              setIsLoading(false);
            }
          }
          // Otherwise, disk I/O is still in flight — will call restoreEditorState when done.
        }
      }
    } else {
      registerEditor(group.id, null);
    }
  }, [group.id, restoreEditorState, createEditorStateFromDoc]);
```

**Step 6: Rewrite `handleContentChange`**

Replace lines 336-355 with:

```js
  /**
   * Called by <Editor> on every user edit. Saves the EditorState and
   * performs a dirty check.
   *
   * Uses activeFileRef (a ref, not store state) so it can never race
   * with tab switches.
   */
  const handleContentChange = useCallback((view) => {
    const currentFile = activeFileRef.current;
    if (!currentFile) return;

    // Save the latest EditorState for this file
    editorStatesRef.current.set(currentFile, view.state);

    // Dirty check: serialize to md and compare with saved source
    const store = useEditorGroupStore.getState();
    const grp = store.findGroup(group.id);
    const saved = grp?.contentByTab?.[currentFile]?.savedContent;
    if (saved !== undefined) {
      if (!lokusSerializerRef.current) {
        lokusSerializerRef.current = createLokusSerializer();
      }
      const currentMd = lokusSerializerRef.current.serialize(view.state.doc);
      store.markTabDirty(group.id, currentFile, currentMd !== saved);
    }
  }, [group.id]);
```

**Step 7: Verify no tests break**

Run: `cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/fixing-root && npx vitest run --reporter=verbose 2>&1 | tail -30`

**Step 8: Commit**

```
git add src/components/EditorGroup.jsx
git commit -m "feat: EditorState-per-tab with independent undo, cursor, and plugin state

Replaces the doc-JSON snapshot/dispatch approach with full EditorState
save/restore. Each tab now has its own undo history, selection, and
plugin state. Tab switching uses view.updateState() for atomic swaps.
Eliminates the cross-file content bleed race condition."
```

---

### Task 5: Wiki link click creates non-existent file

**Files:**
- Modify: `src/editor/components/Editor.jsx:599-618`

**Step 1: Add file creation before the emit**

Replace lines 599-618 with:

```js
          // If file doesn't exist, create it before opening
          if (!fileExists) {
            const wsPath = globalThis.__LOKUS_WORKSPACE_PATH__ || '';
            const activePath = globalThis.__LOKUS_ACTIVE_FILE__ || '';
            const activeDir = activePath
              ? activePath.substring(0, Math.max(activePath.lastIndexOf('/'), activePath.lastIndexOf('\\')))
              : wsPath;

            // Build the target path: same folder as current file, .md extension
            let targetPath = cleanHref;
            if (!targetPath.includes('/') && !targetPath.includes('\\')) {
              targetPath = `${activeDir}/${cleanHref}`;
            }
            if (!targetPath.endsWith('.md')) {
              targetPath = `${targetPath}.md`;
            }
            cleanHref = targetPath;

            // Create the empty file
            try {
              const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
              await tauriInvoke('write_file_content', { path: targetPath, content: '' });
              // Refresh the file tree so the new file appears in the sidebar
              useFileTreeStore?.getState?.()?.refreshTree?.();
            } catch {
              // File creation failed — still try to open (will show error)
            }
          }

          // Emit to workspace to open file (Tauri or DOM event)
          (async () => {
            try {
              const { emit } = await import('@tauri-apps/api/event');
              const eventName = openInNewTab ? 'lokus:open-file-new-tab' : 'lokus:open-file';
              await emit(eventName, cleanHref);
            } catch {
              try {
                const eventName = openInNewTab ? 'lokus:open-file-new-tab' : 'lokus:open-file';
                window.dispatchEvent(new CustomEvent(eventName, { detail: cleanHref }));
              } catch { }
            }

            // If block reference, also emit scroll event
            if (hasBlockRef && blockId) {
              window.dispatchEvent(new CustomEvent('lokus:scroll-to-block', { detail: blockId }));
            }
          })();
          return true;
```

Note: The wiki link click handler is already inside an event handler on `click`, and the file creation needs to be `async`. The existing handler is already wrapped in an IIFE `(async () => { ... })()` at line 602. We need to restructure so file creation happens BEFORE the emit. Since the whole click handler returns `true` synchronously, the file creation + emit should both go inside the async IIFE.

Revised approach — replace lines 601-618 with:

```js
          // Emit to workspace to open file (create if needed)
          (async () => {
            // If file doesn't exist, create it first
            if (!fileExists) {
              const activePath = globalThis.__LOKUS_ACTIVE_FILE__ || '';
              const activeDir = activePath
                ? activePath.substring(0, Math.max(activePath.lastIndexOf('/'), activePath.lastIndexOf('\\')))
                : (globalThis.__LOKUS_WORKSPACE_PATH__ || '');

              // Build target path: same folder as current file, ensure .md extension
              if (!cleanHref.includes('/') && !cleanHref.includes('\\')) {
                cleanHref = `${activeDir}/${cleanHref}`;
              }
              if (!cleanHref.endsWith('.md')) {
                cleanHref = `${cleanHref}.md`;
              }

              try {
                const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                await tauriInvoke('write_file_content', { path: cleanHref, content: '' });
                // Refresh file tree so the new file appears in the sidebar
                try {
                  const { useFileTreeStore } = await import('../../../stores/fileTree');
                  useFileTreeStore.getState().refreshTree?.();
                } catch {}
              } catch {}
            }

            try {
              const { emit } = await import('@tauri-apps/api/event');
              const eventName = openInNewTab ? 'lokus:open-file-new-tab' : 'lokus:open-file';
              await emit(eventName, cleanHref);
            } catch {
              try {
                const eventName = openInNewTab ? 'lokus:open-file-new-tab' : 'lokus:open-file';
                window.dispatchEvent(new CustomEvent(eventName, { detail: cleanHref }));
              } catch { }
            }

            // If block reference, also emit scroll event
            if (hasBlockRef && blockId) {
              window.dispatchEvent(new CustomEvent('lokus:scroll-to-block', { detail: blockId }));
            }
          })();
          return true;
```

**Step 2: Check the import path for useFileTreeStore**

The Editor.jsx file is at `src/editor/components/Editor.jsx`. The fileTree store is at `src/stores/fileTree.js`. The relative import from Editor.jsx would be `../../stores/fileTree`. Verify this is correct:

Run: `ls /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/fixing-root/src/stores/fileTree.js`

**Step 3: Commit**

```
git add src/editor/components/Editor.jsx
git commit -m "feat: create non-existent files when clicking wiki links"
```

---

### Task 6: Smoke test the full flow

**Step 1: Run all tests**

Run: `cd /Users/pratham/Programming/Lokus/lokus/.claude/worktrees/fixing-root && npx vitest run --reporter=verbose 2>&1 | tail -50`

**Step 2: Manual verification checklist**

If the app is running (`npm run tauri dev`), verify:

1. **Tab switching**: Open File A, type some text, switch to File B, switch back to A — text is preserved
2. **Undo isolation**: Edit File A, switch to B, edit B, switch back to A, Cmd+Z — undoes A's edit, not B's
3. **Cursor preservation**: Place cursor in middle of File A, switch to B, switch back — cursor is in same position
4. **Dirty indicator**: Edit a file, check that tab shows unsaved dot, save, dot disappears
5. **Wiki link creation**: Click a wiki link to a non-existent file — file is created and opened
6. **`__LOKUS_ACTIVE_FILE__`**: Open console, switch tabs, verify `window.__LOKUS_ACTIVE_FILE__` updates
7. **Session restore**: Close and reopen app — tabs are restored, content loads from disk

**Step 3: Commit any fixes from testing**

---

## Summary of all changes

| Task | File | Lines changed | What |
|------|------|--------------|------|
| 1 | `editorGroups.js` | ~8 | LRU eviction protects dirty tabs |
| 2 | `EditorGroup.jsx` | ~5 | Set `__LOKUS_ACTIVE_FILE__` global |
| 3 | `useWorkspaceSession.js` | ~15 | Strip contentByTab from persisted layout |
| 4 | `EditorGroup.jsx` | ~200 | Core EditorState-per-tab rewrite |
| 5 | `Editor.jsx` | ~25 | Wiki link creates non-existent files |
| 6 | — | — | Smoke test |
