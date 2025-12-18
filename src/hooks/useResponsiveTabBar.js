import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOverflowDetection } from './useOverflowDetection';

/**
 * Hook for managing responsive tab bar with overflow menu
 * Handles tab width calculation, visibility, and active tab prioritization
 *
 * @param {Object} options
 * @param {Array} options.tabs - Array of tab objects (must have 'path' property)
 * @param {string} options.activeTabPath - Path of the currently active tab
 * @param {number} options.reservedSpace - Space reserved for other toolbar buttons
 * @returns {Object} Tab bar state and handlers
 */
export function useResponsiveTabBar({
  tabs = [],
  activeTabPath = null,
  reservedSpace = 0
}) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // Track window width for breakpoint-based max tab widths
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate max tab width based on window width (not container width)
  const maxTabWidth = useMemo(() => {
    if (windowWidth > 1024) return 280; // Desktop
    if (windowWidth > 768) return 180;  // Tablet
    return 120; // Mobile, with min of 80px enforced by useOverflowDetection
  }, [windowWidth]);

  // Sort tabs to prioritize active tab
  const sortedTabs = useMemo(() => {
    if (!activeTabPath) return tabs;

    // Move active tab to the front of visible items
    const activeIndex = tabs.findIndex(tab => tab.path === activeTabPath);
    if (activeIndex === -1) return tabs;

    const reordered = [...tabs];
    const [activeTab] = reordered.splice(activeIndex, 1);
    return [activeTab, ...reordered];
  }, [tabs, activeTabPath]);

  // Calculate individual tab widths accounting for overlap
  const calculateTabWidth = useCallback((tab, availableWidth, index) => {
    // Base calculation: divide available width by number of tabs
    const tabCount = sortedTabs.length;
    if (tabCount === 0) return maxTabWidth;

    // Account for -12px overlap between tabs
    // Total width needed = (width * count) - (overlap * (count - 1))
    // So: width = (availableWidth + (overlap * (count - 1))) / count
    const overlap = 12;
    const adjustedWidth = (availableWidth + (overlap * (tabCount - 1))) / tabCount;

    return Math.max(80, Math.min(maxTabWidth, adjustedWidth));
  }, [sortedTabs.length, maxTabWidth]);

  // Use overflow detection with tab-specific settings
  const {
    containerRef,
    visibleItems: visibleTabs,
    overflowItems: overflowTabs,
    hasOverflow,
    containerWidth
  } = useOverflowDetection({
    items: sortedTabs,
    minItemWidth: 80,
    maxItemWidth: maxTabWidth,
    reservedSpace,
    calculateItemWidth: calculateTabWidth,
    overflowButtonWidth: 32,
    itemGap: -12 // Negative gap for overlapping tabs
  });

  // Calculate the actual width for each visible tab
  const calculateActualTabWidth = useCallback(() => {
    if (visibleTabs.length === 0) return maxTabWidth;

    const availableWidth = containerWidth - reservedSpace - (hasOverflow ? 32 : 0);
    const overlap = 12;
    const tabCount = visibleTabs.length;

    // Account for overlap: total width = (width * count) - (overlap * (count - 1))
    const adjustedWidth = (availableWidth + (overlap * (tabCount - 1))) / tabCount;

    return Math.max(80, Math.min(maxTabWidth, adjustedWidth));
  }, [visibleTabs.length, containerWidth, reservedSpace, hasOverflow, maxTabWidth]);

  const actualTabWidth = calculateActualTabWidth();

  // Handle tab click from overflow menu
  const handleOverflowTabClick = useCallback((tabPath, onTabClick) => {
    // The tab will become active, which will move it to the front
    // due to sortedTabs prioritization
    if (onTabClick) {
      onTabClick(tabPath);
    }
  }, []);

  // Check if a tab is active
  const isTabActive = useCallback((tabPath) => {
    return tabPath === activeTabPath;
  }, [activeTabPath]);

  // Get display order for tabs (accounting for reordering)
  const getTabDisplayIndex = useCallback((tabPath) => {
    return sortedTabs.findIndex(tab => tab.path === tabPath);
  }, [sortedTabs]);

  return {
    // Refs
    containerRef,

    // Tab arrays
    visibleTabs,
    overflowTabs,
    allTabs: sortedTabs,

    // Computed values
    hasOverflow,
    actualTabWidth,
    containerWidth,

    // Helper functions
    handleOverflowTabClick,
    isTabActive,
    getTabDisplayIndex
  };
}

export default useResponsiveTabBar;
