import { useCallback } from 'react';
import { useFileTreeStore } from '../../../stores/fileTree';
import { invoke } from '@tauri-apps/api/core';

export function useFileDragDrop({ workspacePath }) {
  const refreshTree = useFileTreeStore((s) => s.refreshTree);
  const setHoveredFolder = useFileTreeStore((s) => s.setHoveredFolder);
  const setExternalDragActive = useFileTreeStore((s) => s.setExternalDragActive);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    try {
      await invoke('move_file', {
        source: active.id,
        destination: over.id,
      });
      refreshTree();
    } catch (e) {
      console.error('Failed to move file:', e);
    }
  }, [refreshTree]);

  return { handleDragEnd, setHoveredFolder, setExternalDragActive };
}
