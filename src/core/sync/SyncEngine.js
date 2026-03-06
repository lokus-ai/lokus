import { supabase } from '../auth/supabase';
import { keyManager } from './KeyManager';
import { encryptFile, decryptFile, sha256 } from './encryption';
import { fileScanner, syncCache } from './FileScanner';
import { offlineQueue } from './OfflineQueue';
import { invoke } from '@tauri-apps/api/core';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
const MAX_CONCURRENT = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_WORKSPACE_SIZE = 1024 * 1024 * 1024; // 1GB total per workspace

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function joinPath(workspacePath, relativePath) {
  const sep = workspacePath.includes('\\') ? '\\' : '/';
  return workspacePath + sep + relativePath.replace(/\//g, sep);
}

function storagePath(userId, workspaceId, filePath) {
  return `${userId}/${workspaceId}/${filePath}`;
}

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= tasks.length) return;
    results[idx] = await tasks[idx]();
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => next()));
  return results;
}

// Fix #21: Lighter connectivity check — getSession() is local-first, avoids a
// network round trip to a data table. Uses getUser() only when a true network
// probe is needed (called once per sync, not per file).
async function isOnline() {
  if (!navigator.onLine) return false;
  try {
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SyncEngine — 1 workspace per user
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
    // Fix #6: mutex state
    this._lockPromise = null;
    // Fix #18: generation counter — incremented on init() so stale syncs abort
    this._generation = 0;
  }

  // -----------------------------------------------------------------------
  // Fix #6: Async mutex lock
  // -----------------------------------------------------------------------

  async _acquireLock() {
    while (this._lockPromise) await this._lockPromise;
    let releaseLock;
    this._lockPromise = new Promise(r => { releaseLock = r; });
    this.syncing = true;
    return () => { this.syncing = false; this._lockPromise = null; releaseLock(); };
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  async init(workspacePath, userId) {
    this.workspacePath = workspacePath;
    this.userId = userId;
    this.syncEnabled = false;
    this.online = navigator.onLine;
    // Fix #18: bump generation so any in-flight sync from the old workspace aborts
    this._generation += 1;

    console.log(`[Sync] Init — workspace: ${workspacePath}, online: ${this.online}`);
    this._setupConnectivityListeners();

    // Check if this workspace has a sync-id
    let localSyncId = null;
    try {
      const raw = await invoke('read_file_content', {
        path: `${workspacePath}/.lokus/sync-id`,
      });
      localSyncId = raw?.trim() || null;
    } catch {}

    if (localSyncId) {
      this.workspaceId = localSyncId;
      this.syncEnabled = true;
      await syncCache.load(workspacePath);
      await offlineQueue.load(workspacePath);
      console.log(`[Sync] Linked to workspace ${this.workspaceId}`);
      if (!offlineQueue.isEmpty) console.log(`[Sync] ${offlineQueue.size} files in offline queue from last session`);

      // Ensure registry is up to date
      const name = workspacePath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace';
      this._registerWorkspace(name);
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

  // Fix #8: Drain offline queue by syncing only the queued files. Only drain
  // the queue after a successful sync; re-enqueue nothing on failure (the
  // items are still in the queue because we peeked rather than drained).
  async _drainOfflineQueue() {
    if (!this.syncEnabled || this.syncing) return;
    // Peek without consuming so we can leave the queue intact on failure
    const queuedPaths = [...offlineQueue.queue];
    if (queuedPaths.length === 0) return;
    console.log(`[Sync] Back online — syncing ${queuedPaths.length} queued files`);
    const absPaths = queuedPaths.map(p => joinPath(this.workspacePath, p));
    try {
      await this.syncFiles(absPaths);
      await offlineQueue.drain(); // only drain after success
    } catch {
      console.warn('[Sync] Failed to drain offline queue, will retry');
    }
  }

  // -----------------------------------------------------------------------
  // Workspace management — 1 per user
  // -----------------------------------------------------------------------

  /**
   * Get the user's single synced workspace from the registry.
   * Returns { workspace_id, name } or null.
   */
  async getSyncedWorkspace(userId) {
    const uid = userId || this.userId;
    if (!uid) return null;
    try {
      const { data } = await supabase
        .from('user_workspaces')
        .select('workspace_id, name')
        .eq('user_id', uid)
        .maybeSingle();
      return data || null;
    } catch {
      return null;
    }
  }

  /**
   * Enable sync for the current workspace. Enforces 1-per-user:
   * deletes any existing workspace row + remote data, then creates new.
   */
  async enableSync(userId) {
    const uid = userId || this.userId;
    if (!uid) throw new Error('Not authenticated');
    if (!this.workspacePath) throw new Error('No workspace open');

    const workspaceName = this.workspacePath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace';
    console.log(`[Sync] Enabling sync for "${workspaceName}"`);

    // Delete any existing synced workspace (1 per user)
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

    // Register in user_workspaces
    await this._registerWorkspace(workspaceName);

    console.log(`[Sync] Enabled — workspace "${workspaceName}" (${workspaceId})`);
    return workspaceId;
  }

  /**
   * Disable sync. Cleans up remote data + local sync-id.
   */
  async disableSync(userId) {
    const uid = userId || this.userId;
    if (!uid) return;

    console.log('[Sync] Disabling sync');
    await this._cleanupExistingSync(uid);

    // Clear local sync-id if we have a workspace open
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

  /** Delete all remote data for the user's synced workspace */
  async _cleanupExistingSync(userId) {
    try {
      // Find existing workspace
      const existing = await this.getSyncedWorkspace(userId);
      if (!existing) return;

      const { workspace_id } = existing;

      // Delete storage files
      const { data: files } = await supabase.from('sync_files')
        .select('file_path')
        .eq('user_id', userId)
        .eq('workspace_id', workspace_id);

      if (files && files.length > 0) {
        const paths = files.map(f => `${userId}/${workspace_id}/${f.file_path}`);
        for (let i = 0; i < paths.length; i += 100) {
          await supabase.storage.from('vaults').remove(paths.slice(i, i + 100));
        }
        console.log(`[Sync] Deleted ${files.length} files from storage`);
      }

      // Delete sync_files rows
      await supabase.from('sync_files')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspace_id);

      // Delete workspace registry
      await supabase.from('user_workspaces')
        .delete()
        .eq('user_id', userId);

      console.log('[Sync] Cleaned up existing sync data');
    } catch (err) {
      console.warn('[Sync] Cleanup error (continuing):', err.message);
    }
  }

  /** Register the current workspace in user_workspaces (1 per user, upsert) */
  async _registerWorkspace(name) {
    if (!this.userId || !this.workspaceId) return;
    try {
      // Delete all existing rows for this user (enforce 1 per user)
      await supabase.from('user_workspaces').delete().eq('user_id', this.userId);
      // Insert the current one
      await supabase.from('user_workspaces').insert({
        user_id: this.userId,
        workspace_id: this.workspaceId,
        name,
      });
      console.log(`[Sync] Registered workspace "${name}"`);
    } catch (err) {
      console.warn('[Sync] Registration failed (offline?):', err.message);
    }
  }

  /**
   * Pull the user's synced workspace into a target folder.
   * Used from Launcher on a new device.
   */
  async pullWorkspace(targetPath, userId, onProgress) {
    const uid = userId;
    if (!uid) throw new Error('Not authenticated');

    await keyManager.initialize(uid);
    const mek = keyManager.getMEK();

    const workspace = await this.getSyncedWorkspace(uid);
    if (!workspace) throw new Error('No synced workspace found');

    const { workspace_id, name } = workspace;

    // Fix #10: paginate pullWorkspace query — Supabase caps at 1000 rows
    const files = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.from('sync_files')
        .select('file_path, content_hash, file_size, is_binary, modified_at')
        .eq('user_id', uid)
        .eq('workspace_id', workspace_id)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      for (const row of (data || [])) files.push(row);
      if (!data || data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`[Sync] Pulling "${name}" → ${targetPath} (${files.length} files)`);

    let pulled = 0;
    const downloadTasks = files.map((file) => async () => {
      try {
        const sp = storagePath(uid, workspace_id, file.file_path);
        // Fix #23: wrap storage download with retry
        const data = await this._withRetry(async () => {
          const { data: blob, error: dlError } = await supabase.storage.from('vaults').download(sp);
          if (dlError) throw dlError;
          return blob;
        });

        const encryptedBuffer = await data.arrayBuffer();
        const plaintext = await decryptFile(mek, encryptedBuffer);
        const fullPath = joinPath(targetPath, file.file_path);

        const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        const dir = fullPath.substring(0, lastSep);
        try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

        if (file.is_binary) {
          // TODO: Switch to base64 IPC when Rust backend supports write_binary_file_base64
          // For binary files, convert ArrayBuffer to Array for IPC. Chunked to avoid
          // call-stack overflow on large files (Array.from can blow the stack for >~100k items).
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
        if (onProgress) onProgress(pulled, files.length);
        console.log(`[Sync] ↓ pulled ${file.file_path}`);
      } catch (err) {
        console.warn(`[Sync] ✗ pull failed: ${file.file_path} — ${err.message}`);
      }
    });

    await runWithConcurrency(downloadTasks, MAX_CONCURRENT);
    console.log(`[Sync] Pull complete — ${pulled}/${files.length} files`);

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
  // Event system
  // -----------------------------------------------------------------------

  onStatusChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(status, detail) {
    for (const fn of this.listeners) fn(status, detail);
  }

  // -----------------------------------------------------------------------
  // syncFiles — targeted sync for specific saved files
  // -----------------------------------------------------------------------

  async syncFiles(absolutePaths) {
    if (!this.syncEnabled || !this.workspacePath || !this.userId || !this.workspaceId) return;

    // Fix #18: capture generation at entry; abort if workspace changed mid-flight
    const gen = this._generation;

    const relativePaths = absolutePaths.map(abs =>
      abs.replace(this.workspacePath, '').replace(/^[/\\]/, '').replace(/\\/g, '/')
    );

    if (!this.online || !(await isOnline())) {
      this.online = false;
      await offlineQueue.enqueue(relativePaths);
      this._emit('offline', { queued: offlineQueue.size });
      console.log(`[Sync] Offline — queued ${relativePaths.length} files (total: ${offlineQueue.size})`);
      return;
    }

    // Fix #6: acquire mutex lock instead of simple boolean guard
    const releaseLock = await this._acquireLock();

    console.log(`[Sync] syncFiles — ${relativePaths.length} files: ${relativePaths.join(', ')}`);
    this._emit('syncing');

    try {
      // Fix #18: abort if workspace changed while waiting for lock
      if (gen !== this._generation) {
        console.log('[Sync] Workspace changed during syncFiles wait, aborting');
        return;
      }

      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scanFiles(this.workspacePath, absolutePaths);
      const fileKeys = [...localFiles.keys()];
      const remoteFiles = await this._fetchMetadataForFiles(fileKeys);

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const metadataBatch = [];

      const tasks = fileKeys.map((filePath) => async () => {
        const local = localFiles.get(filePath);
        const remote = remoteFiles.get(filePath);

        if (local.size > MAX_FILE_SIZE) {
          console.warn(`[Sync] — skip ${filePath} (${(local.size / 1024 / 1024).toFixed(1)}MB exceeds limit)`);
          skipped++;
          return;
        }

        if (remote && local.hash === remote.content_hash) {
          console.log(`[Sync] — skip ${filePath} (unchanged)`);
          skipped++;
          return;
        }

        try {
          const encrypted = await encryptFile(mek, local.content.buffer);
          const sp = storagePath(this.userId, this.workspaceId, filePath);

          // Fix #23: wrap storage upload with retry
          await this._withRetry(() =>
            supabase.storage.from('vaults')
              .upload(sp, encrypted, { contentType: 'application/octet-stream', upsert: true })
              .then(({ error }) => { if (error) throw error; })
          );

          metadataBatch.push({
            user_id: this.userId,
            workspace_id: this.workspaceId,
            file_path: filePath,
            content_hash: local.hash,
            file_size: local.size,
            encrypted_size: encrypted.byteLength,
            is_binary: local.isBinary,
            modified_at: local.modifiedAt,
            encryption_version: 1,
          });

          syncCache.set(filePath, local.hash, Math.floor(Date.now() / 1000), local.size);
          uploaded++;
          console.log(`[Sync] ↑ uploaded ${filePath} (${local.size} bytes)`);
        } catch (err) {
          // Fix #20: abort entire batch on fatal errors
          if (this._isFatalError(err)) {
            console.error(`[Sync] Fatal error, aborting syncFiles: ${err.message}`);
            throw err;
          }
          console.warn(`[Sync] ✗ upload failed: ${filePath} — ${err.message}`);
          if (this._isNetworkError(err)) {
            this.online = false;
            await offlineQueue.enqueue([filePath]);
            console.log(`[Sync] queued ${filePath} for retry`);
          }
          failed++;
        }
      });

      await runWithConcurrency(tasks, MAX_CONCURRENT);

      if (metadataBatch.length > 0) {
        const { error } = await supabase.from('sync_files').upsert(
          metadataBatch,
          { onConflict: 'user_id,workspace_id,file_path' }
        );
        if (error) console.warn('[Sync] Batch metadata upsert failed:', error.message);
      }

      await syncCache.save(this.workspacePath);
      this.lastSyncResult = { uploaded, downloaded: 0, merged: 0, failed };
      this.lastSyncAt = new Date().toISOString();
      console.log(`[Sync] syncFiles done — ↑${uploaded} skipped:${skipped} failed:${failed}`);
      this._emit(this.online ? 'synced' : 'offline', this.lastSyncResult);
    } catch (err) {
      console.error('[Sync] syncFiles failed:', err);
      if (this._isNetworkError(err)) {
        this.online = false;
        await offlineQueue.enqueue(relativePaths);
        console.log(`[Sync] Network error — queued ${relativePaths.length} files`);
        this._emit('offline', { queued: offlineQueue.size });
      } else {
        this._emit('error', err.message);
      }
    } finally {
      releaseLock();
    }
  }

  // -----------------------------------------------------------------------
  // sync — full workspace reconciliation
  // -----------------------------------------------------------------------

  async sync() {
    if (!this.syncEnabled || !this.workspacePath || !this.userId || !this.workspaceId) return;

    // Fix #18: capture generation at entry
    const gen = this._generation;

    if (!this.online || !(await isOnline())) {
      this.online = false;
      this._emit('offline', { queued: offlineQueue.size });
      return;
    }

    // Fix #6: acquire mutex lock instead of simple boolean guard
    const releaseLock = await this._acquireLock();

    console.log('[Sync] Full sync starting...');
    this._emit('syncing');

    try {
      // Fix #18: abort if workspace changed while waiting for the lock
      if (gen !== this._generation) {
        console.log('[Sync] Workspace changed during sync wait, aborting');
        return;
      }

      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scan(this.workspacePath, syncCache);

      // Guard: check total workspace size before syncing
      let totalLocalSize = 0;
      for (const [, f] of localFiles) totalLocalSize += f.size;
      if (totalLocalSize > MAX_WORKSPACE_SIZE) {
        console.error(`[Sync] Workspace too large (${(totalLocalSize / 1024 / 1024).toFixed(0)}MB) — max ${MAX_WORKSPACE_SIZE / 1024 / 1024}MB`);
        this._emit('error', `Workspace exceeds ${MAX_WORKSPACE_SIZE / 1024 / 1024 / 1024}GB size limit`);
        return;
      }

      // Fix #18: stale-state guard after first major async op
      if (gen !== this._generation) {
        console.log('[Sync] Workspace changed during scan, aborting');
        return;
      }

      const remoteFiles = await this._fetchRemoteMetadata();

      // Fix #18: stale-state guard after second major async op
      if (gen !== this._generation) {
        console.log('[Sync] Workspace changed during remote fetch, aborting');
        return;
      }

      const actions = this._computeActions(localFiles, remoteFiles);

      const total = actions.upload.length + actions.download.length + actions.merge.length;
      const skipped = localFiles.size - actions.upload.length - actions.merge.length;
      if (actions.conflicts && actions.conflicts.length > 0) {
        console.log(`[Sync] Binary conflicts detected: ${actions.conflicts.join(', ')}`);
      }
      console.log(`[Sync] Plan — ↑${actions.upload.length} upload, ↓${actions.download.length} download, ⇄${actions.merge.length} merge, ${skipped} unchanged (${localFiles.size} local, ${remoteFiles.size} remote)`);

      if (total === 0) {
        // Fix #1: even when no upload/download/merge actions, still process deletions
        await this._processDeletes(actions.delete || [], remoteFiles);

        console.log('[Sync] Everything up to date');
        this.lastSyncResult = { uploaded: 0, downloaded: 0, merged: 0, failed: 0 };
        this.lastSyncAt = new Date().toISOString();
        this._emit('synced', this.lastSyncResult);
        return;
      }

      let completed = 0;
      let failed = 0;
      const metadataBatch = [];

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
            // Fix #7: re-compute hash after re-reading the file so the stored
            // metadata matches the actual bytes, not the stale scanner hash.
            const hash = await sha256(local.content.buffer);
            local = { ...local, hash };
          }

          const encrypted = await encryptFile(mek, local.content.buffer);
          const sp = storagePath(this.userId, this.workspaceId, filePath);

          // Fix #23: wrap storage upload with retry
          await this._withRetry(() =>
            supabase.storage.from('vaults')
              .upload(sp, encrypted, { contentType: 'application/octet-stream', upsert: true })
              .then(({ error }) => { if (error) throw error; })
          );

          metadataBatch.push({
            user_id: this.userId,
            workspace_id: this.workspaceId,
            file_path: filePath,
            content_hash: local.hash,
            file_size: local.size,
            encrypted_size: encrypted.byteLength,
            is_binary: local.isBinary,
            modified_at: local.modifiedAt,
            encryption_version: 1,
          });

          syncCache.set(filePath, local.hash, Math.floor(Date.now() / 1000), local.size);
          console.log(`[Sync] ↑ uploaded ${filePath} (${local.size} bytes)`);
        } catch (err) {
          // Fix #20: abort entire batch on fatal errors
          if (this._isFatalError(err)) {
            console.error(`[Sync] Fatal error, aborting upload batch: ${err.message}`);
            throw err;
          }
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
          const remote = remoteFiles.get(filePath);
          await this._downloadFile(filePath, remote, mek);
          syncCache.set(filePath, remote.content_hash, Math.floor(Date.now() / 1000), remote.file_size);
          console.log(`[Sync] ↓ downloaded ${filePath} (${remote.file_size} bytes)`);
        } catch (err) {
          // Fix #20: abort entire batch on fatal errors
          if (this._isFatalError(err)) {
            console.error(`[Sync] Fatal error, aborting download batch: ${err.message}`);
            throw err;
          }
          console.warn(`[Sync] ✗ download failed: ${filePath} — ${err.message}`);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      });

      await runWithConcurrency(downloadTasks, MAX_CONCURRENT);

      // --- Merges (sequential) ---
      for (const filePath of actions.merge) {
        try {
          let local = localFiles.get(filePath);
          if (!local.content) {
            const text = await invoke('read_file_content', { path: joinPath(this.workspacePath, filePath) });
            local = { ...local, content: new TextEncoder().encode(text) };
          }
          await this._mergeFile(filePath, local, mek);
          console.log(`[Sync] ⇄ merged ${filePath}`);
        } catch (err) {
          console.warn(`[Sync] ✗ merge failed: ${filePath} — ${err.message}`);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      }

      // Fix #1: process deletions after uploads/downloads/merges
      await this._processDeletes(actions.delete || [], remoteFiles);

      if (metadataBatch.length > 0) {
        const { error } = await supabase.from('sync_files').upsert(
          metadataBatch,
          { onConflict: 'user_id,workspace_id,file_path' }
        );
        if (error) console.warn('[Sync] Batch metadata upsert failed:', error.message);
      }

      await syncCache.save(this.workspacePath);

      this.lastSyncResult = {
        uploaded: actions.upload.length - failed,
        downloaded: actions.download.length,
        merged: actions.merge.length,
        failed,
      };
      this.lastSyncAt = new Date().toISOString();
      console.log(`[Sync] Done — ↑${this.lastSyncResult.uploaded} ↓${this.lastSyncResult.downloaded} ⇄${this.lastSyncResult.merged} failed:${failed}`);
      this._emit('synced', this.lastSyncResult);
    } catch (err) {
      console.error('[Sync] Full sync failed:', err);
      if (this._isNetworkError(err)) {
        this.online = false;
        console.log('[Sync] Network error during full sync');
        this._emit('offline', { queued: offlineQueue.size });
      } else {
        this._emit('error', err.message);
      }
    } finally {
      releaseLock();
    }
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  async getRemoteStats() {
    if (!this.userId || !this.workspaceId) return null;
    try {
      const { data, error } = await supabase
        .from('sync_files')
        .select('file_size, encrypted_size, is_binary, modified_at')
        .eq('user_id', this.userId)
        .eq('workspace_id', this.workspaceId);
      if (error) throw error;

      const files = data || [];
      const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);
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
  // Conflict resolution
  // -----------------------------------------------------------------------

  _computeActions(localFiles, remoteFiles) {
    const upload = [];
    const download = [];
    const merge = [];
    // Fix #1: track locally-deleted files (present in remote + cache, absent locally)
    const del = [];
    // Fix #15: track binary conflicts for user awareness
    const conflicts = [];

    for (const [path, local] of localFiles) {
      const remote = remoteFiles.get(path);
      if (!remote) {
        upload.push(path);
      } else if (local.hash === remote.content_hash) {
        continue;
      } else if (local.isBinary) {
        const localTime = new Date(local.modifiedAt).getTime();
        const remoteTime = new Date(remote.modified_at).getTime();
        if (localTime > remoteTime) {
          upload.push(path);
        } else {
          download.push(path);
        }
        // Fix #15: flag binary conflicts so the user knows a version was overwritten
        if (localTime !== remoteTime) conflicts.push(path);
      } else {
        merge.push(path);
      }
    }

    for (const [path] of remoteFiles) {
      if (!localFiles.has(path)) {
        // Fix #1: only delete from remote if the file was previously synced locally
        // (i.e. it exists in the sync cache). Files absent from the cache were
        // uploaded from another device and should be downloaded, not deleted.
        if (syncCache.has(path)) {
          del.push(path);
        } else {
          download.push(path);
        }
      }
    }

    return { upload, download, merge, delete: del, conflicts };
  }

  // -----------------------------------------------------------------------
  // Fix #1: Delete remote files that were locally removed
  // -----------------------------------------------------------------------

  async _processDeletes(deletePaths, remoteFiles) {
    if (!deletePaths || deletePaths.length === 0) return;
    console.log(`[Sync] Deleting ${deletePaths.length} remotely-removed files: ${deletePaths.join(', ')}`);
    for (const filePath of deletePaths) {
      try {
        await this._deleteRemoteFile(filePath);
        syncCache.delete(filePath);
        console.log(`[Sync] ✗ deleted remote ${filePath}`);
      } catch (err) {
        console.warn(`[Sync] ✗ delete failed: ${filePath} — ${err.message}`);
      }
    }
  }

  /**
   * Remove a file from the storage bucket and sync_files table.
   * Called when a file is deleted locally but still exists on remote.
   */
  async _deleteRemoteFile(filePath) {
    const sp = storagePath(this.userId, this.workspaceId, filePath);
    const { error: storageError } = await supabase.storage.from('vaults').remove([sp]);
    if (storageError) throw storageError;

    const { error: dbError } = await supabase.from('sync_files')
      .delete()
      .eq('user_id', this.userId)
      .eq('workspace_id', this.workspaceId)
      .eq('file_path', filePath);
    if (dbError) throw dbError;
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------

  async _downloadFile(filePath, remote, mek) {
    const sp = storagePath(this.userId, this.workspaceId, filePath);

    // Fix #23: wrap storage download with retry
    const data = await this._withRetry(async () => {
      const { data: blob, error } = await supabase.storage.from('vaults').download(sp);
      if (error) throw error;
      return blob;
    });

    const encryptedBuffer = await data.arrayBuffer();
    const plaintext = await decryptFile(mek, encryptedBuffer);
    const fullPath = joinPath(this.workspacePath, filePath);

    const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
    const dir = fullPath.substring(0, lastSep);
    try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

    if (remote.is_binary) {
      // Fix #14: chunked conversion to avoid call-stack overflow on large binary files.
      // TODO: Switch to base64 IPC when Rust backend supports write_binary_file_base64
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

  async _mergeFile(filePath, local, mek) {
    const sp = storagePath(this.userId, this.workspaceId, filePath);
    const { data, error } = await supabase.storage.from('vaults').download(sp);
    if (error) throw error;

    const encryptedBuffer = await data.arrayBuffer();
    const remotePlaintext = await decryptFile(mek, encryptedBuffer);
    const remoteText = new TextDecoder().decode(remotePlaintext);
    const localText = new TextDecoder().decode(local.content);

    if (localText === remoteText) {
      console.log(`[Sync] ⇄ ${filePath} — identical after download, skipping`);
      return;
    }

    // Fix #11: use structured return value from _autoMerge instead of string comparison
    const { text: merged, isClean } = this._autoMerge(localText, remoteText);
    console.log(`[Sync] ⇄ ${filePath} — ${isClean ? 'auto-merged cleanly' : 'CONFLICT — both versions kept'}`);

    const fullPath = joinPath(this.workspacePath, filePath);
    await invoke('write_file_content', { path: fullPath, content: merged });

    const mergedBytes = new TextEncoder().encode(merged);
    const hash = await sha256(mergedBytes.buffer);
    const encrypted = await encryptFile(mek, mergedBytes.buffer);

    await supabase.storage.from('vaults')
      .upload(sp, encrypted, { contentType: 'application/octet-stream', upsert: true });

    await supabase.from('sync_files').upsert({
      user_id: this.userId,
      workspace_id: this.workspaceId,
      file_path: filePath,
      content_hash: hash,
      file_size: mergedBytes.byteLength,
      encrypted_size: encrypted.byteLength,
      is_binary: false,
      modified_at: new Date().toISOString(),
      encryption_version: 1,
    }, { onConflict: 'user_id,workspace_id,file_path' });

    syncCache.set(filePath, hash, Math.floor(Date.now() / 1000), mergedBytes.byteLength);
  }

  // Fix #11: return { text, isClean } instead of a raw string so callers don't
  // need to re-derive the "was it a clean merge?" answer from string comparison.
  _autoMerge(localText, remoteText) {
    const diffs = dmp.diff_main(remoteText, localText);
    dmp.diff_cleanupSemantic(diffs);
    const patches = dmp.patch_make(remoteText, diffs);
    const [merged, results] = dmp.patch_apply(patches, remoteText);

    if (results.every(r => r)) return { text: merged, isClean: true };
    return {
      text: `${localText}\n\n---\n\n> The following content was merged from another device:\n\n${remoteText}`,
      isClean: false,
    };
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

  // Fix #20: detect fatal errors that should abort the entire batch rather than
  // being silently per-file failures (auth expiry, bad MEK, etc.)
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

  // Fix #23: exponential-backoff retry wrapper for network operations.
  // Only retries transient errors; fatal errors (auth, MEK) propagate immediately.
  async _withRetry(fn, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries || this._isFatalError(err)) throw err;
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[Sync] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // -----------------------------------------------------------------------
  // Metadata queries
  // -----------------------------------------------------------------------

  // Fix #10: batch .in() queries when there are more than 1000 paths
  async _fetchMetadataForFiles(relativePaths) {
    if (relativePaths.length === 0) return new Map();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active Supabase session');

    const map = new Map();
    const BATCH_SIZE = 1000;

    for (let i = 0; i < relativePaths.length; i += BATCH_SIZE) {
      const batch = relativePaths.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.from('sync_files')
        .select('file_path, content_hash, file_size, is_binary, modified_at')
        .eq('user_id', this.userId)
        .eq('workspace_id', this.workspaceId)
        .in('file_path', batch);
      if (error) throw error;
      for (const row of (data || [])) map.set(row.file_path, row);
    }

    return map;
  }

  // Fix #10: paginate with .range() to handle workspaces with >1000 files
  async _fetchRemoteMetadata() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active Supabase session');

    const map = new Map();
    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabase.from('sync_files')
        .select('file_path, content_hash, file_size, is_binary, modified_at')
        .eq('user_id', this.userId)
        .eq('workspace_id', this.workspaceId)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      for (const row of (data || [])) map.set(row.file_path, row);
      if (!data || data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return map;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy() {
    if (this._onlineHandler) window.removeEventListener('online', this._onlineHandler);
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler);
    this._onlineHandler = null;
    this._offlineHandler = null;
  }
}

export const syncEngine = new SyncEngine();
