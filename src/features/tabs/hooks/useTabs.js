import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getFilename } from '../../../utils/pathUtils.js';
import { isImageFile } from '../../../utils/imageUtils.js';

const MAX_OPEN_TABS = 10;

export function useTabs({ workspacePath, editorRef, onSave }) {
  // Ref to track last close timestamp for debouncing (global for any tab)
  const lastCloseTimeRef = useRef(0);
  const isShowingDialogRef = useRef(false);
  const currentlyClosingPathRef = useRef(null);

  const handleFileOpen = (file) => {
    // Handle search result format with line numbers
    if (file.path && file.lineNumber !== undefined) {
      const filePath = file.path;
      const fileName = getFilename(filePath);

      useWorkspaceStore.setState((s) => {
        const newTabs = s.openTabs.filter(t => t.path !== filePath);
        newTabs.unshift({ path: filePath, name: fileName });
        if (newTabs.length > MAX_OPEN_TABS) {
          newTabs.pop();
        }
        return { openTabs: newTabs };
      });
      useWorkspaceStore.setState({ activeFile: filePath });

      // Update recent files list
      if (!filePath.startsWith('__') && (filePath.endsWith('.md') || filePath.endsWith('.txt') || filePath.endsWith('.canvas') || filePath.endsWith('.kanban') || filePath.endsWith('.pdf'))) {
        useWorkspaceStore.setState((s) => {
          const filtered = s.recentFiles.filter(f => f.path !== filePath);
          const newRecent = [{ path: filePath, name: fileName }, ...filtered].slice(0, 5);
          return { recentFiles: newRecent };
        });
      }

      // Jump to line after editor loads (only for non-image files)
      if (!isImageFile(filePath)) {
        setTimeout(() => {
          if (editorRef.current && file.lineNumber) {
            try {
              const doc = editorRef.current.state.doc;
              const linePos = doc.line(file.lineNumber).from + (file.column || 0);
              const selection = editorRef.current.state.selection.constructor.create(doc, linePos, linePos);
              const tr = editorRef.current.state.tr.setSelection(selection);
              editorRef.current.view.dispatch(tr);
              editorRef.current.commands.scrollIntoView();
            } catch { }
          }
        }, 100);
      }
      return;
    }

    // Handle regular file format
    if (file.is_directory) return;

    // Add file to tabs (works for all file types including images)
    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter(t => t.path !== file.path);
      // Ensure we only use the filename, not a full path
      const fileName = getFilename(file.name);
      newTabs.unshift({ path: file.path, name: fileName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: file.path });

    // Update recent files list
    if (!file.path.startsWith('__') && (file.path.endsWith('.md') || file.path.endsWith('.txt') || file.path.endsWith('.canvas') || file.path.endsWith('.kanban') || file.path.endsWith('.pdf'))) {
      const fileName = getFilename(file.name || file.path);
      useWorkspaceStore.setState((s) => {
        const filtered = s.recentFiles.filter(f => f.path !== file.path);
        const newRecent = [{ path: file.path, name: fileName }, ...filtered].slice(0, 5);
        return { recentFiles: newRecent };
      });
    }
  };

  const handleReopenClosedTab = useCallback(() => {
    const recentlyClosedTabs = useWorkspaceStore.getState().recentlyClosedTabs;
    if (recentlyClosedTabs.length === 0) return;

    const [mostRecentTab, ...remaining] = recentlyClosedTabs;

    // Remove from recently closed list
    useWorkspaceStore.setState({ recentlyClosedTabs: remaining });

    // Reopen the tab
    handleFileOpen(mostRecentTab);
  }, []);

  // handleOpenFullKanban removed - use file-based kanban boards instead

  const handleTabClick = (path) => {
    useWorkspaceStore.setState({ activeFile: path });

    // If split view is active, update the right pane to show the next tab
    const { useSplitView, openTabs, editorContent } = useWorkspaceStore.getState();
    if (useSplitView) {
      const currentIndex = openTabs.findIndex(t => t.path === path);
      const nextTab = openTabs[currentIndex + 1] || openTabs[0];
      if (nextTab && nextTab.path !== path) {
        useWorkspaceStore.setState({ rightPaneFile: nextTab.path });
        // Extract just the filename in case name contains a path
        const fileName = getFilename(nextTab.name);
        useWorkspaceStore.setState({ rightPaneTitle: fileName.replace(/\.md$/, "") });
        if (nextTab.path.endsWith('.md') || nextTab.path.endsWith('.txt')) {
          // Check if this file is already loaded in the left pane
          if (nextTab.path === path && editorContent) {
            useWorkspaceStore.setState({ rightPaneContent: editorContent });
          } else {
            invoke("read_file_content", { path: nextTab.path })
              .then(content => {
                useWorkspaceStore.setState({ rightPaneContent: content || '' });
              })
              .catch(err => {
                useWorkspaceStore.setState({ rightPaneContent: '' });
              });
          }
        }
      }
    }
  };

  const handleTabClose = useCallback(async (path) => {
    // Prevent closing the same tab multiple times
    if (currentlyClosingPathRef.current === path) {
      return;
    }

    // Prevent multiple dialogs from showing
    if (isShowingDialogRef.current) {
      return;
    }

    // Global debounce: ignore ANY tab close within 200ms of the last one
    const now = Date.now();
    if (now - lastCloseTimeRef.current < 200) {
      return;
    }
    lastCloseTimeRef.current = now;

    const closeTab = () => {
      useWorkspaceStore.setState((s) => {
        const prevTabs = s.openTabs;
        const tabIndex = prevTabs.findIndex(t => t.path === path);
        const closedTab = prevTabs.find(t => t.path === path);
        const newTabs = prevTabs.filter(t => t.path !== path);

        const updates = { openTabs: newTabs };

        // Save the closed tab to recently closed list (max 10 items)
        if (closedTab && !closedTab.path.startsWith('__')) { // Don't track special tabs like graph, kanban
          updates.recentlyClosedTabs = [{ ...closedTab, closedAt: Date.now() }, ...s.recentlyClosedTabs.slice(0, 9)];
        }

        if (s.activeFile === path) {
          if (newTabs.length === 0) {
            updates.activeFile = null;
          } else {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            updates.activeFile = newTabs[newActiveIndex].path;
          }
        }

        const newUnsaved = new Set(s.unsavedChanges);
        newUnsaved.delete(path);
        updates.unsavedChanges = newUnsaved;

        return updates;
      });
    };

    if (useWorkspaceStore.getState().unsavedChanges.has(path)) {
      try {
        currentlyClosingPathRef.current = path;
        isShowingDialogRef.current = true;

        const confirmed = await confirm("You have unsaved changes. Close without saving?", {
          title: "Unsaved Changes",
          type: "warning",
        });

        if (confirmed) {
          closeTab();
        } else {
        }
      } catch { } finally {
        isShowingDialogRef.current = false;
        currentlyClosingPathRef.current = null;
      }
    } else {
      currentlyClosingPathRef.current = path;
      closeTab();
      currentlyClosingPathRef.current = null;
    }
  }, []);

  return { handleTabClose, handleFileOpen, handleTabClick, handleReopenClosedTab };
}
