import { useEffect, useRef } from 'react';

/**
 * useAutoExpand - Auto-expand folders after 800ms hover during drag
 *
 * Implements VS Code-style auto-expand behavior:
 * - Start 800ms timer when hovering over collapsed folder
 * - Auto-expand folder when timer completes
 * - Cancel timer if user moves away
 * - No-op if folder is already expanded
 *
 * @param {boolean} isOver - Whether cursor is over this element
 * @param {boolean} isDirectory - Whether this is a folder
 * @param {boolean} isExpanded - Whether folder is already expanded
 * @param {string} entryPath - Path to this folder
 * @param {Function} toggleFolder - Function to expand/collapse folder
 * @returns {boolean} willAutoExpand - True if timer is running
 */
export function useAutoExpand(isOver, isDirectory, isExpanded, entryPath, toggleFolder) {
  const timerRef = useRef(null);

  useEffect(() => {
    // Only start timer if:
    // 1. Cursor is over this element
    // 2. This is a directory
    // 3. Directory is currently collapsed
    if (isOver && isDirectory && !isExpanded) {
      timerRef.current = setTimeout(() => {
        toggleFolder(entryPath);
      }, 800); // VS Code standard timing

      // Cleanup on unmount or dependency change
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      // Clear timer if conditions no longer met
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isOver, isDirectory, isExpanded, entryPath, toggleFolder]);

  // Return true if timer is currently running (for visual feedback)
  return isOver && isDirectory && !isExpanded;
}
