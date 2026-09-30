import { useSyncExternalStore } from 'react';
import { Bookmark, FileText, X } from 'lucide-react';
import bookmarksManager from '../../core/bookmarks/manager.js';

function getFileName(path) {
  return path?.split('/').pop() || path;
}

export default function BookmarksPanel({ workspacePath, onFileOpen }) {
  const bookmarks = useSyncExternalStore(
    (listener) => bookmarksManager.subscribe(workspacePath, listener),
    () => bookmarksManager.getBookmarks(workspacePath),
    () => [],
  );

  return (
    <aside className="h-full overflow-hidden flex flex-col bg-app-panel border-r border-app-border">
      <div className="h-[34px] px-3 flex items-center gap-2 flex-none border-b border-app-border">
        <Bookmark className="w-4 h-4 text-app-muted" strokeWidth={1.5} />
        <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">
          Bookmarks
        </span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Bookmark className="w-8 h-8 text-app-muted mb-3" strokeWidth={1.5} />
          <p className="text-sm text-app-text">No bookmarks yet</p>
          <p className="text-xs text-app-muted mt-1">
            Right-click a file and choose “Add to Bookmarks”.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.path} className="group flex items-center gap-1 rounded">
              <button
                type="button"
                onClick={() => onFileOpen(bookmark)}
                className="flex-1 min-w-0 flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-app-text hover:bg-app-bg"
                title={bookmark.path}
              >
                <FileText className="w-4 h-4 flex-none text-app-muted" strokeWidth={1.5} />
                <span className="truncate">{bookmark.name || getFileName(bookmark.path)}</span>
              </button>
              <button
                type="button"
                onClick={() => bookmarksManager.remove(workspacePath, bookmark.path)}
                className="obsidian-button icon-only small opacity-0 group-hover:opacity-100"
                title="Remove bookmark"
                aria-label={`Remove bookmark for ${bookmark.name || getFileName(bookmark.path)}`}
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
