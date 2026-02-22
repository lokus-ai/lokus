import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import referenceManager from '../../../core/references/ReferenceManager';

export function useFileOperations({ workspacePath }) {
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const startCreate = useWorkspaceStore((s) => s.startCreate);
  const cancelCreate = useWorkspaceStore((s) => s.cancelCreate);
  const startRename = useWorkspaceStore((s) => s.startRename);
  const cancelRename = useWorkspaceStore((s) => s.cancelRename);

  const handleCreateFile = useCallback((targetPath) => {
    startCreate('file', targetPath || workspacePath);
  }, [workspacePath, startCreate]);

  const handleCreateFolder = useCallback((targetPath) => {
    startCreate('folder', targetPath || workspacePath);
  }, [workspacePath, startCreate]);

  const handleConfirmCreate = useCallback(async (name) => {
    if (!name) {
      cancelCreate();
      return;
    }

    const store = useWorkspaceStore.getState();
    const { creatingItem } = store;
    if (!creatingItem) return;

    try {
      if (creatingItem.type === 'folder') {
        await invoke('create_folder', {
          path: creatingItem.targetPath,
          name,
        });
      } else {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        await invoke('create_file', {
          path: creatingItem.targetPath,
          name: fileName,
        });
      }
      cancelCreate();
      refreshTree();
    } catch (e) {
      console.error('Failed to create:', e);
      cancelCreate();
    }
  }, [cancelCreate, refreshTree]);

  const handleDelete = useCallback(async (path) => {
    const shouldDelete = await confirm(`Delete "${path.split('/').pop()}"?`, {
      title: 'Delete',
      kind: 'warning',
    });
    if (!shouldDelete) return;

    try {
      await invoke('delete_file', { path });
      const store = useWorkspaceStore.getState();
      // Close tab if open
      if (store.openTabs.some(t => t.path === path)) {
        store.closeTab(path);
      }
      refreshTree();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  }, [refreshTree]);

  const handleCheckReferences = useCallback(async (oldPath, newPath) => {
    try {
      const affected = await referenceManager.findAffectedFiles(oldPath, workspacePath);
      if (affected.length > 0) {
        useWorkspaceStore.setState({
          referenceUpdateModal: {
            isOpen: true,
            oldPath,
            newPath,
            affectedFiles: affected,
            isProcessing: false,
            result: null,
            pendingOperation: null,
          }
        });
        return true; // has references
      }
      return false; // no references, safe to proceed
    } catch (e) {
      return false;
    }
  }, [workspacePath]);

  const handleConfirmReferenceUpdate = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const { referenceUpdateModal } = store;
    if (!referenceUpdateModal.isOpen) return;

    store.setReferenceUpdateModal({
      ...referenceUpdateModal,
      isProcessing: true,
    });

    try {
      const result = await referenceManager.updateReferences(
        referenceUpdateModal.oldPath,
        referenceUpdateModal.newPath,
        referenceUpdateModal.affectedFiles,
        workspacePath,
      );
      store.setReferenceUpdateModal({
        ...referenceUpdateModal,
        isProcessing: false,
        result,
      });
      refreshTree();
    } catch (e) {
      store.setReferenceUpdateModal({
        ...referenceUpdateModal,
        isProcessing: false,
        result: { error: e.message },
      });
    }
  }, [workspacePath, refreshTree]);

  return {
    handleCreateFile,
    handleCreateFolder,
    handleConfirmCreate,
    handleDelete,
    handleCheckReferences,
    handleConfirmReferenceUpdate,
  };
}
