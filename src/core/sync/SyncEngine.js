import { supabase } from '../auth/supabase';
import { keyManager } from './KeyManager';
import { encryptFile, decryptFile, sha256 } from './encryption';
import { fileScanner, syncCache } from './FileScanner';
import { invoke } from '@tauri-apps/api/core';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
const MAX_CONCURRENT = 3;

function encodeStoragePath(userId, workspaceId, filePath) {
  const encodedSegments = filePath.split('/').map(s => encodeURIComponent(s));
  return `${userId}/${workspaceId}/${encodedSegments.join('/')}`;
}

/** Run async tasks with concurrency limit */
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

export class SyncEngine {
  constructor() {
    this.workspacePath = null;
    this.workspaceId = null;
    this.userId = null;
    this.syncing = false;
    this.listeners = new Set();
    this.lastSyncResult = null;
    this.lastSyncAt = null;
  }

  async init(workspacePath, userId) {
    this.workspacePath = workspacePath;
    this.userId = userId;

    // Load local hash cache
    await syncCache.load(workspacePath);

    const workspaceName = workspacePath.split('/').pop() || workspacePath.split('\\').pop();

    // 1. Try reading existing sync-id
    try {
      const syncId = await invoke('read_file_content', {
        path: `${workspacePath}/.lokus/sync-id`,
      });
      if (syncId?.trim()) {
        this.workspaceId = syncId.trim();
        await this._registerWorkspace(workspaceName);
        return;
      }
    } catch {}

    // 2. Check remote for matching workspace name
    try {
      const { data } = await supabase
        .from('user_workspaces')
        .select('workspace_id')
        .eq('user_id', userId)
        .eq('name', workspaceName)
        .maybeSingle();
      if (data?.workspace_id) {
        this.workspaceId = data.workspace_id;
        await this._writeSyncId();
        return;
      }
    } catch {}

    // 3. Generate new UUID
    this.workspaceId = crypto.randomUUID();
    await this._writeSyncId();
    await this._registerWorkspace(workspaceName);
  }

  async _writeSyncId() {
    try {
      await invoke('write_file_content', {
        path: `${this.workspacePath}/.lokus/sync-id`,
        content: this.workspaceId,
      });
    } catch {}
  }

  async _registerWorkspace(name) {
    try {
      await supabase.from('user_workspaces').upsert(
        { user_id: this.userId, workspace_id: this.workspaceId, name },
        { onConflict: 'user_id,workspace_id' }
      );
    } catch {}
  }

  onStatusChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(status, detail) {
    for (const fn of this.listeners) fn(status, detail);
  }

  // -------------------------------------------------------------------------
  // syncFiles — targeted sync for specific saved files (cheap)
  // Only reads + uploads the files that were just saved. 1 metadata query
  // + N uploads + 1 batch upsert. No full scan.
  // -------------------------------------------------------------------------
  async syncFiles(absolutePaths) {
    if (this.syncing || !this.workspacePath || !this.userId || !this.workspaceId) return;
    this.syncing = true;
    this._emit('syncing');

    try {
      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scanFiles(this.workspacePath, absolutePaths);

      // Fetch only the metadata for these specific files
      const relativePaths = [...localFiles.keys()];
      const remoteFiles = await this._fetchMetadataForFiles(relativePaths);

      let uploaded = 0;
      let failed = 0;
      const metadataBatch = [];

      const tasks = relativePaths.map((filePath) => async () => {
        const local = localFiles.get(filePath);
        const remote = remoteFiles.get(filePath);

        // Skip if hash matches remote — nothing to do
        if (remote && local.hash === remote.content_hash) return;

        try {
          const encrypted = await encryptFile(mek, local.content.buffer);
          const storagePath = encodeStoragePath(this.userId, this.workspaceId, filePath);

          await supabase.storage
            .from('vaults')
            .upload(storagePath, encrypted, { contentType: 'application/octet-stream', upsert: true });

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

          // Update local cache
          syncCache.set(filePath, local.hash, Math.floor(Date.now() / 1000), local.size);
          uploaded++;
        } catch (err) {
          console.warn(`[Sync] Upload failed: ${filePath}:`, err.message);
          failed++;
        }
      });

      await runWithConcurrency(tasks, MAX_CONCURRENT);

      // Batch metadata upsert — single API call for all files
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
      this._emit('synced', this.lastSyncResult);
    } catch (err) {
      console.error('[Sync] syncFiles failed:', err);
      this._emit('error', err.message);
    } finally {
      this.syncing = false;
    }
  }

