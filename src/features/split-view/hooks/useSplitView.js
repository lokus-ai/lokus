import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { getFilename } from '../../../utils/pathUtils';

export function useSplitView({ workspacePath, editorRef, leftPaneScrollRef, rightPaneScrollRef }) {
  const isResizingBottomPanelRef = useRef(false);

  // --- Split drag handlers ---

  const handleSplitDragStart = useCallback((tab) => {
    useWorkspaceStore.setState({ draggedTabForSplit: tab });
  }, []);

  const handleSplitDragEnd = useCallback(() => {
    useWorkspaceStore.setState({ draggedTabForSplit: null });
  }, []);

  // --- Toggle split view ---

  const handleToggleSplitView = useCallback(async () => {
    const newSplitView = !useWorkspaceStore.getState().useSplitView;
    useWorkspaceStore.setState({ useSplitView: newSplitView });
    if (newSplitView) {
      // When enabling split view, load the next tab in right pane
      const { openTabs: tabs, activeFile: active } = useWorkspaceStore.getState();
      const currentIndex = tabs.findIndex(t => t.path === active);
      const nextTab = tabs[currentIndex + 1] || tabs[0];
      if (nextTab && nextTab.path !== active) {
        useWorkspaceStore.setState({ rightPaneFile: nextTab.path });
        // Extract just the filename in case name contains a path
        const fileName = getFilename(nextTab.name);
        useWorkspaceStore.setState({ rightPaneTitle: fileName.replace(/\.md$/, '') });

        // Load the content for the right pane asynchronously
        setTimeout(async () => {
          const isSpecialView = nextTab.path === '__kanban__' ||
            nextTab.path === '__bases__' ||
            nextTab.path.startsWith('__graph__') ||
            nextTab.path.startsWith('__plugin_') ||
            nextTab.path.endsWith('.canvas') || nextTab.path.endsWith('.kanban');

          const { activeFile: curActive, editorContent: curContent } = useWorkspaceStore.getState();
          if (!isSpecialView && (nextTab.path.endsWith('.md') || nextTab.path.endsWith('.txt'))) {
            // Check if this file is already loaded in the left pane
            if (nextTab.path === curActive && curContent) {
              useWorkspaceStore.setState({ rightPaneContent: curContent });
            } else {
              try {
                const content = await invoke('read_file_content', { path: nextTab.path });
                useWorkspaceStore.setState({ rightPaneContent: content || '' });
              } catch (err) {
                useWorkspaceStore.setState({ rightPaneContent: '' });
              }
            }
          } else {
            // For special views, just clear content
            useWorkspaceStore.setState({ rightPaneContent: '' });
          }
        }, 0);
      }
    } else {
      // Clear right pane when disabling split view
      useWorkspaceStore.setState({ rightPaneFile: null, rightPaneContent: '', rightPaneTitle: '' });
    }
  }, []);

  // --- Pane resize handlers ---

  const splitContainerRef = useRef(null);

  const handlePaneResize = useCallback((e) => {
    const { useSplitView, splitDirection } = useWorkspaceStore.getState();
    if (!useSplitView) return;

    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    let newSize;
    if (splitDirection === 'vertical') {
      const mouseX = e.clientX - rect.left;
      newSize = (mouseX / rect.width) * 100;
    } else {
      const mouseY = e.clientY - rect.top;
      newSize = (mouseY / rect.height) * 100;
    }

    // Clamp between 20% and 80%
    newSize = Math.max(20, Math.min(80, newSize));
    useWorkspaceStore.getState().setPaneSize(newSize);
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    // Capture the container from the divider's parent before moving to document listeners
    splitContainerRef.current = e.currentTarget.parentElement;
    const handleMouseMove = (moveEvent) => handlePaneResize(moveEvent);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handlePaneResize]);

  const resetPaneSize = useCallback(() => {
    useWorkspaceStore.getState().setPaneSize(50);
  }, []);

  const toggleSplitDirection = useCallback(() => {
    useWorkspaceStore.setState((s) => ({
      splitDirection: s.splitDirection === 'vertical' ? 'horizontal' : 'vertical',
    }));
  }, []);

  // --- Bottom panel resize handler ---

  const handleBottomPanelResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizingBottomPanelRef.current = true;
    const startY = e.clientY;
    const startHeight = useWorkspaceStore.getState().bottomPanelHeight;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingBottomPanelRef.current) return;
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
      useWorkspaceStore.getState().setBottomHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingBottomPanelRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // --- Synchronized scrolling handlers ---

  const handleLeftPaneScroll = useCallback((e) => {
    if (!useWorkspaceStore.getState().syncScrolling || !rightPaneScrollRef.current) return;

    const scrollTop = e.target.scrollTop;
    const scrollHeight = e.target.scrollHeight;
    const clientHeight = e.target.clientHeight;
    const scrollPercent = scrollTop / (scrollHeight - clientHeight);

    const rightPane = rightPaneScrollRef.current;
    const rightScrollTop = scrollPercent * (rightPane.scrollHeight - rightPane.clientHeight);
    rightPane.scrollTop = rightScrollTop;
  }, [rightPaneScrollRef]);

  const handleRightPaneScroll = useCallback((e) => {
    if (!useWorkspaceStore.getState().syncScrolling || !leftPaneScrollRef.current) return;

    const scrollTop = e.target.scrollTop;
    const scrollHeight = e.target.scrollHeight;
    const clientHeight = e.target.clientHeight;
    const scrollPercent = scrollTop / (scrollHeight - clientHeight);

    const leftPane = leftPaneScrollRef.current;
    const leftScrollTop = scrollPercent * (leftPane.scrollHeight - leftPane.clientHeight);
    leftPane.scrollTop = leftScrollTop;
  }, [leftPaneScrollRef]);

  return {
    handleSplitDragStart,
    handleSplitDragEnd,
    handleToggleSplitView,
    handleMouseDown,
    resetPaneSize,
    toggleSplitDirection,
    handleBottomPanelResizeStart,
    handleLeftPaneScroll,
    handleRightPaneScroll,
  };
}
