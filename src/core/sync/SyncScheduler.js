import { syncEngine } from './SyncEngine';
import { keyManager } from './KeyManager';
import { offlineQueue } from './OfflineQueue';

export class SyncScheduler {
  constructor() {
    this.interval = null;
    this.saveDebounceTimer = null;
    this.pendingFiles = new Set();
    this.enabled = false;
    this.initFailed = false;
    this._workspacePath = null;
    this._userId = null;
  }

  async start(workspacePath, userId) {
    this._workspacePath = workspacePath;
    this._userId = userId;

    try {
      await syncEngine.init(workspacePath, userId);
      await keyManager.initialize(userId);
      this.initFailed = false;
    } catch (err) {
      console.warn('[Sync] Init failed, will retry on next cycle:', err.message);
      this.initFailed = true;
    }

    this.enabled = true;

    // Full sync on startup (delayed to let auth settle)
    // This also drains any offline queue from previous session
    setTimeout(async () => {
      if (!this.enabled) return;
      if (!(await this._ensureInitialized())) return;
      syncEngine.sync();
    }, 2000);

    // Full sync every 5 minutes
    this.interval = setInterval(async () => {
      if (!this.enabled) return;
      if (!(await this._ensureInitialized())) return;
      syncEngine.sync();
    }, 5 * 60 * 1000);
  }

  async _ensureInitialized() {
    if (!this.initFailed) return true;
    try {
      await syncEngine.init(this._workspacePath, this._userId);
      await keyManager.initialize(this._userId);
      this.initFailed = false;
      return true;
    } catch (err) {
      console.warn('[Sync] Init retry failed:', err.message);
      return false;
    }
  }

  /**
   * Called when a specific file is saved.
   * Batches multiple saves within 3s window, then syncs only those files.
   * If offline, SyncEngine will queue them automatically.
   */
  onFileSaved(absolutePath) {
    if (!this.enabled) return;

    if (absolutePath) {
      this.pendingFiles.add(absolutePath);
    }

    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(async () => {
      if (!(await this._ensureInitialized())) return;

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
    syncEngine.destroy();
  }
}

export const syncScheduler = new SyncScheduler();