  // -------------------------------------------------------------------------
  // sync — full workspace scan (startup + periodic)
  // Uses mtime cache to skip reading unchanged files.
  // Batches metadata upserts. Concurrency-limited uploads.
  // -------------------------------------------------------------------------
  async sync() {
    if (this.syncing || !this.workspacePath || !this.userId || !this.workspaceId) return;
    this.syncing = true;
    this._emit('syncing');

    try {
      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scan(this.workspacePath, syncCache);
      const remoteFiles = await this._fetchRemoteMetadata();
      const actions = this._computeActions(localFiles, remoteFiles);

      const total = actions.upload.length + actions.download.length + actions.merge.length;
      let completed = 0;
      let failed = 0;
      const metadataBatch = [];

      // --- Uploads (concurrency limited) ---
      const uploadTasks = actions.upload.map((filePath) => async () => {
        try {
          let local = localFiles.get(filePath);

          // If content is null (cache hit but hash differs from remote), re-read
          if (!local.content) {
            const absPath = `${this.workspacePath}/${filePath}`;
            if (local.isBinary) {
              const raw = await invoke('read_binary_file', { path: absPath });
              local = { ...local, content: new Uint8Array(raw) };
            } else {
              const text = await invoke('read_file_content', { path: absPath });
              local = { ...local, content: new TextEncoder().encode(text) };
            }
          }

          const encrypted = await encryptFile(mek, local.content.buffer);
          const storagePath = encodeStoragePath(this.userId, this.workspaceId, filePath);

          await supabase.storage.from('vaults')
            .upload(storagePath, encrypted, { contentType: 'application/octet-stream', upsert: true });

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
        } catch (err) {
          console.warn(`[Sync] Upload failed: ${filePath}:`, err.message);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      });

      await runWithConcurrency(uploadTasks, MAX_CONCURRENT);

      // --- Downloads (concurrency limited) ---
      const downloadTasks = actions.download.map((filePath) => async () => {
        try {
          const remote = remoteFiles.get(filePath);
          await this._downloadFile(filePath, remote, mek);
          syncCache.set(filePath, remote.content_hash, Math.floor(Date.now() / 1000), remote.file_size);
        } catch (err) {
          console.warn(`[Sync] Download failed: ${filePath}:`, err.message);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      });

      await runWithConcurrency(downloadTasks, MAX_CONCURRENT);

      // --- Merges (sequential — needs both local + remote content) ---
      for (const filePath of actions.merge) {
        try {
          let local = localFiles.get(filePath);
          if (!local.content) {
            const text = await invoke('read_file_content', { path: `${this.workspacePath}/${filePath}` });
            local = { ...local, content: new TextEncoder().encode(text) };
          }
          await this._mergeFile(filePath, local, mek);
        } catch (err) {
          console.warn(`[Sync] Merge failed: ${filePath}:`, err.message);
          failed++;
        }
        completed++;
        this._emit('syncing', { total, completed });
      }

      // Batch metadata upsert for all uploads
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
      this._emit('synced', this.lastSyncResult);
    } catch (err) {
      console.error('[Sync] Failed:', err);
      this._emit('error', err.message);
    } finally {
      this.syncing = false;
    }
  }

  // -------------------------------------------------------------------------
  // Stats / metadata
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  _computeActions(localFiles, remoteFiles) {
    const upload = [];
    const download = [];
    const merge = [];

    for (const [path, local] of localFiles) {
      const remote = remoteFiles.get(path);

      if (!remote) {
        upload.push(path);
      } else if (local.hash !== remote.content_hash) {
        const localNewer = new Date(local.modifiedAt) > new Date(remote.modified_at);
        const remoteNewer = new Date(remote.modified_at) > new Date(local.modifiedAt);

        if (localNewer) {
          upload.push(path);
        } else if (remoteNewer && !local.isBinary) {
          merge.push(path);
        } else if (remoteNewer) {
          download.push(path);
        } else {
          // Same timestamp, different hash — merge text, download binary
          local.isBinary ? download.push(path) : merge.push(path);
        }
      }
      // hash matches → skip entirely (no action needed)
    }

    for (const [path] of remoteFiles) {
      if (!localFiles.has(path)) {
        download.push(path);
      }
    }

    return { upload, download, merge };
  }

  async _downloadFile(filePath, remote, mek) {
    const storagePath = encodeStoragePath(this.userId, this.workspaceId, filePath);
    const { data, error } = await supabase.storage.from('vaults').download(storagePath);
    if (error) throw error;

    const encryptedBuffer = await data.arrayBuffer();
    const plaintext = await decryptFile(mek, encryptedBuffer);
    const fullPath = `${this.workspacePath}/${filePath}`;

    // Ensure parent directory exists
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    try { await invoke('create_directory', { path: dir, recursive: true }); } catch {}

    if (remote.is_binary) {
      await invoke('write_binary_file', { path: fullPath, content: Array.from(new Uint8Array(plaintext)) });
    } else {
      const text = new TextDecoder().decode(plaintext);
      await invoke('write_file_content', { path: fullPath, content: text });
    }
  }

  async _mergeFile(filePath, local, mek) {
    const storagePath = encodeStoragePath(this.userId, this.workspaceId, filePath);
    const { data, error } = await supabase.storage.from('vaults').download(storagePath);
    if (error) throw error;

    const encryptedBuffer = await data.arrayBuffer();
    const remotePlaintext = await decryptFile(mek, encryptedBuffer);
    const remoteText = new TextDecoder().decode(remotePlaintext);
    const localText = new TextDecoder().decode(local.content);

    // If identical, skip
    if (localText === remoteText) return;

    const merged = this._autoMerge(localText, remoteText);
    const fullPath = `${this.workspacePath}/${filePath}`;
    await invoke('write_file_content', { path: fullPath, content: merged });

    const mergedBytes = new TextEncoder().encode(merged);
    const hash = await sha256(mergedBytes.buffer);
    const encrypted = await encryptFile(mek, mergedBytes.buffer);

    await supabase.storage.from('vaults')
      .upload(storagePath, encrypted, { contentType: 'application/octet-stream', upsert: true });

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

  _autoMerge(localText, remoteText) {
    const diffs = dmp.diff_main(remoteText, localText);
    dmp.diff_cleanupSemantic(diffs);
    const patches = dmp.patch_make(remoteText, diffs);
    const [merged, results] = dmp.patch_apply(patches, remoteText);

    if (results.every(r => r)) return merged;

    return `${localText}\n\n---\n\n> The following content was merged from another device:\n\n${remoteText}`;
  }

  /** Fetch metadata for specific files only (for targeted sync) */
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
}

export const syncEngine = new SyncEngine();
