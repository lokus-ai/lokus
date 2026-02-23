import { FolderOpen, LayoutGrid, Puzzle, Database, Network, Calendar, CalendarDays } from 'lucide-react';
import LokusLogo from '../../components/LokusLogo.jsx';
import { useLayoutStore } from '../../stores/layout';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { useWorkspaceStore } from '../../stores/workspace';
import platformService from '../../services/platform/PlatformService.js';

/**
 * IconSidebar — the 48px icon column on the far left.
 *
 * Contains the Lokus logo toggle button and the activity bar buttons:
 * Explorer, Task Board, Graph, Bases, Calendar, Daily Notes, Plugins.
 * Uses useViewStore for currentView/switchView and useLayoutStore for toggleLeft.
 */
export default function IconSidebar({ onOpenBasesTab, onOpenGraphView }) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const toggleLeft = useLayoutStore((s) => s.toggleLeft);
  const uiVisibility = useUIVisibility();
  const featureFlags = useFeatureFlags();

  // View flags still on useWorkspaceStore during migration
  const showKanban = useWorkspaceStore((s) => s.showKanban);
  const showPlugins = useWorkspaceStore((s) => s.showPlugins);
  const showBases = useWorkspaceStore((s) => s.showBases);
  const showGraphView = useWorkspaceStore((s) => s.showGraphView);
  const showDailyNotesPanel = useWorkspaceStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useWorkspaceStore((s) => s.showCalendarPanel);

  const isExplorer = !showKanban && !showPlugins && !showBases && !showGraphView && showLeft;

  const handleExplorerClick = () => {
    useWorkspaceStore.setState({ showKanban: false });
    useWorkspaceStore.setState({ showPlugins: false });
    useWorkspaceStore.setState({ showBases: false });
    useWorkspaceStore.setState({ showGraphView: false });
    useWorkspaceStore.setState({ showLeft: true });
  };

  const handleKanbanClick = () => {
    useWorkspaceStore.setState({ showKanban: true });
    useWorkspaceStore.setState({ showPlugins: false });
    useWorkspaceStore.setState({ showBases: false });
    useWorkspaceStore.setState({ showGraphView: false });
    useWorkspaceStore.setState({ showLeft: true });
  };

  const handlePluginsClick = () => {
    useWorkspaceStore.setState({ showPlugins: true });
    useWorkspaceStore.setState({ showKanban: false });
    useWorkspaceStore.setState({ showBases: false });
    useWorkspaceStore.setState({ showGraphView: false });
    useWorkspaceStore.setState({ showLeft: true });
  };

  const handleDailyNotesClick = () => {
    useWorkspaceStore.setState({
      showDailyNotesPanel: !useWorkspaceStore.getState().showDailyNotesPanel,
    });
    useWorkspaceStore.setState({ showCalendarPanel: false });
    useWorkspaceStore.setState({ showRight: true });
    useWorkspaceStore.getState().closePanel('showVersionHistory');
  };

  const handleCalendarClick = () => {
    useWorkspaceStore.setState({
      showCalendarPanel: !useWorkspaceStore.getState().showCalendarPanel,
    });
    useWorkspaceStore.setState({ showDailyNotesPanel: false });
    useWorkspaceStore.setState({ showRight: true });
    useWorkspaceStore.getState().closePanel('showVersionHistory');
  };

  return (
    <aside
      className="flex flex-col items-center gap-1 border-r border-app-border bg-app-panel"
      style={{
        paddingTop: platformService.isMacOS() ? '0.5rem' : '0.75rem',
        paddingBottom: '0.75rem',
      }}
    >
      {/* Logo / Menu Toggle */}
      <button
        onClick={toggleLeft}
        title={showLeft ? 'Hide sidebar' : 'Show sidebar'}
        className="obsidian-button icon-only mb-2"
        onMouseEnter={(e) => {
          const icon = e.currentTarget.querySelector('svg');
          if (icon) icon.style.color = 'rgb(var(--accent))';
        }}
        onMouseLeave={(e) => {
          const icon = e.currentTarget.querySelector('svg');
          if (icon) icon.style.color = showLeft ? 'white' : 'black';
        }}
      >
        <LokusLogo className="w-6 h-6" style={{ color: showLeft ? 'white' : 'black' }} />
      </button>

      {/* Activity Bar */}
      <div className="w-full pt-2">
        {/* Explorer */}
        <button
          onClick={handleExplorerClick}
          title="Explorer"
          data-tour="files"
          className="obsidian-button icon-only w-full mb-1"
          onMouseEnter={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = 'rgb(var(--accent))';
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = isExplorer ? 'rgb(var(--accent))' : '';
          }}
        >
          <FolderOpen
            className="w-5 h-5"
            style={isExplorer ? { color: 'rgb(var(--accent))' } : {}}
          />
        </button>

        {/* Task Board (Kanban) */}
        {uiVisibility.sidebar_kanban && (
          <button
            onClick={handleKanbanClick}
            title="Task Board"
            className="obsidian-button icon-only w-full mb-1"
            onMouseEnter={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'rgb(var(--accent))';
            }}
            onMouseLeave={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon)
                icon.style.color =
                  showKanban && !showPlugins && !showBases && !showGraphView
                    ? 'rgb(var(--accent))'
                    : '';
            }}
          >
            <LayoutGrid
              className="w-5 h-5"
              style={
                showKanban && !showPlugins && !showBases && !showGraphView
                  ? { color: 'rgb(var(--accent))' }
                  : {}
              }
            />
          </button>
        )}

        {/* Extensions (Plugins) */}
        {featureFlags.enable_plugins && uiVisibility.sidebar_plugins && (
          <button
            onClick={handlePluginsClick}
            title="Extensions"
            className="obsidian-button icon-only w-full mb-1"
            onMouseEnter={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'rgb(var(--accent))';
            }}
            onMouseLeave={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon)
                icon.style.color =
                  showPlugins && !showKanban && !showBases && !showGraphView
                    ? 'rgb(var(--accent))'
                    : '';
            }}
          >
            <Puzzle
              className="w-5 h-5"
              style={
                showPlugins && !showKanban && !showBases && !showGraphView
                  ? { color: 'rgb(var(--accent))' }
                  : {}
              }
            />
          </button>
        )}

        {/* Bases */}
        {uiVisibility.sidebar_bases && (
          <button
            onClick={onOpenBasesTab}
            title="Bases"
            data-tour="bases"
            className="obsidian-button icon-only w-full mb-1"
            onMouseEnter={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'rgb(var(--accent))';
            }}
            onMouseLeave={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon)
                icon.style.color =
                  showBases && !showKanban && !showPlugins && !showGraphView
                    ? 'rgb(var(--accent))'
                    : '';
            }}
          >
            <Database
              className="w-5 h-5"
              style={
                showBases && !showKanban && !showPlugins && !showGraphView
                  ? { color: 'rgb(var(--accent))' }
                  : {}
              }
            />
          </button>
        )}

        {/* Graph View */}
        {uiVisibility.sidebar_graph && (
          <button
            onClick={onOpenGraphView}
            title="Graph View"
            data-tour="graph"
            className="obsidian-button icon-only w-full mb-1"
            onMouseEnter={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'rgb(var(--accent))';
            }}
            onMouseLeave={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '';
            }}
          >
            <Network className="w-5 h-5" />
          </button>
        )}

        {/* Daily Notes */}
        {uiVisibility.sidebar_daily_notes && (
          <button
            onClick={handleDailyNotesClick}
            title="Daily Notes"
            data-tour="daily-notes"
            className={`obsidian-button icon-only w-full mb-1 ${showDailyNotesPanel ? 'active' : ''}`}
            onMouseEnter={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'rgb(var(--accent))';
            }}
            onMouseLeave={(e) => {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = showDailyNotesPanel ? 'rgb(var(--accent))' : '';
            }}
          >
            <Calendar
              className="w-5 h-5"
              style={showDailyNotesPanel ? { color: 'rgb(var(--accent))' } : {}}
            />
          </button>
        )}

        {/* Calendar */}
        <button
          onClick={handleCalendarClick}
          title="Calendar"
          className={`obsidian-button icon-only w-full mb-1 ${showCalendarPanel ? 'active' : ''}`}
          onMouseEnter={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = 'rgb(var(--accent))';
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = showCalendarPanel ? 'rgb(var(--accent))' : '';
          }}
        >
          <CalendarDays
            className="w-5 h-5"
            style={showCalendarPanel ? { color: 'rgb(var(--accent))' } : {}}
          />
        </button>
      </div>
    </aside>
  );
}
