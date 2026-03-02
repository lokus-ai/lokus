import { RefreshCw, FoldVertical } from 'lucide-react';
import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useFileTreeStore } from '../../stores/fileTree';
import { useLayoutStore } from '../../stores/layout';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { FileTreeView } from '../../features/file-tree';
import PluginSettings from '../PluginSettings.jsx';
import KanbanList from '../../components/KanbanList.jsx';
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
  editorGroupsUpdateTabPath,
}) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const featureFlags = useFeatureFlags();

  // View state from useViewStore
  const currentView = useViewStore((s) => s.currentView);

  // Derive boolean view flags from currentView
  const showKanban = currentView === 'kanban';
  const showPlugins = currentView === 'marketplace';

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

  // Plugins panel
  if (featureFlags.enable_plugins && showPlugins) {
    return (
      <aside className="h-full overflow-y-auto flex flex-col bg-app-bg border-r border-app-border">
        <div className="flex-1 overflow-hidden">
          <PluginSettings onOpenPluginDetail={onOpenPluginDetail} />
        </div>
      </aside>
    );
  }

  // Kanban list panel
  if (featureFlags.enable_kanban && showKanban) {
    return (
      <aside className="h-full overflow-y-auto flex flex-col bg-app-bg border-r border-app-border">
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

  // Default: Explorer / file tree
  return (
    <aside className="h-full overflow-y-auto flex flex-col bg-app-bg border-r border-app-border">
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
              setTagModalFile={(x) => useViewStore.setState({ tagModalFile: x })}
              setShowTagModal={(v) =>
                v
                  ? useViewStore.getState().openPanel('showTagModal')
                  : useViewStore.getState().closePanel('showTagModal')
              }
              setUseSplitView={(x) => {
                const { focusedGroupId } = useEditorGroupStore.getState();
                if (x && focusedGroupId) {
                  useEditorGroupStore.getState().splitGroup(focusedGroupId, 'horizontal');
                }
              }}
              setRightPaneFile={(x) => {
                const { focusedGroupId, getAllGroups } = useEditorGroupStore.getState();
                const groups = getAllGroups();
                const rightGroup = groups.find((g) => g.id !== focusedGroupId) ?? null;
                if (rightGroup && x) {
                  useEditorGroupStore.getState().addTab(rightGroup.id, { path: x, name: x.split('/').pop() || x }, true);
                }
              }}
              setRightPaneTitle={() => {}}
              setRightPaneContent={() => {}}
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
    </aside>
  );
}
