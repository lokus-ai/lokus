import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFeatureFlags } from "../contexts/RemoteConfigContext";
import { FolderScopeProvider, useFolderScope } from "../contexts/FolderScopeContext.jsx";
import { BasesProvider, useBases } from "../bases/BasesContext.jsx";
import { PanelManager } from "../plugins/ui/PanelManager.jsx";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { useTheme } from "../hooks/theme.jsx";

// Stores
import { useEditorGroupStore } from "../stores/editorGroups";
import { useFileTreeStore } from "../stores/fileTree";

// Feature hooks
import { useWorkspaceSession } from "../features/workspace/useWorkspaceSession";
import { useWorkspaceEvents } from "../features/workspace/useWorkspaceEvents";
import { useReferenceModal } from "../features/workspace/useReferenceModal";
import { useColumnResize } from "../features/layout";
import { useExport, useSave } from "../features/editor";
import { useFileOperations } from "../features/file-tree";
import { useGraphEngine } from "../features/graph";
import { useTabs } from "../features/tabs";
import { ShortcutListener } from "../features/shortcuts";

// Sub-components
import WorkspaceShell from "./WorkspaceShell";
import Toolbar from "./workspace/Toolbar";
import IconSidebar from "./workspace/IconSidebar";
import LeftSidebar from "./workspace/LeftSidebar";
import MainContent from "./workspace/MainContent";
import RightSidebar from "./workspace/RightSidebar";
import BottomPanel from "./workspace/BottomPanel";
import ModalLayer from "./workspace/ModalLayer";
import ErrorBoundary from "../components/ErrorBoundary";
import ResponsiveStatusBar from "../components/StatusBar/ResponsiveStatusBar.jsx";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard.jsx";

import dailyNotesManager from "../core/daily-notes/manager.js";
import { joinPath } from "../utils/pathUtils.js";

/**
 * WorkspaceWithScope — inner orchestrator with all hooks.
 * Renders the 7 sub-components inside WorkspaceShell.
 */
