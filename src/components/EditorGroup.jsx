import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
 * Tab switching strategy:
 *   1. Snapshot the departing tab as ProseMirror JSON → stored in
 *      contentByTab[path].json via setTabContent().
 *   2. Load the arriving tab:
 *        a. If json cache exists  → dispatch PM transaction with cached JSON  [instant]
 *        b. No cache              → read from disk, parse md→PM JSON, then dispatch  [async]
 *
 * The <Editor> component is NEVER remounted on tab switches. Display is
 * toggled with CSS (display:none / display:block) so the ProseMirror
 * DOM is never torn down between tabs. Content is swapped imperatively
 * via view.dispatch() with tr.setMeta('programmatic', true).
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
  // Used for imperative content replacement via view.dispatch().
  const rawEditorRef = useRef(null);

  // Forwarded ref handle exposed by <Editor> via useImperativeHandle.
  // Not used directly in this component — kept for future use / ref prop requirement.
  const editorHandleRef = useRef(null);

  // The active file that was last loaded into the editor DOM.
  const prevActiveFileRef = useRef(null);

  // Lokus markdown→ProseMirror parser, created once when the editor mounts
  // and reused for every subsequent file load. Created lazily in handleEditorReady
  // so that editor.schema is guaranteed to be available.
  const lokusParserRef = useRef(null);

  // Lokus ProseMirror→markdown serializer, created lazily on first dirty check.
  // Used by handleContentChange to serialize the doc to markdown for comparison
  // with the saved source content.
  const lokusSerializerRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────

  // True while waiting for disk I/O for the current tab.
  const [isLoading, setIsLoading] = useState(false);

  const activeFile = group.activeTab;
  const tabs = group.tabs;

  // ── Title state ───────────────────────────────────────────────────────────

  const [editorTitle, setEditorTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');

  useEffect(() => {
    if (!activeFile || activeFile.startsWith('__') || activeFile.endsWith('.canvas')) {
      setEditorTitle('');
      setOriginalTitle('');
      return;
    }
    const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[activeFile];
    const title = cached?.title || activeFile.split('/').pop().replace(/\.md$/, '');
    setEditorTitle(title);
    setOriginalTitle(title);
  }, [activeFile, group.id]);

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
   * Load content into the persistent ProseMirror EditorView without remounting it.
   * Accepts a PM JSON object (from cache) or a markdown string (from disk load).
   * All programmatic content changes set tr.setMeta('programmatic', true) so the
   * dispatchTransaction handler in useProseMirror does NOT fire onUpdate.
   */
  const setEditorContent = useCallback((content) => {
    const view = rawEditorRef.current;
    if (!view) return;

    let doc;
    if (content && typeof content === 'object') {
      // PM JSON -> PM Node
      if (content.type === 'doc') {
        doc = view.state.schema.nodeFromJSON(content);
      } else {
        // Wrapped content (e.g. a single block node)
        doc = view.state.schema.nodeFromJSON({ type: 'doc', content: [content] });
      }
    } else if (typeof content === 'string') {
      // Markdown string -> PM Node (disk load path)
      if (!lokusParserRef.current) {
        lokusParserRef.current = createLokusParser(view.state.schema);
      }
      doc = lokusParserRef.current.parse(content);
    } else {
      return;
    }

    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
    tr.setMeta('programmatic', true);
    view.dispatch(tr);
  }, []);

  /**
   * Capture the current editor state as ProseMirror JSON and persist it in
   * the store so the next visit to this tab can restore it instantly.
   */
  const snapshotTabJSON = useCallback((filePath) => {
    const view = rawEditorRef.current;
    if (!view || !filePath || filePath.startsWith('__') || filePath.endsWith('.canvas')) return;
    const json = view.state.doc.toJSON();
    useEditorGroupStore.getState().setTabContent(group.id, filePath, { json });
  }, [group.id]);

  // ── Tab-switching effect ──────────────────────────────────────────────────

  useEffect(() => {
    // Canvas / special files don't involve the ProseMirror instance
    if (!activeFile || activeFile.startsWith('__') || activeFile.endsWith('.canvas')) {
      prevActiveFileRef.current = activeFile;
      return;
    }

    const prevFile = prevActiveFileRef.current;
    prevActiveFileRef.current = activeFile;

    // Step 1 — Snapshot the departing tab before we load a new one
    if (
      prevFile &&
      prevFile !== activeFile &&
      !prevFile.startsWith('__') &&
      !prevFile.endsWith('.canvas')
    ) {
      snapshotTabJSON(prevFile);
    }

    // Step 2 — Resolve content for the arriving tab
    const store = useEditorGroupStore.getState();
    const grp = store.findGroup(group.id);
    const cached = grp?.contentByTab?.[activeFile];

    // Case A: ProseMirror JSON cache — instant, no reparse
    if (cached?.json) {
      setIsLoading(false);
      setEditorContent(cached.json);
      return;
    }

    // Case B: No cache — load from disk
    setIsLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const raw = await invoke('read_file_content', { path: activeFile });
        if (cancelled) return;

        // Wait for the editor (and therefore the parser) to be ready.
        // In practice lokusParserRef is set synchronously in handleEditorReady
        // before any async I/O resolves, but we guard just in case.
        if (!lokusParserRef.current) {
          console.warn('EditorGroup: parser not ready when file resolved — skipping load');
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Parse markdown directly to ProseMirror JSON (no HTML round-trip).
        const doc = lokusParserRef.current.parse(raw);
        const json = doc.toJSON();

        // Store ProseMirror JSON so future visits hit Case A immediately.
        useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
          json,
          savedContent: raw,
          title: activeFile.split('/').pop().replace(/\.md$/, ''),
          loading: false,
        });

        if (cancelled) return;
        setIsLoading(false);
        setEditorContent(json);
      } catch (e) {
        console.error('Failed to load file:', activeFile, e);
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // setEditorContent and snapshotTabJSON are stable (useCallback with stable deps).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, group.id]);

  // ── Tab bar handlers ──────────────────────────────────────────────────────

  const handleTabClick = useCallback((path) => {
    useEditorGroupStore.getState().setActiveTab(group.id, path);
  }, [group.id]);

  const handleTabClose = useCallback((path) => {
    // Snapshot before the store removes the entry so we don't lose edits
    if (path === activeFile) {
      snapshotTabJSON(path);
    }
    const tab = tabs.find((t) => t.path === path);
    if (tab) {
      useEditorGroupStore.getState().addRecentlyClosed(tab);
    }
    // removeTab cleans up contentByTab[path] — JSON snapshot is discarded
    // intentionally (the tab is being closed)
    useEditorGroupStore.getState().removeTab(group.id, path);
  }, [group.id, tabs, activeFile, snapshotTabJSON]);

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

      // Create the parser and serializer once using the now-available schema.
      // Any in-flight disk loads that started before the editor was ready
      // will pick up lokusParserRef.current when they resolve.
      if (!lokusParserRef.current) {
        lokusParserRef.current = createLokusParser(view.state.schema);
      }
      if (!lokusSerializerRef.current) {
        lokusSerializerRef.current = createLokusSerializer();
      }

      // The editor just mounted. If a tab switch already resolved content
      // (Case A: JSON cache) before the editor was ready, setEditorContent()
      // would have been a no-op (rawEditorRef.current was null). Apply now.
      // The tab-switching effect fires before onEditorReady because the effect
      // runs synchronously after the first render, while onReady fires
      // after the EditorView is created. Cover the race.
      const file = prevActiveFileRef.current;
      if (file && !file.startsWith('__') && !file.endsWith('.canvas')) {
        const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[file];
        if (cached?.json) {
          setEditorContent(cached.json);
        }
        // If no cache yet, disk I/O is in flight and will call setEditorContent()
        // once complete — by then rawEditorRef.current is set so it will work.
      }
    } else {
      registerEditor(group.id, null);
    }
  }, [group.id, setEditorContent]);

  /**
   * Called by <Editor> on every user edit. Receives the PM EditorView,
   * snapshots the doc as JSON, and marks the tab dirty by serializing
   * the doc to markdown and comparing with the saved source.
   *
   * IMPORTANT: `activeFile` is NOT in the dependency array. The active file
   * is read from the store to avoid the dependency cascade that caused the
   * original tab-switching bug (activeFile -> onContentChange -> onUpdate
   * -> dependency change -> editor recreation).
   */
  const handleContentChange = useCallback((view) => {
    const store = useEditorGroupStore.getState();
    const grp = store.findGroup(group.id);
    const currentActiveFile = grp?.activeTab;
    if (!currentActiveFile) return;

    // Snapshot current doc as PM JSON
    const json = view.state.doc.toJSON();
    store.setTabContent(group.id, currentActiveFile, { json });

    // Dirty check: serialize to md and compare with saved source
    const saved = grp?.contentByTab?.[currentActiveFile]?.savedContent;
    if (saved !== undefined) {
      if (!lokusSerializerRef.current) {
        lokusSerializerRef.current = createLokusSerializer();
      }
      const currentMd = lokusSerializerRef.current.serialize(view.state.doc);
      store.markTabDirty(group.id, currentActiveFile, currentMd !== saved);
    }
  }, [group.id]);

  // ── Derived display flags ─────────────────────────────────────────────────

  const isEditorFile = !!(activeFile && !activeFile.startsWith('__') && !activeFile.endsWith('.canvas'));
  const isCanvasFile = !!(activeFile?.endsWith('.canvas'));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col h-full relative bg-app-bg ${isFocused ? 'ring-2 ring-app-accent' : ''}`}
      onClick={handleFocus}
    >
      {/* Tab Bar — hidden in single-pane mode */}
      {!hideTabBar && (
        <ResponsiveTabBar
          tabs={tabs}
          activeTab={activeFile}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          unsavedChanges={unsavedChanges}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">

        {/* Welcome screen — shown when no tab is active */}
        {!activeFile && (
          <WelcomeScreen
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onCreateCanvas={onCreateCanvas}
            onOpenCommandPalette={onOpenCommandPalette}
            onFileOpen={onFileOpen}
          />
        )}

        {/* Canvas viewer — rendered only for .canvas files */}
        {isCanvasFile && (
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

        {/*
          Persistent ProseMirror editor wrapper.

          Visibility is controlled with display:none rather than conditional
          rendering so the ProseMirror EditorView is NEVER unmounted during
          tab switches. Content is swapped imperatively via view.dispatch()
          in the tab-switching effect above.

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

              Content is managed imperatively via setEditorContent() which
              dispatches PM transactions with tr.setMeta('programmatic', true).
              The Editor component creates the EditorView once and never
              recreates it on tab switches.
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
