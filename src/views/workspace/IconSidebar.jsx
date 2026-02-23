import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import { useViewStore } from '../../stores/views';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
import LokusLogo from '../../components/LokusLogo';
import {
  FolderOpen, LayoutGrid, Puzzle, Database, Network,
  Calendar, CalendarDays, Package,
} from 'lucide-react';
import platformService from '../../services/platform/PlatformService';

/**
 * IconSidebar — 48px icon column on the far left.
 * Activity bar with Explorer, Task Board, Graph, Bases, Calendar, Marketplace, Plugins.
 */
export default function IconSidebar({ onOpenGraph, onOpenBases }) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const currentView = useViewStore((s) => s.currentView);
  const uiVisibility = useUIVisibility();
  const featureFlags = useFeatureFlags();

  const switchToExplorer = () => {
    useViewStore.getState().switchView('editor');
    useLayoutStore.getState().toggleLeft();
  };

  const switchToKanban = () => {
    useViewStore.getState().switchView('kanban');
    useLayoutStore.setState({ showLeft: true });
  };

  const switchToGraph = () => {
    useViewStore.getState().switchView('graph');
    if (onOpenGraph) onOpenGraph();
  };

  const switchToBases = () => {
    useViewStore.getState().switchView('bases');
    if (onOpenBases) onOpenBases();
  };

  const isActive = (view) => currentView === view;

  const iconBtn = (onClick, title, icon, active, dataTour) => (
    <button
      onClick={onClick}
      title={title}
      data-tour={dataTour}
      className={`obsidian-button icon-only w-full mb-1 ${active ? 'active' : ''}`}
    >
      {React.cloneElement(icon, {
        className: 'w-5 h-5',
        style: active ? { color: 'rgb(var(--accent))' } : {},
      })}
    </button>
  );

  return (
    <aside
      className="flex flex-col items-center gap-1 border-r border-app-border bg-app-panel"
      style={{
        paddingTop: platformService.isMacOS() ? '0.5rem' : '0.75rem',
        paddingBottom: '0.75rem',
      }}
    >
      <button
        onClick={() => useLayoutStore.getState().toggleLeft()}
        title={showLeft ? 'Hide sidebar' : 'Show sidebar'}
        className="obsidian-button icon-only mb-2"
      >
        <LokusLogo className="w-6 h-6" style={{ color: showLeft ? 'white' : 'black' }} />
      </button>

      <div className="w-full pt-2">
        {iconBtn(switchToExplorer, 'Explorer', <FolderOpen />, isActive('editor') && showLeft, 'files')}
        {uiVisibility.sidebar_kanban && iconBtn(switchToKanban, 'Task Board', <LayoutGrid />, isActive('kanban'))}
        {featureFlags.enable_plugins && uiVisibility.sidebar_plugins &&
          iconBtn(() => useViewStore.getState().switchView('marketplace'), 'Extensions', <Puzzle />, isActive('marketplace'))}
        {uiVisibility.sidebar_bases && iconBtn(switchToBases, 'Bases', <Database />, isActive('bases'), 'bases')}
        {uiVisibility.sidebar_graph && iconBtn(switchToGraph, 'Graph View', <Network />, isActive('graph'), 'graph')}
        {uiVisibility.sidebar_daily_notes &&
          iconBtn(
            () => useViewStore.getState().togglePanel('showDailyNotesPanel'),
            'Daily Notes',
            <Calendar />,
            false,
            'daily-notes',
          )}
        <button
          onClick={() => useViewStore.getState().switchView('calendar')}
          title="Calendar"
          className={`obsidian-button icon-only w-full mb-1 ${isActive('calendar') ? 'active' : ''}`}
        >
          <CalendarDays className="w-5 h-5" style={isActive('calendar') ? { color: 'rgb(var(--accent))' } : {}} />
        </button>
      </div>
    </aside>
  );
}
