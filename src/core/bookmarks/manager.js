/**
 * In-memory file bookmarks for the current app session.
 *
 * Phase 1 intentionally does not persist bookmarks to disk. Bookmarks are
 * scoped by workspace so switching workspaces never shows another vault's
 * bookmarks.
 */
export class BookmarksManager {
  constructor() {
    this.bookmarksByWorkspace = new Map();
    this.listenersByWorkspace = new Map();
  }

  getBookmarks(workspacePath) {
    return [...(this.bookmarksByWorkspace.get(workspacePath) || [])];
  }

  isBookmarked(workspacePath, filePath) {
    return (this.bookmarksByWorkspace.get(workspacePath) || [])
      .some((bookmark) => bookmark.path === filePath);
  }

  add(workspacePath, bookmark) {
    if (!workspacePath || !bookmark?.path || this.isBookmarked(workspacePath, bookmark.path)) {
      return false;
    }

    const current = this.bookmarksByWorkspace.get(workspacePath) || [];
    this.bookmarksByWorkspace.set(workspacePath, [
      ...current,
      {
        path: bookmark.path,
        name: bookmark.name || bookmark.path.split('/').pop() || bookmark.path,
      },
    ]);
    this.notify(workspacePath);
    return true;
  }

  remove(workspacePath, filePath) {
    const current = this.bookmarksByWorkspace.get(workspacePath) || [];
    const next = current.filter((bookmark) => bookmark.path !== filePath);
    if (next.length === current.length) return false;

    this.bookmarksByWorkspace.set(workspacePath, next);
    this.notify(workspacePath);
    return true;
  }

  toggle(workspacePath, bookmark) {
    if (this.isBookmarked(workspacePath, bookmark?.path)) {
      this.remove(workspacePath, bookmark.path);
      return false;
    }

    this.add(workspacePath, bookmark);
    return true;
  }

  subscribe(workspacePath, listener) {
    let listeners = this.listenersByWorkspace.get(workspacePath);
    if (!listeners) {
      listeners = new Set();
      this.listenersByWorkspace.set(workspacePath, listeners);
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listenersByWorkspace.delete(workspacePath);
      }
    };
  }

  notify(workspacePath) {
    this.listenersByWorkspace.get(workspacePath)?.forEach((listener) => listener());
  }
}

const bookmarksManager = new BookmarksManager();

export default bookmarksManager;
