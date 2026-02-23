/**
 * referenceWorkerClient.js
 *
 * Thin wrapper around reference.worker.js that manages the worker lifecycle
 * and exposes a Promise-based API to the main thread.
 *
 * Usage
 * -----
 *   import { ReferenceWorkerClient } from '@/workers/referenceWorkerClient'
 *
 *   const client = new ReferenceWorkerClient()
 *
 *   // Build a full index (main thread has already read file contents via Tauri)
 *   const index = await client.buildIndex(files)   // files: [{ path, content }]
 *
 *   // Extract refs from a single file on demand
 *   const refs = await client.extractRefs(path, content)
 *
 *   // Clean up when the component/store is torn down
 *   client.terminate()
 */

export class ReferenceWorkerClient {
  constructor() {
    /**
     * Instantiate using the explicit URL constructor so Vite can bundle the
     * worker correctly with code-splitting (matches `worker.format: 'es'` in
     * vite.config.js).  The `{ type: 'module' }` option enables ES module
     * syntax inside the worker file itself.
     */
    this.worker = new Worker(
      new URL('./reference.worker.js', import.meta.url),
      { type: 'module' }
    )

    /** @type {Map<number, { resolve: Function, reject: Function }>} */
    this.pending = new Map()

    /** Monotonically increasing id used to correlate requests with responses */
    this.idCounter = 0

    this.worker.onmessage = (e) => this._handleMessage(e.data)

    this.worker.onerror = (err) => {
      console.error('[ReferenceWorkerClient] Uncaught worker error:', err)
      // Reject all in-flight promises so callers don't hang
      for (const [id, { reject }] of this.pending) {
        reject(new Error(`Worker error: ${err.message ?? 'unknown'}`))
      }
      this.pending.clear()
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Build a full reference index from a list of files.
   *
   * The caller is responsible for reading file contents via Tauri (the worker
   * has no access to the Tauri IPC bridge).
   *
   * @param {{ path: string, content: string }[]} files
   * @returns {Promise<{
   *   forward: Record<string, string[]>,
   *   reverse: Record<string, string[]>,
   *   tags:    Record<string, string[]>,
   *   blocks:  Record<string, string[]>
   * }>}
   */
  buildIndex(files) {
    return new Promise((resolve, reject) => {
      // buildIndex uses a dedicated response type (indexReady) rather than an
      // id correlation, so we store it under the sentinel key -1.
      // Only one buildIndex call should be in flight at a time.
      if (this.pending.has(-1)) {
        reject(new Error('A buildIndex call is already in progress'))
        return
      }
      this.pending.set(-1, { resolve, reject })
      this.worker.postMessage({ type: 'buildIndex', files })
    })
  }

  /**
   * Extract wiki-links, tags, and block refs from a single file's content.
   *
   * @param {string} path    - File path (returned verbatim in the response)
   * @param {string} content - Raw markdown content
   * @returns {Promise<{
   *   wikiLinks: { target: string, embed: boolean }[],
   *   tags:      string[],
   *   blockRefs: string[]
   * }>}
   */
  extractRefs(path, content) {
    const id = this.idCounter++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ type: 'extractRefs', id, path, content })
    })
  }

  /**
   * Terminate the underlying worker.  After this call the client instance
   * must not be used again.
   */
  terminate() {
    this.worker.terminate()
    // Reject any remaining in-flight promises
    for (const [, { reject }] of this.pending) {
      reject(new Error('Worker terminated'))
    }
    this.pending.clear()
  }

  // ---------------------------------------------------------------------------
  // Internal message router
  // ---------------------------------------------------------------------------

  /**
   * @param {{ type: string, id?: number, index?: object, path?: string, refs?: object, message?: string }} data
   */
  _handleMessage(data) {
    switch (data.type) {
      case 'indexReady': {
        const entry = this.pending.get(-1)
        if (entry) {
          this.pending.delete(-1)
          entry.resolve(data.index)
        }
        break
      }

      case 'refsExtracted': {
        const entry = this.pending.get(data.id)
        if (entry) {
          this.pending.delete(data.id)
          entry.resolve(data.refs)
        }
        break
      }

      case 'error': {
        // id === null means an unattributed error from buildIndex or unknown msg
        const key = data.id != null ? data.id : -1
        const entry = this.pending.get(key)
        if (entry) {
          this.pending.delete(key)
          entry.reject(new Error(data.message))
        } else {
          console.error('[ReferenceWorkerClient] Unhandled worker error:', data.message)
        }
        break
      }

      default:
        console.warn('[ReferenceWorkerClient] Unknown message from worker:', data)
    }
  }
}
