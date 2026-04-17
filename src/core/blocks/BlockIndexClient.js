/**
 * BlockIndexClient — JS wrapper over the Rust `block_index_*` Tauri commands,
 * with a 500-entry LRU query cache and surgical invalidation via the
 * `lokus:block-index-updated` event.
 *
 * Design doc: docs/plans/2026-04-16-block-identity-foundation-design.md §17
 *
 * Cache keys:
 *   resolve:<id>
 *   file-blocks:<path>
 *   backlinks:<id>
 *   backlinks-for-file:<path>
 *   search:<query>:<limit>
 *
 * On `block-index-updated { file, affected_block_ids, added_refs, removed_refs }`:
 *   - Drop `resolve:<id>` for each affected_block_id
 *   - Drop `file-blocks:<file>`
 *   - Drop `backlinks:<id>` for each added_refs and removed_refs
 *   - Drop all `search:*` (results may have shifted)
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const MAX_CACHE = 500

class LRU {
  constructor(max = MAX_CACHE) {
    this.max = max
    // Native Map preserves insertion order → delete + set refreshes position
    this.map = new Map()
  }

  get(key) {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      this.map.delete(oldest)
    }
  }

  delete(key) {
    this.map.delete(key)
  }

  deletePrefix(prefix) {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key)
    }
  }

  clear() {
    this.map.clear()
  }

  get size() {
    return this.map.size
  }
}

class BlockIndexClient {
  constructor() {
    this.cache = new LRU(MAX_CACHE)
    this.workspacePath = null
    this._eventUnlisten = null
    this._eventPromise = null
    this._listeners = new Set()
  }

  /**
   * Point the client at a workspace. Must be called after workspace opens.
   * Safe to call repeatedly; re-registering the event listener is idempotent.
   */
  async setWorkspace(workspacePath) {
    if (this.workspacePath === workspacePath) return
    this.workspacePath = workspacePath
    this.cache.clear()

    // Re-register event listener on first workspace + after switches.
    if (this._eventUnlisten) {
      try { this._eventUnlisten() } catch (_) { /* swallow */ }
      this._eventUnlisten = null
    }
    if (!this._eventPromise) {
      this._eventPromise = listen('lokus:block-index-updated', (event) => {
        this._onUpdated(event.payload)
      }).then(unlisten => {
        this._eventUnlisten = unlisten
      }).catch(() => { /* no-op if Tauri unavailable */ })
    }
  }

  subscribe(fn) {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  _onUpdated(payload) {
    if (!payload) return
    const {
      file,
      affected_block_ids: affected = [],
      added_refs: added = [],
      removed_refs: removed = [],
    } = payload

    if (file) {
      this.cache.delete(`file-blocks:${file}`)
      this.cache.delete(`backlinks-for-file:${file}`)
    }
    for (const id of affected) {
      this.cache.delete(`resolve:${id}`)
    }
    for (const id of added) {
      this.cache.delete(`backlinks:${id}`)
    }
    for (const id of removed) {
      this.cache.delete(`backlinks:${id}`)
    }
    // Search results can shift on any block change — wipe them conservatively.
    this.cache.deletePrefix('search:')

    // Fan-out to UI subscribers (BacklinksPanel, etc.)
    for (const fn of this._listeners) {
      try { fn(payload) } catch (_) { /* swallow */ }
    }
  }

  _assertReady() {
    if (!this.workspacePath) {
      throw new Error('BlockIndexClient: setWorkspace() must be called first')
    }
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async upsertFile(filePath, blocks) {
    this._assertReady()
    return invoke('block_index_upsert_file', {
      workspacePath: this.workspacePath,
      filePath,
      blocks,
    })
  }

  async deleteFile(filePath) {
    this._assertReady()
    return invoke('block_index_delete_file', {
      workspacePath: this.workspacePath,
      filePath,
    })
  }

  async renameFile(oldPath, newPath) {
    this._assertReady()
    return invoke('block_index_rename_file', {
      workspacePath: this.workspacePath,
      oldPath,
      newPath,
    })
  }

  // ── Reads (cached) ───────────────────────────────────────────────────────

  async resolve(id) {
    this._assertReady()
    const key = `resolve:${id}`
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const result = await invoke('block_index_resolve', {
      workspacePath: this.workspacePath,
      id,
    })
    this.cache.set(key, result)
    return result
  }

  async getFileBlocks(filePath) {
    this._assertReady()
    const key = `file-blocks:${filePath}`
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const result = await invoke('block_index_get_file_blocks', {
      workspacePath: this.workspacePath,
      filePath,
    })
    this.cache.set(key, result)
    return result
  }

  async getBacklinks(targetId) {
    this._assertReady()
    const key = `backlinks:${targetId}`
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const result = await invoke('block_index_get_backlinks', {
      workspacePath: this.workspacePath,
      targetId,
    })
    this.cache.set(key, result)
    return result
  }

  async search(query, limit = 50) {
    this._assertReady()
    const key = `search:${query}:${limit}`
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const result = await invoke('block_index_search', {
      workspacePath: this.workspacePath,
      query,
      limit,
    })
    this.cache.set(key, result)
    return result
  }

  async stats() {
    this._assertReady()
    return invoke('block_index_stats', {
      workspacePath: this.workspacePath,
    })
  }

  // ── Test hooks ───────────────────────────────────────────────────────────

  _clearCache() {
    this.cache.clear()
  }

  _cacheSize() {
    return this.cache.size
  }
}

// Singleton — one client per app, re-pointed on workspace change.
const blockIndexClient = new BlockIndexClient()

export { BlockIndexClient, LRU, blockIndexClient }
export default blockIndexClient
