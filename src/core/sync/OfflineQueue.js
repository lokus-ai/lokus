import { invoke } from '@tauri-apps/api/core';

/**
 * Persists a queue of file paths that were edited while offline.
 * On reconnect, these get drained and synced.
 * Stored at .lokus/offline-queue.json
 */
export class OfflineQueue {
  constructor() {
    this.queue = new Set();
    this.workspacePath = null;
  }

  async load(workspacePath) {
    this.workspacePath = workspacePath;
    try {
      const raw = await invoke('read_file_content', {
        path: `${workspacePath}/.lokus/offline-queue.json`,
      });
      const arr = JSON.parse(raw);
      this.queue = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      this.queue = new Set();
    }
  }

  async save() {
    if (!this.workspacePath) return;
    try {
      await invoke('create_directory', { path: `${this.workspacePath}/.lokus`, recursive: true });
      await invoke('write_file_content', {
        path: `${this.workspacePath}/.lokus/offline-queue.json`,
        content: JSON.stringify([...this.queue]),
      });
    } catch (err) {
      console.warn('[OfflineQueue] Save failed:', err.message);
    }
  }

  /** Add files to the offline queue */
  async enqueue(relativePaths) {
    for (const p of relativePaths) this.queue.add(p);
    await this.save();
  }

  /** Drain all queued paths and clear */
  async drain() {
    const paths = [...this.queue];
    this.queue.clear();
    await this.save();
    return paths;
  }

  get size() {
    return this.queue.size;
  }

  get isEmpty() {
    return this.queue.size === 0;
  }
}

export const offlineQueue = new OfflineQueue();
