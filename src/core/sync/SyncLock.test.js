import { describe, it, expect, beforeEach } from 'vitest';
import { SyncLock } from './SyncLock';

describe('SyncLock — save/sync coordination', () => {
  let lock;
  beforeEach(() => {
    localStorage.clear();
    lock = new SyncLock();
  });

  it('isSyncActive is false when nothing is running', () => {
    expect(lock.isSyncActive('ws1')).toBe(false);
  });

  it('reports a sync as active in this window while the lock is held', () => {
    expect(lock.acquire('ws1')).toBe(true);
    expect(lock.isSyncActive('ws1')).toBe(true);
    lock.release('ws1');
    expect(lock.isSyncActive('ws1')).toBe(false);
  });

  it('detects a fresh cross-window lock even without _syncRunning set', () => {
    // Simulate another window holding a fresh lock.
    localStorage.setItem('lokus-sync-lock-ws1', JSON.stringify({ holder: 'other', timestamp: Date.now() }));
    const observer = new SyncLock();
    expect(observer.isSyncActive('ws1')).toBe(true);
  });

  it('ignores a stale cross-window lock', () => {
    localStorage.setItem('lokus-sync-lock-ws1', JSON.stringify({ holder: 'other', timestamp: Date.now() - 60000 }));
    const observer = new SyncLock();
    expect(observer.isSyncActive('ws1')).toBe(false);
  });

  it('tracks in-flight editor saves via begin/end', () => {
    expect(lock.isSaveActive()).toBe(false);
    lock.beginSave();
    lock.beginSave();
    expect(lock.isSaveActive()).toBe(true);
    lock.endSave();
    expect(lock.isSaveActive()).toBe(true);
    lock.endSave();
    expect(lock.isSaveActive()).toBe(false);
    lock.endSave(); // underflow guard
    expect(lock.isSaveActive()).toBe(false);
  });
});
