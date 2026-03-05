import { invoke } from '@tauri-apps/api/core';
import { sha256 } from './encryption';

const EXCLUDED = ['.git', 'node_modules', '.DS_Store', '.Trash', 'Thumbs.db'];
const LOKUS_EXCLUDED = ['backups', 'temp', 'plugins', 'cache'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'mov', 'webm',
  'zip', 'tar', 'gz', 'rar', '7z',
  'ttf', 'otf', 'woff', 'woff2',
]);

export function isBinaryExt(name) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * SyncCache — persists file hashes + mtimes to .lokus/sync-cache.json
 * so we can skip unchanged files on full scans.
 */
export class SyncCache {
  constructor() {
    this.cache = {}; // { relativePath: { hash, mtime, size } }
  }

  async load(workspacePath) {
    try {
      const raw = await invoke('read_file_content', {
        path: `${workspacePath}/.lokus/sync-cache.json`,
      });
      this.cache = JSON.parse(raw);
    } catch {
      this.cache = {};
    }
  }

  async save(workspacePath) {
    try {
      await invoke('write_file_content', {
        path: `${workspacePath}/.lokus/sync-cache.json`,
        content: JSON.stringify(this.cache),
      });
    } catch (err) {
      console.warn('[Sync] Failed to save cache:', err.message);
    }
  }

  get(relativePath) {
    return this.cache[relativePath] || null;
  }

  set(relativePath, hash, mtime, size) {
    this.cache[relativePath] = { hash, mtime, size };
  }

  /** Check if file changed based on mtime + size */
  isUnchanged(relativePath, mtime, size) {
    const c = this.cache[relativePath];
    return c && c.mtime === mtime && c.size === size;
  }
}

export class FileScanner {
  /**
   * Full workspace scan with cache — skips files whose mtime+size haven't changed.
   * Returns Map<relativePath, {hash, size, isBinary, modifiedAt, content}>
   * Only files that need syncing have `content` populated.
   */
  async scan(workspacePath, cache) {
    const entries = await invoke('read_workspace_files', { workspacePath });
    const files = new Map();
    await this._walkEntries(entries, workspacePath, files, false, cache);
    return files;
  }

  /**
   * Scan specific files only (for save-triggered sync).
   * Returns Map with only the specified files.
   */
  async scanFiles(workspacePath, absolutePaths) {
    const files = new Map();
    for (const absPath of absolutePaths) {
      // Handle both / and \ separators, normalize to /
      const relativePath = absPath.replace(workspacePath, '').replace(/^[/\\]/, '').replace(/\\/g, '/');
      const name = relativePath.split('/').pop();
      const binary = isBinaryExt(name);

      try {
        let content;
        if (binary) {
          content = await invoke('read_binary_file', { path: absPath });
          content = new Uint8Array(content);
        } else {
          const text = await invoke('read_file_content', { path: absPath });
          content = new TextEncoder().encode(text);
        }

        const hash = await sha256(content.buffer);

        files.set(relativePath, {
          hash,
          size: content.byteLength,
          isBinary: binary,
          modifiedAt: new Date().toISOString(),
          content,
        });
      } catch (err) {
        console.warn(`[Sync] Failed to read ${relativePath}:`, err);
      }
    }
    return files;
  }

  async _walkEntries(entries, workspacePath, files, insideLokus, cache) {
    for (const entry of entries) {
      const name = entry.name;

      if (EXCLUDED.includes(name)) continue;

      if (name === '.lokus' && !insideLokus) {
        if (entry.is_directory && entry.children) {
          await this._walkEntries(entry.children, workspacePath, files, true, cache);
        }
        continue;
      }

      if (name.startsWith('.') && !insideLokus) continue;
      if (insideLokus && entry.is_directory && LOKUS_EXCLUDED.includes(name)) continue;

      if (entry.is_directory) {
        if (entry.children) {
          await this._walkEntries(entry.children, workspacePath, files, insideLokus, cache);
        }
        continue;
      }

      if (entry.size > MAX_FILE_SIZE) continue;

      // Handle both / and \ separators, normalize to /
      const relativePath = entry.path.replace(workspacePath, '').replace(/^[/\\]/, '').replace(/\\/g, '/');
      const mtime = entry.modified || 0;
      const binary = isBinaryExt(name);

      // Skip if mtime+size unchanged (cache hit)
      if (cache?.isUnchanged(relativePath, mtime, entry.size)) {
        const cached = cache.get(relativePath);
        files.set(relativePath, {
          hash: cached.hash,
          size: cached.size,
          isBinary: binary,
          modifiedAt: new Date(mtime * 1000).toISOString(),
          content: null, // Not needed — hash match means no upload
        });
        continue;
      }

      // Cache miss — read and hash the file
      try {
        let content;
        if (binary) {
          content = await invoke('read_binary_file', { path: entry.path });
          content = new Uint8Array(content);
        } else {
          const text = await invoke('read_file_content', { path: entry.path });
          content = new TextEncoder().encode(text);
        }

        const hash = await sha256(content.buffer);

        // Update cache
        cache?.set(relativePath, hash, mtime, content.byteLength);

        files.set(relativePath, {
          hash,
          size: content.byteLength,
          isBinary: binary,
          modifiedAt: mtime ? new Date(mtime * 1000).toISOString() : new Date().toISOString(),
          content,
        });
      } catch (err) {
        console.warn(`[Sync] Failed to read ${relativePath}:`, err);
      }
    }
  }
}

export const fileScanner = new FileScanner();
export const syncCache = new SyncCache();
