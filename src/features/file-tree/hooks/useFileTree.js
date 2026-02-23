import { useCallback, useEffect } from 'react';
import { useFileTreeStore } from '../../../stores/fileTree';
import { invoke } from '@tauri-apps/api/core';

export function useFileTree({ workspacePath }) {
  const setFileTree = useFileTreeStore((s) => s.setFileTree);
  const refreshId = useFileTreeStore((s) => s.refreshId);
  const refreshTree = useFileTreeStore((s) => s.refreshTree);
  const toggleFolder = useFileTreeStore((s) => s.toggleFolder);
  const closeAllFolders = useFileTreeStore((s) => s.closeAllFolders);

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
