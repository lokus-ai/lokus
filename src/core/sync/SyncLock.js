import { LOCK_HEARTBEAT_MS, LOCK_STALE_MS } from './constants';

const LOCK_PREFIX = 'lokus-sync-lock-';

export class SyncLock {
  constructor() {
    this._heartbeatTimer = null;
    this._lockedWorkspaceId = null;
    // In-memory coordination between a sync and an editor save in THIS window.
    // The cross-window localStorage lock cannot distinguish same-window callers
    // (they share a holderId), so same-window mutual exclusion is tracked here.
    this._syncRunning = false;
    this._saveCount = 0;
  }

  acquire(workspaceId) {
    const key = LOCK_PREFIX + workspaceId;
    const existing = localStorage.getItem(key);

    if (existing) {
      try {
        const { timestamp, holder } = JSON.parse(existing);
        const age = Date.now() - timestamp;
        if (age < LOCK_STALE_MS && holder !== this._holderId()) {
          return false; // Another window holds the lock
        }
      } catch {
        // Corrupt lock data, take it over
      }
    }

    this._lockedWorkspaceId = workspaceId;
    this._syncRunning = true;
    this._writeLock(key);
    this._startHeartbeat(key);
    return true;
  }

  release(workspaceId) {
    const key = LOCK_PREFIX + (workspaceId || this._lockedWorkspaceId);
    this._stopHeartbeat();

    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        const { holder } = JSON.parse(existing);
        if (holder === this._holderId()) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      localStorage.removeItem(key);
    }

    this._lockedWorkspaceId = null;
    this._syncRunning = false;
  }

  /**
   * True if a sync is currently running — either in this window (_syncRunning)
   * or in another window (a fresh cross-window lock exists). Used by the editor
   * save path to yield briefly so a sync download can't land mid-save.
   */
  isSyncActive(workspaceId) {
    if (this._syncRunning) return true;
    if (!workspaceId) return false;
    const existing = localStorage.getItem(LOCK_PREFIX + workspaceId);
    if (!existing) return false;
    try {
      const { timestamp } = JSON.parse(existing);
      return Date.now() - timestamp < LOCK_STALE_MS;
    } catch {
      return false;
    }
  }

  /** Mark an editor save as in-flight (shared read side of the lock). */
  beginSave() {
    this._saveCount += 1;
  }

  /** Mark an editor save as finished. */
  endSave() {
    if (this._saveCount > 0) this._saveCount -= 1;
  }

  /** True while at least one editor save is writing in this window. */
  isSaveActive() {
    return this._saveCount > 0;
  }

  _holderId() {
    if (!this._id) {
      this._id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return this._id;
  }

  _writeLock(key) {
    localStorage.setItem(key, JSON.stringify({
      holder: this._holderId(),
      timestamp: Date.now(),
    }));
  }

  _startHeartbeat(key) {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => this._writeLock(key), LOCK_HEARTBEAT_MS);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }
}

export const syncLock = new SyncLock();
