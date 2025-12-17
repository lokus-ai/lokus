import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Generic hook for detecting overflow and managing visible/hidden items
 * Uses ResizeObserver for dynamic container width tracking
 *
 * @param {Object} options
 * @param {Array} options.items - Array of items to display
 * @param {number} options.minItemWidth - Minimum width for each item (default: 80)
 * @param {number} options.maxItemWidth - Maximum width for each item (default: 280)
 * @param {number} options.reservedSpace - Space to reserve for other UI elements (default: 0)
 * @param {Function} options.calculateItemWidth - Optional function to calculate individual item widths
 * @param {number} options.overflowButtonWidth - Width of the overflow menu button (default: 32)
 * @param {number} options.itemGap - Gap between items (default: 0)
 * @returns {Object} { containerRef, visibleItems, overflowItems, hasOverflow }
 */
export function useOverflowDetection({
  items = [],
  minItemWidth = 80,
  maxItemWidth = 280,
  reservedSpace = 0,
  calculateItemWidth = null,
  overflowButtonWidth = 32,
  itemGap = 0
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visibleItems, setVisibleItems] = useState(items);
  const [overflowItems, setOverflowItems] = useState([]);
  const lastWidthRef = useRef(0);
  const debounceTimerRef = useRef(null);

  // Debounced width update to avoid excessive recalculations
  const updateWidth = useCallback((width) => {
    // Only update if width changed by more than 10px to reduce noise
    if (Math.abs(width - lastWidthRef.current) < 10) {
      return;
    }

    // Debounce at 16ms for 60fps
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastWidthRef.current = width;
      setContainerWidth(width);
    }, 16);
  }, []);

  // Setup ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        updateWidth(width);
      }
    });

    resizeObserver.observe(containerRef.current);

    // Initial measurement
    const initialWidth = containerRef.current.offsetWidth;
    updateWidth(initialWidth);

    return () => {
      resizeObserver.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [updateWidth]);

  // Calculate visible and overflow items when container width or items change
  useEffect(() => {
    if (containerWidth === 0 || items.length === 0) {
      setVisibleItems(items);
      setOverflowItems([]);
      return;
    }

    const availableWidth = containerWidth - reservedSpace;

    // Calculate item widths
    const itemWidths = items.map((item, index) => {
      if (calculateItemWidth) {
        return calculateItemWidth(item, availableWidth, index);
      }
      return maxItemWidth; // Default to max width if no calculator provided
    });

    // Calculate how many items can fit
    let visible = [];
    let overflow = [];
    let usedWidth = 0;
    let needsOverflow = false;

    for (let i = 0; i < items.length; i++) {
      const itemWidth = Math.max(minItemWidth, Math.min(maxItemWidth, itemWidths[i]));
      const gapWidth = visible.length > 0 ? itemGap : 0;

      // Check if we need to show overflow button
      const overflowWidth = needsOverflow || (usedWidth + itemWidth + gapWidth > availableWidth)
        ? overflowButtonWidth
        : 0;

      const requiredWidth = usedWidth + itemWidth + gapWidth + overflowWidth;

      if (requiredWidth <= availableWidth) {
        visible.push(items[i]);
        usedWidth += itemWidth + gapWidth;
      } else {
        needsOverflow = true;
        overflow.push(items[i]);
      }
    }

    // If overflow is needed but no items are visible, show at least one item
    if (visible.length === 0 && items.length > 0) {
      const firstItemWidth = Math.min(availableWidth - overflowButtonWidth, maxItemWidth);
      if (firstItemWidth >= minItemWidth) {
        visible = [items[0]];
        overflow = items.slice(1);
      } else {
        // Not enough space even for one item, show all in overflow
        visible = [];
        overflow = items;
      }
    }

    setVisibleItems(visible);
    setOverflowItems(overflow);
  }, [
    containerWidth,
    items,
    minItemWidth,
    maxItemWidth,
    reservedSpace,
    calculateItemWidth,
    overflowButtonWidth,
    itemGap
  ]);

  return {
    containerRef,
    visibleItems,
    overflowItems,
    hasOverflow: overflowItems.length > 0,
    containerWidth
  };
}

export default useOverflowDetection;
