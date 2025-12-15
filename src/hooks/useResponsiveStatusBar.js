import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/**
 * Priority levels for status bar items (higher = more important)
 * Items with priority >= 100 are always visible (critical)
 */
export const STATUS_BAR_PRIORITY = {
  // Critical items (always visible)
  syncStatus: 100,
  unsavedChanges: 100,

  // High priority
  readyStatus: 80,
  activeFile: 70,

  // Medium priority
  wordCount: 60,
  charCount: 50,
  readingTime: 40,

  // Low priority
  markdownIndicator: 30,
  settingsButton: 20,

  // Plugin items default priority
  pluginDefault: 50
};

/**
 * Hook for managing responsive status bar with priority-based progressive hiding
 * Handles left and right sections independently with overflow menus
 *
 * @param {Object} options
 * @param {Array} options.leftItems - Array of status bar items for left section
 * @param {Array} options.rightItems - Array of status bar items for right section
 * @param {number} options.minWidth - Minimum width before forcing overflow (default: 480)
 * @returns {Object} Status bar state and handlers
 */
export function useResponsiveStatusBar({
  leftItems = [],
  rightItems = [],
  minWidth = 480
}) {
  const leftContainerRef = useRef(null);
  const rightContainerRef = useRef(null);
  const itemWidthsRef = useRef(new Map());
  const measurementTimerRef = useRef(null);

  const [leftContainerWidth, setLeftContainerWidth] = useState(0);
  const [rightContainerWidth, setRightContainerWidth] = useState(0);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // Track window width
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Measure item widths (called after render)
  const measureItemWidths = useCallback((items) => {
    if (!leftContainerRef.current && !rightContainerRef.current) return;

    // Debounce measurements
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
    }

    measurementTimerRef.current = setTimeout(() => {
      items.forEach(item => {
        if (item.ref?.current) {
          const width = item.ref.current.offsetWidth;
          itemWidthsRef.current.set(item.id, width);
        } else if (item.estimatedWidth) {
          // Use estimated width if no ref available
          itemWidthsRef.current.set(item.id, item.estimatedWidth);
        } else {
          // Default fallback width
          itemWidthsRef.current.set(item.id, 100);
        }
      });
    }, 16);
  }, []);

  // Setup ResizeObserver for both sections
  useEffect(() => {
    const leftObserver = leftContainerRef.current
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            setLeftContainerWidth(entry.contentRect.width);
          }
        })
      : null;

    const rightObserver = rightContainerRef.current
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            setRightContainerWidth(entry.contentRect.width);
          }
        })
      : null;

    if (leftObserver && leftContainerRef.current) {
      leftObserver.observe(leftContainerRef.current);
      setLeftContainerWidth(leftContainerRef.current.offsetWidth);
    }

    if (rightObserver && rightContainerRef.current) {
      rightObserver.observe(rightContainerRef.current);
      setRightContainerWidth(rightContainerRef.current.offsetWidth);
    }

    return () => {
      leftObserver?.disconnect();
      rightObserver?.disconnect();
      if (measurementTimerRef.current) {
        clearTimeout(measurementTimerRef.current);
      }
    };
  }, []);

  /**
   * Calculate visible and overflow items based on priority and available width
   */
  const calculateVisibleItems = useCallback((items, availableWidth) => {
    if (items.length === 0) {
      return { visible: [], overflow: [] };
    }

    // Sort by priority (highest first)
    const sortedItems = [...items].sort((a, b) => {
      const priorityA = a.priority ?? STATUS_BAR_PRIORITY.pluginDefault;
      const priorityB = b.priority ?? STATUS_BAR_PRIORITY.pluginDefault;
      return priorityB - priorityA;
    });

    const visible = [];
    const overflow = [];
    let usedWidth = 0;
    const overflowButtonWidth = 32;
    const itemGap = 4;

    for (const item of sortedItems) {
      // Get measured or estimated width
      const itemWidth = itemWidthsRef.current.get(item.id) || item.estimatedWidth || 100;

      // Check if item is critical (priority >= 100)
      const isCritical = (item.priority ?? STATUS_BAR_PRIORITY.pluginDefault) >= 100;

      // Calculate required width
      const gapWidth = visible.length > 0 ? itemGap : 0;
      const needsOverflowButton = overflow.length > 0;
      const requiredWidth = usedWidth + itemWidth + gapWidth + (needsOverflowButton ? overflowButtonWidth : 0);

      if (isCritical || requiredWidth <= availableWidth) {
        // Item fits or is critical - always show
        visible.push(item);
        usedWidth += itemWidth + gapWidth;
      } else {
        // Check if adding this item would require overflow button
        const withOverflowWidth = usedWidth + itemWidth + gapWidth + overflowButtonWidth;
        if (withOverflowWidth <= availableWidth) {
          visible.push(item);
          usedWidth += itemWidth + gapWidth;
        } else {
          overflow.push(item);
        }
      }
    }

    return { visible, overflow };
  }, []);

  // Calculate visible/overflow for left section
  const { visible: visibleLeftItems, overflow: overflowLeftItems } = useMemo(() => {
    return calculateVisibleItems(leftItems, leftContainerWidth);
  }, [leftItems, leftContainerWidth, calculateVisibleItems]);

  // Calculate visible/overflow for right section
  const { visible: visibleRightItems, overflow: overflowRightItems } = useMemo(() => {
    return calculateVisibleItems(rightItems, rightContainerWidth);
  }, [rightItems, rightContainerWidth, calculateVisibleItems]);

  // Check if item is visible
  const isItemVisible = useCallback((itemId, section = 'left') => {
    const visibleItems = section === 'left' ? visibleLeftItems : visibleRightItems;
    return visibleItems.some(item => item.id === itemId);
  }, [visibleLeftItems, visibleRightItems]);

  // Register item width (called by items to report their width)
  const registerItemWidth = useCallback((itemId, width) => {
    itemWidthsRef.current.set(itemId, width);
  }, []);

  return {
    // Refs
    leftContainerRef,
    rightContainerRef,

    // Left section
    visibleLeftItems,
    overflowLeftItems,
    hasLeftOverflow: overflowLeftItems.length > 0,

    // Right section
    visibleRightItems,
    overflowRightItems,
    hasRightOverflow: overflowRightItems.length > 0,

    // Computed values
    windowWidth,
    isNarrowScreen: windowWidth < minWidth,

    // Helper functions
    isItemVisible,
    registerItemWidth,
    measureItemWidths
  };
}

export default useResponsiveStatusBar;
