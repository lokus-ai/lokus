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
   * Returns { upload[], download[], delete[], skip[], conflict[] }
   * where conflict = [{ path, primary: 'local'|'remote' }].
   *
   * Async because deletion detection requires a positive existence check
   * (see `options.verifyDeleted`) rather than inferring a delete from a file
   * merely being absent from the scan result.
   *
   * @param {Map} localFiles — Map<relPath, { hash, size, isBinary, modifiedAt }>
   * @param {object|null} remoteManifest — manifest JSON or null
   * @param {SyncCache} syncCache — local sync cache; holds the last-synced hash per path
   * @param {object} [options]
   * @param {(relPath:string)=>Promise<boolean|null>} [options.verifyDeleted]
   *        Resolves true if the file is confirmed gone, false if it actually
   *        still exists (transient scan miss), or null/throws if the existence
   *        check itself errored (unknown → treated as "do not delete").
   */
  async diff(localFiles, remoteManifest, syncCache, options = {}) {
    const { verifyDeleted } = options;
    const upload = [];
    const download = [];
    const del = [];
    const skip = [];
    const conflict = [];

    const remoteFiles = remoteManifest?.files || {};

    // Compare local files against remote
    for (const [path, local] of localFiles) {
      const remote = remoteFiles[path];

      if (!remote) {
        upload.push(path);
      } else if (local.hash === remote.hash) {
        skip.push(path);
      } else {
        // Hashes differ. Decide one-sided update vs. true concurrent conflict
        // using the last-synced hash recorded in the sync cache. Raw wall-clock
        // last-write-wins is unsafe under clock skew and silently discards the
        // loser — so a genuine two-sided divergence keeps BOTH copies.
        const cached = syncCache.get(path);
        const lastHash = cached ? cached.hash : null;
        const localChanged = lastHash === null || local.hash !== lastHash;
        const remoteChanged = lastHash === null || remote.hash !== lastHash;

        if (localChanged && remoteChanged) {
          // Both sides moved since the last synced state → real conflict.
          // Timestamp only decides which copy keeps the primary filename; the
          // loser is written alongside as a `.conflict-<ts>` copy. Nothing lost.
          const localTime = new Date(local.modifiedAt).getTime();
          const remoteTime = new Date(remote.modified_at).getTime();
          const primary = localTime >= remoteTime ? 'local' : 'remote';
          conflict.push({ path, primary });
          if (primary === 'local') upload.push(path);
          else download.push(path);
        } else if (localChanged) {
          // Only local moved since last sync → fast path, push local.
          upload.push(path);
        } else {
          // Only remote moved since last sync → fast path, pull remote.
          download.push(path);
        }
      }
    }

    // Check remote files not in local scan
    for (const path of Object.keys(remoteFiles)) {
      if (!localFiles.has(path)) {
        if (syncCache.has(path)) {
          // Present in remote + previously synced, but missing from THIS scan.
          // Absence alone is not a delete signal — a transient scan miss
          // (permissions error, unmounted dir, race) must never propagate a
          // deletion to the cloud. Require a positive "confirmed gone" signal.
          let confirmed = null; // true = gone, false = still present, null = unknown
          if (verifyDeleted) {
            try {
              confirmed = await verifyDeleted(path);
            } catch {
              confirmed = null; // existence check errored → unknown
            }
          }
          if (confirmed === true) {
            del.push(path);
          } else if (confirmed === false) {
            skip.push(path); // scan miss — file is actually still there
          }
          // confirmed === null → unknown → skip entirely (no delete, no overwrite)
        } else {
          // New remote file
          download.push(path);
        }
      }
    }

    return { upload, download, delete: del, skip, conflict };
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
