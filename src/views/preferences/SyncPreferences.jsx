import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from '../../core/sync/SyncEngine';
import { keyManager } from '../../core/sync/KeyManager';
import { offlineQueue } from '../../core/sync/OfflineQueue';
import { workspaceRegistry } from '../../core/sync/WorkspaceRegistry';
import { Cloud, CloudOff, RefreshCw, Shield, HardDrive, Clock, FileText, Loader2, CheckCircle2, AlertTriangle, FolderSync, WifiOff } from 'lucide-react';

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

function formatCooldown(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function SyncPreferences({ isAuthenticated, isGuest, userId, workspacePath: workspacePathProp }) {
  const [syncStatus, setSyncStatus] = useState('idle');
  const [remoteStats, setRemoteStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [syncedWorkspace, setSyncedWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [cooldown, setCooldown] = useState(null); // { canSwitch, remainingMs }

  const effectivePath = syncEngine.workspacePath || workspacePathProp || null;

  const currentWorkspaceName = effectivePath
    ? effectivePath.split(/[/\\]/).filter(Boolean).pop()
    : 'this workspace';

  const isSyncedHere = syncEngine.syncEnabled;

  const loadData = useCallback(async () => {
    if (!syncEngine.workspacePath && workspacePathProp && userId) {
      await syncEngine.init(workspacePathProp, userId);
      await keyManager.initialize(userId);
    }
    setLoading(true);
    const ws = await syncEngine.getSyncedWorkspace(userId);
    setSyncedWorkspace(ws);

    // Check cooldown if there's a registered workspace and this isn't the synced one
    if (ws && !syncEngine.syncEnabled) {
      const cd = await workspaceRegistry.checkCooldown(userId);
      setCooldown(cd);
    } else {
      setCooldown(null);
    }

    if (syncEngine.syncEnabled) {
      setLoadingStats(true);
      const stats = await syncEngine.getRemoteStats();
      setRemoteStats(stats);
      setLoadingStats(false);
    }
    setLoading(false);
  }, [userId, workspacePathProp]);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    loadData();

    const unsub = syncEngine.onStatusChange((status, detail) => {
      setSyncStatus(status);
      setSyncing(status === 'syncing');
      if (status === 'error') setErrorMessage(detail);
      if (status !== 'error') setErrorMessage(null);
      if (status === 'synced') {
        setTimeout(async () => {
          const stats = await syncEngine.getRemoteStats();
          setRemoteStats(stats);
        }, 500);
      }
    });
    return unsub;
  }, [isAuthenticated, isGuest, loadData]);

  const handleEnableSync = async () => {
    // Check cooldown when switching workspaces
    if (syncedWorkspace && !isSyncedHere) {
      const cd = await workspaceRegistry.checkCooldown(userId);
      if (!cd.canSwitch) {
        setCooldown(cd);
        return;
      }
    }

    setEnabling(true);
    try {
      await syncEngine.enableSync(userId);
      await syncEngine.sync();
      await loadData();
    } catch (err) {
      console.error('[Sync] Enable failed:', err);
    } finally {
      setEnabling(false);
    }
  };

  const handleDisableSync = async () => {
    setDisabling(true);
    try {
      await syncEngine.disableSync(userId);
      setSyncedWorkspace(null);
      setRemoteStats(null);
    } catch (err) {
      console.error('[Sync] Disable failed:', err);
    } finally {
      setDisabling(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    await syncEngine.sync();
  };

  // --- Not authenticated ---
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-2">Sync</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-app-muted animate-spin" />
        </div>
      </div>
    );
  }

  // --- Status config ---
  const statusConfig = {
    idle: { icon: Cloud, color: 'text-app-muted', label: 'Idle' },
    syncing: { icon: Loader2, color: 'text-blue-500', label: 'Syncing...' },
    synced: { icon: CheckCircle2, color: 'text-green-500', label: 'Synced' },
    error: { icon: AlertTriangle, color: 'text-amber-500', label: 'Error' },
    offline: { icon: WifiOff, color: 'text-orange-500', label: `Offline${offlineQueue.size > 0 ? ` (${offlineQueue.size} queued)` : ''}` },
    online: { icon: Cloud, color: 'text-green-500', label: 'Back online' },
  }[syncStatus] || { icon: Cloud, color: 'text-app-muted', label: 'Idle' };

  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-app-text mb-2">Sync</h1>
        <p className="text-app-text-secondary">
          Sync one workspace across your devices with end-to-end encryption.
        </p>
      </div>

      {/* ================================================================ */}
      {/* STATE 1: No sync enabled anywhere */}
      {/* ================================================================ */}
      {!syncedWorkspace && (
        <div className="bg-app-panel border border-app-border rounded-xl p-6">
          <div className="text-center">
            <Cloud className="w-12 h-12 text-app-muted mx-auto mb-4" />
            {effectivePath ? (
              <>
                <p className="text-app-text font-medium mb-2">Sync is not enabled</p>
                <p className="text-app-muted text-sm mb-6">
                  Enable sync to upload "{currentWorkspaceName}" to the cloud and access it from any device.
                </p>
                <button
                  onClick={handleEnableSync}
                  disabled={enabling}
                  className="px-6 py-2.5 bg-app-accent text-app-accent-fg rounded-lg hover:bg-app-accent/90 transition-colors font-medium disabled:opacity-50"
                >
                  {enabling ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enabling...
                    </span>
                  ) : (
                    `Enable Sync for "${currentWorkspaceName}"`
                  )}
                </button>
              </>
            ) : (
              <>
                <p className="text-app-text font-medium mb-2">No workspace open</p>
                <p className="text-app-muted text-sm">Open a workspace first to enable sync.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STATE 2: Sync enabled & this is the synced workspace */}
      {/* ================================================================ */}
      {syncedWorkspace && isSyncedHere && (
        <>
          {/* Current synced workspace */}
          <div className="bg-app-panel border border-app-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-app-text mb-3 flex items-center gap-2">
              <FolderSync className="w-4 h-4" />
              Synced Workspace
            </h3>
            <div className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-app-text">{syncedWorkspace.name}</div>
                  <div className="text-xs text-app-muted">Currently synced</div>
                </div>
              </div>
              <button
                onClick={handleDisableSync}
                disabled={disabling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                {disabling ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudOff className="w-3 h-3" />}
                {disabling ? 'Stopping...' : 'Stop Syncing'}
              </button>
            </div>
          </div>

          {/* Sync status + Sync Now */}
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
                  <span>↑ {syncEngine.lastSyncResult.uploaded} uploaded</span>
                )}
                {syncEngine.lastSyncResult.downloaded > 0 && (
                  <span>↓ {syncEngine.lastSyncResult.downloaded} downloaded</span>
                )}
                {syncEngine.lastSyncResult.deleted > 0 && (
                  <span>✗ {syncEngine.lastSyncResult.deleted} deleted</span>
                )}
                {syncEngine.lastSyncResult.uploaded === 0 && syncEngine.lastSyncResult.downloaded === 0 && (syncEngine.lastSyncResult.deleted || 0) === 0 && (
                  <span>Everything up to date</span>
                )}
              </div>
            )}

            {syncStatus === 'error' && errorMessage && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-500">{errorMessage}</p>
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

      {/* ================================================================ */}
      {/* STATE 3: Sync enabled but for a DIFFERENT workspace (read-only) */}
      {/* ================================================================ */}
      {syncedWorkspace && !isSyncedHere && (
        <div className="bg-app-panel border border-app-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <FolderSync className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-app-text mb-1">
                Syncing "{syncedWorkspace.name}"
              </p>
              <p className="text-sm text-app-muted mb-1">
                Open "{syncedWorkspace.name}" to manage sync settings.
              </p>
              {cooldown && !cooldown.canSwitch && (
                <p className="text-xs text-amber-500 mt-2">
                  You switched recently. Try again in {formatCooldown(cooldown.remainingMs)}.
                </p>
              )}
            </div>
          </div>
        </div>
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
            <span>One workspace per account. Pull it from any device via the <strong className="text-app-text">launcher</strong>.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
