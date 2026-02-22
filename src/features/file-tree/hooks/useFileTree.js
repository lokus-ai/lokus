import { useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';

export function useFileTree({ workspacePath }) {
  const setFileTree = useWorkspaceStore((s) => s.setFileTree);
  const refreshId = useWorkspaceStore((s) => s.refreshId);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const toggleFolder = useWorkspaceStore((s) => s.toggleFolder);
  const closeAllFolders = useWorkspaceStore((s) => s.closeAllFolders);

  const loadFileTree = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const tree = await invoke('list_files', { path: workspacePath });
      setFileTree(tree);
    } catch (e) {
      console.error('Failed to load file tree:', e);
    }
  }, [workspacePath, setFileTree]);

  // Reload tree when refreshId changes
  useEffect(() => {
    loadFileTree();
  }, [refreshId, loadFileTree]);

  return { loadFileTree, refreshTree, toggleFolder, closeAllFolders };
}
