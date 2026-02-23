import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';

export function usePanels() {
  const openPanel = useWorkspaceStore((s) => s.openPanel);
  const closePanel = useWorkspaceStore((s) => s.closePanel);
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);

  const toggleVersionHistory = useCallback((filePath) => {
    const store = useWorkspaceStore.getState();
    if (store.showVersionHistory && store.versionHistoryFile === filePath) {
      useWorkspaceStore.setState({ showVersionHistory: false, versionHistoryFile: null });
    } else {
      useWorkspaceStore.setState({ showVersionHistory: true, versionHistoryFile: filePath });
    }
  }, []);

  return { openPanel, closePanel, togglePanel, toggleVersionHistory };
}
