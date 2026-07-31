import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from '../../core/sync/SyncEngine';
import { keyManager } from '../../core/sync/KeyManager';
import { offlineQueue } from '../../core/sync/OfflineQueue';
import { workspaceRegistry } from '../../core/sync/WorkspaceRegistry';
import * as P from './primitives.jsx';

/**
 * Props:
 *   isAuthenticated  {boolean}  signed in with a real account
 *   isGuest          {boolean}  signed in as guest — sync unavailable
 *   userId           {string}   Supabase user id
 *   workspacePath    {string}   absolute path of the open workspace
 *
 * Unchanged from before this file was restyled.
 */

/** A read-only value — a count, a size, a duration. Mono, because it is data. */
function Value({ children }) {
  return (
    <span className="font-mono text-[12px] tabular-nums text-app-text-secondary">{children}</span>
  );
}

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

  const lede = 'One workspace, encrypted on this device before it leaves it, readable on every device you sign in from.';

  // --- Not signed in, or signed in as a guest ---
  if (!isAuthenticated || isGuest) {
    return (
      <P.Page title="Sync" lede={lede}>
        <P.Empty>Sign in from Account to sync a workspace to the cloud.</P.Empty>
      </P.Page>
    );
  }

  if (loading) {
    return (
      <P.Page title="Sync" lede={lede}>
        <P.Empty>Checking what is synced…</P.Empty>
      </P.Page>
    );
  }

  const statusLabel = {
    idle: 'Idle',
    syncing: 'Syncing…',
    synced: 'Up to date',
    error: 'Stopped on an error',
    offline: `Offline${offlineQueue.size > 0 ? ` · ${offlineQueue.size} queued` : ''}`,
    online: 'Back online',
  }[syncStatus] || 'Idle';

  const result = syncEngine.lastSyncResult;
  const resultParts = [];
  if (result) {
    if (result.uploaded > 0) resultParts.push(`${result.uploaded} up`);
    if (result.downloaded > 0) resultParts.push(`${result.downloaded} down`);
    if (result.deleted > 0) resultParts.push(`${result.deleted} removed`);
  }

  return (
    <P.Page title="Sync" lede={lede}>
      {/* ---------------------------------------------------------------- */}
      {/* State 1 — nothing is synced on this account yet                   */}
      {/* ---------------------------------------------------------------- */}
      {!syncedWorkspace && (
        <P.Group label="Workspace">
          {effectivePath ? (
            <>
              <P.Empty>
                Nothing is syncing yet. Start with{' '}
                <span className="font-mono text-[12.5px] text-app-text">{currentWorkspaceName}</span>{' '}
                and it will be encrypted here, then available wherever you sign in.
              </P.Empty>
              <div className="flex items-center gap-2 pt-3">
                <P.Button tone="primary" onClick={handleEnableSync} disabled={enabling}>
                  {enabling ? 'Starting…' : 'Start syncing this workspace'}
                </P.Button>
              </div>
            </>
          ) : (
            <P.Empty>Open a workspace, then come back here to sync it.</P.Empty>
          )}
        </P.Group>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* State 2 — this workspace is the synced one                        */}
      {/* ---------------------------------------------------------------- */}
      {syncedWorkspace && isSyncedHere && (
        <>
          <P.Group label="Workspace">
            <P.Row label="Syncing">
              <Value>{syncedWorkspace.name}</Value>
            </P.Row>
            <P.Row
              label="Status"
              hint={
                syncEngine.lastSyncAt ? (
                  <>Last run <span className="font-mono tabular-nums">{formatTimeAgo(syncEngine.lastSyncAt)}</span></>
                ) : (
                  'Has not run yet'
                )
              }
            >
              <div className="flex items-center gap-3">
                <Value>{statusLabel}</Value>
                <P.Button onClick={handleSyncNow} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </P.Button>
              </div>
            </P.Row>
            {result && (
              <P.Row label="Last run">
                <Value>{resultParts.length > 0 ? resultParts.join(' · ') : 'Nothing to move'}</Value>
              </P.Row>
            )}
            {syncStatus === 'error' && errorMessage && (
              <P.Note tone="danger">{errorMessage} Sync again once it is resolved.</P.Note>
            )}
          </P.Group>

          <P.Group label="In the cloud">
            {loadingStats ? (
              <P.Empty>Reading the manifest…</P.Empty>
            ) : remoteStats ? (
              <>
                <P.Row label="Files">
                  <Value>{remoteStats.fileCount}</Value>
                </P.Row>
                <P.Row label="Size on disk">
                  <Value>{formatBytes(remoteStats.totalSize)}</Value>
                </P.Row>
                <P.Row label="Size encrypted">
                  <Value>{formatBytes(remoteStats.encryptedSize)}</Value>
                </P.Row>
                <P.Row label="Newest change">
                  <Value>{formatTimeAgo(remoteStats.lastModified)}</Value>
                </P.Row>
              </>
            ) : (
              <P.Empty>Nothing uploaded yet. Save a file and it will go up within a few seconds.</P.Empty>
            )}
          </P.Group>

          <P.Group label="Stop">
            <P.ActionRow
              label={disabling ? 'Stopping…' : 'Stop syncing this workspace'}
              hint="Deletes the encrypted copy and the manifest from the cloud. Your local files are untouched."
              tone="danger"
              onClick={handleDisableSync}
              disabled={disabling}
            />
          </P.Group>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* State 3 — a different workspace holds the sync slot (read-only)   */}
      {/* ---------------------------------------------------------------- */}
      {syncedWorkspace && !isSyncedHere && (
        <P.Group label="Workspace">
          <P.Empty>
            Sync belongs to{' '}
            <span className="font-mono text-[12.5px] text-app-text">{syncedWorkspace.name}</span>.
            One account syncs one workspace, so open that one to change its settings.
          </P.Empty>
          {cooldown && !cooldown.canSwitch && (
            <P.Note>
              Sync can move to another workspace again in{' '}
              <span className="font-mono tabular-nums">{formatCooldown(cooldown.remainingMs)}</span>.
            </P.Note>
          )}
        </P.Group>
      )}

      <P.Group
        label="How it works"
        hint={
          <>
            Files are encrypted with <span className="font-mono">AES-256-GCM</span> on this device, so the
            server only ever holds ciphertext. Lokus syncs three seconds after a save and again every five
            minutes. To bring the workspace onto another machine, pull it from the launcher.
          </>
        }
      />
    </P.Page>
  );
}
