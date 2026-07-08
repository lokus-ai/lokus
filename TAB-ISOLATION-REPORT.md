# Tab Isolation — Root Cause & Fix Report

**Branch:** `lokus-tabfix` · **Date:** 2026-07-07
**Symptom (founder):** switching tabs bleeds tab 1's content onto tab 2, and switching rebuilds/flickers the whole pane. Data-loss-class: ⌘S after a switch can write the wrong document into a file.

---

## 1. Deterministic reproduction

Reproduced with the AI-QA harness (`qa/`, Playwright driving the real Vite frontend with a disk-backed Tauri mock). A `backend.setLatency('read_file_content', 600)` knob makes the async race window deterministic instead of timing-lucky.

**Repro (pre-fix, fully deterministic):**
1. Open `alpha.md` containing `ALPHA-ONLY-CONTENT`; let it settle.
2. Click `gamma.md` (never opened before → no in-memory state; disk read takes 600 ms).
3. Inside that window, type and/or press ⌘S.

**Captured result (pre-fix), from the instrumented run:**

```
[switch-effect] alpha.md → gamma.md | cached: false | view doc: "ALPHA-ONLY-CONTENT"
[SAVE] → gamma.md | content: "ALPHA-ONLY-CONTENT"        ← wrong doc, wrong file
[content-change] cache key: gamma.md | doc: "ALPHA-ONLY-CONTENT…"  ← keystrokes poison the cache
```

Disk state afterwards: `gamma.md` = `"ALPHA-ONLY-CONTENT ALPHA-EDIT"` — **alpha's document silently written into gamma's file**, and the gamma tab permanently displayed alpha's content (the poisoned cache entry is then treated as gamma's "loaded" state, so the real file content is never even loaded). This is the QA journey's negative-control failure, verbatim:

> `gamma.md on disk: "ALPHA-ONLY-CONTENT ALPHA-EDIT"; alpha.md: "ALPHA-ONLY-CONTENT ALPHA-EDIT"`

The visible flicker: every uncached switch first **painted the old tab's document under the new tab** (the swap ran in a post-paint `useEffect`), then flashed a full-pane "Loading…" overlay, then popped the content in. (A true remount happens only at page load — React StrictMode in dev — and on pane split / view switches, not on tab switches.)

## 2. The actual root cause (with file:line proof)

**The tab switch was non-transactional.** `setActiveTab` flips the store's `activeTab` synchronously, but the single persistent ProseMirror EditorView kept displaying the *previous* tab's document until a post-paint effect ran — or, for a tab with no cached EditorState, until an async disk read finished. During that window the app had **two contradictory truths** ("which file is active" vs. "which document is in the editor"), and three consumers each picked a different one:

1. **`src/features/editor/hooks/useSave.js` (pre-fix :29/:62-66)** — took the *path* from `focusedGroup.activeTab` (new tab) and the *content* from `editor.state.doc` (the shared view — still the old tab's doc). ⌘S in the window ⇒ old tab's text written into new tab's file. **This is the data-loss bug.**
2. **`src/components/EditorGroup.jsx` (pre-fix :188 vs :267)** — the switch effect set `activeFileRef.current = activeFile` immediately, but the view state swap happened up to a disk-read later. `handleContentChange` (pre-fix :397-402) keyed every keystroke by `activeFileRef` ⇒ the old tab's doc+keystroke got cached under the **new** tab's key; the in-flight load's `has()` guard (pre-fix :226) then *restored the poisoned entry* ⇒ permanent bleed.
3. **Same effect was a `useEffect` (post-paint)** ⇒ one painted frame of the old tab's content under the new tab on every switch, plus the loading-overlay flash ⇒ the "whole pane rebuilds" glitch.

**Why the floating hypothesis was wrong (and half right):** the "single persistent EditorView + per-tab EditorState cache" is not the bug — it's the *correct* architecture (it is VS Code's model–view separation, and it's the founder's own Tiptap-removal fix; `useProseMirror.js` deliberately creates the view exactly once). The cache doesn't collide; its keys are stable. The defect was the **wiring around it**: the swap wasn't synchronous/atomic, and the save path read the view instead of the per-tab model.

**Ruled out by evidence:** key instability (all keys stable: `ErrorBoundary key={node.id}`, tabs `key={tab.path}`), per-switch remounts (DOM element identity stable across 10 switches), zustand store bugs (addTab/setActiveTab correct in traces).

## 3. Secondary defects found while instrumenting (all fixed)

