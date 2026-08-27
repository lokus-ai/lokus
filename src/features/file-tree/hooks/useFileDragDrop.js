import { useCallback } from 'react';
import { useFileTreeStore } from '../../../stores/fileTree';
import { invoke } from '@tauri-apps/api/core';
import { isSupportedNotePath, noteMutationClient } from '../../../core/notes/NoteMutationClient.js';

export function useFileDragDrop({ workspacePath }) {
  const refreshTree = useFileTreeStore((s) => s.refreshTree);
  const setHoveredFolder = useFileTreeStore((s) => s.setHoveredFolder);
  const setExternalDragActive = useFileTreeStore((s) => s.setExternalDragActive);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    try {
      if (isSupportedNotePath(active.id)) {
        await noteMutationClient.moveNote(active.id, over.id, { workspacePath });
      } else {
        await invoke('move_file', {
          sourcePath: active.id,
          destinationDir: over.id,
        });
      }
      refreshTree();
    } catch (e) {
      console.error('Failed to move file:', e);
    }
  }, [refreshTree, workspacePath]);

  return { handleDragEnd, setHoveredFolder, setExternalDragActive };
}
