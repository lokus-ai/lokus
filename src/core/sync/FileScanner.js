import { invoke } from '@tauri-apps/api/core';
import { sha256 } from './encryption';

const EXCLUDED = ['.lokus', '.git', 'node_modules', '.DS_Store', '.Trash', 'Thumbs.db'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'mov', 'webm',
  'zip', 'tar', 'gz', 'rar', '7z',
  'ttf', 'otf', 'woff', 'woff2',
]);

export class FileScanner {
  /**
   * Scan workspace and return a map of relative_path -> { hash, size, isBinary, modifiedAt, content }
   */
  async scan(workspacePath) {
    const entries = await invoke('read_workspace_files', { workspace_path: workspacePath });
    const files = new Map();
    await this._walkEntries(entries, workspacePath, files);
    return files;
  }

  async _walkEntries(entries, workspacePath, files) {
    for (const entry of entries) {
      const name = entry.name;

      if (EXCLUDED.includes(name)) continue;
      if (name.startsWith('.')) continue;

      if (entry.is_directory) {
        if (entry.children) {
          await this._walkEntries(entry.children, workspacePath, files);
        }
        continue;
      }

      if (entry.size > MAX_FILE_SIZE) continue;

      const relativePath = entry.path.replace(workspacePath + '/', '');
      const ext = name.split('.').pop()?.toLowerCase() || '';
      const isBinary = BINARY_EXTENSIONS.has(ext);

      try {
        let content;
        if (isBinary) {
          content = await invoke('read_binary_file', { path: entry.path });
          content = new Uint8Array(content);
        } else {
          const text = await invoke('read_file_content', { path: entry.path });
          content = new TextEncoder().encode(text);
        }

        const hash = await sha256(content.buffer);

        files.set(relativePath, {
          hash,
          size: content.byteLength,
          isBinary,
          modifiedAt: entry.modified ? new Date(entry.modified * 1000).toISOString() : new Date().toISOString(),
          content,
        });
      } catch (err) {
        console.warn(`[Sync] Failed to read ${relativePath}:`, err);
      }
    }
  }
}

export const fileScanner = new FileScanner();
