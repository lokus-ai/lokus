import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRemoteLinks, useUIVisibility, useLayoutDefaults, useFeatureFlags } from "../contexts/RemoteConfigContext";
import ServiceStatus from "../components/ServiceStatus";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirm, save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { DraggableTab } from "./DraggableTab";
import { Menu, FilePlus2, FolderPlus, Search, LayoutGrid, FolderMinus, Puzzle, FolderOpen, FilePlus, Layers, Package, Network, /* Mail, */ Database, Trello, FileText, FolderTree, Grid2X2, PanelRightOpen, PanelRightClose, Plus, Calendar, CalendarDays, FoldVertical, SquareSplitHorizontal, FilePlus as FilePlusCorner, SquareKanban, RefreshCw, Terminal, Trash2, X, Copy, Scissors, Check } from "lucide-react";
import { ColoredFileIcon } from "../components/FileIcon.jsx";
import LokusLogo from "../components/LokusLogo.jsx";
import { ProfessionalGraphView } from "./ProfessionalGraphView.jsx";
import Editor from "../editor";
import ResponsiveStatusBar from "../components/StatusBar/ResponsiveStatusBar.jsx";
import ConnectionStatus from "../components/ConnectionStatus.jsx";
import Canvas from "./Canvas.jsx";
import KanbanBoard from "../components/KanbanBoard.jsx";
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
import CommandPalette from "../components/CommandPalette.jsx";
import InFileSearch from "../components/InFileSearch.jsx";
import FullTextSearchPanel from "./FullTextSearchPanel.jsx";
import ShortcutHelpModal from "../components/ShortcutHelpModal.jsx";
// GlobalContextMenu removed - using EditorContextMenu and FileContextMenu instead
import KanbanList from "../components/KanbanList.jsx";
import { WorkspaceManager } from "../core/workspace/manager.js";
// FullKanban removed - now using file-based KanbanBoard system
import PluginSettings from "./PluginSettings.jsx";
import PluginDetail from "./PluginDetail.jsx";
import { canvasManager } from "../core/canvas/manager.js";
import TemplatePicker from "../components/TemplatePicker.jsx";
import { getMarkdownCompiler } from "../core/markdown/compiler.js";
import { MarkdownExporter } from "../core/export/markdown-exporter.js";
import dailyNotesManager from "../core/daily-notes/manager.js";
import posthog from "../services/posthog.js";
import CreateTemplate from "../components/CreateTemplate.jsx";
import { PanelManager, PanelRegion, usePanelManager } from "../plugins/ui/PanelManager.jsx";
import { PANEL_POSITIONS } from "../plugins/api/UIAPI.js";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { setGlobalActiveTheme, getSystemPreferredTheme, setupSystemThemeListener, readGlobalVisuals } from "../core/theme/manager.js";
import { useTheme } from "../hooks/theme.jsx";
import SplitEditor from "../components/SplitEditor/SplitEditor.jsx";
import PDFViewerTab from "../components/PDFViewer/PDFViewerTab.jsx";
import { isPDFFile } from "../utils/pdfUtils.js";
import { getFilename, getBasename, joinPath } from '../utils/pathUtils.js';
import platformService from "../services/platform/PlatformService.js";
import { FolderScopeProvider, useFolderScope } from "../contexts/FolderScopeContext.jsx";
import { BasesProvider, useBases } from "../bases/BasesContext.jsx";
import BasesView from "../bases/BasesView.jsx";
import DocumentOutline from "../components/DocumentOutline.jsx";
import GraphSidebar from "../components/GraphSidebar.jsx";
import VersionHistoryPanel from "../components/VersionHistoryPanel.jsx";
import BacklinksPanel from "./BacklinksPanel.jsx";
import { DailyNotesPanel, NavigationButtons, DatePickerModal } from "../components/DailyNotes/index.js";
import { CalendarWidget, CalendarView } from "../components/Calendar/index.js";
import { ImageViewerTab } from "../components/ImageViewer/ImageViewerTab.jsx";
import { isImageFile, findImageFiles } from "../utils/imageUtils.js";
import CanvasPreviewPopup from '../components/CanvasPreviewPopup.jsx';
import { generatePreview } from '../core/canvas/preview-generator.js';
import TagManagementModal from "../components/TagManagementModal.jsx";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard.jsx";
import ExternalDropZone from "../components/ExternalDropZone.jsx";
import { AnimatePresence, motion } from "framer-motion";
import { toast, demoAllToasts } from "../components/ui/enhanced-toast";
import MeetingPanel from "../components/meeting/MeetingPanel.jsx";
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
import AboutDialog from "../components/AboutDialog.jsx";
import { copyFiles, cutFiles, getClipboardState, getRelativePath } from "../utils/clipboard.js";

import { isDesktop, isMobile } from '../platform/index.js';
import TerminalPanel from "../components/TerminalPanel/TerminalPanel.jsx";
import { OutputPanel } from "../components/OutputPanel/OutputPanel.jsx";
import referenceManager from "../core/references/ReferenceManager.js";
import ReferenceUpdateModal from "../components/ReferenceUpdateModal.jsx";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { useWorkspaceStore } from '../stores/workspace';
import { useColumnResize } from '../features/layout';
import { useEditorContent, useExport, useSave, EditorModeSwitcher as FeatureEditorModeSwitcher } from '../features/editor';
import { useFileTree, useFileOperations } from '../features/file-tree';
import { NewItemInput as FeatureNewItemInput } from '../features/file-tree';
import { useGraphEngine } from '../features/graph';
import { useSplitView as useSplitViewHook } from '../features/split-view';
import { usePanels } from '../features/panels';
import { ShortcutListener } from '../features/shortcuts';
import { useTabs } from '../features/tabs';

// EditorModeSwitcher extracted to src/features/editor/EditorModeSwitcher.jsx
const EditorModeSwitcher = FeatureEditorModeSwitcher;

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// useDragColumns extracted to src/features/layout/hooks/useColumnResize.js

