import { useLayoutStore } from '../../stores/layout';
import { beginDragGuard } from '../../features/layout/dragGuard';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { getEditor } from '../../stores/editorRegistry';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { useState, useRef } from 'react';
import { Network } from 'lucide-react';
import GraphPanel from '../../components/graph2/GraphPanel.jsx';
import { getGraphEngine } from '../../core/graph2/graphEngine.js';
import DocumentOutline from '../../components/DocumentOutline.jsx';
import BacklinksPanel from '../BacklinksPanel.jsx';
import VersionHistoryPanel from '../../components/VersionHistoryPanel.jsx';
import { DailyNotesPanel } from '../../components/DailyNotes/index.js';
import { AgendaPanel, CalendarWidget } from '../../components/Calendar/index.js';
import { PluginPanelsRegion } from '../../features/plugin-v3/PluginPanels.jsx';

/**
 * RightSidebar — graph preview, document outline, backlinks, version history,
 * daily notes panel, and calendar widget.
 *
 * Reads focused group's active tab from useEditorGroupStore.
 * Panel visibility comes from useViewStore (showVersionHistory, etc.) and
 * useLayoutStore for sidebar dimensions.
 *
 * Graph SETTINGS are not here — they live in the full `__graph__` tab.
 */
export default function RightSidebar({
  workspacePath,
  onFileOpen,
  onOpenDailyNoteByDate,
  onReloadCurrentFile,
}) {
  const showRight = useLayoutStore((s) => s.showRight);
  const rightW = useLayoutStore((s) => s.rightW);

  // Panel visibility flags from useViewStore
  const showVersionHistory = useViewStore((s) => s.showVersionHistory);
  const versionRefreshKey = useViewStore((s) => s.versionRefreshKey);
  const showDailyNotesPanel = useViewStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useViewStore((s) => s.showCalendarPanel);
  const showAgendaPanel = useViewStore((s) => s.showAgendaPanel);
  const currentDailyNoteDate = useViewStore((s) => s.currentDailyNoteDate);

  // Focused group id for registry lookup
  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);

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

  // Special tabs (`__graph__`, `__bases__`, …) are not graph nodes, so the
  // preview keeps showing the last real file the engine focused.
  const graphFocusPath = activeFile?.startsWith('__')
    ? getGraphEngine().getFocus()
    : activeFile;

  // Resizable graph split (default 50/50) — drag the handle between the
  // graph and the panels below.
  const [graphPct, setGraphPct] = useState(50);
  const asideRef = useRef(null);
  const startGraphResize = (e) => {
    e.preventDefault();
    const aside = asideRef.current;
    if (!aside) return;
    const rect = aside.getBoundingClientRect();
    const endGuard = beginDragGuard('row-resize');
    const onMove = (ev) => {
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setGraphPct(Math.max(20, Math.min(80, pct)));
    };
    const onUp = () => {
      endGuard();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (!showRight) return null;

  const handleOpenCalendarView = (target = null) => {
    useViewStore.setState({
      currentView: 'calendar',
      calendarNavigationTarget: target,
    });
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
      ref={asideRef}
      className="h-full overflow-y-auto flex flex-col bg-app-panel border-l border-app-border"
    >
      <div className="flex-1 overflow-y-auto">
        {featureFlags.enable_version_history && showVersionHistory ? (
          <VersionHistoryPanel
            key={`version-${activeFile}-${versionRefreshKey}`}
            workspacePath={workspacePath}
            filePath={activeFile}
            onClose={() => useViewStore.getState().closePanel('showVersionHistory')}
            onRestore={onReloadCurrentFile}
          />
        ) : featureFlags.enable_calendar && showAgendaPanel ? (
          <AgendaPanel
            workspacePath={workspacePath}
            onFileOpen={onFileOpen}
            onOpenCalendarView={handleOpenCalendarView}
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
        ) : (
          <>
            {/* Graph — resizable top half of the sidebar */}
            <div className="flex-none border-b border-app-border flex flex-col" style={{ height: `${graphPct}%` }}>
              <div className="h-[38px] px-3 border-b border-app-border flex items-center flex-none">
                <h3 className="text-[13px] font-semibold flex items-center gap-2 text-app-text">
                  <Network className="w-4 h-4" strokeWidth={1.5} />
                  Graph
                </h3>
              </div>
              <div className="flex-1 min-h-0">
                <GraphPanel
                  workspacePath={workspacePath}
                  focusPath={graphFocusPath}
                  onFileClick={onFileOpen}
                  hideHeader
                />
              </div>
            </div>

            {/* Drag handle — resize the graph/outline split */}
            <div
              onMouseDown={startGraphResize}
              className="h-[5px] flex-none cursor-row-resize hover:bg-app-panel-secondary transition-colors"
            />

            {/* Document Outline */}
            <div
              style={{
                minHeight: '200px',
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
                  workspacePath={workspacePath}
                  currentFile={activeFile}
                  onOpenFile={onFileOpen}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Plugin system v3 panels */}
      <PluginPanelsRegion position="right" />
    </aside>
  );
}
