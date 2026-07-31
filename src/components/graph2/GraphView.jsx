import React, { useEffect, useMemo, useState } from 'react';
import { Network, Search, PanelRightClose, PanelRightOpen } from 'lucide-react';
import GraphFrame from './GraphFrame.jsx';
import GraphSidebar from '../GraphSidebar.jsx';
import { useGraphStore } from '../../core/graph2/graphStore.js';
import { useGraphConfig } from '../../core/graph2/graphConfig.js';

/**
 * GraphView — the whole-workspace graph, full tab.
 *
 * A `full` GraphFrame with a collapsible settings rail. Same engine, same
 * config, same layout as the sidebar preview — this frame just gets the room
 * to show it, plus the controls.
 */
export default function GraphView({ workspacePath, focusPath = null, onFileClick }) {
  const status = useGraphStore((s) => s.status);
  const index = useGraphStore((s) => s.index);
  const version = useGraphStore((s) => s.version);
  const stats = useMemo(
    () => (index ? index.stats() : { files: 0, links: 0, phantoms: 0 }),
    [index, version] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const search = useGraphConfig((s) => s.config.search);
  const update = useGraphConfig((s) => s.update);
  const [showSettings, setShowSettings] = useState(true);

  // Idempotent — a no-op once the workspace has loaded its settings.
  useEffect(() => {
    if (workspacePath) useGraphConfig.getState().load(workspacePath);
  }, [workspacePath]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-app-bg">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div className="h-[42px] px-3 flex-none border-b border-app-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-muted" />
            <input
              type="text"
              value={search || ''}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Search the graph…"
              className="w-full pl-8 pr-3 py-1.5 bg-app-panel border border-app-border rounded text-xs text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
            />
          </div>

          <span className="text-xs text-app-muted whitespace-nowrap">
            {stats.files} {stats.files === 1 ? 'file' : 'files'} · {stats.links} {stats.links === 1 ? 'link' : 'links'}
          </span>

          <button
            onClick={() => setShowSettings((v) => !v)}
            className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-panel transition-colors"
            title={showSettings ? 'Hide graph settings' : 'Show graph settings'}
            aria-label={showSettings ? 'Hide graph settings' : 'Show graph settings'}
          >
            {showSettings ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>

        {/* Frame */}
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
              <Network className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No files yet</p>
              <p className="text-xs mt-1 opacity-70">Create notes and link them with [[</p>
            </div>
          </div>
        ) : (
          <GraphFrame
            className="flex-1 min-h-0"
            variant="full"
            focusPath={focusPath}
            onOpenFile={onFileClick}
          />
        )}
      </div>

      {/* Settings rail */}
      {showSettings && (
        <div className="w-[280px] flex-none border-l border-app-border flex flex-col min-h-0">
          <div className="h-[42px] px-4 flex-none border-b border-app-border flex items-center">
            <h3 className="text-[13px] font-semibold text-app-text flex items-center gap-2">
              <Network className="w-4 h-4" strokeWidth={1.5} />
              Graph Settings
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            <GraphSidebar hideHeader />
          </div>
        </div>
      )}
    </div>
  );
}
