import { FolderOpen, LayoutGrid, Puzzle, Database, Network, Calendar, CalendarDays, ListTodo, Users } from 'lucide-react';
import LokusLogo from '../../components/LokusLogo.jsx';
import { useLayoutStore } from '../../stores/layout';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
import platformService from '../../services/platform/PlatformService.js';

/**
 * IconSidebar — the 44px ribbon on the far left.
 *
 * Contains the Lokus logo toggle button and the activity bar buttons:
 * Explorer, Task Board, Graph, Bases, Calendar, Daily Notes, Plugins.
 * Styling is pure CSS (.ribbon-button) — no per-button JS hover.
 */
export default function IconSidebar({ onOpenBasesTab, onOpenGraphView }) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const toggleLeft = useLayoutStore((s) => s.toggleLeft);
  const uiVisibility = useUIVisibility();
  const featureFlags = useFeatureFlags();

  // View state from useViewStore
  const currentView = useViewStore((s) => s.currentView);
  const showDailyNotesPanel = useViewStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useViewStore((s) => s.showCalendarPanel);
  const showAgendaPanel = useViewStore((s) => s.showAgendaPanel);

  // Derive boolean view flags from currentView
  const showKanban = currentView === 'kanban';
  const showPlugins = currentView === 'marketplace';
  const showTeams = currentView === 'teams';

  // Bases and Graph are tabs, not view switches — check the active tab
  const activeTab = useEditorGroupStore((s) => {
    const { layout, focusedGroupId } = s;
    if (!focusedGroupId) return null;
    const findGroup = (node) => {
      if (node.type === 'group' && node.id === focusedGroupId) return node;
      if (node.type === 'container') {
        for (const child of node.children) {
          const found = findGroup(child);
          if (found) return found;
        }
      }
      return null;
    };
    return findGroup(layout)?.activeTab ?? null;
  });
  const showBases = activeTab === '__bases__';
  const showGraphView = activeTab === '__graph__';

  const isExplorer = !showKanban && !showPlugins && !showTeams && !showBases && !showGraphView && showLeft;
  const isKanbanActive = showKanban && !showPlugins && !showBases && !showGraphView;
  const isPluginsActive = showPlugins && !showKanban && !showBases && !showGraphView;
  const isBasesActive = showBases && !showKanban && !showPlugins && !showGraphView;
  const isTeamsActive = showTeams && !showKanban && !showPlugins && !showBases && !showGraphView;

  const handleExplorerClick = () => {
    useViewStore.getState().switchView('editor');
    useLayoutStore.setState({ showLeft: true });
  };

  const handleKanbanClick = () => {
    useViewStore.getState().switchView('kanban');
    useLayoutStore.setState({ showLeft: true });
  };

  const handlePluginsClick = () => {
    useViewStore.getState().switchView('marketplace');
    useLayoutStore.setState({ showLeft: true });
  };

  const handleTeamsClick = () => {
    useViewStore.getState().switchView('teams');
    useLayoutStore.setState({ showLeft: true });
  };

  const handleDailyNotesClick = () => {
    const nextValue = !useViewStore.getState().showDailyNotesPanel;
    useViewStore.setState({
      showDailyNotesPanel: nextValue,
      showCalendarPanel: false,
      showAgendaPanel: false,
    });
    useLayoutStore.setState({ showRight: true });
    useViewStore.getState().closePanel('showVersionHistory');
  };

  const handleCalendarClick = () => {
    const nextValue = !useViewStore.getState().showCalendarPanel;
    useViewStore.setState({
      showCalendarPanel: nextValue,
      showDailyNotesPanel: false,
      showAgendaPanel: false,
    });
    useLayoutStore.setState({ showRight: true });
    useViewStore.getState().closePanel('showVersionHistory');
  };

  const handleAgendaClick = () => {
    const nextValue = !useViewStore.getState().showAgendaPanel;
    useViewStore.setState({
      showAgendaPanel: nextValue,
      showCalendarPanel: false,
      showDailyNotesPanel: false,
    });
    useLayoutStore.setState({ showRight: true });
    useViewStore.getState().closePanel('showVersionHistory');
  };

  const iconCls = 'w-[17px] h-[17px]';

  return (
    <aside
      className="flex flex-col items-center gap-1 bg-app-panel h-full border-r border-app-border"
      style={{
        paddingTop: platformService.isMacOS() ? '0.5rem' : '0.75rem',
        paddingBottom: '0.75rem',
      }}
    >
      {/* Logo / Menu Toggle */}
      <button
        onClick={toggleLeft}
        title={showLeft ? 'Hide sidebar' : 'Show sidebar'}
        className="ribbon-button mb-2"
      >
        <LokusLogo className="w-5 h-5" />
      </button>

      {/* Activity Bar */}
      <div className="w-full pt-2 flex flex-col gap-1">
        {/* Explorer */}
        <button
          onClick={handleExplorerClick}
          title="Explorer"
          data-tour="files"
          className={`ribbon-button ${isExplorer ? 'active' : ''}`}
        >
          <FolderOpen className={iconCls} strokeWidth={1.5} />
        </button>

        {featureFlags.enable_team_notes_foundation && (
          <button
            onClick={handleTeamsClick}
            title="Teams"
            aria-label="Teams"
            className={`ribbon-button ${isTeamsActive ? 'active' : ''}`}
          >
            <Users className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Task Board (Kanban) */}
        {featureFlags.enable_kanban && uiVisibility.sidebar_kanban && (
          <button
            onClick={handleKanbanClick}
            title="Task Board"
            className={`ribbon-button ${isKanbanActive ? 'active' : ''}`}
          >
            <LayoutGrid className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Extensions (Plugins) */}
        {featureFlags.enable_plugins && uiVisibility.sidebar_plugins && import.meta.env.VITE_APPSTORE !== 'true' && (
          <button
            onClick={handlePluginsClick}
            title="Extensions"
            className={`ribbon-button ${isPluginsActive ? 'active' : ''}`}
          >
            <Puzzle className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Bases */}
        {featureFlags.enable_bases && uiVisibility.sidebar_bases && (
          <button
            onClick={() => {
              useViewStore.getState().switchView('editor');
              const { focusedGroupId } = useEditorGroupStore.getState();
              if (focusedGroupId) {
                useEditorGroupStore.getState().addTab(focusedGroupId, { path: '__bases__', name: 'Bases' }, true);
              }
            }}
            title="Bases"
            data-tour="bases"
            className={`ribbon-button ${isBasesActive ? 'active' : ''}`}
          >
            <Database className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Graph View */}
        {featureFlags.enable_graph && uiVisibility.sidebar_graph && (
          <button
            onClick={() => {
              useViewStore.getState().switchView('editor');
              const { focusedGroupId } = useEditorGroupStore.getState();
              if (focusedGroupId) {
                useEditorGroupStore.getState().addTab(focusedGroupId, { path: '__graph__', name: 'Graph' }, true);
              }
            }}
            title="Graph View"
            data-tour="graph"
            className={`ribbon-button ${showGraphView ? 'active' : ''}`}
          >
            <Network className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Daily Notes */}
        {featureFlags.enable_daily_notes && uiVisibility.sidebar_daily_notes && (
          <button
            onClick={handleDailyNotesClick}
            title="Daily Notes"
            data-tour="daily-notes"
            className={`ribbon-button ${showDailyNotesPanel ? 'active' : ''}`}
          >
            <Calendar className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Calendar */}
        {featureFlags.enable_calendar && (
          <button
            onClick={handleCalendarClick}
            title="Calendar"
            className={`ribbon-button ${showCalendarPanel ? 'active' : ''}`}
          >
            <CalendarDays className={iconCls} strokeWidth={1.5} />
          </button>
        )}

        {/* Agenda */}
        {featureFlags.enable_calendar && (
          <button
            onClick={handleAgendaClick}
            title="Agenda"
            className={`ribbon-button ${showAgendaPanel ? 'active' : ''}`}
          >
            <ListTodo className={iconCls} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </aside>
  );
}
