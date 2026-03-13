import { supabase } from '../auth/supabase';
import { MAX_CONCURRENT } from './constants';

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

export class StorageManager {
  async uploadFile(userId, wsId, relPath, encryptedBlob) {
    const sp = storagePath(userId, wsId, relPath);
    return this._withRetry(async () => {
      const { error } = await supabase.storage
        .from('vaults')
        .upload(sp, encryptedBlob, { contentType: 'application/octet-stream', upsert: true });
      if (error) throw error;
    });
  }

  async downloadFile(userId, wsId, relPath) {
    const sp = storagePath(userId, wsId, relPath);
    return this._withRetry(async () => {
      const { data, error } = await supabase.storage.from('vaults').download(sp);
      if (error) throw error;
      return data;
    });
  }

  async deleteFile(userId, wsId, relPath) {
    const sp = storagePath(userId, wsId, relPath);
    const { error } = await supabase.storage.from('vaults').remove([sp]);
    if (error) throw error;
  }

  async deleteWorkspace(userId, wsId, filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    const paths = filePaths.map(fp => storagePath(userId, wsId, fp));
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from('vaults').remove(paths.slice(i, i + 100));
      if (error) console.warn('[Storage] Batch delete error:', error.message);
    }
  }

  async uploadBatch(files, concurrency = MAX_CONCURRENT, onProgress) {
    let completed = 0;
    const tasks = files.map(({ userId, wsId, relPath, blob }) => async () => {
      await this.uploadFile(userId, wsId, relPath, blob);
      completed++;
      if (onProgress) onProgress(completed, files.length);
    });
    await runWithConcurrency(tasks, concurrency);
  }

  async downloadBatch(files, concurrency = MAX_CONCURRENT, onProgress) {
    let completed = 0;
    const results = [];
    const tasks = files.map(({ userId, wsId, relPath }, idx) => async () => {
      const blob = await this.downloadFile(userId, wsId, relPath);
      results[idx] = { relPath, blob };
      completed++;
      if (onProgress) onProgress(completed, files.length);
    });
    await runWithConcurrency(tasks, concurrency);
    return results;
  }

  _isFatalError(err) {
    const msg = (err?.message || '').toLowerCase();
    return (
      msg.includes('not authenticated') ||
      msg.includes('jwt expired') ||
      msg.includes('invalid token') ||
      err?.status === 401
    );
  }

  async _withRetry(fn, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries || this._isFatalError(err)) throw err;
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

export const storageManager = new StorageManager();
