import { FolderOpen, LayoutGrid, Puzzle, Database, Network, Calendar, CalendarDays } from 'lucide-react';
import LokusLogo from '../../components/LokusLogo.jsx';
import { useLayoutStore } from '../../stores/layout';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useUIVisibility, useFeatureFlags } from '../../contexts/RemoteConfigContext';
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

  // View state from useViewStore
  const currentView = useViewStore((s) => s.currentView);
  const showDailyNotesPanel = useViewStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useViewStore((s) => s.showCalendarPanel);

  // Derive boolean view flags from currentView
  const showKanban = currentView === 'kanban';
  const showPlugins = currentView === 'marketplace';

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

  const isExplorer = !showKanban && !showPlugins && !showBases && !showGraphView && showLeft;

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

  const handleDailyNotesClick = () => {
    const nextValue = !useViewStore.getState().showDailyNotesPanel;
    useViewStore.setState({ showDailyNotesPanel: nextValue, showCalendarPanel: false });
    useLayoutStore.setState({ showRight: true });
    useViewStore.getState().closePanel('showVersionHistory');
  };

  const handleCalendarClick = () => {
    const nextValue = !useViewStore.getState().showCalendarPanel;
    useViewStore.setState({ showCalendarPanel: nextValue, showDailyNotesPanel: false });
    useLayoutStore.setState({ showRight: true });
    useViewStore.getState().closePanel('showVersionHistory');
  };

  return (
    <aside
      className="flex flex-col items-center gap-1 border-r border-app-border bg-app-panel h-full"
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
          if (icon) icon.style.color = showLeft ? 'rgb(var(--accent))' : 'rgb(var(--text))';
        }}
      >
        <LokusLogo className="w-6 h-6" style={{ color: showLeft ? 'rgb(var(--accent))' : 'rgb(var(--text))' }} />
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
        {featureFlags.enable_kanban && uiVisibility.sidebar_kanban && (
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
        {featureFlags.enable_daily_notes && uiVisibility.sidebar_daily_notes && (
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
        {featureFlags.enable_calendar && <button
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
        </button>}
      </div>
    </aside>
  );
}
