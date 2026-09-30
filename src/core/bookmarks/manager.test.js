import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BookmarksManager } from './manager.js';

describe('BookmarksManager', () => {
  let manager;

  beforeEach(() => {
    manager = new BookmarksManager();
  });

  it('adds and lists file bookmarks', () => {
    manager.add('/workspace', { path: '/workspace/one.md', name: 'one.md' });

    expect(manager.getBookmarks('/workspace')).toEqual([
      { path: '/workspace/one.md', name: 'one.md' },
    ]);
    expect(manager.isBookmarked('/workspace', '/workspace/one.md')).toBe(true);
  });

  it('does not add duplicate bookmarks', () => {
    expect(manager.add('/workspace', { path: '/workspace/one.md' })).toBe(true);
    expect(manager.add('/workspace', { path: '/workspace/one.md' })).toBe(false);

    expect(manager.getBookmarks('/workspace')).toHaveLength(1);
  });

  it('toggles and removes bookmarks', () => {
    const bookmark = { path: '/workspace/one.md', name: 'one.md' };

    expect(manager.toggle('/workspace', bookmark)).toBe(true);
    expect(manager.toggle('/workspace', bookmark)).toBe(false);
    expect(manager.getBookmarks('/workspace')).toEqual([]);
  });

  it('keeps bookmarks isolated by workspace', () => {
    manager.add('/workspace-a', { path: '/workspace-a/one.md' });
    manager.add('/workspace-b', { path: '/workspace-b/one.md' });

    expect(manager.getBookmarks('/workspace-a')).toHaveLength(1);
    expect(manager.getBookmarks('/workspace-b')).toHaveLength(1);
    expect(manager.isBookmarked('/workspace-a', '/workspace-b/one.md')).toBe(false);
  });

  it('notifies subscribers when bookmarks change', () => {
    const listener = vi.fn();
    manager.subscribe('/workspace', listener);

    manager.add('/workspace', { path: '/workspace/one.md' });
    manager.remove('/workspace', '/workspace/one.md');

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
