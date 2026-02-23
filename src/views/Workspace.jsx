import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRemoteLinks, useUIVisibility, useFeatureFlags } from "../contexts/RemoteConfigContext";
import ServiceStatus from "../components/ServiceStatus";
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
import { formatAccelerator } from "../core/shortcuts/registry.js";
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
import { getSystemPreferredTheme, setupSystemThemeListener, readGlobalVisuals } from "../core/theme/manager.js";
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
import { isImageFile } from "../utils/imageUtils.js";
import CanvasPreviewPopup from '../components/CanvasPreviewPopup.jsx';
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
import ReferenceUpdateModal from "../components/ReferenceUpdateModal.jsx";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { useWorkspaceStore } from '../stores/workspace';
import { useWorkspaceSession } from '../features/workspace/useWorkspaceSession';
import { useWorkspaceEvents } from '../features/workspace/useWorkspaceEvents';
import { useReferenceModal } from '../features/workspace/useReferenceModal';
import { useColumnResize } from '../features/layout';
import { useEditorContent, useExport, useSave, EditorModeSwitcher as FeatureEditorModeSwitcher, EditorDropZone } from '../features/editor';
import { useFileTree, useFileOperations, FileEntryComponent, FileTreeView, InlineRenameInput } from '../features/file-tree';
import { NewItemInput as FeatureNewItemInput } from '../features/file-tree';
import { useGraphEngine } from '../features/graph';
import { useSplitView as useSplitViewHook } from '../features/split-view';
import { usePanels } from '../features/panels';
import { ShortcutListener } from '../features/shortcuts';
import { useTabs, OldTabBar } from '../features/tabs';

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

// InlineRenameInput extracted to src/features/file-tree/InlineRenameInput.jsx
// FileEntryComponent extracted to src/features/file-tree/FileEntryComponent.jsx
// FileTreeView extracted to src/features/file-tree/FileTreeView.jsx
// OldTabBar extracted to src/features/tabs/OldTabBar.jsx
// EditorDropZone extracted to src/features/editor/EditorDropZone.jsx


const MAX_OPEN_TABS = 10;

// --- Inner Workspace Component (with folder scope) ---
function WorkspaceWithScope({ path }) {
  const { theme: currentTheme } = useTheme();
  const { filterFileTree, scopeMode, scopedFolders } = useFolderScope();
  const { activeBase } = useBases();
  const { plugins } = usePlugins();
  const remoteLinks = useRemoteLinks();
  const remoteLinksRef = useRef(remoteLinks);
  const uiVisibility = useUIVisibility();
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

  // Graph engine hook - provides processor refs and graph callbacks
  const {
    initializeGraphProcessor,
    handleGraphStateChange,
    buildGraphData,
    handleGraphNodeClick,
    handleOpenGraphView,
    graphProcessorRef,
    graphDataInstanceRef,
    persistentGraphEngineRef,
  } = useGraphEngine({ workspacePath: path });

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

  const {
    getTargetPath,
    handleCreateFile,
    handleCreateCanvas,
    handleCreateKanban,
    handleKanbanBoardAction,
    handleOpenDailyNote,
    handleOpenDailyNoteByDate,
    handleCreateFolder,
    handleConfirmCreate,
    handleCreateTemplate,
    handleCreateTemplateSaved,
    handleOpenWorkspace,
  } = useFileOperations({
    workspacePath: path,
    featureFlags,
    handleFileOpen,
    editorRef,
    currentTheme,
  });

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

  // Split-view feature hook
  const {
    handleSplitDragStart,
    handleSplitDragEnd,
    handleToggleSplitView,
    handleMouseDown,
    resetPaneSize,
    toggleSplitDirection,
    handleBottomPanelResizeStart,
    handleLeftPaneScroll,
    handleRightPaneScroll,
  } = useSplitViewHook({ workspacePath: path, editorRef, leftPaneScrollRef, rightPaneScrollRef });

  // --- Extracted feature hooks ---
  const {
    reloadCurrentFile,
    handleEditorChange,
    getTabDisplayName,
    insertImagesIntoEditor,
  } = useWorkspaceSession({ workspacePath: path, editorRef, plugins });

  const {
    handleCheckReferences,
    handleConfirmReferenceUpdate,
    handleCloseReferenceModal,
  } = useReferenceModal();

  useWorkspaceEvents({
    workspacePath: path,
    editorRef,
    graphProcessorRef,
    insertImagesIntoEditor,
  });

  // Note: workspace:activate events are handled by useWorkspaceActivation in App.jsx
  // which passes the path down via props to this component

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