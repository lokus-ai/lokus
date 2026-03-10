import { supabase } from '../auth/supabase';
import { keyManager } from './KeyManager';
import { encryptFile, decryptFile, sha256 } from './encryption';
import { fileScanner, syncCache } from './FileScanner';
import { offlineQueue } from './OfflineQueue';
import { manifestManager } from './ManifestManager';
import { storageManager } from './StorageManager';
import { workspaceRegistry } from './WorkspaceRegistry';
import { trashManager } from './TrashManager';
import { syncLock } from './SyncLock';
import { invoke } from '@tauri-apps/api/core';
import { MAX_FILE_SIZE, MAX_WORKSPACE_SIZE, MAX_CONCURRENT } from './constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function joinPath(workspacePath, relativePath) {
  const sep = workspacePath.includes('\\') ? '\\' : '/';
  return workspacePath + sep + relativePath.replace(/\//g, sep);
}

async function isOnline() {
  if (!navigator.onLine) return false;
  try {
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= tasks.length) return;
    results[idx] = await tasks[idx]();
    await next();
  }
  return Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => next()))
    .then(() => results);
}

// Cross-window status broadcast key
const STATUS_KEY = 'lokus-sync-status';

// ---------------------------------------------------------------------------
// SyncEngine V2 — orchestrator
// ---------------------------------------------------------------------------

export class SyncEngine {
  constructor() {
    this.workspacePath = null;
    this.workspaceId = null;
    this.userId = null;
    this.syncing = false;
    this.syncEnabled = false;
    this.online = true;
    this.listeners = new Set();
    this.lastSyncResult = null;
    this.lastSyncAt = null;
    this._onlineHandler = null;
    this._offlineHandler = null;
    this._storageHandler = null;
    this._generation = 0;
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  async init(workspacePath, userId) {
    this.workspacePath = workspacePath;
    this.userId = userId;
    this.syncEnabled = false;
    this.online = navigator.onLine;
    this._generation += 1;

    console.log(`[Sync] Init — workspace: ${workspacePath}, online: ${this.online}`);
    this._setupConnectivityListeners();
    this._setupStorageListener();

    // Check local sync-id
    let localSyncId = null;
    try {
      const raw = await invoke('read_file_content', {
        path: `${workspacePath}/.lokus/sync-id`,
      });
      localSyncId = raw?.trim() || null;
    } catch {}

    if (localSyncId) {
      const registered = await this.getSyncedWorkspace(userId);
      if (!registered || registered.workspace_id !== localSyncId) {
        console.log(`[Sync] Local sync-id ${localSyncId} is stale, clearing`);
        try {
          await invoke('write_file_content', {
            path: `${workspacePath}/.lokus/sync-id`,
            content: '',
          });
        } catch {}
        this.workspaceId = null;
        this.syncEnabled = false;
      } else {
        this.workspaceId = localSyncId;
        this.syncEnabled = true;
        await syncCache.load(workspacePath);
        await offlineQueue.load(workspacePath);
        console.log(`[Sync] Linked to workspace ${this.workspaceId}`);
        if (!offlineQueue.isEmpty) {
          console.log(`[Sync] ${offlineQueue.size} files in offline queue`);
        }
      }
    } else {
      console.log('[Sync] No sync configured for this workspace');
    }
  }

  _setupConnectivityListeners() {
    if (this._onlineHandler) window.removeEventListener('online', this._onlineHandler);
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler);

    this._onlineHandler = () => {
      console.log('[Sync] Connection restored');
      this.online = true;
      this._emit('online');
      this._drainOfflineQueue();
    };

    this._offlineHandler = () => {
      console.log('[Sync] Connection lost');
      this.online = false;
      this._emit('offline');
    };

    window.addEventListener('online', this._onlineHandler);
    window.addEventListener('offline', this._offlineHandler);
  }

  _setupStorageListener() {
    if (this._storageHandler) window.removeEventListener('storage', this._storageHandler);

    this._storageHandler = (e) => {
      if (e.key === STATUS_KEY && e.newValue) {
        try {
          const { status, detail } = JSON.parse(e.newValue);
          this._emit(status, detail);
        } catch {}
      }
    };

    window.addEventListener('storage', this._storageHandler);
  }

