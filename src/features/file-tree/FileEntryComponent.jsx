import { memo, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ColoredFileIcon } from "../../components/FileIcon.jsx";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoExpand } from "../../hooks/useAutoExpand.js";
import { useGraphStore } from "../../core/graph2/graphStore.js";
import { useFileTreeStore } from "../../stores/fileTree";
import referenceWorkerClient from "../../workers/referenceWorkerClient.js";
import { InlineRenameInput } from "./InlineRenameInput.jsx";
import { NewItemInput } from "./NewItemInput.jsx";
import { isSupportedNotePath, noteMutationClient } from "../../core/notes/NoteMutationClient.js";

// Helper to get filename without extension
export function getNameWithoutExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex);
  }
  return filename;
}

// Helper to get extension (including the dot)
export function getExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(lastDotIndex);
  }
  return '';
}

/**
 * One row of the file tree.
 *
 * Deliberately takes as few changing props as possible and reads the rest
 * from the file-tree store with per-path selectors, because the tree is
 * recursive: memoizing a row that correctly bails out would also stop the
 * update reaching its descendants, so "does this row care?" has to be decided
 * by the row itself. Combined with `memo`, expanding a folder or switching
 * tabs now re-renders the handful of rows whose own state changed rather than
 * all of them.
 *
 * The right-click menu lives once at the tree root (see FileTreeView) — it
 * used to be mounted per row, which meant every row built ~100 menu elements
 * on every render for a menu that is only ever open on one row at a time.
 */
