import { useRef, useCallback } from 'react';

export function useAutoExpand(expandFolder, delay = 800) {
  const expandTimerRef = useRef(null);
  const lastHoveredFolderRef = useRef(null);

  const scheduleExpand = useCallback(
    (folderPath) => {
      // Clear any existing timer
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
      }

      // Don't schedule if we're already hovering over the same folder
      if (lastHoveredFolderRef.current === folderPath) {
        return;
      }

      lastHoveredFolderRef.current = folderPath;

      // Schedule expansion after delay
      expandTimerRef.current = setTimeout(() => {
        if (expandFolder) {
          expandFolder(folderPath);
        }
      }, delay);
    },
    [expandFolder, delay]
  );

  const cancelExpand = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    lastHoveredFolderRef.current = null;
  }, []);

  return {
    scheduleExpand,
    cancelExpand,
  };
}