  _broadcastStatus(status, detail) {
    try {
      localStorage.setItem(STATUS_KEY, JSON.stringify({ status, detail, t: Date.now() }));
    } catch {}
  }

  async _drainOfflineQueue() {
    if (!this.syncEnabled || this.syncing) return;
    const queuedPaths = [...offlineQueue.queue];
    if (queuedPaths.length === 0) return;
    console.log(`[Sync] Back online — syncing ${queuedPaths.length} queued files`);
    const absPaths = queuedPaths.map(p => joinPath(this.workspacePath, p));
    try {
      await this.syncFiles(absPaths);
      await offlineQueue.drain();
    } catch {
      console.warn('[Sync] Failed to drain offline queue, will retry');
    }
  }

  // -----------------------------------------------------------------------
  // Workspace management
  // -----------------------------------------------------------------------

  async getSyncedWorkspace(userId) {
    return workspaceRegistry.getRegistered(userId || this.userId);
  }

  async enableSync(userId) {
    const uid = userId || this.userId;
    if (!uid) throw new Error('Not authenticated');
    if (!this.workspacePath) throw new Error('No workspace open');

    const workspaceName = this.workspacePath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace';
    console.log(`[Sync] Enabling sync for "${workspaceName}"`);

    // Clean up any existing sync data
    await this._cleanupExistingSync(uid);

    // Generate new workspace ID
    const workspaceId = crypto.randomUUID();

    // Write sync-id locally
    try {
      await invoke('create_directory', { path: `${this.workspacePath}/.lokus`, recursive: true });
      await invoke('write_file_content', {
        path: `${this.workspacePath}/.lokus/sync-id`,
        content: workspaceId,
      });
    } catch {}

    this.workspaceId = workspaceId;
    this.syncEnabled = true;
    await syncCache.load(this.workspacePath);
    await offlineQueue.load(this.workspacePath);

    // Register in DB
    await workspaceRegistry.register(uid, workspaceId, workspaceName);

    // Create empty manifest
    await manifestManager.create(uid, workspaceId);

    console.log(`[Sync] Enabled — workspace "${workspaceName}" (${workspaceId})`);
    return workspaceId;
  }

  async disableSync(userId) {
    const uid = userId || this.userId;
    if (!uid) return;

    console.log('[Sync] Disabling sync');
    await this._cleanupExistingSync(uid);

    if (this.workspacePath) {
      try {
        await invoke('write_file_content', {
          path: `${this.workspacePath}/.lokus/sync-id`,
          content: '',
        });
      } catch {}
    }

    this.syncEnabled = false;
    this.workspaceId = null;
    console.log('[Sync] Sync disabled');
  }

  async _cleanupExistingSync(userId) {
    try {
      const existing = await workspaceRegistry.getRegistered(userId);
      if (!existing) return;

      const { workspace_id } = existing;

      // Get file list from manifest to delete storage blobs
      const manifestData = await manifestManager.fetch(userId);
      if (manifestData?.manifest?.files) {
        const filePaths = Object.keys(manifestData.manifest.files);
        await storageManager.deleteWorkspace(userId, workspace_id, filePaths);
        console.log(`[Sync] Deleted ${filePaths.length} files from storage`);
      }

      // Also clean up any old sync_files rows (migration support)
      try {
        const { data: oldFiles } = await supabase.from('sync_files')
          .select('file_path')
          .eq('user_id', userId)
          .eq('workspace_id', workspace_id);
        if (oldFiles && oldFiles.length > 0) {
          const oldPaths = oldFiles.map(f => `${userId}/${workspace_id}/${f.file_path}`);
          for (let i = 0; i < oldPaths.length; i += 100) {
            await supabase.storage.from('vaults').remove(oldPaths.slice(i, i + 100));
          }
          await supabase.from('sync_files')
            .delete()
            .eq('user_id', userId)
            .eq('workspace_id', workspace_id);
        }
      } catch {}

      // Delete manifest
      await manifestManager.delete(userId);

      // Delete workspace registry
      await workspaceRegistry.unregister(userId);

      console.log('[Sync] Cleaned up existing sync data');
    } catch (err) {
      console.warn('[Sync] Cleanup error (continuing):', err.message);
    }
  }

