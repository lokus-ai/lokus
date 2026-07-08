import { invoke } from '@tauri-apps/api/core';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { createLokusSerializer } from '../../core/markdown/lokus-md-pipeline';
import { isPlainTextNotePath, docToPlainTextString } from '../../utils/plainTextNote.js';
import { isImageFile } from '../../utils/imageUtils';
import { isPDFFile } from '../../utils/pdfUtils';
import { syncScheduler } from '../../core/sync/SyncScheduler';
import { writeFileGuarded } from '../../core/sync/guardedWrite';

/**
 * tabSaver — save any tab's content from outside the EditorGroup component.
 *
 * EditorGroup keeps one EditorState per tab in a private ref (editorStatesRef).
 * Autosave, quit-flush, and the dirty-aware close guard all need to serialize
 * tabs that may not be active, so each EditorGroup registers a state provider
 * here (groupId → (path) => EditorState).
 */

const lokusSerializer = createLokusSerializer();

const stateProviders = new Map();

export function registerTabStateProvider(groupId, provider) {
  if (provider) {
    stateProviders.set(groupId, provider);
  } else {
    stateProviders.delete(groupId);
  }
}

function isProseMirrorTab(path) {
  return !!path
    && !path.startsWith('__')
    && !path.endsWith('.canvas')
    && !path.endsWith('.excalidraw')
    && !path.endsWith('.kanban')
    && !path.endsWith('.graph')
    && !isImageFile(path)
    && !isPDFFile(path);
}

/**
 * Serialize and write a single tab to disk.
 * No rename-on-title logic here — that stays on the explicit Cmd+S path.
 * Returns true when the tab is persisted (or already clean), false otherwise.
 */
export async function saveTab(groupId, path) {
  if (!isProseMirrorTab(path)) return false;

  const store = useEditorGroupStore.getState();
  const group = store.findGroup(groupId);
  if (!group) return false;

  const content = group.contentByTab?.[path];
  // Never write a file whose original content failed to load — saving would
  // overwrite the original with whatever the editor happens to hold.
  if (content?.loadError) return false;

  const state = stateProviders.get(groupId)?.(path);
  if (!state) return false;

  const serialized = isPlainTextNotePath(path)
    ? docToPlainTextString(state.doc)
    : lokusSerializer.serialize(state.doc);

  if (content?.savedContent === serialized) {
    store.markTabDirty(groupId, path, false);
    return true;
  }

  await writeFileGuarded(path, serialized);
  syncScheduler.onFileSaved(path);
  store.setTabContent(groupId, path, { savedContent: serialized });
  store.markTabDirty(groupId, path, false);
  return true;
}

/**
 * Flush every dirty tab in every group. Fire-and-forget safe: individual
 * failures are logged and don't block the rest.
 */
export async function flushAllDirtyTabs() {
  const store = useEditorGroupStore.getState();
  const groups = store.getAllGroups();
  const saves = [];
  for (const group of groups) {
    for (const [path, content] of Object.entries(group.contentByTab || {})) {
      if (content?.dirty && !content?.loadError) {
        saves.push(
          saveTab(group.id, path).catch((e) => {
            console.error('flushAllDirtyTabs: failed to save', path, e);
          })
        );
      }
    }
  }
  await Promise.all(saves);
}
