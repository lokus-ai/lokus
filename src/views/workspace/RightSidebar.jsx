import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import DocumentOutline from '../../components/DocumentOutline';
import BacklinksPanel from '../BacklinksPanel';
import GraphSidebar from '../../components/GraphSidebar';
import VersionHistoryPanel from '../../components/VersionHistoryPanel';
import { DailyNotesPanel } from '../../components/DailyNotes/index';
import { CalendarWidget } from '../../components/Calendar/index';

/**
 * RightSidebar — outline, backlinks, graph sidebar, version history.
 * Reads from useEditorGroupStore for active file context.
 */
export default function RightSidebar({ workspacePath, onFileOpen, onOpenDailyNoteByDate }) {
  const showRight = useLayoutStore((s) => s.showRight);
  const showVersionHistory = useViewStore((s) => s.showVersionHistory);
  const versionHistoryFile = useViewStore((s) => s.versionHistoryFile);
  const showDailyNotesPanel = useViewStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useViewStore((s) => s.showCalendarPanel);
  const currentView = useViewStore((s) => s.currentView);

  const focusedGroup = useEditorGroupStore.getState().getFocusedGroup();
  const activeFile = focusedGroup?.activeTab || null;

  if (!showRight) return null;

  return (
    <aside className="overflow-y-auto flex flex-col border-l border-app-border bg-app-panel">
      {showVersionHistory && versionHistoryFile ? (
        <VersionHistoryPanel
          filePath={versionHistoryFile}
          workspacePath={workspacePath}
          onClose={() => useViewStore.getState().closePanel('versionHistory')}
        />
      ) : showDailyNotesPanel ? (
        <DailyNotesPanel
          workspacePath={workspacePath}
          onOpenNote={onFileOpen}
          onOpenByDate={onOpenDailyNoteByDate}
        />
      ) : showCalendarPanel ? (
        <CalendarWidget
          workspacePath={workspacePath}
          onOpenNote={onFileOpen}
        />
      ) : currentView === 'graph' ? (
        <GraphSidebar />
      ) : (
        <>
          {activeFile && (
            <>
              <DocumentOutline />
              <BacklinksPanel
                filePath={activeFile}
                workspacePath={workspacePath}
                onFileOpen={onFileOpen}
              />
            </>
          )}
        </>
      )}
    </aside>
  );
}