  // -----------------------------------------------------------------------
  // Event system
  // -----------------------------------------------------------------------

  onStatusChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(status, detail) {
    for (const fn of this.listeners) fn(status, detail);
    this._broadcastStatus(status, detail);
  }

  // -----------------------------------------------------------------------
  // syncFiles — incremental on-save
  // -----------------------------------------------------------------------

  async syncFiles(absolutePaths) {
    if (!this.syncEnabled || !this.workspacePath || !this.userId || !this.workspaceId) return;

    const gen = this._generation;

    const relativePaths = absolutePaths.map(abs =>
      abs.replace(this.workspacePath, '').replace(/^[/\\]/, '').replace(/\\/g, '/')
    );

    if (!this.online || !(await isOnline())) {
      this.online = false;
      await offlineQueue.enqueue(relativePaths);
      this._emit('offline', { queued: offlineQueue.size });
      console.log(`[Sync] Offline — queued ${relativePaths.length} files`);
      return;
    }

    if (!syncLock.acquire(this.workspaceId)) {
      console.log('[Sync] Another window is syncing, skipping');
      return;
    }

    this.syncing = true;
    console.log(`[Sync] syncFiles — ${relativePaths.length} files`);
    this._emit('syncing');

    try {
      if (gen !== this._generation) return;

      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scanFiles(this.workspacePath, absolutePaths);

      // Fetch current manifest
      const manifestData = await manifestManager.fetch(this.userId);
      const remoteManifest = manifestData?.manifest || { files: {} };
      const manifestVersion = manifestData?.version || 0;

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const uploadedPaths = [];

      const tasks = [...localFiles.keys()].map((filePath) => async () => {
        const local = localFiles.get(filePath);

        if (local.size > MAX_FILE_SIZE) {
          console.warn(`[Sync] Skip ${filePath} (exceeds size limit)`);
          skipped++;
          return;
        }

        const remote = remoteManifest.files?.[filePath];
        if (remote && local.hash === remote.hash) {
          skipped++;
          return;
        }

        try {
          const encrypted = await encryptFile(mek, local.content.buffer);
          await storageManager.uploadFile(this.userId, this.workspaceId, filePath, encrypted);

          local.encryptedSize = encrypted.byteLength;
          uploadedPaths.push(filePath);
          syncCache.set(filePath, local.hash, Math.floor(Date.now() / 1000), local.size);
          uploaded++;
          console.log(`[Sync] ↑ ${filePath} (${local.size}B)`);
        } catch (err) {
          if (this._isFatalError(err)) throw err;
          console.warn(`[Sync] ✗ upload failed: ${filePath} — ${err.message}`);
          if (this._isNetworkError(err)) {
            this.online = false;
            await offlineQueue.enqueue([filePath]);
          }
          failed++;
        }
      });

      await runWithConcurrency(tasks, MAX_CONCURRENT);

      // Update manifest if anything was uploaded
      if (uploadedPaths.length > 0) {
        const newManifest = manifestManager.buildManifest(
          this.workspaceId, localFiles, uploadedPaths, [], [], remoteManifest
        );
        const ok = await manifestManager.update(this.userId, this.workspaceId, newManifest, manifestVersion);
        if (!ok) {
          console.warn('[Sync] Manifest version conflict, will retry next cycle');
          await this._savePendingManifest(newManifest);
        }
      }

      await syncCache.save(this.workspacePath);
      this.lastSyncResult = { uploaded, downloaded: 0, deleted: 0, failed };
      this.lastSyncAt = new Date().toISOString();
      console.log(`[Sync] syncFiles done — ↑${uploaded} skip:${skipped} fail:${failed}`);
      this._emit(this.online ? 'synced' : 'offline', this.lastSyncResult);
    } catch (err) {
      console.error('[Sync] syncFiles failed:', err);
      if (this._isNetworkError(err)) {
        this.online = false;
        await offlineQueue.enqueue(relativePaths);
        this._emit('offline', { queued: offlineQueue.size });
      } else {
        this._emit('error', err.message);
      }
    } finally {
      this.syncing = false;
      syncLock.release(this.workspaceId);
    }
  }