function FileEntryComponentImpl({ entry, level, onFileClick, toggleFolder, onRefresh, updateDropPosition, fileTreeRef, isExternalDragActive, toast, onCheckReferences, onSelectEntry, isSelected, selectedPaths, onCreateConfirm, onUpdateTabPath }) {
  const entryRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const path = entry.path;
  const isActive = useFileTreeStore((s) => s.activePath === path);
  const isExpanded = useFileTreeStore((s) => s.expandedFolders.has(path));
  const isRenaming = useFileTreeStore((s) => s.renamingPath === path);
  const isExternalHovered = useFileTreeStore((s) => s.hoveredFolder === path);
  const creatingHere = useFileTreeStore((s) => s.creatingItem?.targetPath === path ? s.creatingItem : null);
  const setRenamingPath = useCallback((p) => useFileTreeStore.setState({ renamingPath: p }), []);
  const setHoveredFolder = useCallback((p) => useFileTreeStore.getState().setHoveredFolder(p), []);

  const { attributes, listeners, setNodeRef: draggableRef, isDragging } = useDraggable({
    id: entry.path,
    data: { type: "file-entry", entry },
  });

  const { setNodeRef: droppableRef, isOver } = useDroppable({
    id: entry.path,
    data: { type: "folder-drop-target", entry },
    disabled: !entry.is_directory,
  });

  const isDropTarget = isOver && entry.is_directory;

  // Auto-expand folder after 800ms hover during drag
  const willAutoExpand = useAutoExpand(isOver, entry.is_directory, isExpanded, entry.path, toggleFolder);

  // Update drop position when dragging over this element
  const handleDragOver = useCallback((event) => {
    if (isOver && updateDropPosition && entryRef.current) {
      updateDropPosition(event, entryRef.current, entry);
    }
  }, [isOver, updateDropPosition, entry]);

  useEffect(() => {
    const element = entryRef.current;
    if (element && isOver) {
      element.addEventListener('dragover', handleDragOver);
      return () => element.removeEventListener('dragover', handleDragOver);
    }
  }, [isOver, handleDragOver]);

  // External file drop handlers for folders
  const handleExternalDragEnter = (e) => {
    if (isExternalDragActive && entry.is_directory) {
      e.preventDefault();
      e.stopPropagation();
      setHoveredFolder(entry.path);

      // Auto-expand after 800ms
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isExpanded) {
          toggleFolder(entry.path);
        }
      }, 800);
    }
  };

  const handleExternalDragLeave = (e) => {
    if (isExternalDragActive && entry.is_directory) {
      e.preventDefault();
      e.stopPropagation();
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Calculate file count for folders
  const fileCount = entry.is_directory && entry.children ? entry.children.length : null;

  const handleClick = (e) => {
    onSelectEntry?.(entry, e)
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (entry.is_directory) {
      toggleFolder(entry.path);
    } else {
      onFileClick(entry);
    }
  };

  const baseClasses = "obsidian-file-item";
  const stateClasses = isActive ? 'active' : '';
  const selectedClasses = isSelected ? 'selected' : '';
  const dropTargetClasses = isDropTarget ? 'drop-target-inside' : '';
  const draggingClasses = isDragging ? 'dragging' : '';
  const willExpandClasses = willAutoExpand ? 'will-expand-indicator' : '';
  const externalDropTargetClasses = (isExternalDragActive && entry.is_directory && isExternalHovered) ? 'external-drop-target' : '';

  const handleRenameSubmit = async (newName) => {
    if (!newName || newName.trim() === "" || newName.trim() === entry.name) {
      setRenamingPath(null);
      return;
    }

    const trimmedName = newName.trim();
    const oldPath = entry.path;
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentDir}/${trimmedName}`;

    // Check for references that would need updating
    if (onCheckReferences) {
      const backlinkSources = referenceWorkerClient.getBacklinksForFile(oldPath);
      if (backlinkSources.length > 0) {
        // Convert the flat source-path list to the shape the modal expects:
        // { filePath: string }[]
        const affectedFiles = backlinkSources.map(filePath => ({ filePath }));
        // Show confirmation modal
        onCheckReferences({
          oldPath,
          newPath,
          affectedFiles,
          operation: async () => {
            try {
              if (isSupportedNotePath(oldPath)) {
                await noteMutationClient.renameNote(oldPath, trimmedName);
              } else {
                await invoke("rename_file", { path: oldPath, newName: trimmedName });
              }
              useGraphStore.getState().fileRenamed(oldPath, newPath);
              onUpdateTabPath?.(oldPath, newPath);
              setRenamingPath(null);
              onRefresh && onRefresh();
              return true;
            } catch (e) {
              toast?.error(`Failed to rename: ${e.message || e}`);
              setRenamingPath(null);
              return false;
            }
          }
        });
        return;
      }
    }

    // No references to update, proceed directly
    try {
      if (isSupportedNotePath(oldPath)) {
        await noteMutationClient.renameNote(oldPath, trimmedName);
      } else {
        await invoke("rename_file", { path: oldPath, newName: trimmedName });
      }
      useGraphStore.getState().fileRenamed(oldPath, newPath);
      onUpdateTabPath?.(oldPath, newPath);
      setRenamingPath(null);
      onRefresh && onRefresh();
    } catch (e) {
      toast?.error(`Failed to rename: ${e.message || e}`);
      setRenamingPath(null);
    }
  };

  const handleRenameCancel = () => {
    setRenamingPath(null);
  };

  return (
    <li
      className="file-entry-container"
      data-level={level}
      data-path={entry.path}
      style={{ paddingLeft: `${level * 1}rem`, '--level': level }}
    >
      <div
        ref={(node) => {
          droppableRef(node);
          entryRef.current = node;
        }}
        className="rounded"
      >
        <div ref={draggableRef} className="flex items-center w-full">
            <button
              {...listeners}
              {...attributes}
              onClick={handleClick}
              onDragEnter={handleExternalDragEnter}
              onDragLeave={handleExternalDragLeave}
              className={`${baseClasses} ${stateClasses} ${selectedClasses} ${dropTargetClasses} ${draggingClasses} ${willExpandClasses} ${externalDropTargetClasses} ${entry.is_directory ? '' : 'file-leaf'} file-entry-item`}
            >
              <ColoredFileIcon
                fileName={entry.name}
                isDirectory={entry.is_directory}
                isExpanded={isExpanded}
                className="obsidian-file-icon"
                showChevron={true}
              />
              {isRenaming ? (
                <InlineRenameInput
                  initialValue={entry.name}
                  onSubmit={handleRenameSubmit}
                  onCancel={handleRenameCancel}
                />
              ) : (
                <span className={`truncate flex-1 min-w-0 ${entry.is_directory ? 'font-medium text-app-text-secondary' : ''}`}>
                  {entry.is_directory ? entry.name : getNameWithoutExtension(entry.name)}
                </span>
              )}
              {fileCount !== null && (
                <span className="file-count-badge">({fileCount})</span>
              )}
            </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && entry.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="folder-children-container"
          >
            <ul className="space-y-0 mt-0">
              {entry.children.map(child => (
                <FileEntryComponent
                  key={child.path}
                  entry={child}
                  level={level + 1}
                  onFileClick={onFileClick}
                  toggleFolder={toggleFolder}
                  onRefresh={onRefresh}
                  onCreateConfirm={onCreateConfirm}
                  updateDropPosition={updateDropPosition}
                  fileTreeRef={fileTreeRef}
                  isExternalDragActive={isExternalDragActive}
                  toast={toast}
                  onCheckReferences={onCheckReferences}
                  onSelectEntry={onSelectEntry}
                  isSelected={selectedPaths.has(child.path) || false}
                  selectedPaths={selectedPaths}
                  onUpdateTabPath={onUpdateTabPath}
                />
              ))}
            </ul>
          </motion.div>
        )}
        {creatingHere && (
          <NewItemInput
            type={creatingHere.type}
            level={level + 1}
            onConfirm={onCreateConfirm}
          />
        )}
      </AnimatePresence>
    </li>
  );
}

/** Memoized: with per-path store subscriptions above, a row only re-renders
 *  when its own props change or its own slice of tree state moves. */
export const FileEntryComponent = memo(FileEntryComponentImpl);
