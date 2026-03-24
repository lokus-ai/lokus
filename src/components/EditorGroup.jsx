import React, { useRef, useCallback, useEffect, useState, useMemo, lazy, Suspense } from 'react';
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

// Lazy-loaded special tab views
const BasesView = lazy(() => import('../bases/BasesView'));
const ProfessionalGraphView = lazy(() => import('../views/ProfessionalGraphView').then(m => ({ default: m.ProfessionalGraphView })));
const KanbanBoard = lazy(() => import('./KanbanBoard'));
const MathGraphEditor = lazy(() => import('./MathGraph/MathGraphEditor.jsx'));

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
    if (!view || !filePath || filePath.startsWith('__') || filePath.endsWith('.canvas') || filePath.endsWith('.excalidraw') || filePath.endsWith('.kanban') || filePath.endsWith('.graph') || isImageFile(filePath) || isPDFFile(filePath)) return;
    editorStatesRef.current.set(filePath, view.state);
  }, []);

  // ── Tab-switching effect ──────────────────────────────────────────────────

  useEffect(() => {
    // Canvas / kanban / math graph / image / PDF / special files don't involve the ProseMirror instance
    if (!activeFile || activeFile.startsWith('__') || activeFile.endsWith('.canvas') || activeFile.endsWith('.excalidraw') || activeFile.endsWith('.kanban') || activeFile.endsWith('.graph') || isImageFile(activeFile) || isPDFFile(activeFile)) {
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
      !prevFile.endsWith('.canvas') &&
      !prevFile.endsWith('.excalidraw') &&
      !prevFile.endsWith('.kanban') &&
      !prevFile.endsWith('.graph') &&
      !isImageFile(prevFile) &&
      !isPDFFile(prevFile)
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
    loadingFileRef.current = activeFile;

    (async () => {
      try {
        const raw = await invoke('read_file_content', { path: activeFile });
        if (cancelled || loadingFileRef.current !== activeFile) return;

        // Check if handleEditorReady already loaded this file while we were awaiting
        if (editorStatesRef.current.has(activeFile)) {
          setIsLoading(false);
          restoreEditorState(editorStatesRef.current.get(activeFile));
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

        // Cache the EditorState and store metadata
        editorStatesRef.current.set(activeFile, newState);
        useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
          savedContent: raw,
          title: noteBasenameForTitle(activeFile),
        });

        if (cancelled) return;
        loadingFileRef.current = null;
        setIsLoading(false);
        restoreEditorState(newState);
      } catch (e) {
        console.error('Failed to load file:', activeFile, e);
        if (!cancelled) {
          loadingFileRef.current = null;
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; loadingFileRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, group.id]);

  // ── Tab bar handlers ──────────────────────────────────────────────────────

  const handleTabClick = useCallback((path) => {
    useEditorGroupStore.getState().setActiveTab(group.id, path);
  }, [group.id]);

  const handleTabClose = useCallback((path) => {
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

    if (view) {
      registerEditor(group.id, view);

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
      if (file && !file.startsWith('__') && !file.endsWith('.canvas') && !file.endsWith('.excalidraw') && !file.endsWith('.kanban') && !file.endsWith('.graph') && !isImageFile(file) && !isPDFFile(file)) {
        const cachedState = editorStatesRef.current.get(file);
        if (cachedState) {
          restoreEditorState(cachedState);
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
              editorStatesRef.current.set(file, newState);
              useEditorGroupStore.getState().setTabContent(group.id, file, {
                savedContent: cached.savedContent ?? cached.rawMarkdown,
                title: cached.title ?? noteBasenameForTitle(file),
              });
              restoreEditorState(newState);
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
                editorStatesRef.current.set(file, newState);
                useEditorGroupStore.getState().setTabContent(group.id, file, {
                  savedContent: raw,
                  title: noteBasenameForTitle(file),
                });
                loadingFileRef.current = null;
                restoreEditorState(newState);
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
  }, [group.id, restoreEditorState, createEditorStateFromDoc]);

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

          <div className="h-full pt-14 px-16 pb-4 overflow-y-auto">
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
              onContentChange={handleContentChange}
              onEditorReady={handleEditorReady}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
