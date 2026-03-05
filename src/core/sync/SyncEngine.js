import { supabase } from '../auth/supabase';
import { keyManager } from './KeyManager';
import { encryptFile, decryptFile, sha256 } from './encryption';
import { fileScanner } from './FileScanner';
import { invoke } from '@tauri-apps/api/core';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

export class SyncEngine {
  constructor() {
    this.workspacePath = null;
    this.workspaceId = null;
    this.userId = null;
    this.syncing = false;
    this.listeners = new Set();
  }

  init(workspacePath, userId) {
    this.workspacePath = workspacePath;
    this.workspaceId = this._hashPath(workspacePath);
    this.userId = userId;
  }

  onStatusChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(status, detail) {
    for (const fn of this.listeners) fn(status, detail);
  }

  async sync() {
    if (this.syncing || !this.workspacePath || !this.userId) return;
    this.syncing = true;
    this._emit('syncing');

    try {
      const mek = keyManager.getMEK();
      const localFiles = await fileScanner.scan(this.workspacePath);
      const remoteFiles = await this._fetchRemoteMetadata();
      const actions = this._computeActions(localFiles, remoteFiles);

      let completed = 0;
      const total = actions.upload.length + actions.download.length + actions.merge.length;

      for (const filePath of actions.upload) {
        const local = localFiles.get(filePath);
        await this._uploadFile(filePath, local, mek);
        completed++;
        this._emit('syncing', { total, completed });
      }

      for (const filePath of actions.download) {
        const remote = remoteFiles.get(filePath);
        await this._downloadFile(filePath, remote, mek);
        completed++;
        this._emit('syncing', { total, completed });
      }

      for (const filePath of actions.merge) {
        const local = localFiles.get(filePath);
        await this._mergeFile(filePath, local, mek);
        completed++;
        this._emit('syncing', { total, completed });
      }

      this._emit('synced', {
        uploaded: actions.upload.length,
        downloaded: actions.download.length,
        merged: actions.merge.length,
      });
    } catch (err) {
      console.error('[Sync] Failed:', err);
      this._emit('error', err.message);
    } finally {
      this.syncing = false;
    }
  }

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
        } else if (remoteNewer && local.isBinary) {
          download.push(path);
        } else {
          if (!local.isBinary) {
            merge.push(path);
          } else {
            download.push(path);
          }
        }
      }
    }

    for (const [path] of remoteFiles) {
      if (!localFiles.has(path)) {
        download.push(path);
      }
    }

    return { upload, download, merge };
  }

  async _uploadFile(filePath, local, mek) {
    const encrypted = await encryptFile(mek, local.content.buffer);
    const storagePath = `${this.userId}/${this.workspaceId}/${filePath}`;

    const { error: uploadError } = await supabase.storage
      .from('vaults')
      .upload(storagePath, encrypted, { contentType: 'application/octet-stream', upsert: true });
    if (uploadError) throw uploadError;

    const { error: metaError } = await supabase.from('sync_files').upsert({
      user_id: this.userId,
      workspace_id: this.workspaceId,
      file_path: filePath,
      content_hash: local.hash,
      file_size: local.size,
      encrypted_size: encrypted.byteLength,
      is_binary: local.isBinary,
      modified_at: local.modifiedAt,
      encryption_version: 1,
    }, { onConflict: 'user_id,workspace_id,file_path' });
    if (metaError) throw metaError;
  }

  async _downloadFile(filePath, remote, mek) {
    const storagePath = `${this.userId}/${this.workspaceId}/${filePath}`;
    const { data, error } = await supabase.storage.from('vaults').download(storagePath);
    if (error) throw error;

    const encryptedBuffer = await data.arrayBuffer();
    const plaintext = await decryptFile(mek, encryptedBuffer);

    const fullPath = `${this.workspacePath}/${filePath}`;

    if (remote.is_binary) {
      await invoke('write_binary_file', { path: fullPath, content: Array.from(new Uint8Array(plaintext)) });
    } else {
      const text = new TextDecoder().decode(plaintext);
      await invoke('write_file_content', { path: fullPath, content: text });
    }
  }

  async _mergeFile(filePath, local, mek) {
    const storagePath = `${this.userId}/${this.workspaceId}/${filePath}`;
    const { data, error } = await supabase.storage.from('vaults').download(storagePath);
    if (error) throw error;

    const encryptedBuffer = await data.arrayBuffer();
    const remotePlaintext = await decryptFile(mek, encryptedBuffer);
    const remoteText = new TextDecoder().decode(remotePlaintext);
    const localText = new TextDecoder().decode(local.content);

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
  }

  _autoMerge(localText, remoteText) {
    const diffs = dmp.diff_main(remoteText, localText);
    dmp.diff_cleanupSemantic(diffs);
    const patches = dmp.patch_make(remoteText, diffs);
    const [merged, results] = dmp.patch_apply(patches, remoteText);

    if (results.every(r => r)) return merged;

    return `${localText}\n\n---\n\n> The following content was merged from another device:\n\n${remoteText}`;
  }

  async _fetchRemoteMetadata() {
    const { data, error } = await supabase.from('sync_files')
      .select('file_path, content_hash, file_size, is_binary, modified_at')
      .eq('user_id', this.userId)
      .eq('workspace_id', this.workspaceId);
    if (error) throw error;

    const map = new Map();
    for (const row of (data || [])) {
      map.set(row.file_path, row);
    }
    return map;
  }

  _hashPath(path) {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash |= 0;
    }
    return `ws_${Math.abs(hash).toString(36)}`;
  }
}

export const syncEngine = new SyncEngine();
