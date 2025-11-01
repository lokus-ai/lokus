import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Custom hook for managing workspace keyboard shortcuts and event listeners
 *
 * This hook sets up all keyboard shortcuts and event listeners for the workspace,
 * including file operations, editor formatting, view controls, and more.
 *
 * @param {Object} params - Configuration object
 * @param {Function} params.handleSave - Handler for saving files
 * @param {Function} params.handleSaveAs - Handler for save as operation
 * @param {Function} params.handleExportHtml - Handler for HTML export
 * @param {Function} params.handleExportPdf - Handler for PDF export
 * @param {Function} params.handleOpenWorkspace - Handler for opening workspace
 * @param {Function} params.handleTabClose - Handler for closing tabs
 * @param {Function} params.handleReopenClosedTab - Handler for reopening closed tabs
 * @param {Function} params.handleToggleSplitView - Handler for toggling split view
 * @param {Function} params.toggleSplitDirection - Handler for toggling split direction
 * @param {Function} params.resetPaneSize - Handler for resetting pane size
 * @param {Function} params.toggleVersionHistory - Handler for toggling version history
 * @param {Function} params.handleCreateFile - Handler for creating new file
 * @param {Function} params.handleCreateCanvas - Handler for creating new canvas
 * @param {Function} params.handleCreateFolder - Handler for creating new folder
 * @param {Function} params.handleRefreshFiles - Handler for refreshing file tree
 * @param {Function} params.handleOpenGraphView - Handler for opening graph view
 * @param {Object} params.stateRef - Ref object containing current state
 * @param {Object} params.editorRef - Ref object for editor instance
 * @param {Function} params.setShowCommandPalette - State setter for command palette visibility
 * @param {Function} params.setShowInFileSearch - State setter for in-file search visibility
 * @param {Function} params.setShowGlobalSearch - State setter for global search visibility
 * @param {Function} params.setShowShortcutHelp - State setter for shortcut help visibility
 * @param {Function} params.setShowLeft - State setter for left sidebar visibility
 * @param {Function} params.setIsCreatingFolder - State setter for folder creation state
 * @param {Function} params.setSyncScrolling - State setter for sync scrolling state
 * @param {Function} params.setShowWikiLinkModal - State setter for wiki link modal visibility
 * @param {Function} params.setShowTemplatePicker - State setter for template picker visibility
 * @param {Function} params.setTemplatePickerData - State setter for template picker data
 * @param {string} params.activeFile - Currently active file path
 *
 * @example
 * useWorkspaceShortcuts({
 *   handleSave,
 *   handleSaveAs,
 *   activeFile,
 *   stateRef,
 *   editorRef,
 *   setShowCommandPalette,
 *   // ... other handlers and state setters
 * });
 */
