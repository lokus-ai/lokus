import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirm, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { DraggableTab } from "./DraggableTab";
import { Menu, FilePlus2, FolderPlus, Search, LayoutGrid, FolderMinus, Puzzle, FolderOpen, FilePlus, Layers, Package, Network, /* Mail, */ Database, Trello, FileText, FolderTree, Grid2X2, PanelRightOpen, PanelRightClose, Plus, Calendar, FoldVertical, SquareSplitHorizontal, FilePlus as FilePlusCorner, SquareKanban } from "lucide-react";
import { ColoredFileIcon } from "../components/FileIcon.jsx";
import LokusLogo from "../components/LokusLogo.jsx";
import { ProfessionalGraphView } from "./ProfessionalGraphView.jsx";
import Editor from "../editor";
import StatusBar from "../components/StatusBar.jsx";
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
import analytics from "../services/analytics.js";
import CreateTemplate from "../components/CreateTemplate.jsx";
import { PanelManager, PanelRegion, usePanelManager } from "../plugins/ui/PanelManager.jsx";
import { PANEL_POSITIONS } from "../plugins/api/UIAPI.js";
import SplitEditor from "../components/SplitEditor/SplitEditor.jsx";
import PDFViewerTab from "../components/PDFViewer/PDFViewerTab.jsx";
import { isPDFFile } from "../utils/pdfUtils.js";
import { getFilename, getBasename, joinPath } from '../utils/pathUtils.js';
import platformService from "../services/platform/PlatformService.js";
// import Gmail from "./Gmail.jsx"; // DISABLED: Slowing down app startup
// import { gmailAuth, gmailEmails } from '../services/gmail.js'; // DISABLED: Slowing down app startup
import { FolderScopeProvider, useFolderScope } from "../contexts/FolderScopeContext.jsx";
import { BasesProvider, useBases } from "../bases/BasesContext.jsx";
import BasesView from "../bases/BasesView.jsx";
import DocumentOutline from "../components/DocumentOutline.jsx";
import GraphSidebar from "../components/GraphSidebar.jsx";
import VersionHistoryPanel from "../components/VersionHistoryPanel.jsx";
import BacklinksPanel from "./BacklinksPanel.jsx";
import { DailyNotesPanel, NavigationButtons, DatePickerModal } from "../components/DailyNotes/index.js";
import { ImageViewerTab } from "../components/ImageViewer/ImageViewerTab.jsx";
import { isImageFile, findImageFiles } from "../utils/imageUtils.js";
import TagManagementModal from "../components/TagManagementModal.jsx";
import ProductTour from "../components/ProductTour.jsx";
import "../styles/product-tour.css";

const MAX_OPEN_TABS = 10;

// Editor Mode Switcher Component for Right Sidebar
const EditorModeSwitcher = () => {
  const [editorMode, setEditorMode] = useState('edit');

  useEffect(() => {
    // Event-driven mode sync instead of polling
    const handleModeChange = (event) => {
      setEditorMode(event.detail || 'edit');
    };

    // Listen for custom event
    window.addEventListener('lokusEditorModeChange', handleModeChange);

    // Get initial mode
    if (window.__LOKUS_EDITOR_MODE__) {
      setEditorMode(window.__LOKUS_EDITOR_MODE__);
    }

    return () => {
      window.removeEventListener('lokusEditorModeChange', handleModeChange);
    };
  }, []);

  const handleModeChange = (mode) => {
    if (window.__LOKUS_SET_EDITOR_MODE__) {
      window.__LOKUS_SET_EDITOR_MODE__(mode);
    }
    setEditorMode(mode);

    // Dispatch event so other components can listen
    window.dispatchEvent(new CustomEvent('lokusEditorModeChange', { detail: mode }));
  };

  return (
    <div style={{
      padding: '0.75rem',
      borderBottom: '1px solid rgb(var(--border))',
      background: 'rgb(var(--panel))'
    }}>
      <div style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'rgb(var(--muted))',
        marginBottom: '0.5rem'
      }}>
        Editor Mode
      </div>
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        background: 'rgb(var(--bg))',
        border: '1px solid rgb(var(--border))',
        borderRadius: '0.5rem',
        padding: '0.25rem'
      }}>
        <button
          onClick={() => handleModeChange('edit')}
          title="Edit Mode"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: editorMode === 'edit' ? 'rgb(var(--accent))' : 'transparent',
            color: editorMode === 'edit' ? 'white' : 'rgb(var(--text))',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: editorMode === 'edit' ? 600 : 500,
            transition: 'all 0.15s ease'
          }}
        >
          Edit
        </button>
        <button
          onClick={() => handleModeChange('live')}
          title="Live Preview Mode"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: editorMode === 'live' ? 'rgb(var(--accent))' : 'transparent',
            color: editorMode === 'live' ? 'white' : 'rgb(var(--text))',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: editorMode === 'live' ? 600 : 500,
            transition: 'all 0.15s ease'
          }}
        >
          Live
        </button>
        <button
          onClick={() => handleModeChange('reading')}
          title="Reading Mode"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: editorMode === 'reading' ? 'rgb(var(--accent))' : 'transparent',
            color: editorMode === 'reading' ? 'white' : 'rgb(var(--text))',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: editorMode === 'reading' ? 600 : 500,
            transition: 'all 0.15s ease'
          }}
        >
          Read
        </button>
      </div>
    </div>
  );
};

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Draggable Column Hook ---
function useDragColumns({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500 }) {
  const [leftW, setLeftW] = useState(280);
  const [rightW, setRightW] = useState(280);
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

// --- New Folder Input ---
function NewFolderInput({ onConfirm, level }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onConfirm(name);
    else if (e.key === "Escape") onConfirm(null);
  };

  return (
    <li style={{ paddingLeft: `${level * 1.25}rem` }} className="flex items-center gap-2 px-2 py-1">
      <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-4 h-4" />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onConfirm(name)}
        className="bg-app-bg text-sm text-app-text outline-none w-full"
        placeholder="New folder..."
      />
    </li>
  );
}

