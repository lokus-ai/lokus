import { syncEngine } from './SyncEngine';
import { keyManager } from './KeyManager';

export class SyncScheduler {
  constructor() {
    this.interval = null;
    this.saveDebounceTimer = null;
    this.pendingFiles = new Set();
    this.enabled = false;
  }

  async start(workspacePath, userId) {
    try {
      await syncEngine.init(workspacePath, userId);
      await keyManager.initialize(userId);
    } catch (err) {
      console.warn('[Sync] Init failed, will retry on next cycle:', err.message);
    }

    this.enabled = true;

    // Full sync on startup (delayed to let auth settle)
    setTimeout(() => {
      if (this.enabled) syncEngine.sync();
    }, 2000);

    // Full sync every 5 minutes to catch external changes
    this.interval = setInterval(() => {
      if (this.enabled) syncEngine.sync();
    }, 5 * 60 * 1000);
  }

  /**
   * Called when a specific file is saved.
   * Batches multiple saves within 3s window, then syncs only those files.
   */
  onFileSaved(absolutePath) {
    if (!this.enabled) return;

    if (absolutePath) {
      this.pendingFiles.add(absolutePath);
    }

    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      const files = [...this.pendingFiles];
      this.pendingFiles.clear();

      if (files.length > 0) {
        syncEngine.syncFiles(files);
      } else {
        syncEngine.sync();
      }
    }, 3000);
  }

  stop() {
    this.enabled = false;
    this.pendingFiles.clear();
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
  }
}

export const syncScheduler = new SyncScheduler();
