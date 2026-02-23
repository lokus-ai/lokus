import { useLayoutStore } from '../../stores/layout';
import { useWorkspaceStore } from '../../stores/workspace';
import DocumentOutline from '../../components/DocumentOutline.jsx';
import BacklinksPanel from '../BacklinksPanel.jsx';
import GraphSidebar from '../../components/GraphSidebar.jsx';
import VersionHistoryPanel from '../../components/VersionHistoryPanel.jsx';
import { DailyNotesPanel } from '../../components/DailyNotes/index.js';
import { CalendarWidget } from '../../components/Calendar/index.js';
import { PanelRegion } from '../../plugins/ui/PanelManager.jsx';
import { PANEL_POSITIONS } from '../../plugins/api/UIAPI.js';
import { EditorModeSwitcher } from '../../features/editor';

/**
 * RightSidebar — document outline, backlinks, graph sidebar, version history,
 * daily notes panel, and calendar widget.
 *
 * Reads focused group's active tab from useEditorGroupStore.
 * Panel visibility comes from useViewStore (showVersionHistory, etc.) and
 * legacy flags from useWorkspaceStore during the migration.
 */
export default function RightSidebar({
  workspacePath,
  onFileOpen,
  onOpenDailyNoteByDate,
  onReloadCurrentFile,
  editorRef,
  graphProcessorRef,
}) {
  const showRight = useLayoutStore((s) => s.showRight);
  const rightW = useLayoutStore((s) => s.rightW);

  // Panel visibility flags
  const showVersionHistory = useWorkspaceStore((s) => s.showVersionHistory);
  const versionRefreshKey = useWorkspaceStore((s) => s.versionRefreshKey);
  const showDailyNotesPanel = useWorkspaceStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useWorkspaceStore((s) => s.showCalendarPanel);
  const currentDailyNoteDate = useWorkspaceStore((s) => s.currentDailyNoteDate);

  // Graph sidebar data (still on workspace store during migration)
  const graphSidebarData = useWorkspaceStore((s) => s.graphSidebarData);
  const activeFile = useWorkspaceStore((s) => s.activeFile);

  if (!showRight) return null;

  const handleOpenCalendarView = () => {
    const calendarPath = '__calendar__';
    const calendarName = 'Calendar';
    const MAX_OPEN_TABS = 10;

    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter((t) => t.path !== calendarPath);
      newTabs.unshift({ path: calendarPath, name: calendarName });
      if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: calendarPath });
  };

  const handleOpenCalendarSettings = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_preferences_window', {
        workspacePath,
        section: 'Connections',
      });
    } catch (e) {
      console.error('Failed to open preferences:', e);
    }
  };

  return (
    <aside
      className="overflow-y-auto flex flex-col bg-app-panel border-l border-app-border"
      style={{ width: `${rightW}px` }}
    >
      <div className="flex-1 overflow-hidden">
        {showVersionHistory ? (
          <VersionHistoryPanel
            key={`version-${activeFile}-${versionRefreshKey}`}
            workspacePath={workspacePath}
            filePath={activeFile}
            onClose={() => useWorkspaceStore.getState().closePanel('showVersionHistory')}
            onRestore={onReloadCurrentFile}
          />
        ) : showDailyNotesPanel ? (
          <DailyNotesPanel
            workspacePath={workspacePath}
            onOpenDailyNote={onOpenDailyNoteByDate}
            currentDate={currentDailyNoteDate}
          />
        ) : showCalendarPanel ? (
          <CalendarWidget
            onOpenCalendarView={handleOpenCalendarView}
            onOpenSettings={handleOpenCalendarSettings}
          />
        ) : activeFile === '__graph__' ? (
          <GraphSidebar
            selectedNodes={graphSidebarData?.selectedNodes}
            hoveredNode={graphSidebarData?.hoveredNode}
            graphData={graphSidebarData?.graphData}
            stats={graphSidebarData?.stats}
            config={graphSidebarData?.graphConfig}
            onConfigChange={graphSidebarData?.onConfigChange}
            onNodeClick={(node) => {
              if (graphSidebarData?.onFocusNode) {
                graphSidebarData.onFocusNode(node);
              }
            }}
            isAnimating={graphSidebarData?.isAnimating}
            animationSpeed={graphSidebarData?.animationSpeed}
            onToggleAnimation={graphSidebarData?.onToggleAnimation}
            onAnimationSpeedChange={graphSidebarData?.onAnimationSpeedChange}
          />
        ) : (
          <>
            {/* Editor Mode Switcher */}
            <EditorModeSwitcher />

            {/* Document Outline */}
            <div
              style={{
                minHeight: '200px',
                maxHeight: '30%',
                overflowY: 'auto',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <DocumentOutline editor={editorRef?.current?.editor} />
            </div>

            {/* Backlinks Panel */}
            <div style={{ minHeight: '200px', flex: 1, overflowY: 'auto' }}>
              <BacklinksPanel
                graphData={graphProcessorRef?.current?.getGraphDatabase()}
                currentFile={activeFile}
                onOpenFile={onFileOpen}
              />
            </div>
          </>
        )}
      </div>

      {/* Plugin panels registered to the right sidebar region */}
      <PanelRegion
        position={PANEL_POSITIONS.SIDEBAR_RIGHT}
        className="border-t border-app-border"
      />
    </aside>
  );
}
