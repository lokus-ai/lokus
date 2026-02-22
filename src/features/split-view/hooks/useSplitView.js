import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { getMarkdownCompiler } from '../../../core/markdown/compiler';

export function useSplitView({ workspacePath }) {
  const leftPaneScrollRef = useRef(null);
  const rightPaneScrollRef = useRef(null);
  const isScrollSyncingRef = useRef(false);

  const toggleSplit = useWorkspaceStore((s) => s.toggleSplit);
  const toggleDirection = useWorkspaceStore((s) => s.toggleDirection);
  const setPaneSize = useWorkspaceStore((s) => s.setPaneSize);
  const resetPaneSize = useWorkspaceStore((s) => s.resetPaneSize);
  const setSyncScrolling = useWorkspaceStore((s) => s.setSyncScrolling);

  const handleToggleSplitView = useCallback(() => {
    const store = useWorkspaceStore.getState();
    if (!store.useSplitView && store.activeFile) {
      // When enabling split, load current file in right pane too
      store.openInSplit(store.activeFile, store.editorContent, store.editorTitle);
    } else {
      toggleSplit();
    }
  }, [toggleSplit]);

  const openFileInSplit = useCallback(async (path) => {
    try {
      const content = await invoke('read_file_content', { path });
      let html = content;
      if (path.endsWith('.md')) {
        const compiler = getMarkdownCompiler();
        html = compiler.compile(content);
      }
      const title = path.split('/').pop().replace(/\.md$/, '');
      useWorkspaceStore.getState().openInSplit(path, html, title);
    } catch (e) {
      console.error('Failed to open in split:', e);
    }
  }, []);

  // Mouse-based resize
  const handleMouseDown = useCallback((e) => {
    const startPos = useWorkspaceStore.getState().splitDirection === 'vertical' ? e.clientX : e.clientY;
    const startSize = useWorkspaceStore.getState().leftPaneSize;
    const container = e.target.parentElement;
    const containerSize = useWorkspaceStore.getState().splitDirection === 'vertical'
      ? container.offsetWidth
      : container.offsetHeight;

    function onMove(e) {
      const currentPos = useWorkspaceStore.getState().splitDirection === 'vertical' ? e.clientX : e.clientY;
      const delta = ((currentPos - startPos) / containerSize) * 100;
      const newSize = Math.max(20, Math.min(80, startSize + delta));
      setPaneSize(newSize);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setPaneSize]);

  // Scroll sync handlers
  const handleLeftPaneScroll = useCallback(() => {
    if (isScrollSyncingRef.current || !useWorkspaceStore.getState().syncScrolling) return;
    const left = leftPaneScrollRef.current;
    const right = rightPaneScrollRef.current;
    if (!left || !right) return;

    isScrollSyncingRef.current = true;
    const ratio = left.scrollTop / (left.scrollHeight - left.clientHeight || 1);
    right.scrollTop = ratio * (right.scrollHeight - right.clientHeight);
    requestAnimationFrame(() => { isScrollSyncingRef.current = false; });
  }, []);

  const handleRightPaneScroll = useCallback(() => {
    if (isScrollSyncingRef.current || !useWorkspaceStore.getState().syncScrolling) return;
    const left = leftPaneScrollRef.current;
    const right = rightPaneScrollRef.current;
    if (!left || !right) return;

    isScrollSyncingRef.current = true;
    const ratio = right.scrollTop / (right.scrollHeight - right.clientHeight || 1);
    left.scrollTop = ratio * (left.scrollHeight - left.clientHeight);
    requestAnimationFrame(() => { isScrollSyncingRef.current = false; });
  }, []);

  return {
    handleToggleSplitView,
    openFileInSplit,
    handleMouseDown,
    resetPaneSize,
    toggleDirection,
    setSyncScrolling,
    handleLeftPaneScroll,
    handleRightPaneScroll,
    leftPaneScrollRef,
    rightPaneScrollRef,
  };
}
