import { invoke } from '@tauri-apps/api/core';
import { TRASH_MAX_AGE_DAYS } from './constants';

function joinPath(base, rel) {
  const sep = base.includes('\\') ? '\\' : '/';
  return base + sep + rel.replace(/\//g, sep);
}

export class TrashManager {
  /**
   * Soft-delete a file by copying it to .lokus/trash/{date}/{path}
   */
  async moveToTrash(workspacePath, relPath) {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const trashDir = joinPath(workspacePath, `.lokus/trash/${date}`);
    const trashPath = joinPath(trashDir, relPath);
    const sourcePath = joinPath(workspacePath, relPath);

    try {
      // Ensure trash subdirectory exists
      const lastSep = Math.max(trashPath.lastIndexOf('/'), trashPath.lastIndexOf('\\'));
      const parentDir = trashPath.substring(0, lastSep);
      await invoke('create_directory', { path: parentDir, recursive: true });

      // Copy file to trash (best-effort — file may already be deleted)
      try {
        const content = await invoke('read_binary_file', { path: sourcePath });
        await invoke('write_binary_file', { path: trashPath, content: Array.from(new Uint8Array(content)) });
      } catch {
        // Source file doesn't exist (already deleted) — that's fine
      }
    } catch (err) {
      console.warn(`[Trash] Failed to trash ${relPath}:`, err.message);
    }
  }

  /**
   * Clean up trash directories older than TRASH_MAX_AGE_DAYS.
   */
  async cleanupOldTrash(workspacePath) {
    const trashBase = joinPath(workspacePath, '.lokus/trash');
    try {
      const entries = await invoke('read_directory', { path: trashBase });
      if (!entries || !Array.isArray(entries)) return;

      const cutoff = Date.now() - TRASH_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

      for (const entry of entries) {
        if (!entry.is_directory) continue;
        // Directory name is YYYY-MM-DD
        const dirDate = new Date(entry.name).getTime();
        if (isNaN(dirDate) || dirDate >= cutoff) continue;

        try {
          await invoke('remove_directory', { path: entry.path, recursive: true });
          console.log(`[Trash] Cleaned up ${entry.name}`);
        } catch (err) {
          console.warn(`[Trash] Failed to clean ${entry.name}:`, err.message);
        }
      }
    } catch {
      // Trash directory doesn't exist yet — nothing to clean
    }
  }
}

export const trashManager = new TrashManager();
