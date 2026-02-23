import { useCallback, useRef } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { useViewStore } from '../../../stores/views';
import { invoke } from '@tauri-apps/api/core';
import { confirm, save } from '@tauri-apps/plugin-dialog';

export function useSave({ workspacePath, graphProcessorRef, onRefreshFiles }) {
  const lastVersionContentRef = useRef({});
  const lastVersionSaveRef = useRef({});

  const handleSave = useCallback(async (editor, filePath, groupId) => {
    // If called without args, derive from focused group
    const store = useEditorGroupStore.getState();
    const group = groupId ? store.findGroup(groupId) : store.getFocusedGroup();
    if (!group) return;

    const activeFile = filePath || group.activeTab;
    if (!activeFile) return;

    const activeEditor = editor || null;
    let pathToSave = activeFile;

    try {
      const tab = group.tabs.find(t => t.path === activeFile);
      if (!tab) return;

      // Get markdown from editor's @tiptap/markdown storage, or fall back to getText
      let contentToSave = '';
      if (activeEditor) {
        contentToSave = activeEditor.storage.markdown?.getMarkdown?.()
          || activeEditor.getText()
          || '';
      } else {
        // Fall back to cached content
        const cached = group.contentByTab?.[activeFile];
        contentToSave = cached?.rawMarkdown || '';
      }

      await invoke('write_file_content', { path: pathToSave, content: contentToSave });

      // Mark tab as clean
      store.markTabDirty(group.id, activeFile, false);

      // Save version if content changed
      const lastContent = lastVersionContentRef.current[pathToSave];
      if (!lastContent || lastContent !== contentToSave) {
        try {
          await invoke('save_file_version_manual', { path: pathToSave, content: contentToSave });
          lastVersionSaveRef.current[pathToSave] = Date.now();
          lastVersionContentRef.current[pathToSave] = contentToSave;
        } catch (_) { /* non-blocking */ }
      }

      // Update graph with new content
      if (graphProcessorRef?.current) {
        try {
          const updateResult = await graphProcessorRef.current.updateFileContent(pathToSave, contentToSave);
          if (updateResult.added > 0 || updateResult.removed > 0) {
            const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
            store.setGraphData(updatedGraphData);
          }
        } catch (_) {
          try {
            const updatedGraphData = await graphProcessorRef.current.updateChangedFiles([pathToSave]);
            if (updatedGraphData) store.setGraphData(updatedGraphData);
          } catch (__) {
            if (onRefreshFiles) onRefreshFiles();
          }
        }
      }
    } catch (_) { /* silent fail */ }
  }, [workspacePath, graphProcessorRef, onRefreshFiles]);

  const handleSaveAs = useCallback(async (editor) => {
    const store = useEditorGroupStore.getState();
    const group = store.getFocusedGroup();
    if (!group?.activeTab) return;
    const activeFile = group.activeTab;

    const activeEditor = editor || null;

    try {
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');

      const filePath = await save({
        defaultPath: `${currentFileName}.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'HTML', extensions: ['html'] },
          { name: 'Text', extensions: ['txt'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Save As'
      });

      if (!filePath) return;

      // Get content from editor
      let contentToSave = '';
      if (activeEditor) {
        contentToSave = activeEditor.storage.markdown?.getMarkdown?.()
          || activeEditor.getText()
          || '';
      }

      if (filePath.endsWith('.html')) {
        const title = currentFileName;
        const htmlContent = activeEditor?.getHTML?.() || contentToSave;
        contentToSave = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
    </style>
</head>
<body>${htmlContent}</body>
</html>`;
      } else if (filePath.endsWith('.json')) {
        contentToSave = JSON.stringify({
          title: currentFileName,
          content: activeEditor?.getHTML?.() || contentToSave,
          exported: new Date().toISOString(),
          format: 'markdown'
        }, null, 2);
      } else if (filePath.endsWith('.txt')) {
        contentToSave = activeEditor?.getText?.() || contentToSave;
      }
      // .md files already have markdown from getMarkdown()

      await invoke('write_file_content', { path: filePath, content: contentToSave });

      // Update tab path to the new file
      store.updateTabPath(activeFile, filePath);
      store.markTabDirty(group.id, filePath, false);

      if (onRefreshFiles) onRefreshFiles();
    } catch (_) { /* silent fail */ }
  }, [workspacePath, onRefreshFiles]);

  return { handleSave, handleSaveAs };
}
