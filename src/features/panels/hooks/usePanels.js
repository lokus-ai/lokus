import { useCallback } from 'react';
import { useViewStore } from '../../../stores/views';

export function usePanels() {
  const openPanel = useViewStore((s) => s.openPanel);
  const closePanel = useViewStore((s) => s.closePanel);
  const togglePanel = useViewStore((s) => s.togglePanel);

  const toggleVersionHistory = useCallback((filePath) => {
    const store = useViewStore.getState();
    if (store.showVersionHistory && store.versionHistoryFile === filePath) {
      useViewStore.getState().closePanel('versionHistory');
    } else {
      useViewStore.getState().openPanel('versionHistory', filePath);
    }
  }, []);

  return { openPanel, closePanel, togglePanel, toggleVersionHistory };
}
