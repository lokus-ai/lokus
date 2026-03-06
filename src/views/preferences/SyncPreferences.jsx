import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from '../../core/sync/SyncEngine';
import { syncScheduler } from '../../core/sync/SyncScheduler';
import { offlineQueue } from '../../core/sync/OfflineQueue';
import { readRecents } from '../../lib/recents';
import { Cloud, CloudOff, RefreshCw, Shield, HardDrive, Clock, FileText, Loader2, CheckCircle2, AlertTriangle, FolderSync, Power, PowerOff, WifiOff } from 'lucide-react';

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
  const [syncedWorkspace, setSyncedWorkspace] = useState(null); // remote workspace row
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [enabling, setEnabling] = useState(false);

  const recents = readRecents();

  const loadSyncedWorkspace = useCallback(async () => {
    if (!userId) return;
    setLoadingWorkspace(true);
    const ws = await syncEngine.getSyncedWorkspace(userId);
    setSyncedWorkspace(ws);
    setLoadingWorkspace(false);
  }, [userId]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    const stats = await syncEngine.getRemoteStats();
    setRemoteStats(stats);
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    loadSyncedWorkspace();
    loadStats();

    const unsub = syncEngine.onStatusChange((status) => {
      setSyncStatus(status);
      setSyncing(status === 'syncing');
      if (status === 'synced') {
        setTimeout(loadStats, 500);
      }
    });
    return unsub;
  }, [isAuthenticated, isGuest, loadStats, loadSyncedWorkspace]);

  const handleSyncNow = async () => {
    setSyncing(true);
    await syncEngine.sync();
  };

  const handleEnableSync = async (workspacePath) => {
    setEnabling(true);
    try {
      await syncEngine.enableSyncForWorkspace(workspacePath, userId);
      await loadSyncedWorkspace();
      // Trigger a full sync now
      await syncEngine.sync();
      await loadStats();
    } catch (err) {
      console.error('[Sync] Enable failed:', err);
    } finally {
      setEnabling(false);
    }
  };

  const handleDisableSync = async () => {
    try {
      await syncEngine.disableSync(userId);
      setSyncedWorkspace(null);
      setRemoteStats(null);
    } catch (err) {
      console.error('[Sync] Disable failed:', err);
    }
  };

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

      {/* Synced Workspace Selection */}
      <div className="bg-app-panel border border-app-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-app-text mb-4 flex items-center gap-2">
          <FolderSync className="w-4 h-4" />
          Synced Workspace
        </h3>

        {loadingWorkspace ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-app-muted animate-spin" />
          </div>
        ) : syncedWorkspace ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-app-bg rounded-lg border border-app-border">
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <PowerOff className="w-3 h-3" />
                Stop Syncing
              </button>
            </div>

            {/* Option to switch to a different workspace */}
            {recents.length > 1 && (
              <details className="group">
                <summary className="text-xs text-app-muted cursor-pointer hover:text-app-text transition-colors">
                  Switch to a different workspace...
                </summary>
                <div className="mt-2 space-y-1">
                  {recents
                    .filter(r => {
                      const name = r.path.split(/[/\\]/).filter(Boolean).pop();
                      return name !== syncedWorkspace.name;
                    })
                    .map(r => (
                      <button
                        key={r.path}
                        onClick={() => handleEnableSync(r.path)}
                        disabled={enabling}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-app-bg border border-transparent hover:border-app-border transition-colors text-sm text-app-text disabled:opacity-50"
                      >
                        {r.name}
                        <span className="text-xs text-app-muted ml-2">{r.path}</span>
                      </button>
                    ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-app-muted">No workspace is currently synced. Select one to enable cloud sync.</p>
            {recents.length > 0 ? (
              <div className="space-y-1">
                {recents.map(r => (
                  <button
                    key={r.path}
                    onClick={() => handleEnableSync(r.path)}
                    disabled={enabling}
                    className="w-full text-left p-3 rounded-lg hover:bg-app-bg border border-app-border hover:border-app-accent transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-app-accent/10 flex items-center justify-center">
                        <Power className="w-4 h-4 text-app-accent" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-app-text">{r.name}</div>
                        <div className="text-xs text-app-muted">{r.path}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-app-muted">Open a workspace first, then come back here to enable sync.</p>
            )}
          </div>
        )}
      </div>

      {/* Status + Sync Now — only show when sync is active */}
      {syncedWorkspace && (
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
            <span>One workspace per account. Pull it from any device via the <strong className="text-app-text">launcher</strong>.</span>
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
