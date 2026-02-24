import { useCallback, useRef } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { getEditor } from '../../../stores/editorRegistry';
import { confirm } from '@tauri-apps/plugin-dialog';
import { getFilename } from '../../../utils/pathUtils.js';
import { isImageFile } from '../../../utils/imageUtils.js';

export function useTabs({ workspacePath, onSave }) {
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
          if (file.lineNumber) {
            try {
              const focusedGroupId = useEditorGroupStore.getState().focusedGroupId;
              const editor = getEditor(focusedGroupId);
              if (!editor) return;
              const doc = editor.state.doc;
              const linePos = doc.line(file.lineNumber).from + (file.column || 0);
              const selection = editor.state.selection.constructor.create(doc, linePos, linePos);
              const tr = editor.state.tr.setSelection(selection);
              editor.view.dispatch(tr);
              editor.commands.scrollIntoView();
            } catch {}
          }
        }, 100);
      }
      return;
    }

    // Handle regular file format
    if (file.is_directory) return;
    const fileName = getFilename(file.name);
    store.addTab(groupId, { path: file.path, name: fileName }, true);
    store.addRecentFile(file.path);
  };

  const handleReopenClosedTab = useCallback(() => {
    useEditorGroupStore.getState().reopenClosed();
  }, []);

  const handleTabClick = (path) => {
    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (groupId) store.setActiveTab(groupId, path);
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

    const tab = group.tabs.find(t => t.path === path);
    const isDirty = group.contentByTab[path]?.dirty;

    const closeTab = () => {
      if (tab) store.addRecentlyClosed(tab);
      store.removeTab(groupId, path);
    };

    if (isDirty) {
      try {
        currentlyClosingPathRef.current = path;
        isShowingDialogRef.current = true;
        const confirmed = await confirm("You have unsaved changes. Close without saving?", {
          title: "Unsaved Changes",
          type: "warning",
        });
        if (confirmed) closeTab();
      } catch {} finally {
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
