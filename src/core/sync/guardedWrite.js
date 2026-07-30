import { invoke } from '@tauri-apps/api/core';
import { syncEngine } from './SyncEngine';
import { syncLock } from './SyncLock';

/**
 * Write a file mutually-exclusively with a running sync: a sync download must
 * not land on top of a save in progress, and a save must not interleave a
 * sync's write. Non-blocking when no sync is active; if one is, wait briefly
 * (bounded) then proceed anyway — a user save must never be lost or hang.
 *
 * Used by every editor write path (explicit Cmd+S, autosave, quit-flush).
 */
export async function writeFileGuarded(path, content) {
  const workspaceId = syncEngine?.syncEnabled ? syncEngine.workspaceId : null;
  if (!workspaceId) {
    await invoke('write_file_content', { path, content });
    return;
  }

  const MAX_WAIT_MS = 3000;
  const start = Date.now();
  let waited = false;
  while (syncLock.isSyncActive(workspaceId) && Date.now() - start < MAX_WAIT_MS) {
    waited = true;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (waited && syncLock.isSyncActive(workspaceId)) {
    console.warn('[Sync] Sync still running after 3s — proceeding with save to avoid data loss');
  }

  syncLock.beginSave();
  try {
    await invoke('write_file_content', { path, content });
  } finally {
    syncLock.endSave();
  }
}
