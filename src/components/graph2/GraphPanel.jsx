import React, { useMemo } from 'react';
import { Network } from 'lucide-react';
import GraphFrame from './GraphFrame.jsx';
import { useGraphStore } from '../../core/graph2/graphStore.js';

/**
 * GraphPanel — the sidebar preview frame.
 *
 * Header, boot/error/empty states, and a `preview` GraphFrame. Nothing else:
 * the index is booted once at the workspace level, and the frame reads the
 * shared engine and config itself.
 */
export default function GraphPanel({ focusPath = null, onFileClick, hideHeader = false }) {
  const status = useGraphStore((s) => s.status);
  const index = useGraphStore((s) => s.index);
  const version = useGraphStore((s) => s.version);
  const stats = useMemo(
    () => (index ? index.stats() : { files: 0, links: 0, phantoms: 0 }),
    [index, version] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="flex flex-col h-full bg-app-panel">
      {!hideHeader && (
        <div className="h-[38px] px-3 border-b border-app-border flex items-center justify-between flex-none">
          <h3 className="text-[13px] font-semibold flex items-center gap-2 text-app-text">
            <Network className="w-4 h-4" strokeWidth={1.5} />
            Graph
          </h3>
          {status === 'ready' && (
            <span className="text-xs text-app-muted">
              {stats.files} {stats.files === 1 ? 'file' : 'files'} · {stats.links} {stats.links === 1 ? 'link' : 'links'}
            </span>
          )}
        </div>
      )}

      {status === 'error' ? (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          <p className="text-xs px-4 text-center">Graph failed to load</p>
        </div>
      ) : status !== 'ready' ? (
        <div className="flex-1 flex items-center justify-center text-app-muted text-xs">
          Building graph…
        </div>
      ) : stats.files === 0 ? (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          <div className="text-center">
            <Network className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No files yet</p>
            <p className="text-[11px] mt-1 opacity-70">Create notes and link them with [[</p>
          </div>
        </div>
      ) : (
        <GraphFrame
          className="flex-1 min-h-0"
          variant="preview"
          focusPath={focusPath}
          onOpenFile={onFileClick}
        />
      )}
    </div>
  );
}
