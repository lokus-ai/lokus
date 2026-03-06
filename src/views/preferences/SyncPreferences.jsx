import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import { syncEngine } from '../../core/sync/SyncEngine';
import { offlineQueue } from '../../core/sync/OfflineQueue';
import { readRecents, addRecent } from '../../lib/recents';
import { WorkspaceManager } from '../../core/workspace/manager';
import { Cloud, CloudOff, RefreshCw, Shield, HardDrive, Clock, FileText, Loader2, CheckCircle2, AlertTriangle, FolderSync, Power, PowerOff, WifiOff, Download } from 'lucide-react';
import { toast } from 'sonner';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SyncPreferences({ isAuthenticated, isGuest, userId }) {
  const [syncStatus, setSyncStatus] = useState('idle');
  const [remoteStats, setRemoteStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyPath, setBusyPath] = useState(null); // path currently being enabled/disabled
  // Map of workspace path → sync-id (or null). Tracks which workspaces have sync enabled.
  const [syncMap, setSyncMap] = useState({});
  const [loadingSyncMap, setLoadingSyncMap] = useState(true);
  const [registeredWorkspaces, setRegisteredWorkspaces] = useState([]); // { workspace_id, name, created_at }[]
  const [pullingId, setPullingId] = useState(null); // workspace_id currently being pulled
  const [linkTarget, setLinkTarget] = useState(null); // workspace path wanting to link to existing cloud workspace

  const recents = readRecents();
  const currentPath = syncEngine.workspacePath;
  const currentName = currentPath ? currentPath.split(/[/\\]/).filter(Boolean).pop() : null;
  const currentSyncId = currentPath ? syncMap[currentPath] : null;

  // -----------------------------------------------------------------------
  // Load sync status for all recent workspaces
  // -----------------------------------------------------------------------

  const loadSyncMap = useCallback(async () => {
    setLoadingSyncMap(true);
    const map = {};
    for (const r of recents) {
      map[r.path] = await syncEngine.getSyncIdForPath(r.path);
    }
    // Also include current workspace if not in recents
    if (currentPath && !map[currentPath]) {
      map[currentPath] = await syncEngine.getSyncIdForPath(currentPath);
    }
    setSyncMap(map);
    setLoadingSyncMap(false);

    // Load registered workspaces from registry
    if (userId) {
      syncEngine.getRegisteredWorkspaces(userId).then(ws => {
        setRegisteredWorkspaces(ws || []);
      }).catch(() => setRegisteredWorkspaces([]));
    }
  }, [currentPath, userId]); // recents comes from localStorage, stable enough

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    const stats = await syncEngine.getRemoteStats();
    setRemoteStats(stats);
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    loadSyncMap();
    if (syncEngine.syncEnabled) loadStats();

    const unsub = syncEngine.onStatusChange((status) => {
      setSyncStatus(status);
      setSyncing(status === 'syncing');
      if (status === 'synced') {
        setTimeout(loadStats, 500);
      }
    });
    return unsub;
  }, [isAuthenticated, isGuest, loadStats, loadSyncMap]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSyncNow = async () => {
    setSyncing(true);
    await syncEngine.sync();
  };

  const handleEnableSync = async (workspacePath) => {
    if (!workspacePath) return;
    setBusyPath(workspacePath);
    try {
      const syncId = await syncEngine.enableSyncForWorkspace(workspacePath, userId);
      setSyncMap(prev => ({ ...prev, [workspacePath]: syncId }));
      // If this is the current workspace, trigger a sync
      if (workspacePath === currentPath) {
        await syncEngine.sync();
        await loadStats();
      }
    } catch (err) {
      console.error('[Sync] Enable failed:', err);
    } finally {
      setBusyPath(null);
    }
  };

  const handleLinkToCloud = async (workspacePath, workspaceId) => {
    if (!workspacePath || !userId) return;
    setLinkTarget(null);
    setBusyPath(workspacePath);
    try {
      await syncEngine.enableSyncForWorkspace(workspacePath, userId, { workspaceId });
      await syncEngine.pullWorkspace(workspacePath, userId, workspaceId);
      setSyncMap(prev => ({ ...prev, [workspacePath]: workspaceId }));
      toast.success('Linked and pulled!');
      if (workspacePath === currentPath) {
        await loadStats();
      }
      await loadSyncMap();
    } catch (err) {
      console.error('[Sync] Link failed:', err);
      toast.error(`Failed to link workspace: ${err.message}`);
    } finally {
      setBusyPath(null);
    }
  };

  const handleDisableSync = async (workspacePath) => {
    if (!workspacePath) return;
    setBusyPath(workspacePath);
    try {
      await syncEngine.disableSyncForWorkspace(workspacePath, userId);
      setSyncMap(prev => ({ ...prev, [workspacePath]: null }));
      if (workspacePath === currentPath) {
        setRemoteStats(null);
      }
    } catch (err) {
      console.error('[Sync] Disable failed:', err);
    } finally {
      setBusyPath(null);
    }
  };

  const handlePullCloudWorkspace = async (workspaceId) => {
    if (!userId) return;
    const targetPath = await open({
      directory: true,
      defaultPath: await homeDir(),
      title: 'Choose folder to pull workspace into',
    });
    if (!targetPath) return;

    setPullingId(workspaceId);
    try {
      await syncEngine.enableSyncForWorkspace(targetPath, userId, { workspaceId });
      await syncEngine.pullWorkspace(targetPath, userId, workspaceId);
      addRecent(targetPath);
      toast.success('Workspace pulled successfully!');
      await loadSyncMap();
    } catch (err) {
      console.error('[Sync] Pull failed:', err);
      toast.error(`Failed to pull workspace: ${err.message}`);
    } finally {
      setPullingId(null);
    }
  };

  const handleRemoveCloudWorkspace = async (workspaceId) => {
    if (!userId) return;
    await syncEngine.removeRegisteredWorkspace(userId, workspaceId);
    setRegisteredWorkspaces(prev => prev.filter(w => w.workspace_id !== workspaceId));
  };

  // -----------------------------------------------------------------------
  // Not authenticated
  // -----------------------------------------------------------------------

  if (!isAuthenticated || isGuest) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-2">Sync</h1>
          <p className="text-app-text-secondary">Sign in to sync your workspace across devices.</p>
        </div>
        <div className="bg-app-panel border border-app-border rounded-xl p-8 text-center">
          <CloudOff className="w-12 h-12 text-app-muted mx-auto mb-4" />
          <p className="text-app-text font-medium mb-2">Sync is disabled</p>
          <p className="text-app-muted text-sm">Sign in from the Account tab to enable encrypted cloud sync.</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Status config
  // -----------------------------------------------------------------------

  const statusConfig = {
    idle: { icon: Cloud, color: 'text-app-muted', label: 'Idle' },
    syncing: { icon: Loader2, color: 'text-blue-500', label: 'Syncing...' },
    synced: { icon: CheckCircle2, color: 'text-green-500', label: 'Synced' },
    error: { icon: AlertTriangle, color: 'text-amber-500', label: 'Error' },
    offline: { icon: WifiOff, color: 'text-orange-500', label: `Offline${offlineQueue.size > 0 ? ` (${offlineQueue.size} queued)` : ''}` },
    online: { icon: Cloud, color: 'text-green-500', label: 'Back online' },
  }[syncStatus] || { icon: Cloud, color: 'text-app-muted', label: 'Idle' };

  const StatusIcon = statusConfig.icon;

  // Build a lookup from workspace_id → registered name
  const registryByWsId = {};
  for (const rw of registeredWorkspaces) {
    registryByWsId[rw.workspace_id] = rw.name;
  }

  // Build workspace list: current workspace first, then recents (deduped)
  const workspaceList = [];
  const seenPaths = new Set();
  const seenWsIds = new Set();
  if (currentPath) {
    const wsId = syncMap[currentPath];
    const cloudName = wsId ? registryByWsId[wsId] : null;
    workspaceList.push({ name: cloudName || currentName, path: currentPath, isCurrent: true });
    seenPaths.add(currentPath);
    if (wsId) seenWsIds.add(wsId);
  }
  for (const r of recents) {
    if (!seenPaths.has(r.path)) {
      const wsId = syncMap[r.path];
      const cloudName = wsId ? registryByWsId[wsId] : null;
      workspaceList.push({ name: cloudName || r.name, path: r.path, isCurrent: false });
      seenPaths.add(r.path);
      if (wsId) seenWsIds.add(wsId);
    }
  }

  // Cloud-only workspaces: registered but no local folder on this device
  const cloudOnlyWorkspaces = registeredWorkspaces.filter(
    rw => !seenWsIds.has(rw.workspace_id)
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-app-text mb-2">Sync</h1>
        <p className="text-app-text-secondary">
          Sync your workspaces across devices with end-to-end encryption.
        </p>
      </div>

      {/* Workspace List with per-workspace sync toggles */}
      <div className="bg-app-panel border border-app-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-app-text mb-4 flex items-center gap-2">
          <FolderSync className="w-4 h-4" />
          Workspaces
        </h3>

        {loadingSyncMap ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-app-muted animate-spin" />
          </div>
        ) : workspaceList.length > 0 ? (
          <div className="space-y-2">
            {workspaceList.map(ws => {
              const isSynced = !!syncMap[ws.path];
              const isBusy = busyPath === ws.path;

              return (
                <div
                  key={ws.path}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSynced
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-app-bg border-app-border'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      isSynced ? 'bg-green-500/10' : 'bg-app-accent/10'
                    }`}>
                      {isSynced
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <Power className="w-4 h-4 text-app-accent" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-app-text truncate flex items-center gap-2">
                        {ws.name}
                        {ws.isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-accent/10 text-app-accent font-medium">
                            open
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-app-muted truncate">{ws.path}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {isSynced ? (
                      <button
                        onClick={() => handleDisableSync(ws.path)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PowerOff className="w-3 h-3" />}
                        {isBusy ? '...' : 'Stop'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEnableSync(ws.path)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-app-accent hover:bg-app-accent/10 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                          {isBusy ? '...' : 'New'}
                        </button>
                        {registeredWorkspaces.length > 0 && (
                          <button
                            onClick={() => setLinkTarget(ws.path)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                          >
                            <Download className="w-3 h-3" />
                            Link
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-app-muted">Open a workspace first, then come back here to enable sync.</p>
        )}

        {/* Cloud-only workspaces (registered but no local folder on this device) */}
        {cloudOnlyWorkspaces.length > 0 && (
          <>
            <div className="text-xs font-medium text-app-muted uppercase tracking-wider mt-4 mb-2">Cloud Only</div>
            <div className="space-y-2">
              {cloudOnlyWorkspaces.map(ws => (
                <div
                  key={ws.workspace_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-blue-500/5 border-blue-500/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-blue-500/10">
                      <Cloud className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-app-text truncate">{ws.name}</div>
                      <div className="text-xs text-app-muted truncate">
                        {ws.workspace_id.slice(0, 8)}... — not on this device
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button
                      onClick={() => handlePullCloudWorkspace(ws.workspace_id)}
                      disabled={pullingId === ws.workspace_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      {pullingId === ws.workspace_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {pullingId === ws.workspace_id ? '...' : 'Pull'}
                    </button>
                    <button
                      onClick={() => handleRemoveCloudWorkspace(ws.workspace_id)}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove from registry"
                    >
                      <PowerOff className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Link picker — shown when user clicks "Link" on an unsynced workspace */}
        {linkTarget && (
          <div className="mt-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
            <div className="text-xs font-medium text-app-text mb-2">
              Link to which cloud workspace?
            </div>
            <div className="space-y-1.5">
              {registeredWorkspaces.map(cw => (
                <button
                  key={cw.workspace_id}
                  onClick={() => handleLinkToCloud(linkTarget, cw.workspace_id)}
                  className="w-full text-left p-2 rounded-md text-sm hover:bg-blue-500/10 transition-colors flex items-center gap-2"
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-app-text truncate">{cw.name}</span>
                  <span className="text-[10px] text-app-muted">{cw.workspace_id.slice(0, 8)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setLinkTarget(null)}
              className="mt-2 text-xs text-app-muted hover:text-app-text transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Status + Sync Now — only show when current workspace is synced */}
      {currentSyncId && (
        <>
          <div className="bg-app-panel border border-app-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <div>
                  <span className="text-sm font-medium text-app-text">{statusConfig.label}</span>
                  {syncEngine.lastSyncAt && (
                    <p className="text-xs text-app-muted">Last sync: {formatTimeAgo(syncEngine.lastSyncAt)}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-app-border hover:bg-app-bg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>

            {syncEngine.lastSyncResult && (
              <div className="flex gap-4 text-xs text-app-muted pt-3 border-t border-app-border">
                {syncEngine.lastSyncResult.uploaded > 0 && (
                  <span>{syncEngine.lastSyncResult.uploaded} uploaded</span>
                )}
                {syncEngine.lastSyncResult.downloaded > 0 && (
                  <span>{syncEngine.lastSyncResult.downloaded} downloaded</span>
                )}
                {syncEngine.lastSyncResult.merged > 0 && (
                  <span>{syncEngine.lastSyncResult.merged} merged</span>
                )}
                {syncEngine.lastSyncResult.uploaded === 0 && syncEngine.lastSyncResult.downloaded === 0 && syncEngine.lastSyncResult.merged === 0 && (
                  <span>Everything up to date</span>
                )}
              </div>
            )}
          </div>

          {/* Cloud Storage Stats */}
          <div className="bg-app-panel border border-app-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-app-text mb-4">Cloud Storage</h3>
            {loadingStats ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-app-muted animate-spin" />
              </div>
            ) : remoteStats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-app-muted" />
                  <div>
                    <div className="text-lg font-semibold text-app-text">{remoteStats.fileCount}</div>
                    <div className="text-xs text-app-muted">Files synced</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 text-app-muted" />
                  <div>
                    <div className="text-lg font-semibold text-app-text">{formatBytes(remoteStats.totalSize)}</div>
                    <div className="text-xs text-app-muted">Original size</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-app-muted" />
                  <div>
                    <div className="text-lg font-semibold text-app-text">{formatBytes(remoteStats.encryptedSize)}</div>
                    <div className="text-xs text-app-muted">Encrypted size</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-app-muted" />
                  <div>
                    <div className="text-lg font-semibold text-app-text">{formatTimeAgo(remoteStats.lastModified)}</div>
                    <div className="text-xs text-app-muted">Last change</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-app-muted">No files synced yet. Save a file to start syncing.</p>
            )}
          </div>
        </>
      )}

      {/* How it works */}
      <div className="bg-app-panel border border-app-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-app-text mb-3">How Sync Works</h3>
        <div className="space-y-2.5 text-sm text-app-muted">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
            <span>All files are encrypted with <strong className="text-app-text">AES-256-GCM</strong> on your device before upload. We never see your data.</span>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCw className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
            <span>Syncs automatically <strong className="text-app-text">on save</strong> (3s debounce) and every <strong className="text-app-text">5 minutes</strong>.</span>
          </div>
          <div className="flex items-start gap-3">
            <FolderSync className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
            <span>Enable sync per workspace. Pull any of them from another device via the <strong className="text-app-text">launcher</strong>.</span>
          </div>
        </div>
      </div>

      {/* Workspace ID (for support/debugging) */}
      {syncEngine.workspaceId && (
        <div className="text-xs text-app-muted px-1">
          Workspace ID: <code className="bg-app-panel px-1.5 py-0.5 rounded">{syncEngine.workspaceId}</code>
        </div>
      )}
    </div>
  );
}
