import { useCallback } from 'react';
import { useFileTreeStore } from '../../../stores/fileTree';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { useViewStore } from '../../../stores/views';
import { getEditor } from '../../../stores/editorRegistry';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { toast } from '../../../components/ui/enhanced-toast';
import referenceWorkerClient from '../../../workers/referenceWorkerClient.js';
import referenceManager from '../../../core/references/ReferenceManager.js';
import { canvasManager } from '../../../core/canvas/manager.js';
import dailyNotesManager from '../../../core/daily-notes/manager.js';
import posthog from '../../../services/posthog.js';
import { setGlobalActiveTheme } from '../../../core/theme/manager.js';
import { createLokusSerializer } from '../../../core/markdown/lokus-md-pipeline.js';

export function useFileOperations({ workspacePath, featureFlags, handleFileOpen, currentTheme }) {
  const refreshTree = useFileTreeStore((s) => s.refreshTree);
  const startCreate = useFileTreeStore((s) => s.startCreate);
  const cancelCreate = useFileTreeStore((s) => s.cancelCreate);
  const startRename = useFileTreeStore((s) => s.startRename);
  const cancelRename = useFileTreeStore((s) => s.cancelRename);

  // ---------------------------------------------------------------------------
  // Target path resolution
  // Priority: 1. Selected path, 2. Bases folder, 3. Expanded folder, 4. Scoped folder, 5. Workspace root
  // ---------------------------------------------------------------------------
  const getTargetPath = useCallback(() => {
    const ftStore = useFileTreeStore.getState();
    const { selectedPath, fileTree, expandedFolders } = ftStore;

    const egStore = useEditorGroupStore.getState();
    const focusedGroup = egStore.getFocusedGroup();
    const openTabs = focusedGroup?.tabs || [];

    const findEntry = (entries, targetPath) => {
      for (const entry of entries) {
        if (entry.path === targetPath) {
          return entry;
        }
        if (entry.is_directory && entry.children) {
          const found = findEntry(entry.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    if (selectedPath) {
      const selectedEntry = findEntry(fileTree, selectedPath);
      if (selectedEntry) {
        if (selectedEntry.is_directory) {
          return selectedEntry.path;
        } else {
          return selectedPath.split('/').slice(0, -1).join('/') || workspacePath;
        }
      }
    }

    // Bases tab check — requires access to activeBase which lives in BasesContext,
    // so we read it from the store if available, otherwise skip.
    const hasBasesTab = openTabs.some(tab => tab.path === '__bases__');
    if (hasBasesTab) {
      // activeBase is not in the editor group store; callers that need bases support
      // should override this behaviour. Fall through to expanded folders.
    }

    if (expandedFolders.size > 0) {
      const expandedArray = Array.from(expandedFolders);
      const deepestFolder = expandedArray.reduce((deepest, current) => {
        return current.length > deepest.length ? current : deepest;
      }, expandedArray[0]);
      return deepestFolder;
    }

    return workspacePath;
  }, [workspacePath]);

  // ---------------------------------------------------------------------------
  // File / folder creation
  // ---------------------------------------------------------------------------
  const handleCreateFile = useCallback(() => {
    const targetPath = getTargetPath();
    if (targetPath !== workspacePath) {
      const { expandedFolders } = useFileTreeStore.getState();
      useFileTreeStore.getState().setFileTree(useFileTreeStore.getState().fileTree); // no-op placeholder
      // Expand the target folder by toggling only if not already expanded
      if (!expandedFolders.has(targetPath)) {
        useFileTreeStore.getState().toggleFolder(targetPath);
      }
    }
    useFileTreeStore.getState().startCreate('file', targetPath);
  }, [workspacePath, getTargetPath]);

  const handleCreateFolder = useCallback(() => {
    const targetPath = getTargetPath();
    if (targetPath !== workspacePath) {
      const { expandedFolders } = useFileTreeStore.getState();
      if (!expandedFolders.has(targetPath)) {
        useFileTreeStore.getState().toggleFolder(targetPath);
      }
    }
    useFileTreeStore.getState().startCreate('folder', targetPath);
  }, [workspacePath, getTargetPath]);

  const handleConfirmCreate = useCallback(async (name) => {
    const { creatingItem } = useFileTreeStore.getState();
    if (!creatingItem || !name) {
      useFileTreeStore.getState().cancelCreate();
      return;
    }

    try {
      if (creatingItem.type === 'file') {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const newPath = await invoke('create_file_in_workspace', {
          workspacePath: creatingItem.targetPath,
          name: fileName,
        });
        refreshTree();
        handleFileOpen?.({ path: newPath, name: fileName, is_directory: false });
      } else {
        await invoke('create_folder_in_workspace', {
          workspacePath: creatingItem.targetPath,
          name,
        });
        refreshTree();
      }
    } catch (e) {
      console.error('Failed to create:', e);
    }

    useFileTreeStore.getState().cancelCreate();
  }, [refreshTree, handleFileOpen]);

  // ---------------------------------------------------------------------------
  // Canvas creation
  // ---------------------------------------------------------------------------
  const handleCreateCanvas = useCallback(async () => {
    if (!featureFlags?.enable_canvas) {
      return;
    }
    try {
      const targetPath = getTargetPath();
      const newCanvasPath = await canvasManager.createCanvas(targetPath, 'Untitled Canvas');
      refreshTree();
      handleFileOpen?.({ path: newCanvasPath, name: 'Untitled Canvas.canvas', is_directory: false });
      posthog.trackFeatureActivation('canvas');
    } catch { }
  }, [featureFlags, getTargetPath, refreshTree, handleFileOpen]);

  // ---------------------------------------------------------------------------
  // Kanban creation and board actions
  // ---------------------------------------------------------------------------
  const handleCreateKanban = useCallback(async () => {
    try {
      const targetPath = getTargetPath();
      await invoke('create_kanban_board', {
        workspacePath: targetPath,
        name: 'New Board',
        columns: ['To Do', 'In Progress', 'Done'],
      });
      refreshTree();
      const fileName = 'New Board.kanban';
      const boardPath = `${targetPath}/${fileName}`;
      handleFileOpen?.({ path: boardPath, name: fileName, is_directory: false });
      posthog.trackFeatureActivation('database');
    } catch { }
  }, [getTargetPath, refreshTree, handleFileOpen]);

  const handleKanbanBoardAction = useCallback(async (action, board, refreshBoards) => {
    switch (action) {
      case 'revealInFinder':
        try {
          await invoke('platform_reveal_in_file_manager', { path: board.path });
        } catch (err) {
          console.error('Failed to reveal board in finder', err);
          toast.error('Failed to reveal in finder');
        }
        break;
      case 'copyPath':
        try {
          await navigator.clipboard.writeText(board.path);
          toast.success('Board path copied');
        } catch (err) {
          toast.error('Failed to copy path');
        }
        break;
      case 'duplicate':
        try {
          const content = await invoke('read_file_content', { path: board.path });
          const dirPath = board.path.split('/').slice(0, -1).join('/');
          const baseName = board.name.replace(/\.kanban$/, '');
          const newName = `${baseName} copy.kanban`;
          const newPath = `${dirPath}/${newName}`;
          await invoke('write_file_content', { path: newPath, content });
          refreshBoards?.();
          toast.success(`Duplicated: ${newName}`);
        } catch (err) {
          toast.error('Failed to duplicate board');
        }
        break;
      case 'export':
        try {
          const content = await invoke('read_file_content', { path: board.path });
          const blob = new Blob([content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${board.name}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Board exported');
        } catch (err) {
          toast.error('Failed to export board');
        }
        break;
      case 'delete':
        try {
          const confirmed = await confirm(`Are you sure you want to delete "${board.name}"?`);
          if (confirmed) {
            await invoke('delete_file', { path: board.path });
            refreshBoards?.();
            toast.success(`Deleted: ${board.name}`);
          }
        } catch (err) {
          toast.error('Failed to delete board');
        }
        break;
      default:
        break;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Daily notes
  // ---------------------------------------------------------------------------
  const handleOpenDailyNote = useCallback(async () => {
    try {
      const result = await dailyNotesManager.openToday();
      const fileName = result.path.split('/').pop();

      handleFileOpen?.({
        path: result.path,
        name: fileName,
        is_directory: false,
      });

      if (result.created) {
        refreshTree();
      }

      posthog.trackFeatureActivation('daily_notes');
    } catch { }
  }, [handleFileOpen, refreshTree]);

  const handleOpenDailyNoteByDate = useCallback(async (date) => {
    try {
      const result = await dailyNotesManager.openDate(date);
      const fileName = result.path.split('/').pop();

      handleFileOpen?.({
        path: result.path,
        name: fileName,
        is_directory: false,
      });

      if (result.created) {
        refreshTree();
      }

      useViewStore.getState().closePanel('datePickerModal');

      posthog.trackFeatureActivation('daily_notes');
    } catch { }
  }, [handleFileOpen, refreshTree]);

  // ---------------------------------------------------------------------------
  // Template creation
  // ---------------------------------------------------------------------------
  const handleCreateTemplate = useCallback(() => {
    const getContentForTemplate = () => {
      const focusedGroup = useEditorGroupStore.getState().getFocusedGroup();
      const view = getEditor(focusedGroup?.id);

      if (view) {
        const { state } = view;
        const { selection } = state;

        if (!selection.empty) {
          // Serialize the selected content to markdown
          const selectedText = state.doc.textBetween(selection.from, selection.to);
          if (selectedText) return selectedText;
        }

        // Serialize the full document to markdown
        try {
          const serializer = createLokusSerializer();
          return serializer.serialize(state.doc);
        } catch {
          // Fallback: return the plain text content
          return state.doc.textContent;
        }
      }
      return '';
    };

    const contentForTemplate = getContentForTemplate();
    useViewStore.setState({ createTemplateContent: contentForTemplate });
    useViewStore.getState().openPanel('showCreateTemplate');
  }, []);

  const handleCreateTemplateSaved = useCallback(() => {
    useViewStore.getState().closePanel('showCreateTemplate');
    useViewStore.setState({ createTemplateContent: '' });
  }, []);

  // ---------------------------------------------------------------------------
  // Workspace launcher
  // ---------------------------------------------------------------------------
  const handleOpenWorkspace = useCallback(async () => {
    try {
      if (currentTheme) {
        await setGlobalActiveTheme(currentTheme);
      }
      await invoke('clear_last_workspace');
      await invoke('open_launcher_window');
    } catch { }
  }, [currentTheme]);

  // ---------------------------------------------------------------------------
  // Reference checking (kept from original hook)
  // ---------------------------------------------------------------------------
  const handleDelete = useCallback(async (path) => {
    const shouldDelete = await confirm(`Delete "${path.split('/').pop()}"?`, {
      title: 'Delete',
      kind: 'warning',
    });
    if (!shouldDelete) return;

    try {
      await invoke('delete_file', { path });
      const egStore = useEditorGroupStore.getState();
      const focusedGroup = egStore.getFocusedGroup();
      if (focusedGroup && focusedGroup.tabs.some(t => t.path === path)) {
        egStore.removeTab(focusedGroup.id, path);
      }
      refreshTree();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  }, [refreshTree]);

  const handleCheckReferences = useCallback(async (oldPath, newPath) => {
    try {
      const backlinkSources = referenceWorkerClient.getBacklinksForFile(oldPath);
      if (backlinkSources.length > 0) {
        // Convert flat source-path list to the shape the modal expects:
        // { filePath: string }[]
        const affectedFiles = backlinkSources.map(filePath => ({ filePath }));
        useViewStore.getState().setReferenceUpdateModal({
          isOpen: true,
          oldPath,
          newPath,
          affectedFiles,
          isProcessing: false,
          result: null,
          pendingOperation: null,
        });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }, []);

  const handleConfirmReferenceUpdate = useCallback(async () => {
    const viewStore = useViewStore.getState();
    const { referenceUpdateModal } = viewStore;
    if (!referenceUpdateModal.isOpen) return;

    viewStore.setReferenceUpdateModal({
      ...referenceUpdateModal,
      isProcessing: true,
    });

    try {
      const result = await referenceManager.updateAllReferences(
        referenceUpdateModal.oldPath,
        referenceUpdateModal.newPath,
      );
      viewStore.setReferenceUpdateModal({
        ...referenceUpdateModal,
        isProcessing: false,
        result,
      });
      refreshTree();
    } catch (e) {
      viewStore.setReferenceUpdateModal({
        ...referenceUpdateModal,
        isProcessing: false,
        result: { error: e.message },
      });
    }
  }, [workspacePath, refreshTree]);

  return {
    // Target path
    getTargetPath,
    // File / folder creation
    handleCreateFile,
    handleCreateFolder,
    handleConfirmCreate,
    // Canvas
    handleCreateCanvas,
    // Kanban
    handleCreateKanban,
    handleKanbanBoardAction,
    // Daily notes
    handleOpenDailyNote,
    handleOpenDailyNoteByDate,
    // Templates
    handleCreateTemplate,
    handleCreateTemplateSaved,
    // Workspace launcher
    handleOpenWorkspace,
    // Delete & references (original hook members)
    handleDelete,
    handleCheckReferences,
    handleConfirmReferenceUpdate,
  };
}
