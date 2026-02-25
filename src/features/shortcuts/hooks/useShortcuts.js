import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useLayoutStore } from '../../../stores/layout';
import { useViewStore } from '../../../stores/views';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { useFileTreeStore } from '../../../stores/fileTree';
import { getEditor } from '../../../stores/editorRegistry';
import { setGlobalActiveTheme, getSystemPreferredTheme, setupSystemThemeListener } from '../../../core/theme/manager';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDesktop } from '../../../platform/index';
import { createEditorCommands } from '../../../editor/commands/index.js';

/** Returns the currently focused group's editor from the registry. */
function getFocusedEditor() {
  const { focusedGroupId } = useEditorGroupStore.getState();
  return getEditor(focusedGroupId);
}

export function useShortcuts({ workspacePath, onSave, onSaveAs, onCreateFile, onCreateFolder, onCreateCanvas, onOpenDailyNote, onExportPdf, onExportHtml, onOpenWorkspace, onPrint }) {
  useEffect(() => {
    const unlisteners = [];

    // Helper to register a Tauri listener
    const on = (event, handler) => {
      unlisteners.push(listen(event, handler));
    };

    // File operations
    on('lokus:save-file', () => onSave?.());
    on('lokus:save-as', () => onSaveAs?.());
    on('lokus:close-tab', () => {
      const store = useEditorGroupStore.getState();
      const group = store.getFocusedGroup();
      if (group?.activeTab) {
        const tab = group.tabs.find(t => t.path === group.activeTab);
        if (tab) store.addRecentlyClosed(tab);
        store.removeTab(group.id, group.activeTab);
      }
    });
    on('lokus:new-file', () => onCreateFile?.());
    on('lokus:new-folder', () => onCreateFolder?.());
    on('lokus:new-canvas', () => onCreateCanvas?.());
    on('lokus:reopen-closed-tab', () => {
      useEditorGroupStore.getState().reopenClosed();
    });

    // Navigation
    on('lokus:next-tab', () => {
      const store = useEditorGroupStore.getState();
      const group = store.getFocusedGroup();
      if (!group || group.tabs.length === 0) return;
      const idx = group.tabs.findIndex(t => t.path === group.activeTab);
      const next = group.tabs[(idx + 1) % group.tabs.length];
      if (next) store.setActiveTab(group.id, next.path);
    });
    on('lokus:prev-tab', () => {
      const store = useEditorGroupStore.getState();
      const group = store.getFocusedGroup();
      if (!group || group.tabs.length === 0) return;
      const idx = group.tabs.findIndex(t => t.path === group.activeTab);
      const prev = group.tabs[(idx - 1 + group.tabs.length) % group.tabs.length];
      if (prev) store.setActiveTab(group.id, prev.path);
    });

    // Sidebar and panels
    on('lokus:toggle-sidebar', () => useLayoutStore.getState().toggleLeft());
    on('lokus:command-palette', () => useViewStore.getState().togglePanel('showCommandPalette'));
    on('lokus:in-file-search', () => useViewStore.getState().togglePanel('showInFileSearch'));
    on('lokus:global-search', () => useViewStore.getState().togglePanel('showGlobalSearch'));
    on('lokus:shortcut-help', () => useViewStore.getState().togglePanel('showShortcutHelp'));
    on('lokus:keyboard-shortcuts', () => useViewStore.getState().togglePanel('showShortcutHelp'));
    on('lokus:show-about', () => useViewStore.getState().togglePanel('showAboutDialog'));
    on('lokus:refresh-files', () => useFileTreeStore.getState().refreshTree());

    // Views
    on('lokus:graph-view', () => useViewStore.getState().switchView('graph'));
    on('lokus:daily-note', () => onOpenDailyNote?.());

    // Split view — now handled via EditorGroupStore
    on('lokus:toggle-split-view', () => {
      const store = useEditorGroupStore.getState();
      const group = store.getFocusedGroup();
      if (group) store.splitGroup(group.id, 'vertical');
    });

    // Export / workspace
    on('lokus:export-pdf', () => onExportPdf?.());
    on('lokus:export-html', () => onExportHtml?.());
    on('lokus:print', () => onPrint?.());
    on('lokus:open-workspace', () => onOpenWorkspace?.());
    on('lokus:close-window', async () => {
      try { await getCurrentWindow().close(); } catch (_) {}
    });

    // Edit operations
    on('lokus:edit-undo', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).undo();
    });
    on('lokus:edit-redo', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).redo();
    });
    on('lokus:edit-cut', () => document.execCommand('cut'));
    on('lokus:edit-copy', () => document.execCommand('copy'));
    on('lokus:edit-paste', () => navigator.clipboard?.readText?.().then(t => document.execCommand('insertText', false, t)).catch(() => {}));
    on('lokus:edit-select-all', () => document.execCommand('selectAll'));
    on('lokus:find-replace', () => useViewStore.getState().togglePanel('showInFileSearch'));

    // View / zoom
    on('lokus:zoom-in', () => { document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') + 0.1)}`; });
    on('lokus:zoom-out', () => { document.body.style.zoom = `${Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1)}`; });
    on('lokus:actual-size', () => { document.body.style.zoom = '1'; });
    on('lokus:toggle-fullscreen', async () => {
      try {
        const win = getCurrentWindow();
        const isFullscreen = await win.isFullscreen();
        await win.setFullscreen(!isFullscreen);
      } catch (_) {}
    });

    // Theme
    on('lokus:theme-light', () => setGlobalActiveTheme('light'));
    on('lokus:theme-dark', () => setGlobalActiveTheme('dark'));
    on('lokus:theme-auto', () => {
      const systemTheme = getSystemPreferredTheme();
      setGlobalActiveTheme(systemTheme);
      setupSystemThemeListener((t) => setGlobalActiveTheme(t));
    });

    // Insert commands (editor)
    on('lokus:insert-wikilink', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).insertWikiLink();
    });
    on('lokus:insert-math-inline', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).insertContent('$\\text{}$');
    });
    on('lokus:insert-math-block', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).insertContent('$$\n\\text{}\n$$');
    });
    on('lokus:insert-table', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).insertTable({ rows: 3, cols: 3 });
    });
    on('lokus:insert-image', () => { /* handled by editor image extension */ });
    on('lokus:insert-code-block', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleCodeBlock();
    });
    on('lokus:insert-horizontal-rule', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).setHorizontalRule();
    });
    on('lokus:insert-blockquote', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleBlockquote();
    });
    on('lokus:insert-bullet-list', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleBulletList();
    });
    on('lokus:insert-ordered-list', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleOrderedList();
    });
    on('lokus:insert-task-list', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleTaskList();
    });

    // Heading inserts
    on('lokus:insert-heading', (e) => {
      const view = getFocusedEditor();
      if (!view) return;
      const lvl = e?.payload?.level ?? 1;
      createEditorCommands(view).toggleHeading({ level: lvl });
    });

    // Format commands
    on('lokus:format-bold', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleBold();
    });
    on('lokus:format-italic', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleItalic();
    });
    on('lokus:format-underline', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleUnderline();
    });
    on('lokus:format-strikethrough', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleStrike();
    });
    on('lokus:format-code', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleCode();
    });
    on('lokus:format-highlight', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleHighlight();
    });
    on('lokus:format-superscript', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleSuperscript();
    });
    on('lokus:format-subscript', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).toggleSubscript();
    });
    on('lokus:format-clear', () => {
      const view = getFocusedEditor();
      if (!view) return;
      createEditorCommands(view).unsetAllMarks();
    });

    // Window operations
    on('lokus:window-minimize', async () => { try { await getCurrentWindow().minimize(); } catch (_) {} });
    on('lokus:window-close', async () => { try { await getCurrentWindow().close(); } catch (_) {} });
    on('lokus:window-zoom', async () => {
      try {
        const win = getCurrentWindow();
        const maximized = await win.isMaximized();
        if (maximized) await win.unmaximize();
        else await win.maximize();
      } catch (_) {}
    });

    // Help
    on('lokus:help', () => useViewStore.getState().togglePanel('showShortcutHelp'));
    on('lokus:release-notes', () => { /* open changelog */ });
    on('lokus:report-issue', () => {
      if (typeof window !== 'undefined') {
        window.open('https://github.com/lokus-ai/lokus/issues/new', '_blank');
      }
    });

    // Direct keyboard listener as fallback (for non-Tauri / web)
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onSave?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const group = useEditorGroupStore.getState().getFocusedGroup();
        const file = group?.activeTab;
        if (file && !file.startsWith('__')) {
          const vs = useViewStore.getState();
          if (vs.showVersionHistory && vs.versionHistoryFile === file) {
            vs.closePanel('versionHistory');
          } else {
            vs.openPanel('versionHistory', file);
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '`' && !e.shiftKey && !e.altKey && isDesktop()) {
        e.preventDefault();
        useLayoutStore.getState().setBottomTab('terminal');
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      Promise.all(unlisteners.map(u => u.then(fn => fn()).catch(() => {})));
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [workspacePath, onSave, onSaveAs, onCreateFile, onCreateFolder, onCreateCanvas, onOpenDailyNote, onExportPdf, onExportHtml, onOpenWorkspace, onPrint]);
}