// --- Inline Rename Input Component ---
function InlineRenameInput({ initialValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    onSubmit(value);
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
function FileEntryComponent({ entry, level, onFileClick, activeFile, expandedFolders, toggleFolder, onRefresh, keymap, renamingPath, setRenamingPath, onViewHistory, setTagModalFile, setShowTagModal, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent }) {
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

  const handleClick = () => {
    if (entry.is_directory) {
      toggleFolder(entry.path);
    } else {
      onFileClick(entry);
    }
  };

  const baseClasses = "obsidian-file-item";
  const stateClasses = activeFile === entry.path ? 'active' : '';
  const dropTargetClasses = isDropTarget ? 'bg-app-accent/30 ring-2 ring-app-accent' : '';
  const draggingClasses = isDragging ? 'opacity-50' : '';

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

    try {
      const trimmedName = newName.trim();
      await invoke("rename_file", { path: entry.path, newName: trimmedName });
      setRenamingPath(null);
      onRefresh && onRefresh();
    } catch (e) {
      console.error('Failed to rename:', e);
      alert(`Failed to rename: ${e.message || e}`);
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
    } catch (e) { }
  };

  const onCreateFolderHere = async () => {
    const name = window.prompt("New folder name:");
    if (!name) return;
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      await invoke("create_folder_in_workspace", { workspacePath: base, name });
      onRefresh && onRefresh();
    } catch (e) { }
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
              console.error('Failed to load file content:', err);
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
        // TODO: Implement open with functionality
        break;
      case 'revealInFinder':
        try {
          await invoke('platform_reveal_in_file_manager', { path: file.path });
        } catch (e) {
          console.error('Failed to reveal in file manager:', e);
        }
        break;
      case 'openInTerminal':
        try {
          const terminalPath = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
          await invoke('platform_open_terminal', { path: terminalPath });
        } catch (e) {
          console.error('Failed to open terminal:', e);
        }
        break;
      case 'cut':
        // TODO: Implement cut functionality
        break;
      case 'copy':
        // TODO: Implement copy functionality
        break;
      case 'copyPath':
        try {
          await navigator.clipboard.writeText(file.path);
        } catch (e) {
        }
        break;
      case 'copyRelativePath':
        try {
          // TODO: Calculate relative path from workspace root
          const relativePath = file.path; // Simplified for now
          await navigator.clipboard.writeText(relativePath);
        } catch (e) {
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
        } catch (e) {
        }
        break;
      case 'selectForCompare':
        // TODO: Implement select for compare
        break;
      case 'shareEmail':
      case 'shareSlack':
      case 'shareTeams':
        // TODO: Implement sharing functionality
        break;
      case 'addTag':
      case 'manageTags':
        // Open tag management modal for markdown files
        if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
          setTagModalFile(file);
          setShowTagModal(true);
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
    <li style={{ paddingLeft: `${level * 1.25}rem` }}>
      <div ref={droppableRef} className="rounded">
        <div ref={draggableRef} className="flex items-center">
          <FileContextMenu
            file={{ ...entry, type: entry.is_directory ? 'folder' : 'file' }}
            onAction={handleFileContextAction}
          >
            <button {...listeners} {...attributes} onClick={handleClick} className={`${baseClasses} ${stateClasses} ${dropTargetClasses} ${draggingClasses}`}>
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
                <span className="truncate">{entry.name}</span>
              )}
            </button>
          </FileContextMenu>
        </div>
      </div>
      {isExpanded && (
        <ul className="space-y-1 mt-1">
          {entry.children?.map(child => (
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
              renamingPath={renamingPath}
              setRenamingPath={setRenamingPath}
              onViewHistory={onViewHistory}
              setTagModalFile={setTagModalFile}
              setShowTagModal={setShowTagModal}
              setUseSplitView={setUseSplitView}
              setRightPaneFile={setRightPaneFile}
              setRightPaneTitle={setRightPaneTitle}
              setRightPaneContent={setRightPaneContent}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- File Tree View Component ---
function FileTreeView({ entries, onFileClick, activeFile, onRefresh, expandedFolders, toggleFolder, isCreating, onCreateConfirm, keymap, renamingPath, setRenamingPath, onViewHistory, setTagModalFile, setShowTagModal, setUseSplitView, setRightPaneFile, setRightPaneTitle, setRightPaneContent }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleDragEnd = async (event) => {
    const { over, active } = event;
    if (!over || !active) return;

    const sourceEntry = active.data.current?.entry;
    const targetEntry = over.data.current?.entry;

    if (!sourceEntry || !targetEntry || !targetEntry.is_directory || sourceEntry.path === targetEntry.path) {
      return;
    }

    try {
      await invoke("move_file", {
        sourcePath: sourceEntry.path,
        destinationDir: targetEntry.path,
      });
      onRefresh();
    } catch (error) {
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <ul className="space-y-1">
        {isCreating && <NewFolderInput onConfirm={onCreateConfirm} level={0} />}
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
            renamingPath={renamingPath}
            setRenamingPath={setRenamingPath}
            onViewHistory={onViewHistory}
            setTagModalFile={setTagModalFile}
            setShowTagModal={setShowTagModal}
            setUseSplitView={setUseSplitView}
            setRightPaneFile={setRightPaneFile}
            setRightPaneTitle={setRightPaneTitle}
            setRightPaneContent={setRightPaneContent}
          />
        ))}
      </ul>
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
  const { filterFileTree, scopeMode, scopedFolders } = useFolderScope();
  const { activeBase } = useBases();
  const { leftW, rightW, startLeftDrag, startRightDrag } = useDragColumns({});
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(false);
  const [showMiniKanban, setShowMiniKanban] = useState(false);
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

  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingPath, setRenamingPath] = useState(null);

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

  // Reload current file after version restore
  const reloadCurrentFile = useCallback(async () => {
    if (!activeFile) return;

    try {
      const content = await invoke("read_file_content", { path: activeFile });
      const activeTab = openTabs.find(tab => tab.path === activeFile);

      if (activeTab) {
        const compiler = getMarkdownCompiler();
        let processedContent = content;

        if (activeTab.name.endsWith('.md') && compiler.isMarkdown(content)) {
          processedContent = compiler.compile(content);
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
    } catch (error) {
      console.error("Failed to reload file:", error);
    }
  }, [activeFile, openTabs]);

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
  const [showKanban, setShowKanban] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showBases, setShowBases] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showGmail, setShowGmail] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagModalFile, setTagModalFile] = useState(null);
  // Graph view now opens as a tab instead of sidebar panel
  const [showGraphView, setShowGraphView] = useState(false);
  const [showDailyNotesPanel, setShowDailyNotesPanel] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [currentDailyNoteDate, setCurrentDailyNoteDate] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  // Image files state for navigation
  const [allImageFiles, setAllImageFiles] = useState([]);

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
  };

  // Helper function to get proper display name for special tabs
  const getTabDisplayName = (tabPath) => {
    if (tabPath === '__graph__') return 'Graph View';
    if (tabPath === '__kanban__') return 'Task Board';
    // if (tabPath === '__gmail__') return 'Gmail'; // Gmail disabled
    if (tabPath === '__bases__') return 'Bases';
    if (tabPath.startsWith('__plugin_')) {
      // Extract plugin name from path if possible, otherwise generic name
      return 'Plugin'; // Will be updated when plugin details load
    }
    // For regular files, extract filename
    return tabPath.split('/').pop();
  };

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

          const tabsWithNames = session.open_tabs.map(p => ({
            path: p,
            name: getTabDisplayName(p)
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
        console.error('[Workspace] Failed to load session:', err);
      });
    }
  }, [path]);

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
        } catch (e) {
          console.error('[Workspace] Failed to reload markdown config:', e);
        }
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

      // Capture activeFile in local variable to prevent stale closure issues
      const fileToLoad = activeFile;


      invoke("read_file_content", { path: fileToLoad })
        .then(content => {
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
          if (fileToLoad.endsWith('.md') && compiler.isMarkdown(content)) {
            processedContent = compiler.compile(content);
          }

          setEditorContent(processedContent);
          setEditorTitle(fileName.replace(/\.md$/, ""));
          setSavedContent(content); // Keep original content for saving
        })
        .catch((err) => {
        });
    } else {
      setEditorContent("");
      setEditorTitle("");
    }
  }, [activeFile]);

  useEffect(() => {
    const sub = listen("workspace:activate", (e) => {
      const newPath = String(e.payload || "");
      setPath(newPath);
      invoke("save_last_workspace", { path: newPath });
    });
    return () => { sub.then((un) => un()); };
  }, []);

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
        } catch (error) {
        }
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
            console.warn('   ⚠️ Editor element not found')
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
            console.warn('   ❌ Block not found:', blockId)
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
            } catch (error) {
            }
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
                console.error('Failed to load right pane content:', err);
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
      } catch (error) {
        console.error('[TabClose] Error showing dialog:', error);
      } finally {
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

  // Gmail template detection and parsing - DISABLED
  /* const parseGmailTemplate = (content) => {
    try {
      // Check if content starts with YAML frontmatter
      if (!content.startsWith('---')) {
        return null;
      }

      // Extract frontmatter and body
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd === -1) {
        return null;
      }

      const frontmatterContent = content.slice(3, frontmatterEnd).trim();
      const body = content.slice(frontmatterEnd + 3).trim();

      // Parse the YAML-like frontmatter
      const metadata = {};
      const lines = frontmatterContent.split('\n');
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim().toLowerCase();
          const value = line.slice(colonIndex + 1).trim();
          metadata[key] = value;
        }
      }

      // Check if this looks like a Gmail template
      if (metadata.to !== undefined && metadata.subject !== undefined) {
        return {
          to: metadata.to ? metadata.to.split(',').map(email => email.trim()).filter(email => email) : [],
          cc: metadata.cc ? metadata.cc.split(',').map(email => email.trim()).filter(email => email) : [],
          bcc: metadata.bcc ? metadata.bcc.split(',').map(email => email.trim()).filter(email => email) : [],
          subject: metadata.subject || '',
          body: body.replace(/<!--.*?-->/gs, '').trim() // Remove HTML comments
        };
      }
    } catch (error) {
    }

    return null;
  }; */

  const handleSave = useCallback(async () => {
    const { activeFile, openTabs, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    let path_to_save = activeFile;
    let needsStateUpdate = false;

    try {
      const currentTab = openTabs.find(t => t.path === activeFile);
      const currentName = currentTab.name.replace(/\.md$/, "");

      if (editorTitle !== currentName && editorTitle.trim() !== "") {
        const newFileName = `${editorTitle.trim()}.md`;
        const newPath = await invoke("rename_file", { path: activeFile, newName: newFileName });
        path_to_save = newPath;
        needsStateUpdate = true;
      }

      // For .md files, we need to convert HTML content back to markdown
      let contentToSave = editorContent;
      if (path_to_save.endsWith('.md')) {
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
          console.warn("[Version] Failed to save version:", error);
          // Non-blocking - don't show error to user
        }
      } else {
      }

      // Gmail template checking disabled
      /* const gmailTemplate = parseGmailTemplate(contentToSave);
      if (gmailTemplate) {
        try {

          // Check if user is authenticated with Gmail
          const isAuthenticated = await gmailAuth.isAuthenticated();
          if (isAuthenticated && gmailTemplate.to.length > 0 && gmailTemplate.subject) {
            // Send the email
            await gmailEmails.sendEmail({
              to: gmailTemplate.to,
              cc: gmailTemplate.cc,
              bcc: gmailTemplate.bcc,
              subject: gmailTemplate.subject,
              body: gmailTemplate.body,
              attachments: [] // For future implementation
            });


            // Optional: Show success notification to user
            // You could add a toast notification here
          } else if (!isAuthenticated) {
            // Optional: Show authentication prompt
          } else {
          }
        } catch (emailError) {
          // Optional: Show error notification to user
        }
      } */

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
    } catch (error) {
    }
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
    } catch (error) {
    }
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
      console.error('Failed to export PDF:', error);
    }
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    try {
      // First clear the saved workspace to ensure launcher shows
      await invoke('clear_last_workspace');

      // Use backend command to create launcher window (same approach as preferences)
      await invoke('open_launcher_window');
    } catch (error) {
    }
  }, []);




  // Helper function to determine target path for file creation
  // Priority: 1. Bases folder, 2. Local scope folder, 3. Workspace root
  const getTargetPath = useCallback(() => {
    // Priority 1: If bases tab is open and has an active base
    const hasBasesTab = openTabs.some(tab => tab.path === '__bases__');
    if (hasBasesTab && activeBase?.sourceFolder) {
      return activeBase.sourceFolder;
    }

    // Priority 2: If in local scope mode with folders selected
    if (scopeMode === 'local' && scopedFolders.length > 0) {
      // Use the first scoped folder as the default target
      return scopedFolders[0];
    }

    // Priority 3: Workspace root
    return path;
  }, [openTabs, activeBase, scopeMode, scopedFolders, path]);

  const handleCreateFile = async () => {
    try {
      const targetPath = getTargetPath();
      const newFilePath = await invoke("create_file_in_workspace", { workspacePath: targetPath, name: "Untitled.md" });
      handleRefreshFiles();
      handleFileOpen({ path: newFilePath, name: "Untitled.md", is_directory: false });
    } catch (error) {
    }
  };

  const handleCreateCanvas = async () => {
    try {
      const targetPath = getTargetPath();
      const newCanvasPath = await canvasManager.createCanvas(targetPath, "Untitled Canvas");
      handleRefreshFiles();
      handleFileOpen({ path: newCanvasPath, name: "Untitled Canvas.canvas", is_directory: false });
    } catch (error) {
    }
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
    } catch (error) {
      console.error("Failed to create kanban board:", error);
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

      // Track daily note access
      analytics.trackDailyNote();
    } catch (error) {
      console.error('Failed to open daily note:', error);
    }
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

      // Track daily note access
      analytics.trackDailyNote();
    } catch (error) {
      console.error('Failed to open daily note:', error);
    }
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
    setIsCreatingFolder(true);
  };

  const handleConfirmCreateFolder = async (name) => {
    if (name) {
      try {
        const targetPath = getTargetPath();
        await invoke("create_folder_in_workspace", { workspacePath: targetPath, name });
        handleRefreshFiles();
      } catch (error) {
      }
    }
    setIsCreatingFolder(false);
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

  // OLD SYSTEM - Commented out since ProfessionalGraphView has its own data loading
  // const buildGraphData = useCallback(async () => {
  //   if (!graphProcessorRef.current || isLoadingGraph) return;
  //   
  //   setIsLoadingGraph(true);
  //   
  //   try {
  //     const data = await graphProcessorRef.current.buildGraphFromWorkspace({
  //       includeNonMarkdown: false,
  //       maxDepth: 10,
  //       excludePatterns: ['.git', 'node_modules', '.lokus', '.DS_Store'],
  //       onProgress: (progress) => {
  //       }
  //     });
  //     
  //     setGraphData(data);
  //     
  //   } catch (error) {
  //     setGraphData(null);
  //   } finally {
  //     setIsLoadingGraph(false);
  //   }
  // }, [isLoadingGraph]);

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

    // Track graph view opening (defaults to 2D)
    analytics.trackGraphView('2d');

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

    // Track database view opening (defaults to table view)
    analytics.trackDatabaseView('table');

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

  // Gmail functionality disabled
  /* const handleOpenGmail = useCallback(() => {
    const gmailPath = '__gmail__';
    const gmailName = 'Gmail';

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== gmailPath);
      newTabs.unshift({ path: gmailPath, name: gmailName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(gmailPath);
  }, []); */

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

  // Build graph data when files change
  useEffect(() => {
    if (graphProcessorRef.current && refreshId > 0) {
      // OLD SYSTEM - Commented out since ProfessionalGraphView has its own data loading
      // Rebuild graph data when files are refreshed
      // buildGraphData();
    }
  }, [refreshId]); // Removed buildGraphData dependency

  // OLD SYSTEM - Commented out since ProfessionalGraphView has its own data loading
  // Auto-build graph when graph view is opened
  // useEffect(() => {
  //   const isGraphView = activeFile === '__graph__' || activeFile === '__professional_graph__';
  //   if (isGraphView && !graphData && !isLoadingGraph && graphProcessorRef.current) {
  //     buildGraphData();
  //   }
  // }, [activeFile, graphData, isLoadingGraph, buildGraphData]);

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
              // nextTab.path === '__gmail__' || // Gmail disabled
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
                  console.error('Failed to load right pane content:', err);
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
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleSave, activeFile, toggleVersionHistory]);

  useEffect(() => {
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch { }
    const addDom = (name, fn) => { const h = () => fn(); window.addEventListener(name, h); return () => window.removeEventListener(name, h); };
    const unlistenSave = isTauri ? listen("lokus:save-file", handleSave) : Promise.resolve(addDom('lokus:save-file', handleSave));
    const unlistenClose = isTauri ? listen("lokus:close-tab", () => {
      if (stateRef.current.activeFile) {
        handleTabClose(stateRef.current.activeFile);
      }
    }) : Promise.resolve(addDom('lokus:close-tab', () => {
      if (stateRef.current.activeFile) handleTabClose(stateRef.current.activeFile);
    }));
    const unlistenNewFile = isTauri ? listen("lokus:new-file", handleCreateFile) : Promise.resolve(addDom('lokus:new-file', handleCreateFile));
    const unlistenNewFolder = isTauri ? listen("lokus:new-folder", () => setIsCreatingFolder(true)) : Promise.resolve(addDom('lokus:new-folder', () => setIsCreatingFolder(true)));
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
      switch (action) {
        case 'help':
          // Open help documentation
          window.open('https://docs.lokus.dev', '_blank');
          break;
        case 'keyboard-shortcuts':
          setShowShortcutHelp(true);
          break;
        case 'release-notes':
          // Open release notes
          window.open('https://github.com/lokus-app/lokus/releases', '_blank');
          break;
        case 'report-issue':
          // Open issue tracker
          window.open('https://github.com/lokus-app/lokus/issues', '_blank');
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
      // TODO: Show about dialog
    }) : Promise.resolve(addDom('lokus:show-about', () => { }));

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

    // Theme switching events
    const unlistenThemeLight = isTauri ? listen("lokus:theme-light", () => {
      // TODO: Connect to theme manager to set light theme
    }) : Promise.resolve(addDom('lokus:theme-light', () => { }));

    const unlistenThemeDark = isTauri ? listen("lokus:theme-dark", () => {
      // TODO: Connect to theme manager to set dark theme
    }) : Promise.resolve(addDom('lokus:theme-dark', () => { }));

    const unlistenThemeAuto = isTauri ? listen("lokus:theme-auto", () => {
      // TODO: Connect to theme manager to set auto theme
    }) : Promise.resolve(addDom('lokus:theme-auto', () => { }));

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
  const filteredFileTree = getBaseAwareFileTree(fileTree);

  return (
    <PanelManager>
      <div className="h-full bg-app-panel text-app-text flex flex-col font-sans transition-colors duration-300 overflow-hidden no-select relative">
        {/* Product Tour */}
        <ProductTour autoStart={true} delay={1500} />

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
            <button
              onClick={handleCreateFolder}
              className="obsidian-button icon-only small"
              title={`New Folder (${platformService.getModifierSymbol()}+Shift+N)`}
              data-tauri-drag-region="false"
              style={{ pointerEvents: 'auto' }}
            >
              <FolderOpen className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              onClick={handleCreateCanvas}
              className="obsidian-button icon-only small"
              title="New Canvas"
              data-tauri-drag-region="false"
              style={{ pointerEvents: 'auto' }}
            >
              <SquareKanban className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          {/* Center Section: Tab bar */}
          <div
            className="absolute flex items-center overflow-x-auto no-scrollbar px-2"
            style={{
              left: showLeft ? `${leftW + 57}px` : `${platformService.isMacOS() ? 200 : 120}px`, // After sidebar or after left buttons
              right: showRight ? `${rightW + 120}px` : '120px', // Account for right sidebar when open + right buttons
              top: 0,
              height: '32px'
            }}
          >
            {openTabs.map((tab, index) => {
              const isActive = activeFile === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => handleTabClick(tab.path)}
                  data-tauri-drag-region="false"
                  className={`
                  relative flex items-center gap-2 px-4 h-8 text-xs whitespace-nowrap transition-all duration-200
                  ${isActive ? 'z-10' : 'z-0'}
                `}
                  style={{
                    pointerEvents: 'auto',
                    marginLeft: index > 0 ? '-12px' : '0',
                    minWidth: '180px',
                    maxWidth: '280px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    backgroundColor: isActive ? '#3d3d3d' : '#2a2a2a',
                    color: isActive ? '#ffffff' : '#808080',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    borderBottomLeftRadius: '0',
                    borderBottomRightRadius: '0',
                    border: '1px solid #555555',
                    borderBottom: isActive ? '2px solid #3d3d3d' : '1px solid #555555',
                    boxShadow: isActive
                      ? '0 -2px 8px rgba(0, 0, 0, 0.4), 0 1px 0 0 #3d3d3d'
                      : '0 0 0 0 transparent',
                    transform: isActive ? 'translateY(0)' : 'translateY(0)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#353535';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 -1px 4px rgba(0, 0, 0, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#2a2a2a';
                      e.currentTarget.style.color = '#808080';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
                    }
                  }}
                >
                  <span className="truncate flex-1">{tab.name}</span>
                  {unsavedChanges.has(tab.path) && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTabClose(tab.path);
                    }}
                    className="ml-1 hover:bg-white/10 rounded p-1 flex-shrink-0 opacity-0 hover:opacity-100 transition-opacity"
                    style={isActive ? { opacity: 0.7 } : {}}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              );
            })}
          </div>

          {/* Right Section: Split View, Right Sidebar, and New Tab buttons */}
          <div className="flex items-center gap-1">
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
            <button
              onClick={() => setShowRight(v => !v)}
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
              onClick={() => setShowLeft(v => !v)}
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
                  setShowKanban(false);
                  setShowPlugins(false);
                  setShowBases(false);
                  setShowGraphView(false);
                  setShowLeft(true);
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

              <button
                onClick={() => {
                  setShowKanban(true);
                  setShowPlugins(false);
                  setShowBases(false);
                  setShowGraphView(false);
                  setShowLeft(true);
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

              <button
                onClick={() => {
                  setShowPlugins(true);
                  setShowKanban(false);
                  setShowBases(false);
                  setShowGraphView(false);
                  setShowLeft(true);
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

              <button
                onClick={() => {
                  setShowDailyNotesPanel(!showDailyNotesPanel);
                  setShowRight(true);
                  setShowVersionHistory(false);
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

              {/* Gmail button disabled to improve startup performance */}
              {/* <button
              onClick={handleOpenGmail}
              title="Gmail"
              className="obsidian-button icon-only w-full"
              onMouseEnter={(e) => {
                const icon = e.currentTarget.querySelector('svg');
                if (icon) icon.style.color = 'rgb(var(--accent))';
              }}
              onMouseLeave={(e) => {
                const icon = e.currentTarget.querySelector('svg');
                if (icon) icon.style.color = '';
              }}
            >
              <Mail className="w-5 h-5" />
            </button> */}

            </div>
          </aside>
          <div className="bg-app-border/20 w-px" />
          {showLeft && (
            <aside className="overflow-y-auto flex flex-col">
              {showPlugins ? (
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
                    <p>Use <kbd className="px-1 py-0.5 text-xs bg-app-panel rounded">Cmd+Shift+G</kbd> to quickly open the graph view.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Explorer Header */}
                  <div className="h-10 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
                    <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">Explorer</span>
                    <button
                      onClick={closeAllFolders}
                      className="obsidian-button icon-only small"
                      title="Collapse All Folders"
                    >
                      <FoldVertical className="w-4 h-4" />
                    </button>
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
                          isCreating={isCreatingFolder}
                          onCreateConfirm={handleConfirmCreateFolder}
                          keymap={keymap}
                          renamingPath={renamingPath}
                          setRenamingPath={setRenamingPath}
                          onViewHistory={toggleVersionHistory}
                          setTagModalFile={setTagModalFile}
                          setShowTagModal={setShowTagModal}
                          setUseSplitView={setUseSplitView}
                          setRightPaneFile={setRightPaneFile}
                          setRightPaneTitle={setRightPaneTitle}
                          setRightPaneContent={setRightPaneContent}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={handleCreateFile}>
                        New File
                        <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={handleCreateCanvas}>
                        New Canvas
                      </ContextMenuItem>
                      <ContextMenuItem onClick={handleCreateFolder}>
                        New Folder
                        <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={handleOpenDailyNote}>
                        Open Daily Note
                        <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['daily-note'])}</span>
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
                          onChange={(e) => setEditorTitle(e.target.value)}
                          className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                        />
                        <Editor
                          ref={editorRef}
                          content={editorContent}
                          onContentChange={handleEditorChange}
                          onEditorReady={setEditor}
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
                      rightPaneFile && rightPaneFile.endsWith('.canvas') ? (
                        <div className="flex-1 overflow-hidden">
                          <Canvas
                            canvasPath={rightPaneFile}
                            canvasName={openTabs.find(tab => tab.path === rightPaneFile)?.name}
                            onSave={async (canvasData) => {
                              try {
                                await canvasManager.saveCanvas(rightPaneFile, canvasData);
                                setUnsavedChanges(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(rightPaneFile);
                                  return newSet;
                                });
                              } catch (error) {
                                console.error('Failed to save canvas:', error);
                              }
                            }}
                            onChange={() => {
                              setUnsavedChanges(prev => new Set(prev).add(rightPaneFile));
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
                              setOpenTabs(prev => prev.filter(tab => tab.path !== rightPaneFile));
                              setRightPaneFile(null);
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
                      ) : /* rightPaneFile === '__gmail__' ? (
                      <div className="h-full">
                        <Gmail workspacePath={path} />
                      </div>
                    ) : */ rightPaneFile === '__bases__' ? (
                          <div className="h-full">
                            <BasesView isVisible={true} onFileOpen={handleFileOpen} />
                          </div>
                        ) : rightPaneFile.startsWith('__plugin_') ? (
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
                              onChange={(e) => setRightPaneTitle(e.target.value)}
                              className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                            />
                            <Editor
                              key={`right-pane-${rightPaneFile}`}
                              content={rightPaneContent}
                              onContentChange={(content) => setRightPaneContent(content)}
                              onEditorReady={setEditor}
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
                  {activeFile && activeFile.endsWith('.canvas') ? (
                    <div className="flex-1 overflow-hidden">
                      <Canvas
                        canvasPath={activeFile}
                        canvasName={openTabs.find(tab => tab.path === activeFile)?.name}
                        onSave={async (canvasData) => {
                          try {
                            await canvasManager.saveCanvas(activeFile, canvasData);
                            setUnsavedChanges(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(activeFile);
                              return newSet;
                            });
                          } catch (error) {
                          }
                        }}
                        onContentChange={(canvasData) => {
                          setUnsavedChanges(prev => {
                            const newSet = new Set(prev);
                            newSet.add(activeFile);
                            return newSet;
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
                          setOpenTabs(prev => prev.filter(tab => tab.path !== activeFile));
                          setActiveFile(null);
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
                          setActiveFile(newPath);
                          setOpenTabs(prevTabs => {
                            return prevTabs.map(tab =>
                              tab.path === activeFile
                                ? { ...tab, path: newPath, name: getFilename(newPath) }
                                : tab
                            );
                          });
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
                  ) : /* activeFile === '__gmail__' ? (
            <div className="flex-1 h-full overflow-hidden">
              <Gmail workspacePath={path} />
            </div>
          ) : */ (
                      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
                        <div className="max-w-full mx-auto h-full">
                          {false ? (
                            <div className="h-full flex flex-col">
                              {/* Graph view moved above */}
                            </div>
                          ) : activeFile === '__old_graph__' ? (
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
                          ) : activeFile && activeFile.startsWith('__plugin_') ? (
                            <div className="flex-1 overflow-hidden">
                              {(() => {
                                const activeTab = openTabs.find(tab => tab.path === activeFile);
                                return activeTab?.plugin ? <PluginDetail plugin={activeTab.plugin} /> : <div>Plugin not found</div>;
                              })()}
                            </div>
                          ) : activeFile ? (
                            <EditorDropZone>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div>
                                    <input
                                      type="text"
                                      value={editorTitle}
                                      onChange={(e) => setEditorTitle(e.target.value)}
                                      className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                                    />
                                    <div data-tour="editor">
                                      <Editor
                                        ref={editorRef}
                                        content={editorContent}
                                        onContentChange={handleEditorChange}
                                        onEditorReady={setEditor}
                                      />
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem onClick={handleSave}>
                                    Save
                                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['save-file'])}</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => stateRef.current.activeFile && handleTabClose(stateRef.current.activeFile)}>
                                    Close Tab
                                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['close-tab'])}</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => document.execCommand && document.execCommand('selectAll')}>Select All</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </EditorDropZone>
                          ) : (
                            <>
                              {/* Modern Welcome Screen - VS Code Inspired */}
                              <div className="h-full flex flex-col">
                                <div className="flex-1 flex items-center justify-center p-8">
                                  <div className="max-w-4xl w-full">

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
                                          <div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+N")}</div>
                                        </button>

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

                                        <button
                                          onClick={handleCreateFolder}
                                          className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                                        >
                                          <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                                            <FolderPlus className="w-5 h-5 text-app-accent" />
                                          </div>
                                          <h3 className="font-medium text-app-text mb-2">New Folder</h3>
                                          <p className="text-sm text-app-muted">Organize your notes with folders</p>
                                          <div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+Shift+N")}</div>
                                        </button>

                                        <button
                                          onClick={() => setShowCommandPalette(true)}
                                          className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                                          data-tour="templates"
                                        >
                                          <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                                            <Search className="w-5 h-5 text-app-accent" />
                                          </div>
                                          <h3 className="font-medium text-app-text mb-2">Command Palette</h3>
                                          <p className="text-sm text-app-muted">Quick access to all commands</p>
                                          <div className="mt-3 text-xs text-app-muted/70">{formatAccelerator("CommandOrControl+K")}</div>
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

                                          <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                                            <h3 className="font-medium text-app-text text-sm mb-2">⌨️ Quick Tips</h3>
                                            <ul className="text-sm text-app-muted space-y-1">
                                              <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+K</kbd> Command palette</li>
                                              <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+S</kbd> Save current file</li>
                                              <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">{platformService.getModifierSymbol()}+P</kbd> Quick file open</li>
                                              <li>• Drag files to move them between folders</li>
                                            </ul>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
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
                    onClose={() => setShowVersionHistory(false)}
                    onRestore={reloadCurrentFile}
                  />
                ) : showDailyNotesPanel ? (
                  <DailyNotesPanel
                    workspacePath={path}
                    onOpenDailyNote={handleOpenDailyNoteByDate}
                    currentDate={currentDailyNoteDate}
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

        <CommandPalette
          open={showCommandPalette}
          setOpen={setShowCommandPalette}
          fileTree={filteredFileTree}
          openFiles={openTabs}
          onFileOpen={handleFileOpen}
          onCreateFile={handleCreateFile}
          onCreateFolder={() => setIsCreatingFolder(true)}
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
          onToggleSidebar={() => setShowLeft(v => !v)}
          onCloseTab={handleTabClose}
          onOpenGraph={() => {
            const graphPath = '__professional_graph__';
            const graphName = 'Professional Graph';

            setOpenTabs(prevTabs => {
              const newTabs = prevTabs.filter(t => t.path !== graphPath);
              newTabs.unshift({ path: graphPath, name: graphName });
              if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
              return newTabs;
            });
            setActiveFile(graphPath);
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
                } catch (err) {
                }
              }
              return;
            }

            // Fall back to opening template picker modal
            setShowTemplatePicker(true);
            setTemplatePickerData({
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
                      } catch (err) {
                      }
                    }

                    if (!inserted) {
                    }

                  } catch (err) {
                  }
                } else {
                }
              }
            });
          }}
          onCreateTemplate={handleCreateTemplate}
          // onOpenGmail={handleOpenGmail} // Gmail disabled
          onOpenDailyNote={handleOpenDailyNote}
          activeFile={activeFile}
        />

        <InFileSearch
          editor={editorRef.current}
          isVisible={showInFileSearch}
          onClose={() => setShowInFileSearch(false)}
        />

        {showTemplatePicker && templatePickerData && (
          <TemplatePicker
            open={showTemplatePicker}
            onClose={() => {
              setShowTemplatePicker(false);
              setTemplatePickerData(null);
            }}
            onSelect={(template, processedContent) => {
              if (templatePickerData.onSelect) {
                templatePickerData.onSelect(template, processedContent);
              }
              setShowTemplatePicker(false);
              setTemplatePickerData(null);
            }}
            editorState={templatePickerData.editorState}
          />
        )}

        <FullTextSearchPanel
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onResultClick={(result) => {
            if (result.path) {
              handleFileOpen(result.path);
            }
            setShowGlobalSearch(false);
          }}
          workspacePath={path}
        />

        <ShortcutHelpModal
          isOpen={showShortcutHelp}
          onClose={() => setShowShortcutHelp(false)}
        />

        <CreateTemplate
          open={showCreateTemplate}
          onClose={() => setShowCreateTemplate(false)}
          initialContent={createTemplateContent}
          onSaved={handleCreateTemplateSaved}
        />

        {/* Date Picker Modal for Daily Notes */}
        <DatePickerModal
          isOpen={showDatePickerModal}
          onClose={() => setShowDatePickerModal(false)}
          onDateSelect={handleOpenDailyNoteByDate}
          workspacePath={path}
        />

        {/* Tag Management Modal */}
        <TagManagementModal
          isOpen={showTagModal}
          onClose={() => {
            setShowTagModal(false);
            setTagModalFile(null);
          }}
          file={tagModalFile}
          onTagsUpdated={(file, tags) => {
            // Refresh file tree and Bases to show updated tags
            setRefreshId(prev => prev + 1);
          }}
        />

        {/* Pluginable Status Bar - replaces the old Obsidian status bar */}
        <StatusBar
          activeFile={activeFile}
          unsavedChanges={unsavedChanges}
          openTabs={openTabs}
          editor={editor}
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
          console.error('[Workspace] Failed to initialize kanban:', error);
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
    <BasesProvider workspacePath={path}>
      <FolderScopeProvider workspacePath={path}>
        <WorkspaceWithScope path={path} />
      </FolderScopeProvider>
    </BasesProvider>
  );
}