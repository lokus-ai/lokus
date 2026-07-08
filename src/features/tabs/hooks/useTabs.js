import { useCallback, useRef } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { getEditor } from '../../../stores/editorRegistry';
import { getFilename } from '../../../utils/pathUtils.js';
import { closeTabWithGuard } from '../closeGuard';
import { isImageFile } from '../../../utils/imageUtils.js';
import { TextSelection } from 'prosemirror-state';

export function useTabs({ workspacePath, onSave }) {
  const lastCloseTimeRef = useRef(0);
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
              const view = getEditor(focusedGroupId);
              if (!view) return;
              const doc = view.state.doc;
              const linePos = doc.line(file.lineNumber).from + (file.column || 0);
              const selection = TextSelection.create(doc, linePos, linePos);
              const tr = view.state.tr.setSelection(selection).scrollIntoView();
              view.dispatch(tr);
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
    const now = Date.now();
    if (now - lastCloseTimeRef.current < 200) return;
    lastCloseTimeRef.current = now;

    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (!groupId) return;

    try {
      currentlyClosingPathRef.current = path;
      // Single dirty-aware close path (saves dirty tabs, prompts on failure)
      await closeTabWithGuard(groupId, path);
    } finally {
      currentlyClosingPathRef.current = null;
    }
  }, []);

  return { handleTabClose, handleFileOpen, handleTabClick, handleReopenClosedTab };
}
