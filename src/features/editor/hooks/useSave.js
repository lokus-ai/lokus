import { useCallback, useRef } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { useViewStore } from '../../../stores/views';
import { getEditor } from '../../../stores/editorRegistry';
import { createLokusSerializer } from '../../../core/markdown/lokus-md-pipeline';
import { DOMSerializer } from 'prosemirror-model';
import { invoke } from '@tauri-apps/api/core';
import { confirm, save } from '@tauri-apps/plugin-dialog';
import { syncScheduler } from '../../../core/sync/SyncScheduler';
import { useFeatureFlags } from '../../../contexts/RemoteConfigContext';
import blockIndexClient from '../../../core/blocks/BlockIndexClient';
import { extractBlocks } from '../../../core/blocks/BlockIndexer';

const lokusSerializer = createLokusSerializer();

export function useSave({ workspacePath, graphProcessorRef, onRefreshFiles }) {
  const featureFlags = useFeatureFlags();
  const blockIndexEnabled = !!featureFlags?.block_index_v1;
  const lastVersionContentRef = useRef({});
  const lastVersionSaveRef = useRef({});

  const handleSave = useCallback(async (editorArg, filePathArg, groupIdArg) => {
    // When called from shortcuts with no args, resolve from focused group
    let editor = editorArg;
    let filePath = filePathArg;
    let groupId = groupIdArg;

    if (!editor || !filePath) {
      const store = useEditorGroupStore.getState();
      const focusedGroup = store.getFocusedGroup?.() ?? null;
      if (!focusedGroup) return;
      groupId = focusedGroup.id;
      filePath = focusedGroup.activeTab;
      editor = getEditor(groupId);
    }

    if (!editor || !filePath) return;

    let pathToSave = filePath;

    try {
      // Check if title was changed — if so, rename the file first
      if (groupId) {
        const store = useEditorGroupStore.getState();
        const group = store.findGroup(groupId);
        const tabContent = group?.contentByTab?.[filePath];
        if (tabContent?.title) {
          const currentFileName = filePath.split('/').pop().replace(/\.md$/, '');
          if (tabContent.title !== currentFileName && tabContent.title.trim()) {
            const dir = filePath.substring(0, filePath.lastIndexOf('/'));
            const ext = filePath.includes('.') ? filePath.substring(filePath.lastIndexOf('.')) : '.md';
            const newPath = `${dir}/${tabContent.title}${ext}`;
            try {
              await invoke('rename_file', { oldPath: filePath, newPath });
              store.updateTabPath(filePath, newPath);
              pathToSave = newPath;
              if (onRefreshFiles) onRefreshFiles();
            } catch (_) {
              // If rename fails, save to original path
            }
          }
        }
      }

      // Serialize ProseMirror document directly to markdown
      const contentToSave = lokusSerializer.serialize(editor.state.doc);

      await invoke('write_file_content', { path: pathToSave, content: contentToSave });

      // Trigger sync for this specific file (debounced + batched inside scheduler)
      syncScheduler.onFileSaved(pathToSave);

      // Phase 1 block index: extract blocks from the PM doc and upsert.
      // Wrapped in try/catch — index failure must NEVER block the save.
      if (blockIndexEnabled && workspacePath) {
        (async () => {
          try {
            await blockIndexClient.setWorkspace(workspacePath);
            const blocks = await extractBlocks(editor.state.doc);
            if (blocks.length > 0) {
              await blockIndexClient.upsertFile(pathToSave, blocks);
            }
          } catch (err) {
            // Telemetry only — no user-facing error, no blocking behaviour.
            if (typeof console !== 'undefined') {
              console.warn('[block-index] upsert failed:', err?.message || err);
            }
          }
        })();
      }

      // Mark tab as saved in the store
      if (groupId) {
        useEditorGroupStore.getState().markTabDirty(groupId, pathToSave, false);
      }

      // Save version if content changed
      const lastContent = lastVersionContentRef.current[pathToSave];
      if (!lastContent || lastContent !== contentToSave) {
        try {
          await invoke('save_file_version_manual', { path: pathToSave, content: contentToSave });
          lastVersionSaveRef.current[pathToSave] = Date.now();
          lastVersionContentRef.current[pathToSave] = contentToSave;
        } catch (_) {}
      }

      // Update graph if processor available
      if (graphProcessorRef?.current) {
        try {
          const updateResult = await graphProcessorRef.current.updateFileContent(pathToSave, contentToSave);
          if (updateResult.added > 0 || updateResult.removed > 0) {
            const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
            useEditorGroupStore.getState().setGraphData(updatedGraphData);
          }
        } catch (_) {
          try {
            const updatedGraphData = await graphProcessorRef.current.updateChangedFiles([pathToSave]);
            if (updatedGraphData) useEditorGroupStore.getState().setGraphData(updatedGraphData);
          } catch (__) {
            if (onRefreshFiles) onRefreshFiles();
          }
        }
      }
    } catch (_) {}
  }, [workspacePath, graphProcessorRef, onRefreshFiles]);

  const handleSaveAs = useCallback(async (editorArg, filePathArg) => {
    let editor = editorArg;
    let filePath = filePathArg;

    if (!editor || !filePath) {
      const store = useEditorGroupStore.getState();
      const focusedGroup = store.getFocusedGroup?.() ?? null;
      if (!focusedGroup) return;
      filePath = focusedGroup.activeTab;
      editor = getEditor(focusedGroup.id);
    }

    if (!editor || !filePath) return;

    try {
      const currentFileName = filePath.split('/').pop().replace(/\.[^.]*$/, '');

      const savePath = await save({
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

      if (!savePath) return;

      // Serialize ProseMirror document directly to markdown
      let contentToSave = lokusSerializer.serialize(editor.state.doc);

      if (savePath.endsWith('.html')) {
        const fragment = DOMSerializer.fromSchema(editor.state.schema).serializeFragment(editor.state.doc.content);
        const div = document.createElement('div');
        div.appendChild(fragment);
        const htmlContent = div.innerHTML;
        contentToSave = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentFileName}</title>
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
      } else if (savePath.endsWith('.json')) {
        contentToSave = JSON.stringify({
          title: currentFileName,
          content: lokusSerializer.serialize(editor.state.doc),
          exported: new Date().toISOString(),
          format: 'markdown'
        }, null, 2);
      } else if (savePath.endsWith('.txt')) {
        contentToSave = editor.state.doc.textContent;
      }
      // .md and other formats use the markdown content already set above

      await invoke('write_file_content', { path: savePath, content: contentToSave });

      // Update tab path to the new file
      const store = useEditorGroupStore.getState();
      store.updateTabPath(filePath, savePath);
      const group = store.getFocusedGroup();
      if (group) {
        store.markTabDirty(group.id, savePath, false);
      }

      if (onRefreshFiles) onRefreshFiles();
    } catch (_) {}
  }, [workspacePath, onRefreshFiles]);

  return { handleSave, handleSaveAs };
}
