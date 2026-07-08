import React, { useRef, useCallback, useEffect, useLayoutEffect, useState, useMemo, lazy, Suspense } from 'react';
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
import { getTabModel, setTabModel } from '../stores/tabModels';
import {
  isPlainTextNotePath,
  noteBasenameForTitle,
  plainTextStringToDoc,
  docToPlainTextString,
} from '../utils/plainTextNote.js';
import { isImageFile } from '../utils/imageUtils';
import { isPDFFile } from '../utils/pdfUtils';
import { LazyImageViewer, LazyPDFViewer } from './OptimizedWrapper';
import { useFeatureFlags } from '../contexts/RemoteConfigContext';

// True for tabs that are not handled by the ProseMirror editor
// (special views, canvases, boards, graphs, images, PDFs).
const isNonEditorPath = (p) =>
  !p ||
  p.startsWith('__') ||
  p.endsWith('.canvas') ||
  p.endsWith('.excalidraw') ||
  p.endsWith('.kanban') ||
  p.endsWith('.graph') ||
  isImageFile(p) ||
  isPDFFile(p);

// Lazy-loaded special tab views
const BasesView = lazy(() => import('../bases/BasesView'));
const ProfessionalGraphView = lazy(() => import('../views/ProfessionalGraphView').then(m => ({ default: m.ProfessionalGraphView })));
const KanbanBoard = lazy(() => import('./KanbanBoard'));
const MathGraphEditor = lazy(() => import('./MathGraph/MathGraphEditor.jsx'));

/**
 * EditorGroup — a single editor pane with its own tabs and ONE persistent
 * ProseMirror EditorView for the group's lifetime.
 *
 * Model–view separation (VS Code TextModel principle):
 *   - Every tab owns an isolated model — its full EditorState (doc, undo
 *     history, selection) + scroll position — stored in the module-level
 *     tabModels registry, NOT in this component. Models survive remounts.
 *   - The EditorView is only a view. Switching tabs re-points it at the
 *     active tab's model. The swap is TRANSACTIONAL: it happens
 *     synchronously (useLayoutEffect, before paint), so at no instant does
 *     the view display one tab's document while another tab is active.
 *       - model cached  → instant updateState() (undo, cursor, scroll kept)
 *       - not cached    → the view is blanked synchronously (placeholder
 *         state, read-only) while the file loads from disk; the old tab's
 *         document is never painted under the new tab.
 *   - Edits are attributed by what the view ACTUALLY displays
 *     (viewFileRef), never by which tab is active in the store, so a
 *     keystroke can never be cached — or saved — under the wrong file.
 *
 * The <Editor> component is NEVER remounted on tab switches.
 */
