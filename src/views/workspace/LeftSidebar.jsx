import { RefreshCw, FoldVertical } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFileTreeStore } from '../../stores/fileTree';
import { useLayoutStore } from '../../stores/layout';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { FileTreeView } from '../../features/file-tree';
import PluginSettings from '../PluginSettings.jsx';
import BasesView from '../../bases/BasesView.jsx';
import KanbanList from '../../components/KanbanList.jsx';
import { DailyNotesPanel } from '../../components/DailyNotes/index.js';
import { CalendarWidget } from '../../components/Calendar/index.js';
import { isDesktop } from '../../platform/index.js';
import { toast } from '../../components/ui/enhanced-toast';
import { formatAccelerator } from '../../core/shortcuts/registry.js';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../../components/ui/context-menu.jsx';

/**
 * LeftSidebar — the resizable left panel.
 *
 * Shows the file explorer by default, and conditionally renders
 * DailyNotesPanel, CalendarWidget, KanbanList, PluginSettings, or BasesView
 * based on the active view flags from the workspace store.
 */
export default function LeftSidebar({
  workspacePath,
  filteredFileTree,
  onFileOpen,
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onOpenDailyNote,
  onOpenDailyNoteByDate,
  onRefreshFiles,
  onConfirmCreate,
  onCheckReferences,
  onViewHistory,
  onOpenPluginDetail,
  onCreateKanban,
  onKanbanBoardAction,
  editorGroupsUpdateTabPath,
}) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const featureFlags = useFeatureFlags();

  // View-specific flags (still on useWorkspaceStore during migration)
  const showKanban = useWorkspaceStore((s) => s.showKanban);
  const showPlugins = useWorkspaceStore((s) => s.showPlugins);
  const showBases = useWorkspaceStore((s) => s.showBases);
  const showGraphView = useWorkspaceStore((s) => s.showGraphView);
  const showDailyNotesPanel = useWorkspaceStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useWorkspaceStore((s) => s.showCalendarPanel);
  const currentDailyNoteDate = useWorkspaceStore((s) => s.currentDailyNoteDate);
  const activeFile = useWorkspaceStore((s) => s.activeFile);

  // File tree state from the dedicated fileTree store
  const selectedPath = useFileTreeStore((s) => s.selectedPath);
  const expandedFolders = useFileTreeStore((s) => s.expandedFolders);
  const creatingItem = useFileTreeStore((s) => s.creatingItem);
  const renamingPath = useFileTreeStore((s) => s.renamingPath);
  const keymap = useFileTreeStore((s) => s.keymap);
  const isExternalDragActive = useFileTreeStore((s) => s.isExternalDragActive);
  const hoveredFolder = useFileTreeStore((s) => s.hoveredFolder);

  if (!showLeft) return null;

  const toggleFolder = (path) => useFileTreeStore.getState().toggleFolder(path);
  const closeAllFolders = () => useFileTreeStore.getState().closeAllFolders();

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

  // Plugins panel
  if (featureFlags.enable_plugins && showPlugins) {
    return (
      <aside className="overflow-y-auto flex flex-col">
        <div className="flex-1 overflow-hidden">
          <PluginSettings onOpenPluginDetail={onOpenPluginDetail} />
        </div>
      </aside>
    );
  }

  // Bases panel
  if (showBases) {
    return (
      <aside className="overflow-y-auto flex flex-col">
        <div className="flex-1 overflow-hidden">
          <BasesView isVisible={true} onFileOpen={onFileOpen} />
        </div>
      </aside>
    );
  }

  // Kanban list panel
  if (showKanban) {
    return (
      <aside className="overflow-y-auto flex flex-col">
        <div className="flex-1 overflow-hidden">
          <KanbanList
            workspacePath={workspacePath}
            onBoardOpen={onFileOpen}
            onCreateBoard={onCreateKanban}
            onBoardAction={onKanbanBoardAction}
          />
        </div>
      </aside>
    );
  }

  // Graph placeholder panel
  if (showGraphView) {
    return (
      <aside className="overflow-y-auto flex flex-col">
        <div className="flex-1 overflow-hidden p-4">
          <div className="text-center mb-4">
            <button
              onClick={() => useWorkspaceStore.setState({ activeFile: '__graph__' })}
              className="obsidian-button primary w-full"
            >
              Open Graph View
            </button>
          </div>
          <div className="text-sm text-app-muted">
            <p className="mb-2">
              The graph view shows the connections between your notes.
            </p>
            {isDesktop() && (
              <p>
                Use{' '}
                <kbd className="px-1 py-0.5 text-xs bg-app-panel rounded">
                  Cmd+Shift+G
                </kbd>{' '}
                to quickly open the graph view.
              </p>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // Daily notes panel
  if (showDailyNotesPanel) {
    return (
      <aside className="overflow-y-auto flex flex-col">
        <div className="flex-1 overflow-hidden">
          <DailyNotesPanel
            workspacePath={workspacePath}
            onOpenDailyNote={onOpenDailyNoteByDate}
            currentDate={currentDailyNoteDate}
          />
        </div>
      </aside>
    );
  }

  // Calendar widget panel
  if (showCalendarPanel) {
    return (
      <aside className="overflow-y-auto flex flex-col">
        <div className="flex-1 overflow-hidden">
          <CalendarWidget
            onOpenCalendarView={handleOpenCalendarView}
            onOpenSettings={handleOpenCalendarSettings}
          />
        </div>
      </aside>
    );
  }

  // Default: Explorer / file tree
  return (
    <aside className="overflow-y-auto flex flex-col">
      {/* Explorer Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefreshFiles}
            className="obsidian-button icon-only small"
            title="Reload Files"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={closeAllFolders}
            className="obsidian-button icon-only small"
            title="Collapse All Folders"
          >
            <FoldVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="p-2 flex-1 overflow-y-auto">
            <FileTreeView
              entries={filteredFileTree}
              onFileClick={onFileOpen}
              activeFile={activeFile}
              onRefresh={onRefreshFiles}
              data-testid="file-tree"
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              creatingItem={creatingItem}
              onCreateConfirm={onConfirmCreate}
              keymap={keymap}
              selectedPath={selectedPath}
              setSelectedPath={(x) => useFileTreeStore.getState().selectEntry(x)}
              renamingPath={renamingPath}
              setRenamingPath={(x) => useFileTreeStore.setState({ renamingPath: x })}
              onViewHistory={onViewHistory}
              setTagModalFile={(x) => useWorkspaceStore.setState({ tagModalFile: x })}
              setShowTagModal={(v) =>
                v
                  ? useWorkspaceStore.getState().openPanel('showTagModal')
                  : useWorkspaceStore.getState().closePanel('showTagModal')
              }
              setUseSplitView={(x) => useWorkspaceStore.setState({ useSplitView: x })}
              setRightPaneFile={(x) => useWorkspaceStore.setState({ rightPaneFile: x })}
              setRightPaneTitle={(x) => useWorkspaceStore.setState({ rightPaneTitle: x })}
              setRightPaneContent={(x) => useWorkspaceStore.setState({ rightPaneContent: x })}
              isExternalDragActive={isExternalDragActive}
              hoveredFolder={hoveredFolder}
              setHoveredFolder={(x) => useFileTreeStore.getState().setHoveredFolder(x)}
              toast={toast}
              onCheckReferences={onCheckReferences}
              workspacePath={workspacePath}
              onUpdateTabPath={editorGroupsUpdateTabPath}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onCreateFile}>
            New File
            {isDesktop() && (
              <span className="ml-auto text-xs text-app-muted">
                {formatAccelerator(keymap['new-file'])}
              </span>
            )}
          </ContextMenuItem>
          {featureFlags.enable_canvas && (
            <ContextMenuItem onClick={onCreateCanvas}>New Canvas</ContextMenuItem>
          )}
          <ContextMenuItem onClick={onCreateFolder}>
            New Folder
            {isDesktop() && (
              <span className="ml-auto text-xs text-app-muted">
                {formatAccelerator(keymap['new-folder'])}
              </span>
            )}
          </ContextMenuItem>
          <ContextMenuItem onClick={onOpenDailyNote}>
            Open Daily Note
            {isDesktop() && (
              <span className="ml-auto text-xs text-app-muted">
                {formatAccelerator(keymap['daily-note'])}
              </span>
            )}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onRefreshFiles}>Refresh</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </aside>
  );
}