export function useWorkspaceShortcuts({
  handleSave,
  handleSaveAs,
  handleExportHtml,
  handleExportPdf,
  handleOpenWorkspace,
  handleTabClose,
  handleReopenClosedTab,
  handleToggleSplitView,
  toggleSplitDirection,
  resetPaneSize,
  toggleVersionHistory,
  handleCreateFile,
  handleCreateCanvas,
  handleCreateFolder,
  handleRefreshFiles,
  handleOpenGraphView,
  stateRef,
  editorRef,
  setShowCommandPalette,
  setShowInFileSearch,
  setShowGlobalSearch,
  setShowShortcutHelp,
  setShowLeft,
  setIsCreatingFolder,
  setSyncScrolling,
  setShowWikiLinkModal,
  setShowTemplatePicker,
  setTemplatePickerData,
  activeFile,
}) {
  // Direct keyboard event handler for Cmd/Ctrl+S and Cmd/Ctrl+H
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl+S: Save file
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleSave();
        return;
      }

      // Cmd/Ctrl+H: Toggle version history
      if ((e.metaKey || e.ctrlKey) && e.key === 'h' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (activeFile && !activeFile.startsWith('__')) {
          toggleVersionHistory(activeFile);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleSave, activeFile, toggleVersionHistory]);

  // Main event listeners for all shortcuts and menu actions
  useEffect(() => {
    let isTauri = false;
    try {
      isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__);
    } catch {}

    // Helper to add DOM event listener with cleanup
    const addDom = (name, fn) => {
      const h = () => fn();
      window.addEventListener(name, h);
      return () => window.removeEventListener(name, h);
    };

    // Editor formatting handler
    const handleEditorFormat = (formatType) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;

      switch (formatType) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'underline':
          editor.chain().focus().toggleUnderline().run();
          break;
        case 'strikethrough':
          editor.chain().focus().toggleStrike().run();
          break;
        case 'code':
          editor.chain().focus().toggleCode().run();
          break;
        case 'highlight':
          editor.chain().focus().toggleHighlight().run();
          break;
        case 'superscript':
          editor.chain().focus().toggleSuperscript().run();
          break;
        case 'subscript':
          editor.chain().focus().toggleSubscript().run();
          break;
        case 'clear-formatting':
          editor.chain().focus().unsetAllMarks().run();
          break;
      }
    };

    // Editor edit actions handler
    const handleEditorEdit = (action) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;

      switch (action) {
        case 'undo':
          editor.chain().focus().undo().run();
          break;
        case 'redo':
          editor.chain().focus().redo().run();
          break;
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          document.execCommand('paste');
          break;
        case 'select-all':
          editor.chain().focus().selectAll().run();
          break;
      }
    };

    // Editor insert handler
    const handleEditorInsert = (insertType) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;

      switch (insertType) {
        case 'wikilink':
          setShowWikiLinkModal(true);
          break;
        case 'math-inline':
          editor.chain().focus().insertContent('$  $').setTextSelection(editor.state.selection.from - 2).run();
          break;
        case 'math-block':
          editor.chain().focus().insertContent('\n$$\n\n$$\n').setTextSelection(editor.state.selection.from - 4).run();
          break;
        case 'table':
          if (editor.commands.insertTable) {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          }
          break;
        case 'image':
          const imageUrl = prompt('Enter image URL:');
          if (imageUrl) {
            editor.chain().focus().setImage({ src: imageUrl }).run();
          }
          break;
        case 'code-block':
          editor.chain().focus().setCodeBlock().run();
          break;
        case 'horizontal-rule':
          editor.chain().focus().setHorizontalRule().run();
          break;
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'bullet-list':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'ordered-list':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'task-list':
          editor.chain().focus().toggleTaskList().run();
          break;
      }
    };

    // View actions handler
    const handleViewAction = (action) => {
      switch (action) {
        case 'zoom-in':
          const currentZoom = parseFloat(document.documentElement.style.zoom || '1');
          document.documentElement.style.zoom = Math.min(currentZoom + 0.1, 2).toString();
          break;
        case 'zoom-out':
          const currentZoomOut = parseFloat(document.documentElement.style.zoom || '1');
          document.documentElement.style.zoom = Math.max(currentZoomOut - 0.1, 0.5).toString();
          break;
        case 'actual-size':
          document.documentElement.style.zoom = '1';
          break;
        case 'fullscreen':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
      }
    };

    // Window actions handler
    const handleWindowAction = (action) => {
      if (!window.__TAURI__) return;

      const currentWindow = getCurrentWindow();
      switch (action) {
        case 'minimize':
          currentWindow.minimize();
          break;
        case 'close':
          currentWindow.close();
          break;
        case 'zoom':
          currentWindow.toggleMaximize();
          break;
      }
    };

    // Help actions handler
    const handleHelpAction = (action) => {
      switch (action) {
        case 'help':
          window.open('https://docs.lokus.dev', '_blank');
          break;
        case 'keyboard-shortcuts':
          setShowShortcutHelp(true);
          break;
        case 'release-notes':
          window.open('https://github.com/lokus-app/lokus/releases', '_blank');
          break;
        case 'report-issue':
          window.open('https://github.com/lokus-app/lokus/issues', '_blank');
          break;
      }
    };

    // Template picker handler
    const handleTemplatePicker = (event) => {
      setTemplatePickerData(event.detail);
      setShowTemplatePicker(true);
    };

    // Register all event listeners
    // File operations
    const unlistenSave = isTauri
      ? listen('lokus:save-file', handleSave)
      : Promise.resolve(addDom('lokus:save-file', handleSave));

    const unlistenClose = isTauri
      ? listen('lokus:close-tab', () => {
          if (stateRef.current.activeFile) {
            handleTabClose(stateRef.current.activeFile);
          }
        })
      : Promise.resolve(
          addDom('lokus:close-tab', () => {
            if (stateRef.current.activeFile) handleTabClose(stateRef.current.activeFile);
          })
        );

    const unlistenNewFile = isTauri
      ? listen('lokus:new-file', handleCreateFile)
      : Promise.resolve(addDom('lokus:new-file', handleCreateFile));

    const unlistenNewFolder = isTauri
      ? listen('lokus:new-folder', () => setIsCreatingFolder(true))
      : Promise.resolve(addDom('lokus:new-folder', () => setIsCreatingFolder(true)));

    const unlistenToggleSidebar = isTauri
      ? listen('lokus:toggle-sidebar', () => setShowLeft((v) => !v))
      : Promise.resolve(addDom('lokus:toggle-sidebar', () => setShowLeft((v) => !v)));

    const unlistenCommandPalette = isTauri
      ? listen('lokus:command-palette', () => {
          const isGraphActive =
            stateRef.current.activeFile === '__graph__' ||
            stateRef.current.activeFile?.startsWith('__graph__');
          if (!isGraphActive) {
            setShowCommandPalette(true);
          }
        })
      : Promise.resolve(
          addDom('lokus:command-palette', () => {
            const isGraphActive =
              stateRef.current.activeFile === '__graph__' ||
              stateRef.current.activeFile?.startsWith('__graph__');
            if (!isGraphActive) {
              setShowCommandPalette(true);
            }
          })
        );

    const unlistenInFileSearch = isTauri
      ? listen('lokus:in-file-search', () => setShowInFileSearch(true))
      : Promise.resolve(addDom('lokus:in-file-search', () => setShowInFileSearch(true)));

    const unlistenGlobalSearch = isTauri
      ? listen('lokus:global-search', () => setShowGlobalSearch(true))
      : Promise.resolve(addDom('lokus:global-search', () => setShowGlobalSearch(true)));

    const unlistenGraphView = isTauri
      ? listen('lokus:graph-view', handleOpenGraphView)
      : Promise.resolve(addDom('lokus:graph-view', handleOpenGraphView));

    const unlistenShortcutHelp = isTauri
      ? listen('lokus:shortcut-help', () => {
          setShowShortcutHelp(true);
        })
      : Promise.resolve(
          addDom('lokus:shortcut-help', () => {
            setShowShortcutHelp(true);
          })
        );

    const unlistenRefreshFiles = isTauri
      ? listen('lokus:refresh-files', handleRefreshFiles)
      : Promise.resolve(addDom('lokus:refresh-files', handleRefreshFiles));

    const unlistenNewCanvas = isTauri
      ? listen('lokus:new-canvas', handleCreateCanvas)
      : Promise.resolve(addDom('lokus:new-canvas', handleCreateCanvas));

    const unlistenReopenClosedTab = isTauri
      ? listen('lokus:reopen-closed-tab', handleReopenClosedTab)
      : Promise.resolve(addDom('lokus:reopen-closed-tab', handleReopenClosedTab));

    // Split editor shortcuts
    const unlistenToggleSplitView = isTauri
      ? listen('lokus:toggle-split-view', handleToggleSplitView)
      : Promise.resolve(addDom('lokus:toggle-split-view', handleToggleSplitView));

    const unlistenToggleSplitDirection = isTauri
      ? listen('lokus:toggle-split-direction', toggleSplitDirection)
      : Promise.resolve(addDom('lokus:toggle-split-direction', toggleSplitDirection));

    const unlistenResetPaneSize = isTauri
      ? listen('lokus:reset-pane-size', resetPaneSize)
      : Promise.resolve(addDom('lokus:reset-pane-size', resetPaneSize));

    const unlistenToggleSyncScrolling = isTauri
      ? listen('lokus:toggle-sync-scrolling', () => setSyncScrolling((prev) => !prev))
      : Promise.resolve(addDom('lokus:toggle-sync-scrolling', () => setSyncScrolling((prev) => !prev)));

    // Template picker event listener
    const unlistenTemplatePicker = Promise.resolve(addDom('open-template-picker', handleTemplatePicker));

    // File menu events
    const unlistenExportPdf = isTauri
      ? listen('lokus:export-pdf', handleExportPdf)
      : Promise.resolve(addDom('lokus:export-pdf', handleExportPdf));

    const unlistenPrint = isTauri
      ? listen('lokus:print', () => {
          window.print();
        })
      : Promise.resolve(
          addDom('lokus:print', () => {
            window.print();
          })
        );

    const unlistenShowAbout = isTauri
      ? listen('lokus:show-about', () => {
          // TODO: Show about dialog
        })
      : Promise.resolve(addDom('lokus:show-about', () => {}));

    const unlistenSaveAs = isTauri
      ? listen('lokus:save-as', handleSaveAs)
      : Promise.resolve(addDom('lokus:save-as', handleSaveAs));

    const unlistenExportHtml = isTauri
      ? listen('lokus:export-html', handleExportHtml)
      : Promise.resolve(addDom('lokus:export-html', handleExportHtml));

    const unlistenCloseWindow = isTauri
      ? listen('lokus:close-window', () => handleWindowAction('close'))
      : Promise.resolve(addDom('lokus:close-window', () => handleWindowAction('close')));

    const unlistenOpenWorkspace = isTauri
      ? listen('lokus:open-workspace', (event) => {
          handleOpenWorkspace();
        })
      : Promise.resolve(addDom('lokus:open-workspace', handleOpenWorkspace));

    // Edit menu events
    const unlistenUndo = isTauri
      ? listen('lokus:edit-undo', () => handleEditorEdit('undo'))
      : Promise.resolve(addDom('lokus:edit-undo', () => handleEditorEdit('undo')));

    const unlistenRedo = isTauri
      ? listen('lokus:edit-redo', () => handleEditorEdit('redo'))
      : Promise.resolve(addDom('lokus:edit-redo', () => handleEditorEdit('redo')));

    const unlistenCut = isTauri
      ? listen('lokus:edit-cut', () => handleEditorEdit('cut'))
      : Promise.resolve(addDom('lokus:edit-cut', () => handleEditorEdit('cut')));

    const unlistenCopy = isTauri
      ? listen('lokus:edit-copy', () => handleEditorEdit('copy'))
      : Promise.resolve(addDom('lokus:edit-copy', () => handleEditorEdit('copy')));

    const unlistenPaste = isTauri
      ? listen('lokus:edit-paste', () => handleEditorEdit('paste'))
      : Promise.resolve(addDom('lokus:edit-paste', () => handleEditorEdit('paste')));

    const unlistenSelectAll = isTauri
      ? listen('lokus:edit-select-all', () => handleEditorEdit('select-all'))
      : Promise.resolve(addDom('lokus:edit-select-all', () => handleEditorEdit('select-all')));

    const unlistenFindReplace = isTauri
      ? listen('lokus:find-replace', () => setShowInFileSearch(true))
      : Promise.resolve(addDom('lokus:find-replace', () => setShowInFileSearch(true)));

    // View menu events
    const unlistenZoomIn = isTauri
      ? listen('lokus:zoom-in', () => handleViewAction('zoom-in'))
      : Promise.resolve(addDom('lokus:zoom-in', () => handleViewAction('zoom-in')));

    const unlistenZoomOut = isTauri
      ? listen('lokus:zoom-out', () => handleViewAction('zoom-out'))
      : Promise.resolve(addDom('lokus:zoom-out', () => handleViewAction('zoom-out')));

    const unlistenActualSize = isTauri
      ? listen('lokus:actual-size', () => handleViewAction('actual-size'))
      : Promise.resolve(addDom('lokus:actual-size', () => handleViewAction('actual-size')));

    const unlistenFullscreen = isTauri
      ? listen('lokus:toggle-fullscreen', () => handleViewAction('fullscreen'))
      : Promise.resolve(addDom('lokus:toggle-fullscreen', () => handleViewAction('fullscreen')));

    // Theme switching events
    const unlistenThemeLight = isTauri
      ? listen('lokus:theme-light', () => {
          // TODO: Connect to theme manager to set light theme
        })
      : Promise.resolve(addDom('lokus:theme-light', () => {}));

    const unlistenThemeDark = isTauri
      ? listen('lokus:theme-dark', () => {
          // TODO: Connect to theme manager to set dark theme
        })
      : Promise.resolve(addDom('lokus:theme-dark', () => {}));

    const unlistenThemeAuto = isTauri
      ? listen('lokus:theme-auto', () => {
          // TODO: Connect to theme manager to set auto theme
        })
      : Promise.resolve(addDom('lokus:theme-auto', () => {}));

    // Insert menu events
    const unlistenInsertWikiLink = isTauri
      ? listen('lokus:insert-wikilink', () => handleEditorInsert('wikilink'))
      : Promise.resolve(addDom('lokus:insert-wikilink', () => handleEditorInsert('wikilink')));

    const unlistenInsertMathInline = isTauri
      ? listen('lokus:insert-math-inline', () => handleEditorInsert('math-inline'))
      : Promise.resolve(addDom('lokus:insert-math-inline', () => handleEditorInsert('math-inline')));

    const unlistenInsertMathBlock = isTauri
      ? listen('lokus:insert-math-block', () => handleEditorInsert('math-block'))
      : Promise.resolve(addDom('lokus:insert-math-block', () => handleEditorInsert('math-block')));

    const unlistenInsertMath = isTauri
      ? listen('lokus:insert-math', () => handleEditorInsert('math-inline'))
      : Promise.resolve(addDom('lokus:insert-math', () => handleEditorInsert('math-inline')));

    // Heading insertion events
    const unlistenInsertHeading = isTauri
      ? listen('lokus:insert-heading', (event) => {
          const level = event.payload || 1;
          handleEditorInsert('heading', { level });
        })
      : Promise.resolve(
          addDom('lokus:insert-heading', (event) => {
            const level = event.detail || 1;
            handleEditorInsert('heading', { level });
          })
        );

    const unlistenInsertTable = isTauri
      ? listen('lokus:insert-table', () => handleEditorInsert('table'))
      : Promise.resolve(addDom('lokus:insert-table', () => handleEditorInsert('table')));

    const unlistenInsertImage = isTauri
      ? listen('lokus:insert-image', () => handleEditorInsert('image'))
      : Promise.resolve(addDom('lokus:insert-image', () => handleEditorInsert('image')));

    const unlistenInsertCodeBlock = isTauri
      ? listen('lokus:insert-code-block', () => handleEditorInsert('code-block'))
      : Promise.resolve(addDom('lokus:insert-code-block', () => handleEditorInsert('code-block')));

    const unlistenInsertHorizontalRule = isTauri
      ? listen('lokus:insert-horizontal-rule', () => handleEditorInsert('horizontal-rule'))
      : Promise.resolve(addDom('lokus:insert-horizontal-rule', () => handleEditorInsert('horizontal-rule')));

    const unlistenInsertBlockquote = isTauri
      ? listen('lokus:insert-blockquote', () => handleEditorInsert('blockquote'))
      : Promise.resolve(addDom('lokus:insert-blockquote', () => handleEditorInsert('blockquote')));

    const unlistenInsertBulletList = isTauri
      ? listen('lokus:insert-bullet-list', () => handleEditorInsert('bullet-list'))
      : Promise.resolve(addDom('lokus:insert-bullet-list', () => handleEditorInsert('bullet-list')));

    const unlistenInsertOrderedList = isTauri
      ? listen('lokus:insert-ordered-list', () => handleEditorInsert('ordered-list'))
      : Promise.resolve(addDom('lokus:insert-ordered-list', () => handleEditorInsert('ordered-list')));

    const unlistenInsertTaskList = isTauri
      ? listen('lokus:insert-task-list', () => handleEditorInsert('task-list'))
      : Promise.resolve(addDom('lokus:insert-task-list', () => handleEditorInsert('task-list')));

    // Format menu events
    const unlistenFormatBold = isTauri
      ? listen('lokus:format-bold', () => handleEditorFormat('bold'))
      : Promise.resolve(addDom('lokus:format-bold', () => handleEditorFormat('bold')));

    const unlistenFormatItalic = isTauri
      ? listen('lokus:format-italic', () => handleEditorFormat('italic'))
      : Promise.resolve(addDom('lokus:format-italic', () => handleEditorFormat('italic')));

    const unlistenFormatUnderline = isTauri
      ? listen('lokus:format-underline', () => handleEditorFormat('underline'))
      : Promise.resolve(addDom('lokus:format-underline', () => handleEditorFormat('underline')));

    const unlistenFormatStrikethrough = isTauri
      ? listen('lokus:format-strikethrough', () => handleEditorFormat('strikethrough'))
      : Promise.resolve(addDom('lokus:format-strikethrough', () => handleEditorFormat('strikethrough')));

    const unlistenFormatCode = isTauri
      ? listen('lokus:format-code', () => handleEditorFormat('code'))
      : Promise.resolve(addDom('lokus:format-code', () => handleEditorFormat('code')));

    const unlistenFormatHighlight = isTauri
      ? listen('lokus:format-highlight', () => handleEditorFormat('highlight'))
      : Promise.resolve(addDom('lokus:format-highlight', () => handleEditorFormat('highlight')));

    const unlistenFormatSuperscript = isTauri
      ? listen('lokus:format-superscript', () => handleEditorFormat('superscript'))
      : Promise.resolve(addDom('lokus:format-superscript', () => handleEditorFormat('superscript')));

    const unlistenFormatSubscript = isTauri
      ? listen('lokus:format-subscript', () => handleEditorFormat('subscript'))
      : Promise.resolve(addDom('lokus:format-subscript', () => handleEditorFormat('subscript')));

    const unlistenFormatClear = isTauri
      ? listen('lokus:format-clear', () => handleEditorFormat('clear-formatting'))
      : Promise.resolve(addDom('lokus:format-clear', () => handleEditorFormat('clear-formatting')));

    // Window menu events
    const unlistenWindowMinimize = isTauri
      ? listen('lokus:window-minimize', () => handleWindowAction('minimize'))
      : Promise.resolve(addDom('lokus:window-minimize', () => handleWindowAction('minimize')));

    const unlistenWindowClose = isTauri
      ? listen('lokus:window-close', () => handleWindowAction('close'))
      : Promise.resolve(addDom('lokus:window-close', () => handleWindowAction('close')));

    const unlistenWindowZoom = isTauri
      ? listen('lokus:window-zoom', () => handleWindowAction('zoom'))
      : Promise.resolve(addDom('lokus:window-zoom', () => handleWindowAction('zoom')));

    // Help menu events
    const unlistenHelp = isTauri
      ? listen('lokus:help', () => handleHelpAction('help'))
      : Promise.resolve(addDom('lokus:help', () => handleHelpAction('help')));

    const unlistenKeyboardShortcuts = isTauri
      ? listen('lokus:keyboard-shortcuts', () => handleHelpAction('keyboard-shortcuts'))
      : Promise.resolve(addDom('lokus:keyboard-shortcuts', () => handleHelpAction('keyboard-shortcuts')));

    const unlistenReleaseNotes = isTauri
      ? listen('lokus:release-notes', () => handleHelpAction('release-notes'))
      : Promise.resolve(addDom('lokus:release-notes', () => handleHelpAction('release-notes')));

    const unlistenReportIssue = isTauri
      ? listen('lokus:report-issue', () => handleHelpAction('report-issue'))
      : Promise.resolve(addDom('lokus:report-issue', () => handleHelpAction('report-issue')));

    // Cleanup function
    return () => {
      unlistenSave.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenClose.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenNewFile.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenNewFolder.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenToggleSidebar.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenCommandPalette.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInFileSearch.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenGlobalSearch.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenGraphView.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenShortcutHelp.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenRefreshFiles.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenNewCanvas.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenReopenClosedTab.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenToggleSplitView.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenToggleSplitDirection.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenResetPaneSize.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenToggleSyncScrolling.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenTemplatePicker.then((f) => {
        if (typeof f === 'function') f();
      });

      // Cleanup menu event listeners
      unlistenExportPdf.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenPrint.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenUndo.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenRedo.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenCut.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenCopy.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenPaste.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenSelectAll.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFindReplace.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenZoomIn.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenZoomOut.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenActualSize.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFullscreen.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertWikiLink.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertMathInline.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertMathBlock.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertTable.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertImage.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertCodeBlock.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertHorizontalRule.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertBlockquote.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertBulletList.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertOrderedList.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertTaskList.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatBold.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatItalic.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatUnderline.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatStrikethrough.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatCode.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatHighlight.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatSuperscript.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatSubscript.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenFormatClear.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenWindowMinimize.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenWindowClose.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenHelp.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenKeyboardShortcuts.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenReleaseNotes.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenReportIssue.then((f) => {
        if (typeof f === 'function') f();
      });

      // Clean up new event listeners
      unlistenShowAbout.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenSaveAs.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenExportHtml.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenCloseWindow.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenOpenWorkspace.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenThemeLight.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenThemeDark.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenThemeAuto.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertMath.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenInsertHeading.then((f) => {
        if (typeof f === 'function') f();
      });
      unlistenWindowZoom.then((f) => {
        if (typeof f === 'function') f();
      });
    };
  }, [
    handleSave,
    handleSaveAs,
    handleExportHtml,
    handleExportPdf,
    handleOpenWorkspace,
    handleTabClose,
    handleReopenClosedTab,
    handleToggleSplitView,
    toggleSplitDirection,
    resetPaneSize,
  ]);
}
