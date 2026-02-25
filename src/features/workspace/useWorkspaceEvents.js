import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useLayoutStore } from "../../stores/layout";
import { useViewStore } from "../../stores/views";
import { useEditorGroupStore } from "../../stores/editorGroups";
import { useFileTreeStore } from "../../stores/fileTree";
import { getEditor } from "../../stores/editorRegistry";
import { useLayoutDefaults } from "../../contexts/RemoteConfigContext";
import { getActiveShortcuts } from "../../core/shortcuts/registry.js";
import { getFilename } from "../../utils/pathUtils.js";
import { isImageFile } from "../../utils/imageUtils.js";
import { generatePreview } from "../../core/canvas/preview-generator.js";
import { insertContent, insertText } from "../../editor/commands/index.js";

/** Returns true when the app is running inside Tauri. */
function isTauriEnv() {
  try {
    return !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__);
  } catch {
    return false;
  }
}

/**
 * Registers all workspace-level event listeners.
 */
export function useWorkspaceEvents({
  workspacePath,
  graphProcessorRef,
  insertImagesIntoEditor,
}) {
  const layoutDefaults = useLayoutDefaults();

  // -------------------------------------------------------------------------
  // Layout defaults initialisation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (layoutDefaults.left_sidebar_visible !== undefined) {
      useLayoutStore.setState({ showLeft: layoutDefaults.left_sidebar_visible });
    }
    if (layoutDefaults.right_sidebar_visible !== undefined) {
      useLayoutStore.setState({ showRight: layoutDefaults.right_sidebar_visible });
    }
  }, [layoutDefaults]);

  // -------------------------------------------------------------------------
  // lokus:open-file / lokus:open-file-new-tab
  // -------------------------------------------------------------------------
  useEffect(() => {
    const openPath = (p, switchToTab = true) => {
      if (!p) return;
      const name = getFilename(p);
      const store = useEditorGroupStore.getState();
      const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
      if (!groupId) return;
      store.addTab(groupId, { path: p, name }, switchToTab);
      store.addRecentFile(p);
    };

    if (isTauriEnv()) {
      const un1 = listen('lokus:open-file', (e) => openPath(String(e.payload || ''), true));
      const un2 = listen('lokus:open-file-new-tab', (e) => openPath(String(e.payload || ''), false));
      return () => { un1.then(u => u()); un2.then(u => u()); };
    } else {
      const onDom1 = (e) => openPath(String(e.detail || ''), true);
      const onDom2 = (e) => openPath(String(e.detail || ''), false);
      window.addEventListener('lokus:open-file', onDom1);
      window.addEventListener('lokus:open-file-new-tab', onDom2);
      return () => {
        window.removeEventListener('lokus:open-file', onDom1);
        window.removeEventListener('lokus:open-file-new-tab', onDom2);
      };
    }
  }, []);

  // -------------------------------------------------------------------------
  // Wiki link creation listener
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleWikiLinkCreated = async (event) => {
      const { sourceFile } = event.detail;

      if (graphProcessorRef.current) {
        try {
          const group = useEditorGroupStore.getState().getFocusedGroup();
          const activeFile = group?.activeTab;
          const focusedEditor = getEditor(group?.id);
          const currentContent = focusedEditor?.state?.doc?.textContent || '';

          if (currentContent && sourceFile === activeFile) {
            const updateResult = await graphProcessorRef.current.updateFileContent(sourceFile, currentContent);

            if ((updateResult.added > 0 || updateResult.removed > 0) && useViewStore.getState().currentView === 'graph') {
              const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
              useEditorGroupStore.getState().setGraphData(updatedGraphData);
            }
          }
        } catch {}
      }
    };

    const handleScrollToBlock = (e) => {
      const blockId = e.detail;
      if (!blockId) return;

      const attemptScroll = (delay) => {
        setTimeout(() => {
          const editorEl = document.querySelector('.ProseMirror');
          if (!editorEl) return;

          // Strategy 1: data-block-id attribute
          const blockWithId = editorEl.querySelector(`[data-block-id="${blockId}"]`);
          if (blockWithId) {
            blockWithId.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const target = blockWithId.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote') || blockWithId;
            target.style.backgroundColor = 'rgba(255, 200, 0, 0.3)';
            setTimeout(() => { target.style.backgroundColor = ''; }, 2000);
            return;
          }

          // Strategy 2: Search headings
          const headings = editorEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
          let foundHeading = null;

          for (const heading of headings) {
            const headingText = heading.textContent.trim();
            const idMatch = headingText.match(/\{#([^}]+)\}/);
            if (idMatch && idMatch[1] === blockId) { foundHeading = heading; break; }

            const headingSlug = headingText
              .toLowerCase()
              .replace(/\{#[^}]+\}/g, '')
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
              .slice(0, 50);

            if (headingSlug === blockId.toLowerCase()) { foundHeading = heading; break; }

            const searchText = blockId.replace(/-/g, ' ').toLowerCase();
            if (headingText.toLowerCase().includes(searchText)) { foundHeading = heading; break; }
          }

          if (foundHeading) {
            foundHeading.scrollIntoView({ behavior: 'smooth', block: 'center' });
            foundHeading.style.backgroundColor = 'rgba(255, 200, 0, 0.3)';
            setTimeout(() => { foundHeading.style.backgroundColor = ''; }, 2000);
          }
        }, delay);
      };

      attemptScroll(100);
      attemptScroll(300);
      attemptScroll(600);
    };

    window.addEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
    document.addEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
    window.addEventListener('lokus:scroll-to-block', handleScrollToBlock);

    return () => {
      window.removeEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
      document.removeEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
      window.removeEventListener('lokus:scroll-to-block', handleScrollToBlock);
    };
  }, [graphProcessorRef]);

  // -------------------------------------------------------------------------
  // Canvas link hover / open
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleCanvasLinkHover = async (event) => {
      const { canvasName, canvasPath, position } = event.detail;
      useViewStore.setState({ canvasPreview: { canvasName, canvasPath, position, loading: true } });

      try {
        const thumbnailUrl = await generatePreview(canvasPath);
        useViewStore.setState((s) => ({
          canvasPreview: s.canvasPreview?.canvasPath === canvasPath
            ? { ...s.canvasPreview, thumbnailUrl, loading: false }
            : null
        }));
      } catch {
        useViewStore.setState((s) => ({
          canvasPreview: s.canvasPreview?.canvasPath === canvasPath
            ? { ...s.canvasPreview, error: true, loading: false }
            : null
        }));
      }
    };

    const handleCanvasLinkHoverEnd = () => {
      useViewStore.setState({ canvasPreview: null });
    };

    const handleOpenCanvas = (event) => {
      let { canvasPath } = event.detail;

      if (canvasPath && !canvasPath.startsWith('/') && !canvasPath.includes('/')) {
        const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
        const canvasFileName = canvasPath.endsWith('.canvas') ? canvasPath : `${canvasPath}.canvas`;
        const matchedFile = fileIndex.find(file => {
          const fileName = file.name || file.path.split('/').pop();
          return fileName === canvasFileName || fileName === canvasPath;
        });
        if (matchedFile) canvasPath = matchedFile.path;
      }

      const store = useEditorGroupStore.getState();
      const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
      if (groupId && canvasPath) {
        const name = canvasPath.split('/').pop() || canvasPath;
        store.addTab(groupId, { path: canvasPath, name }, true);
      }
    };

    window.addEventListener('canvas-link-hover', handleCanvasLinkHover);
    window.addEventListener('canvas-link-hover-end', handleCanvasLinkHoverEnd);
    window.addEventListener('lokus:open-canvas', handleOpenCanvas);

    return () => {
      window.removeEventListener('canvas-link-hover', handleCanvasLinkHover);
      window.removeEventListener('canvas-link-hover-end', handleCanvasLinkHoverEnd);
      window.removeEventListener('lokus:open-canvas', handleOpenCanvas);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Ctrl+Tab keyboard handler (capture phase)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();

        const store = useEditorGroupStore.getState();
        const group = store.getFocusedGroup();
        if (!group || group.tabs.length <= 1) return;

        const currentIndex = group.tabs.findIndex(tab => tab.path === group.activeTab);

        if (e.shiftKey) {
          const prevIndex = currentIndex === 0 ? group.tabs.length - 1 : currentIndex - 1;
          store.setActiveTab(group.id, group.tabs[prevIndex].path);
        } else {
          const nextIndex = (currentIndex + 1) % group.tabs.length;
          store.setActiveTab(group.id, group.tabs[nextIndex].path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // -------------------------------------------------------------------------
  // Shortcuts loading / hot-reload
  // -------------------------------------------------------------------------
  useEffect(() => {
    getActiveShortcuts().then(m => useFileTreeStore.setState({ keymap: m })).catch(() => {});

    if (isTauriEnv()) {
      const sub = listen('shortcuts:updated', async () => {
        const m = await getActiveShortcuts();
        useFileTreeStore.setState({ keymap: m });
      });
      return () => { sub.then((un) => un()); };
    } else {
      const onDom = async () => { useFileTreeStore.setState({ keymap: await getActiveShortcuts() }); };
      window.addEventListener('shortcuts:updated', onDom);
      return () => window.removeEventListener('shortcuts:updated', onDom);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Markdown config change listener
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTauriEnv()) return;

    const sub = listen('lokus:markdown-config-changed', async () => {
      try {
        const markdownSyntaxConfig = (await import('../../core/markdown/syntax-config.js')).default;
        await markdownSyntaxConfig.init();
      } catch {}
    });
    return () => { sub.then((un) => un()); };
  }, []);

  // -------------------------------------------------------------------------
  // External file drop listeners (Tauri 2.0)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!workspacePath) return;

    const hoveredFolderRef = { current: useFileTreeStore.getState().hoveredFolder };
    const unsubHovered = useFileTreeStore.subscribe(
      (s) => s.hoveredFolder,
      (v) => { hoveredFolderRef.current = v; }
    );

    let unlistenDrop;
    let unlistenOver;
    let unlistenLeave;
    let isCleanedUp = false;

    const setupFileDropListeners = async () => {
      try {
        unlistenDrop = await listen('tauri://drag-drop', async (event) => {
          if (isCleanedUp) return;

          const filePaths = event.payload.paths || event.payload;
          useFileTreeStore.getState().setExternalDragActive(false);

          try {
            const targetFolder = hoveredFolderRef.current || null;
            const result = await invoke('copy_external_files_to_workspace', {
              filePaths,
              workspacePath,
              targetFolder,
            });

            if (result.success.length > 0) {
              useFileTreeStore.getState().refreshTree();

              const imageFiles = result.success.filter(p => isImageFile(p));
              if (imageFiles.length > 0) {
                insertImagesIntoEditor(imageFiles);
              }
            }
          } catch {} finally {
            useFileTreeStore.getState().setHoveredFolder(null);
          }
        });

        unlistenOver = await listen('tauri://drag-over', () => {
          if (isCleanedUp) return;
          useFileTreeStore.getState().setExternalDragActive(true);
        });

        unlistenLeave = await listen('tauri://drag-leave', () => {
          if (isCleanedUp) return;
          useFileTreeStore.getState().setExternalDragActive(false);
          useFileTreeStore.getState().setHoveredFolder(null);
        });
      } catch {}
    };

    setupFileDropListeners();

    return () => {
      isCleanedUp = true;
      unsubHovered();
      if (unlistenDrop) unlistenDrop();
      if (unlistenOver) unlistenOver();
      if (unlistenLeave) unlistenLeave();
    };
  }, [workspacePath, insertImagesIntoEditor]);

  // -------------------------------------------------------------------------
  // Template picker DOM event
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleTemplatePicker = (event) => {
      const data = event?.detail || event;
      useViewStore.setState({ templatePickerData: data });
      useViewStore.getState().openPanel('showTemplatePicker');
    };
    window.addEventListener('open-template-picker', handleTemplatePicker);
    return () => window.removeEventListener('open-template-picker', handleTemplatePicker);
  }, []);

  // -------------------------------------------------------------------------
  // Insert template DOM event
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleInsertTemplate = (event) => {
      const { content } = event.detail;
      if (!content) return;

      const focusedGroupId = useEditorGroupStore.getState().focusedGroupId;
      const view = getEditor(focusedGroupId);
      if (!view) return;

      const { state } = view;
      const { from } = state.selection;

      const textBefore = state.doc.textBetween(Math.max(0, from - 50), from);
      const lastSlashIndex = textBefore.lastIndexOf('/');

      if (lastSlashIndex !== -1) {
        const slashPos = from - (textBefore.length - lastSlashIndex);
        // Delete the slash command text, then insert template content
        const tr = state.tr.delete(slashPos, from);
        view.dispatch(tr);
        insertText(view, content);
      } else {
        insertText(view, content);
      }
    };

    window.addEventListener('lokus:insert-template', handleInsertTemplate);
    return () => window.removeEventListener('lokus:insert-template', handleInsertTemplate);
  }, []);
}
