import { syncEngine } from './SyncEngine';
import { keyManager } from './KeyManager';

export class SyncScheduler {
  constructor() {
    this.interval = null;
    this.saveDebounceTimer = null;
    this.enabled = false;
  }

  async start(workspacePath, userId) {
    syncEngine.init(workspacePath, userId);
    await keyManager.initialize(userId);

    this.enabled = true;

    // Sync immediately on start
    await syncEngine.sync();

    // Then sync every 5 minutes
    this.interval = setInterval(() => {
      if (this.enabled) syncEngine.sync();
    }, 5 * 60 * 1000);
  }

  onFileSaved() {
    if (!this.enabled) return;

    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      syncEngine.sync();
    }, 3000);
  }

  stop() {
    this.enabled = false;
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