// NewItemInput extracted to src/features/file-tree/NewItemInput.jsx
const NewItemInput = FeatureNewItemInput;

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
          const currentEditorContent = useWorkspaceStore.getState().editorContent;
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
          useWorkspaceStore.setState({ selectedFileForCompare: file });
          toast.success(`Selected for compare: ${file.name}`);
        }
        break;
      case 'compareWith': {
        // Compare with previously selected file
        const compareFile = useWorkspaceStore.getState().selectedFileForCompare;
        if (compareFile && file.type === 'file') {
          // Open both files in split view for manual comparison
          onFileClick(compareFile.path);
          setUseSplitView(true);
          setTimeout(() => {
            setRightPaneFile(file.path);
            setRightPaneTitle(file.name);
          }, 100);
          toast.success(`Comparing ${compareFile.name} with ${file.name}`);
          useWorkspaceStore.setState({ selectedFileForCompare: null });
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
          useWorkspaceStore.getState().openPanel('showTagModal');
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

// --- Editor Drop Zone Component ---
function EditorDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'editor-drop-zone',
    data: { type: 'editor-area' }
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative w-full h-full ${isOver ? 'bg-app-accent bg-opacity-10' : ''}`}
      style={{ position: 'relative' }}
    >
      {children}
      {isOver && (
        <div className="absolute inset-4 border-2 border-dashed border-app-accent bg-app-accent bg-opacity-5 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <div className="text-app-accent font-medium text-lg">
            Drop here to create split view
          </div>
        </div>
      )}
    </div>
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
  // --- Zustand Store Selectors ---
  // Layout
  const { leftW, rightW, startLeftDrag, startRightDrag } = useColumnResize({
    minLeft: 220, maxLeft: 500, minRight: 220, maxRight: 500,
  });
  const showLeft = useWorkspaceStore((s) => s.showLeft);
  const showRight = useWorkspaceStore((s) => s.showRight);
  const refreshId = useWorkspaceStore((s) => s.refreshId);
  const bottomPanelHeight = useWorkspaceStore((s) => s.bottomPanelHeight);
  const bottomPanelTab = useWorkspaceStore((s) => s.bottomPanelTab);

  const toggleRightSidebar = useCallback(() => {
    useWorkspaceStore.getState().toggleRight();
  }, []);

  // Version history
  const showVersionHistory = useWorkspaceStore((s) => s.showVersionHistory);
  const versionHistoryFile = useWorkspaceStore((s) => s.versionHistoryFile);
  const versionRefreshKey = useWorkspaceStore((s) => s.versionRefreshKey);
  const editor = useWorkspaceStore((s) => s.editor);

  const { toggleVersionHistory } = usePanels();

  // File tree
  const selectedPath = useWorkspaceStore((s) => s.selectedPath);
  const fileTree = useWorkspaceStore((s) => s.fileTree);
  const expandedFolders = useWorkspaceStore((s) => s.expandedFolders);
  const creatingItem = useWorkspaceStore((s) => s.creatingItem);
  const renamingPath = useWorkspaceStore((s) => s.renamingPath);

  // External file drop state
  const isExternalDragActive = useWorkspaceStore((s) => s.isExternalDragActive);
  const hoveredFolder = useWorkspaceStore((s) => s.hoveredFolder);

  // Check if we're in test mode
  const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
  const keymap = useWorkspaceStore((s) => s.keymap);

  // Tabs
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const unsavedChanges = useWorkspaceStore((s) => s.unsavedChanges);
  const recentlyClosedTabs = useWorkspaceStore((s) => s.recentlyClosedTabs);

  // Editor
  const editorContent = useWorkspaceStore((s) => s.editorContent);
  const editorTitle = useWorkspaceStore((s) => s.editorTitle);
  const savedContent = useWorkspaceStore((s) => s.savedContent);
  const isLoadingContent = useWorkspaceStore((s) => s.isLoadingContent);

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

        useWorkspaceStore.getState().setContent(processedContent);
        useWorkspaceStore.getState().setSavedContent(content);

        // Clear unsaved changes for this file since we just reloaded
        useWorkspaceStore.setState((s) => {
          const newSet = new Set(s.unsavedChanges);
          newSet.delete(activeFile);
          return { unsavedChanges: newSet };
        });
      }
    } catch { }
  }, [activeFile, openTabs]);

  // Editor groups system for VSCode-style split view
  const editorGroups = useEditorGroups(openTabs);
  const recentFiles = useWorkspaceStore((s) => s.recentFiles);

  // Panels & modals
  const showCommandPalette = useWorkspaceStore((s) => s.showCommandPalette);
  const showInFileSearch = useWorkspaceStore((s) => s.showInFileSearch);
  const showShortcutHelp = useWorkspaceStore((s) => s.showShortcutHelp);
  const showTemplatePicker = useWorkspaceStore((s) => s.showTemplatePicker);
  const templatePickerData = useWorkspaceStore((s) => s.templatePickerData);
  const showCreateTemplate = useWorkspaceStore((s) => s.showCreateTemplate);
  const createTemplateContent = useWorkspaceStore((s) => s.createTemplateContent);
  const showGlobalSearch = useWorkspaceStore((s) => s.showGlobalSearch);

  // Views
  const currentView = useWorkspaceStore((s) => s.currentView);
  const showKanban = useWorkspaceStore((s) => s.showKanban);
  const showPlugins = useWorkspaceStore((s) => s.showPlugins);
  const showBases = useWorkspaceStore((s) => s.showBases);
  const showMarketplace = useWorkspaceStore((s) => s.showMarketplace);
  const showTagModal = useWorkspaceStore((s) => s.showTagModal);
  const tagModalFile = useWorkspaceStore((s) => s.tagModalFile);
  const showAboutDialog = useWorkspaceStore((s) => s.showAboutDialog);
  const selectedFileForCompare = useWorkspaceStore((s) => s.selectedFileForCompare);
  const showGraphView = useWorkspaceStore((s) => s.showGraphView);
  const showDailyNotesPanel = useWorkspaceStore((s) => s.showDailyNotesPanel);
  const showCalendarPanel = useWorkspaceStore((s) => s.showCalendarPanel);
  const showTerminalPanel = useWorkspaceStore((s) => s.showTerminalPanel);
  const showOutputPanel = useWorkspaceStore((s) => s.showOutputPanel);
  const isResizingBottomPanelRef = useRef(false);
  const showDatePickerModal = useWorkspaceStore((s) => s.showDatePickerModal);
  const currentDailyNoteDate = useWorkspaceStore((s) => s.currentDailyNoteDate);

  // Graph
  const graphData = useWorkspaceStore((s) => s.graphData);
  const isLoadingGraph = useWorkspaceStore((s) => s.isLoadingGraph);

  // Reference update modal
  const referenceUpdateModal = useWorkspaceStore((s) => s.referenceUpdateModal);

  // Image files
  const allImageFiles = useWorkspaceStore((s) => s.allImageFiles);

  // Canvas preview
  const canvasPreview = useWorkspaceStore((s) => s.canvasPreview);

  // Graph sidebar
  const graphSidebarData = useWorkspaceStore((s) => s.graphSidebarData);

  // Persistent GraphEngine instance that survives tab switches
  const persistentGraphEngineRef = useRef(null);

  // Graph data processor instance
  const graphProcessorRef = useRef(null);

  // GraphData instance for backlinks
  const graphDataInstanceRef = useRef(null);

  // Save handlers provided by the feature hook
  const { handleSave, handleSaveAs } = useSave({
    workspacePath: path,
    editorGroupsRef: null,
    graphProcessorRef,
    onRefreshFiles: () => useWorkspaceStore.getState().refreshTree(),
  });

  const { handleExportHtml, handleExportPdf } = useExport({ workspacePath: path });

  // --- Refs for stable callbacks ---
  const editorRef = useRef(null);
  const leftPaneScrollRef = useRef(null);
  const rightPaneScrollRef = useRef(null);

  const { handleTabClose, handleFileOpen, handleTabClick, handleReopenClosedTab } = useTabs({ workspacePath: path, editorRef, onSave: handleSave });

  // Split view
  const useSplitView = useWorkspaceStore((s) => s.useSplitView);
  const splitDirection = useWorkspaceStore((s) => s.splitDirection);
  const leftPaneSize = useWorkspaceStore((s) => s.leftPaneSize);
  const draggedTabForSplit = useWorkspaceStore((s) => s.draggedTabForSplit);
  const splitInitData = useWorkspaceStore((s) => s.splitInitData);
  const rightPaneFile = useWorkspaceStore((s) => s.rightPaneFile);
  const rightPaneContent = useWorkspaceStore((s) => s.rightPaneContent);
  const rightPaneTitle = useWorkspaceStore((s) => s.rightPaneTitle);
  const syncScrolling = useWorkspaceStore((s) => s.syncScrolling);

  // Initialize layout defaults from remote config
  useEffect(() => {
    if (layoutDefaults.left_sidebar_visible !== undefined) {
      useWorkspaceStore.setState({ showLeft: layoutDefaults.left_sidebar_visible });
    }
    if (layoutDefaults.right_sidebar_visible !== undefined) {
      useWorkspaceStore.setState({ showRight: layoutDefaults.right_sidebar_visible });
    }
  }, [layoutDefaults]);

  // Handler for checking references before file move/rename
  const handleCheckReferences = useCallback(({ oldPath, newPath, affectedFiles, operation }) => {
    useWorkspaceStore.getState().setReferenceUpdateModal({
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
    const { oldPath, newPath, pendingOperation } = useWorkspaceStore.getState().referenceUpdateModal;

    useWorkspaceStore.setState((s) => ({ referenceUpdateModal: { ...s.referenceUpdateModal, isProcessing: true } }));

    try {
      // First, execute the move/rename operation
      const operationSuccess = await pendingOperation();

      if (!operationSuccess) {
        useWorkspaceStore.setState((s) => ({
          referenceUpdateModal: { ...s.referenceUpdateModal, isProcessing: false, result: { success: false, error: 'Operation failed' } }
        }));
        return;
      }

      // If user chose to update references, do it now
      if (updateReferences) {
        const result = await referenceManager.updateAllReferences(oldPath, newPath);
        useWorkspaceStore.setState((s) => ({
          referenceUpdateModal: { ...s.referenceUpdateModal, isProcessing: false, result: { success: true, updated: result.updated, files: result.files } }
        }));
      } else {
        // Just close after successful operation without updating references
        useWorkspaceStore.getState().setReferenceUpdateModal({
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
      useWorkspaceStore.setState((s) => ({
        referenceUpdateModal: { ...s.referenceUpdateModal, isProcessing: false, result: { success: false, error: err.message || 'Failed to update references' } }
      }));
    }
  }, [referenceUpdateModal]);

  // Handler for closing reference update modal
  const handleCloseReferenceModal = useCallback(() => {
    useWorkspaceStore.getState().setReferenceUpdateModal({
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
          useWorkspaceStore.setState({ expandedFolders: new Set(session.expanded_folders || []) });

          // Reconstruct tabs - plugin tabs will be hydrated when plugins load
          const tabsWithNames = session.open_tabs.map(p => ({
            path: p,
            name: getTabDisplayName(p, plugins)
          }));

          useWorkspaceStore.setState({ openTabs: tabsWithNames });

          if (tabsWithNames.length > 0) {
            useWorkspaceStore.setState({ activeFile: tabsWithNames[0].path });
          }

          // Load recent files from session state if available, otherwise use open tabs
          if (session.recent_files && session.recent_files.length > 0) {
            useWorkspaceStore.setState({ recentFiles: session.recent_files.slice(0, 5).map(p => ({
              path: p,
              name: getFilename(p)
            })) });
          } else {
            // Fallback: use open tabs as recent files
            const actualFiles = session.open_tabs.filter(p =>
              !p.startsWith('__') &&
              (p.endsWith('.md') || p.endsWith('.txt') || p.endsWith('.canvas') || p.endsWith('.kanban') || p.endsWith('.pdf'))
            );
            useWorkspaceStore.setState({ recentFiles: actualFiles.slice(0, 5).map(p => ({
              path: p,
              name: getFilename(p)
            })) });
          }
        }
      }).catch(err => {
      });
    }
  }, [path]);

  // Rehydrate plugin tabs when plugins become available
  useEffect(() => {
    if (plugins.length > 0 && openTabs.length > 0) {
      useWorkspaceStore.setState((s) => {
        const prevTabs = s.openTabs;
        const needsUpdate = prevTabs.some(tab =>
          tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin
        );

        if (!needsUpdate) return {};

        return { openTabs: prevTabs
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
          }) };
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
          useWorkspaceStore.setState({ isExternalDragActive: false });

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
            useWorkspaceStore.setState({ hoveredFolder: null });
          }
        });

        // tauri://drag-over - Files being dragged over window
        unlistenOver = await listen('tauri://drag-over', () => {
          if (isCleanedUp) return;
          useWorkspaceStore.setState({ isExternalDragActive: true });
        });

        // tauri://drag-leave - Drag left window
        unlistenLeave = await listen('tauri://drag-leave', () => {
          if (isCleanedUp) return;
          useWorkspaceStore.setState({ isExternalDragActive: false });
          useWorkspaceStore.setState({ hoveredFolder: null });
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
    getActiveShortcuts().then(m => useWorkspaceStore.setState({ keymap: m })).catch(() => { });
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }
    if (isTauri) {
      const sub = listen('shortcuts:updated', async () => {
        const m = await getActiveShortcuts();
        useWorkspaceStore.setState({ keymap: m });
      });
      return () => { sub.then((un) => un()); };
    } else {
      const onDom = async () => { useWorkspaceStore.setState({ keymap: await getActiveShortcuts() }); };
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
          useWorkspaceStore.getState().setFileTree(tree);
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
          useWorkspaceStore.getState().setAllImageFiles(imageFiles);
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
      useWorkspaceStore.getState().setContent("");
      useWorkspaceStore.getState().setTitle("");
      useWorkspaceStore.getState().setLoading(true);

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

          useWorkspaceStore.getState().setContent(processedContent);
          useWorkspaceStore.getState().setTitle(fileName.replace(/\.md$/, ""));
          useWorkspaceStore.getState().setSavedContent(content); // Keep original content for saving
          useWorkspaceStore.getState().setLoading(false); // Loading complete
        })
        .catch((err) => {
          if (fileToLoad === activeFile) {
            useWorkspaceStore.getState().setLoading(false);
            // Show error message in editor
            useWorkspaceStore.getState().setContent(`<div class="text-red-500 p-4">Failed to load file: ${err}</div>`);
            useWorkspaceStore.getState().setTitle("Error");
          }
        });
    } else {
      useWorkspaceStore.getState().setContent("");
      useWorkspaceStore.getState().setTitle("");
      useWorkspaceStore.getState().setLoading(false);
    }
  }, [activeFile]);

  // Note: workspace:activate events are handled by useWorkspaceActivation in App.jsx
  // which passes the path down via props to this component

  // Open file events from editor (wiki link clicks)
  useEffect(() => {
    const openPath = (p, switchToTab = true) => {
      if (!p) return;

      useWorkspaceStore.setState((s) => {
        const name = getFilename(p);
        const wasAlreadyOpen = s.openTabs.some(t => t.path === p);
        const newTabs = s.openTabs.filter(t => t.path !== p);
        newTabs.unshift({ path: p, name });
        if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();

        return { openTabs: newTabs };
      });

      // Only switch to the new tab if requested (regular click)
      // For Cmd/Ctrl+Click, keep current tab active
      if (switchToTab) {
        useWorkspaceStore.setState({ activeFile: p });
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
            (editorRef.current.getText() || useWorkspaceStore.getState().editorContent) :
            useWorkspaceStore.getState().editorContent;

          if (currentContent && sourceFile === useWorkspaceStore.getState().activeFile) {

            // Use the real-time update method
            const updateResult = await graphProcessorRef.current.updateFileContent(sourceFile, currentContent);

            // Update graph data if there were changes and graph is visible
            if ((updateResult.added > 0 || updateResult.removed > 0) && activeFile === '__graph__') {
              const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
              useWorkspaceStore.getState().setGraphData(updatedGraphData);
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
      useWorkspaceStore.setState({ canvasPreview: { canvasName, canvasPath, position, loading: true } });

      // Generate preview (async)
      try {
        const thumbnailUrl = await generatePreview(canvasPath);
        useWorkspaceStore.setState((s) => ({
          canvasPreview: s.canvasPreview?.canvasPath === canvasPath
            ? { ...s.canvasPreview, thumbnailUrl, loading: false }
            : null
        }));
      } catch (error) {
        useWorkspaceStore.setState((s) => ({
          canvasPreview: s.canvasPreview?.canvasPath === canvasPath
            ? { ...s.canvasPreview, error: true, loading: false }
            : null
        }));
      }
    };

    const handleCanvasLinkHoverEnd = () => {
      useWorkspaceStore.setState({ canvasPreview: null });
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
        useWorkspaceStore.setState((s) => {
          const newTabs = s.openTabs.filter(t => t.path !== canvasPath);
          newTabs.unshift({ path: canvasPath, name });
          if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
          return { openTabs: newTabs };
        });
        useWorkspaceStore.setState({ activeFile: canvasPath });
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
      useWorkspaceStore.setState({ activeFile: openTabs[nextIndex].path });
    };

    const handlePrevTabImmediate = () => {
      if (openTabs.length <= 1) return;
      const currentIndex = openTabs.findIndex(tab => tab.path === activeFile);
      const prevIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
      useWorkspaceStore.setState({ activeFile: openTabs[prevIndex].path });
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
          useWorkspaceStore.setState({ activeFile: openTabs[prevIndex].path });
        } else {
          // Next tab
          const nextIndex = (currentIndex + 1) % openTabs.length;
          useWorkspaceStore.setState({ activeFile: openTabs[nextIndex].path });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [openTabs, activeFile]);

  // Global right-click context menu
  // Removed global context menu handler - context menus are now component-specific
  // EditorContextMenu handles editor right-clicks, FileContextMenu handles file sidebar right-clicks

  const handleRefreshFiles = () => useWorkspaceStore.getState().refreshTree();

  const handleOpenPluginDetail = (plugin) => {
    const pluginPath = `__plugin_${plugin.id}__`;
    const pluginName = `${plugin.name} Plugin`;

    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter(t => t.path !== pluginPath);
      newTabs.unshift({ path: pluginPath, name: pluginName, plugin });
      if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: pluginPath });
  };

  const toggleFolder = (folderPath) => {
    useWorkspaceStore.setState((s) => {
      const newSet = new Set(s.expandedFolders);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return { expandedFolders: newSet };
    });
  };

  const closeAllFolders = () => {
    useWorkspaceStore.setState({ expandedFolders: new Set() });
  };


  // handleOpenFullKanban removed - use file-based kanban boards instead


  const handleEditorChange = useCallback((newContent) => {
    useWorkspaceStore.getState().setContent(newContent);
    if (!useWorkspaceStore.getState().activeFile) return;
    useWorkspaceStore.setState((s) => {
      const next = new Set(s.unsavedChanges);
      if (newContent !== s.savedContent) {
        next.add(s.activeFile);
      } else {
        next.delete(s.activeFile);
      }
      return { unsavedChanges: next };
    });
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
      useWorkspaceStore.setState((s) => ({ expandedFolders: new Set([...s.expandedFolders, targetPath]) }));
    }
    useWorkspaceStore.setState({ creatingItem: { type: 'file', targetPath } });
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

      useWorkspaceStore.getState().closePanel('showDatePickerModal');

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
      useWorkspaceStore.setState((s) => ({ expandedFolders: new Set([...s.expandedFolders, targetPath]) }));
    }
    useWorkspaceStore.setState({ creatingItem: { type: 'folder', targetPath } });
  };

  const handleConfirmCreate = async (name) => {
    if (!creatingItem || !name) {
      useWorkspaceStore.setState({ creatingItem: null });
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
                                                                                                                                                                          
    useWorkspaceStore.setState({ creatingItem: null });
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
          const currentContent = useWorkspaceStore.getState().savedContent || '';
          return currentContent;
        }
      }
      return '';
    };

    const contentForTemplate = getContentForTemplate();
    useWorkspaceStore.setState({ createTemplateContent: contentForTemplate });
    useWorkspaceStore.getState().openPanel('showCreateTemplate');
  }, [activeFile]);

  const handleCreateTemplateSaved = useCallback(() => {
    // Template was saved successfully
    useWorkspaceStore.getState().closePanel('showCreateTemplate');
    useWorkspaceStore.setState({ createTemplateContent: '' });
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
        useWorkspaceStore.getState().setGraphData(updatedGraphData);
      }
    };

    // Listen for connection changes
    const handleConnectionChanged = (event) => {
      if (activeFile === '__graph__' && graphData) {
        // Rebuild graph structure if graph view is active
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        useWorkspaceStore.getState().setGraphData(updatedGraphData);
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
    useWorkspaceStore.getState().setGraphSidebar(state);
  }, []);

  // Build graph data for backlinks panel
  // Note: ProfessionalGraphView has its own data loading, but BacklinksPanel needs GraphDatabase
  const buildGraphData = useCallback(async () => {
    if (!graphProcessorRef.current || isLoadingGraph) return;

    useWorkspaceStore.getState().setLoadingGraph(true);

    try {
      const data = await graphProcessorRef.current.buildGraphFromWorkspace({
        includeNonMarkdown: false,
        maxDepth: 10,
        excludePatterns: ['.git', 'node_modules', '.lokus', '.DS_Store']
      });

      useWorkspaceStore.getState().setGraphData(data);

    } catch (error) {
      useWorkspaceStore.getState().setGraphData(null);
    } finally {
      useWorkspaceStore.getState().setLoadingGraph(false);
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

    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter(t => t.path !== graphPath);
      newTabs.unshift({ path: graphPath, name: graphName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: graphPath });
  }, []);

  const handleOpenBasesTab = useCallback(() => {
    const basesPath = '__bases__';
    const basesName = 'Bases';

    posthog.trackFeatureActivation('database');

    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter(t => t.path !== basesPath);
      newTabs.unshift({ path: basesPath, name: basesName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: basesPath });
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
      useWorkspaceStore.setState({ currentDailyNoteDate: noteDate });
    } else {
      useWorkspaceStore.setState({ currentDailyNoteDate: null });
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
    useWorkspaceStore.setState({ draggedTabForSplit: tab });
  }, []);

  const handleSplitDragEnd = useCallback((tab) => {
    useWorkspaceStore.setState({ draggedTabForSplit: null });
  }, []);

  const handleToggleSplitView = useCallback(async () => {
    const newSplitView = !useWorkspaceStore.getState().useSplitView;
    useWorkspaceStore.setState({ useSplitView: newSplitView });
    if (newSplitView) {
      // When enabling split view, load the next tab in right pane
      const { openTabs: tabs, activeFile: active } = useWorkspaceStore.getState();
      const currentIndex = tabs.findIndex(t => t.path === active);
      const nextTab = tabs[currentIndex + 1] || tabs[0];
      if (nextTab && nextTab.path !== active) {
        useWorkspaceStore.setState({ rightPaneFile: nextTab.path });
        // Extract just the filename in case name contains a path
        const fileName = getFilename(nextTab.name);
        useWorkspaceStore.setState({ rightPaneTitle: fileName.replace(/\.md$/, "") });

        // Load the content for the right pane asynchronously
        setTimeout(async () => {
          const isSpecialView = nextTab.path === '__kanban__' ||
            nextTab.path === '__bases__' ||
            nextTab.path.startsWith('__graph__') ||
            nextTab.path.startsWith('__plugin_') ||
            nextTab.path.endsWith('.canvas') || nextTab.path.endsWith('.kanban');

          const { activeFile: curActive, editorContent: curContent } = useWorkspaceStore.getState();
          if (!isSpecialView && (nextTab.path.endsWith('.md') || nextTab.path.endsWith('.txt'))) {
            // Check if this file is already loaded in the left pane
            if (nextTab.path === curActive && curContent) {
              useWorkspaceStore.setState({ rightPaneContent: curContent });
            } else {
              try {
                const content = await invoke("read_file_content", { path: nextTab.path });
                useWorkspaceStore.setState({ rightPaneContent: content || '' });
              } catch (err) {
                useWorkspaceStore.setState({ rightPaneContent: '' });
              }
            }
          } else {
            // For special views, just clear content
            useWorkspaceStore.setState({ rightPaneContent: '' });
          }
        }, 0);
      }
    } else {
      // Clear right pane when disabling split view
      useWorkspaceStore.setState({ rightPaneFile: null, rightPaneContent: '', rightPaneTitle: '' });
    }
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
    useWorkspaceStore.getState().setPaneSize(newSize);
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
    useWorkspaceStore.getState().setPaneSize(50);
  }, []);

  const toggleSplitDirection = useCallback(() => {
    useWorkspaceStore.setState((s) => ({ splitDirection: s.splitDirection === 'vertical' ? 'horizontal' : 'vertical' }));
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
      useWorkspaceStore.getState().setBottomHeight(newHeight);
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
      useWorkspaceStore.setState({ useSplitView: true });
      return;
    }

    // Handle tab reordering
    if (over && active.id !== over.id) {
      useWorkspaceStore.setState((s) => {
        const oldIndex = s.openTabs.findIndex((t) => t.path === active.id);
        const newIndex = s.openTabs.findIndex((t) => t.path === over.id);
        if (oldIndex === -1 || newIndex === -1) return {};
        const newTabs = Array.from(s.openTabs);
        const [removed] = newTabs.splice(oldIndex, 1);
        newTabs.splice(newIndex, 0, removed);
        return { openTabs: newTabs };
      });
    }
  };

  // Shortcuts handled by <ShortcutListener /> in JSX — see src/features/shortcuts/

  // (keyboard + Tauri event listeners removed — handled by ShortcutListener)

  // Template picker DOM event (not in Tauri menu system)
  useEffect(() => {
    const handleTemplatePicker = (event) => {
      const data = event?.detail || event;
      useWorkspaceStore.setState({ templatePickerData: data });
      useWorkspaceStore.getState().openPanel('showTemplatePicker');
    };
    window.addEventListener('open-template-picker', handleTemplatePicker);
    return () => window.removeEventListener('open-template-picker', handleTemplatePicker);
  }, []);

  const cols = (() => {
    const mainContent = `minmax(0,1fr)`;
    const leftPanel = showLeft ? `${leftW}px 1px ` : "";
    const rightPanel = showRight ? ` 1px ${rightW}px` : "";
    return `48px 1px ${leftPanel}${mainContent}${rightPanel}`;
  })();

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
      <ShortcutListener
        workspacePath={path}
        editorRef={editorRef}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onCreateCanvas={handleCreateCanvas}
        onOpenDailyNote={handleOpenDailyNote}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        onOpenWorkspace={handleOpenWorkspace}
        onPrint={() => window.print()}
      />
      <div className={`h-full bg-app-panel text-app-text flex flex-col font-sans transition-colors duration-300 overflow-hidden no-select relative ${isMobile() ? 'safe-area-inset-top' : ''}`}>
        {/* Product Tour */}
        <OnboardingWizard />

        {/* Service Status / Maintenance Banner */}
        <ServiceStatus />

        {/* Test Mode Indicator */}
        {isTestMode && (
          <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-md text-sm font-medium z-50">
            🧪 Test Mode Active
          </div>
        )}

        {/* Workspace Toolbar - positioned in titlebar area */}
        <div
          className="fixed top-0 left-0 right-0 flex items-center justify-between z-50"
          data-tauri-drag-region
          style={{
            height: '29px',
            paddingLeft: platformService.isMacOS() ? '80px' : '8px',
            paddingRight: '8px',
            backgroundColor: 'rgb(var(--panel))',
            borderBottom: '1px solid rgb(var(--border))'
          }}
        >
          {/* Left Section: New File, New Folder, New Canvas buttons */}
          <div className="flex items-center gap-1">
            {uiVisibility.toolbar_new_file && (
              <button
                onClick={handleCreateFile}
                className="obsidian-button icon-only small"
                title={`New File (${platformService.getModifierSymbol()}+N)`}
                data-tauri-drag-region="false"
                data-tour="create-note"
                style={{ pointerEvents: 'auto' }}
              >
                <FilePlusCorner className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            {uiVisibility.toolbar_new_folder && (
              <button
                onClick={handleCreateFolder}
                className="obsidian-button icon-only small"
                title={`New Folder (${platformService.getModifierSymbol()}+Shift+N)`}
                data-tauri-drag-region="false"
                style={{ pointerEvents: 'auto' }}
              >
                <FolderOpen className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            {featureFlags.enable_canvas && uiVisibility.toolbar_new_canvas && (
              <button
                onClick={handleCreateCanvas}
                className="obsidian-button icon-only small"
                title="New Canvas"
                data-tauri-drag-region="false"
                style={{ pointerEvents: 'auto' }}
              >
                <SquareKanban className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Center Section: Responsive Tab Bar */}
          <div
            className="absolute flex items-center overflow-hidden px-2"
            style={{
              left: showLeft ? `${leftW + 57}px` : `${platformService.isMacOS() ? 200 : 120}px`,
              right: showRight ? `${rightW + 120}px` : '120px',
              top: 0,
              height: '32px'
            }}
          >
            <ResponsiveTabBar
              tabs={openTabs}
              activeTab={activeFile}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              unsavedChanges={unsavedChanges}
              reservedSpace={0}
            />
          </div>

          {/* Right Section: Split View, Right Sidebar, and New Tab buttons */}
          <div className="flex items-center gap-1">
            {uiVisibility.toolbar_split_view && (
              <button
                onClick={handleToggleSplitView}
                className={`obsidian-button icon-only small ${useSplitView ? 'active' : ''}`}
                title={useSplitView ? "Exit Split View" : "Enter Split View"}
                data-tauri-drag-region="false"
                data-tour="split-view"
                style={{ pointerEvents: 'auto' }}
              >
                <SquareSplitHorizontal className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            <button
              onClick={() => useWorkspaceStore.getState().toggleRight()}
              className={`obsidian-button icon-only small ${showRight ? 'active' : ''}`}
              title={showRight ? "Hide Right Sidebar" : "Show Right Sidebar"}
              data-tauri-drag-region="false"
              style={{ pointerEvents: 'auto' }}
            >
              {showRight ? (
                <PanelRightClose className="w-5 h-5" strokeWidth={2} />
              ) : (
                <PanelRightOpen className="w-5 h-5" strokeWidth={2} />
              )}
            </button>
            <button
              onClick={handleCreateFile}
              className="obsidian-button icon-only small"
              title="New Tab"
              data-tauri-drag-region="false"
              style={{ pointerEvents: 'auto' }}
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid overflow-hidden border-t border-app-border/30" style={{ gridTemplateColumns: cols, gap: 0 }}>
          <aside className="flex flex-col items-center gap-1 border-r border-app-border bg-app-panel" style={{ paddingTop: platformService.isMacOS() ? '0.5rem' : '0.75rem', paddingBottom: '0.75rem' }}>
            {/* Menu Toggle */}
            <button
              onClick={() => useWorkspaceStore.getState().toggleLeft()}
              title={showLeft ? "Hide sidebar" : "Show sidebar"}
              className="obsidian-button icon-only mb-2"
              onMouseEnter={(e) => {
                const icon = e.currentTarget.querySelector('svg');
                if (icon) icon.style.color = 'rgb(var(--accent))';
              }}
              onMouseLeave={(e) => {
                const icon = e.currentTarget.querySelector('svg');
                if (icon) icon.style.color = showLeft ? 'white' : 'black';
              }}
            >
              <LokusLogo className="w-6 h-6" style={{ color: showLeft ? 'white' : 'black' }} />
            </button>

            {/* Activity Bar - VS Code Style */}
            <div className="w-full pt-2">
              <button
                onClick={() => {
                  useWorkspaceStore.setState({ showKanban: false });
                  useWorkspaceStore.setState({ showPlugins: false });
                  useWorkspaceStore.setState({ showBases: false });
                  useWorkspaceStore.setState({ showGraphView: false });
                  useWorkspaceStore.getState().openPanel('showLeft');
                }}
                title="Explorer"
                data-tour="files"
                className="obsidian-button icon-only w-full mb-1"
                onMouseEnter={(e) => {
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = 'rgb(var(--accent))';
                }}
                onMouseLeave={(e) => {
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = (!showKanban && !showPlugins && !showBases && !showGraphView && showLeft) ? 'rgb(var(--accent))' : '';
                }}
              >
                <FolderOpen className="w-5 h-5" style={!showKanban && !showPlugins && !showBases && !showGraphView && showLeft ? { color: 'rgb(var(--accent))' } : {}} />
              </button>

              {uiVisibility.sidebar_kanban && (
                <button
                  onClick={() => {
                    useWorkspaceStore.setState({ showKanban: true });
                    useWorkspaceStore.setState({ showPlugins: false });
                    useWorkspaceStore.setState({ showBases: false });
                    useWorkspaceStore.setState({ showGraphView: false });
                    useWorkspaceStore.getState().openPanel('showLeft');
                  }}
                  title="Task Board"
                  className="obsidian-button icon-only w-full mb-1"
                  onMouseEnter={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = 'rgb(var(--accent))';
                  }}
                  onMouseLeave={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = (showKanban && !showPlugins && !showBases && !showGraphView) ? 'rgb(var(--accent))' : '';
                  }}
                >
                  <LayoutGrid className="w-5 h-5" style={showKanban && !showPlugins && !showBases && !showGraphView ? { color: 'rgb(var(--accent))' } : {}} />
                </button>
              )}

              {featureFlags.enable_plugins && uiVisibility.sidebar_plugins && (
                <button
                  onClick={() => {
                    useWorkspaceStore.setState({ showPlugins: true });
                    useWorkspaceStore.setState({ showKanban: false });
                    useWorkspaceStore.setState({ showBases: false });
                    useWorkspaceStore.setState({ showGraphView: false });
                    useWorkspaceStore.getState().openPanel('showLeft');
                  }}
                  title="Extensions"
                  className="obsidian-button icon-only w-full mb-1"
                  onMouseEnter={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = 'rgb(var(--accent))';
                  }}
                  onMouseLeave={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = (showPlugins && !showKanban && !showBases && !showGraphView) ? 'rgb(var(--accent))' : '';
                  }}
                >
                  <Puzzle className="w-5 h-5" style={showPlugins && !showKanban && !showBases && !showGraphView ? { color: 'rgb(var(--accent))' } : {}} />
                </button>
              )}

              {uiVisibility.sidebar_bases && (
                <button
                  onClick={() => {
                    handleOpenBasesTab();
                  }}
                  title="Bases"
                  data-tour="bases"
                  className="obsidian-button icon-only w-full mb-1"
                  onMouseEnter={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = 'rgb(var(--accent))';
                  }}
                  onMouseLeave={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = (showBases && !showKanban && !showPlugins && !showGraphView) ? 'rgb(var(--accent))' : '';
                  }}
                >
                  <Database className="w-5 h-5" style={showBases && !showKanban && !showPlugins && !showGraphView ? { color: 'rgb(var(--accent))' } : {}} />
                </button>
              )}

              {uiVisibility.sidebar_graph && (
                <button
                  onClick={handleOpenGraphView}
                  title="Graph View"
                  data-tour="graph"
                  className="obsidian-button icon-only w-full mb-1"
                  onMouseEnter={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = 'rgb(var(--accent))';
                  }}
                  onMouseLeave={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = '';
                  }}
                >
                  <Network className="w-5 h-5" />
                </button>
              )}

              {uiVisibility.sidebar_daily_notes && (
                <button
                  onClick={() => {
                    useWorkspaceStore.setState({ showDailyNotesPanel: !useWorkspaceStore.getState().showDailyNotesPanel });
                    useWorkspaceStore.getState().closePanel('showCalendarPanel');
                    useWorkspaceStore.getState().openPanel('showRight');
                    useWorkspaceStore.getState().closePanel('showVersionHistory');
                  }}
                  title="Daily Notes"
                  className={`obsidian-button icon-only w-full mb-1 ${showDailyNotesPanel ? 'active' : ''}`}
                  data-tour="daily-notes"
                  onMouseEnter={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = 'rgb(var(--accent))';
                  }}
                  onMouseLeave={(e) => {
                    const icon = e.currentTarget.querySelector('svg');
                    if (icon) icon.style.color = showDailyNotesPanel ? 'rgb(var(--accent))' : '';
                  }}
                >
                  <Calendar className="w-5 h-5" style={showDailyNotesPanel ? { color: 'rgb(var(--accent))' } : {}} />
                </button>
              )}

              {/* Calendar Integration button */}
              <button
                onClick={() => {
                  useWorkspaceStore.setState({ showCalendarPanel: !useWorkspaceStore.getState().showCalendarPanel });
                  useWorkspaceStore.getState().closePanel('showDailyNotesPanel');
                  useWorkspaceStore.getState().openPanel('showRight');
                  useWorkspaceStore.getState().closePanel('showVersionHistory');
                }}
                title="Calendar"
                className={`obsidian-button icon-only w-full mb-1 ${showCalendarPanel ? 'active' : ''}`}
                onMouseEnter={(e) => {
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = 'rgb(var(--accent))';
                }}
                onMouseLeave={(e) => {
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = showCalendarPanel ? 'rgb(var(--accent))' : '';
                }}
              >
                <CalendarDays className="w-5 h-5" style={showCalendarPanel ? { color: 'rgb(var(--accent))' } : {}} />
              </button>


            </div>
          </aside>
          <div className="bg-app-border/20 w-px" />
          {showLeft && (
            <aside className="overflow-y-auto flex flex-col">
              {featureFlags.enable_plugins && showPlugins ? (
                <div className="flex-1 overflow-hidden">
                  <PluginSettings onOpenPluginDetail={handleOpenPluginDetail} />
                </div>
              ) : showBases ? (
                <div className="flex-1 overflow-hidden">
                  <BasesView isVisible={true} onFileOpen={handleFileOpen} />
                </div>
              ) : showKanban ? (
                <div className="flex-1 overflow-hidden">
                  <KanbanList
                    workspacePath={path}
                    onBoardOpen={handleFileOpen}
                    onCreateBoard={handleCreateKanban}
                    onBoardAction={handleKanbanBoardAction}
                  />
                </div>
              ) : showGraphView ? (
                <div className="flex-1 overflow-hidden p-4">
                  <div className="text-center mb-4">
                    <button
                      onClick={handleOpenGraphView}
                      className="obsidian-button primary w-full"
                    >
                      Open Graph View
                    </button>
                  </div>
                  <div className="text-sm text-app-muted">
                    <p className="mb-2">The graph view shows the connections between your notes.</p>
                    {isDesktop() && (<p>Use <kbd className="px-1 py-0.5 text-xs bg-app-panel rounded">Cmd+Shift+G</kbd> to quickly open the graph view.</p>)}
                  </div>
                </div>
              ) : (
                <>
                  {/* Explorer Header */}
                  <div className="h-10 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
                    <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">Explorer</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleRefreshFiles}
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
                          onFileClick={handleFileOpen}
                          activeFile={activeFile}
                          onRefresh={handleRefreshFiles}
                          data-testid="file-tree"
                          expandedFolders={expandedFolders}
                          toggleFolder={toggleFolder}
                          creatingItem={creatingItem}                                                                                                                                            
                          onCreateConfirm={handleConfirmCreate}
                          keymap={keymap}
                          selectedPath={selectedPath}
                          setSelectedPath={(x) => useWorkspaceStore.getState().selectEntry(x)}
                          renamingPath={renamingPath}
                          setRenamingPath={(x) => useWorkspaceStore.setState({ renamingPath: x })}
                          onViewHistory={toggleVersionHistory}
                          setTagModalFile={(x) => useWorkspaceStore.setState({ tagModalFile: x })}
                          setShowTagModal={(v) => v ? useWorkspaceStore.getState().openPanel('showTagModal') : useWorkspaceStore.getState().closePanel('showTagModal')}
                          setUseSplitView={(x) => useWorkspaceStore.setState({ useSplitView: x })}
                          setRightPaneFile={(x) => useWorkspaceStore.setState({ rightPaneFile: x })}
                          setRightPaneTitle={(x) => useWorkspaceStore.setState({ rightPaneTitle: x })}
                          setRightPaneContent={(x) => useWorkspaceStore.setState({ rightPaneContent: x })}
                          isExternalDragActive={isExternalDragActive}
                          hoveredFolder={hoveredFolder}
                          setHoveredFolder={(x) => useWorkspaceStore.setState({ hoveredFolder: x })}
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
                       { isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>} 
                      </ContextMenuItem>
                      {featureFlags.enable_canvas && (
                        <ContextMenuItem onClick={handleCreateCanvas}>
                          New Canvas
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem onClick={handleCreateFolder}>
                        New Folder
                        { isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={handleOpenDailyNote}>
                        Open Daily Note
                        { isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['daily-note'])}</span>}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={handleRefreshFiles}>Refresh</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </>
              )}
            </aside>
          )}
          {showLeft && <div onMouseDown={startLeftDrag} className="cursor-col-resize bg-app-border hover:bg-app-accent transition-colors duration-300 w-1 min-h-full" />}
          <main className="min-w-0 min-h-0 flex flex-col bg-app-bg">
            {/* Main content area */}
            <>
              {useSplitView ? (
                /* Split View - Two Complete Panes */
                <div className={`h-full overflow-hidden ${splitDirection === 'vertical' ? 'flex' : 'flex flex-col'}`}>
                  {/* Left/Top Pane */}
                  <div
                    className={`flex flex-col overflow-hidden ${splitDirection === 'vertical'
                      ? 'border-r border-app-border'
                      : 'border-b border-app-border'
                      }`}
                    style={{
                      [splitDirection === 'vertical' ? 'width' : 'height']: `${leftPaneSize}%`
                    }}
                  >
                    {/* Left/Top Pane Content */}
                    {activeFile ? (
                      <div
                        ref={leftPaneScrollRef}
                        className="flex-1 p-4 overflow-y-auto"
                        onScroll={handleLeftPaneScroll}
                      >
                        <input
                          type="text"
                          value={editorTitle}
                          onChange={(e) => useWorkspaceStore.getState().setTitle(e.target.value)}
                          className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                        />
                        <Editor
                          ref={editorRef}
                          content={editorContent}
                          onContentChange={handleEditorChange}
                          onEditorReady={(e) => useWorkspaceStore.getState().setEditor(e)}
                          isLoading={isLoadingContent}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-app-muted">
                        No file selected
                      </div>
                    )}
                  </div>

                  {/* Resizer */}
                  <div
                    className={`${splitDirection === 'vertical'
                      ? 'w-1 cursor-col-resize hover:bg-app-accent'
                      : 'h-1 cursor-row-resize hover:bg-app-accent'
                      } bg-app-border transition-colors duration-200 flex-shrink-0`}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={resetPaneSize}
                  />

                  {/* Right/Bottom Pane */}
                  <div
                    className="flex flex-col overflow-hidden"
                    style={{
                      [splitDirection === 'vertical' ? 'width' : 'height']: `${100 - leftPaneSize}%`
                    }}
                  >
                    {/* Right/Bottom Pane Content */}
                    {rightPaneFile ? (
                      featureFlags.enable_canvas && rightPaneFile && rightPaneFile.endsWith('.canvas') ? (
                        <div className="flex-1 overflow-hidden">
                          <Canvas
                            canvasPath={rightPaneFile}
                            canvasName={openTabs.find(tab => tab.path === rightPaneFile)?.name}
                            onSave={async (canvasData) => {
                              try {
                                await canvasManager.saveCanvas(rightPaneFile, canvasData);
                                useWorkspaceStore.setState((s) => {
                                  const newSet = new Set(s.unsavedChanges);
                                  newSet.delete(rightPaneFile);
                                  return { unsavedChanges: newSet };
                                });
                              } catch { }
                            }}
                            onChange={() => {
                              useWorkspaceStore.setState((s) => ({ unsavedChanges: new Set(s.unsavedChanges).add(rightPaneFile) }));
                            }}
                          />
                        </div>
                      ) : rightPaneFile && rightPaneFile.endsWith('.kanban') ? (
                        <div className="flex-1 overflow-hidden">
                          <KanbanBoard
                            workspacePath={path}
                            boardPath={rightPaneFile}
                            onFileOpen={handleFileOpen}
                          />
                        </div>
                      ) : rightPaneFile && rightPaneFile.endsWith('.pdf') ? (
                        <div className="flex-1 overflow-hidden">
                          <PDFViewerTab
                            file={rightPaneFile}
                            onClose={() => {
                              useWorkspaceStore.setState((s) => ({ openTabs: s.openTabs.filter(tab => tab.path !== rightPaneFile) }));
                              useWorkspaceStore.setState({ rightPaneFile: null });
                            }}
                          />
                        </div>
                      ) : rightPaneFile.startsWith('__graph__') ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                          <ProfessionalGraphView
                            fileTree={filteredFileTree}
                            activeFile={rightPaneFile}
                            onFileOpen={handleFileOpen}
                            workspacePath={path}
                          />
                        </div>
                      ) : rightPaneFile === '__bases__' ? (
                          <div className="h-full">
                            <BasesView isVisible={true} onFileOpen={handleFileOpen} />
                          </div>
                        ) : featureFlags.enable_plugins && rightPaneFile.startsWith('__plugin_') ? (
                          <div className="flex-1 overflow-hidden">
                            {(() => {
                              const activeTab = openTabs.find(tab => tab.path === rightPaneFile);
                              return activeTab?.plugin ? <PluginDetail plugin={activeTab.plugin} /> : <div>Plugin not found</div>;
                            })()}
                          </div>
                        ) : (
                          <div
                            ref={rightPaneScrollRef}
                            className="flex-1 p-4 overflow-y-auto"
                            onScroll={handleRightPaneScroll}
                          >
                            <input
                              type="text"
                              value={rightPaneTitle}
                              onChange={(e) => useWorkspaceStore.setState({ rightPaneTitle: e.target.value })}
                              className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                            />
                            <Editor
                              key={`right-pane-${rightPaneFile}`}
                              content={rightPaneContent}
                              onContentChange={(content) => useWorkspaceStore.setState({ rightPaneContent: content })}
                              onEditorReady={(e) => useWorkspaceStore.getState().setEditor(e)}
                            />
                          </div>
                        )
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-app-muted">
                        Click a tab to open file in this pane
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Single View */
                <>
                  {featureFlags.enable_canvas && activeFile && activeFile.endsWith('.canvas') ? (
                    <div className="flex-1 overflow-hidden">
                      <Canvas
                        canvasPath={activeFile}
                        canvasName={openTabs.find(tab => tab.path === activeFile)?.name}
                        onSave={async (canvasData) => {
                          try {
                            await canvasManager.saveCanvas(activeFile, canvasData);
                            useWorkspaceStore.setState((s) => {
                              const newSet = new Set(s.unsavedChanges);
                              newSet.delete(activeFile);
                              return { unsavedChanges: newSet };
                            });
                          } catch { }
                        }}
                        onContentChange={(canvasData) => {
                          useWorkspaceStore.setState((s) => {
                            const newSet = new Set(s.unsavedChanges);
                            newSet.add(activeFile);
                            return { unsavedChanges: newSet };
                          });
                        }}
                        initialData={null} // Will be loaded by Canvas component
                      />
                    </div>
                  ) : activeFile && activeFile.endsWith('.kanban') ? (
                    <div className="flex-1 overflow-hidden">
                      <KanbanBoard
                        workspacePath={path}
                        boardPath={activeFile}
                        onFileOpen={handleFileOpen}
                      />
                    </div>
                  ) : activeFile && activeFile.endsWith('.pdf') ? (
                    <div className="flex-1 overflow-hidden">
                      <PDFViewerTab
                        file={activeFile}
                        onClose={() => {
                          useWorkspaceStore.setState((s) => ({ openTabs: s.openTabs.filter(tab => tab.path !== activeFile) }));
                          useWorkspaceStore.setState({ activeFile: null });
                        }}
                      />
                    </div>
                  ) : activeFile && isImageFile(activeFile) ? (
                    <div className="flex-1 overflow-hidden">
                      <ImageViewerTab
                        imagePath={activeFile}
                        allImageFiles={allImageFiles}
                        onImageChange={(newPath) => {
                          // Update active file and tab name when navigating between images
                          useWorkspaceStore.setState({ activeFile: newPath });
                          useWorkspaceStore.setState((s) => ({
                            openTabs: s.openTabs.map(tab =>
                              tab.path === activeFile
                                ? { ...tab, path: newPath, name: getFilename(newPath) }
                                : tab
                            )
                          }));
                        }}
                      />
                    </div>
                  ) : activeFile === '__graph__' ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                      <ProfessionalGraphView
                        isVisible={true}
                        fileTree={filteredFileTree}
                        workspacePath={path}
                        onOpenFile={handleFileOpen}
                        onGraphStateChange={handleGraphStateChange}
                      />
                    </div>
                  ) : activeFile === '__bases__' ? (
                    <div className="flex-1 h-full overflow-hidden">
                      <BasesView isVisible={true} onFileOpen={handleFileOpen} />
                    </div>
                  ) : activeFile === '__calendar__' ? (
                    <div className="flex-1 h-full overflow-hidden">
                      <CalendarView
                        workspacePath={path}
                        onClose={() => {
                          const remaining = openTabs.filter(t => t.path !== '__calendar__');
                          useWorkspaceStore.setState({ openTabs: remaining });
                          useWorkspaceStore.setState({ activeFile: remaining[0]?.path || null });
                        }}
                        onOpenSettings={async () => {
                          try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            await invoke('open_preferences_window', { workspacePath: path, section: 'Connections' });
                          } catch (e) {
                            console.error('Failed to open preferences:', e);
                          }
                        }}
                      />
                    </div>
                  ) : featureFlags.enable_plugins && activeFile && activeFile.startsWith('__plugin_') ? (
                      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
                        <div className="max-w-full mx-auto h-full">
                          <div className="flex-1 overflow-hidden">
                            {(() => {
                              const activeTab = openTabs.find(tab => tab.path === activeFile);
                              return activeTab?.plugin ? <PluginDetail plugin={activeTab.plugin} /> : <div>Plugin not found</div>;
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : activeFile === '__old_graph__' ? (
                      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
                        <div className="max-w-full mx-auto h-full">
                          <div className="h-full flex flex-col">
                            {isLoadingGraph ? (
                              <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="animate-spin w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                                  <h2 className="text-xl font-medium text-app-text mb-2">Building Graph</h2>
                                  <p className="text-app-muted">Processing your workspace files...</p>
                                </div>
                              </div>
                            ) : graphData ? (
                              <div className="flex-1 h-full">
                                <div>Old Graph View - REMOVED</div>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <div className="mb-6">
                                  <Network className="w-16 h-16 text-app-muted/50 mx-auto mb-4" />
                                  <h2 className="text-xl font-medium text-app-text mb-2">Graph View</h2>
                                  <p className="text-app-muted mb-6 max-w-md">
                                    {isLoadingGraph
                                      ? 'Building your knowledge graph...'
                                      : 'Visualize the connections between your notes and discover hidden relationships in your knowledge base.'
                                    }
                                  </p>
                                </div>
                                {isLoadingGraph && (
                                  <div className="flex items-center gap-2 text-app-accent">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                                    <span>Processing notes...</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : activeFile ? (
                      <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Breadcrumb navigation at top of editor */}
                        <Breadcrumbs
                          activeFile={activeFile}
                          workspacePath={path}
                          onNavigate={(folderPath) => {
                            // Expand the folder and scroll to it
                            if (folderPath !== path) {
                              toggleFolder(folderPath);
                            }
                          }}
                        />

                        <div className="flex-1 overflow-y-auto">
                          <div className="p-8 md:p-12 max-w-full mx-auto">
                            <EditorDropZone>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div>
                                    <input
                                      type="text"
                                      value={editorTitle}
                                      onChange={(e) => useWorkspaceStore.getState().setTitle(e.target.value)}
                                      className="w-full bg-transparent text-4xl font-bold mb-4 outline-none text-app-text"
                                    />
                                    <div data-tour="editor">
                                      <Editor
                                        ref={editorRef}
                                        content={editorContent}
                                        onContentChange={handleEditorChange}
                                        onEditorReady={(e) => useWorkspaceStore.getState().setEditor(e)}
                                        isLoading={isLoadingContent}
                                      />
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem onClick={handleSave}>
                                    Save
                                    { isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['save-file'])}</span>}
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => useWorkspaceStore.getState().activeFile && handleTabClose(useWorkspaceStore.getState().activeFile)}>
                                    Close Tab
                                    { isDesktop() && <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['close-tab'])}</span>}
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => document.execCommand && document.execCommand('selectAll')}>Select All</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </EditorDropZone>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col overflow-hidden">
                        {/* Modern Welcome Screen - VS Code Inspired */}
                        <div className="flex-1 overflow-y-auto p-8">
                          <div className="max-w-4xl w-full mx-auto min-h-full flex flex-col justify-center">

                            {/* Header Section */}
                            <div className="text-center mb-10">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center">
                                <LokusLogo className="w-10 h-10 text-app-accent" />
                              </div>
                              <h1 className="text-3xl font-bold text-app-text mb-2">Welcome to Lokus</h1>
                              <p className="text-app-muted text-lg">Your modern knowledge management platform</p>
                            </div>

                            {/* Quick Actions */}
                            <div className="mb-12">
                              <h2 className="text-lg font-semibold text-app-text mb-6">Start</h2>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <button
                                  onClick={handleCreateFile}
                                  className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                                    <FilePlus2 className="w-5 h-5 text-app-accent" />
                                  </div>
                                  <h3 className="font-medium text-app-text mb-2">New Note</h3>
                                  <p className="text-sm text-app-muted">Create your first note and start writing</p>
                                  {isDesktop() && (<div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+N")}</div>)}
                                </button>

                                {featureFlags.enable_canvas && (
                                  <button
                                    onClick={handleCreateCanvas}
                                    className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                                  >
                                    <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                                      <Layers className="w-5 h-5 text-app-accent" />
                                    </div>
                                    <h3 className="font-medium text-app-text mb-2">New Canvas</h3>
                                    <p className="text-sm text-app-muted">Create visual mind maps and diagrams</p>
                                  </button>
                                )}

                                <button
                                  onClick={handleCreateFolder}
                                  className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                                    <FolderPlus className="w-5 h-5 text-app-accent" />
                                  </div>
                                  <h3 className="font-medium text-app-text mb-2">New Folder</h3>
                                  <p className="text-sm text-app-muted">Organize your notes with folders</p>
                                  {isDesktop() && (<div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+Shift+N")}</div>)}
                                </button>

                                <button
                                  onClick={() => useWorkspaceStore.getState().openPanel('showCommandPalette')}
                                  className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                                  data-tour="templates"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                                    <Search className="w-5 h-5 text-app-accent" />
                                  </div>
                                  <h3 className="font-medium text-app-text mb-2">Command Palette</h3>
                                  <p className="text-sm text-app-muted">Quick access to all commands</p>
                                  {isDesktop() && (<div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+K")}</div>)}
                                </button>
                              </div>
                            </div>

                            {/* Recent & Help */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div>
                                <h2 className="text-lg font-semibold text-app-text mb-4">Recent</h2>
                                <div className="space-y-2">
                                  {recentFiles.length > 0 ? (
                                    recentFiles.map((file, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => handleFileOpen(file)}
                                        className="w-full p-3 rounded-lg bg-app-panel/20 border border-app-border/50 hover:bg-app-panel/40 hover:border-app-accent/50 transition-all text-left group"
                                      >
                                        <div className="flex items-center gap-3">
                                          {file.path.endsWith('.md') ? (
                                            <svg className="w-4 h-4 text-app-muted group-hover:text-app-accent transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                            </svg>
                                          ) : file.path.endsWith('.canvas') || file.path.endsWith('.kanban') ? (
                                            <svg className="w-4 h-4 text-app-muted group-hover:text-app-accent transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25z" clipRule="evenodd" />
                                            </svg>
                                          ) : file.path.endsWith('.pdf') ? (
                                            <svg className="w-4 h-4 text-app-muted group-hover:text-app-accent transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                              <path d="M4 4a2 2 0 012-2h8l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8v-8h-4V4H6zm6 0v3h3l-3-3zM8 13a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0-3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                            </svg>
                                          ) : (
                                            <svg className="w-4 h-4 text-app-muted group-hover:text-app-accent transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                          <span className="text-sm font-medium text-app-text group-hover:text-app-accent transition-colors truncate">
                                            {file.name.replace(/\.(md|txt|canvas)$/, '')}
                                          </span>
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                                      <p className="text-sm text-app-muted">No recent files yet. Start by creating your first note!</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h2 className="text-lg font-semibold text-app-text mb-4">Learn</h2>
                                <div className="space-y-3">
                                  <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                                    <h3 className="font-medium text-app-text text-sm mb-2">✨ Features</h3>
                                    <ul className="text-sm text-app-muted space-y-1">
                                      <li>• Rich text editing with math equations</li>
                                      <li>• Wiki-style linking with <code className="px-1 py-0.5 bg-app-bg/50 rounded text-xs">[[brackets]]</code></li>
                                      <li>• Task management and kanban boards</li>
                                      <li>• Plugin system for extensibility</li>
                                    </ul>
                                  </div>
                                  {isDesktop() && (
                                  <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                                    <h3 className="font-medium text-app-text text-sm mb-2">⌨️ Quick Tips</h3>
                                    <ul className="text-sm text-app-muted space-y-1">
                                      <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+K</kbd> Command palette</li>
                                      <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+S</kbd> Save current file</li>
                                      <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+P</kbd> Quick file open</li>
                                      <li>• Drag files to move them between folders</li>
                                    </ul>
                                  </div>)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </>
              )}
            </>
          </main>
          {showRight && <div onMouseDown={startRightDrag} className="cursor-col-resize bg-app-border hover:bg-app-accent transition-colors duration-300 w-1 min-h-full" />}
          {showRight && (
            <aside className="overflow-y-auto flex flex-col bg-app-panel border-l border-app-border" style={{ width: `${rightW}px` }}>
              {/* Show VersionHistory, GraphSidebar, DailyNotesPanel, or DocumentOutline */}
              <div className="flex-1 overflow-hidden">
                {showVersionHistory ? (
                  <VersionHistoryPanel
                    key={`version-${activeFile}-${versionRefreshKey}`}
                    workspacePath={path}
                    filePath={activeFile}
                    onClose={() => useWorkspaceStore.getState().closePanel('showVersionHistory')}
                    onRestore={reloadCurrentFile}
                  />
                ) : showDailyNotesPanel ? (
                  <DailyNotesPanel
                    workspacePath={path}
                    onOpenDailyNote={handleOpenDailyNoteByDate}
                    currentDate={currentDailyNoteDate}
                  />
                ) : showCalendarPanel ? (
                  <CalendarWidget
                    onOpenCalendarView={() => {
                      // Open Calendar view as a special tab
                      const calendarPath = '__calendar__';
                      const calendarName = 'Calendar';

                      useWorkspaceStore.setState((s) => {
                        const newTabs = s.openTabs.filter(t => t.path !== calendarPath);
                        newTabs.unshift({ path: calendarPath, name: calendarName });
                        if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
                        return { openTabs: newTabs };
                      });
                      useWorkspaceStore.setState({ activeFile: calendarPath });
                    }}
                    onOpenSettings={async () => {
                      // Open preferences with calendar section
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        await invoke('open_preferences_window', { workspacePath: path, section: 'Connections' });
                      } catch (e) {
                        console.error('Failed to open preferences:', e);
                      }
                    }}
                  />
                ) : activeFile === '__graph__' ? (
                  <GraphSidebar
                    selectedNodes={graphSidebarData.selectedNodes}
                    hoveredNode={graphSidebarData.hoveredNode}
                    graphData={graphSidebarData.graphData}
                    stats={graphSidebarData.stats}
                    config={graphSidebarData.graphConfig}
                    onConfigChange={graphSidebarData.onConfigChange}
                    onNodeClick={(node) => {
                      // Focus on the clicked node in the graph
                      if (graphSidebarData.onFocusNode) {
                        graphSidebarData.onFocusNode(node);
                      }
                    }}
                    // Animation tour controls
                    isAnimating={graphSidebarData.isAnimating}
                    animationSpeed={graphSidebarData.animationSpeed}
                    onToggleAnimation={graphSidebarData.onToggleAnimation}
                    onAnimationSpeedChange={graphSidebarData.onAnimationSpeedChange}
                  />
                ) : (
                  <>
                    {/* Editor Mode Switcher */}
                    <EditorModeSwitcher />

                    {/* Document Outline */}
                    <div style={{ minHeight: '200px', maxHeight: '30%', overflowY: 'auto', borderBottom: '1px solid var(--border)' }}>
                      <DocumentOutline editor={editorRef.current?.editor} />
                    </div>

                    {/* Outgoing Links Panel - TODO: Implement OutgoingLinksPanel component */}
                    {/* <div style={{ minHeight: '200px', maxHeight: '30%', overflowY: 'auto', borderBottom: '1px solid var(--border)' }}>
                    <OutgoingLinksPanel
                      editor={editorRef.current?.editor}
                      onNavigate={handleFileOpen}
                      onCreateNote={(noteName) => {
                        const fileName = noteName.endsWith('.md') ? noteName : `${noteName}.md`;
                        const newPath = path ? `${path}/${fileName}` : fileName;
                        handleCreateFile(newPath);
                      }}
                    />
                  </div> */}

                    {/* Backlinks Panel */}
                    <div style={{ minHeight: '200px', flex: 1, overflowY: 'auto' }}>
                      <BacklinksPanel
                        graphData={graphProcessorRef.current?.getGraphDatabase()}
                        currentFile={activeFile}
                        onOpenFile={handleFileOpen}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Plugin Panels */}
              <PanelRegion
                position={PANEL_POSITIONS.SIDEBAR_RIGHT}
                className="border-t border-app-border"
              />
            </aside>
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
        <MeetingPanel workspacePath={path} />

        <CommandPalette
          open={showCommandPalette}
          setOpen={setShowCommandPalette}
          fileTree={filteredFileTree}
          openFiles={openTabs}
          onFileOpen={handleFileOpen}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onSave={handleSave}
          onOpenPreferences={() => {
            const openPreferences = () => {
              (async () => {
                try {
                  const { emit } = await import('@tauri-apps/api/event');
                  await emit('preferences:open');
                } catch {
                  try { window.dispatchEvent(new CustomEvent('preferences:open')); } catch { }
                }
              })();
            };
            openPreferences();
          }}
          onToggleSidebar={() => useWorkspaceStore.getState().toggleLeft()}
          onCloseTab={handleTabClose}
          onOpenGraph={() => {
            const graphPath = '__professional_graph__';
            const graphName = 'Professional Graph';

            useWorkspaceStore.setState((s) => {
              const newTabs = s.openTabs.filter(t => t.path !== graphPath);
              newTabs.unshift({ path: graphPath, name: graphName });
              if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
              return { openTabs: newTabs };
            });
            useWorkspaceStore.setState({ activeFile: graphPath });
          }}
          onShowTemplatePicker={(templateSelection) => {
            // Handle direct template selection from Command Palette
            if (templateSelection && templateSelection.template && templateSelection.processedContent) {
              const { template, processedContent } = templateSelection;

              if (editorRef.current && processedContent) {
                // Process template content through markdown compiler
                const compiler = getMarkdownCompiler()

                // Process template content through markdown compiler
                const processedWithMarkdown = compiler.processTemplate(processedContent)

                // Smart template insertion with cursor positioning
                const insertTemplateContent = (content) => {
                  // Check if content has {{cursor}} placeholder
                  const cursorIndex = content.indexOf('{{cursor}}');

                  if (cursorIndex !== -1) {
                    // Split content at cursor position
                    const beforeCursor = content.substring(0, cursorIndex);
                    const afterCursor = content.substring(cursorIndex + 10); // 10 = '{{cursor}}'.length

                    // Insert content in parts to position cursor correctly
                    return editorRef.current.chain()
                      .focus()
                      .insertContent(beforeCursor)
                      .insertContent(afterCursor)
                      .setTextSelection(beforeCursor.length + editorRef.current.state.selection.from)
                      .run();
                  } else {
                    // No cursor placeholder, just insert normally
                    return editorRef.current.chain()
                      .focus()
                      .insertContent(content)
                      .run();
                  }
                };

                try {
                  insertTemplateContent(processedWithMarkdown);
                } catch { }
              }
              return;
            }

            // Fall back to opening template picker modal
            useWorkspaceStore.getState().openPanel('showTemplatePicker');
            useWorkspaceStore.setState({ templatePickerData: {
              editorState: { editor: editorRef.current },
              onSelect: (template, processedContent) => {

                if (editorRef.current && processedContent) {
                  try {

                    // Process template content through markdown compiler
                    const compiler = getMarkdownCompiler()

                    // Process template content through markdown compiler
                    const processedWithMarkdown = compiler.processTemplate(processedContent)

                    // Smart template insertion with cursor positioning
                    const insertTemplateContent = (content) => {
                      // Check if content has {{cursor}} placeholder
                      const cursorIndex = content.indexOf('{{cursor}}');

                      if (cursorIndex !== -1) {
                        // Split content at cursor position
                        const beforeCursor = content.substring(0, cursorIndex);
                        const afterCursor = content.substring(cursorIndex + 10); // 10 = '{{cursor}}'.length

                        // Insert content in parts to position cursor correctly
                        return editorRef.current.chain()
                          .focus()
                          .insertContent(beforeCursor)
                          .insertContent(afterCursor)
                          .setTextSelection(beforeCursor.length + editorRef.current.state.selection.from)
                          .run();
                      } else {
                        // No cursor placeholder, just insert normally
                        return editorRef.current.chain()
                          .focus()
                          .insertContent(content)
                          .run();
                      }
                    };

                    // Try multiple insertion methods with smart cursor handling
                    const insertMethods = [
                      // Method 1: Smart template insertion with cursor positioning (markdown processed)
                      () => insertTemplateContent(processedWithMarkdown),

                      // Method 2: Standard chain operation (markdown processed)
                      () => editorRef.current.chain().focus().insertContent(processedWithMarkdown).run(),

                      // Method 3: Simple commands (markdown processed)
                      () => {
                        editorRef.current.commands.focus();
                        return editorRef.current.commands.insertContent(processedWithMarkdown);
                      },

                      // Method 4: Direct content insertion (markdown processed)
                      () => editorRef.current.commands.insertContent(processedWithMarkdown),

                      // Method 5: Manual transaction (fallback, clean content)
                      () => {
                        const { view } = editorRef.current;
                        const { state } = view;
                        const { tr } = state;
                        const pos = state.selection.from;
                        // Remove {{cursor}} and use markdown processed content for fallback
                        const cleanContent = processedWithMarkdown.replace(/\{\{cursor\}\}/g, '');
                        view.dispatch(tr.insertText(cleanContent, pos));
                      }
                    ];

                    let inserted = false;
                    for (let i = 0; i < insertMethods.length && !inserted; i++) {
                      try {
                        const result = insertMethods[i]();
                        inserted = true;
                      } catch { }
                    }

                    if (!inserted) {
                    }

                  } catch { }
                } else {
                }
              }
            } });
          }}
          onCreateTemplate={handleCreateTemplate}
          onOpenDailyNote={handleOpenDailyNote}
          onRefresh={handleRefreshFiles}
          activeFile={activeFile}
        />

        <InFileSearch
          editor={editorRef.current}
          isVisible={showInFileSearch}
          onClose={() => useWorkspaceStore.getState().closePanel('showInFileSearch')}
        />

        {showTemplatePicker && templatePickerData && (
          <TemplatePicker
            open={showTemplatePicker}
            onClose={() => {
              useWorkspaceStore.getState().closePanel('showTemplatePicker');
              useWorkspaceStore.setState({ templatePickerData: null });
            }}
            onSelect={(template, processedContent) => {
              if (templatePickerData.onSelect) {
                templatePickerData.onSelect(template, processedContent);
              }
              useWorkspaceStore.getState().closePanel('showTemplatePicker');
              useWorkspaceStore.setState({ templatePickerData: null });
            }}
            editorState={templatePickerData.editorState}
          />
        )}

        <FullTextSearchPanel
          isOpen={showGlobalSearch}
          onClose={() => useWorkspaceStore.getState().closePanel('showGlobalSearch')}
          onResultClick={(result) => {
            if (result.path) {
              handleFileOpen(result.path);
            }
            useWorkspaceStore.getState().closePanel('showGlobalSearch');
          }}
          workspacePath={path}
        />

        <ShortcutHelpModal
          isOpen={showShortcutHelp}
          onClose={() => useWorkspaceStore.getState().closePanel('showShortcutHelp')}
        />

        <CreateTemplate
          open={showCreateTemplate}
          onClose={() => useWorkspaceStore.getState().closePanel('showCreateTemplate')}
          initialContent={createTemplateContent}
          onSaved={handleCreateTemplateSaved}
        />

        {/* Date Picker Modal for Daily Notes */}
        <DatePickerModal
          isOpen={showDatePickerModal}
          onClose={() => useWorkspaceStore.getState().closePanel('showDatePickerModal')}
          onDateSelect={handleOpenDailyNoteByDate}
          workspacePath={path}
        />

        {/* Tag Management Modal */}
        <TagManagementModal
          isOpen={showTagModal}
          onClose={() => {
            useWorkspaceStore.getState().closePanel('showTagModal');
            useWorkspaceStore.setState({ tagModalFile: null });
          }}
          file={tagModalFile}
          onTagsUpdated={(file, tags) => {
            // Refresh file tree and Bases to show updated tags
            useWorkspaceStore.getState().refreshTree();
          }}
        />

        {/* About Dialog */}
        <AboutDialog
          isOpen={showAboutDialog}
          onClose={() => useWorkspaceStore.getState().closePanel('showAboutDialog')}
        />

        {/* Reference Update Modal */}
        <ReferenceUpdateModal
          isOpen={referenceUpdateModal.isOpen}
          oldPath={referenceUpdateModal.oldPath}
          newPath={referenceUpdateModal.newPath}
          affectedFiles={referenceUpdateModal.affectedFiles}
          isProcessing={referenceUpdateModal.isProcessing}
          result={referenceUpdateModal.result}
          onConfirm={handleConfirmReferenceUpdate}
          onClose={handleCloseReferenceModal}
        />

        {/* Bottom Panel with Tabs (Terminal and Output) - Desktop only */}
        {isDesktop() && (showTerminalPanel || showOutputPanel) && (
          <div style={{
            height: `${bottomPanelHeight}px`,
            borderTop: '1px solid rgb(var(--border))',
            backgroundColor: 'rgb(var(--panel))',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Resize Handle */}
            <div
              onMouseDown={handleBottomPanelResizeStart}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                cursor: 'ns-resize',
                backgroundColor: 'transparent',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--accent), 0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            />
            {/* Bottom Panel Tab Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--panel))',
              height: '32px'
            }}>
              {/* Terminal Tab - Desktop only */}
              {isDesktop() && (
                <button
                  onClick={() => {
                    useWorkspaceStore.getState().setBottomTab('terminal');
                    useWorkspaceStore.getState().openPanel('showTerminalPanel');
                    useWorkspaceStore.getState().closePanel('showOutputPanel');
                  }}
                  style={{
                    padding: '0 12px',
                    height: '100%',
                    border: 'none',
                    background: bottomPanelTab === 'terminal' ? 'rgb(var(--app-panel))' : 'transparent',
                    color: bottomPanelTab === 'terminal' ? 'rgb(var(--text))' : 'rgb(var(--text-muted))',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: bottomPanelTab === 'terminal' ? '2px solid rgb(var(--accent))' : 'none',
                    fontWeight: bottomPanelTab === 'terminal' ? '500' : 'normal'
                  }}
                >
                  Terminal
                </button>
              )}
              <button
                onClick={() => {
                  useWorkspaceStore.getState().setBottomTab('output');
                  useWorkspaceStore.getState().openPanel('showOutputPanel');
                  useWorkspaceStore.getState().closePanel('showTerminalPanel');
                }}
                style={{
                  padding: '0 12px',
                  height: '100%',
                  border: 'none',
                  background: bottomPanelTab === 'output' ? 'rgb(var(--app-panel))' : 'transparent',
                  color: bottomPanelTab === 'output' ? 'rgb(var(--text))' : 'rgb(var(--text-muted))',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderBottom: bottomPanelTab === 'output' ? '2px solid rgb(var(--accent))' : 'none',
                  fontWeight: bottomPanelTab === 'output' ? '500' : 'normal'
                }}
              >
                Output
              </button>
              <div style={{ flex: 1 }}></div>
              <button
                onClick={() => {
                  useWorkspaceStore.getState().closePanel('showTerminalPanel');
                  useWorkspaceStore.getState().closePanel('showOutputPanel');
                }}
                style={{
                  padding: '0 12px',
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgb(var(--text-muted))',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
                title="Close panel"
              >
                ×
              </button>
            </div>

            {/* Panel Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {/* Terminal Panel - Desktop only */}
              {isDesktop() && bottomPanelTab === 'terminal' && showTerminalPanel && (
                <TerminalPanel
                  isOpen={showTerminalPanel}
                  onClose={() => {
                    useWorkspaceStore.getState().closePanel('showTerminalPanel');
                    useWorkspaceStore.getState().closePanel('showOutputPanel');
                  }}
                />
              )}
              {bottomPanelTab === 'output' && showOutputPanel && (
                <OutputPanel
                  isOpen={showOutputPanel}
                  onClose={() => {
                    useWorkspaceStore.getState().closePanel('showOutputPanel');
                    useWorkspaceStore.getState().closePanel('showTerminalPanel');
                  }}
                />
              )}
            </div>
          </div>
        )}

      {/* Mobile bottom Navigation */}
        {isMobile() && (
          <MobileBottomNav
            activeTab={currentView}
            onTabChange={(v) => useWorkspaceStore.getState().switchView(v)}
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
              useWorkspaceStore.setState({ showTerminalPanel: !useWorkspaceStore.getState().showTerminalPanel });
              if (!showTerminalPanel) {
                useWorkspaceStore.getState().setBottomTab('terminal');
                useWorkspaceStore.getState().closePanel('showOutputPanel');
              }
            }
          }}
          showOutput={showOutputPanel}
          onToggleOutput={() => {
            useWorkspaceStore.setState({ showOutputPanel: !useWorkspaceStore.getState().showOutputPanel });
            if (!showOutputPanel) {
              useWorkspaceStore.getState().setBottomTab('output');
              useWorkspaceStore.getState().closePanel('showTerminalPanel');
            }
          }}
        />

        {/* Canvas Preview Popup */}
        {canvasPreview && (
          <CanvasPreviewPopup
            canvasName={canvasPreview.canvasName}
            canvasPath={canvasPreview.canvasPath}
            position={canvasPreview.position}
            thumbnailUrl={canvasPreview.thumbnailUrl}
            loading={canvasPreview.loading}
            error={canvasPreview.error}
            onClose={() => useWorkspaceStore.setState({ canvasPreview: null })}
          />
        )}

        {/* External file drop overlay */}
        <ExternalDropZone
          isActive={isExternalDragActive}
          hoveredFolder={hoveredFolder}
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