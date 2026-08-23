import { useCallback, useRef } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { useViewStore } from '../../../stores/views';
import { getEditor } from '../../../stores/editorRegistry';
import { getTabModel, setSavedDoc } from '../../../stores/tabModels';
import { getTabMeta } from '../../../stores/tabMeta';
import { createLokusSerializer } from '../../../core/markdown/lokus-md-pipeline';
import { isPlainTextNotePath, docToPlainTextString } from '../../../utils/plainTextNote.js';
import { DOMSerializer } from 'prosemirror-model';
import { invoke } from '@tauri-apps/api/core';
import { useGraphStore } from '../../../core/graph2/graphStore.js';
import { confirm, save } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import { syncScheduler } from '../../../core/sync/SyncScheduler';
import {
  isSupportedNotePath,
  noteMutationClient,
} from '../../../core/notes/NoteMutationClient';

const lokusSerializer = createLokusSerializer();

export function useSave({ workspacePath, onRefreshFiles }) {
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

    if (!filePath) return;

    // VS Code principle: save serializes the tab's OWN model — never the
    // shared EditorView, which may still display another tab's document
    // mid-switch. No model yet (tab still loading from disk, or load
    // failed) → there is nothing trustworthy to write; do nothing.
    let docToSave;
    if (groupId) {
      const model = getTabModel(groupId, filePath);
      if (!model) return;
      docToSave = model.state.doc;
    } else {
      // Explicit editor+path call from a legacy caller — trust the caller.
      if (!editor) return;
      docToSave = editor.state.doc;
    }

    // Never save a tab whose file failed to load — the editor never held its
    // content, so writing would overwrite the original with something else.
    if (groupId) {
      const grp = useEditorGroupStore.getState().findGroup(groupId);
      if (grp?.contentByTab?.[filePath]?.loadError) return;
    }

    let pathToSave = filePath;
    const baseContent = groupId ? getTabMeta(groupId, filePath)?.savedContent : undefined;

    try {
      // Check if title was changed — if so, rename the file first
      if (groupId) {
        const store = useEditorGroupStore.getState();
        const title = getTabMeta(groupId, filePath)?.title;
        if (title) {
          const currentFileName = (filePath.split('/').pop() || '').replace(/\.(md|markdown|txt)$/i, '');
          if (title !== currentFileName && title.trim()) {
            const dir = filePath.substring(0, filePath.lastIndexOf('/'));
            const ext = filePath.includes('.') ? filePath.substring(filePath.lastIndexOf('.')) : '.md';
            const newPath = `${dir}/${title}${ext}`;
            try {
              // Rust handler is rename_file(path, new_name) — new_name is the
              // file NAME (with extension), not a full path.
              await noteMutationClient.renameNote(filePath, `${title}${ext}`, {
                workspacePath,
                source: 'editor-save',
              });
              store.updateTabPath(filePath, newPath);
              pathToSave = newPath;
              if (onRefreshFiles) onRefreshFiles();
            } catch (e) {
              // If rename fails, save to original path — but tell the user.
              toast.error(`Failed to rename file: ${e?.message || e}`);
            }
          }
        }
      }

      // Serialize: plain text for .txt, markdown otherwise
      const contentToSave = isPlainTextNotePath(pathToSave)
        ? docToPlainTextString(docToSave)
        : lokusSerializer.serialize(docToSave);

      await noteMutationClient.writeNote({
        workspacePath,
        path: pathToSave,
        content: contentToSave,
        baseContent,
        source: 'editor-save',
      });

      // Trigger sync for this specific file (debounced + batched inside scheduler)
      syncScheduler.onFileSaved(pathToSave);

      // Record what's on disk and clear/recompute the dirty flag. If the
      // user kept typing while the write was in flight, compare the tab's
      // CURRENT model against what was written instead of blindly marking
      // the tab clean. Comparison is O(1) document identity — no serialize.
      if (groupId) {
        const store = useEditorGroupStore.getState();
        store.setTabContent(groupId, pathToSave, { savedContent: contentToSave });
        setSavedDoc(groupId, pathToSave, docToSave);
        const nowModel = getTabModel(groupId, pathToSave);
        store.markTabDirty(groupId, pathToSave, !!nowModel && nowModel.state.doc !== docToSave);
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

      // Incremental graph update: re-parse just this file (graph2 index)
      try {
        useGraphStore.getState().noteSaved(pathToSave, contentToSave);
      } catch (_) {}
    } catch (error) {
      toast.error(`Failed to save file: ${error?.message || error}`);
    }
  }, [workspacePath, onRefreshFiles]);

  const handleSaveAs = useCallback(async (editorArg, filePathArg) => {
    let editor = editorArg;
    let filePath = filePathArg;
    let groupId = null;

    if (!editor || !filePath) {
      const store = useEditorGroupStore.getState();
      const focusedGroup = store.getFocusedGroup?.() ?? null;
      if (!focusedGroup) return;
      groupId = focusedGroup.id;
      filePath = focusedGroup.activeTab;
      editor = getEditor(groupId);
    }

    if (!filePath) return;

    // Same model-first rule as handleSave: never serialize the shared view.
    let docToSave;
    let schemaForExport;
    if (groupId) {
      const model = getTabModel(groupId, filePath);
      if (!model) return;
      docToSave = model.state.doc;
      schemaForExport = model.state.schema;
    } else {
      if (!editor) return;
      docToSave = editor.state.doc;
      schemaForExport = editor.state.schema;
    }

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
      let contentToSave = lokusSerializer.serialize(docToSave);

      if (savePath.endsWith('.html')) {
        const fragment = DOMSerializer.fromSchema(schemaForExport).serializeFragment(docToSave.content);
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
          content: lokusSerializer.serialize(docToSave),
          exported: new Date().toISOString(),
          format: 'markdown'
        }, null, 2);
      } else if (savePath.endsWith('.txt')) {
        contentToSave = docToSave.textContent;
      }
      // .md and other formats use the markdown content already set above

      if (isSupportedNotePath(savePath)) {
        await noteMutationClient.writeNote({
          workspacePath,
          path: savePath,
          content: contentToSave,
          source: 'editor-save-as',
        });
      } else {
        await invoke('write_file_content', { path: savePath, content: contentToSave });
      }

      // Update tab path to the new file
      const store = useEditorGroupStore.getState();
      store.updateTabPath(filePath, savePath);
      const group = store.getFocusedGroup();
      if (group) {
        setSavedDoc(group.id, savePath, docToSave);
        store.markTabDirty(group.id, savePath, false);
      }

      if (onRefreshFiles) onRefreshFiles();
    } catch (_) {}
  }, [workspacePath, onRefreshFiles]);

  return { handleSave, handleSaveAs };
}
