import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import { useRemoteLinks, useUIVisibility, useLayoutDefaults, useFeatureFlags } from "../contexts/RemoteConfigContext";
import ServiceStatus from "../components/ServiceStatus";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirm, save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { DraggableTab } from "./DraggableTab";
import { FoldVertical, RefreshCw } from "lucide-react";
import { ColoredFileIcon } from "../components/FileIcon.jsx";
import {
  Loading,
  LazyMeetingPanel,
  LazyOnboarding,
} from '../components/OptimizedWrapper';
import Editor from "../editor";
import ResponsiveStatusBar from "../components/StatusBar/ResponsiveStatusBar.jsx";
import { GraphDataProcessor } from "../core/graph/GraphDataProcessor.js";
import { GraphData } from "../core/graph/GraphData.js";
import { GraphEngine } from "../core/graph/GraphEngine.js";
import FileContextMenu from "../components/FileContextMenu.jsx";
import EditorGroupsContainer from "../components/EditorGroupsContainer.jsx";
import { useEditorGroups } from "../hooks/useEditorGroups.js";
import TabBar from "../components/TabBar.jsx";
import { ResponsiveTabBar } from "../components/TabBar/ResponsiveTabBar.jsx";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/context-menu.jsx";
import { getActiveShortcuts, formatAccelerator } from "../core/shortcuts/registry.js";
// GlobalContextMenu removed - using EditorContextMenu and FileContextMenu instead
import { WorkspaceManager } from "../core/workspace/manager.js";
// FullKanban removed - now using file-based KanbanBoard system
import { canvasManager } from "../core/canvas/manager.js";
import { getMarkdownCompiler } from "../core/markdown/compiler.js";
import { MarkdownExporter } from "../core/export/markdown-exporter.js";
import dailyNotesManager from "../core/daily-notes/manager.js";
import posthog from "../services/posthog.js";
import { PanelManager, PanelRegion, usePanelManager } from "../plugins/ui/PanelManager.jsx";
import { PANEL_POSITIONS } from "../plugins/api/UIAPI.js";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { setGlobalActiveTheme, getSystemPreferredTheme, setupSystemThemeListener, readGlobalVisuals } from "../core/theme/manager.js";
import { useTheme } from "../hooks/theme.jsx";
import { getFilename, getBasename, joinPath } from '../utils/pathUtils.js';
import platformService from "../services/platform/PlatformService.js";
import { FolderScopeProvider, useFolderScope } from "../contexts/FolderScopeContext.jsx";
import { BasesProvider, useBases } from "../bases/BasesContext.jsx";
import { isImageFile, findImageFiles } from "../utils/imageUtils.js";
import { generatePreview } from '../core/canvas/preview-generator.js';
import { AnimatePresence, motion } from "framer-motion";
import { toast, demoAllToasts } from "../components/ui/enhanced-toast";
import MeetingNotification from "../components/meeting/MeetingNotification.jsx";
import MeetingFAB from "../components/meeting/MeetingFAB.jsx";
import { useMeeting } from "../contexts/MeetingContext.jsx";
// Expose demo function to window for console access
if (typeof window !== 'undefined') {
  window.demoToasts = demoAllToasts;
}
import { useDropPosition } from "../hooks/useDropPosition.js";
import { useAutoExpand } from "../hooks/useAutoExpand.js";
import DropIndicator from "../components/FileTree/DropIndicator.jsx";
import Breadcrumbs from "../components/FileTree/Breadcrumbs.jsx";
import { copyFiles, cutFiles, getClipboardState, getRelativePath } from "../utils/clipboard.js";

import { isDesktop, isMobile } from '../platform/index.js';
import referenceManager from "../core/references/ReferenceManager.js";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

// Extracted layout components
import { TitleBar } from "./layout/TitleBar.jsx";
import { ActivityBar } from "./layout/ActivityBar.jsx";
import { BottomPanel } from "./layout/BottomPanel.jsx";
import { RightSidebar } from "./layout/RightSidebar.jsx";
import { LeftSidebar } from "./layout/LeftSidebar.jsx";
import { ModalLayer } from "./workspace/ModalLayer.jsx";
import { MainContent } from "./workspace/MainContent.jsx";

const MAX_OPEN_TABS = 10;


// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Draggable Column Hook ---
function useDragColumns({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500, initialLeft = 280, initialRight = 280 }) {
  const [leftW, setLeftW] = useState(initialLeft);
  const [rightW, setRightW] = useState(initialRight);
  const dragRef = useRef(null);

  const startLeftDrag = useCallback((e) => {
    dragRef.current = { side: "left", startX: e.clientX, left0: leftW, right0: rightW };

    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setLeftW(Math.min(maxLeft, Math.max(minLeft, d.left0 + (e.clientX - d.startX))));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftW, rightW, maxLeft, minLeft]);

  const startRightDrag = useCallback((e) => {
    dragRef.current = { side: "right", startX: e.clientX, left0: leftW, right0: rightW };

    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setRightW(Math.min(maxRight, Math.max(minRight, d.right0 - (e.clientX - d.startX))));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftW, rightW, maxRight, minRight]);

  return { leftW, rightW, startLeftDrag, startRightDrag };
}

// --- New Item Input ---
function NewItemInput({ type, onConfirm, level }) {                                                                                                                    
  const [name, setName] = useState("");                                                                                                                                
  const inputRef = useRef(null);                                                                                                                                       
                                                                                                                                                                        
  useEffect(() => {                                                                                                                                                    
    inputRef.current?.focus();                                                                                                                                         
  }, []);                                                                                                                                                              
                                                                                                                                                                        
  const handleKeyDown = (e) => {                                                                                                                                       
    if (e.key === "Enter") onConfirm(name);                                                                                                                            
    else if (e.key === "Escape") onConfirm(null);                                                                                                                      
  };                                                                                                                                                                   
                                                                                                                                                                        
  const icon = type === 'folder'                                                                                                                                       
    ? "M2.25 12.75V12A2.25..."                                                                                                                        
    : "M19.5 14.25v-2.625...";                                                                                                                        
                                                                                                                                                                        
  return (                                                                                                                                                             
    <li style={{ paddingLeft: `${level * 1.25}rem` }} className="flex items-center gap-2 px-2 py-1">                                                                   
      <Icon path={icon} className="w-4 h-4" />                                                                                                                         
      <input                                                                                                                                                           
        ref={inputRef}                                                                                                                                                 
        type="text"                                                                                                                                                    
        value={name}                                                                                                                                                   
        onChange={(e) => setName(e.target.value)}                                                                                                                      
        onKeyDown={handleKeyDown}                                                                                                                                      
        onBlur={() => onConfirm(name)}                                                                                                                                 
        className="bg-app-bg text-sm text-app-text outline-none w-full"                                                                                                
        placeholder={type === 'folder' ? "New folder..." : "New file..."}                                                                                              
      />                                                                                                                                                               
    </li>                                                                                                                                                              
  );                                                                                                                                                                   
}                  

// Helper to get filename without extension
function getNameWithoutExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex);
  }
  return filename;
}

// Helper to get extension (including the dot)
function getExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(lastDotIndex);
  }
  return '';
}

