import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm, open as openDialog } from "@tauri-apps/plugin-dialog";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ColoredFileIcon } from "../../components/FileIcon.jsx";
import FileContextMenu from "../../components/FileContextMenu.jsx";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoExpand } from "../../hooks/useAutoExpand.js";
import { getFilename } from "../../utils/pathUtils.js";
import { copyFiles, cutFiles, getRelativePath } from "../../utils/clipboard.js";
import { useViewStore } from "../../stores/views";
import { useEditorGroupStore } from "../../stores/editorGroups";
import referenceManager from "../../core/references/ReferenceManager.js";
import { InlineRenameInput } from "./InlineRenameInput.jsx";
import { NewItemInput } from "./NewItemInput.jsx";

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

export function FileEntryComponent({ entry, level, onFileClick, activeFile, expandedFolders, toggleFolder, onRefresh, keymap, renamingPath, setRenamingPath, onViewHistory, setTagModalFile, setShowTagModal, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent, updateDropPosition, fileTreeRef, isExternalDragActive, hoveredFolder, setHoveredFolder, toast, onCheckReferences, onSelectEntry, isSelected, selectedPaths, setSelectedPaths, creatingItem, onCreateConfirm, onUpdateTabPath }) {
  const entryRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const { attributes, listeners, setNodeRef: draggableRef, isDragging } = useDraggable({
    id: entry.path,
    data: { type: "file-entry", entry },
  });

  const { setNodeRef: droppableRef, isOver } = useDroppable({
    id: entry.path,
    data: { type: "folder-drop-target", entry },
    disabled: !entry.is_directory,
  });

  const isExpanded = expandedFolders.has(entry.path);
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
  const stateClasses = activeFile === entry.path ? 'active' : '';
  const selectedClasses = isSelected ? 'selected' : '';
  const dropTargetClasses = isDropTarget ? 'drop-target-inside' : '';
  const draggingClasses = isDragging ? 'dragging' : '';
  const willExpandClasses = willAutoExpand ? 'will-expand-indicator' : '';
  const externalDropTargetClasses = (isExternalDragActive && entry.is_directory && hoveredFolder === entry.path) ? 'external-drop-target' : '';

  const onRename = () => {
    // For .md files: open them (the note header handles renaming)
    if (!entry.is_directory && entry.path.endsWith('.md')) {
      onFileClick(entry);
      return;
    }

    // For other files and folders: enter inline rename mode
    setRenamingPath(entry.path);
  };

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
      const affectedFiles = await referenceManager.findAffectedFiles(oldPath);
      if (affectedFiles.length > 0) {
        // Show confirmation modal
        onCheckReferences({
          oldPath,
          newPath,
          affectedFiles,
          operation: async () => {
            try {
              await invoke("rename_file", { path: oldPath, newName: trimmedName });
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
      await invoke("rename_file", { path: oldPath, newName: trimmedName });
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

  const onCreateFileHere = async () => {
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      const name = "Untitled.md";
      await invoke("write_file_content", { path: `${base}/${name}`, content: "" });
      onRefresh && onRefresh();
    } catch (e) {
      toast?.error(`Failed to create file: ${e.message || e}`);
    }
  };

  const onCreateFolderHere = async () => {
    const name = window.prompt("New folder name:");
    if (!name) return;
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      await invoke("create_folder_in_workspace", { workspacePath: base, name });
      onRefresh && onRefresh();
    } catch (e) {
      toast?.error(`Failed to create folder: ${e.message || e}`);
    }
  };

  const handleFileContextAction = useCallback(async (action, data) => {
    const { file } = data;

    switch (action) {
      case 'open':
        onFileClick(file);
        break;
      case 'openToSide':
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
      case 'viewHistory':
        if (onViewHistory && file.type === 'file') {
          onViewHistory(file.path);
        }
        break;
      case 'openWith':
        // Open file with system default application
        try {
          await invoke('platform_open_with_default', { path: file.path });
        } catch (e) {
          toast.error(`Failed to open file: ${e}`);
        }
        break;
      case 'revealInFinder':
        try {
          await invoke('platform_reveal_in_file_manager', { path: file.path });
        } catch (err) {
          console.error('Workspace: Failed to reveal file in finder', err);
        }
        break;
      case 'openInTerminal':
        try {
          const terminalPath = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
          await invoke('platform_open_terminal', { path: terminalPath });
        } catch (err) {
          console.error('Workspace: Failed to open terminal', err);
        }
        break;
      case 'cut':
        // Cut file to clipboard
        cutFiles([file]);
        toast.success(`Cut: ${file.name}`);
        break;
      case 'copy':
        // Copy file to clipboard
        copyFiles([file]);
        toast.success(`Copied: ${file.name}`);
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
          const relativePath = getRelativePath(file.path, wsPath);
          await navigator.clipboard.writeText(relativePath);
          toast.success('Copied relative path');
        } catch (e) {
          toast.error('Failed to copy relative path');
        }
        break;
      case 'newFile':
        await onCreateFileHere();
        break;
      case 'newFolder':
        await onCreateFolderHere();
        break;
      case 'rename':
        onRename();
        break;
      case 'delete':
        try {
          const confirmed = await confirm(`Are you sure you want to delete "${file.name}"?`);
          if (confirmed) {
            await invoke('delete_file', { path: file.path });
            onRefresh && onRefresh();
          }
        } catch (err) {
          console.error('Workspace: Failed to delete file', err);
        }
        break;
      case 'selectForCompare':
        // Select file for comparison
        if (file.type === 'file') {
          useViewStore.setState({ selectedFileForCompare: file });
          toast.success(`Selected for compare: ${file.name}`);
        }
        break;
      case 'compareWith': {
        // Compare with previously selected file
        const compareFile = useViewStore.getState().selectedFileForCompare;
        if (compareFile && file.type === 'file') {
          // Open both files in split view for manual comparison
          onFileClick(compareFile.path);
          setUseSplitView(true);
          setTimeout(() => {
            setRightPaneFile(file.path);
            setRightPaneTitle(file.name);
          }, 100);
          toast.success(`Comparing ${compareFile.name} with ${file.name}`);
          useViewStore.setState({ selectedFileForCompare: null });
        }
        break;
      }
      case 'shareEmail':
      case 'shareSlack':
      case 'shareTeams':
        // Basic sharing: copy file path to clipboard
        try {
          await navigator.clipboard.writeText(file.path);
          toast.success(`File path copied. Share via ${action.replace('share', '')}`);
        } catch (e) {
          toast.error('Failed to copy file path');
        }
        break;
      case 'addTag':
      case 'manageTags':
        // Open tag management modal for markdown files
        if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
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
                await invoke('delete_file', { path: p });
              } catch (err) {
                console.error(`Failed to delete ${p}:`, err);
              }
            }
            setSelectedPaths(new Set());
            onRefresh?.();
            toast.success(`Deleted ${count} item${count > 1 ? 's' : ''}`);
          }
        }
        break;
      case 'cutSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          const filesToCut = Array.from(data.selectedPaths).map(p => ({ path: p }));
          cutFiles(filesToCut);
          toast.success(`Cut ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''}`);
        }
        break;
      case 'copySelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          const filesToCopy = Array.from(data.selectedPaths).map(p => ({ path: p }));
          copyFiles(filesToCopy);
          toast.success(`Copied ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''}`);
        }
        break;
      case 'duplicateSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          let duplicatedCount = 0;
          for (const p of data.selectedPaths) {
            try {
              // Read content and write to new file with " copy" suffix
              const content = await invoke('read_file_content', { path: p });
              const pathParts = p.split('/');
              const fileName = pathParts.pop();
              const dirPath = pathParts.join('/');
              const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
              const baseName = ext ? fileName.slice(0, -ext.length) : fileName;
              const newName = `${baseName} copy${ext}`;
              const newPath = `${dirPath}/${newName}`;
              await invoke('write_file', { path: newPath, content });
              duplicatedCount++;
            } catch (err) {
              console.error(`Failed to duplicate ${p}:`, err);
            }
          }
          onRefresh?.();
          toast.success(`Duplicated ${duplicatedCount} item${duplicatedCount > 1 ? 's' : ''}`);
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
                  await invoke('move_file', {
                    sourcePath: p,
                    destinationDir: selectedFolder,
                  });
                  const fileName = p.split('/').pop();
                  onUpdateTabPath?.(p, selectedFolder + '/' + fileName);
                  movedCount++;
                } catch (err) {
                  console.error(`Failed to move ${p}:`, err);
                }
              }
              setSelectedPaths(new Set());
              onRefresh?.();
              toast.success(`Moved ${movedCount} item${movedCount > 1 ? 's' : ''}`);
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
                  // Read file content and write to new location
                  const content = await invoke('read_file_content', { path: p });
                  const fileName = p.substring(p.lastIndexOf('/') + 1);
                  const destPath = `${exportFolder}/${fileName}`;
                  await invoke('write_file', { path: destPath, content });
                  exportedCount++;
                } catch (err) {
                  console.error(`Failed to export ${p}:`, err);
                }
              }
              toast.success(`Exported ${exportedCount} item${exportedCount > 1 ? 's' : ''}`);
            }
          } catch (err) {
            console.error('Export dialog error:', err);
          }
        }
        break;
      case 'archiveSelected':
        if (data.selectedPaths && data.selectedPaths.size > 0) {
          // Archive feature requires backend support - show info message
          toast.info(`Archive feature coming soon. For now, use Export to copy ${data.selectedPaths.size} item${data.selectedPaths.size > 1 ? 's' : ''}.`);
        }
        break;

      default:
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onFileClick,
    setUseSplitView,
    setRightPaneFile,
    setRightPaneTitle,
    setRightPaneContent,
    onViewHistory,
    onRefresh,
    setTagModalFile,
    setShowTagModal
    // Note: onCreateFileHere, onCreateFolderHere, onRename excluded to prevent infinite loop
    // They're accessible via closure and don't need to be in deps
  ]);

  return (
    <li
      className="file-entry-container"
      data-level={level}
      data-path={entry.path}
      style={{ paddingLeft: `${level * 1.25}rem`, '--level': level }}
    >
      <div
        ref={(node) => {
          droppableRef(node);
          entryRef.current = node;
        }}
        className="rounded"
      >
        <div ref={draggableRef} className="flex items-center">
          <FileContextMenu
            file={{ ...entry, type: entry.is_directory ? 'folder' : 'file' }}
            onAction={handleFileContextAction}
            selectedPaths={selectedPaths}
            isSelected={isSelected}
          >
            <button
              {...listeners}
              {...attributes}
              onClick={handleClick}
              onDragEnter={handleExternalDragEnter}
              onDragLeave={handleExternalDragLeave}
              className={`${baseClasses} ${stateClasses} ${selectedClasses} ${dropTargetClasses} ${draggingClasses} ${willExpandClasses} ${externalDropTargetClasses} file-entry-item`}
            >
              <ColoredFileIcon
                fileName={entry.name}
                isDirectory={entry.is_directory}
                isExpanded={isExpanded}
                className="obsidian-file-icon"
                showChevron={true}
              />
              {renamingPath === entry.path ? (
                <InlineRenameInput
                  initialValue={entry.name}
                  onSubmit={handleRenameSubmit}
                  onCancel={handleRenameCancel}
                />
              ) : (
                <span className="truncate">
                  {entry.is_directory ? entry.name : getNameWithoutExtension(entry.name)}
                </span>
              )}
              {fileCount !== null && (
                <span className="file-count-badge">({fileCount})</span>
              )}
            </button>
          </FileContextMenu>
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
            <ul className="space-y-1 mt-1">
              {entry.children.map(child => (
                <FileEntryComponent
                  key={child.path}
                  entry={child}
                  level={level + 1}
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
                  updateDropPosition={updateDropPosition}
                  fileTreeRef={fileTreeRef}
                  isExternalDragActive={isExternalDragActive}
                  hoveredFolder={hoveredFolder}
                  setHoveredFolder={setHoveredFolder}
                  toast={toast}
                  onCheckReferences={onCheckReferences}
                  onSelectEntry={onSelectEntry}
                  isSelected={selectedPaths.has(child.path) || false}
                  selectedPaths={selectedPaths}
                  setSelectedPaths={setSelectedPaths}
                  onUpdateTabPath={onUpdateTabPath}
                />
              ))}
            </ul>
          </motion.div>
        )}
        {creatingItem && creatingItem.targetPath === entry.path && (
          <NewItemInput
            type={creatingItem.type}
            level={level + 1}
            onConfirm={onCreateConfirm}
          />
        )}
      </AnimatePresence>
    </li>
  );
}
