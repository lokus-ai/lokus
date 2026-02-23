import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import TerminalPanel from '../../components/TerminalPanel/TerminalPanel';
import { OutputPanel } from '../../components/OutputPanel/OutputPanel';

/**
 * BottomPanel — terminal and output panels with tab switching.
 * Reads from useLayoutStore for height and active tab.
 */
export default function BottomPanel({ workspacePath }) {
  const bottomPanelHeight = useLayoutStore((s) => s.bottomPanelHeight);
  const bottomPanelTab = useLayoutStore((s) => s.bottomPanelTab);

  return (
    <div
      className="border-t border-app-border bg-app-panel overflow-hidden"
      style={{ height: `${bottomPanelHeight}px` }}
    >
      <div className="flex items-center h-8 px-2 border-b border-app-border gap-2">
        <button
          onClick={() => useLayoutStore.getState().setBottomTab('terminal')}
          className={`text-xs px-2 py-1 rounded ${bottomPanelTab === 'terminal' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-app-text'}`}
        >
          Terminal
        </button>
        <button
          onClick={() => useLayoutStore.getState().setBottomTab('output')}
          className={`text-xs px-2 py-1 rounded ${bottomPanelTab === 'output' ? 'bg-app-accent text-white' : 'text-app-muted hover:text-app-text'}`}
        >
          Output
        </button>
      </div>
      <div className="flex-1 overflow-hidden" style={{ height: `${bottomPanelHeight - 32}px` }}>
        {bottomPanelTab === 'terminal' && <TerminalPanel workspacePath={workspacePath} />}
        {bottomPanelTab === 'output' && <OutputPanel />}
      </div>
    </div>
  );
}
