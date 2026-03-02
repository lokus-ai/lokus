import { useLayoutStore } from '../../stores/layout';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { getEditor } from '../../stores/editorRegistry';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
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
 * useLayoutStore for sidebar dimensions.
 */
export default function RightSidebar({
  workspacePath,
  onFileOpen,
  onOpenDailyNoteByDate,
  onReloadCurrentFile,
  graphProcessorRef,
}) {
  const showRight = useLayoutStore((s) => s.showRight);
  const rightW = useLayoutStore((s) => s.rightW);

  // Panel visibility flags from useViewStore
  const showVersionHistory = useViewStore((s) => s.showVersionHistory);
  const versionRefreshKey = useViewStore((s) => s.versionRefreshKey);
  const showDailyNotesPanel = useViewStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useViewStore((s) => s.showCalendarPanel);
  const currentDailyNoteDate = useViewStore((s) => s.currentDailyNoteDate);

  // Focused group id for registry lookup
  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);

  // Graph sidebar data from useEditorGroupStore
  const graphSidebarData = useEditorGroupStore((s) => s.graphSidebarData);

  // Active file from the focused editor group
  const activeFile = useEditorGroupStore((s) => {
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

  const featureFlags = useFeatureFlags();

  if (!showRight) return null;

  const handleOpenCalendarView = () => {
    const calendarPath = '__calendar__';
    const calendarName = 'Calendar';
    const { focusedGroupId } = useEditorGroupStore.getState();
    if (focusedGroupId) {
      useEditorGroupStore.getState().addTab(
        focusedGroupId,
        { path: calendarPath, name: calendarName },
        true
      );
    }
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
      className="h-full overflow-y-auto flex flex-col bg-app-bg border-l border-app-border"
    >
      <div className="flex-1 overflow-hidden">
        {featureFlags.enable_version_history && showVersionHistory ? (
          <VersionHistoryPanel
            key={`version-${activeFile}-${versionRefreshKey}`}
            workspacePath={workspacePath}
            filePath={activeFile}
            onClose={() => useViewStore.getState().closePanel('showVersionHistory')}
            onRestore={onReloadCurrentFile}
          />
        ) : featureFlags.enable_daily_notes && showDailyNotesPanel ? (
          <DailyNotesPanel
            workspacePath={workspacePath}
            onOpenDailyNote={onOpenDailyNoteByDate}
            currentDate={currentDailyNoteDate}
          />
        ) : featureFlags.enable_calendar && showCalendarPanel ? (
          <CalendarWidget
            onOpenCalendarView={handleOpenCalendarView}
            onOpenSettings={handleOpenCalendarSettings}
          />
        ) : featureFlags.enable_graph && activeFile === '__graph__' ? (
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
              <DocumentOutline editor={getEditor(focusedGroupId)} />
            </div>

            {/* Backlinks Panel */}
            {featureFlags.enable_backlinks && (
              <div style={{ minHeight: '200px', flex: 1, overflowY: 'auto' }}>
                <BacklinksPanel
                  graphData={graphProcessorRef?.current?.getGraphDatabase()}
                  currentFile={activeFile}
                  onOpenFile={onFileOpen}
                />
              </div>
            )}
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
