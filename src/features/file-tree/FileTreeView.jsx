import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { DndContext, DragOverlay, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { ColoredFileIcon } from "../../components/FileIcon.jsx";
import DropIndicator from "../../components/FileTree/DropIndicator.jsx";
import { useDropPosition } from "../../hooks/useDropPosition.js";
import referenceWorkerClient from "../../workers/referenceWorkerClient.js";
import { NewItemInput } from "./NewItemInput.jsx";
import { FileEntryComponent } from "./FileEntryComponent.jsx";

export function FileTreeView({ entries, onFileClick, activeFile, onRefresh, expandedFolders, toggleFolder, creatingItem, onCreateConfirm, keymap, selectedPath, setSelectedPath, renamingPath, setRenamingPath, onViewHistory, setTagModalFile, setShowTagModal, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent, isExternalDragActive, hoveredFolder, setHoveredFolder, toast, onCheckReferences, workspacePath, onUpdateTabPath }) {
  const [activeEntry, setActiveEntry] = useState(null);
  const [draggedPaths, setDraggedPaths] = useState(new Set()); // Track paths being dragged (for multi-select)
  const fileTreeRef = useRef(null);
  const { dropPosition, updatePosition, clearPosition } = useDropPosition();
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState(null);
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
            try { await invoke('delete_file', { path: p }); } catch {}
          }
          setSelectedPaths(new Set());
          onRefresh?.();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [flatEntries, onRefresh, selectedPaths]);

  // Click on empty space in file tree clears selection
  const handleContainerClick = useCallback((e) => {
    // Only clear if clicking directly on the container or the ul, not on a file entry
    if (e.target === e.currentTarget || e.target.tagName === 'UL') {
      setSelectedPaths(new Set());
    }
  }, []);


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
        await invoke("move_file", {
          sourcePath: oldPath,
          destinationDir: destinationDir,
        });
        const fileName = oldPath.split('/').pop();
        onUpdateTabPath?.(oldPath, destinationDir + '/' + fileName);
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
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onRefresh={onRefresh}
              keymap={keymap}
              creatingItem={creatingItem}
              onCreateConfirm={onCreateConfirm}
              renamingPath={renamingPath}
              setRenamingPath={setRenamingPath}
              onViewHistory={onViewHistory}
              setTagModalFile={setTagModalFile}
              setShowTagModal={setShowTagModal}
              setUseSplitView={setUseSplitView}
              setRightPaneFile={setRightPaneFile}
              setRightPaneTitle={setRightPaneTitle}
              setRightPaneContent={setRightPaneContent}
              updateDropPosition={updatePosition}
              fileTreeRef={fileTreeRef}
              isExternalDragActive={isExternalDragActive}
              hoveredFolder={hoveredFolder}
              setHoveredFolder={setHoveredFolder}
              toast={toast}
              onCheckReferences={onCheckReferences}
              onSelectEntry={handleSelectEntry}
              isSelected={selectedPaths.has(entry.path)}
              selectedPaths={selectedPaths}
              setSelectedPaths={setSelectedPaths}
              onUpdateTabPath={onUpdateTabPath}
            />
          ))}
        </ul>

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
