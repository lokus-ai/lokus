import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Editor from '../editor';
import Canvas from '../views/Canvas';
import { useEditorGroupStore } from '../stores/editorGroups';
import { useFileTreeStore } from '../stores/fileTree';
import { ResponsiveTabBar } from './TabBar/ResponsiveTabBar';
import WelcomeScreen from './WelcomeScreen';
import { canvasManager } from '../core/canvas/manager';
import { createLokusParser } from '../core/markdown/lokus-md-pipeline';
import { registerEditor } from '../stores/editorRegistry';

/**
 * EditorGroup — a single editor pane with its own tabs, content cache,
 * and ONE persistent TipTap instance for the group's lifetime.
 *
 * Tab switching strategy:
 *   1. Snapshot the departing tab as ProseMirror JSON → stored in
 *      contentByTab[path].json via setTabContent().
 *   2. Load the arriving tab:
 *        a. If json cache exists  → editor.commands.setContent(json)  [instant]
 *        b. If html cache exists  → editor.commands.setContent(html)  [instant, legacy]
 *        c. No cache              → read from disk, parse md→PM JSON, then setContent(json)
 *
 * The <Editor> component is NEVER remounted on tab switches. Display is
 * toggled with CSS (display:none / display:block) so TipTap's ProseMirror
 * DOM is never torn down between tabs.
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

  // Raw TipTap editor instance, set via the onEditorReady callback.
  // Used for imperative setContent() / getJSON() / getHTML() calls.
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
      // Focus the TipTap editor body
      rawEditorRef.current?.commands?.focus?.();
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
   * Load content into the persistent TipTap instance without remounting it.
   * Accepts either an HTML string or a ProseMirror JSON object.
   */
  const setEditorContent = useCallback((content) => {
    const editor = rawEditorRef.current;
    if (!editor) return;
    editor.commands.setContent(content, {
      parseOptions: { preserveWhitespace: 'full' },
    });
  }, []);

  /**
   * Capture the current editor state as ProseMirror JSON and persist it in
   * the store so the next visit to this tab can restore it instantly.
   */
  const snapshotTabJSON = useCallback((filePath) => {
    const editor = rawEditorRef.current;
    if (!editor || !filePath || filePath.startsWith('__') || filePath.endsWith('.canvas')) return;
    const json = editor.getJSON();
    useEditorGroupStore.getState().setTabContent(group.id, filePath, { json });
  }, [group.id]);

  // ── Tab-switching effect ──────────────────────────────────────────────────

  useEffect(() => {
    // Canvas / special files don't involve the TipTap instance
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

    // Case B: HTML cache — instant
    if (cached?.html !== undefined) {
      setIsLoading(false);
      setEditorContent(cached.html);
      return;
    }

    // Case C: No cache — load from disk
    setIsLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const raw = await invoke('read_file_content', { path: activeFile });
        if (cancelled) return;

        if (activeFile.endsWith('.md')) {
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
        } else {
          // Non-markdown files: fall back to setting raw content as HTML.
          useEditorGroupStore.getState().setTabContent(group.id, activeFile, {
            html: raw,
            savedContent: raw,
            title: activeFile.split('/').pop().replace(/\.md$/, ''),
            loading: false,
          });

          if (cancelled) return;
          setIsLoading(false);
          setEditorContent(raw);
        }
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
   * Receives the raw TipTap editor instance when it is created or destroyed.
   * Register / unregister from the global editorRegistry so the save handler
   * (and other consumers) can reach this group's editor by group ID.
   *
   * This fires once on group mount (editor created) and once on group unmount
   * (editor destroyed with null). It does NOT fire on tab switches.
   */
  const handleEditorReady = useCallback((editor) => {
    rawEditorRef.current = editor;

    if (editor) {
      registerEditor(group.id, editor);

      // Create the parser once using the now-available schema.
      // Any in-flight disk loads that started before the editor was ready
      // will pick up lokusParserRef.current when they resolve.
      if (!lokusParserRef.current) {
        lokusParserRef.current = createLokusParser(editor.schema);
      }

      // The editor just mounted. If a tab switch already resolved content
      // (Cases A/B) before the editor was ready, setEditorContent() would
      // have been a no-op (rawEditorRef.current was null). Apply now.
      // The tab-switching effect fires before onEditorReady because the effect
      // runs synchronously after the first render, while onEditorReady fires
      // asynchronously once TipTap's useEditor() hook resolves. Cover the race.
      const file = prevActiveFileRef.current;
      if (file && !file.startsWith('__') && !file.endsWith('.canvas')) {
        const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[file];
        if (cached?.json) {
          editor.commands.setContent(cached.json, { parseOptions: { preserveWhitespace: 'full' } });
        } else if (cached?.html !== undefined) {
          editor.commands.setContent(cached.html, { parseOptions: { preserveWhitespace: 'full' } });
        }
        // If no cache yet, disk I/O is in flight and will call setEditorContent()
        // once complete — by then rawEditorRef.current is set so it will work.
      }
    } else {
      registerEditor(group.id, null);
    }
  }, [group.id]);

  /**
   * Called by <Editor> on every user edit. Writes the latest HTML to the
   * store and marks the tab dirty when it differs from the saved version.
   */
  const handleContentChange = useCallback((newContent) => {
    const store = useEditorGroupStore.getState();
    const grp = store.findGroup(group.id);
    const saved = grp?.contentByTab?.[activeFile]?.savedContent;

    store.setTabContent(group.id, activeFile, { html: newContent });
    store.markTabDirty(group.id, activeFile, saved !== undefined && newContent !== saved);
  }, [group.id, activeFile]);

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
          Persistent TipTap editor wrapper.

          Visibility is controlled with display:none rather than conditional
          rendering so the TipTap ProseMirror instance is NEVER unmounted
          during tab switches. Content is swapped imperatively via
          editor.commands.setContent() in the tab-switching effect above.

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

              `content` is intentionally a stable empty string. All content
              changes (initial load, tab switches) are applied imperatively
              through editor.commands.setContent() via rawEditorRef.current.
              This prevents the Tiptap internal sync effect from fighting with
              our imperative updates.

              `isLoading` is always false here; we render our own loading
              overlay above so the TipTap internal effect never clears/restores
              content in response to loading state changes from this component.
            */}
            <Editor
              ref={editorHandleRef}
              content=""
              onContentChange={handleContentChange}
              onEditorReady={handleEditorReady}
              isLoading={false}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
