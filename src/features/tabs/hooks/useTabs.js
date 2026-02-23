import { useCallback, useRef } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getFilename } from '../../../utils/pathUtils.js';
import { isImageFile } from '../../../utils/imageUtils.js';

export function useTabs({ workspacePath, editorRef, onSave }) {
  const lastCloseTimeRef = useRef(0);
  const isShowingDialogRef = useRef(false);
  const currentlyClosingPathRef = useRef(null);

  const handleFileOpen = (file) => {
    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (!groupId) return;

    // Handle search result format with line numbers
    if (file.path && file.lineNumber !== undefined) {
      const filePath = file.path;
      const fileName = getFilename(filePath);

      store.addTab(groupId, { path: filePath, name: fileName }, true);
      store.addRecentFile(filePath);

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

    const fileName = getFilename(file.name || file.path);
    store.addTab(groupId, { path: file.path, name: fileName }, true);
    store.addRecentFile(file.path);
  };

  const handleReopenClosedTab = useCallback(() => {
    useEditorGroupStore.getState().reopenClosed();
  }, []);

  const handleTabClick = (path) => {
    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (groupId) {
      store.setActiveTab(groupId, path);
    }
  };

  const handleTabClose = useCallback(async (path) => {
    if (currentlyClosingPathRef.current === path) return;
    if (isShowingDialogRef.current) return;

    const now = Date.now();
    if (now - lastCloseTimeRef.current < 200) return;
    lastCloseTimeRef.current = now;

    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (!groupId) return;
    const group = store.findGroup(groupId);
    if (!group) return;

    const closeTab = () => {
      const tab = group.tabs.find(t => t.path === path);
      if (tab && !tab.path.startsWith('__')) {
        store.addRecentlyClosed(tab);
      }
      store.removeTab(groupId, path);
    };

    // Check if tab has unsaved changes
    const cached = group.contentByTab?.[path];
    if (cached?.dirty) {
      try {
        currentlyClosingPathRef.current = path;
        isShowingDialogRef.current = true;

        const confirmed = await confirm("You have unsaved changes. Close without saving?", {
          title: "Unsaved Changes",
          type: "warning",
        });

        if (confirmed) closeTab();
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