- **Session persisted exactly once**, 500 ms after mount (`useWorkspaceSession.js`, deps `[workspacePath]`) ⇒ `.lokus/session.json` forever held an *empty* layout; on the next launch `restoreLayout` restored emptiness — and could clobber tabs the user had already opened while the session file loaded.
- **`Toolbar.handleTabClose`** (single-group titlebar tab bar) removed the tab but never cleared its cached editor state (EditorGroup's own close handler did) — stale-model vector.
- **Pane split / view switch remounted EditorGroup** and destroyed `editorStatesRef` ⇒ undo history & unsaved state loss (QA journey 06).
- **`useSave` never updated `savedContent`** after a save ⇒ dirty-flag drift.

## 4. The VS Code principle, applied

VS Code: each file is a **TextModel** (independent data: content, undo, view state); the editor is a **view** that atomically re-points at the active model; save serializes **the model**, never "whatever the view shows".

Lokus now mirrors that exactly:

- **`src/stores/tabModels.js` (new)** — module-level model registry: one `{ EditorState, scrollTop }` per (group, file). Models outlive React remounts (split/view-switch no longer destroys undo history). Lifecycle is owned by the tab store — `removeTab` / `moveTab` / `updateTabPath` / `closeGroup` / `restoreLayout` drop, move, or re-key models — so *every* close path is correct, including the titlebar one.
- **`src/components/EditorGroup.jsx`** — the switch is **transactional and pre-paint** (`useLayoutEffect`):
  - model cached → synchronous `view.updateState()` (undo, cursor, scroll restored) — instant switch, zero flicker;
  - model missing → the view is **blanked synchronously** to a read-only placeholder (`editable: () => !loadingFileRef.current`) while the file loads — the old document is never painted, typed into, or saved under the new tab.
  - Edits are attributed via `viewFileRef` — *the file the view actually displays* — and dropped if a switch is mid-flight; a document can never be stored under another tab's key (`snapshotEditorState` enforces the same invariant).
- **`src/features/editor/hooks/useSave.js`** — `handleSave`/`handleSaveAs` serialize `getTabModel(groupId, filePath).state.doc`. No model (tab still loading) → save is a no-op, like VS Code. After a write, `savedContent` is recorded and the dirty flag recomputed against the *current* model (typing during the write no longer gets marked clean).
- **`src/features/workspace/useWorkspaceSession.js`** — the session now persists on every layout change (debounced 500 ms via store subscription), and a restore never overwrites a layout in which the user already opened tabs.

The ProseMirror kernel and the founder's raw-PM migration (`useProseMirror.js`) are untouched — this is wiring, as instructed.

## 5. Proof (QA acceptance bar)

`qa/journeys/09-tab-isolation.js` (in `npm run qa:journeys`):

| Assertion | Pre-fix | Post-fix |
|---|---|---|
| (a) 10 alternating switches, content sampled **immediately** (no settle wait) — always the tab's own text | ✅* | ✅ |
| (d) `.ProseMirror` is the same DOM node after all switches (no pane remount) | ✅ | ✅ |
| (c) ⌘Z in tab B never undoes tab A's edit (per-tab undo/cursor) | ✅ | ✅ |
| (b) ⌘S during a 600 ms-slow uncached switch never writes tab A's text into tab B's file | ❌ `gamma.md = "ALPHA-ONLY-CONTENT ALPHA-EDIT"` | ✅ `gamma.md = "GAMMA-ONLY-CONTENT"` |
| (a') typing during the switch never bleeds the old tab into the new one | ❌ gamma tab showed alpha's text | ✅ gamma tab shows its own text |

\* pre-fix, cached in-session switches were already correct once settled; the corruption lived in the uncached/async window, which is exactly what the negative control fails on.

- Journey 09: **PASS** on fixed code; **FAIL (2 findings)** with the fix stashed (negative control) — the test provably detects the bug.
- Full journey suite: no new failures vs. `qa/baseline.json`.
- Unit tests: **2421 passed, 0 failed** — identical to the pre-fix baseline.
- All `[DEBUG-SCAFFOLD]` instrumentation removed after diagnosis (`grep -r DEBUG-SCAFFOLD` = 0).

## 6. Founder hand-fix reconciliation

The base branch already contained the founder's Tiptap removal (`useProseMirror.js`, `Editor.jsx` PMEditor, EditorState-per-tab in `EditorGroup.jsx`). This work **builds on it** — the persistent-view design is kept and completed with the missing transactional wiring. Nothing from the migration was reverted. (The founder's uncommitted `src/views/EditorDemo.jsx` in the main repo working tree was left untouched.)