export default function EditorGroup({
  group,
  isFocused,
  workspacePath,
  hideTabBar = false, // kept for WelcomeScreen: true = single group (show welcome), false = split
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onOpenCommandPalette,
  onFileOpen,
}) {
  const featureFlags = useFeatureFlags();

  // ── Refs ─────────────────────────────────────────────────────────────────

  // Raw ProseMirror EditorView instance, set via the onEditorReady callback.
  const rawEditorRef = useRef(null);

  // Forwarded ref handle exposed by <Editor> via useImperativeHandle.
  const editorHandleRef = useRef(null);

  // The tab currently active in the store (mirrors group.activeTab, race-free).
  const activeFileRef = useRef(null);

  // The file whose model the EditorView is CURRENTLY displaying. This is the
  // isolation invariant: content is only ever snapshotted/attributed to
  // viewFileRef, so a doc can never be stored under another tab's key.
  // null while the view shows the loading placeholder.
  const viewFileRef = useRef(null);

  // Scroll container around the editor — captured/restored per tab.
  const scrollContainerRef = useRef(null);

  // Lokus markdown→ProseMirror parser, created once when the editor mounts.
  const lokusParserRef = useRef(null);

  // Lokus ProseMirror→markdown serializer, created lazily on first dirty check.
  const lokusSerializerRef = useRef(null);

  // Loading lock — prevents duplicate async file loads from the tab-switch effect
  // and handleEditorReady racing against each other.
  const loadingFileRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────

  // True while waiting for disk I/O for the current tab.
  const [isLoading, setIsLoading] = useState(false);

  const activeFile = group.activeTab;
  const tabs = group.tabs;

  // ── Title state ───────────────────────────────────────────────────────────

  const [editorTitle, setEditorTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');

  useEffect(() => {
    if (!activeFile || activeFile.startsWith('__') || activeFile.endsWith('.canvas') || activeFile.endsWith('.excalidraw') || activeFile.endsWith('.kanban') || activeFile.endsWith('.graph') || isImageFile(activeFile) || isPDFFile(activeFile)) {
      setEditorTitle('');
      setOriginalTitle('');
      return;
    }
    const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[activeFile];
    const title = cached?.title || noteBasenameForTitle(activeFile);
    setEditorTitle(title);
    setOriginalTitle(title);
  }, [activeFile, group.id]);

  // ── Set global active file for wiki-link resolution, tag indexing, etc. ──
  useEffect(() => {
    if (activeFile) {
      try { globalThis.__LOKUS_ACTIVE_FILE__ = activeFile; } catch {}
    }
  }, [activeFile]);

  const handleTitleChange = useCallback((e) => {
    const newTitle = e.target.value;
    setEditorTitle(newTitle);
    useEditorGroupStore.getState().setTabContent(group.id, activeFile, { title: newTitle });
    if (newTitle !== originalTitle) {
      useEditorGroupStore.getState().markTabDirty(group.id, activeFile, true);
    }
  }, [group.id, activeFile, originalTitle]);

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus the ProseMirror editor body
      rawEditorRef.current?.focus();
    }
  }, []);

  // ── Unsaved indicator ─────────────────────────────────────────────────────

  const unsavedChanges = useMemo(() => {
    const set = new Set();
    for (const tab of tabs) {
      if (group.contentByTab?.[tab.path]?.dirty) set.add(tab.path);
    }
    return set;
  }, [tabs, group.contentByTab]);

  // ── Core imperatives ──────────────────────────────────────────────────────

  /**
   * Re-point the shared EditorView at a tab's model (atomic updateState swap)
   * and restore that tab's scroll position.
   */
  const applyModel = useCallback((filePath, model) => {
    const view = rawEditorRef.current;
    if (!view || !model) return;
    view.updateState(model.state);
    viewFileRef.current = filePath;
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = model.scrollTop || 0;
  }, []);

  /**
   * Blank the view synchronously while a tab's model loads from disk.
   * Guarantees the previous tab's document is never displayed (or edited,
   * or saved) under the new tab. viewFileRef = null: the view represents
   * no file until the model arrives.
   */
  const showLoadingPlaceholder = useCallback(() => {
    const view = rawEditorRef.current;
    if (!view) return;
    view.updateState(EditorState.create({ schema: view.state.schema, plugins: view.state.plugins }));
    viewFileRef.current = null;
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
   * Snapshot the view's current state into the model registry — but ONLY for
   * the file the view actually displays (viewFileRef). Passing any other
   * path is a no-op: a document can never be stored under another tab's key.
   */
  const snapshotEditorState = useCallback((filePath) => {
    const view = rawEditorRef.current;
    if (!view || !filePath || isNonEditorPath(filePath)) return;
    if (viewFileRef.current !== filePath) return;
    setTabModel(group.id, filePath, view.state, scrollContainerRef.current?.scrollTop ?? 0);
  }, [group.id]);

  // ── Tab-switching effect ──────────────────────────────────────────────────

  // Runs as a LAYOUT effect: the view is re-pointed synchronously, before the
  // browser paints the render that activated the new tab. The old tab's
  // document is therefore never visible — or attributable — under the new tab.
  useLayoutEffect(() => {
    // Canvas / kanban / math graph / image / PDF / special files don't involve the ProseMirror instance
    if (isNonEditorPath(activeFile)) {
      activeFileRef.current = activeFile;
      return;
    }

    const prevFile = activeFileRef.current;
    activeFileRef.current = activeFile;

    // Step 1 — Snapshot the departing tab's model (snapshotEditorState
    // internally verifies the view really displays prevFile).
    if (prevFile && prevFile !== activeFile) {
      snapshotEditorState(prevFile);
    }

    // Step 2 — Re-point the view at the arriving tab's model.

    // Case A: model in registry — instant, synchronous restore.
    const cached = getTabModel(group.id, activeFile);
    if (cached) {
      loadingFileRef.current = null;
      setIsLoading(false);
      applyModel(activeFile, cached);
      return;
    }

    // A load for this exact file is already in flight (handleEditorReady
    // kicked it off on mount/remount) — don't start a second one.
    if (loadingFileRef.current === activeFile) return;

    // Case B: no model — blank the view NOW (never show the old tab's doc),
    // then load from disk. The view is read-only while loadingFileRef is set.
    showLoadingPlaceholder();
    setIsLoading(true);
    let cancelled = false;
    loadingFileRef.current = activeFile;

    (async () => {
      try {
        const raw = await invoke('read_file_content', { path: activeFile });
        if (cancelled || loadingFileRef.current !== activeFile) return;

        // Check if handleEditorReady already loaded this file while we were awaiting
        const existing = getTabModel(group.id, activeFile);
        if (existing) {
          loadingFileRef.current = null;
          setIsLoading(false);
          applyModel(activeFile, existing);
          return;
        }

        const editorView = rawEditorRef.current;
        if (!editorView) {
          // Editor not mounted yet — store raw source for handleEditorReady
          useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
            rawMarkdown: raw,
            savedContent: raw,
            title: noteBasenameForTitle(activeFile),
          });
          loadingFileRef.current = null;
          setIsLoading(false);
          return;
        }

        // Ensure markdown parser is ready (unused for .txt body parse, but kept for md tabs)
        if (!lokusParserRef.current) {
          lokusParserRef.current = createLokusParser(editorView.state.schema);
        }

        // Parse file → PM doc (.txt = plain lines; else markdown)
        const doc = isPlainTextNotePath(activeFile)
          ? plainTextStringToDoc(editorView.state.schema, raw)
          : lokusParserRef.current.parse(raw);
        const newState = createEditorStateFromDoc(doc);
        if (!newState || cancelled || loadingFileRef.current !== activeFile) return;

        // Register the tab's model and store metadata
        setTabModel(group.id, activeFile, newState, 0);
        useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
          savedContent: raw,
          title: noteBasenameForTitle(activeFile),
        });

        if (cancelled) return;
        loadingFileRef.current = null;
        setIsLoading(false);
        applyModel(activeFile, { state: newState, scrollTop: 0 });
      } catch (e) {
        console.error('Failed to load file:', activeFile, e);
        if (!cancelled) {
          loadingFileRef.current = null;
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (loadingFileRef.current === activeFile) loadingFileRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, group.id]);

  // ── Tab bar handlers ──────────────────────────────────────────────────────

  const handleTabClick = useCallback((path) => {
    useEditorGroupStore.getState().setActiveTab(group.id, path);
  }, [group.id]);

  const handleTabClose = useCallback((path) => {
    const tab = tabs.find((t) => t.path === path);
    if (tab) {
      useEditorGroupStore.getState().addRecentlyClosed(tab);
    }
    // The store's removeTab drops the tab's model from the registry.
    useEditorGroupStore.getState().removeTab(group.id, path);
  }, [group.id, tabs]);

  const handleFocus = useCallback(() => {
    useEditorGroupStore.getState().setFocusedGroupId(group.id);
  }, [group.id]);

  // ── Editor lifecycle ──────────────────────────────────────────────────────

  /**
   * Receives the raw ProseMirror EditorView when it is created or destroyed.
   * Register / unregister from the global editorRegistry so the save handler
   * (and other consumers) can reach this group's editor by group ID.
   *
   * This fires once on group mount (view created) and once on group unmount
   * (view destroyed with null). It does NOT fire on tab switches.
   */
  const handleEditorReady = useCallback((view) => {
    rawEditorRef.current = view;
    viewFileRef.current = null; // a fresh view displays no file yet

    if (view) {
      registerEditor(group.id, view);

      // The view is read-only while a tab's model is loading from disk —
      // keystrokes can't land in the placeholder (or a stale document).
      view.setProps({ editable: () => !loadingFileRef.current });

      if (!lokusParserRef.current) {
        lokusParserRef.current = createLokusParser(view.state.schema);
      }
      if (!lokusSerializerRef.current) {
        lokusSerializerRef.current = createLokusSerializer();
      }

      // If a tab was set active before the editor mounted, load it now.
      // This handles the case where the component re-mounts after a split
      // (React changes tree position → unmount/remount → lost EditorView).
      const file = activeFileRef.current;
      if (file && !isNonEditorPath(file)) {
        const model = getTabModel(group.id, file);
        if (model) {
          // Model survived the remount — full undo history and scroll intact.
          applyModel(file, model);
          setIsLoading(false);
        } else {
          // Check if raw markdown was stored while editor was mounting
          const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[file];
          if (cached?.rawMarkdown) {
            const doc = isPlainTextNotePath(file)
              ? plainTextStringToDoc(view.state.schema, cached.rawMarkdown)
              : lokusParserRef.current.parse(cached.rawMarkdown);
            const newState = createEditorStateFromDoc(doc);
            if (newState) {
              setTabModel(group.id, file, newState, 0);
              useEditorGroupStore.getState().setTabContent(group.id, file, {
                savedContent: cached.savedContent ?? cached.rawMarkdown,
                title: cached.title ?? noteBasenameForTitle(file),
              });
              applyModel(file, { state: newState, scrollTop: 0 });
              setIsLoading(false);
            }
          } else if (!loadingFileRef.current) {
            // No rawMarkdown cached yet and no load in progress — load from disk.
            // This happens after a split when the component re-mounts and
            // the tab-switching effect's async was cancelled by cleanup.
            loadingFileRef.current = file;
            (async () => {
              try {
                const raw = await invoke('read_file_content', { path: file });
                // Verify file is still active, view still exists, and no other load took over
                if (activeFileRef.current !== file || !rawEditorRef.current || loadingFileRef.current !== file) return;
                const doc = isPlainTextNotePath(file)
                  ? plainTextStringToDoc(rawEditorRef.current.state.schema, raw)
                  : lokusParserRef.current.parse(raw);
                const newState = createEditorStateFromDoc(doc);
                if (!newState) return;
                setTabModel(group.id, file, newState, 0);
                useEditorGroupStore.getState().setTabContent(group.id, file, {
                  savedContent: raw,
                  title: noteBasenameForTitle(file),
                });
                loadingFileRef.current = null;
                applyModel(file, { state: newState, scrollTop: 0 });
                setIsLoading(false);
              } catch (e) {
                console.error('handleEditorReady: failed to load file:', file, e);
                loadingFileRef.current = null;
                setIsLoading(false);
              }
            })();
          }
        }
      }
    } else {
      registerEditor(group.id, null);
    }
  }, [group.id, applyModel, createEditorStateFromDoc]);

  /**
   * Called by <Editor> on every user edit. Updates the tab's model and
   * performs a dirty check.
   *
   * Edits are attributed to viewFileRef — the file the view ACTUALLY
   * displays — never to the store's active tab. If the two disagree
   * (a switch is mid-flight) the edit is dropped instead of being
   * written under the wrong file's key.
   */
  const handleContentChange = useCallback((view) => {
    const currentFile = viewFileRef.current;
    if (!currentFile) return;                          // placeholder / no file
    if (loadingFileRef.current) return;                // a switch is loading
    if (currentFile !== activeFileRef.current) return; // view ≠ active tab

    // Update this tab's model with the latest state
    setTabModel(group.id, currentFile, view.state, scrollContainerRef.current?.scrollTop ?? 0);

    // Dirty check: serialize to md and compare with saved source
    const store = useEditorGroupStore.getState();
    const grp = store.findGroup(group.id);
    const saved = grp?.contentByTab?.[currentFile]?.savedContent;
    if (saved !== undefined) {
      if (!lokusSerializerRef.current) {
        lokusSerializerRef.current = createLokusSerializer();
      }
      const currentSerialized = isPlainTextNotePath(currentFile)
        ? docToPlainTextString(view.state.doc)
        : lokusSerializerRef.current.serialize(view.state.doc);
      store.markTabDirty(group.id, currentFile, currentSerialized !== saved);
    }
  }, [group.id]);

  // ── Derived display flags ─────────────────────────────────────────────────

  const isImageFileActive = !!(activeFile && isImageFile(activeFile));
  const isPDFFileActive = !!(activeFile && isPDFFile(activeFile));
  const isMathGraphFile = !!(activeFile?.endsWith('.graph'));
  const isEditorFile = !!(activeFile && !activeFile.startsWith('__') && !activeFile.endsWith('.canvas') && !activeFile.endsWith('.excalidraw') && !activeFile.endsWith('.kanban') && !activeFile.endsWith('.graph') && !isImageFileActive && !isPDFFileActive);
  // DEPRECATED: .canvas (TLDraw) format is no longer supported
  const isCanvasFile = !!(activeFile?.endsWith('.canvas'));
  const isExcalidrawFile = !!(activeFile?.endsWith('.excalidraw'));
  const isKanbanFile = !!(activeFile?.endsWith('.kanban')) && featureFlags.enable_kanban;
  const isBasesTab = activeFile === '__bases__' && featureFlags.enable_bases;
  const isGraphTab = activeFile === '__graph__' && featureFlags.enable_graph;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col h-full relative bg-app-bg ${isFocused ? 'ring-2 ring-app-accent' : ''}`}
      onClick={handleFocus}
    >
      {/* Per-pane tab bar — shown in split mode (hideTabBar=false).
          In single-group mode (hideTabBar=true), tabs are in the Toolbar titlebar instead.
          In split mode this acts as the titlebar: drag region + panel background. */}
      {!hideTabBar && (
        <div
          data-tauri-drag-region
          style={{
            backgroundColor: 'rgb(var(--panel))',
            borderBottom: '1px solid rgb(var(--border))',
            flexShrink: 0,
          }}
        >
          <ResponsiveTabBar
            tabs={tabs}
            activeTab={activeFile}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            unsavedChanges={unsavedChanges}
          />
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">

        {/* Welcome screen — shown when no tab is active in single-group mode only.
            In split mode, empty groups auto-close when the last tab is removed.
            The brief empty state after a fresh split shows a minimal placeholder. */}
        {!activeFile && hideTabBar && (
          <WelcomeScreen
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onCreateCanvas={onCreateCanvas}
            onOpenCommandPalette={onOpenCommandPalette}
            onFileOpen={onFileOpen}
          />
        )}
        {!activeFile && !hideTabBar && (
          <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
            Open a file to get started
          </div>
        )}

        {/* DEPRECATED: .canvas (TLDraw) format is no longer supported */}
        {isCanvasFile && (
          <div className="flex-1 flex items-center justify-center bg-app-bg">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-4">{'\u{1F6AB}'}</div>
              <h2 className="text-lg font-semibold text-app-text mb-2">Legacy Canvas Format</h2>
              <p className="text-sm text-app-muted">
                This .canvas file uses the old TLDraw format which is no longer supported.
                Create a new Excalidraw canvas instead.
              </p>
            </div>
          </div>
        )}

        {/* Excalidraw canvas viewer — rendered for .excalidraw files */}
        {isExcalidrawFile && (
          <div className="flex-1 overflow-hidden h-full">
            <Canvas
              canvasPath={activeFile}
              canvasName={tabs.find(tab => tab.path === activeFile)?.name}
              onSave={async (canvasData) => {
                try {
                  await canvasManager.saveCanvas(activeFile, canvasData);
                  useEditorGroupStore.getState().markTabDirty(group.id, activeFile, false);
                } catch { /* ignore */ }
              }}
              onChange={() => {
                useEditorGroupStore.getState().markTabDirty(group.id, activeFile, true);
              }}
            />
          </div>
        )}

        {/* Kanban board — rendered for .kanban files */}
        {isKanbanFile && (
          <div className="flex-1 overflow-hidden h-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>}>
              <KanbanBoard
                workspacePath={workspacePath}
                boardPath={activeFile}
                onFileOpen={onFileOpen}
              />
            </Suspense>
          </div>
        )}

        {/* Math graph editor — rendered for .graph files */}
        {isMathGraphFile && (
          <div className="flex-1 overflow-hidden h-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-app-muted">Loading graph...</div>}>
              <MathGraphEditor
                graphPath={activeFile}
                onSave={() => {
                  useEditorGroupStore.getState().markTabDirty(group.id, activeFile, false);
                }}
                onChange={() => {
                  useEditorGroupStore.getState().markTabDirty(group.id, activeFile, true);
                }}
              />
            </Suspense>
          </div>
        )}

        {/* Bases view — rendered as a tab */}
        {isBasesTab && (
          <div className="flex-1 overflow-hidden h-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>}>
              <BasesView isVisible={true} onFileOpen={onFileOpen} />
            </Suspense>
          </div>
        )}

        {/* Graph view — rendered as a tab */}
        {isGraphTab && (
          <div className="flex-1 overflow-hidden h-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>}>
              <ProfessionalGraphView workspacePath={workspacePath} />
            </Suspense>
          </div>
        )}

        {/* Image viewer — rendered for image files */}
        {isImageFileActive && (
          <div className="flex-1 overflow-hidden h-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>}>
              <LazyImageViewer imagePath={activeFile} />
            </Suspense>
          </div>
        )}

        {/* PDF viewer — rendered for PDF files */}
        {isPDFFileActive && (
          <div className="flex-1 overflow-hidden h-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>}>
              <LazyPDFViewer file={activeFile} />
            </Suspense>
          </div>
        )}

        {/*
          Persistent ProseMirror editor wrapper.

          Visibility is controlled with display:none rather than conditional
          rendering so the ProseMirror EditorView is NEVER unmounted during
          tab switches. Content is swapped via view.updateState() which
          atomically replaces the entire EditorState (doc, undo, selection).

          The <Editor> component itself has no key prop, ensuring it lives
          for the entire lifetime of this EditorGroup.
        */}
        <div
          className="h-full"
          style={{ display: isEditorFile ? 'block' : 'none' }}
        >
          {/* Loading overlay shown while disk I/O is in progress */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-app-muted z-10 bg-app-bg">
              Loading...
            </div>
          )}

          <div ref={scrollContainerRef} className="h-full pt-14 px-16 pb-4 overflow-y-auto">
            <input
              type="text"
              value={editorTitle}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              className="w-full bg-transparent text-4xl font-bold pb-3 mb-4 outline-none text-app-text"
              placeholder="Untitled"
              spellCheck={false}
              style={{ borderBottom: '1px solid rgb(var(--border) / 0.4)' }}
            />

            {/*
              No key prop — persistent for the group's lifetime.

              Content is managed via view.updateState() which atomically
              swaps the entire EditorState. The EditorView is created once
              and never recreated on tab switches.
            */}
            <Editor
              ref={editorHandleRef}
              plainTextNote={isPlainTextNotePath(activeFile)}
              onContentChange={handleContentChange}
              onEditorReady={handleEditorReady}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
