import { supabase } from '../auth/supabase';
import { keyManager } from './KeyManager';
import { encryptFile, decryptFile, sha256 } from './encryption';
import { fileScanner, syncCache } from './FileScanner';
import { offlineQueue } from './OfflineQueue';
import { invoke } from '@tauri-apps/api/core';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
const MAX_CONCURRENT = 3;

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

/** Quick connectivity check — tries to reach Supabase */
async function isOnline() {
  if (!navigator.onLine) return false;
  try {
    const { error } = await supabase.from('user_workspaces').select('user_id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SyncEngine
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
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  async init(workspacePath, userId) {
    this.workspacePath = workspacePath;
    this.userId = userId;
    this.syncEnabled = false;
    this.online = navigator.onLine;

    console.log(`[Sync] Init — workspace: ${workspacePath}, online: ${this.online}`);

    this._setupConnectivityListeners();

    const remoteWorkspace = await this.getSyncedWorkspace(userId).catch(() => null);

    let localSyncId = null;
    try {
      const raw = await invoke('read_file_content', {
        path: `${workspacePath}/.lokus/sync-id`,
      });
      localSyncId = raw?.trim() || null;
    } catch {}

    if (remoteWorkspace && localSyncId === remoteWorkspace.workspace_id) {
      this.workspaceId = remoteWorkspace.workspace_id;
      this.syncEnabled = true;
      await syncCache.load(workspacePath);
      await offlineQueue.load(workspacePath);
      console.log(`[Sync] Linked to remote workspace "${remoteWorkspace.name}" (${this.workspaceId})`);
      if (!offlineQueue.isEmpty) console.log(`[Sync] ${offlineQueue.size} files in offline queue from last session`);
    } else if (!remoteWorkspace && localSyncId) {
      this.workspaceId = localSyncId;
      this.syncEnabled = true;
      const workspaceName = workspacePath.split(/[/\\]/).filter(Boolean).pop();
      await this._registerWorkspace(workspaceName);
      await syncCache.load(workspacePath);
      await offlineQueue.load(workspacePath);
      console.log(`[Sync] Registered new workspace "${workspaceName}" (${this.workspaceId})`);
    } else {
      console.log('[Sync] No sync configured for this workspace');
    }
  }

  _setupConnectivityListeners() {
    // Clean up old listeners
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

  /**
   * When we come back online, drain the offline queue then do a full sync
   * to reconcile with anything the other device pushed while we were offline.
   */
  async _drainOfflineQueue() {
    if (!this.syncEnabled || this.syncing) return;

    const queuedPaths = await offlineQueue.drain();
    if (queuedPaths.length > 0) {
      console.log(`[Sync] Back online — draining ${queuedPaths.length} queued files`);
    }

    // Full sync handles everything: queued uploads + remote downloads + merges
    await this.sync();
  }

  // -----------------------------------------------------------------------
  // Workspace management
  // -----------------------------------------------------------------------

  async getSyncedWorkspace(userId) {
    const uid = userId || this.userId;
    if (!uid) return null;
    try {
      const { data } = await supabase
        .from('user_workspaces')
        .select('workspace_id, name, last_synced_at')
        .eq('user_id', uid)
        .maybeSingle();
      return data || null;
    } catch {
      return null;
    }
  }

  async enableSyncForWorkspace(workspacePath, userId) {
    const uid = userId || this.userId;
    if (!uid) throw new Error('Not authenticated');

    const workspaceName = workspacePath.split(/[/\\]/).filter(Boolean).pop();
    console.log(`[Sync] Enabling sync for "${workspaceName}"`);

    await supabase.from('user_workspaces').delete().eq('user_id', uid);

    const workspaceId = crypto.randomUUID();

    await supabase.from('user_workspaces').insert({
      user_id: uid,
      workspace_id: workspaceId,
      name: workspaceName,
    });

    try {
      await invoke('create_directory', { path: `${workspacePath}/.lokus`, recursive: true });
      await invoke('write_file_content', {
        path: `${workspacePath}/.lokus/sync-id`,
        content: workspaceId,
      });
    } catch {}

    if (workspacePath === this.workspacePath) {
      this.workspaceId = workspaceId;
      this.syncEnabled = true;
      await syncCache.load(workspacePath);
      await offlineQueue.load(workspacePath);
    }

    console.log(`[Sync] Enabled — workspace "${workspaceName}" (${workspaceId})`);
    return workspaceId;
  }

  async disableSync(userId) {
    const uid = userId || this.userId;
    if (!uid) return;
    console.log('[Sync] Disabling sync');
    await supabase.from('user_workspaces').delete().eq('user_id', uid);
    this.syncEnabled = false;
    this.workspaceId = null;
  }

  async pullWorkspace(targetPath, userId) {
    const uid = userId;
    if (!uid) throw new Error('Not authenticated');

    await keyManager.initialize(uid);
    const mek = keyManager.getMEK();

    const workspace = await this.getSyncedWorkspace(uid);
    if (!workspace) throw new Error('No synced workspace found');

    const { workspace_id } = workspace;

    const { data: files, error } = await supabase.from('sync_files')
      .select('file_path, content_hash, file_size, is_binary, modified_at')
      .eq('user_id', uid)
      .eq('workspace_id', workspace_id);
    if (error) throw error;

    console.log(`[Sync] Pulling "${workspace.name}" → ${targetPath} (${(files || []).length} files)`);

    let pulled = 0;
    const downloadTasks = (files || []).map((file) => async () => {
      try {
        const sp = storagePath(uid, workspace_id, file.file_path);
        const { data, error: dlError } = await supabase.storage.from('vaults').download(sp);
        if (dlError) throw dlError;

        const encryptedBuffer = await data.arrayBuffer();
        const plaintext = await decryptFile(mek, encryptedBuffer);
        const fullPath = joinPath(targetPath, file.file_path);

        const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        const dir = fullPath.substring(0, lastSep);
        try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

        if (file.is_binary) {
          await invoke('write_binary_file', { path: fullPath, content: Array.from(new Uint8Array(plaintext)) });
        } else {
          const text = new TextDecoder().decode(plaintext);
          await invoke('write_file_content', { path: fullPath, content: text });
        }
        pulled++;
        console.log(`[Sync] ↓ pulled ${file.file_path}`);
      } catch (err) {
        console.warn(`[Sync] ✗ pull failed: ${file.file_path} — ${err.message}`);
      }
    });

    await runWithConcurrency(downloadTasks, MAX_CONCURRENT);
    console.log(`[Sync] Pull complete — ${pulled}/${(files || []).length} files`);

    try {
      await invoke('create_directory', { path: `${targetPath}/.lokus`, recursive: true });
      await invoke('write_file_content', {
        path: `${targetPath}/.lokus/sync-id`,
        content: workspace_id,
      });
    } catch {}

    return workspace.name;
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
  // If offline, queues them. If online, uploads changed ones.
  // -----------------------------------------------------------------------

  async syncFiles(absolutePaths) {
    if (this.syncing || !this.syncEnabled || !this.workspacePath || !this.userId || !this.workspaceId) return;

    // Convert to relative paths for the queue
    const relativePaths = absolutePaths.map(abs =>
      abs.replace(this.workspacePath, '').replace(/^[/\\]/, '').replace(/\\/g, '/')
    );

    // If offline, queue and bail
    if (!this.online || !(await isOnline())) {
      this.online = false;
      await offlineQueue.enqueue(relativePaths);
      this._emit('offline', { queued: offlineQueue.size });
      console.log(`[Sync] Offline — queued ${relativePaths.length} files (total: ${offlineQueue.size})`);
      return;
    }

    console.log(`[Sync] syncFiles — ${relativePaths.length} files: ${relativePaths.join(', ')}`);
    this.syncing = true;
    this._emit('syncing');

    try {
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

        if (remote && local.hash === remote.content_hash) {
          console.log(`[Sync] — skip ${filePath} (unchanged)`);
          skipped++;
          return;
        }

        try {
          const encrypted = await encryptFile(mek, local.content.buffer);
          const sp = storagePath(this.userId, this.workspaceId, filePath);

          await supabase.storage
            .from('vaults')
            .upload(sp, encrypted, { contentType: 'application/octet-stream', upsert: true });

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
          console.warn(`[Sync] ✗ upload failed: ${filePath} — ${err.message}`);
          if (this._isNetworkError(err)) {
            this.online = false;
            await offlineQueue.enqueue([filePath]);
            console.log(`[Sync] ⏳ queued ${filePath} for retry`);
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
      this.syncing = false;
    }
  }

  // -----------------------------------------------------------------------
  // sync — full workspace reconciliation
  // Handles: local-only → upload, remote-only → download,
  //          both changed → merge (text) or last-write-wins (binary)
  // -----------------------------------------------------------------------

  async sync() {
    if (this.syncing || !this.syncEnabled || !this.workspacePath || !this.userId || !this.workspaceId) return;

    if (!this.online || !(await isOnline())) {
      this.online = false;
      this._emit('offline', { queued: offlineQueue.size });
      return;
    }

    console.log('[Sync] Full sync starting...');
    this.syncing = true;
    this._emit('syncing');

    try {
      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scan(this.workspacePath, syncCache);
      const remoteFiles = await this._fetchRemoteMetadata();
      const actions = this._computeActions(localFiles, remoteFiles);

      const total = actions.upload.length + actions.download.length + actions.merge.length;
      const skipped = localFiles.size - actions.upload.length - actions.merge.length;
      console.log(`[Sync] Plan — ↑${actions.upload.length} upload, ↓${actions.download.length} download, ⇄${actions.merge.length} merge, ${skipped} unchanged (${localFiles.size} local, ${remoteFiles.size} remote)`);

      if (total === 0) {
        console.log('[Sync] Everything up to date');
        this.lastSyncResult = { uploaded: 0, downloaded: 0, merged: 0, failed: 0 };
        this.lastSyncAt = new Date().toISOString();
        this._emit('synced', this.lastSyncResult);
        this.syncing = false;
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
          }

          const encrypted = await encryptFile(mek, local.content.buffer);
          const sp = storagePath(this.userId, this.workspaceId, filePath);

          await supabase.storage.from('vaults')
            .upload(sp, encrypted, { contentType: 'application/octet-stream', upsert: true });

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

      // Batch metadata upsert
      if (metadataBatch.length > 0) {
        const { error } = await supabase.from('sync_files').upsert(
          metadataBatch,
          { onConflict: 'user_id,workspace_id,file_path' }
        );
        if (error) console.warn('[Sync] Batch metadata upsert failed:', error.message);
      }

      await syncCache.save(this.workspacePath);

      try {
        await supabase.from('user_workspaces').update({
          last_synced_at: new Date().toISOString(),
        }).eq('user_id', this.userId).eq('workspace_id', this.workspaceId);
      } catch {}

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
      this.syncing = false;
    }
  }

  // -----------------------------------------------------------------------
  // Stats / metadata
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

  async getUserWorkspaces() {
    if (!this.userId) return [];
    try {
      const { data } = await supabase
        .from('user_workspaces')
        .select('workspace_id, name, last_synced_at')
        .eq('user_id', this.userId);
      return data || [];
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Conflict resolution
  //
  // Strategy:
  // - Hash-based: if hashes match, skip (regardless of timestamps)
  // - Local-only file (not on remote): upload
  // - Remote-only file (not on local): download
  // - Both exist, different hashes:
  //     - Text files: 3-way merge using diff-match-patch (remote as base)
  //       If merge fails cleanly, concatenate with separator
  //     - Binary files: newer timestamp wins, ties → remote wins
  //       (binary can't be merged, and remote is the "shared" truth)
  // -----------------------------------------------------------------------

  _computeActions(localFiles, remoteFiles) {
    const upload = [];
    const download = [];
    const merge = [];

    for (const [path, local] of localFiles) {
      const remote = remoteFiles.get(path);

      if (!remote) {
        // Local-only → upload
        upload.push(path);
      } else if (local.hash === remote.content_hash) {
        // Identical → skip
        continue;
      } else if (local.isBinary) {
        // Binary conflict → compare timestamps, remote wins on tie
        const localTime = new Date(local.modifiedAt).getTime();
        const remoteTime = new Date(remote.modified_at).getTime();
        if (localTime > remoteTime) {
          upload.push(path);
        } else {
          download.push(path);
        }
      } else {
        // Text conflict → always merge
        merge.push(path);
      }
    }

    // Remote-only → download
    for (const [path] of remoteFiles) {
      if (!localFiles.has(path)) {
        download.push(path);
      }
    }

    return { upload, download, merge };
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------

  async _downloadFile(filePath, remote, mek) {
    const sp = storagePath(this.userId, this.workspaceId, filePath);
    const { data, error } = await supabase.storage.from('vaults').download(sp);
    if (error) throw error;

    const encryptedBuffer = await data.arrayBuffer();
    const plaintext = await decryptFile(mek, encryptedBuffer);
    const fullPath = joinPath(this.workspacePath, filePath);

    const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
    const dir = fullPath.substring(0, lastSep);
    try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

    if (remote.is_binary) {
      await invoke('write_binary_file', { path: fullPath, content: Array.from(new Uint8Array(plaintext)) });
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
      console.log(`[Sync] ⇄ ${filePath} — local & remote identical after download, skipping`);
      return;
    }

    const merged = this._autoMerge(localText, remoteText);
    const fullPath = joinPath(this.workspacePath, filePath);
    const cleanMerge = merged !== `${localText}\n\n---\n\n> The following content was merged from another device:\n\n${remoteText}`;
    console.log(`[Sync] ⇄ ${filePath} — ${cleanMerge ? 'auto-merged cleanly' : 'CONFLICT — both versions kept'}`);
    await invoke('write_file_content', { path: fullPath, content: merged });

    // Upload merged result so both devices converge
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

  /**
   * Auto-merge using diff-match-patch.
   * If patches apply cleanly → use merged result.
   * If any patch fails → concatenate both versions with a visible separator
   * so the user can manually resolve (no silent data loss).
   */
  _autoMerge(localText, remoteText) {
    const diffs = dmp.diff_main(remoteText, localText);
    dmp.diff_cleanupSemantic(diffs);
    const patches = dmp.patch_make(remoteText, diffs);
    const [merged, results] = dmp.patch_apply(patches, remoteText);

    if (results.every(r => r)) return merged;

    // Merge failed — keep both versions visible
    return `${localText}\n\n---\n\n> The following content was merged from another device:\n\n${remoteText}`;
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

  // -----------------------------------------------------------------------
  // Metadata queries
  // -----------------------------------------------------------------------

  async _fetchMetadataForFiles(relativePaths) {
    if (relativePaths.length === 0) return new Map();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active Supabase session');

    const { data, error } = await supabase.from('sync_files')
      .select('file_path, content_hash, file_size, is_binary, modified_at')
      .eq('user_id', this.userId)
      .eq('workspace_id', this.workspaceId)
      .in('file_path', relativePaths);
    if (error) throw error;

    const map = new Map();
    for (const row of (data || [])) map.set(row.file_path, row);
    return map;
  }

  async _fetchRemoteMetadata() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active Supabase session');

    const { data, error } = await supabase.from('sync_files')
      .select('file_path, content_hash, file_size, is_binary, modified_at')
      .eq('user_id', this.userId)
      .eq('workspace_id', this.workspaceId);
    if (error) throw error;

    const map = new Map();
    for (const row of (data || [])) map.set(row.file_path, row);
    return map;
  }

  async _registerWorkspace(name) {
    try {
      await supabase.from('user_workspaces').upsert(
        { user_id: this.userId, workspace_id: this.workspaceId, name },
        { onConflict: 'user_id,workspace_id' }
      );
    } catch {}
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
