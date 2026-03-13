import { supabase } from '../auth/supabase';
import { MANIFEST_VERSION } from './constants';

export class ManifestManager {
  /**
   * Fetch the user's manifest from the DB.
   * Returns { manifest, version } or null.
   */
  async fetch(userId) {
    const { data, error } = await supabase
      .from('workspace_manifests')
      .select('manifest, manifest_version, workspace_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return { manifest: data.manifest, version: data.manifest_version, workspaceId: data.workspace_id };
  }

  /**
   * Diff local files against remote manifest.
   * Returns { upload[], download[], delete[], skip[] }
   *
   * @param {Map} localFiles — Map<relPath, { hash, size, isBinary, modifiedAt }>
   * @param {object|null} remoteManifest — manifest JSON or null
   * @param {SyncCache} syncCache — local sync cache for deletion detection
   */
  diff(localFiles, remoteManifest, syncCache) {
    const upload = [];
    const download = [];
    const del = [];
    const skip = [];

    const remoteFiles = remoteManifest?.files || {};

    // Compare local files against remote
    for (const [path, local] of localFiles) {
      const remote = remoteFiles[path];

      if (!remote) {
        upload.push(path);
      } else if (local.hash === remote.hash) {
        skip.push(path);
      } else {
        // Different hash — compare timestamps (last-write-wins)
        const localTime = new Date(local.modifiedAt).getTime();
        const remoteTime = new Date(remote.modified_at).getTime();
        if (localTime >= remoteTime) {
          upload.push(path);
        } else {
          download.push(path);
        }
      }
    }

    // Check remote files not in local
    for (const path of Object.keys(remoteFiles)) {
      if (!localFiles.has(path)) {
        if (syncCache.has(path)) {
          // Was synced before, now deleted locally
          del.push(path);
        } else {
          // New remote file
          download.push(path);
        }
      }
    }

    return { upload, download, delete: del, skip };
  }

  /**
   * Build a new manifest JSON from local files + existing remote manifest.
   */
  buildManifest(workspaceId, localFiles, uploads, downloads, deletes, remoteManifest) {
    const files = { ...(remoteManifest?.files || {}) };

    // Add/update uploaded files
    for (const path of uploads) {
      const local = localFiles.get(path);
      if (local) {
        files[path] = {
          hash: local.hash,
          size: local.size,
          encrypted_size: local.encryptedSize || local.size + 28, // AES-GCM overhead estimate
          is_binary: local.isBinary,
          modified_at: local.modifiedAt,
          encryption_version: 1,
        };
      }
    }

    // Remove deleted files
    for (const path of deletes) {
      delete files[path];
    }

    let totalSize = 0;
    for (const f of Object.values(files)) totalSize += f.size || 0;

    return {
      version: MANIFEST_VERSION,
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
      file_count: Object.keys(files).length,
      total_size: totalSize,
      files,
    };
  }

  /**
   * Atomic manifest update via RPC (optimistic concurrency).
   * Returns true if successful, false if version conflict.
   */
  async update(userId, workspaceId, manifest, expectedVersion) {
    const { data, error } = await supabase.rpc('update_manifest', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_manifest: manifest,
      p_expected_version: expectedVersion,
    });

    if (error) throw error;
    return data === true;
  }

  /**
   * Create an empty manifest for a new workspace.
   */
  async create(userId, workspaceId) {
    const manifest = {
      version: MANIFEST_VERSION,
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
      file_count: 0,
      total_size: 0,
      files: {},
    };

    const { error } = await supabase
      .from('workspace_manifests')
      .upsert({
        user_id: userId,
        workspace_id: workspaceId,
        manifest,
        manifest_version: 1,
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return manifest;
  }

  /**
   * Delete the manifest row for a user.
   */
  async delete(userId) {
    const { error } = await supabase
      .from('workspace_manifests')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }
}

export const manifestManager = new ManifestManager();