function WorkspaceWithScope({ path }) {
  const { theme: currentTheme } = useTheme();
  const { filterFileTree, scopeMode, scopedFolders } = useFolderScope();
  const { activeBase } = useBases();
  const { plugins } = usePlugins();
  const featureFlags = useFeatureFlags();

  // Refs
  const editorRef = useRef(null);
  const graphProcessorRef = useRef(null);

  // Column resize (sidebar drag handles)
  const { leftW, rightW, startLeftDrag, startRightDrag } = useColumnResize({
    minLeft: 220, maxLeft: 500, minRight: 220, maxRight: 500,
  });

  // Graph engine
  const graphEngine = useGraphEngine({ workspacePath: path });
  graphProcessorRef.current = graphEngine.graphProcessorRef?.current;

  // Save / export
  const { handleSave, handleSaveAs } = useSave({
    workspacePath: path,
    graphProcessorRef: graphEngine.graphProcessorRef,
    onRefreshFiles: () => useFileTreeStore.getState().refreshTree(),
  });

  const { handleExportHtml, handleExportPdf } = useExport({ workspacePath: path });

  // Tabs
  const { handleTabClose, handleFileOpen, handleTabClick, handleReopenClosedTab } = useTabs({
    workspacePath: path,
    editorRef,
    onSave: handleSave,
  });

  // File operations (create file, folder, canvas, kanban, daily note, template, workspace)
  const fileOps = useFileOperations({
    workspacePath: path,
    featureFlags,
    handleFileOpen,
    editorRef,
    currentTheme,
  });

  // Session (file tree loading, session persistence, image insert)
  const { reloadCurrentFile, getTabDisplayName, insertImagesIntoEditor } =
    useWorkspaceSession({ workspacePath: path, editorRef, plugins });

  // Events (open-file, wiki links, canvas hover, drag-drop, template picker, shortcuts)
  useWorkspaceEvents({
    workspacePath: path,
    editorRef,
    graphProcessorRef: graphEngine.graphProcessorRef,
    insertImagesIntoEditor,
  });

  // Reference update modal
  const { handleCheckReferences, handleConfirmReferenceUpdate, handleCloseReferenceModal } =
    useReferenceModal();

  // Daily notes init
  useEffect(() => {
    if (path) dailyNotesManager.init(path);
  }, [path]);

  // Detect daily note date for current file
  useEffect(() => {
    const group = useEditorGroupStore.getState().getFocusedGroup();
    const activeFile = group?.activeTab;
    if (activeFile && path) {
      const config = dailyNotesManager.getConfig();
      const dailyNotesFolder = joinPath(path, config.folder);
      if (activeFile.startsWith(dailyNotesFolder) && activeFile.endsWith('.md')) {
        try {
          const fileName = activeFile.split('/').pop().replace('.md', '');
          const date = dailyNotesManager.parseDate(fileName);
          // Store on viewStore or workspace store as needed
        } catch {}
      }
    }
  }, [path]);

  // File tree filtering
  const fileTree = useFileTreeStore((s) => s.fileTree);
  const filteredFileTree = useMemo(() => {
    const groups = useEditorGroupStore.getState().getAllGroups();
    const hasBasesTab = groups.some(g => g.tabs.some(t => t.path === '__bases__'));

    if (activeBase?.sourceFolder && hasBasesTab) {
      const filterToBase = (entries) =>
        entries
          .filter(e => e.path === activeBase.sourceFolder || e.path.startsWith(activeBase.sourceFolder + '/'))
          .map(e => e.children?.length ? { ...e, children: filterToBase(e.children) } : e);
      return filterToBase(fileTree);
    }
    return filterFileTree(fileTree);
  }, [fileTree, activeBase?.sourceFolder, scopeMode, scopedFolders, filterFileTree]);

  const handleRefreshFiles = () => useFileTreeStore.getState().refreshTree();

  const handleOpenPluginDetail = (plugin) => {
    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (groupId) {
      store.addTab(groupId, {
        path: `__plugin_${plugin.id}__`,
        name: `${plugin.name} Plugin`,
        plugin,
      }, true);
    }
  };

  const handleBottomPanelResizeStart = useCallback((e) => {
    // Implement bottom panel resize via mouse drag
    e.preventDefault();
    const startY = e.clientY;
    const { useLayoutStore } = require('../stores/layout');
    const startH = useLayoutStore.getState().bottomPanelHeight;
    const onMove = (ev) => {
      const delta = startY - ev.clientY;
      useLayoutStore.getState().setBottomHeight(Math.max(100, Math.min(600, startH + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <PanelManager>
      <ShortcutListener
        workspacePath={path}
        editorRef={editorRef}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onCreateFile={fileOps.handleCreateFile}
        onCreateFolder={fileOps.handleCreateFolder}
        onCreateCanvas={fileOps.handleCreateCanvas}
        onOpenDailyNote={fileOps.handleOpenDailyNote}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        onOpenWorkspace={fileOps.handleOpenWorkspace}
      />

      <WorkspaceShell>
        {/* Row 1: Toolbar spanning all columns */}
        <Toolbar
          onCreateFile={fileOps.handleCreateFile}
          onCreateFolder={fileOps.handleCreateFolder}
          onCreateCanvas={fileOps.handleCreateCanvas}
        />

        {/* Row 2: Icon sidebar | Left sidebar | Main content | Right sidebar */}
        <IconSidebar />

        <ErrorBoundary name="LeftSidebar" message="Sidebar crashed">
          <LeftSidebar
            workspacePath={path}
            filteredFileTree={filteredFileTree}
            onFileOpen={handleFileOpen}
            onCreateFile={fileOps.handleCreateFile}
            onCreateFolder={fileOps.handleCreateFolder}
            onCreateCanvas={fileOps.handleCreateCanvas}
            onOpenDailyNote={fileOps.handleOpenDailyNote}
            onOpenDailyNoteByDate={fileOps.handleOpenDailyNoteByDate}
            onRefreshFiles={handleRefreshFiles}
            onConfirmCreate={fileOps.handleConfirmCreate}
            onCheckReferences={handleCheckReferences}
            onViewHistory={() => {}}
            onOpenPluginDetail={handleOpenPluginDetail}
            onCreateKanban={fileOps.handleCreateKanban}
            onKanbanBoardAction={fileOps.handleKanbanBoardAction}
            editorGroupsUpdateTabPath={(old, n) => useEditorGroupStore.getState().updateTabPath(old, n)}
          />
        </ErrorBoundary>

        <ErrorBoundary name="MainContent" message="Editor crashed">
          <MainContent workspacePath={path} editorRef={editorRef} />
        </ErrorBoundary>

        <ErrorBoundary name="RightSidebar" message="Panel crashed">
          <RightSidebar
            workspacePath={path}
            onFileOpen={handleFileOpen}
            onOpenDailyNoteByDate={fileOps.handleOpenDailyNoteByDate}
            onReloadCurrentFile={reloadCurrentFile}
            editorRef={editorRef}
            graphProcessorRef={graphEngine.graphProcessorRef}
          />
        </ErrorBoundary>

        {/* Row 3: Bottom panel + Status bar */}
        <BottomPanel
          workspacePath={path}
          onResizeStart={handleBottomPanelResizeStart}
        />
      </WorkspaceShell>

      <ResponsiveStatusBar workspacePath={path} />

      <ErrorBoundary name="ModalLayer" message="Modal crashed">
        <ModalLayer
          workspacePath={path}
          onFileOpen={handleFileOpen}
          onCreateFile={fileOps.handleCreateFile}
          onCreateTemplateSaved={fileOps.handleCreateTemplateSaved}
          onOpenDailyNoteByDate={fileOps.handleOpenDailyNoteByDate}
          editorRef={editorRef}
        />
      </ErrorBoundary>
    </PanelManager>
  );
}

/**
 * Workspace — outer shell that provides context and resolves path.
 */
export default function Workspace({ initialPath = "" }) {
  const [path, setPath] = useState(initialPath);

  useEffect(() => {
    if (initialPath) {
      invoke("validate_workspace_path", { path: initialPath }).catch(() => {});

      import('../core/vault/vault.js').then(({ saveWorkspacePath }) => {
        saveWorkspacePath(initialPath);
      });

      window.__WORKSPACE_PATH__ = initialPath;

      invoke('api_set_workspace', { workspace: initialPath }).catch(() => {});
      invoke('initialize_workspace_kanban', { workspacePath: initialPath }).catch(() => {});
    }
  }, [initialPath]);

  if (!path && !initialPath) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '20px', backgroundColor: 'var(--app-panel)', color: 'var(--app-text)', padding: '20px',
      }}>
        <h2>No Workspace Path</h2>
        <div style={{ fontSize: '14px' }}>No workspace path was provided.</div>
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
