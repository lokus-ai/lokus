import { useEffect, useRef, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Context providers
import { FolderScopeProvider, useFolderScope } from '../contexts/FolderScopeContext.jsx';
import { BasesProvider, useBases } from '../bases/BasesContext.jsx';
import { PanelManager } from '../plugins/ui/PanelManager.jsx';

// Stores
import { useEditorGroupStore } from '../stores/editorGroups';
import { useFileTreeStore } from '../stores/fileTree';
import { useLayoutStore } from '../stores/layout';

// Feature hooks
import { useWorkspaceSession } from '../features/workspace/useWorkspaceSession';
import { useWorkspaceEvents } from '../features/workspace/useWorkspaceEvents';
import { useReferenceModal } from '../features/workspace/useReferenceModal';
import { useSave, useExport } from '../features/editor';
import { useFileOperations } from '../features/file-tree';
import { useGraphEngine } from '../features/graph';
import { useTabs } from '../features/tabs';
import { ShortcutListener } from '../features/shortcuts';

// Misc
import { usePlugins } from '../hooks/usePlugins.jsx';
import { useTheme } from '../hooks/theme.jsx';
import { useFeatureFlags } from '../contexts/RemoteConfigContext';
import dailyNotesManager from '../core/daily-notes/manager.js';

// Sub-components
import WorkspaceShell from './WorkspaceShell';
import Toolbar from './workspace/Toolbar';
import IconSidebar from './workspace/IconSidebar';
import LeftSidebar from './workspace/LeftSidebar';
import MainContent from './workspace/MainContent';
import RightSidebar from './workspace/RightSidebar';
import BottomPanel from './workspace/BottomPanel';
import ModalLayer from './workspace/ModalLayer';
import ErrorBoundary from '../components/ErrorBoundary';
import ResponsiveStatusBar from '../components/StatusBar/ResponsiveStatusBar.jsx';

// ---------------------------------------------------------------------------
// Inner orchestrator — rendered inside context providers
// ---------------------------------------------------------------------------
function WorkspaceInner({ path }) {
  const { theme: currentTheme } = useTheme();
  const { filterFileTree, scopeMode, scopedFolders } = useFolderScope();
  const { activeBase } = useBases();
  const { plugins } = usePlugins();
  const featureFlags = useFeatureFlags();

  // Stable refs
  const editorRef = useRef(null);

  // Graph engine (owns graphProcessorRef internally)
  const graphEngine = useGraphEngine({ workspacePath: path });

  // Save / export
  const { handleSave, handleSaveAs } = useSave({
    workspacePath: path,
    graphProcessorRef: graphEngine.graphProcessorRef,
    onRefreshFiles: () => useFileTreeStore.getState().refreshTree(),
  });
  const { handleExportHtml, handleExportPdf } = useExport({ workspacePath: path });

  // Tabs
  const { handleFileOpen } = useTabs({
    workspacePath: path,
    editorRef,
    onSave: handleSave,
  });

  // File operations
  const fileOps = useFileOperations({
    workspacePath: path,
    featureFlags,
    handleFileOpen,
    editorRef,
    currentTheme,
  });

  // Session (file tree loading, session persistence, image insertion)
  const { reloadCurrentFile, insertImagesIntoEditor } = useWorkspaceSession({
    workspacePath: path,
    editorRef,
    plugins,
  });

  // Workspace-level Tauri event listeners
  useWorkspaceEvents({
    workspacePath: path,
    editorRef,
    graphProcessorRef: graphEngine.graphProcessorRef,
    insertImagesIntoEditor,
  });

  // Reference update modal
  const { handleCheckReferences, handleConfirmReferenceUpdate, handleCloseReferenceModal } =
    useReferenceModal();

  // Initialise daily notes manager whenever the path changes
  useEffect(() => {
    if (path) dailyNotesManager.init(path);
  }, [path]);

  // ---------------------------------------------------------------------------
  // File tree filtering (base scope > folder scope)
  // ---------------------------------------------------------------------------
  const fileTree = useFileTreeStore((s) => s.fileTree);
  const filteredFileTree = useMemo(() => {
    const groups = useEditorGroupStore.getState().getAllGroups();
    const hasBasesTab = groups.some((g) => g.tabs.some((t) => t.path === '__bases__'));

    if (activeBase?.sourceFolder && hasBasesTab) {
      const filterToBase = (entries) =>
        entries
          .filter((e) => e.path === activeBase.sourceFolder || e.path.startsWith(activeBase.sourceFolder + '/'))
          .map((e) => (e.children?.length ? { ...e, children: filterToBase(e.children) } : e));
      return filterToBase(fileTree);
    }
    return filterFileTree(fileTree);
  }, [fileTree, activeBase?.sourceFolder, scopeMode, scopedFolders, filterFileTree]);

  // ---------------------------------------------------------------------------
  // Callbacks delegated to sub-components
  // ---------------------------------------------------------------------------
  const handleRefreshFiles = useCallback(
    () => useFileTreeStore.getState().refreshTree(),
    [],
  );

  const handleOpenPluginDetail = useCallback((plugin) => {
    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (groupId) {
      store.addTab(groupId, {
        path: `__plugin_${plugin.id}__`,
        name: `${plugin.name} Plugin`,
        plugin,
      }, true);
    }
  }, []);

  const handleBottomPanelResizeStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
        <Toolbar
          onCreateFile={fileOps.handleCreateFile}
          onCreateFolder={fileOps.handleCreateFolder}
          onCreateCanvas={fileOps.handleCreateCanvas}
        />

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
            editorGroupsUpdateTabPath={(old, next) =>
              useEditorGroupStore.getState().updateTabPath(old, next)
            }
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

        <BottomPanel workspacePath={path} onResizeStart={handleBottomPanelResizeStart} />
      </WorkspaceShell>

      <ResponsiveStatusBar workspacePath={path} />

      <ErrorBoundary name="ModalLayer" message="Modal crashed">
        <ModalLayer
          workspacePath={path}
          onFileOpen={handleFileOpen}
          onCreateFile={fileOps.handleCreateFile}
          onCreateTemplateSaved={fileOps.handleCreateTemplateSaved}
          onOpenDailyNoteByDate={fileOps.handleOpenDailyNoteByDate}
          onConfirmReferenceUpdate={handleConfirmReferenceUpdate}
          onCloseReferenceModal={handleCloseReferenceModal}
          editorRef={editorRef}
        />
      </ErrorBoundary>
    </PanelManager>
  );
}

// ---------------------------------------------------------------------------
// Workspace — public entry point; sets up context providers and path init.
// Receives `path` directly from App.jsx (no internal useState needed).
// ---------------------------------------------------------------------------
export default function Workspace({ path = '' }) {
  useEffect(() => {
    if (!path) return;
    invoke('validate_workspace_path', { path }).catch(() => {});
    import('../core/vault/vault.js').then(({ saveWorkspacePath }) => saveWorkspacePath(path));
    window.__WORKSPACE_PATH__ = path;
    invoke('api_set_workspace', { workspace: path }).catch(() => {});
    invoke('initialize_workspace_kanban', { workspacePath: path }).catch(() => {});
  }, [path]);

  if (!path) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <h2>No Workspace Path</h2>
        <p style={{ fontSize: '14px' }}>Open a vault to get started.</p>
      </div>
    );
  }

  return (
    <FolderScopeProvider workspacePath={path}>
      <BasesProvider workspacePath={path}>
        <WorkspaceInner path={path} />
      </BasesProvider>
    </FolderScopeProvider>
  );
}
