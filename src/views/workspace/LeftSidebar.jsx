import { useEffect } from 'react';
import { RefreshCw, FoldVertical, FilePlus, FolderPlus, ChevronsUpDown, Settings } from 'lucide-react';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useFileTreeStore } from '../../stores/fileTree';
import { useLayoutStore } from '../../stores/layout';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { FileTreeView } from '../../features/file-tree';
import PluginSettings from '../PluginSettings.jsx';
import KanbanList from '../../components/KanbanList.jsx';
import TeamsWorkspacePanel from '../../components/team/TeamsWorkspacePanel.jsx';
import { toast } from '../../components/ui/enhanced-toast';
import { formatAccelerator } from '../../core/shortcuts/registry.js';
import { isDesktop } from '../../platform/index.js';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../../components/ui/context-menu.jsx';

// These only ever reach into a store with getState(), so they have no reason to
// be re-created per render. As inline arrows they handed the file tree a fresh
// identity for every prop on every render, which defeated memoization of the
// rows underneath it.
const noop = () => {};

const setRenamingPath = (path) => useFileTreeStore.setState({ renamingPath: path });

const setTagModalFile = (file) => useViewStore.setState({ tagModalFile: file });

const setUseSplitView = (enabled) => {
  const { focusedGroupId } = useEditorGroupStore.getState();
  if (enabled && focusedGroupId) {
    useEditorGroupStore.getState().splitGroup(focusedGroupId, 'horizontal');
  }
};

const setRightPaneFile = (path) => {
  const { focusedGroupId, getAllGroups } = useEditorGroupStore.getState();
  const rightGroup = getAllGroups().find((g) => g.id !== focusedGroupId) ?? null;
  if (rightGroup && path) {
    useEditorGroupStore.getState().addTab(
      rightGroup.id,
      { path, name: path.split('/').pop() || path },
      true,
    );
  }
};

/**
 * LeftSidebar — the resizable left panel.
 *
 * Shows the file explorer by default, and conditionally renders
 * KanbanList or PluginSettings based on the active view.
 * Daily Notes and Calendar render only in the right sidebar.
 * Bases and Graph render as tabs in EditorGroup.
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
  onCreateGraph,
  editorGroupsUpdateTabPath,
}) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const featureFlags = useFeatureFlags();

  // View state from useViewStore
  const currentView = useViewStore((s) => s.currentView);

  // Derive boolean view flags from currentView
  const showKanban = currentView === 'kanban';
  const showPlugins = currentView === 'marketplace';
  const showTeams = currentView === 'teams';

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

  // Publish the active tab into the file-tree store so rows can read their own
  // highlight with a per-path selector instead of taking activeFile as a prop.
  useEffect(() => {
    useFileTreeStore.getState().setActivePath(activeFile);
  }, [activeFile]);

  // File tree state from the dedicated fileTree store.
  // Only what THIS component renders is subscribed to here — selection,
  // expansion, rename and hover are read by the individual rows instead, so
  // touching them no longer re-renders the sidebar and the tree beneath it.
  const creatingItem = useFileTreeStore((s) => s.creatingItem);
  const keymap = useFileTreeStore((s) => s.keymap);
  const isExternalDragActive = useFileTreeStore((s) => s.isExternalDragActive);

  if (!showLeft) return null;

  const toggleFolder = (path) => useFileTreeStore.getState().toggleFolder(path);
  const closeAllFolders = () => useFileTreeStore.getState().closeAllFolders();

  // Plugins panel
  if (featureFlags.enable_plugins && showPlugins) {
    return (
      <aside className="h-full overflow-y-auto flex flex-col bg-app-panel border-r border-app-border">
        <div className="flex-1 overflow-hidden">
          <PluginSettings onOpenPluginDetail={onOpenPluginDetail} />
        </div>
      </aside>
    );
  }

  // Kanban list panel
  if (featureFlags.enable_kanban && showKanban) {
    return (
      <aside className="h-full overflow-y-auto flex flex-col bg-app-panel border-r border-app-border">
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

  if (featureFlags.enable_team_notes_foundation && showTeams) {
    return (
      <TeamsWorkspacePanel
        workspacePath={workspacePath}
        onFileOpen={onFileOpen}
      />
    );
  }

  // Default: Explorer / file tree
  return (
    <aside className="h-full overflow-hidden flex flex-col bg-app-panel border-r border-app-border">
      {/* Explorer Header — icon actions only; the titlebar's bottom
          border is the separator line above this row */}
      <div className="h-[34px] px-2 flex items-center justify-end gap-0.5 flex-none">
        <button
          onClick={onCreateFile}
          className="obsidian-button icon-only small"
          title="New File"
        >
          <FilePlus className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={onCreateFolder}
          className="obsidian-button icon-only small"
          title="New Folder"
        >
          <FolderPlus className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={onRefreshFiles}
          className="obsidian-button icon-only small"
          title="Reload Files"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={closeAllFolders}
          className="obsidian-button icon-only small"
          title="Collapse All Folders"
        >
          <FoldVertical className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="px-2 pt-1 pb-2 flex-1 overflow-y-auto">
            <FileTreeView
              entries={filteredFileTree}
              onFileClick={onFileOpen}
              activeFile={activeFile}
              onRefresh={onRefreshFiles}
              data-testid="file-tree"
              toggleFolder={toggleFolder}
              creatingItem={creatingItem}
              onCreateConfirm={onConfirmCreate}
              setRenamingPath={setRenamingPath}
              onViewHistory={onViewHistory}
              setTagModalFile={setTagModalFile}
              setUseSplitView={setUseSplitView}
              setRightPaneFile={setRightPaneFile}
              setRightPaneTitle={noop}
              setRightPaneContent={noop}
              isExternalDragActive={isExternalDragActive}
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
          <ContextMenuItem onClick={onCreateGraph}>New Graph</ContextMenuItem>
          <ContextMenuItem onClick={onCreateFolder}>
            New Folder
            {isDesktop() && (
              <span className="ml-auto text-xs text-app-muted">
                {formatAccelerator(keymap['new-folder'])}
              </span>
            )}
          </ContextMenuItem>
          {featureFlags.enable_daily_notes && (
            <ContextMenuItem onClick={onOpenDailyNote}>
              Open Daily Note
              {isDesktop() && (
                <span className="ml-auto text-xs text-app-muted">
                  {formatAccelerator(keymap['daily-note'])}
                </span>
              )}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onRefreshFiles}>Refresh</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Vault footer — workspace name + preferences (Vellum) */}
      <div className="h-12 px-3 flex items-center gap-2 border-t border-app-border flex-none">
        <ChevronsUpDown className="w-4 h-4 text-app-muted flex-none" />
        <span className="text-[13.5px] font-semibold text-app-text truncate">
          {workspacePath?.split('/').filter(Boolean).pop() ?? 'Workspace'}
        </span>
        <button
          onClick={async () => {
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              await invoke('open_preferences_window', { workspacePath });
            } catch (e) {
              console.error('Failed to open preferences:', e);
            }
          }}
          className="obsidian-button icon-only small ml-auto"
          title="Settings"
        >
          <Settings className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}
