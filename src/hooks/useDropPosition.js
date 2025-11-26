import { useState, useCallback } from 'react';

/**
 * useDropPosition - Detects drop position relative to target element
 *
 * Implements VS Code-style drop position detection:
 * - Top 25% of element = "before" (insert above)
 * - Bottom 25% of element = "after" (insert below)
 * - Middle 50% of element = "inside" (drop into folder)
 *
 * Returns null if trying to drop inside a non-folder.
 */
export function useDropPosition() {
  const [dropPosition, setDropPosition] = useState(null);

  const calculatePosition = useCallback((event, targetElement, targetEntry) => {
    if (!targetElement || !targetEntry) return null;

    const rect = targetElement.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;

    // Calculate position based on cursor location
    let position;
    if (y < height * 0.25) {
      position = "before";
    } else if (y > height * 0.75) {
      position = "after";
    } else {
      position = "inside";
    }

    // Can only drop inside folders
    if (position === "inside" && !targetEntry.is_directory) {
      return null;
    }

    return {
      position,
      targetPath: targetEntry.path,
      targetEntry
    };
  }, []);

  const updatePosition = useCallback((event, targetElement, targetEntry) => {
    const pos = calculatePosition(event, targetElement, targetEntry);
    setDropPosition(pos);
  }, [calculatePosition]);

  const clearPosition = useCallback(() => {
    setDropPosition(null);
  }, []);

  return {
    dropPosition,
    updatePosition,
    clearPosition
  };
}
