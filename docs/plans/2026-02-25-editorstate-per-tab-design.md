# EditorState-Per-Tab: Tab Isolation Design

**Date:** 2026-02-25
**Status:** Approved
**Approach:** A — Save full ProseMirror EditorState per tab, swap via `view.updateState()`

---

## Problem

All tabs in an EditorGroup share a single ProseMirror EditorView with a single EditorState. Content is swapped by dispatching a replace-all transaction. This causes:

1. **Cross-file content bleed** — `handleContentChange` reads `activeTab` from the store, which can race with tab switches, writing File A's content into File B's cache.
2. **Shared undo history** — Cmd+Z after switching tabs undoes into the previous file's content.
3. **Lost cursor/selection** — Tab switch resets cursor position.
4. **LRU eviction drops unsaved edits** — Dirty tabs can be evicted from cache.
5. **`__LOKUS_ACTIVE_FILE__` never set** — Wiki-link resolution, tag indexing, folding persistence all broken.
6. **Wiki link to non-existent file** — Opens blank broken tab instead of creating the file.

## Solution

### 1. State Storage

Split state into two locations:

**Zustand store (`contentByTab[path]`)** — serializable metadata:
```
{
  savedContent: string,     // markdown from last save/load (dirty check baseline)
  title: string,
  dirty: boolean,
  lastAccessed: number,
}
```

**In-memory Map (`editorStatesRef` in EditorGroup)** — per-tab EditorState:
```
editorStatesRef.current.get(path) → EditorState
```

EditorState lives outside Zustand because:
- Complex object that doesn't serialize cleanly
- Zustand would try to diff/compare it on every state change
- Session persistence saves layout to disk — EditorState can't go there

Each EditorGroup has its own Map. Same file in two split panes = two independent EditorStates.

### 2. Tab Switch Flow

**Leaving a tab:**
1. `editorStatesRef.current.set('A.md', view.state)` — save full EditorState
2. Update `contentByTab` metadata (dirty, title) as before

**Entering a tab — cached:**
1. `view.updateState(editorStatesRef.current.get('B.md'))` — one call, instant

**Entering a tab — first open / after restart:**
1. `invoke('read_file_content', { path })` — read from disk
2. `lokusParser.parse(raw)` — markdown to PM doc
3. `EditorState.create({ schema, doc, plugins: view.state.plugins })` — fresh state
4. `view.updateState(newState)`
5. Store in map and store `savedContent` in `contentByTab`

**handleContentChange:**
1. PM fires `onUpdate(view)` after user edit
2. `editorStatesRef.current.set(activeFileRef.current, view.state)` — always in sync
3. Dirty check: serialize doc, compare with `savedContent`

Active file tracked via a ref (not read from store) — eliminates race condition.

### 3. Save Flow

No changes to `useSave.js`. It reads `editor.state.doc` which is always the current tab's doc. After save, `savedContent` in `contentByTab` is updated for future dirty checks.

### 4. Session Persistence

**Saved to disk:** Tab paths, layout structure, sidebar widths. Same as today.

**On app restart:**
1. `restoreLayout()` rebuilds layout tree with tab paths
2. `editorStatesRef` Map starts empty
3. Active tab loads from disk on mount (Case B above)

**Lost on restart:** Undo history, cursor position, selection. Same as VS Code.

### 5. Wiki Link — Non-Existent File Creation

In the wiki link click handler (`Editor.jsx`), when `fileExists` is false:
1. Determine target path (same folder as current file, append `.md`)
2. `invoke('write_file_content', { path: targetPath, content: '' })`
3. Refresh file tree
4. Emit `lokus:open-file` with `targetPath`

### 6. LRU Eviction Fix

Skip dirty entries during eviction:
```js
const evictLRU = (contentByTab) => {
  const entries = Object.entries(contentByTab);
  if (entries.length <= MAX_CACHED_TABS) return contentByTab;
  const dirty = entries.filter(([, v]) => v.dirty);
  const clean = entries.filter(([, v]) => !v.dirty);
  clean.sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));
  return Object.fromEntries([...dirty, ...clean.slice(0, MAX_CACHED_TABS - dirty.length)]);
};
```

### 7. `__LOKUS_ACTIVE_FILE__` Fix

Add effect in `EditorGroup.jsx`:
```js
useEffect(() => {
  if (activeFile) {
    globalThis.__LOKUS_ACTIVE_FILE__ = activeFile;
  }
}, [activeFile]);
```

## Files Changed

| File | Change | Complexity |
|------|--------|-----------|
| `src/components/EditorGroup.jsx` | Core rewrite of tab switch + content management | Medium |
| `src/stores/editorGroups.js` | LRU eviction fix, contentByTab cleanup | Low |
| `src/editor/components/Editor.jsx` | Wiki link file creation, `__LOKUS_ACTIVE_FILE__` | Low |
| `src/features/workspace/useWorkspaceSession.js` | Strip EditorState from persisted layout | Low |

## What This Does NOT Change

- ProseMirror EditorView lifecycle (still created once per group)
- Plugin initialization
- Schema
- Save handler (`useSave.js`)
- NodeViews (mermaid, math, wiki links)
- Session persistence format (tab paths still saved to disk)
