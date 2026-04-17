import { useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Context providers
import { FolderScopeProvider, useFolderScope } from '../contexts/FolderScopeContext.jsx';
import { BasesProvider, useBases } from '../bases/BasesContext.jsx';
import { PanelManager } from '../plugins/ui/PanelManager.jsx';

// Stores
import { useEditorGroupStore } from '../stores/editorGroups';
import { useFileTreeStore } from '../stores/fileTree';
import { useLayoutStore } from '../stores/layout';
import { useViewStore } from '../stores/views';

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
import { syncScheduler } from '../core/sync/SyncScheduler';
import { useAuth } from '../core/auth/AuthContext';

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
import BlockIndexProgress from '../components/BlockIndexProgress.jsx';

// ---------------------------------------------------------------------------
// Inner orchestrator — rendered inside context providers
// ---------------------------------------------------------------------------
function WorkspaceInner({ path }) {
  const { theme: currentTheme } = useTheme();
  const { filterFileTree, scopeMode, scopedFolders } = useFolderScope();
  const { activeBase } = useBases();
  const { plugins } = usePlugins();
  const featureFlags = useFeatureFlags();

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
    onSave: handleSave,
  });

  // File operations
  const fileOps = useFileOperations({
    workspacePath: path,
    featureFlags,
    handleFileOpen,
    currentTheme,
  });

  // Session (file tree loading, session persistence, image insertion)
  const { reloadCurrentFile, insertImagesIntoEditor } = useWorkspaceSession({
    workspacePath: path,
    plugins,
  });

  // Workspace-level Tauri event listeners
  useWorkspaceEvents({
    workspacePath: path,
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

  // Initialize cloud sync when workspace opens with authenticated user
  const { isAuthenticated, isGuest, user } = useAuth();
  useEffect(() => {
    if (path && isAuthenticated && !isGuest && user?.id) {
      syncScheduler.start(path, user.id);
    }
    return () => syncScheduler.stop();
  }, [path, isAuthenticated, isGuest, user?.id]);

  // Sync feature flags to globalThis for non-React code (slash commands, shortcuts)
  useEffect(() => {
    globalThis.__LOKUS_FEATURE_FLAGS__ = featureFlags;
  }, [featureFlags]);

  // ---------------------------------------------------------------------------
  // File tree filtering (base scope > folder scope)
  // ---------------------------------------------------------------------------
  const fileTree = useFileTreeStore((s) => s.fileTree);
  const filteredFileTree = useMemo(() => {
    const groups = useEditorGroupStore.getState().getAllGroups();
    const hasBasesTab = groups.some((g) => g.tabs.some((t) => t.path === '__bases__'));

    // Hide files for disabled features (.kanban, .canvas)
    const filterByFeatureFlags = (entries) =>
      entries
        .filter((e) => {
          if (!featureFlags.enable_kanban && e.path?.endsWith('.kanban')) return false;
          if (!featureFlags.enable_canvas && e.path?.endsWith('.canvas')) return false;
          return true;
        })
        .map((e) => (e.children?.length ? { ...e, children: filterByFeatureFlags(e.children) } : e));

    if (activeBase?.sourceFolder && hasBasesTab) {
      const filterToBase = (entries) =>
        entries
          .filter((e) => e.path === activeBase.sourceFolder || e.path.startsWith(activeBase.sourceFolder + '/'))
          .map((e) => (e.children?.length ? { ...e, children: filterToBase(e.children) } : e));
      return filterByFeatureFlags(filterToBase(fileTree));
    }
    return filterByFeatureFlags(filterFileTree(fileTree));
  }, [fileTree, activeBase?.sourceFolder, scopeMode, scopedFolders, filterFileTree, featureFlags.enable_kanban, featureFlags.enable_canvas]);

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

      <div className="h-full w-full overflow-hidden">
        <WorkspaceShell
          toolbar={
            <Toolbar
              onCreateFile={fileOps.handleCreateFile}
              onCreateFolder={fileOps.handleCreateFolder}
              onCreateCanvas={fileOps.handleCreateCanvas}
            />
          }
          iconSidebar={<IconSidebar />}
          leftSidebar={
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
          }
          mainContent={
            <ErrorBoundary name="MainContent" message="Editor crashed">
              <MainContent
                workspacePath={path}
                welcomeProps={{
                  onCreateFile: fileOps.handleCreateFile,
                  onCreateFolder: fileOps.handleCreateFolder,
                  onCreateCanvas: fileOps.handleCreateCanvas,
                  onOpenCommandPalette: () => useViewStore.setState({ showCommandPalette: true }),
                  onFileOpen: handleFileOpen,
                }}
              />
            </ErrorBoundary>
          }
          rightSidebar={
            <ErrorBoundary name="RightSidebar" message="Panel crashed">
              <RightSidebar
                workspacePath={path}
                onFileOpen={handleFileOpen}
                onOpenDailyNoteByDate={fileOps.handleOpenDailyNoteByDate}
                onReloadCurrentFile={reloadCurrentFile}
                graphProcessorRef={graphEngine.graphProcessorRef}
              />
            </ErrorBoundary>
          }
          bottomPanel={<BottomPanel workspacePath={path} onResizeStart={handleBottomPanelResizeStart} />}
          statusBar={<><ResponsiveStatusBar workspacePath={path} /><BlockIndexProgress /></>}
        />
      </div>

      <ErrorBoundary name="ModalLayer" message="Modal crashed">
        <ModalLayer
          workspacePath={path}
          onFileOpen={handleFileOpen}
          onCreateFile={fileOps.handleCreateFile}
          onCreateTemplateSaved={fileOps.handleCreateTemplateSaved}
          onOpenDailyNoteByDate={fileOps.handleOpenDailyNoteByDate}
          onConfirmReferenceUpdate={handleConfirmReferenceUpdate}
          onCloseReferenceModal={handleCloseReferenceModal}
        />
      </ErrorBoundary>
    </PanelManager>
  );
}

// ---------------------------------------------------------------------------
// Workspace — public entry point; sets up context providers and path init.
// Receives `path` directly from App.jsx (no internal useState needed).
// ---------------------------------------------------------------------------
export default function Workspace({ path: pathProp, initialPath, ...rest }) {
  const path = pathProp || initialPath || '';
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