// --- Inline Rename Input Component ---
function InlineRenameInput({ initialValue, onSubmit, onCancel }) {
  // Store only the name without extension
  const extension = getExtension(initialValue);
  const nameOnly = getNameWithoutExtension(initialValue);
  const [value, setValue] = useState(nameOnly);
  const inputRef = useRef(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      // Use requestAnimationFrame to ensure selection happens after DOM paint
      const rafId = requestAnimationFrame(() => {
        if (inputRef.current && document.activeElement === inputRef.current) {
          inputRef.current.select();
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, []);

  const handleKeyDown = (e) => {
    // Stop propagation for ALL keys to prevent file tree shortcuts from firing
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      // Add extension back when submitting
      onSubmit(value + extension);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Add extension back when submitting
    onSubmit(value + extension);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="inline-rename-input"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// --- File Entry Component ---
function FileEntryComponent({ entry, level, onFileClick, activeFile, expandedFolders, toggleFolder, onRefresh, keymap, renamingPath, setRenamingPath, onViewHistory, setTagModalFile, setShowTagModal, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent, updateDropPosition, fileTreeRef, isExternalDragActive, hoveredFolder, setHoveredFolder, toast, onCheckReferences, onSelectEntry, isSelected, selectedPaths, setSelectedPaths, creatingItem, onCreateConfirm, onUpdateTabPath }) {
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
          // Check if this file is already loaded in the left pane to avoid duplicate load
          if (file.path === activeFile && editorContent) {
            setRightPaneContent(editorContent);
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
          const relativePath = getRelativePath(file.path, path);
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
          setSelectedFileForCompare(file);
          toast.success(`Selected for compare: ${file.name}`);
        }
        break;
      case 'compareWith':
        // Compare with previously selected file
        if (selectedFileForCompare && file.type === 'file') {
          // Open both files in split view for manual comparison
          onFileClick(selectedFileForCompare.path);
          setUseSplitView(true);
          setTimeout(() => {
            setRightPaneFile(file.path);
            setRightPaneTitle(file.name);
          }, 100);
          toast.success(`Comparing ${selectedFileForCompare.name} with ${file.name}`);
          setSelectedFileForCompare(null);
        }
        break;
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
          setShowTagModal(true);
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

// --- File Tree View Component ---
function FileTreeView({ entries, onFileClick, activeFile, onRefresh, expandedFolders, toggleFolder, creatingItem, onCreateConfirm, keymap, selectedPath, setSelectedPath, renamingPath, setRenamingPath, onViewHistory, setTagModalFile, setShowTagModal, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent, isExternalDragActive, hoveredFolder, setHoveredFolder, toast, onCheckReferences, workspacePath, onUpdateTabPath }) {
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
      const affectedFiles = await referenceManager.findAffectedFiles(oldPath);
      if (affectedFiles.length > 0) {
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

// --- OLD Tab Bar Component (for old split view) ---
function OldTabBar({ tabs, activeTab, onTabClick, onTabClose, unsavedChanges, onDragEnd, onNewTab, onSplitDragStart, onSplitDragEnd, useSplitView, onToggleSplitView, splitDirection, onToggleSplitDirection, syncScrolling, onToggleSyncScrolling, onResetPaneSize, isLeftPane = true, onToggleRightSidebar, showRightSidebar }) {
  const [activeId, setActiveId] = useState(null);
  const [draggedTab, setDraggedTab] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    const tab = tabs.find(t => t.path === active.id);
    setDraggedTab(tab);
    onSplitDragStart?.(tab);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    setDraggedTab(null);
    onSplitDragEnd?.(draggedTab);
    onDragEnd(event);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div data-tauri-drag-region className="h-12 shrink-0 flex items-end bg-app-panel border-b border-app-border px-0">
        <div data-tauri-drag-region="false" className="flex-1 flex items-center overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <DraggableTab
              key={tab.path}
              tab={tab}
              isActive={activeTab === tab.path}
              isUnsaved={unsavedChanges.has(tab.path)}
              onTabClick={onTabClick}
              onTabClose={onTabClose}
              onSplitDragStart={onSplitDragStart}
              onSplitDragEnd={onSplitDragEnd}
            />
          ))}
        </div>
        <div data-tauri-drag-region="false" className="flex items-center gap-1">
          <button
            onClick={onToggleSplitView}
            title={useSplitView ? "Exit split view" : "Enter split view"}
            className={`obsidian-button icon-only mb-1 ${useSplitView ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>

          {/* Split direction toggle - only show in split view and on left pane */}
          {useSplitView && isLeftPane && (
            <>
              <button
                onClick={onToggleSplitDirection}
                title={`Switch to ${splitDirection === 'vertical' ? 'horizontal' : 'vertical'} split`}
                className="obsidian-button icon-only mb-1"
              >
                {splitDirection === 'vertical' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6-6 6 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6 6 6-6" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l-6 6 6 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l6 6-6 6" />
                  </svg>
                )}
              </button>

              <button
                onClick={onResetPaneSize}
                title="Reset pane sizes (50/50)"
                className="obsidian-button icon-only mb-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>

              <button
                onClick={onToggleSyncScrolling}
                title={`${syncScrolling ? 'Disable' : 'Enable'} synchronized scrolling`}
                className={`obsidian-button icon-only mb-1 ${syncScrolling ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </button>
            </>
          )}

          {/* Outline toggle button - only show on main pane */}
          {isLeftPane && onToggleRightSidebar && (
            <button
              onClick={onToggleRightSidebar}
              title={showRightSidebar ? "Hide outline" : "Show outline"}
              className={`obsidian-button icon-only mb-1 ${showRightSidebar ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </button>
          )}

          <button
            onClick={onNewTab}
            title={`New file (${platformService.getModifierSymbol()}+N)`}
            className="obsidian-button icon-only mb-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeId && draggedTab ? (
          <div className="dragging-tab-preview" style={{
            opacity: 0.9,
            transform: 'rotate(-2deg)',
            zIndex: 99999
          }}>
            <div className="flex items-center gap-2 px-3 py-1 bg-app-surface border border-app-border rounded-md shadow-lg">
              <svg className="w-4 h-4 text-app-muted" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-app-text">
                {draggedTab.name.replace(/\.(md|txt|json|js|jsx|ts|tsx|py|html|css|canvas)$/, "") || draggedTab.name}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}



// --- Inner Workspace Component (with folder scope) ---
function WorkspaceWithScope({ path }) {
  const { theme: currentTheme } = useTheme();
  const { filterFileTree, scopeMode, scopedFolders } = useFolderScope();
  const { activeBase } = useBases();
  const { plugins } = usePlugins();
  const remoteLinks = useRemoteLinks();
  const remoteLinksRef = useRef(remoteLinks);
  const uiVisibility = useUIVisibility();
  const layoutDefaults = useLayoutDefaults();
  const featureFlags = useFeatureFlags();

  // Keep ref updated with latest links for event handlers
  useEffect(() => {
    remoteLinksRef.current = remoteLinks;
  }, [remoteLinks]);
  const { leftW, rightW, startLeftDrag, startRightDrag } = useDragColumns({
    initialLeft: layoutDefaults.left_sidebar_width,
    initialRight: layoutDefaults.right_sidebar_width,
  });
  const [showLeft, setShowLeft] = useState(layoutDefaults.left_sidebar_visible);
  const [showRight, setShowRight] = useState(layoutDefaults.right_sidebar_visible);
  const [refreshId, setRefreshId] = useState(0);

  // Toggle right sidebar (outline)
  const toggleRightSidebar = useCallback(() => {
    setShowRight(prev => !prev);
  }, []);

  // Version history state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistoryFile, setVersionHistoryFile] = useState(null);
  const [versionRefreshKey, setVersionRefreshKey] = useState(0); // Force refresh of version panel
  const [editor, setEditor] = useState(null);

  const lastVersionSaveRef = useRef({}); // Track last version save time per file
  const lastVersionContentRef = useRef({}); // Track last saved content per file

  const toggleVersionHistory = useCallback((file = null) => {
    if (file) {
      setVersionHistoryFile(file);
      setShowVersionHistory(true);
      setShowRight(true); // Ensure right sidebar is visible
    } else {
      setShowVersionHistory(prev => !prev);
    }
  }, []);
  const [selectedPath, setSelectedPath] = useState(null);
  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [creatingItem, setCreatingItem] = useState(null); 
  const [renamingPath, setRenamingPath] = useState(null);

  // External file drop state
  const [isExternalDragActive, setIsExternalDragActive] = useState(false);
  const [hoveredFolder, setHoveredFolder] = useState(null);

  // Check if we're in test mode
  const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
  const [keymap, setKeymap] = useState({});

  const [openTabs, setOpenTabs] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  const [recentlyClosedTabs, setRecentlyClosedTabs] = useState([]);

  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Source mode: files that crashed TipTap and are shown as raw textarea
  const [sourceModePaths, setSourceModePaths] = useState(new Set());

  // Reload current file after version restore
  const reloadCurrentFile = useCallback(async () => {
    if (!activeFile) return;

    try {
      const content = await invoke("read_file_content", { path: activeFile });
      const activeTab = openTabs.find(tab => tab.path === activeFile);

      if (activeTab) {
        const compiler = getMarkdownCompiler();
        let processedContent = content;

        if (activeTab.name.endsWith('.md') && (await compiler.isMarkdown(content))) {
          processedContent = await compiler.compile(content);
        }

        setEditorContent(processedContent);
        setSavedContent(content);

        // Clear unsaved changes for this file since we just reloaded
        setUnsavedChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(activeFile);
          return newSet;
        });
      }
    } catch { }
  }, [activeFile, openTabs]);

  // Listen for editor content errors to activate source mode
  useEffect(() => {
    const handleEditorContentError = (e) => {
      const filePath = e.detail?.filePath;
      if (filePath) {
        setSourceModePaths(prev => new Set(prev).add(filePath));
      }
    };
    window.addEventListener('lokus:editor-content-error', handleEditorContentError);
    return () => window.removeEventListener('lokus:editor-content-error', handleEditorContentError);
  }, []);

  // Exit source mode: remove from set and reload the file
  const handleExitSourceMode = useCallback(async (filePath) => {
    setSourceModePaths(prev => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
    // Only use reloadCurrentFile for the active file; for split-pane right file, reload separately
    if (filePath === stateRef.current.activeFile) {
      reloadCurrentFile();
    } else {
      // Right pane file — reload its content directly
      try {
        const content = await invoke("read_file_content", { path: filePath });
        const compiler = getMarkdownCompiler();
        let processedContent = content;
        if (filePath.endsWith('.md') && (await compiler.isMarkdown(content))) {
          processedContent = await compiler.compile(content);
        }
        setRightPaneContent(processedContent);
      } catch {}
    }
  }, [reloadCurrentFile]);

  // Editor groups system for VSCode-style split view
  const editorGroups = useEditorGroups(openTabs);
  const [recentFiles, setRecentFiles] = useState([]);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showInFileSearch, setShowInFileSearch] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  // Removed global context menu state - using component-specific context menus instead
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerData, setTemplatePickerData] = useState(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [createTemplateContent, setCreateTemplateContent] = useState('');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  // Starts the app with the Editor tab highlighted
  const [currentView, setCurrentView] = useState('editor');
  const [showKanban, setShowKanban] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showBases, setShowBases] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagModalFile, setTagModalFile] = useState(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [selectedFileForCompare, setSelectedFileForCompare] = useState(null);
  // Graph view now opens as a tab instead of sidebar panel
  const [showGraphView, setShowGraphView] = useState(false);
  const [showDailyNotesPanel, setShowDailyNotesPanel] = useState(false);
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [showTerminalPanel, setShowTerminalPanel] = useState(false);
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal'); // 'terminal' or 'output'
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const isResizingBottomPanelRef = useRef(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [currentDailyNoteDate, setCurrentDailyNoteDate] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  // Reference update modal state
  const [referenceUpdateModal, setReferenceUpdateModal] = useState({
    isOpen: false,
    oldPath: null,
    newPath: null,
    affectedFiles: [],
    isProcessing: false,
    result: null,
    pendingOperation: null, // Store the operation to execute after confirmation
  });

  // Image files state for navigation
  const [allImageFiles, setAllImageFiles] = useState([]);

  // Canvas preview state
  const [canvasPreview, setCanvasPreview] = useState(null);

  // Graph sidebar state
  const [graphSidebarData, setGraphSidebarData] = useState({
    selectedNodes: [],
    hoveredNode: null,
    graphData: { nodes: [], links: [] },
    stats: {}
  });

  // Persistent GraphEngine instance that survives tab switches
  const persistentGraphEngineRef = useRef(null);

  // Graph data processor instance
  const graphProcessorRef = useRef(null);

  // GraphData instance for backlinks
  const graphDataInstanceRef = useRef(null);
  // Split editor state
  const [useSplitView, setUseSplitView] = useState(false);
  const [splitDirection, setSplitDirection] = useState('vertical'); // 'vertical' or 'horizontal'
  const [leftPaneSize, setLeftPaneSize] = useState(50); // percentage
  const [draggedTabForSplit, setDraggedTabForSplit] = useState(null);
  const [splitInitData, setSplitInitData] = useState(null);
  const [rightPaneFile, setRightPaneFile] = useState(null);
  const [rightPaneContent, setRightPaneContent] = useState('');
  const [rightPaneTitle, setRightPaneTitle] = useState('');
  const [syncScrolling, setSyncScrolling] = useState(false);

  // --- Refs for stable callbacks ---
  const stateRef = useRef({});
  const editorRef = useRef(null);
  const leftPaneScrollRef = useRef(null);
  const rightPaneScrollRef = useRef(null);
  stateRef.current = {
    activeFile,
    openTabs,
    unsavedChanges,
    editorContent,
    editorTitle,
    savedContent,
    sourceModePaths,
  };

  // Handler for checking references before file move/rename
  const handleCheckReferences = useCallback(({ oldPath, newPath, affectedFiles, operation }) => {
    setReferenceUpdateModal({
      isOpen: true,
      oldPath,
      newPath,
      affectedFiles: affectedFiles.map(f => f.filePath),
      isProcessing: false,
      result: null,
      pendingOperation: operation,
    });
  }, []);

  // Handler for confirming reference updates
  const handleConfirmReferenceUpdate = useCallback(async (updateReferences) => {
    const { oldPath, newPath, pendingOperation } = referenceUpdateModal;

    setReferenceUpdateModal(prev => ({ ...prev, isProcessing: true }));

    try {
      // First, execute the move/rename operation
      const operationSuccess = await pendingOperation();

      if (!operationSuccess) {
        setReferenceUpdateModal(prev => ({
          ...prev,
          isProcessing: false,
          result: { success: false, error: 'Operation failed' }
        }));
        return;
      }

      // If user chose to update references, do it now
      if (updateReferences) {
        const result = await referenceManager.updateAllReferences(oldPath, newPath);
        setReferenceUpdateModal(prev => ({
          ...prev,
          isProcessing: false,
          result: { success: true, updated: result.updated, files: result.files }
        }));
      } else {
        // Just close after successful operation without updating references
        setReferenceUpdateModal({
          isOpen: false,
          oldPath: null,
          newPath: null,
          affectedFiles: [],
          isProcessing: false,
          result: null,
          pendingOperation: null,
        });
      }
    } catch (err) {
      setReferenceUpdateModal(prev => ({
        ...prev,
        isProcessing: false,
        result: { success: false, error: err.message || 'Failed to update references' }
      }));
    }
  }, [referenceUpdateModal]);

  // Handler for closing reference update modal
  const handleCloseReferenceModal = useCallback(() => {
    setReferenceUpdateModal({
      isOpen: false,
      oldPath: null,
      newPath: null,
      affectedFiles: [],
      isProcessing: false,
      result: null,
      pendingOperation: null,
    });
  }, []);

  // Helper function to get proper display name for special tabs
  const getTabDisplayName = useCallback((tabPath, pluginsList = []) => {
    if (tabPath === '__graph__') return 'Graph View';
    if (tabPath === '__kanban__') return 'Task Board';
    if (tabPath === '__bases__') return 'Bases';
    if (tabPath.startsWith('__plugin_') && tabPath.endsWith('__')) {
      // Extract plugin ID and look up name
      const pluginId = tabPath.slice(9, -2); // Remove "__plugin_" prefix and "__" suffix
      const plugin = pluginsList.find(p => p.id === pluginId || p.name === pluginId);
      return plugin ? plugin.name : 'Plugin';
    }
    // For regular files, extract filename
    return tabPath.split('/').pop();
  }, []);

  // Load session state on initial mount
  useEffect(() => {
    if (path) {
      // Load session and workspace files concurrently for faster startup
      Promise.all([
        invoke("load_session_state", { workspacePath: path }),
        invoke("validate_workspace_path", { path })
      ]).then(([session, valid]) => {
        if (session && session.open_tabs) {
          setExpandedFolders(new Set(session.expanded_folders || []));

          // Reconstruct tabs - plugin tabs will be hydrated when plugins load
          const tabsWithNames = session.open_tabs.map(p => ({
            path: p,
            name: getTabDisplayName(p, plugins)
          }));

          setOpenTabs(tabsWithNames);

          if (tabsWithNames.length > 0) {
            setActiveFile(tabsWithNames[0].path);
          }

          // Load recent files from session state if available, otherwise use open tabs
          if (session.recent_files && session.recent_files.length > 0) {
            setRecentFiles(session.recent_files.slice(0, 5).map(p => ({
              path: p,
              name: getFilename(p)
            })));
          } else {
            // Fallback: use open tabs as recent files
            const actualFiles = session.open_tabs.filter(p =>
              !p.startsWith('__') &&
              (p.endsWith('.md') || p.endsWith('.txt') || p.endsWith('.canvas') || p.endsWith('.kanban') || p.endsWith('.pdf'))
            );
            setRecentFiles(actualFiles.slice(0, 5).map(p => ({
              path: p,
              name: getFilename(p)
            })));
          }
        }
      }).catch(err => {
      });
    }
  }, [path]);

  // Rehydrate plugin tabs when plugins become available
  useEffect(() => {
    if (plugins.length > 0 && openTabs.length > 0) {
      setOpenTabs(prevTabs => {
        const needsUpdate = prevTabs.some(tab =>
          tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin
        );

        if (!needsUpdate) return prevTabs;

        return prevTabs
          .map(tab => {
            if (tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin) {
              const pluginId = tab.path.slice(9, -2);
              const plugin = plugins.find(p => p.id === pluginId || p.name === pluginId);
              if (plugin) {
                return { ...tab, name: plugin.name, plugin };
              }
            }
            return tab;
          })
          .filter(tab => {
            // Remove plugin tabs where plugin is not found (uninstalled)
            if (tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin) {
              return false;
            }
            return true;
          });
      });
    }
  }, [plugins]);

  // Insert images into editor at cursor position
  // Inserts WikiLink nodes directly with pre-resolved src to avoid race conditions
  const insertImagesIntoEditor = useCallback(async (imagePaths) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;

    // Import Tauri fs for reading images as data URLs
    const { readFile } = await import('@tauri-apps/plugin-fs');

    // Helper to convert extension to MIME type
    const extToMime = (ext) => {
      const map = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        bmp: 'image/bmp', tiff: 'image/tiff', avif: 'image/avif'
      };
      return map[ext?.toLowerCase()] || 'application/octet-stream';
    };

    for (const imagePath of imagePaths) {
      const fileName = imagePath.split('/').pop();

      // Read image as data URL for immediate rendering
      let src = '';
      try {
        const data = await readFile(imagePath);
        const ext = fileName.split('.').pop();
        const mime = extToMime(ext);
        // Convert Uint8Array to base64
        let binary = '';
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i]);
        }
        src = `data:${mime};base64,${btoa(binary)}`;
      } catch {
        // If read fails, src stays empty - image won't render but link will work
      }

      // Insert WikiLink node directly with pre-resolved src
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      editor.chain()
        .focus()
        .insertContent({
          type: 'wikiLink',
          attrs: {
            id,
            target: fileName,
            alt: '',
            embed: true,
            href: imagePath,
            src: src
          }
        })
        .run();
    }

    // Add a newline after all images
    editor.chain().focus().insertContent({ type: 'paragraph' }).run();

  }, []);

  // Track hovered folder in a ref to avoid re-registering listeners
  const hoveredFolderRef = useRef(hoveredFolder);
  useEffect(() => {
    hoveredFolderRef.current = hoveredFolder;
  }, [hoveredFolder]);

  // External file drop event listeners (Tauri 2.0 API)
  useEffect(() => {
    if (!path) {
      return;
    }

    let unlistenDrop;
    let unlistenOver;
    let unlistenLeave;
    let isCleanedUp = false;

    const setupFileDropListeners = async () => {
      try {
        // Tauri 2.0: Event names changed from file-drop to drag-drop
        // tauri://drag-drop - Files dropped
        unlistenDrop = await listen('tauri://drag-drop', async (event) => {
          if (isCleanedUp) return; // Guard against stale listeners

          const filePaths = event.payload.paths || event.payload;
          setIsExternalDragActive(false);

          try {
            // Determine destination folder (use ref to get current value)
            const targetFolder = hoveredFolderRef.current || null;

            // Copy files to workspace
            const result = await invoke('copy_external_files_to_workspace', {
              filePaths: filePaths,
              workspacePath: path,
              targetFolder: targetFolder,
            });

            // Refresh file tree if files were copied successfully
            if (result.success.length > 0) {
              handleRefreshFiles();

              // Auto-insert images into active editor
              const imageFiles = result.success.filter(p => isImageFile(p));
              if (imageFiles.length > 0 && editorRef.current) {
                insertImagesIntoEditor(imageFiles);
              }
            }

          } catch { } finally {
            setHoveredFolder(null);
          }
        });

        // tauri://drag-over - Files being dragged over window
        unlistenOver = await listen('tauri://drag-over', () => {
          if (isCleanedUp) return;
          setIsExternalDragActive(true);
        });

        // tauri://drag-leave - Drag left window
        unlistenLeave = await listen('tauri://drag-leave', () => {
          if (isCleanedUp) return;
          setIsExternalDragActive(false);
          setHoveredFolder(null);
        });

      } catch { }
    };

    setupFileDropListeners();

    return () => {
      isCleanedUp = true;
      if (unlistenDrop) unlistenDrop();
      if (unlistenOver) unlistenOver();
      if (unlistenLeave) unlistenLeave();
    };
  }, [path, insertImagesIntoEditor]); // Removed hoveredFolder from deps

  // Load shortcuts map for hints and keep it fresh
  useEffect(() => {
    getActiveShortcuts().then(setKeymap).catch(() => { });
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }
    if (isTauri) {
      const sub = listen('shortcuts:updated', async () => {
        const m = await getActiveShortcuts();
        setKeymap(m);
      });
      return () => { sub.then((un) => un()); };
    } else {
      const onDom = async () => { setKeymap(await getActiveShortcuts()); };
      window.addEventListener('shortcuts:updated', onDom);
      return () => window.removeEventListener('shortcuts:updated', onDom);
    }
  }, []);

  // Listen for markdown config changes from Preferences window
  useEffect(() => {
    let isTauri = false;
    try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }

    if (isTauri) {
      const sub = listen('lokus:markdown-config-changed', async () => {
        try {
          const markdownSyntaxConfig = (await import('../core/markdown/syntax-config.js')).default;
          await markdownSyntaxConfig.init();
        } catch { }
      });
      return () => { sub.then((un) => un()); };
    }
  }, []);

  // Save session state on change (debounced)
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (path) {
        const tabPaths = openTabs.map(t => t.path);
        const folderPaths = Array.from(expandedFolders);
        const recentPaths = recentFiles.map(f => f.path);
        invoke("save_session_state", { workspacePath: path, openTabs: tabPaths, expandedFolders: folderPaths, recentFiles: recentPaths });
      }
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [openTabs, expandedFolders, path, recentFiles]);

  // Fetch file tree
  useEffect(() => {
    if (path) {
      // Debug: Log to backend to see if this runs
      invoke("validate_workspace_path", { path }).then(valid => {
        if (valid) {
        }
      }).catch(err => {
      });

      try { window.__LOKUS_WORKSPACE_PATH__ = path; } catch { }
      invoke("read_workspace_files", { workspacePath: path })
        .then(files => {
          const filterIgnored = (entries) => {
            const ignoredNames = ['.lokus', '.DS_Store'];
            return entries
              .filter(entry => !ignoredNames.includes(entry.name))
              .map(entry => {
                if (entry.children) {
                  return { ...entry, children: filterIgnored(entry.children) };
                }
                return entry;
              });
          };
          const tree = filterIgnored(files);
          setFileTree(tree);
          // Build flat index for wiki suggestions
          const flat = [];
          const walk = (arr) => {
            for (const e of arr) {
              if (e.is_directory) { if (e.children) walk(e.children); }
              else flat.push({ title: e.name, path: e.path });
            }
          };
          walk(tree);
          try { window.__LOKUS_FILE_INDEX__ = flat; } catch { }

          // Initialize reference manager for tracking file links
          referenceManager.init(path);
          referenceManager.buildIndex(flat).catch(() => { });

          // Extract all image files for image viewer navigation
          const imageFiles = findImageFiles(tree);
          setAllImageFiles(imageFiles);
        })
        .catch((error) => {
          // Log to backend instead
          invoke("get_validated_workspace_path").then(() => {
            // Just trigger something to see the error in backend
          });
        });
    }
  }, [path, refreshId]);

  // Fetch content for active file
  useEffect(() => {
    if (activeFile) {
      try { window.__LOKUS_ACTIVE_FILE__ = activeFile; } catch { }

      // Skip loading content for special views and binary files
      if (
        activeFile.startsWith('__') ||
        activeFile.endsWith('.canvas') ||
        activeFile.endsWith('.kanban') ||
        activeFile.endsWith('.pdf') ||
        isImageFile(activeFile)
      ) {
        return;
      }

      // IMMEDIATE: Clear editor and show loading state
      setEditorContent("");
      setEditorTitle("");
      setIsLoadingContent(true);

      // Capture activeFile in local variable to prevent stale closure issues
      const fileToLoad = activeFile;

      invoke("read_file_content", { path: fileToLoad })
        .then(async content => {
          // Guard against stale promise resolutions - only update if this file is still active
          if (fileToLoad !== activeFile) {
            return;
          }

          const fileName = getFilename(fileToLoad);

          // Show first 10 lines of content
          const lines = content.split('\n');
          const preview = lines.slice(0, 10);
          preview.forEach((line, idx) => {
          });
          if (lines.length > 10) {
          }

          // Process markdown content to ensure proper formatting
          const compiler = getMarkdownCompiler();
          let processedContent = content;

          // If this is a markdown file and the content looks like markdown, process it
          if (fileToLoad.endsWith('.md') && (await compiler.isMarkdown(content))) {
            processedContent = await compiler.compile(content);
          }

          setEditorContent(processedContent);
          setEditorTitle(fileName.replace(/\.md$/, ""));
          setSavedContent(content); // Keep original content for saving
          setIsLoadingContent(false); // Loading complete
        })
        .catch(async (err) => {
          if (fileToLoad !== activeFile) {
            return;
          }

          // Check if the error is "file not found" - auto-create the file
          const errStr = String(err).toLowerCase();
          const isFileNotFound = errStr.includes('no such file') ||
                                 errStr.includes('not found') ||
                                 errStr.includes('os error 2');

          if (isFileNotFound && fileToLoad.endsWith('.md')) {
            try {
              // Auto-create the file with empty content
              await invoke("write_file_content", { path: fileToLoad, content: "" });

              // Set empty content for the new file
              const fileName = getFilename(fileToLoad);
              setEditorContent("");
              setEditorTitle(fileName.replace(/\.md$/, ""));
              setSavedContent("");
              setIsLoadingContent(false);

              // Refresh file index to include the new file
              try {
                const { emit } = await import('@tauri-apps/api/event');
                await emit('lokus:refresh-file-index');
              } catch {}

              return;
            } catch (createErr) {
              // If creation also fails, show the original error
              console.error('[Workspace] Failed to create file:', createErr);
            }
          }

          setIsLoadingContent(false);
          // Show error message in editor
          setEditorContent(`<div class="text-red-500 p-4">Failed to load file: ${err}</div>`);
          setEditorTitle("Error");
        });
    } else {
      setEditorContent("");
      setEditorTitle("");
      setIsLoadingContent(false);
    }
  }, [activeFile]);

  // Note: workspace:activate events are handled by useWorkspaceActivation in App.jsx
  // which passes the path down via props to this component

  // Open file events from editor (wiki link clicks)
  useEffect(() => {
    const openPath = (p, switchToTab = true) => {
      if (!p) return;

      setOpenTabs(prevTabs => {
        const name = getFilename(p);
        const wasAlreadyOpen = prevTabs.some(t => t.path === p);
        const newTabs = prevTabs.filter(t => t.path !== p);
        newTabs.unshift({ path: p, name });
        if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();

        return newTabs;
      });

      // Only switch to the new tab if requested (regular click)
      // For Cmd/Ctrl+Click, keep current tab active
      if (switchToTab) {
        setActiveFile(p);
      } else {
      }
    };

    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }
    if (isTauri) {
      const un1 = listen('lokus:open-file', (e) => openPath(String(e.payload || ''), true));
      const un2 = listen('lokus:open-file-new-tab', (e) => openPath(String(e.payload || ''), false));
      return () => { un1.then(u => u()); un2.then(u => u()); };
    } else {
      const onDom1 = (e) => openPath(String(e.detail || ''), true);
      const onDom2 = (e) => openPath(String(e.detail || ''), false);
      window.addEventListener('lokus:open-file', onDom1);
      window.addEventListener('lokus:open-file-new-tab', onDom2);
      return () => {
        window.removeEventListener('lokus:open-file', onDom1);
        window.removeEventListener('lokus:open-file-new-tab', onDom2);
      };
    }
  }, []);

  // Listen for immediate wiki link creation events from WikiLinkSuggest
  useEffect(() => {
    const handleWikiLinkCreated = async (event) => {
      const { sourceFile, targetFile, linkText, timestamp } = event.detail;

      if (graphProcessorRef.current) {
        try {
          // Get current editor content for real-time update
          const currentContent = editorRef.current ?
            (editorRef.current.getText() || stateRef.current.editorContent) :
            stateRef.current.editorContent;

          if (currentContent && sourceFile === stateRef.current.activeFile) {

            // Use the real-time update method
            const updateResult = await graphProcessorRef.current.updateFileContent(sourceFile, currentContent);

            // Update graph data if there were changes and graph is visible
            if ((updateResult.added > 0 || updateResult.removed > 0) && activeFile === '__graph__') {
              const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
              setGraphData(updatedGraphData);
            }
          }
        } catch { }
      }
    };

    // Listen for wiki link creation events
    window.addEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
    document.addEventListener('lokus:wiki-link-created', handleWikiLinkCreated);

    // Listen for block scroll requests (from wiki link clicks)
    const handleScrollToBlock = (e) => {
      const blockId = e.detail
      if (!blockId) return

      // Try scrolling multiple times with increasing delays (wait for editor to render)
      const attemptScroll = (delay, attemptNum) => {
        setTimeout(() => {

          const editorEl = document.querySelector('.tiptap.ProseMirror')
          if (!editorEl) {
            return
          }

          // Strategy 1: Look for elements with data-block-id attribute
          const blockWithId = editorEl.querySelector(`[data-block-id="${blockId}"]`)
          if (blockWithId) {
            blockWithId.scrollIntoView({ behavior: 'smooth', block: 'center' })

            // Highlight the parent element (usually a paragraph or heading)
            const target = blockWithId.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote') || blockWithId
            target.style.backgroundColor = 'rgba(255, 200, 0, 0.3)'
            setTimeout(() => { target.style.backgroundColor = '' }, 2000)

            return
          }

          // Strategy 2: Search headings
          const headings = editorEl.querySelectorAll('h1, h2, h3, h4, h5, h6')

          let foundHeading = null

          for (const heading of headings) {
            const headingText = heading.textContent.trim()

            // Check for explicit ID in heading (e.g., {#custom-id})
            const idMatch = headingText.match(/\{#([^}]+)\}/)
            if (idMatch && idMatch[1] === blockId) {
              foundHeading = heading
              break
            }

            // Generate slug from heading text
            const headingSlug = headingText
              .toLowerCase()
              .replace(/\{#[^}]+\}/g, '') // Remove explicit IDs
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
              .slice(0, 50)

            // Try slug match
            if (headingSlug === blockId.toLowerCase()) {
              foundHeading = heading
              break
            }

            // Try partial match
            const searchText = blockId.replace(/-/g, ' ').toLowerCase()
            if (headingText.toLowerCase().includes(searchText)) {
              foundHeading = heading
              break
            }
          }

          if (foundHeading) {
            foundHeading.scrollIntoView({ behavior: 'smooth', block: 'center' })

            // Highlight briefly
            foundHeading.style.backgroundColor = 'rgba(255, 200, 0, 0.3)'
            setTimeout(() => {
              foundHeading.style.backgroundColor = ''
            }, 2000)

          } else {
            if (attemptNum === 3) {
            }
          }
        }, delay)
      }

      // Try multiple times with increasing delays
      attemptScroll(100, 1)
      attemptScroll(300, 2)
      attemptScroll(600, 3)
    }

    window.addEventListener('lokus:scroll-to-block', handleScrollToBlock)

    return () => {
      window.removeEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
      document.removeEventListener('lokus:wiki-link-created', handleWikiLinkCreated);
      window.removeEventListener('lokus:scroll-to-block', handleScrollToBlock)
    };
  }, [activeFile]);

  // Canvas link hover preview
  useEffect(() => {
    const handleCanvasLinkHover = async (event) => {
      const { canvasName, canvasPath, position } = event.detail;
      setCanvasPreview({ canvasName, canvasPath, position, loading: true });

      // Generate preview (async)
      try {
        const thumbnailUrl = await generatePreview(canvasPath);
        setCanvasPreview(prev =>
          prev?.canvasPath === canvasPath
            ? { ...prev, thumbnailUrl, loading: false }
            : null
        );
      } catch (error) {
        setCanvasPreview(prev =>
          prev?.canvasPath === canvasPath
            ? { ...prev, error: true, loading: false }
            : null
        );
      }
    };

    const handleCanvasLinkHoverEnd = () => {
      setCanvasPreview(null);
    };

    const handleOpenCanvas = (event) => {
      let { canvasPath } = event.detail;

      // Resolve path if it's not absolute (just a canvas name)
      if (canvasPath && !canvasPath.startsWith('/') && !canvasPath.includes('/')) {
        const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
        const canvasFileName = canvasPath.endsWith('.canvas') ? canvasPath : `${canvasPath}.canvas`;

        const matchedFile = fileIndex.find(file => {
          const fileName = file.name || file.path.split('/').pop();
          return fileName === canvasFileName || fileName === canvasPath;
        });

        if (matchedFile) {
          canvasPath = matchedFile.path;
        }
      }

      // Open canvas file directly using the same logic as openPath
      if (canvasPath) {
        const name = canvasPath.split('/').pop() || canvasPath;
        setOpenTabs(prevTabs => {
          const newTabs = prevTabs.filter(t => t.path !== canvasPath);
          newTabs.unshift({ path: canvasPath, name });
          if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
          return newTabs;
        });
        setActiveFile(canvasPath);
      }
    };

    window.addEventListener('canvas-link-hover', handleCanvasLinkHover);
    window.addEventListener('canvas-link-hover-end', handleCanvasLinkHoverEnd);
    window.addEventListener('lokus:open-canvas', handleOpenCanvas);

    return () => {
      window.removeEventListener('canvas-link-hover', handleCanvasLinkHover);
      window.removeEventListener('canvas-link-hover-end', handleCanvasLinkHoverEnd);
      window.removeEventListener('lokus:open-canvas', handleOpenCanvas);
    };
  }, []);

  // Tab navigation shortcuts with throttling
  useEffect(() => {
    // Throttle utility function - executes immediately but prevents rapid successive calls
    const throttle = (func, wait) => {
      let lastTime = 0;
      return function executedFunction(...args) {
        const now = Date.now();
        if (now - lastTime >= wait) {
          lastTime = now;
          func(...args);
        }
      };
    };

    const handleNextTabImmediate = () => {
      if (openTabs.length <= 1) return;
      const currentIndex = openTabs.findIndex(tab => tab.path === activeFile);
      const nextIndex = (currentIndex + 1) % openTabs.length;
      setActiveFile(openTabs[nextIndex].path);
    };

    const handlePrevTabImmediate = () => {
      if (openTabs.length <= 1) return;
      const currentIndex = openTabs.findIndex(tab => tab.path === activeFile);
      const prevIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
      setActiveFile(openTabs[prevIndex].path);
    };

    // Throttled versions with 200ms cooldown
    const handleNextTab = throttle(handleNextTabImmediate, 200);
    const handlePrevTab = throttle(handlePrevTabImmediate, 200);

    let isTauri = false;
    try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }

    if (isTauri) {
      const nextTabSub = listen('lokus:next-tab', handleNextTab);
      const prevTabSub = listen('lokus:prev-tab', handlePrevTab);
      return () => {
        nextTabSub.then(u => u());
        prevTabSub.then(u => u());
      };
    } else {
      const onNextTab = () => handleNextTab();
      const onPrevTab = () => handlePrevTab();

      window.addEventListener('lokus:next-tab', onNextTab);
      window.addEventListener('lokus:prev-tab', onPrevTab);

      return () => {
        window.removeEventListener('lokus:next-tab', onNextTab);
        window.removeEventListener('lokus:prev-tab', onPrevTab);
      };
    }
  }, [openTabs, activeFile]);

  // Direct keyboard handler for Ctrl+Tab (fallback if menu doesn't work)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Tab or Ctrl+Shift+Tab
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();

        if (openTabs.length <= 1) return;

        const currentIndex = openTabs.findIndex(tab => tab.path === activeFile);

        if (e.shiftKey) {
          // Previous tab
          const prevIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
          setActiveFile(openTabs[prevIndex].path);
        } else {
          // Next tab
          const nextIndex = (currentIndex + 1) % openTabs.length;
          setActiveFile(openTabs[nextIndex].path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [openTabs, activeFile]);

  // Global right-click context menu
  // Removed global context menu handler - context menus are now component-specific
  // EditorContextMenu handles editor right-clicks, FileContextMenu handles file sidebar right-clicks

  const handleRefreshFiles = () => setRefreshId(id => id + 1);

  const handleOpenPluginDetail = (plugin) => {
    const pluginPath = `__plugin_${plugin.id}__`;
    const pluginName = `${plugin.name} Plugin`;

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== pluginPath);
      newTabs.unshift({ path: pluginPath, name: pluginName, plugin });
      if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
      return newTabs;
    });
    setActiveFile(pluginPath);
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const closeAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const handleFileOpen = (file) => {
    // Handle search result format with line numbers
    if (file.path && file.lineNumber !== undefined) {
      const filePath = file.path;
      const fileName = getFilename(filePath);

      setOpenTabs(prevTabs => {
        const newTabs = prevTabs.filter(t => t.path !== filePath);
        newTabs.unshift({ path: filePath, name: fileName });
        if (newTabs.length > MAX_OPEN_TABS) {
          newTabs.pop();
        }
        return newTabs;
      });
      setActiveFile(filePath);

      // Update recent files list
      if (!filePath.startsWith('__') && (filePath.endsWith('.md') || filePath.endsWith('.txt') || filePath.endsWith('.canvas') || filePath.endsWith('.kanban') || filePath.endsWith('.pdf'))) {
        setRecentFiles(prev => {
          const filtered = prev.filter(f => f.path !== filePath);
          const newRecent = [{ path: filePath, name: fileName }, ...filtered].slice(0, 5);
          return newRecent;
        });
      }

      // Jump to line after editor loads (only for non-image files)
      if (!isImageFile(filePath)) {
        setTimeout(() => {
          if (editorRef.current && file.lineNumber) {
            try {
              const doc = editorRef.current.state.doc;
              const linePos = doc.line(file.lineNumber).from + (file.column || 0);
              const selection = editorRef.current.state.selection.constructor.create(doc, linePos, linePos);
              const tr = editorRef.current.state.tr.setSelection(selection);
              editorRef.current.view.dispatch(tr);
              editorRef.current.commands.scrollIntoView();
            } catch { }
          }
        }, 100);
      }
      return;
    }

    // Handle regular file format
    if (file.is_directory) return;

    // Add file to tabs (works for all file types including images)
    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== file.path);
      // Ensure we only use the filename, not a full path
      const fileName = getFilename(file.name);
      newTabs.unshift({ path: file.path, name: fileName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(file.path);

    // Update recent files list
    if (!file.path.startsWith('__') && (file.path.endsWith('.md') || file.path.endsWith('.txt') || file.path.endsWith('.canvas') || file.path.endsWith('.kanban') || file.path.endsWith('.pdf'))) {
      const fileName = getFilename(file.name || file.path);
      setRecentFiles(prev => {
        const filtered = prev.filter(f => f.path !== file.path);
        const newRecent = [{ path: file.path, name: fileName }, ...filtered].slice(0, 5);
        return newRecent;
      });
    }
  };

  const handleReopenClosedTab = useCallback(() => {
    if (recentlyClosedTabs.length === 0) return;

    const [mostRecentTab, ...remaining] = recentlyClosedTabs;

    // Remove from recently closed list
    setRecentlyClosedTabs(remaining);

    // Reopen the tab
    handleFileOpen(mostRecentTab);
  }, [recentlyClosedTabs]);

  // handleOpenFullKanban removed - use file-based kanban boards instead

  const handleTabClick = (path) => {
    setActiveFile(path);

    // If split view is active, update the right pane to show the next tab
    if (useSplitView) {
      const currentIndex = openTabs.findIndex(t => t.path === path);
      const nextTab = openTabs[currentIndex + 1] || openTabs[0];
      if (nextTab && nextTab.path !== path) {
        setRightPaneFile(nextTab.path);
        // Extract just the filename in case name contains a path
        const fileName = getFilename(nextTab.name);
        setRightPaneTitle(fileName.replace(/\.md$/, ""));
        if (nextTab.path.endsWith('.md') || nextTab.path.endsWith('.txt')) {
          // Check if this file is already loaded in the left pane
          if (nextTab.path === path && editorContent) {
            setRightPaneContent(editorContent);
          } else {
            invoke("read_file_content", { path: nextTab.path })
              .then(content => {
                setRightPaneContent(content || '');
              })
              .catch(err => {
                setRightPaneContent('');
              });
          }
        }
      }
    }
  };

  // Ref to track last close timestamp for debouncing (global for any tab)
  const lastCloseTimeRef = useRef(0);
  const isShowingDialogRef = useRef(false);
  const currentlyClosingPathRef = useRef(null);

  const handleTabClose = useCallback(async (path) => {
    // Prevent closing the same tab multiple times
    if (currentlyClosingPathRef.current === path) {
      return;
    }

    // Prevent multiple dialogs from showing
    if (isShowingDialogRef.current) {
      return;
    }

    // Global debounce: ignore ANY tab close within 200ms of the last one
    const now = Date.now();
    if (now - lastCloseTimeRef.current < 200) {
      return;
    }
    lastCloseTimeRef.current = now;

    const closeTab = () => {
      setOpenTabs(prevTabs => {
        const tabIndex = prevTabs.findIndex(t => t.path === path);
        const closedTab = prevTabs.find(t => t.path === path);
        const newTabs = prevTabs.filter(t => t.path !== path);

        // Save the closed tab to recently closed list (max 10 items)
        if (closedTab && !closedTab.path.startsWith('__')) { // Don't track special tabs like graph, kanban
          setRecentlyClosedTabs(prev => {
            const newClosed = [{ ...closedTab, closedAt: Date.now() }, ...prev.slice(0, 9)];
            return newClosed;
          });
        }

        if (stateRef.current.activeFile === path) {
          if (newTabs.length === 0) {
            setActiveFile(null);
          } else {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            setActiveFile(newTabs[newActiveIndex].path);
          }
        }
        return newTabs;
      });
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    };

    if (stateRef.current.unsavedChanges.has(path)) {
      try {
        currentlyClosingPathRef.current = path;
        isShowingDialogRef.current = true;

        const confirmed = await confirm("You have unsaved changes. Close without saving?", {
          title: "Unsaved Changes",
          type: "warning",
        });

        if (confirmed) {
          closeTab();
        } else {
        }
      } catch { } finally {
        isShowingDialogRef.current = false;
        currentlyClosingPathRef.current = null;
      }
    } else {
      currentlyClosingPathRef.current = path;
      closeTab();
      currentlyClosingPathRef.current = null;
    }
  }, []);

  const handleEditorChange = useCallback((newContent) => {
    setEditorContent(newContent);
    if (!stateRef.current.activeFile) return;
    setUnsavedChanges(prev => {
      const next = new Set(prev);
      if (newContent !== stateRef.current.savedContent) {
        next.add(stateRef.current.activeFile);
      } else {
        next.delete(stateRef.current.activeFile);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const { activeFile, openTabs, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    let path_to_save = activeFile;
    let needsStateUpdate = false;
    const saveStartTime = performance.now();

    try {
      const currentTab = openTabs.find(t => t.path === activeFile);
      const currentName = currentTab.name.replace(/\.md$/, "");

      if (editorTitle !== currentName && editorTitle.trim() !== "") {
        const newFileName = `${editorTitle.trim()}.md`;
        const newPath = await invoke("rename_file", { path: activeFile, newName: newFileName });
        editorGroups.updateTabPath(activeFile, newPath);
        path_to_save = newPath;
        needsStateUpdate = true;
      }

      // For .md files, we need to convert HTML content back to markdown
      // If file is in source mode, content is already raw markdown — skip conversion
      let contentToSave = editorContent;
      if (stateRef.current.sourceModePaths?.has(path_to_save)) {
        // Already raw markdown from the textarea, use as-is
      } else if (path_to_save.endsWith('.md')) {
        // Convert HTML back to markdown, preserving wiki links
        const exporter = new MarkdownExporter();
        contentToSave = exporter.htmlToMarkdown(editorContent, { preserveWikiLinks: true });
      }

      await invoke("write_file_content", { path: path_to_save, content: contentToSave });

      setSavedContent(editorContent);
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeFile);
        newSet.delete(path_to_save);
        return newSet;
      });

      // Save version only if content actually changed
      const lastContent = lastVersionContentRef.current[path_to_save];
      const contentChanged = !lastContent || lastContent !== contentToSave;

      if (contentChanged) {
        try {
          await invoke("save_file_version_manual", {
            path: path_to_save,
            content: contentToSave
          });
          const now = Date.now();
          lastVersionSaveRef.current[path_to_save] = now;
          lastVersionContentRef.current[path_to_save] = contentToSave;

          // Refresh version history panel
          setVersionRefreshKey(prev => prev + 1);

        } catch (error) {
          // Non-blocking - don't show error to user
        }
      } else {
      }

      if (needsStateUpdate) {
        const newName = path_to_save.split("/").pop();
        setOpenTabs(tabs => tabs.map(t => t.path === activeFile ? { path: path_to_save, name: newName } : t));
        setActiveFile(path_to_save);
        handleRefreshFiles();
      } else {
        // File content changed but not renamed - use real-time link tracking
        if (graphProcessorRef.current) {
          try {
            // Use the new real-time update method for file content
            const updateResult = await graphProcessorRef.current.updateFileContent(path_to_save, editorContent);

            // Only rebuild graph structure if there were actual changes
            if (updateResult.added > 0 || updateResult.removed > 0) {
              const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
              setGraphData(updatedGraphData);
            } else {
            }
          } catch (error) {
            // Fallback to full selective update
            try {
              const updatedGraphData = await graphProcessorRef.current.updateChangedFiles([path_to_save]);
              if (updatedGraphData) {
                setGraphData(updatedGraphData);
              }
            } catch (fallbackError) {
              // Final fallback to full refresh
              handleRefreshFiles();
            }
          }
        } else {
          // Graph processor not initialized yet, but if graph view becomes active,
          // it will build the graph data including this file's changes
        }
      }
    } catch { }
  }, []);

  const handleSaveAs = useCallback(async () => {
    const { activeFile, editorContent } = stateRef.current;
    if (!activeFile) return;

    try {
      // Get the current file name without extension for default name
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');

      // Show save dialog with more format options
      const filePath = await save({
        defaultPath: `${currentFileName}.md`,
        filters: [{
          name: 'Markdown',
          extensions: ['md']
        }, {
          name: 'HTML',
          extensions: ['html']
        }, {
          name: 'Text',
          extensions: ['txt']
        }, {
          name: 'JSON',
          extensions: ['json']
        }, {
          name: 'All Files',
          extensions: ['*']
        }],
        title: 'Save As'
      });

      if (filePath) {
        // Prepare content - handle different file types
        let contentToSave = editorContent;

        if (filePath.endsWith('.html')) {
          // For HTML files, wrap content in a complete HTML document
          const { editorTitle } = stateRef.current;
          const title = editorTitle || currentFileName;
          contentToSave = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
        }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
    </style>
</head>
<body>
    ${editorContent}
</body>
</html>`;
        } else if (filePath.endsWith('.json')) {
          // For JSON files, create a structured export
          const { editorTitle } = stateRef.current;
          contentToSave = JSON.stringify({
            title: editorTitle || currentFileName,
            content: editorContent,
            exported: new Date().toISOString(),
            format: 'html'
          }, null, 2);
        } else if (filePath.endsWith('.txt')) {
          // For text files, strip HTML tags
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = editorContent;
          contentToSave = tempDiv.textContent || tempDiv.innerText || '';
        }

        // Save the file
        await invoke("write_file_content", { path: filePath, content: contentToSave });

        // Update current file state to point to new location
        const newFileName = filePath.split('/').pop();
        setOpenTabs(tabs => tabs.map(t => t.path === activeFile ? { path: filePath, name: newFileName } : t));
        setActiveFile(filePath);
        setSavedContent(editorContent);
        setUnsavedChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(activeFile);
          newSet.delete(filePath);
          return newSet;
        });

        // Refresh file tree to show new file
        handleRefreshFiles();

      }
    } catch { }
  }, []);

  const handleExportHtml = useCallback(async () => {
    const { activeFile, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    try {
      // Get the current file name without extension for default name
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');
      const exportFileName = editorTitle.trim() || currentFileName;

      // Show save dialog for HTML export
      const filePath = await save({
        defaultPath: `${exportFileName}.html`,
        filters: [{
          name: 'HTML',
          extensions: ['html']
        }, {
          name: 'All Files',
          extensions: ['*']
        }],
        title: 'Export as HTML'
      });

      if (filePath) {
        // Create a complete HTML document with proper styling and math support
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${exportFileName}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2em;
            margin-bottom: 0.5em;
        }
        h1 { font-size: 2.5em; border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
        h2 { font-size: 2em; }
        h3 { font-size: 1.5em; }
        p { margin-bottom: 1em; }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 1.5em 0;
            color: #7f8c8d;
            font-style: italic;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
        }
        pre {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #e1e5e9;
        }
        pre code {
            background: none;
            padding: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5em 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        ul, ol { margin-bottom: 1em; }
        li { margin-bottom: 0.5em; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .math-display { text-align: center; margin: 1.5em 0; }
        .highlight { background: #fff3cd; padding: 2px 4px; }
        .task-list-item { list-style-type: none; }
        .task-list-item input[type="checkbox"] { margin-right: 8px; }
    </style>
</head>
<body>
    <article class="content">
        ${editorContent}
    </article>
</body>
</html>`;

        // Save the HTML file
        await invoke("write_file_content", { path: filePath, content: htmlContent });

      }
    } catch (error) {
      posthog.trackError('export_failed', 'workspace', true);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    const { activeFile, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    try {
      // Get the current file name without extension for default name
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');
      const exportFileName = editorTitle.trim() || currentFileName;

      // Show save dialog for PDF export
      const filePath = await save({
        defaultPath: `${exportFileName}.pdf`,
        filters: [{
          name: 'PDF',
          extensions: ['pdf']
        }, {
          name: 'All Files',
          extensions: ['*']
        }],
        title: 'Export as PDF'
      });

      if (filePath) {
        // Create HTML content for PDF conversion
        const htmlForPdf = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${exportFileName}</title>
    <style>
        @page {
            margin: 1in;
            size: letter;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 14px;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            break-after: avoid;
        }
        h1 {
            font-size: 24px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 0.3em;
            page-break-after: avoid;
        }
        h2 { font-size: 20px; }
        h3 { font-size: 18px; }
        h4 { font-size: 16px; }
        h5 { font-size: 14px; }
        h6 { font-size: 12px; }
        p {
            margin-bottom: 1em;
            orphans: 3;
            widows: 3;
        }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 1em 0;
            color: #7f8c8d;
            font-style: italic;
            break-inside: avoid;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 12px;
            break-inside: avoid;
        }
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e1e5e9;
            break-inside: avoid;
            font-size: 12px;
            line-height: 1.4;
            overflow-x: hidden;
        }
        pre code {
            background: none;
            padding: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            break-inside: avoid;
            font-size: 12px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        ul, ol {
            margin-bottom: 1em;
            break-inside: avoid;
        }
        li {
            margin-bottom: 0.3em;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        .math-display {
            text-align: center;
            margin: 1em 0;
            break-inside: avoid;
        }
        .highlight {
            background: #fff3cd;
            padding: 2px 4px;
        }
        .task-list-item {
            list-style-type: none;
        }
        .task-list-item input[type="checkbox"] {
            margin-right: 8px;
        }
        .page-break {
            page-break-before: always;
        }
        img {
            max-width: 100%;
            height: auto;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <article class="content">
        ${editorContent}
    </article>
</body>
</html>`;

        // Create a hidden iframe for PDF generation
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        // Write content to iframe
        iframe.contentDocument.write(htmlForPdf);
        iframe.contentDocument.close();

        // Wait for content to load
        await new Promise(resolve => {
          iframe.onload = resolve;
          setTimeout(resolve, 500);
        });

        // Use browser print dialog to save as PDF
        iframe.contentWindow.print();

        // Cleanup after a delay
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    } catch (error) {
      posthog.trackError('export_failed', 'workspace', true);
    }
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    try {

      // Ensure current theme is saved globally so launcher window inherits it
      if (currentTheme) {
        await setGlobalActiveTheme(currentTheme);
      }

      // First clear the saved workspace to ensure launcher shows
      await invoke('clear_last_workspace');

      // Use backend command to create launcher window (same approach as preferences)
      await invoke('open_launcher_window');
    } catch { }
  }, [currentTheme]);

  // Helper function to determine target path for file creation
  // Priority: 1. Bases folder, 2. Local scope folder, 3. Workspace root
  const getTargetPath = useCallback(() => {
    // Priority 1: If bases tab is open and has an active base
    const findEntry = (entries, targetPath) => {
        for (const entry of entries) {
          if (entry.path === targetPath) {
            return entry;
          }
          if (entry.is_directory && entry.children) {
            const found = findEntry(entry.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      }


    if (selectedPath) {                                                                                                                                                  
      const selectedEntry = findEntry(fileTree, selectedPath);                                                                                                           
      if (selectedEntry) {                                                                                                                                               
        if (selectedEntry.is_directory) {                                                                                                                                
          return selectedEntry.path;                                                                                                                                     
        } else {                                                                                                                                                         
          return selectedPath.split('/').slice(0, -1).join('/') || path;                                                                                                 
        }                                                                                                                                                                
      }                                                                                                                                                                  
    }  

    const hasBasesTab = openTabs.some(tab => tab.path === '__bases__');
    if (hasBasesTab && activeBase?.sourceFolder) {
      return activeBase.sourceFolder;
    }

    // Priority 2: If in local scope mode with folders selected
    if (expandedFolders.size > 0) {
      const expandedArray = Array.from(expandedFolders);
      const deepestFolder = expandedArray.reduce((deepest, current) => {
        return current.length > deepest.length ? current : deepest;
      }, expandedArray[0]);
      return deepestFolder;
    }

    if (scopeMode === 'local' && scopedFolders.length > 0) {
      // Use the first scoped folder as the default target
      return scopedFolders[0];
    }

    // Priority 3: Workspace root
    return path;
  }, [selectedPath, fileTree, expandedFolders, openTabs, activeBase, scopeMode, scopedFolders, path]);

  const handleCreateFile = () => {
    const targetPath = getTargetPath();
    if (targetPath !== path) {
      setExpandedFolders(prev => new Set([...prev, targetPath]));
    }
    setCreatingItem({ type: 'file', targetPath });
  };

  const handleCreateCanvas = async () => {
    // Check feature flag before creating canvas
    if (!featureFlags.enable_canvas) {
      return;
    }
    try {
      const targetPath = getTargetPath();
      const newCanvasPath = await canvasManager.createCanvas(targetPath, "Untitled Canvas");
      handleRefreshFiles();
      handleFileOpen({ path: newCanvasPath, name: "Untitled Canvas.canvas", is_directory: false });
      posthog.trackFeatureActivation('canvas');
    } catch { }
  };

  const handleCreateKanban = async () => {
    try {
      const targetPath = getTargetPath();
      // Create a real kanban board with file-based storage
      const board = await invoke("create_kanban_board", {
        workspacePath: targetPath,
        name: "New Board",
        columns: ["To Do", "In Progress", "Done"]
      });
      handleRefreshFiles();
      const fileName = "New Board.kanban";
      const boardPath = `${targetPath}/${fileName}`;
      handleFileOpen({ path: boardPath, name: fileName, is_directory: false });
      posthog.trackFeatureActivation('database');
    } catch { }
  };

  const handleKanbanBoardAction = async (action, board, refreshBoards) => {
    switch (action) {
      case 'revealInFinder':
        try {
          await invoke('platform_reveal_in_file_manager', { path: board.path });
        } catch (err) {
          console.error('Failed to reveal board in finder', err);
          toast.error('Failed to reveal in finder');
        }
        break;
      case 'copyPath':
        try {
          await navigator.clipboard.writeText(board.path);
          toast.success('Board path copied');
        } catch (err) {
          toast.error('Failed to copy path');
        }
        break;
      case 'duplicate':
        try {
          const content = await invoke('read_file_content', { path: board.path });
          const dirPath = board.path.split('/').slice(0, -1).join('/');
          const baseName = board.name.replace(/\.kanban$/, '');
          const newName = `${baseName} copy.kanban`;
          const newPath = `${dirPath}/${newName}`;
          await invoke('write_file_content', { path: newPath, content });
          refreshBoards?.();
          toast.success(`Duplicated: ${newName}`);
        } catch (err) {
          toast.error('Failed to duplicate board');
        }
        break;
      case 'export':
        try {
          const content = await invoke('read_file_content', { path: board.path });
          const blob = new Blob([content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${board.name}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Board exported');
        } catch (err) {
          toast.error('Failed to export board');
        }
        break;
      // rename is handled locally in KanbanList with inline input
      case 'delete':
        try {
          const confirmed = await confirm(`Are you sure you want to delete "${board.name}"?`);
          if (confirmed) {
            await invoke('delete_file', { path: board.path });
            refreshBoards?.();
            toast.success(`Deleted: ${board.name}`);
          }
        } catch (err) {
          toast.error('Failed to delete board');
        }
        break;
      default:
        break;
    }
  };

  const handleOpenDailyNote = async () => {
    try {
      const result = await dailyNotesManager.openToday();
      const fileName = result.path.split('/').pop();

      handleFileOpen({
        path: result.path,
        name: fileName,
        is_directory: false
      });

      if (result.created) {
        handleRefreshFiles();
      }

      posthog.trackFeatureActivation('daily_notes');
    } catch { }
  };

  const handleOpenDailyNoteByDate = async (date) => {
    try {
      const result = await dailyNotesManager.openDate(date);
      const fileName = result.path.split('/').pop();

      handleFileOpen({
        path: result.path,
        name: fileName,
        is_directory: false
      });

      if (result.created) {
        handleRefreshFiles();
      }

      setShowDatePickerModal(false);

      posthog.trackFeatureActivation('daily_notes');
    } catch { }
  };

  // Check if a file path is a daily note
  const isDailyNotePath = (filePath) => {
    if (!filePath || !path) return false;

    const config = dailyNotesManager.getConfig();
    const dailyNotesFolder = joinPath(path, config.folder);

    return filePath.startsWith(dailyNotesFolder) && filePath.endsWith('.md');
  };

  // Extract date from daily note filename
  const getDailyNoteDate = (filePath) => {
    if (!isDailyNotePath(filePath)) return null;

    try {
      const fileName = filePath.split('/').pop().replace('.md', '');
      const date = dailyNotesManager.parseDate(fileName);
      return date;
    } catch (error) {
      return null;
    }
  };

  const handleCreateFolder = () => {
    const targetPath = getTargetPath();
    if (targetPath !== path) {
      setExpandedFolders(prev => new Set([...prev, targetPath]));
    }
    setCreatingItem({type: 'folder', targetPath});
  };

  const handleConfirmCreate = async (name) => {                                                                                                                          
    if (!creatingItem || !name) {                                                                                                                                        
      setCreatingItem(null);                                                                                                                                             
      return;                                                                                                                                                            
    }                                                                                                                                                                    
                                                                                                                                                                          
    try {
      if (creatingItem.type === 'file') {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const newPath = await invoke("create_file_in_workspace", {
          workspacePath: creatingItem.targetPath,
          name: fileName
        });
        handleRefreshFiles();
        handleFileOpen({ path: newPath, name: fileName, is_directory: false });
      } else {
        await invoke("create_folder_in_workspace", {
          workspacePath: creatingItem.targetPath,
          name
        });
        handleRefreshFiles();
      }
    } catch (e) {
      console.error('Failed to create:', e);
    }                                                                                                                                                                    
                                                                                                                                                                          
    setCreatingItem(null);                                                                                                                                               
  }; 

  const handleCreateTemplate = useCallback(() => {
    // Get content from editor - extract HTML for proper markdown conversion
    const getContentForTemplate = () => {
      if (editorRef.current) {
        const { state } = editorRef.current;
        const { selection } = state;

        // Check if there's a selection
        if (!selection.empty) {
          // Get HTML for selected content to preserve formatting

          // Create a fragment from selection
          const fragment = state.doc.slice(selection.from, selection.to);

          // Convert fragment to HTML using the editor
          // We'll use getHTML() and then extract just the selected portion
          // For now, get the full HTML and we'll rely on CreateTemplate to convert it
          const selectedHTML = editorRef.current.getHTML ? editorRef.current.getHTML() : '';

          // Fallback: if HTML extraction fails, use plaintext
          if (!selectedHTML || !selectedHTML.includes('<')) {
            const selectedText = state.doc.textBetween(selection.from, selection.to);
            return selectedText;
          }

          return selectedHTML;
        } else if (activeFile) {
          // No selection, use current editor content as HTML

          // First try to get HTML from editor (preserves rich formatting)
          const editorHTML = editorRef.current.getHTML ? editorRef.current.getHTML() : null;

          if (editorHTML && editorHTML.includes('<')) {
            return editorHTML;
          }

          // Fallback to saved markdown content if HTML extraction fails
          const currentContent = stateRef.current.savedContent || '';
          return currentContent;
        }
      }
      return '';
    };

    const contentForTemplate = getContentForTemplate();
    setCreateTemplateContent(contentForTemplate);
    setShowCreateTemplate(true);
  }, [activeFile]);

  const handleCreateTemplateSaved = useCallback(() => {
    // Template was saved successfully
    setShowCreateTemplate(false);
    setCreateTemplateContent('');
  }, []);

  // Graph View Functions
  const initializeGraphProcessor = useCallback(() => {
    if (!path || graphProcessorRef.current) return;

    graphProcessorRef.current = new GraphDataProcessor(path);

    // Initialize GraphData instance for backlinks
    if (!graphDataInstanceRef.current) {
      graphDataInstanceRef.current = new GraphData({
        enablePersistence: false,
        enableRealTimeSync: true,
        maxCacheSize: 10000
      });
    }

    // Set up event listeners for real-time graph updates
    const graphDatabase = graphProcessorRef.current.getGraphDatabase();

    // Listen for file link updates and rebuild graph if active
    const handleFileLinksUpdated = (event) => {
      if (activeFile === '__graph__' && graphData) {
        // Rebuild graph structure if graph view is active
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        setGraphData(updatedGraphData);
      }
    };

    // Listen for connection changes
    const handleConnectionChanged = (event) => {
      if (activeFile === '__graph__' && graphData) {
        // Rebuild graph structure if graph view is active
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        setGraphData(updatedGraphData);
      }
    };

    graphDatabase.on('fileLinksUpdated', handleFileLinksUpdated);
    graphDatabase.on('connectionAdded', handleConnectionChanged);
    graphDatabase.on('connectionRemoved', handleConnectionChanged);

    // Store cleanup function
    graphProcessorRef.current._cleanup = () => {
      graphDatabase.off('fileLinksUpdated', handleFileLinksUpdated);
      graphDatabase.off('connectionAdded', handleConnectionChanged);
      graphDatabase.off('connectionRemoved', handleConnectionChanged);
    };

  }, [path, activeFile, graphData]);

  // Handle graph state updates from ProfessionalGraphView
  const handleGraphStateChange = useCallback((state) => {
    setGraphSidebarData(state);
  }, []);

  // Build graph data for backlinks panel
  // Note: ProfessionalGraphView has its own data loading, but BacklinksPanel needs GraphDatabase
  const buildGraphData = useCallback(async () => {
    if (!graphProcessorRef.current || isLoadingGraph) return;

    setIsLoadingGraph(true);

    try {
      const data = await graphProcessorRef.current.buildGraphFromWorkspace({
        includeNonMarkdown: false,
        maxDepth: 10,
        excludePatterns: ['.git', 'node_modules', '.lokus', '.DS_Store']
      });

      setGraphData(data);

    } catch (error) {
      setGraphData(null);
    } finally {
      setIsLoadingGraph(false);
    }
  }, [isLoadingGraph]);

  const handleGraphNodeClick = useCallback((event) => {
    const { nodeId, nodeData } = event;

    // If it's a file node (not phantom), open the file
    if (nodeData && nodeData.path && !nodeData.isPhantom) {
      const fileName = nodeData.path.split('/').pop();
      handleFileOpen({
        path: nodeData.path,
        name: fileName,
        is_directory: nodeData.isDirectory || false
      });
    }
  }, []);

  const handleOpenGraphView = useCallback(() => {
    const graphPath = '__graph__';
    const graphName = 'Graph View';

    posthog.trackFeatureActivation('graph');

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== graphPath);
      newTabs.unshift({ path: graphPath, name: graphName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(graphPath);
  }, []);

  const handleOpenBasesTab = useCallback(() => {
    const basesPath = '__bases__';
    const basesName = 'Bases';

    posthog.trackFeatureActivation('database');

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== basesPath);
      newTabs.unshift({ path: basesPath, name: basesName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(basesPath);
  }, []);

  // Initialize graph processor when workspace path changes
  useEffect(() => {
    if (path) {
      initializeGraphProcessor();
    }
  }, [path, initializeGraphProcessor]);

  // Initialize daily notes manager when workspace path changes
  useEffect(() => {
    if (path) {
      dailyNotesManager.init(path);
    }
  }, [path]);

  // Detect if current file is a daily note and extract date
  useEffect(() => {
    if (activeFile && path) {
      const noteDate = getDailyNoteDate(activeFile);
      setCurrentDailyNoteDate(noteDate);
    } else {
      setCurrentDailyNoteDate(null);
    }
  }, [activeFile, path]);

  // Build graph data ONCE when workspace is initialized (for backlinks)
  useEffect(() => {
    if (path && graphProcessorRef.current && !graphData && !isLoadingGraph) {
      buildGraphData();
    }
  }, [path, graphData, isLoadingGraph, buildGraphData]);

  // Cleanup persistent GraphEngine and GraphDatabase when workspace unmounts
  useEffect(() => {
    return () => {
      if (persistentGraphEngineRef.current) {
        persistentGraphEngineRef.current.destroy();
        persistentGraphEngineRef.current = null;
      }

      if (graphProcessorRef.current) {
        // Call cleanup function for event listeners
        if (graphProcessorRef.current._cleanup) {
          graphProcessorRef.current._cleanup();
        }
        // Destroy the GraphDatabase
        graphProcessorRef.current.destroy();
        graphProcessorRef.current = null;
      }
    };
  }, []);

  // Split editor handlers
  const handleSplitDragStart = useCallback((tab) => {
    setDraggedTabForSplit(tab);
  }, []);

  const handleSplitDragEnd = useCallback((tab) => {
    setDraggedTabForSplit(null);
  }, []);

  const handleToggleSplitView = useCallback(async () => {
    setUseSplitView(prev => {
      const newSplitView = !prev;
      if (newSplitView) {
        // When enabling split view, load the next tab in right pane
        const currentIndex = openTabs.findIndex(t => t.path === activeFile);
        const nextTab = openTabs[currentIndex + 1] || openTabs[0];
        if (nextTab && nextTab.path !== activeFile) {
          setRightPaneFile(nextTab.path);
          // Extract just the filename in case name contains a path
          const fileName = getFilename(nextTab.name);
          setRightPaneTitle(fileName.replace(/\.md$/, ""));

          // Load the content for the right pane asynchronously
          setTimeout(async () => {
            const isSpecialView = nextTab.path === '__kanban__' ||
              nextTab.path === '__bases__' ||
              nextTab.path.startsWith('__graph__') ||
              nextTab.path.startsWith('__plugin_') ||
              nextTab.path.endsWith('.canvas') || nextTab.path.endsWith('.kanban');

            if (!isSpecialView && (nextTab.path.endsWith('.md') || nextTab.path.endsWith('.txt'))) {
              // Check if this file is already loaded in the left pane
              if (nextTab.path === activeFile && editorContent) {
                setRightPaneContent(editorContent);
              } else {
                try {
                  const content = await invoke("read_file_content", { path: nextTab.path });
                  setRightPaneContent(content || '');
                } catch (err) {
                  setRightPaneContent('');
                }
              }
            } else {
              // For special views, just clear content
              setRightPaneContent('');
            }
          }, 0);
        }
      } else {
        // Clear right pane when disabling split view
        setRightPaneFile(null);
        setRightPaneContent('');
        setRightPaneTitle('');
      }
      return newSplitView;
    });
  }, [openTabs, activeFile]);

  // Pane resize handlers
  const handlePaneResize = useCallback((e) => {
    if (!useSplitView) return;

    const container = e.currentTarget.parentElement;
    const rect = container.getBoundingClientRect();

    let newSize;
    if (splitDirection === 'vertical') {
      const mouseX = e.clientX - rect.left;
      newSize = (mouseX / rect.width) * 100;
    } else {
      const mouseY = e.clientY - rect.top;
      newSize = (mouseY / rect.height) * 100;
    }

    // Clamp between 20% and 80%
    newSize = Math.max(20, Math.min(80, newSize));
    setLeftPaneSize(newSize);
  }, [useSplitView, splitDirection]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const handleMouseMove = (e) => handlePaneResize(e);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handlePaneResize]);

  const resetPaneSize = useCallback(() => {
    setLeftPaneSize(50);
  }, []);

  const toggleSplitDirection = useCallback(() => {
    setSplitDirection(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
  }, []);

  // Bottom panel resize handlers
  const handleBottomPanelResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizingBottomPanelRef.current = true;
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const handleMouseMove = (e) => {
      if (!isResizingBottomPanelRef.current) return;
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingBottomPanelRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [bottomPanelHeight]);

  // Synchronized scrolling handlers
  const handleLeftPaneScroll = useCallback((e) => {
    if (!syncScrolling || !rightPaneScrollRef.current) return;

    const scrollTop = e.target.scrollTop;
    const scrollHeight = e.target.scrollHeight;
    const clientHeight = e.target.clientHeight;
    const scrollPercent = scrollTop / (scrollHeight - clientHeight);

    const rightPane = rightPaneScrollRef.current;
    const rightScrollTop = scrollPercent * (rightPane.scrollHeight - rightPane.clientHeight);
    rightPane.scrollTop = rightScrollTop;
  }, [syncScrolling]);

  const handleRightPaneScroll = useCallback((e) => {
    if (!syncScrolling || !leftPaneScrollRef.current) return;

    const scrollTop = e.target.scrollTop;
    const scrollHeight = e.target.scrollHeight;
    const clientHeight = e.target.clientHeight;
    const scrollPercent = scrollTop / (scrollHeight - clientHeight);

    const leftPane = leftPaneScrollRef.current;
    const leftScrollTop = scrollPercent * (leftPane.scrollHeight - leftPane.clientHeight);
    leftPane.scrollTop = leftScrollTop;
  }, [syncScrolling]);

  const handleTabDragEnd = (event) => {
    const { active, over } = event;

    // Handle split creation if dragged to editor area
    if (over && over.id === 'editor-drop-zone') {
      setUseSplitView(true);
      return;
    }

    // Handle tab reordering
    if (over && active.id !== over.id) {
      setOpenTabs((tabs) => {
        const oldIndex = tabs.findIndex((t) => t.path === active.id);
        const newIndex = tabs.findIndex((t) => t.path === over.id);
        if (oldIndex === -1 || newIndex === -1) return tabs;
        const newTabs = Array.from(tabs);
        const [removed] = newTabs.splice(oldIndex, 1);
        newTabs.splice(newIndex, 0, removed);
        return newTabs;
      });
    }
  };

  // Direct keyboard event listener as a bulletproof backup for critical shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl+S: Save file
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleSave();
        return;
      }

      // Cmd/Ctrl+H: Toggle version history
      if ((e.metaKey || e.ctrlKey) && e.key === 'h' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (activeFile && !activeFile.startsWith('__')) {
          toggleVersionHistory(activeFile);
        }
        return;
      }

      // Ctrl/Cmd+`: Toggle terminal panel (desktop only)
      if ((e.metaKey || e.ctrlKey) && e.key === '`' && !e.shiftKey && !e.altKey && isDesktop()) {
        e.preventDefault();
        setShowTerminalPanel(prev => !prev);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleSave, activeFile, toggleVersionHistory]);

  useEffect(() => {
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }
    const addDom = (name, fn) => { const h = (event) => fn(event); window.addEventListener(name, h); return () => window.removeEventListener(name, h); };
    const unlistenSave = isTauri ? listen("lokus:save-file", handleSave) : Promise.resolve(addDom('lokus:save-file', handleSave));
    const unlistenClose = isTauri ? listen("lokus:close-tab", () => {
      if (stateRef.current.activeFile) {
        handleTabClose(stateRef.current.activeFile);
      }
    }) : Promise.resolve(addDom('lokus:close-tab', () => {
      if (stateRef.current.activeFile) handleTabClose(stateRef.current.activeFile);
    }));
    const unlistenNewFile = isTauri ? listen("lokus:new-file", handleCreateFile) : Promise.resolve(addDom('lokus:new-file', handleCreateFile));
    const unlistenNewFolder = isTauri ? listen("lokus:new-folder", handleCreateFolder) : Promise.resolve(addDom('lokus:new-folder', handleCreateFolder));
    const unlistenToggleSidebar = isTauri ? listen("lokus:toggle-sidebar", () => setShowLeft(v => !v)) : Promise.resolve(addDom('lokus:toggle-sidebar', () => setShowLeft(v => !v)));
    const unlistenCommandPalette = isTauri ? listen("lokus:command-palette", () => {
      // Don't open command palette when graph view is active
      const isGraphActive = stateRef.current.activeFile === '__graph__' ||
        stateRef.current.activeFile?.startsWith('__graph__');
      if (!isGraphActive) {
        setShowCommandPalette(true);
      }
    }) : Promise.resolve(addDom('lokus:command-palette', () => {
      const isGraphActive = stateRef.current.activeFile === '__graph__' ||
        stateRef.current.activeFile?.startsWith('__graph__');
      if (!isGraphActive) {
        setShowCommandPalette(true);
      }
    }));
    const unlistenInFileSearch = isTauri ? listen("lokus:in-file-search", () => setShowInFileSearch(true)) : Promise.resolve(addDom('lokus:in-file-search', () => setShowInFileSearch(true)));
    const unlistenGlobalSearch = isTauri ? listen("lokus:global-search", () => setShowGlobalSearch(true)) : Promise.resolve(addDom('lokus:global-search', () => setShowGlobalSearch(true)));
    const unlistenGraphView = isTauri ? listen("lokus:graph-view", handleOpenGraphView) : Promise.resolve(addDom('lokus:graph-view', handleOpenGraphView));
    const unlistenShortcutHelp = isTauri ? listen("lokus:shortcut-help", () => {
      setShowShortcutHelp(true);
    }) : Promise.resolve(addDom('lokus:shortcut-help', () => {
      setShowShortcutHelp(true);
    }));
    const unlistenRefreshFiles = isTauri ? listen("lokus:refresh-files", handleRefreshFiles) : Promise.resolve(addDom('lokus:refresh-files', handleRefreshFiles));
    const unlistenNewCanvas = isTauri ? listen("lokus:new-canvas", handleCreateCanvas) : Promise.resolve(addDom('lokus:new-canvas', handleCreateCanvas));
    const unlistenDailyNote = isTauri ? listen("lokus:daily-note", handleOpenDailyNote) : Promise.resolve(addDom('lokus:daily-note', handleOpenDailyNote));
    // unlistenOpenKanban removed - no longer using FullKanban
    const unlistenReopenClosedTab = isTauri ? listen("lokus:reopen-closed-tab", handleReopenClosedTab) : Promise.resolve(addDom('lokus:reopen-closed-tab', handleReopenClosedTab));

    // Split editor shortcuts
    const unlistenToggleSplitView = isTauri ? listen("lokus:toggle-split-view", handleToggleSplitView) : Promise.resolve(addDom('lokus:toggle-split-view', handleToggleSplitView));
    const unlistenToggleSplitDirection = isTauri ? listen("lokus:toggle-split-direction", toggleSplitDirection) : Promise.resolve(addDom('lokus:toggle-split-direction', toggleSplitDirection));
    const unlistenResetPaneSize = isTauri ? listen("lokus:reset-pane-size", resetPaneSize) : Promise.resolve(addDom('lokus:reset-pane-size', resetPaneSize));
    const unlistenToggleSyncScrolling = isTauri ? listen("lokus:toggle-sync-scrolling", () => setSyncScrolling(prev => !prev)) : Promise.resolve(addDom('lokus:toggle-sync-scrolling', () => setSyncScrolling(prev => !prev)));

    // Template picker event listener
    const handleTemplatePicker = (event) => {
      const data = event?.detail || event;
      setTemplatePickerData(data);
      setShowTemplatePicker(true);
    };
    const unlistenTemplatePicker = Promise.resolve(addDom('open-template-picker', handleTemplatePicker));

    // Menu event handlers for editor formatting
    const handleEditorFormat = (formatType) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;

      switch (formatType) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'underline':
          editor.chain().focus().toggleUnderline().run();
          break;
        case 'strikethrough':
          editor.chain().focus().toggleStrike().run();
          break;
        case 'code':
          editor.chain().focus().toggleCode().run();
          break;
        case 'highlight':
          editor.chain().focus().toggleHighlight().run();
          break;
        case 'superscript':
          editor.chain().focus().toggleSuperscript().run();
          break;
        case 'subscript':
          editor.chain().focus().toggleSubscript().run();
          break;
        case 'clear-formatting':
          editor.chain().focus().unsetAllMarks().run();
          break;
      }
    };

    const handleEditorEdit = (action) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;

      switch (action) {
        case 'undo':
          editor.chain().focus().undo().run();
          break;
        case 'redo':
          editor.chain().focus().redo().run();
          break;
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          document.execCommand('paste');
          break;
        case 'select-all':
          editor.chain().focus().selectAll().run();
          break;
      }
    };

    const handleEditorInsert = (insertType) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;

      switch (insertType) {
        case 'wikilink':
          setShowWikiLinkModal(true);
          break;
        case 'math-inline':
          editor.chain().focus().insertContent('$  $').setTextSelection(editor.state.selection.from - 2).run();
          break;
        case 'math-block':
          editor.chain().focus().insertContent('\n$$\n\n$$\n').setTextSelection(editor.state.selection.from - 4).run();
          break;
        case 'table':
          if (editor.commands.insertTable) {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          }
          break;
        case 'image':
          const imageUrl = prompt('Enter image URL:');
          if (imageUrl) {
            editor.chain().focus().setImage({ src: imageUrl }).run();
          }
          break;
        case 'code-block':
          editor.chain().focus().setCodeBlock().run();
          break;
        case 'horizontal-rule':
          editor.chain().focus().setHorizontalRule().run();
          break;
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'bullet-list':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'ordered-list':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'task-list':
          editor.chain().focus().toggleTaskList().run();
          break;
      }
    };

    const handleViewAction = (action) => {
      switch (action) {
        case 'zoom-in':
          // Implement zoom in functionality
          const currentZoom = parseFloat(document.documentElement.style.zoom || '1');
          document.documentElement.style.zoom = Math.min(currentZoom + 0.1, 2).toString();
          break;
        case 'zoom-out':
          // Implement zoom out functionality
          const currentZoomOut = parseFloat(document.documentElement.style.zoom || '1');
          document.documentElement.style.zoom = Math.max(currentZoomOut - 0.1, 0.5).toString();
          break;
        case 'actual-size':
          // Reset zoom to 100%
          document.documentElement.style.zoom = '1';
          break;
        case 'fullscreen':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
      }
    };

    const handleWindowAction = (action) => {
      if (!window.__TAURI__) return;

      const currentWindow = getCurrentWindow();
      switch (action) {
        case 'minimize':
          currentWindow.minimize();
          break;
        case 'close':
          currentWindow.close();
          break;
        case 'zoom':
          currentWindow.toggleMaximize();
          break;
      }
    };

    const handleHelpAction = (action) => {
      const links = remoteLinksRef.current;
      switch (action) {
        case 'help':
          // Open help documentation (server-driven URL)
          if (links.documentation) {
            window.open(links.documentation, '_blank');
          }
          break;
        case 'keyboard-shortcuts':
          setShowShortcutHelp(true);
          break;
        case 'release-notes':
          // Open release notes (server-driven URL)
          if (links.releases) {
            window.open(links.releases, '_blank');
          }
          break;
        case 'report-issue':
          // Open issue tracker (server-driven URL)
          if (links.issues) {
            window.open(links.issues, '_blank');
          }
          break;
      }
    };

    // File menu events
    const unlistenExportPdf = isTauri ? listen("lokus:export-pdf", handleExportPdf) : Promise.resolve(addDom('lokus:export-pdf', handleExportPdf));

    const unlistenPrint = isTauri ? listen("lokus:print", () => {
      window.print();
    }) : Promise.resolve(addDom('lokus:print', () => { window.print(); }));

    // Additional missing file menu events
    const unlistenShowAbout = isTauri ? listen("lokus:show-about", () => {
      setShowAboutDialog(true);
    }) : Promise.resolve(addDom('lokus:show-about', () => { setShowAboutDialog(true); }));

    const unlistenSaveAs = isTauri ? listen("lokus:save-as", handleSaveAs) : Promise.resolve(addDom('lokus:save-as', handleSaveAs));

    const unlistenExportHtml = isTauri ? listen("lokus:export-html", handleExportHtml) : Promise.resolve(addDom('lokus:export-html', handleExportHtml));

    const unlistenCloseWindow = isTauri ? listen("lokus:close-window", () => handleWindowAction('close')) : Promise.resolve(addDom('lokus:close-window', () => handleWindowAction('close')));

    const unlistenOpenWorkspace = isTauri ? listen("lokus:open-workspace", (event) => {
      handleOpenWorkspace();
    }) : Promise.resolve(addDom('lokus:open-workspace', handleOpenWorkspace));

    // Edit menu events
    const unlistenUndo = isTauri ? listen("lokus:edit-undo", () => handleEditorEdit('undo')) : Promise.resolve(addDom('lokus:edit-undo', () => handleEditorEdit('undo')));
    const unlistenRedo = isTauri ? listen("lokus:edit-redo", () => handleEditorEdit('redo')) : Promise.resolve(addDom('lokus:edit-redo', () => handleEditorEdit('redo')));
    const unlistenCut = isTauri ? listen("lokus:edit-cut", () => handleEditorEdit('cut')) : Promise.resolve(addDom('lokus:edit-cut', () => handleEditorEdit('cut')));
    const unlistenCopy = isTauri ? listen("lokus:edit-copy", () => handleEditorEdit('copy')) : Promise.resolve(addDom('lokus:edit-copy', () => handleEditorEdit('copy')));
    const unlistenPaste = isTauri ? listen("lokus:edit-paste", () => handleEditorEdit('paste')) : Promise.resolve(addDom('lokus:edit-paste', () => handleEditorEdit('paste')));
    const unlistenSelectAll = isTauri ? listen("lokus:edit-select-all", () => handleEditorEdit('select-all')) : Promise.resolve(addDom('lokus:edit-select-all', () => handleEditorEdit('select-all')));
    const unlistenFindReplace = isTauri ? listen("lokus:find-replace", () => setShowInFileSearch(true)) : Promise.resolve(addDom('lokus:find-replace', () => setShowInFileSearch(true)));

    // View menu events
    const unlistenZoomIn = isTauri ? listen("lokus:zoom-in", () => handleViewAction('zoom-in')) : Promise.resolve(addDom('lokus:zoom-in', () => handleViewAction('zoom-in')));
    const unlistenZoomOut = isTauri ? listen("lokus:zoom-out", () => handleViewAction('zoom-out')) : Promise.resolve(addDom('lokus:zoom-out', () => handleViewAction('zoom-out')));
    const unlistenActualSize = isTauri ? listen("lokus:actual-size", () => handleViewAction('actual-size')) : Promise.resolve(addDom('lokus:actual-size', () => handleViewAction('actual-size')));
    const unlistenFullscreen = isTauri ? listen("lokus:toggle-fullscreen", () => handleViewAction('fullscreen')) : Promise.resolve(addDom('lokus:toggle-fullscreen', () => handleViewAction('fullscreen')));

    // Theme switching events - COMPLETED TODO: Connected to theme manager
    const unlistenThemeLight = isTauri ? listen("lokus:theme-light", async () => {
      await setGlobalActiveTheme('minimal-light');
    }) : Promise.resolve(addDom('lokus:theme-light', async () => {
      await setGlobalActiveTheme('minimal-light');
    }));

    const unlistenThemeDark = isTauri ? listen("lokus:theme-dark", async () => {
      await setGlobalActiveTheme('dracula');
    }) : Promise.resolve(addDom('lokus:theme-dark', async () => {
      await setGlobalActiveTheme('dracula');
    }));

    const unlistenThemeAuto = isTauri ? listen("lokus:theme-auto", async () => {
      const preferredTheme = getSystemPreferredTheme();
      await setGlobalActiveTheme(preferredTheme === 'light' ? 'minimal-light' : 'dracula');
      setupSystemThemeListener();
    }) : Promise.resolve(addDom('lokus:theme-auto', async () => {
      const preferredTheme = getSystemPreferredTheme();
      await setGlobalActiveTheme(preferredTheme === 'light' ? 'minimal-light' : 'dracula');
      setupSystemThemeListener();
    }));

    // Insert menu events
    const unlistenInsertWikiLink = isTauri ? listen("lokus:insert-wikilink", () => handleEditorInsert('wikilink')) : Promise.resolve(addDom('lokus:insert-wikilink', () => handleEditorInsert('wikilink')));
    const unlistenInsertMathInline = isTauri ? listen("lokus:insert-math-inline", () => handleEditorInsert('math-inline')) : Promise.resolve(addDom('lokus:insert-math-inline', () => handleEditorInsert('math-inline')));
    const unlistenInsertMathBlock = isTauri ? listen("lokus:insert-math-block", () => handleEditorInsert('math-block')) : Promise.resolve(addDom('lokus:insert-math-block', () => handleEditorInsert('math-block')));

    // Handle single math insertion event from menu (defaults to inline)
    const unlistenInsertMath = isTauri ? listen("lokus:insert-math", () => handleEditorInsert('math-inline')) : Promise.resolve(addDom('lokus:insert-math', () => handleEditorInsert('math-inline')));

    // Heading insertion events
    const unlistenInsertHeading = isTauri ? listen("lokus:insert-heading", (event) => {
      const level = event.payload || 1;
      handleEditorInsert('heading', { level });
    }) : Promise.resolve(addDom('lokus:insert-heading', (event) => {
      const level = event.detail || 1;
      handleEditorInsert('heading', { level });
    }));
    const unlistenInsertTable = isTauri ? listen("lokus:insert-table", () => handleEditorInsert('table')) : Promise.resolve(addDom('lokus:insert-table', () => handleEditorInsert('table')));
    const unlistenInsertImage = isTauri ? listen("lokus:insert-image", () => handleEditorInsert('image')) : Promise.resolve(addDom('lokus:insert-image', () => handleEditorInsert('image')));
    const unlistenInsertCodeBlock = isTauri ? listen("lokus:insert-code-block", () => handleEditorInsert('code-block')) : Promise.resolve(addDom('lokus:insert-code-block', () => handleEditorInsert('code-block')));
    const unlistenInsertHorizontalRule = isTauri ? listen("lokus:insert-horizontal-rule", () => handleEditorInsert('horizontal-rule')) : Promise.resolve(addDom('lokus:insert-horizontal-rule', () => handleEditorInsert('horizontal-rule')));
    const unlistenInsertBlockquote = isTauri ? listen("lokus:insert-blockquote", () => handleEditorInsert('blockquote')) : Promise.resolve(addDom('lokus:insert-blockquote', () => handleEditorInsert('blockquote')));
    const unlistenInsertBulletList = isTauri ? listen("lokus:insert-bullet-list", () => handleEditorInsert('bullet-list')) : Promise.resolve(addDom('lokus:insert-bullet-list', () => handleEditorInsert('bullet-list')));
    const unlistenInsertOrderedList = isTauri ? listen("lokus:insert-ordered-list", () => handleEditorInsert('ordered-list')) : Promise.resolve(addDom('lokus:insert-ordered-list', () => handleEditorInsert('ordered-list')));
    const unlistenInsertTaskList = isTauri ? listen("lokus:insert-task-list", () => handleEditorInsert('task-list')) : Promise.resolve(addDom('lokus:insert-task-list', () => handleEditorInsert('task-list')));

    // Format menu events
    const unlistenFormatBold = isTauri ? listen("lokus:format-bold", () => handleEditorFormat('bold')) : Promise.resolve(addDom('lokus:format-bold', () => handleEditorFormat('bold')));
    const unlistenFormatItalic = isTauri ? listen("lokus:format-italic", () => handleEditorFormat('italic')) : Promise.resolve(addDom('lokus:format-italic', () => handleEditorFormat('italic')));
    const unlistenFormatUnderline = isTauri ? listen("lokus:format-underline", () => handleEditorFormat('underline')) : Promise.resolve(addDom('lokus:format-underline', () => handleEditorFormat('underline')));
    const unlistenFormatStrikethrough = isTauri ? listen("lokus:format-strikethrough", () => handleEditorFormat('strikethrough')) : Promise.resolve(addDom('lokus:format-strikethrough', () => handleEditorFormat('strikethrough')));
    const unlistenFormatCode = isTauri ? listen("lokus:format-code", () => handleEditorFormat('code')) : Promise.resolve(addDom('lokus:format-code', () => handleEditorFormat('code')));
    const unlistenFormatHighlight = isTauri ? listen("lokus:format-highlight", () => handleEditorFormat('highlight')) : Promise.resolve(addDom('lokus:format-highlight', () => handleEditorFormat('highlight')));
    const unlistenFormatSuperscript = isTauri ? listen("lokus:format-superscript", () => handleEditorFormat('superscript')) : Promise.resolve(addDom('lokus:format-superscript', () => handleEditorFormat('superscript')));
    const unlistenFormatSubscript = isTauri ? listen("lokus:format-subscript", () => handleEditorFormat('subscript')) : Promise.resolve(addDom('lokus:format-subscript', () => handleEditorFormat('subscript')));
    const unlistenFormatClear = isTauri ? listen("lokus:format-clear", () => handleEditorFormat('clear-formatting')) : Promise.resolve(addDom('lokus:format-clear', () => handleEditorFormat('clear-formatting')));

    // Window menu events
    const unlistenWindowMinimize = isTauri ? listen("lokus:window-minimize", () => handleWindowAction('minimize')) : Promise.resolve(addDom('lokus:window-minimize', () => handleWindowAction('minimize')));
    const unlistenWindowClose = isTauri ? listen("lokus:window-close", () => handleWindowAction('close')) : Promise.resolve(addDom('lokus:window-close', () => handleWindowAction('close')));

    // Additional window menu events
    const unlistenWindowZoom = isTauri ? listen("lokus:window-zoom", () => handleWindowAction('zoom')) : Promise.resolve(addDom('lokus:window-zoom', () => handleWindowAction('zoom')));

    // Help menu events
    const unlistenHelp = isTauri ? listen("lokus:help", () => handleHelpAction('help')) : Promise.resolve(addDom('lokus:help', () => handleHelpAction('help')));
    const unlistenKeyboardShortcuts = isTauri ? listen("lokus:keyboard-shortcuts", () => handleHelpAction('keyboard-shortcuts')) : Promise.resolve(addDom('lokus:keyboard-shortcuts', () => handleHelpAction('keyboard-shortcuts')));
    const unlistenReleaseNotes = isTauri ? listen("lokus:release-notes", () => handleHelpAction('release-notes')) : Promise.resolve(addDom('lokus:release-notes', () => handleHelpAction('release-notes')));
    const unlistenReportIssue = isTauri ? listen("lokus:report-issue", () => handleHelpAction('report-issue')) : Promise.resolve(addDom('lokus:report-issue', () => handleHelpAction('report-issue')));

    return () => {
      unlistenSave.then(f => { if (typeof f === 'function') f(); });
      unlistenClose.then(f => { if (typeof f === 'function') f(); });
      unlistenNewFile.then(f => { if (typeof f === 'function') f(); });
      unlistenNewFolder.then(f => { if (typeof f === 'function') f(); });
      unlistenToggleSidebar.then(f => { if (typeof f === 'function') f(); });
      unlistenCommandPalette.then(f => { if (typeof f === 'function') f(); });
      unlistenInFileSearch.then(f => { if (typeof f === 'function') f(); });
      unlistenGlobalSearch.then(f => { if (typeof f === 'function') f(); });
      unlistenGraphView.then(f => { if (typeof f === 'function') f(); });
      unlistenShortcutHelp.then(f => { if (typeof f === 'function') f(); });
      unlistenRefreshFiles.then(f => { if (typeof f === 'function') f(); });
      unlistenNewCanvas.then(f => { if (typeof f === 'function') f(); });
      unlistenDailyNote.then(f => { if (typeof f === 'function') f(); });
      unlistenReopenClosedTab.then(f => { if (typeof f === 'function') f(); });
      unlistenToggleSplitView.then(f => { if (typeof f === 'function') f(); });
      unlistenToggleSplitDirection.then(f => { if (typeof f === 'function') f(); });
      unlistenResetPaneSize.then(f => { if (typeof f === 'function') f(); });
      unlistenToggleSyncScrolling.then(f => { if (typeof f === 'function') f(); });
      unlistenTemplatePicker.then(f => { if (typeof f === 'function') f(); });

      // Cleanup menu event listeners
      unlistenExportPdf.then(f => { if (typeof f === 'function') f(); });
      unlistenPrint.then(f => { if (typeof f === 'function') f(); });
      unlistenUndo.then(f => { if (typeof f === 'function') f(); });
      unlistenRedo.then(f => { if (typeof f === 'function') f(); });
      unlistenCut.then(f => { if (typeof f === 'function') f(); });
      unlistenCopy.then(f => { if (typeof f === 'function') f(); });
      unlistenPaste.then(f => { if (typeof f === 'function') f(); });
      unlistenSelectAll.then(f => { if (typeof f === 'function') f(); });
      unlistenFindReplace.then(f => { if (typeof f === 'function') f(); });
      unlistenZoomIn.then(f => { if (typeof f === 'function') f(); });
      unlistenZoomOut.then(f => { if (typeof f === 'function') f(); });
      unlistenActualSize.then(f => { if (typeof f === 'function') f(); });
      unlistenFullscreen.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertWikiLink.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertMathInline.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertMathBlock.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertTable.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertImage.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertCodeBlock.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertHorizontalRule.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertBlockquote.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertBulletList.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertOrderedList.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertTaskList.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatBold.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatItalic.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatUnderline.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatStrikethrough.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatCode.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatHighlight.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatSuperscript.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatSubscript.then(f => { if (typeof f === 'function') f(); });
      unlistenFormatClear.then(f => { if (typeof f === 'function') f(); });
      unlistenWindowMinimize.then(f => { if (typeof f === 'function') f(); });
      unlistenWindowClose.then(f => { if (typeof f === 'function') f(); });
      unlistenHelp.then(f => { if (typeof f === 'function') f(); });
      unlistenKeyboardShortcuts.then(f => { if (typeof f === 'function') f(); });
      unlistenReleaseNotes.then(f => { if (typeof f === 'function') f(); });
      unlistenReportIssue.then(f => { if (typeof f === 'function') f(); });

      // Clean up new event listeners
      unlistenShowAbout.then(f => { if (typeof f === 'function') f(); });
      unlistenSaveAs.then(f => { if (typeof f === 'function') f(); });
      unlistenExportHtml.then(f => { if (typeof f === 'function') f(); });
      unlistenCloseWindow.then(f => { if (typeof f === 'function') f(); });
      unlistenOpenWorkspace.then(f => { if (typeof f === 'function') f(); });
      unlistenThemeLight.then(f => { if (typeof f === 'function') f(); });
      unlistenThemeDark.then(f => { if (typeof f === 'function') f(); });
      unlistenThemeAuto.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertMath.then(f => { if (typeof f === 'function') f(); });
      unlistenInsertHeading.then(f => { if (typeof f === 'function') f(); });
      unlistenWindowZoom.then(f => { if (typeof f === 'function') f(); });
    };
  }, [handleSave, handleSaveAs, handleExportHtml, handleExportPdf, handleOpenWorkspace, handleTabClose, handleReopenClosedTab, handleToggleSplitView, toggleSplitDirection, resetPaneSize]);

  const cols = (() => {
    const mainContent = `minmax(0,1fr)`;
    const leftPanel = showLeft ? `${leftW}px 1px ` : "";
    const rightPanel = showRight ? ` 1px ${rightW}px` : "";
    return `48px 1px ${leftPanel}${mainContent}${rightPanel}`;
  })();

  // --- Handlers for extracted components ---
  const handleSwitchView = useCallback((view) => {
    if (view === 'hide') {
      setShowLeft(false);
      return;
    }
    setShowKanban(view === 'kanban');
    setShowPlugins(view === 'plugins');
    setShowBases(view === 'bases' || false);
    setShowGraphView(view === 'graph' || false);
    setShowLeft(true);
  }, []);

  const handleToggleDailyNotes = useCallback(() => {
    setShowDailyNotesPanel(!showDailyNotesPanel);
    setShowCalendarPanel(false);
    setShowRight(true);
    setShowVersionHistory(false);
  }, [showDailyNotesPanel]);

  const handleToggleCalendar = useCallback(() => {
    setShowCalendarPanel(!showCalendarPanel);
    setShowDailyNotesPanel(false);
    setShowRight(true);
    setShowVersionHistory(false);
  }, [showCalendarPanel]);

  const handleOpenCalendarView = useCallback(() => {
    const calendarPath = '__calendar__';
    const calendarName = 'Calendar';
    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== calendarPath);
      newTabs.unshift({ path: calendarPath, name: calendarName });
      if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
      return newTabs;
    });
    setActiveFile(calendarPath);
  }, []);

  const handleOpenCalendarSettings = useCallback(async () => {
    try {
      const { invoke: inv } = await import('@tauri-apps/api/core');
      await inv('open_preferences_window', { workspacePath: path, section: 'Connections' });
    } catch (e) {
      console.error('Failed to open preferences:', e);
    }
  }, [path]);

  // Add a simple fallback if path is not set
  if (!path && !initialPath) {
    return (
      <div style={{
        background: 'black',
        color: 'white',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontFamily: 'monospace'
      }}>
        <div>NO PATH PROVIDED</div>
        <div>initialPath: {String(initialPath)}</div>
        <div>path: {String(path)}</div>
        <div>URL: {window.location.href}</div>
        <div>Search: {window.location.search}</div>
        <div>Hash: {window.location.hash}</div>
        <div style={{ marginTop: '20px', fontSize: '14px' }}>
          This is the Workspace component but no path was provided
        </div>
      </div>
    );
  }

  // Base-aware file tree filtering
  const getBaseAwareFileTree = useCallback((tree) => {
    // Check if bases tab is open (not necessarily active)
    const hasBasesTab = openTabs.some(tab => tab.path === '__bases__');

    // If viewing a base, filter to show only the base's sourceFolder
    if (activeBase?.sourceFolder && hasBasesTab) {
      const filterToBase = (entries) => {
        return entries.filter(entry => {
          // Show the base's folder and everything inside it
          return entry.path === activeBase.sourceFolder ||
            entry.path.startsWith(activeBase.sourceFolder + '/');
        }).map(entry => {
          // If this entry has children, filter them recursively
          if (entry.children && entry.children.length > 0) {
            return {
              ...entry,
              children: filterToBase(entry.children)
            };
          }
          return entry;
        });
      };

      return filterToBase(tree);
    }

    // Otherwise use FolderScope filtering
    return filterFileTree(tree);
  }, [activeBase, openTabs, filterFileTree]);

  // Filter file tree based on folder scope or base scope
  // Memoized to prevent unnecessary re-renders and graph reloads
  const filteredFileTree = useMemo(() => {
    return getBaseAwareFileTree(fileTree);
  }, [fileTree, activeBase?.sourceFolder, openTabs, scopeMode, scopedFolders, filterFileTree]);

  useEffect(() => {
    const handleInsertTemplate = (event) => {
      const { content } = event.detail;
      
      if (editorRef?.current && content) {
        // Get the editor instance
        const editor = editorRef.current;
        
        // This searches backwards from cursor to find the last "/" and removes everything after it
        const { state } = editor;
        const { from } = state.selection;
        
        // Search backwards for the "/" character
        let slashPos = from;
        const textBefore = state.doc.textBetween(Math.max(0, from - 50), from);
        const lastSlashIndex = textBefore.lastIndexOf('/');
        
        if (lastSlashIndex !== -1) {
          slashPos = from - (textBefore.length - lastSlashIndex);
          
          // Delete the "/templatename" text first
          editor
            .chain()
            .focus()
            .deleteRange({ from: slashPos, to: from })
            .insertContent(content)
            .run();
        } else {
          // No slash found, just insert at cursor
          editor.chain().focus().insertContent(content).run();
        }
      }
  };

  window.addEventListener('lokus:insert-template', handleInsertTemplate);
  return () => {
    window.removeEventListener('lokus:insert-template', handleInsertTemplate);
  };
}, []);
  return (
    <PanelManager>
      <div className={`h-full bg-app-panel text-app-text flex flex-col font-sans transition-colors duration-300 overflow-hidden no-select relative ${isMobile() ? 'safe-area-inset-top' : ''}`}>
        {/* Product Tour */}
        <Suspense fallback={<Loading />}>
          <LazyOnboarding />
        </Suspense>

        {/* Service Status / Maintenance Banner */}
        <ServiceStatus />

        {/* Test Mode Indicator */}
        {isTestMode && (
          <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-md text-sm font-medium z-50">
            🧪 Test Mode Active
          </div>
        )}

        {/* Workspace Toolbar */}
        <TitleBar
          uiVisibility={uiVisibility}
          featureFlags={featureFlags}
          showLeft={showLeft}
          showRight={showRight}
          leftW={leftW}
          rightW={rightW}
          openTabs={openTabs}
          activeFile={activeFile}
          unsavedChanges={unsavedChanges}
          useSplitView={useSplitView}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onCreateCanvas={handleCreateCanvas}
          onToggleSplitView={handleToggleSplitView}
          onToggleRight={() => setShowRight(v => !v)}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
        />

        <div className="flex-1 min-h-0 grid overflow-hidden border-t border-app-border/30" style={{ gridTemplateColumns: cols, gap: 0 }}>
          <ActivityBar
            showLeft={showLeft}
            showKanban={showKanban}
            showPlugins={showPlugins}
            showBases={showBases}
            showGraphView={showGraphView}
            showDailyNotesPanel={showDailyNotesPanel}
            showCalendarPanel={showCalendarPanel}
            uiVisibility={uiVisibility}
            featureFlags={featureFlags}
            onSwitchView={handleSwitchView}
            onToggleDailyNotes={handleToggleDailyNotes}
            onToggleCalendar={handleToggleCalendar}
            onOpenGraphView={handleOpenGraphView}
            onOpenBasesTab={handleOpenBasesTab}
          />
          <div className="bg-app-border/20 w-px" />
          {showLeft && (
            <LeftSidebar
              workspacePath={path}
              showPlugins={showPlugins}
              showBases={showBases}
              showKanban={showKanban}
              showGraphView={showGraphView}
              featureFlags={featureFlags}
              onFileOpen={handleFileOpen}
              onOpenPluginDetail={handleOpenPluginDetail}
              onOpenGraphView={handleOpenGraphView}
              onCreateKanban={handleCreateKanban}
              onKanbanBoardAction={handleKanbanBoardAction}
              renderExplorer={() => (
                <>
                  {/* Explorer Header */}
                  <div className="h-10 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
                    <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">Explorer</span>
                    <div className="flex items-center gap-1">
                      <button onClick={handleRefreshFiles} className="obsidian-button icon-only small" title="Reload Files">
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
                          onFileClick={handleFileOpen}
                          activeFile={activeFile}
                          onRefresh={handleRefreshFiles}
                          expandedFolders={expandedFolders}
                          toggleFolder={toggleFolder}
                          creatingItem={creatingItem}
                          onCreateConfirm={handleConfirmCreate}
                          keymap={keymap}
                          selectedPath={selectedPath}
                          setSelectedPath={setSelectedPath}
                          renamingPath={renamingPath}
                          setRenamingPath={setRenamingPath}
                          onViewHistory={toggleVersionHistory}
                          setTagModalFile={setTagModalFile}
                          setShowTagModal={setShowTagModal}
                          setUseSplitView={setUseSplitView}
                          setRightPaneFile={setRightPaneFile}
                          setRightPaneTitle={setRightPaneTitle}
                          setRightPaneContent={setRightPaneContent}
                          isExternalDragActive={isExternalDragActive}
                          hoveredFolder={hoveredFolder}
                          setHoveredFolder={setHoveredFolder}
                          toast={toast}
                          onCheckReferences={handleCheckReferences}
                          workspacePath={path}
                          onUpdateTabPath={editorGroups.updateTabPath}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={handleCreateFile}>
                        New File
                        {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>}
                      </ContextMenuItem>
                      {featureFlags.enable_canvas && (
                        <ContextMenuItem onClick={handleCreateCanvas}>New Canvas</ContextMenuItem>
                      )}
                      <ContextMenuItem onClick={handleCreateFolder}>
                        New Folder
                        {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={handleOpenDailyNote}>
                        Open Daily Note
                        {isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['daily-note'])}</span>}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={handleRefreshFiles}>Refresh</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </>
              )}
            />
          )}
          {showLeft && <div onMouseDown={startLeftDrag} className="cursor-col-resize bg-app-border hover:bg-app-accent transition-colors duration-300 w-1 min-h-full" />}
          <MainContent
            workspacePath={path}
            featureFlags={featureFlags}
            activeFile={activeFile}
            editorTitle={editorTitle}
            editorContent={editorContent}
            isLoadingContent={isLoadingContent}
            openTabs={openTabs}
            useSplitView={useSplitView}
            splitDirection={splitDirection}
            leftPaneSize={leftPaneSize}
            rightPaneFile={rightPaneFile}
            rightPaneContent={rightPaneContent}
            rightPaneTitle={rightPaneTitle}
            filteredFileTree={filteredFileTree}
            isLoadingGraph={isLoadingGraph}
            graphData={graphData}
            allImageFiles={allImageFiles}
            keymap={keymap}
            recentFiles={recentFiles}
            stateRef={stateRef}
            editorRef={editorRef}
            leftPaneScrollRef={leftPaneScrollRef}
            rightPaneScrollRef={rightPaneScrollRef}
            onEditorChange={handleEditorChange}
            onSave={handleSave}
            onTabClose={handleTabClose}
            onFileOpen={handleFileOpen}
            onGraphStateChange={handleGraphStateChange}
            onMouseDown={handleMouseDown}
            onResetPaneSize={resetPaneSize}
            onLeftPaneScroll={handleLeftPaneScroll}
            onRightPaneScroll={handleRightPaneScroll}
            toggleFolder={toggleFolder}
            setEditorTitle={setEditorTitle}
            setUnsavedChanges={setUnsavedChanges}
            setActiveFile={setActiveFile}
            setOpenTabs={setOpenTabs}
            setRightPaneFile={setRightPaneFile}
            setRightPaneTitle={setRightPaneTitle}
            setRightPaneContent={setRightPaneContent}
            setEditor={setEditor}
            onCreateFile={handleCreateFile}
            onCreateCanvas={handleCreateCanvas}
            onCreateFolder={handleCreateFolder}
            onOpenCommandPalette={() => setShowCommandPalette(true)}
            sourceModePaths={sourceModePaths}
            savedContent={savedContent}
            onExitSourceMode={handleExitSourceMode}
          />
          {showRight && (
            <RightSidebar
              workspacePath={path}
              activeFile={activeFile}
              showVersionHistory={showVersionHistory}
              showDailyNotesPanel={showDailyNotesPanel}
              showCalendarPanel={showCalendarPanel}
              versionRefreshKey={versionRefreshKey}
              currentDailyNoteDate={currentDailyNoteDate}
              graphSidebarData={graphSidebarData}
              editorRef={editorRef}
              graphProcessorRef={graphProcessorRef}
              onCloseVersionHistory={() => setShowVersionHistory(false)}
              onReloadCurrentFile={reloadCurrentFile}
              onOpenDailyNoteByDate={handleOpenDailyNoteByDate}
              onFileOpen={handleFileOpen}
              onOpenCalendarView={handleOpenCalendarView}
              onOpenCalendarSettings={handleOpenCalendarSettings}
              rightW={rightW}
              startRightDrag={startRightDrag}
            />
          )}
        </div>

        {/* Bottom Panel Region */}
        <PanelRegion
          position={PANEL_POSITIONS.BOTTOM}
          className="border-t border-app-border"
        />

        {/* Meeting Notes — floating FAB + notification + docked panel */}
        <MeetingFAB />
        <MeetingNotification />
        <Suspense fallback={<Loading />}>
          <LazyMeetingPanel workspacePath={path} />
        </Suspense>

        <BottomPanel
          showTerminalPanel={showTerminalPanel}
          showOutputPanel={showOutputPanel}
          bottomPanelHeight={bottomPanelHeight}
          bottomPanelTab={bottomPanelTab}
          onResizeStart={handleBottomPanelResizeStart}
          onSetBottomPanelTab={setBottomPanelTab}
          onSetShowTerminalPanel={setShowTerminalPanel}
          onSetShowOutputPanel={setShowOutputPanel}
          onClose={() => {
            setShowTerminalPanel(false);
            setShowOutputPanel(false);
          }}
        />

      {/* Mobile bottom Navigation */}
        {isMobile() && (
          <MobileBottomNav
            activeTab={currentView}
            onTabChange={setCurrentView}
          />
        )}

        {/* Responsive Pluginable Status Bar with overflow menu */}
        <ResponsiveStatusBar
          activeFile={activeFile}
          unsavedChanges={unsavedChanges}
          openTabs={openTabs}
          editor={editor}
          showTerminal={isDesktop() ? showTerminalPanel : false}
          onToggleTerminal={() => {
            if (isDesktop()) {
              setShowTerminalPanel(prev => !prev);
              if (!showTerminalPanel) {
                setBottomPanelTab('terminal');
                setShowOutputPanel(false);
              }
            }
          }}
          showOutput={showOutputPanel}
          onToggleOutput={() => {
            setShowOutputPanel(prev => !prev);
            if (!showOutputPanel) {
              setBottomPanelTab('output');
              setShowTerminalPanel(false);
            }
          }}
        />

        <ModalLayer
          workspacePath={path}
          editorRef={editorRef}
          filteredFileTree={filteredFileTree}
          openTabs={openTabs}
          activeFile={activeFile}
          stateRef={stateRef}
          keymap={keymap}
          showCommandPalette={showCommandPalette}
          setShowCommandPalette={setShowCommandPalette}
          showInFileSearch={showInFileSearch}
          setShowInFileSearch={setShowInFileSearch}
          showTemplatePicker={showTemplatePicker}
          setShowTemplatePicker={setShowTemplatePicker}
          templatePickerData={templatePickerData}
          setTemplatePickerData={setTemplatePickerData}
          showGlobalSearch={showGlobalSearch}
          setShowGlobalSearch={setShowGlobalSearch}
          showShortcutHelp={showShortcutHelp}
          setShowShortcutHelp={setShowShortcutHelp}
          showCreateTemplate={showCreateTemplate}
          setShowCreateTemplate={setShowCreateTemplate}
          createTemplateContent={createTemplateContent}
          showDatePickerModal={showDatePickerModal}
          setShowDatePickerModal={setShowDatePickerModal}
          showTagModal={showTagModal}
          setShowTagModal={setShowTagModal}
          tagModalFile={tagModalFile}
          setTagModalFile={setTagModalFile}
          showAboutDialog={showAboutDialog}
          setShowAboutDialog={setShowAboutDialog}
          referenceUpdateModal={referenceUpdateModal}
          canvasPreview={canvasPreview}
          setCanvasPreview={setCanvasPreview}
          isExternalDragActive={isExternalDragActive}
          hoveredFolder={hoveredFolder}
          refreshId={setRefreshId}
          onFileOpen={handleFileOpen}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onSave={handleSave}
          onTabClose={handleTabClose}
          onCreateTemplate={handleCreateTemplate}
          onCreateTemplateSaved={handleCreateTemplateSaved}
          onOpenDailyNote={handleOpenDailyNote}
          onOpenDailyNoteByDate={handleOpenDailyNoteByDate}
          onRefreshFiles={handleRefreshFiles}
          onConfirmReferenceUpdate={handleConfirmReferenceUpdate}
          onCloseReferenceModal={handleCloseReferenceModal}
          onSetShowLeft={setShowLeft}
          onSetOpenTabs={setOpenTabs}
          onSetActiveFile={setActiveFile}
        />
      </div>
    </PanelManager>
  );
}

// --- Main Workspace Component ---
export default function Workspace({ initialPath = "" }) {
  // Debug: Alert to check if path is passed
  if (initialPath) {
    invoke("validate_workspace_path", { path: initialPath });
  }
  const [path, setPath] = useState(initialPath);

  // Save workspace path to localStorage on mount
  useEffect(() => {
    if (initialPath) {
      import('../core/vault/vault.js').then(({ saveWorkspacePath }) => {
        saveWorkspacePath(initialPath);
      });

      // Set global workspace path for components like SyncStatus
      window.__WORKSPACE_PATH__ = initialPath;

      // Update API server state with current workspace
      invoke('api_set_workspace', { workspace: initialPath })
        .then(() => {
        })
        .catch((error) => {
        });

      // Initialize default kanban board if none exists
      invoke('initialize_workspace_kanban', { workspacePath: initialPath })
        .then(() => {
        })
        .catch((error) => {
        });
    }
  }, [initialPath]);

  // Add a simple fallback if path is not set
  if (!path && !initialPath) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: 'var(--app-panel)',
        color: 'var(--app-text)',
        padding: '20px'
      }}>
        <h2>No Workspace Path</h2>
        <div>initialPath: {String(initialPath)}</div>
        <div>path: {String(path)}</div>
        <div>URL: {window.location.href}</div>
        <div>Search: {window.location.search}</div>
        <div>Hash: {window.location.hash}</div>
        <div style={{ marginTop: '20px', fontSize: '14px' }}>
          This is the Workspace component but no path was provided
        </div>
      </div>
    );
  }

  return (
    <FolderScopeProvider workspacePath={path}>
      <BasesProvider workspacePath={path}>
        <WorkspaceWithScope path={path} />
      </BasesProvider>
    </FolderScopeProvider>
  );
}