import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm, open as openDialog } from "@tauri-apps/plugin-dialog";
import { DndContext, DragOverlay, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { ColoredFileIcon } from "../../components/FileIcon.jsx";
import DropIndicator from "../../components/FileTree/DropIndicator.jsx";
import { useDropPosition } from "../../hooks/useDropPosition.js";
import referenceWorkerClient from "../../workers/referenceWorkerClient.js";
import FileContextMenu from "../../components/FileContextMenu.jsx";
import { useViewStore } from "../../stores/views";
import { useEditorGroupStore } from "../../stores/editorGroups";
import { useFileTreeStore } from "../../stores/fileTree";
import { getFilename } from "../../utils/pathUtils.js";
import { copyFiles, cutFiles, getRelativePath } from "../../utils/clipboard.js";
import { NewItemInput } from "./NewItemInput.jsx";
import { FileEntryComponent } from "./FileEntryComponent.jsx";
import { isSupportedNotePath, noteMutationClient } from "../../core/notes/NoteMutationClient.js";

// Props that rows used to receive and thread down (expandedFolders, keymap,
// renamingPath, hoveredFolder, …) are gone: each row now reads its own slice
// from the file-tree store, so changing one of them no longer re-renders the
// entire tree.
export function FileTreeView({ entries, onFileClick, activeFile, onRefresh, toggleFolder, creatingItem, onCreateConfirm, setRenamingPath, onViewHistory, setTagModalFile, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent, isExternalDragActive, toast, onCheckReferences, workspacePath, onUpdateTabPath }) {
  const [activeEntry, setActiveEntry] = useState(null);
  const [draggedPaths, setDraggedPaths] = useState(new Set()); // Track paths being dragged (for multi-select)
  const fileTreeRef = useRef(null);
  const { dropPosition, updatePosition, clearPosition } = useDropPosition();
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState(null);
  const deletePath = useCallback(async (path) => {
    if (isSupportedNotePath(path)) {
      return noteMutationClient.removeNote({
        workspacePath,
        path,
        source: "file-tree-delete",
      });
    }
    return invoke("delete_file", { path });
  }, [workspacePath]);
  const movePath = useCallback(async (path, destinationDir) => {
    if (isSupportedNotePath(path)) {
      return noteMutationClient.moveNote(path, destinationDir, { workspacePath });
    }
    await invoke("move_file", { sourcePath: path, destinationDir });
    return `${destinationDir}/${path.split(/[/\\]/).pop()}`;
  }, [workspacePath]);
  const flatEntries = useMemo(() => {
    const list = [];
    const walk = (nodes) => {
      nodes.forEach((n) => {
        list.push(n);
        if (n.children?.length) walk(n.children);
      });
    };
    walk(entries || []);
    return list;
  }, [entries]);

  const indexByPath = useMemo(() => {
    const map = new Map();
    flatEntries.forEach((n, i) => map.set(n.path, i));
    return map;
  }, [flatEntries]);

  const entryByPath = useMemo(() => {
    const map = new Map();
    flatEntries.forEach((n) => map.set(n.path, n));
    return map;
  }, [flatEntries]);

  // The right-click menu is mounted ONCE for the whole tree. Every row used to
  // mount its own <FileContextMenu>, which built ~100 menu elements per row on
  // every render even though at most one menu can be open. `contextTarget` is
  // the row the pointer was over when the menu opened; a single delegated
  // handler resolves it from the `data-path` attribute each row already has.
  const [contextTarget, setContextTarget] = useState(null);

  const handleTreeContextMenu = useCallback((event) => {
    let row = event.target?.closest?.('[data-path]');
    // Mobile long-press dispatches a synthetic contextmenu on the trigger
    // wrapper rather than the row, so fall back to hit-testing the pointer.
    if (!row && event.clientX != null) {
      row = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-path]') ?? null;
    }
    const targetPath = row?.getAttribute('data-path');
    setContextTarget(targetPath ? entryByPath.get(targetPath) ?? null : null);
  }, [entryByPath]);

  const contextFile = useMemo(
    () => (contextTarget
      ? { ...contextTarget, type: contextTarget.is_directory ? 'folder' : 'file' }
      : null),
    [contextTarget],
  );

  //Add dropable for workspace root
  const { setNodeRef: workspaceRootDroppableRef } = useDroppable({
    id: 'workspace-root',
    data: {
      type: "workspace-root",
      path: workspacePath
    }
  });


   const handleSelectEntry = useCallback((entry, event) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const path = entry.path;
      const isToggle = event.metaKey || event.ctrlKey;
      const isRange = event.shiftKey && lastSelectedPath && indexByPath.has(lastSelectedPath);

      if (isRange) {
        const start = indexByPath.get(lastSelectedPath);
        const end = indexByPath.get(path);
        if (start !== undefined && end !== undefined) {
          const [lo, hi] = start < end ? [start, end] : [end, start];
          for (let i = lo; i <= hi; i++) {
            next.add(flatEntries[i].path);
          }
        }
      } else if (isToggle) {
        if (next.has(path)) next.delete(path);
        else next.add(path);
      } else {
        next.clear();
        next.add(path);
      }

      return next;
    });
    setLastSelectedPath(entry.path);
  }, [indexByPath, flatEntries, lastSelectedPath]);

  // Keyboard shortcuts (tree scoped) - Escape, Delete, Select All
  useEffect(() => {
    const onKeyDown = async (e) => {
      // Skip if user is typing in an input field
      const activeEl = document.activeElement;
      const isTyping = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
      if (isTyping) return;

      // Only handle if file tree has focus
      const fileTreeHasFocus = fileTreeRef.current?.contains(document.activeElement);
      if (!fileTreeHasFocus) return;

      // Escape - clear selection
      if (e.key === 'Escape' && selectedPaths.size > 0) {
        e.preventDefault();
        setSelectedPaths(new Set());
        return;
      }

      // Cmd/Ctrl+A - select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedPaths(new Set(flatEntries.map((n) => n.path)));
        return;
      }

      // Delete/Backspace - delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPaths.size > 0) {
        e.preventDefault();
        const count = selectedPaths.size;
        const confirmed = await confirm(`Delete ${count} item${count > 1 ? 's' : ''}?`);
        if (confirmed) {
          for (const p of selectedPaths) {
            try { await deletePath(p); } catch {}
          }
          setSelectedPaths(new Set());
          onRefresh?.();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [deletePath, flatEntries, onRefresh, selectedPaths]);

  // Click on empty space in file tree clears selection
  const handleContainerClick = useCallback((e) => {
    // Anything that isn't inside a row counts as empty space. (Checking for
    // the container or the UL specifically stopped working once the shared
    // context-menu trigger added a wrapper element between them.)
    if (!e.target?.closest?.('[data-path]')) {
      setSelectedPaths(new Set());
    }
  }, []);



  // ── Context-menu actions ──────────────────────────────────────────────────
  // Hoisted out of the row component along with the menu itself. Everything
  // here works off `data.file`, which the menu supplies, so it needs no
  // per-row closure.

  const onCreateFileHere = useCallback(async (file) => {
    try {
      const base = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
      await noteMutationClient.writeNote({
        workspacePath,
        path: `${base}/Untitled.md`,
        content: "",
        source: "file-tree-create",
      });
      onRefresh && onRefresh();
    } catch (e) {
      toast?.error(`Failed to create file: ${e.message || e}`);
    }
  }, [onRefresh, toast, workspacePath]);

  // window.prompt() is a no-op in the Tauri webview, so folder creation goes
  // through the same inline-input flow as the Cmd+Shift+N shortcut: set
  // creatingItem in the store and let the row render a NewItemInput.
  const onCreateFolderHere = useCallback((file) => {
    const base = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
    const store = useFileTreeStore.getState();
    if (file.is_directory && !store.expandedFolders.has(base)) {
      store.toggleFolder(base);
    }
    store.startCreate('folder', base);
  }, []);

  const onRename = useCallback((file) => {
    // For .md files: open them (the note header handles renaming)
    if (!file.is_directory && file.path.endsWith('.md')) {
      onFileClick(file);
      return;
    }
    // For other files and folders: enter inline rename mode
    setRenamingPath(file.path);
  }, [onFileClick, setRenamingPath]);

  const handleFileContextAction = useCallback(async (action, data) => {
    const { file } = data;
    if (!file) return;

    switch (action) {
      case 'open':
        onFileClick(file);
        break;
      case 'openToSide': {
        // Enable split view and open file in right pane
        setUseSplitView(true);
        setRightPaneFile(file.path);

        // Set title (remove .md extension)
        const fileName = getFilename(file.name);
        setRightPaneTitle(fileName.replace(/\.md$/, ''));

        // Load content if it's a markdown file
        if (file.path.endsWith('.md') || file.path.endsWith('.txt')) {
          // Check if this file is already loaded in the focused group to avoid duplicate load
          const focusedGroup = useEditorGroupStore.getState().getFocusedGroup();
          const currentEditorContent = focusedGroup?.contentByTab?.[file.path]?.html ?? null;
          if (file.path === activeFile && currentEditorContent) {
            setRightPaneContent(currentEditorContent);
          } else {
            try {
              const content = await invoke('read_file_content', { path: file.path });
              setRightPaneContent(content || '');
            } catch (err) {
              setRightPaneContent('');
            }
          }
        } else {
          setRightPaneContent('');
        }
        break;
      }
      case 'viewHistory':
        if (onViewHistory && file.type === 'file') {
          onViewHistory(file.path);
        }
        break;
      case 'openWith':
        try {
          await invoke('platform_open_with_default', { path: file.path });
        } catch (e) {
          toast?.error(`Failed to open file: ${e}`);
        }
        break;
      case 'revealInFinder':
        try {
          await invoke('platform_reveal_in_file_manager', { path: file.path });
        } catch (err) {
          console.error('Workspace: Failed to reveal file in finder', err);
        }
        break;
      case 'openInTerminal': {
        const ff = globalThis.__LOKUS_FEATURE_FLAGS__ || {};
        if (ff.enable_terminal === false) return;
        try {
          const terminalPath = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
          await invoke('platform_open_terminal', { path: terminalPath });
        } catch (err) {
          console.error('Workspace: Failed to open terminal', err);
        }
        break;
      }
      case 'cut':
        cutFiles([file]);
        toast?.success(`Cut: ${file.name}`);
        break;
      case 'copy':
        copyFiles([file]);
        toast?.success(`Copied: ${file.name}`);
        break;
      case 'copyPath':
        try {
          await navigator.clipboard.writeText(file.path);
        } catch (err) {
          console.error('Workspace: Failed to copy path', err);
        }
        break;
      case 'copyRelativePath':
        try {
          const wsPath = window.__LOKUS_WORKSPACE_PATH__ || '';
          await navigator.clipboard.writeText(getRelativePath(file.path, wsPath));
          toast?.success('Copied relative path');
        } catch (e) {
          toast?.error('Failed to copy relative path');
        }
        break;
      case 'newFile':
        await onCreateFileHere(file);
        break;
      case 'newFolder':
        await onCreateFolderHere(file);
        break;
      case 'rename':
        onRename(file);
        break;
      case 'teamShare':
        window.dispatchEvent(new CustomEvent('lokus:share-team-note', {
          detail: {
            workspacePath,
            path: file.path,
          },
        }));
        break;
      case 'delete':
        try {
          const confirmed = await confirm(`Are you sure you want to delete "${file.name}"?`);
          if (confirmed) {
            await deletePath(file.path);
            onRefresh && onRefresh();
          }
        } catch (err) {
          console.error('Workspace: Failed to delete file', err);
        }
        break;
      case 'selectForCompare':
        if (file.type === 'file') {
          useViewStore.setState({ selectedFileForCompare: file });
          toast?.success(`Selected for compare: ${file.name}`);
        }
        break;
      case 'compareWith': {
        const compareFile = useViewStore.getState().selectedFileForCompare;
        if (compareFile && file.type === 'file') {
          onFileClick(compareFile.path);
          setUseSplitView(true);
          setTimeout(() => {
            setRightPaneFile(file.path);
            setRightPaneTitle(file.name);
          }, 100);
          toast?.success(`Comparing ${compareFile.name} with ${file.name}`);
          useViewStore.setState({ selectedFileForCompare: null });
        }
        break;
      }
      case 'shareEmail':
      case 'shareSlack':
      case 'shareTeams':
        try {
          await navigator.clipboard.writeText(file.path);
          toast?.success(`File path copied. Share via ${action.replace('share', '')}`);
        } catch (e) {
          toast?.error('Failed to copy file path');
        }
        break;
      case 'addTag':
      case 'manageTags':
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          setTagModalFile(file);
          useViewStore.getState().openPanel('showTagModal');
        }
        break;

      // Bulk operations for multi-select
      case 'deleteSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          const count = data.selectedPaths.size;
          const confirmed = await confirm(`Delete ${count} item${count > 1 ? 's' : ''}?`);
          if (confirmed) {
            for (const p of data.selectedPaths) {
              try {
                await deletePath(p);
              } catch (err) {
                console.error(`Failed to delete ${p}:`, err);
              }
            }
            setSelectedPaths(new Set());
            onRefresh?.();
            toast?.success(`Deleted ${count} item${count > 1 ? 's' : ''}`);
          }
        }
        break;
      case 'cutSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          cutFiles(Array.from(data.selectedPaths).map(p => ({ path: p })));
          toast?.success(`Cut ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''}`);
        }
        break;
      case 'copySelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          copyFiles(Array.from(data.selectedPaths).map(p => ({ path: p })));
          toast?.success(`Copied ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''}`);
        }
        break;
      case 'duplicateSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          let duplicatedCount = 0;
          for (const p of data.selectedPaths) {
            try {
              const content = await invoke('read_file_content', { path: p });
              const pathParts = p.split('/');
              const fileName = pathParts.pop();
              const dirPath = pathParts.join('/');
              const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
              const baseName = ext ? fileName.slice(0, -ext.length) : fileName;
              await invoke('write_file', { path: `${dirPath}/${baseName} copy${ext}`, content });
              duplicatedCount++;
            } catch (err) {
              console.error(`Failed to duplicate ${p}:`, err);
            }
          }
          onRefresh?.();
          toast?.success(`Duplicated ${duplicatedCount} item${duplicatedCount > 1 ? 's' : ''}`);
        }
        break;
      case 'moveSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          try {
            const selectedFolder = await openDialog({
              directory: true,
              multiple: false,
              title: `Move ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''} to...`,
            });
            if (selectedFolder) {
              let movedCount = 0;
              for (const p of data.selectedPaths) {
                try {
                  const newPath = await movePath(p, selectedFolder);
                  onUpdateTabPath?.(p, newPath);
                  movedCount++;
                } catch (err) {
                  console.error(`Failed to move ${p}:`, err);
                }
              }
              setSelectedPaths(new Set());
              onRefresh?.();
              toast?.success(`Moved ${movedCount} item${movedCount > 1 ? 's' : ''}`);
            }
          } catch (err) {
            console.error('Move dialog error:', err);
          }
        }
        break;
      case 'exportSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          try {
            const exportFolder = await openDialog({
              directory: true,
              multiple: false,
              title: `Export ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''} to...`,
            });
            if (exportFolder) {
              let exportedCount = 0;
              for (const p of data.selectedPaths) {
                try {
                  const content = await invoke('read_file_content', { path: p });
                  const fileName = p.substring(p.lastIndexOf('/') + 1);
                  await invoke('write_file', { path: `${exportFolder}/${fileName}`, content });
                  exportedCount++;
                } catch (err) {
                  console.error(`Failed to export ${p}:`, err);
                }
              }
              toast?.success(`Exported ${exportedCount} item${exportedCount > 1 ? 's' : ''}`);
            }
          } catch (err) {
            console.error('Export dialog error:', err);
          }
        }
        break;
      case 'archiveSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          toast?.info(`Archive feature coming soon. For now, use Export to copy ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''}.`);
        }
        break;

      default:
    }
  }, [
    onFileClick, activeFile, setUseSplitView, setRightPaneFile, setRightPaneTitle,
    setRightPaneContent, onViewHistory, onRefresh, setTagModalFile, toast,
    onUpdateTabPath, onCreateFileHere, onCreateFolderHere, onRename, deletePath, movePath,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleDragStart = (event) => {
    const sourceEntry = event.active.data.current?.entry;
    setActiveEntry(sourceEntry);

    // Check if dragged item is part of multi-selection
    if (sourceEntry && selectedPaths.has(sourceEntry.path) && selectedPaths.size > 1) {
      // Dragging multiple selected items
      setDraggedPaths(new Set(selectedPaths));
    } else {
      // Dragging single item (not part of selection or only item selected)
      setDraggedPaths(new Set([sourceEntry?.path].filter(Boolean)));
    }
  };

 const handleDragEnd = async (event) => {
  const { over, active } = event;
  setActiveEntry(null);
  const pathsToMove = new Set(draggedPaths);
  setDraggedPaths(new Set());
  clearPosition();

  if (!active) return;

  const sourceEntry = active.data.current?.entry;
  if (!sourceEntry) return;

  let destinationDir;
  let targetEntry = over?.data.current?.entry;

  // Check if dropping outside any entry (over the container)
  if (!over || !targetEntry) {
    // Dropping on empty space or container - move to workspace root
    destinationDir = workspacePath;
  } else if (targetEntry.path === sourceEntry.path) {
    // Can't drop on self
    return;
  } else if (dropPosition) {
    // Use drop position indicator (before/after/inside)
    const { position, targetPath } = dropPosition;
    if (position === "inside") {
      destinationDir = targetPath;
    } else {
      // before/after - get parent directory
      const parentPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
      destinationDir = parentPath || workspacePath;
    }
  } else if (targetEntry.is_directory) {
    // Drop on a directory - move inside it
    destinationDir = targetEntry.path;
  } else {
    // Drop on a file - move to its parent directory
    const parentPath = targetEntry.path.substring(0, targetEntry.path.lastIndexOf('/'));
    destinationDir = parentPath || workspacePath;
  }

   // Don't allow dropping into itself (for folders)
  if (!destinationDir) return;
  for (const p of pathsToMove) {
    if (destinationDir.startsWith(p + '/') || destinationDir === p) {
      toast?.error("Cannot move a folder into itself");
      return;
    }
  }

   // Helper function to perform the actual move for multiple files
  const performMoveAll = async () => {
    let movedCount = 0;
    for (const oldPath of pathsToMove) {
      try {
        const newPath = await movePath(oldPath, destinationDir);
        onUpdateTabPath?.(oldPath, newPath);
        movedCount++;
      } catch (err) {
        console.error(`Failed to move ${oldPath}:`, err);
      }
    }
    setSelectedPaths(new Set());
    onRefresh();
    if (pathsToMove.size > 1) {
      toast?.success(`Moved ${movedCount} item${movedCount > 1 ? 's' : ''}`);
    }
    return movedCount > 0;
  };

  // For single file moves, check references
  if (pathsToMove.size === 1) {
    const oldPath = sourceEntry.path;
    const fileName = oldPath.substring(oldPath.lastIndexOf('/') + 1);
    const newPath = `${destinationDir}/${fileName}`;

    if (onCheckReferences) {
      const backlinkSources = referenceWorkerClient.getBacklinksForFile(oldPath);
      if (backlinkSources.length > 0) {
        // Convert the flat source-path list to the shape the modal expects:
        // { filePath: string }[]
        const affectedFiles = backlinkSources.map(filePath => ({ filePath }));
        onCheckReferences({
          oldPath,
          newPath,
          affectedFiles,
          operation: performMoveAll
        });
        return;
      }
    }
  }

   // No references to update (or multiple files), proceed directly
  await performMoveAll();
};

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
     <div
        ref={(node) => {
          if (node) {
            fileTreeRef.current = node;
            workspaceRootDroppableRef(node); // Apply both refs
          }
        }}
        className="file-tree-container"
        tabIndex={0}
        onClick={handleContainerClick}
        onContextMenu={handleTreeContextMenu}
      >
        {/* One menu for the whole tree. Radix opens it at the pointer, so a
            single trigger around the list positions correctly on any row;
            `contextTarget` says which row was under the cursor. */}
        <FileContextMenu
          file={contextFile}
          onAction={handleFileContextAction}
          selectedPaths={selectedPaths}
          isSelected={contextTarget ? selectedPaths.has(contextTarget.path) : false}
        >
          <ul className="space-y-1">
            {creatingItem && creatingItem.targetPath === workspacePath && (
              <NewItemInput
                type={creatingItem.type}
                level={0}
                onConfirm={onCreateConfirm}
              />
            )}
            {entries.map(entry => (
              <FileEntryComponent
                key={entry.path}
                entry={entry}
                level={0}
                onFileClick={onFileClick}
                toggleFolder={toggleFolder}
                onRefresh={onRefresh}
                onCreateConfirm={onCreateConfirm}
                updateDropPosition={updatePosition}
                fileTreeRef={fileTreeRef}
                isExternalDragActive={isExternalDragActive}
                toast={toast}
                onCheckReferences={onCheckReferences}
                onSelectEntry={handleSelectEntry}
                isSelected={selectedPaths.has(entry.path)}
                selectedPaths={selectedPaths}
                onUpdateTabPath={onUpdateTabPath}
              />
            ))}
          </ul>
        </FileContextMenu>

        {/* Drop position indicator */}
        <DropIndicator
          position={dropPosition}
          targetPath={dropPosition?.targetPath}
          fileTreeRef={fileTreeRef}
        />
      </div>

      {/* Drag overlay with ghost preview */}
      <DragOverlay>
        {activeEntry ? (
          <div className="drag-preview">
            <ColoredFileIcon
              filename={activeEntry.name}
              isDirectory={activeEntry.is_directory}
              size={16}
            />
            <span>{activeEntry.name}</span>
            {draggedPaths.size > 1 && (
              <span className="drag-count-badge">
                +{draggedPaths.size - 1}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
