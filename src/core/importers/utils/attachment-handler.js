/**
 * Attachment / Asset handler.
 *
 * Copies referenced assets into the destination workspace's `attachments/`
 * folder and remaps paths in page content.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Copy all assets described by IR Asset objects to the destination workspace.
 * @param {Array} assets - IR Asset array [{sourcePath, destPath, referencedBy}]
 * @param {string} destRoot - Destination workspace root path
 * @returns {Promise<{copied: number, failed: number, errors: string[]}>}
 */
export async function copyAssets(assets, destRoot) {
  const attachDir = `${destRoot}/attachments`;
  await ensureDir(attachDir);

  let copied = 0;
  let failed = 0;
  const errors = [];

  for (const asset of assets) {
    try {
      const fileName = asset.sourcePath.split('/').pop();
      const dest = `${attachDir}/${fileName}`;

      const exists = await invoke('path_exists', { path: asset.sourcePath });
      if (!exists) {
        errors.push(`Asset not found: ${asset.sourcePath}`);
        failed++;
        continue;
      }

      await invoke('copy_file', { source: asset.sourcePath, destination: dest });
      asset.destPath = `attachments/${fileName}`;
      copied++;
    } catch (err) {
      errors.push(`Failed to copy ${asset.sourcePath}: ${err.message}`);
      failed++;
    }
  }

  return { copied, failed, errors };
}

/**
 * Remap asset paths in markdown content.
 * Replaces old source-relative paths with `attachments/filename`.
 * @param {string} content - Markdown content
 * @param {Array} assets - IR Asset array (with destPath filled)
 * @returns {string} Updated content
 */
export function remapAssetPaths(content, assets) {
  let result = content;

  for (const asset of assets) {
    if (!asset.destPath) continue;

    const fileName = asset.sourcePath.split('/').pop();
    // Replace common patterns: relative paths, Logseq ../assets/ paths
    const patterns = [
      asset.sourcePath,
      `../assets/${fileName}`,
      `assets/${fileName}`,
      fileName
    ];

    for (const pattern of patterns) {
      // Only replace within markdown image/link syntax to avoid false positives
      const escaped = escapeRegExp(pattern);
      const re = new RegExp(`(!?\\[\\[[^\\]]*?)${escaped}([^\\]]*?\\]\\])`, 'g');
      result = result.replace(re, `$1${asset.destPath}$2`);

      // Also handle standard markdown image syntax ![alt](path)
      const mdImgRe = new RegExp(`(!\\[[^\\]]*\\]\\()${escaped}(\\))`, 'g');
      result = result.replace(mdImgRe, `$1${asset.destPath}$2`);
    }
  }

  return result;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureDir(path) {
  try {
    const exists = await invoke('path_exists', { path });
    if (!exists) {
      await invoke('create_directory', { path, recursive: true });
    }
  } catch {
    // best effort
  }
}

export default { copyAssets, remapAssetPaths };
