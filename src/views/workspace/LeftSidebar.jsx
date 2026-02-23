import React from 'react';
import { useFileTreeStore } from '../../stores/fileTree';
import { useLayoutStore } from '../../stores/layout';
import { FileTreeView } from '../../features/file-tree';
import { RefreshCw, FoldVertical } from 'lucide-react';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from '../../components/ui/context-menu';
import { formatAccelerator } from '../../core/shortcuts/registry';
import { isDesktop } from '../../platform/index';

/**
 * LeftSidebar — file tree explorer panel.
 * Reads from useFileTreeStore for all file tree state.
 */
export default function LeftSidebar({
  workspacePath,
  filteredFileTree,
  onFileOpen,
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onOpenDailyNote,
  onRefreshFiles,
  onConfirmCreate,
  onCheckReferences,
  onViewHistory,
}) {
  const showLeft = useLayoutStore((s) => s.showLeft);
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

  return (
    <aside className="overflow-y-auto flex flex-col">
      {/* Explorer Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">Explorer</span>
        <div className="flex items-center gap-1">
          <button onClick={onRefreshFiles} className="obsidian-button icon-only small" title="Reload Files">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={closeAllFolders} className="obsidian-button icon-only small" title="Collapse All Folders">
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
              setTagModalFile={() => {}}
              setShowTagModal={() => {}}
              isExternalDragActive={isExternalDragActive}
              hoveredFolder={hoveredFolder}
              setHoveredFolder={(x) => useFileTreeStore.getState().setHoveredFolder(x)}
              onCheckReferences={onCheckReferences}
              workspacePath={workspacePath}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onCreateFile}>
            New File
            {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>}
          </ContextMenuItem>
          <ContextMenuItem onClick={onCreateCanvas}>New Canvas</ContextMenuItem>
          <ContextMenuItem onClick={onCreateFolder}>
            New Folder
            {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>}
          </ContextMenuItem>
          <ContextMenuItem onClick={onOpenDailyNote}>
            Open Daily Note
            {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['daily-note'])}</span>}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onRefreshFiles}>Refresh</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </aside>
  );
}
