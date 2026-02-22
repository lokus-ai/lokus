import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { confirm, save } from '@tauri-apps/plugin-dialog';
import { MarkdownExporter } from '../../../core/export/markdown-exporter';

export function useSave({ workspacePath, editorGroupsRef, graphProcessorRef, onRefreshFiles }) {
  const lastVersionContentRef = useRef({});
  const lastVersionSaveRef = useRef({});

  const handleSave = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const { activeFile, openTabs, editorContent, editorTitle } = store;
    if (!activeFile) return;

    let pathToSave = activeFile;
    let needsStateUpdate = false;

    try {
      const currentTab = openTabs.find(t => t.path === activeFile);
      if (!currentTab) return;
      const currentName = currentTab.name.replace(/\.md$/, '');

      // Handle rename if title changed
      if (editorTitle !== currentName && editorTitle.trim() !== '') {
        const newFileName = `${editorTitle.trim()}.md`;
        const newPath = await invoke('rename_file', { path: activeFile, newName: newFileName });
        if (editorGroupsRef?.current) {
          editorGroupsRef.current.updateTabPath(activeFile, newPath);
        }
        pathToSave = newPath;
        needsStateUpdate = true;
      }

      // Convert HTML to markdown for .md files
      let contentToSave = editorContent;
      if (pathToSave.endsWith('.md')) {
        const exporter = new MarkdownExporter();
        contentToSave = exporter.htmlToMarkdown(editorContent, { preserveWikiLinks: true });
      }

      await invoke('write_file_content', { path: pathToSave, content: contentToSave });

      // Update store state
      store.setSavedContent(editorContent);
      store.markSaved(activeFile);
      if (pathToSave !== activeFile) {
        store.markSaved(pathToSave);
      }

      // Save version if content changed
      const lastContent = lastVersionContentRef.current[pathToSave];
      if (!lastContent || lastContent !== contentToSave) {
        try {
          await invoke('save_file_version_manual', { path: pathToSave, content: contentToSave });
          lastVersionSaveRef.current[pathToSave] = Date.now();
          lastVersionContentRef.current[pathToSave] = contentToSave;
          store.incrementVersionRefreshKey();
        } catch (_) { /* non-blocking */ }
      }

      if (needsStateUpdate) {
        const newName = pathToSave.split('/').pop();
        store.updateTabName(activeFile, pathToSave);
        if (onRefreshFiles) onRefreshFiles();
      } else if (graphProcessorRef?.current) {
        // Update graph with new content
        try {
          const updateResult = await graphProcessorRef.current.updateFileContent(pathToSave, editorContent);
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
  }, [workspacePath, editorGroupsRef, graphProcessorRef, onRefreshFiles]);

  const handleSaveAs = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const { activeFile, editorContent, editorTitle } = store;
    if (!activeFile) return;

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

      let contentToSave = editorContent;

      if (filePath.endsWith('.html')) {
        const title = editorTitle || currentFileName;
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
<body>${editorContent}</body>
</html>`;
      } else if (filePath.endsWith('.json')) {
        contentToSave = JSON.stringify({
          title: editorTitle || currentFileName,
          content: editorContent,
          exported: new Date().toISOString(),
          format: 'html'
        }, null, 2);
      } else if (filePath.endsWith('.txt')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorContent;
        contentToSave = tempDiv.textContent || tempDiv.innerText || '';
      } else if (filePath.endsWith('.md')) {
        const exporter = new MarkdownExporter();
        contentToSave = exporter.htmlToMarkdown(editorContent, { preserveWikiLinks: true });
      }

      await invoke('write_file_content', { path: filePath, content: contentToSave });

      const newFileName = filePath.split('/').pop();
      store.updateTabName(activeFile, filePath);
      store.setSavedContent(editorContent);
      store.markSaved(activeFile);
      store.markSaved(filePath);

      if (onRefreshFiles) onRefreshFiles();
    } catch (_) { /* silent fail */ }
  }, [workspacePath, onRefreshFiles]);

  return { handleSave, handleSaveAs };
}
