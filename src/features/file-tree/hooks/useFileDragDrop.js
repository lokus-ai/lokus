import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';

export function useFileDragDrop({ workspacePath }) {
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const setHoveredFolder = useWorkspaceStore((s) => s.setHoveredFolder);
  const setExternalDragActive = useWorkspaceStore((s) => s.setExternalDragActive);

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
