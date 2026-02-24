/**
 * referenceWorkerClient.js
 *
 * Thin wrapper around reference.worker.js that manages the worker lifecycle
 * and exposes a Promise-based API to the main thread.
 *
 * Usage
 * -----
 *   import referenceWorkerClient from '@/workers/referenceWorkerClient'
 *
 *   // Build a full index (main thread has already read file contents via Tauri)
 *   await referenceWorkerClient.buildIndex(files)   // files: [{ path, content }]
 *
 *   // Look up which files link to a given path (synchronous, uses cached index)
 *   const sources = referenceWorkerClient.getBacklinksForFile('/workspace/notes/MyNote.md')
 *
 *   // Extract refs from a single file on demand
 *   const refs = await referenceWorkerClient.extractRefs(path, content)
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

    /**
     * Cached index returned by the last successful buildIndex call.
     *
     * Shape:
     *   forward: Record<string, string[]>  — path → outgoing wiki-link targets
     *   reverse: Record<string, string[]>  — target name → source paths
     *   tags:    Record<string, string[]>  — path → tag list
     *   blocks:  Record<string, string[]>  — path → block id list
     *
     * The reverse index keys are the raw wiki-link target strings extracted by
     * the worker (e.g. "MyNote", "folder/MyNote").  To find all files that link
     * to a given absolute path we match against the file's basename (with and
     * without .md extension) and any relative sub-path suffix.
     *
     * @type {{ forward: Object, reverse: Object, tags: Object, blocks: Object } | null}
     */
    this._index = null

    this.worker.onmessage = (e) => this._handleMessage(e.data)

    this.worker.onerror = (err) => {
      console.error('[ReferenceWorkerClient] Uncaught worker error:', err)
      // Reject all in-flight promises so callers don't hang
      for (const [, { reject }] of this.pending) {
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
   * After this promise resolves the index is also cached locally so that
   * getBacklinksForFile() can answer without a worker round-trip.
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
   * Synchronous lookup: return all source file paths that contain a wiki-link
   * pointing to the file at `absolutePath`.
   *
   * Uses the index cached from the last buildIndex() call.  Returns an empty
   * array if the index has not been built yet or no backlinks are found.
   *
   * The worker stores reverse entries keyed by the raw wiki-link target text
   * (e.g. "MyNote", "folder/MyNote", "MyNote.md").  We normalise `absolutePath`
   * to every possible form a wiki-link author might have typed and union the
   * results.
   *
   * @param {string} absolutePath - Absolute path of the file to look up
   * @returns {string[]}          - Deduplicated list of source file paths
   */
  getBacklinksForFile(absolutePath) {
    if (!this._index || !this._index.reverse) return []

    const reverse = this._index.reverse

    // Derive lookup keys from the absolute path
    const parts = absolutePath.split('/')
    const basename = parts[parts.length - 1]            // "MyNote.md"
    const basenameNoExt = basename.replace(/\.md$/i, '') // "MyNote"

    // Workspace-relative sub-paths (every suffix of the path segments)
    // e.g. for /ws/folder/sub/MyNote.md we check:
    //   "MyNote.md", "MyNote", "sub/MyNote.md", "sub/MyNote",
    //   "folder/sub/MyNote.md", "folder/sub/MyNote"
    const keysToCheck = new Set([basename, basenameNoExt])

    for (let i = parts.length - 2; i >= 1; i--) {
      const suffix = parts.slice(i).join('/')
      keysToCheck.add(suffix)                            // "sub/MyNote.md"
      keysToCheck.add(suffix.replace(/\.md$/i, ''))     // "sub/MyNote"
    }

    const sources = new Set()
    for (const key of keysToCheck) {
      const list = reverse[key]
      if (Array.isArray(list)) {
        for (const src of list) {
          if (src !== absolutePath) {
            sources.add(src)
          }
        }
      }
    }

    return Array.from(sources)
  }

  /**
   * Check whether the index has been built at least once.
   * @returns {boolean}
   */
  isIndexed() {
    return this._index !== null
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
    this._index = null
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
          // Cache the index for synchronous backlink lookups
          this._index = data.index
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

/**
 * Singleton worker client instance.
 *
 * Import this directly instead of instantiating ReferenceWorkerClient yourself:
 *
 *   import referenceWorkerClient from '@/workers/referenceWorkerClient'
 */
const referenceWorkerClient = new ReferenceWorkerClient()
export default referenceWorkerClient
