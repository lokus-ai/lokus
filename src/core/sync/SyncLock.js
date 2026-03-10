import { LOCK_HEARTBEAT_MS, LOCK_STALE_MS } from './constants';

const LOCK_PREFIX = 'lokus-sync-lock-';

export class SyncLock {
  constructor() {
    this._heartbeatTimer = null;
    this._lockedWorkspaceId = null;
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
