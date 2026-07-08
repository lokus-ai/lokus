import { confirm } from '@tauri-apps/plugin-dialog';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { saveTab } from '../editor/tabSaver';

let dialogOpen = false;

/**
 * closeTabWithGuard — the single dirty-aware tab close path.
 *
 * Every UI that closes a tab (Cmd+W, toolbar tab-bar X, split-pane tab X,
 * command palette) must go through here so a dirty tab is never silently
 * discarded. Dirty tabs prompt: Save & Close (default) or Cancel.
 *
 * Returns true when the tab was actually closed (so callers can run their
 * own cleanup, e.g. EditorGroup dropping its cached EditorState).
 */
export async function closeTabWithGuard(groupId, path) {
  if (!groupId || !path) return false;
  if (dialogOpen) return false;

  const store = useEditorGroupStore.getState();
  const group = store.findGroup(groupId);
  if (!group) return false;

  const tab = group.tabs.find((t) => t.path === path);
  const content = group.contentByTab?.[path];
  const isDirty = !!content?.dirty && !content?.loadError;

  const doClose = () => {
    if (tab) useEditorGroupStore.getState().addRecentlyClosed(tab);
    useEditorGroupStore.getState().removeTab(groupId, path);
  };

  if (!isDirty) {
    doClose();
    return true;
  }

  // Try a silent save first — with autosave running this is the normal path
  // and matches the "never lose an edit" contract without interrupting.
  try {
    const saved = await saveTab(groupId, path);
    if (saved) {
      doClose();
      return true;
    }
  } catch (e) {
    console.error('closeTabWithGuard: save failed for', path, e);
  }

  // Save failed (or the tab type can't be saved here) — ask before discarding.
  const name = tab?.name || path.split('/').pop() || path;
  try {
    dialogOpen = true;
    const discard = await confirm(
      `"${name}" has unsaved changes that could not be saved. Close anyway and lose them?`,
      { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Close Anyway', cancelLabel: 'Keep Open' }
    );
    if (discard) {
      doClose();
      return true;
    }
    return false;
  } catch {
    // Dialog unavailable (non-Tauri context) — keep the tab to stay safe.
    return false;
  } finally {
    dialogOpen = false;
  }
}