  // -----------------------------------------------------------------------
  // sync — full workspace reconciliation
  // -----------------------------------------------------------------------

  async sync() {
    if (!this.syncEnabled || !this.workspacePath || !this.userId || !this.workspaceId) return;

    const gen = this._generation;

    if (!this.online || !(await isOnline())) {
      this.online = false;
      this._emit('offline', { queued: offlineQueue.size });
      return;
    }

    if (!syncLock.acquire(this.workspaceId)) {
      console.log('[Sync] Another window is syncing, skipping');
      return;
    }

    this.syncing = true;
    console.log('[Sync] Full sync starting...');
    this._emit('syncing');

    try {
      if (gen !== this._generation) return;

      // Try to push any pending manifest from a previous failed update
      await this._pushPendingManifest();

      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scan(this.workspacePath, syncCache);

      // Guard: check total workspace size
      let totalLocalSize = 0;
      for (const [, f] of localFiles) totalLocalSize += f.size;
      if (totalLocalSize > MAX_WORKSPACE_SIZE) {
        console.error(`[Sync] Workspace too large (${(totalLocalSize / 1024 / 1024).toFixed(0)}MB)`);
        this._emit('error', `Workspace exceeds ${MAX_WORKSPACE_SIZE / 1024 / 1024 / 1024}GB size limit`);
        return;
      }

      if (gen !== this._generation) return;

      // Fetch manifest
      const manifestData = await manifestManager.fetch(this.userId);
      const remoteManifest = manifestData?.manifest || { files: {} };
      const manifestVersion = manifestData?.version || 0;

      if (gen !== this._generation) return;

      // Diff
      const actions = manifestManager.diff(localFiles, remoteManifest, syncCache);
      const total = actions.upload.length + actions.download.length + actions.delete.length;
      console.log(`[Sync] Plan — ↑${actions.upload.length} ↓${actions.download.length} ✗${actions.delete.length} skip:${actions.skip.length}`);

      if (total === 0) {
        console.log('[Sync] Everything up to date');
        this.lastSyncResult = { uploaded: 0, downloaded: 0, deleted: 0, failed: 0 };
        this.lastSyncAt = new Date().toISOString();
        this._emit('synced', this.lastSyncResult);
        // Cleanup old trash on idle syncs
        trashManager.cleanupOldTrash(this.workspacePath).catch(() => {});
        return;
      }

      let completed = 0;
      let failed = 0;
      const uploadedPaths = [];

      // --- Uploads ---
      const uploadTasks = actions.upload.map((filePath) => async () => {
        try {
          let local = localFiles.get(filePath);
          if (!local.content) {
            const absPath = joinPath(this.workspacePath, filePath);
            if (local.isBinary) {
              const raw = await invoke('read_binary_file', { path: absPath });
              local = { ...local, content: new Uint8Array(raw) };
            } else {
              const text = await invoke('read_file_content', { path: absPath });
              local = { ...local, content: new TextEncoder().encode(text) };
            }
            const hash = await sha256(local.content.buffer);
            local = { ...local, hash };
          }

          const encrypted = await encryptFile(mek, local.content.buffer);
          await storageManager.uploadFile(this.userId, this.workspaceId, filePath, encrypted);

          local.encryptedSize = encrypted.byteLength;
          localFiles.set(filePath, local); // update for manifest building
          uploadedPaths.push(filePath);
          syncCache.set(filePath, local.hash, Math.floor(Date.now() / 1000), local.size);
          console.log(`[Sync] ↑ ${filePath} (${local.size}B)`);
        } catch (err) {
          if (this._isFatalError(err)) throw err;
          console.warn(`[Sync] ✗ upload failed: ${filePath} — ${err.message}`);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      });

      await runWithConcurrency(uploadTasks, MAX_CONCURRENT);

      // --- Downloads ---
      const downloadTasks = actions.download.map((filePath) => async () => {
        try {
          const remote = remoteManifest.files[filePath];
          await this._downloadFile(filePath, remote, mek);
          syncCache.set(filePath, remote.hash, Math.floor(Date.now() / 1000), remote.size);
          console.log(`[Sync] ↓ ${filePath} (${remote.size}B)`);
        } catch (err) {
          if (this._isFatalError(err)) throw err;
          console.warn(`[Sync] ✗ download failed: ${filePath} — ${err.message}`);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      });

      await runWithConcurrency(downloadTasks, MAX_CONCURRENT);

      // --- Deletes ---
      for (const filePath of actions.delete) {
        try {
          await trashManager.moveToTrash(this.workspacePath, filePath);
          await storageManager.deleteFile(this.userId, this.workspaceId, filePath);
          syncCache.delete(filePath);
          console.log(`[Sync] ✗ deleted ${filePath}`);
        } catch (err) {
          console.warn(`[Sync] ✗ delete failed: ${filePath} — ${err.message}`);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      }

      // --- Update manifest ---
      const newManifest = manifestManager.buildManifest(
        this.workspaceId, localFiles, uploadedPaths, actions.download, actions.delete, remoteManifest
      );

      let manifestOk = await manifestManager.update(this.userId, this.workspaceId, newManifest, manifestVersion);
      if (!manifestOk) {
        // Version conflict — re-fetch, re-diff, retry once
        console.warn('[Sync] Manifest version conflict, retrying...');
        const freshData = await manifestManager.fetch(this.userId);
        if (freshData) {
          manifestOk = await manifestManager.update(this.userId, this.workspaceId, newManifest, freshData.version);
        }
        if (!manifestOk) {
          console.warn('[Sync] Manifest update failed, saving pending');
          await this._savePendingManifest(newManifest);
        }
      }

      await syncCache.save(this.workspacePath);

      // Cleanup old trash
      trashManager.cleanupOldTrash(this.workspacePath).catch(() => {});

      this.lastSyncResult = {
        uploaded: uploadedPaths.length,
        downloaded: actions.download.length - failed,
        deleted: actions.delete.length,
        failed,
      };
      this.lastSyncAt = new Date().toISOString();
      console.log(`[Sync] Done — ↑${this.lastSyncResult.uploaded} ↓${this.lastSyncResult.downloaded} ✗${this.lastSyncResult.deleted} fail:${failed}`);
      this._emit('synced', this.lastSyncResult);
    } catch (err) {
      console.error('[Sync] Full sync failed:', err);
      if (this._isNetworkError(err)) {
        this.online = false;
        this._emit('offline', { queued: offlineQueue.size });
      } else {
        this._emit('error', err.message);
      }
    } finally {
      this.syncing = false;
      syncLock.release(this.workspaceId);
    }
  }

  // -----------------------------------------------------------------------
  // Stats — derived from manifest instead of DB query
  // -----------------------------------------------------------------------

  async getRemoteStats() {
    if (!this.userId) return null;
    try {
      const data = await manifestManager.fetch(this.userId);
      if (!data?.manifest?.files) return null;

      const files = Object.values(data.manifest.files);
      const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
      const encryptedSize = files.reduce((sum, f) => sum + (f.encrypted_size || 0), 0);
      const lastModified = files.length
        ? files.reduce((max, f) => (f.modified_at > max ? f.modified_at : max), files[0].modified_at)
        : null;

      return { fileCount: files.length, totalSize, encryptedSize, lastModified };
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Pull workspace (download to new device)
  // -----------------------------------------------------------------------

  async pullWorkspace(targetPath, userId, onProgress) {
    const uid = userId;
    if (!uid) throw new Error('Not authenticated');

    await keyManager.initialize(uid);
    const mek = keyManager.getMEK();

    const workspace = await workspaceRegistry.getRegistered(uid);
    if (!workspace) throw new Error('No synced workspace found');

    const { workspace_id, name } = workspace;

    // Fetch manifest for file list
    const manifestData = await manifestManager.fetch(uid);
    if (!manifestData?.manifest?.files) throw new Error('No files in manifest');

    const fileEntries = Object.entries(manifestData.manifest.files);
    console.log(`[Sync] Pulling "${name}" → ${targetPath} (${fileEntries.length} files)`);

    let pulled = 0;
    const downloadTasks = fileEntries.map(([filePath, fileMeta]) => async () => {
      try {
        const blob = await storageManager.downloadFile(uid, workspace_id, filePath);
        const encryptedBuffer = await blob.arrayBuffer();
        const plaintext = await decryptFile(mek, encryptedBuffer);
        const fullPath = joinPath(targetPath, filePath);

        const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        const dir = fullPath.substring(0, lastSep);
        try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

        if (fileMeta.is_binary) {
          const bytes = new Uint8Array(plaintext);
          const chunks = [];
          for (let i = 0; i < bytes.length; i += 8192) {
            chunks.push(...bytes.slice(i, i + 8192));
          }
          await invoke('write_binary_file', { path: fullPath, content: chunks });
        } else {
          const text = new TextDecoder().decode(plaintext);
          await invoke('write_file_content', { path: fullPath, content: text });
        }
        pulled++;
        if (onProgress) onProgress(pulled, fileEntries.length);
      } catch (err) {
        console.warn(`[Sync] ✗ pull failed: ${filePath} — ${err.message}`);
      }
    });

    await runWithConcurrency(downloadTasks, MAX_CONCURRENT);
    console.log(`[Sync] Pull complete — ${pulled}/${fileEntries.length} files`);

    // Write sync-id so this folder is linked
    try {
      await invoke('create_directory', { path: `${targetPath}/.lokus`, recursive: true });
      await invoke('write_file_content', {
        path: `${targetPath}/.lokus/sync-id`,
        content: workspace_id,
      });
    } catch {}

    return name;
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------

  async _downloadFile(filePath, remote, mek) {
    const blob = await storageManager.downloadFile(this.userId, this.workspaceId, filePath);
    const encryptedBuffer = await blob.arrayBuffer();
    const plaintext = await decryptFile(mek, encryptedBuffer);
    const fullPath = joinPath(this.workspacePath, filePath);

    const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
    const dir = fullPath.substring(0, lastSep);
    try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

    if (remote.is_binary) {
      const bytes = new Uint8Array(plaintext);
      const chunks = [];
      for (let i = 0; i < bytes.length; i += 8192) {
        chunks.push(...bytes.slice(i, i + 8192));
      }
      await invoke('write_binary_file', { path: fullPath, content: chunks });
    } else {
      const text = new TextDecoder().decode(plaintext);
      await invoke('write_file_content', { path: fullPath, content: text });
    }
  }

  // -----------------------------------------------------------------------
  // Pending manifest (failure recovery)
  // -----------------------------------------------------------------------

  async _savePendingManifest(manifest) {
    try {
      await invoke('write_file_content', {
        path: `${this.workspacePath}/.lokus/pending-manifest.json`,
        content: JSON.stringify(manifest),
      });
    } catch {}
  }

  async _pushPendingManifest() {
    try {
      const raw = await invoke('read_file_content', {
        path: `${this.workspacePath}/.lokus/pending-manifest.json`,
      });
      if (!raw) return;
      const pending = JSON.parse(raw);

      const current = await manifestManager.fetch(this.userId);
      const version = current?.version || 0;
      const ok = await manifestManager.update(this.userId, this.workspaceId, pending, version);
      if (ok) {
        console.log('[Sync] Pushed pending manifest');
        try {
          await invoke('write_file_content', {
            path: `${this.workspacePath}/.lokus/pending-manifest.json`,
            content: '',
          });
        } catch {}
      }
    } catch {
      // No pending manifest or push failed — continue
    }
  }

  // -----------------------------------------------------------------------
  // Network helpers
  // -----------------------------------------------------------------------

  _isNetworkError(err) {
    const msg = (err?.message || '').toLowerCase();
    return (
      !navigator.onLine ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('err_internet') ||
      msg.includes('socket') ||
      err?.code === 'NETWORK_ERROR'
    );
  }

  _isFatalError(err) {
    const msg = (err?.message || '').toLowerCase();
    return (
      msg.includes('not authenticated') ||
      msg.includes('encryption not initialized') ||
      msg.includes('jwt expired') ||
      msg.includes('invalid token') ||
      err?.status === 401
    );
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy() {
    if (this._onlineHandler) window.removeEventListener('online', this._onlineHandler);
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler);
    if (this._storageHandler) window.removeEventListener('storage', this._storageHandler);
    this._onlineHandler = null;
    this._offlineHandler = null;
    this._storageHandler = null;
    syncLock.release(this.workspaceId);
  }
}

export const syncEngine = new SyncEngine();
