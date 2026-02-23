/**
 * reference.worker.js
 *
 * Web Worker for parallel reference index builds off the main thread.
 *
 * The main thread reads file contents via Tauri invoke and sends them here.
 * This worker handles all regex extraction and index construction so the UI
 * thread stays unblocked during large workspace scans.
 *
 * Message protocol
 * ----------------
 * Receive:
 *   { type: 'buildIndex',   files: [{ path: string, content: string }] }
 *   { type: 'extractRefs',  id: number, path: string, content: string }
 *
 * Send:
 *   { type: 'indexReady',    index: { forward, reverse, tags, blocks } }
 *   { type: 'refsExtracted', id: number, path: string, refs: { wikiLinks, tags, blockRefs } }
 *   { type: 'error',         id: number | null, message: string }
 */

// ---------------------------------------------------------------------------
// Regex patterns (mirrors ReferenceManager constants)
// ---------------------------------------------------------------------------

/** Matches [[target]], [[target|alias]], ![[target]], [[target#heading]], [[target^block]] */
const WIKI_LINK_RE = /!?\[\[([^\]|#^]+)(?:[|#^][^\]]*?)?\]\]/g

/** Matches #tag, #nested/tag, #tag_with_underscores */
const TAG_RE = /(?:^|\s)#([a-zA-Z0-9_/-]+)/g

/** Matches ^blockId at the end of a line */
const BLOCK_REF_RE = /\^([a-zA-Z0-9-]+)/g

// Batch size for parallel-style processing
const BATCH_SIZE = 20

// ---------------------------------------------------------------------------
// Pure extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract wiki-link targets from markdown content.
 * Handles [[target]], [[target|alias]], ![[embed]], [[target#heading]], [[target^block]].
 *
 * @param {string} content
 * @returns {{ target: string, embed: boolean, alias: string | null }[]}
 */
function extractWikiLinks(content) {
  const results = []
  const re = new RegExp(WIKI_LINK_RE.source, 'g')
  let match

  while ((match = re.exec(content)) !== null) {
    const fullMatch = match[0]
    const target = match[1].trim()
    results.push({
      target,
      embed: fullMatch.startsWith('!'),
    })
  }

  return results
}

/**
 * Extract #tags from markdown content.
 *
 * @param {string} content
 * @returns {string[]}
 */
function extractTags(content) {
  const results = []
  const re = new RegExp(TAG_RE.source, 'gm')
  let match

  while ((match = re.exec(content)) !== null) {
    results.push(match[1])
  }

  return results
}

/**
 * Extract ^blockId references from markdown content.
 *
 * @param {string} content
 * @returns {string[]}
 */
function extractBlockRefs(content) {
  const results = []
  const re = new RegExp(BLOCK_REF_RE.source, 'g')
  let match

  while ((match = re.exec(content)) !== null) {
    results.push(match[1])
  }

  return results
}

// ---------------------------------------------------------------------------
// Index builder
// ---------------------------------------------------------------------------

/**
 * Process a single file and accumulate results into the shared index maps.
 *
 * @param {{ path: string, content: string }} file
 * @param {Map<string, string[]>} forward   path → outgoing wiki-link targets
 * @param {Map<string, string[]>} reverse   target → source paths that link to it
 * @param {Map<string, string[]>} tags      path → tag list
 * @param {Map<string, string[]>} blocks    path → block id list
 */
function processFile(file, forward, reverse, tags, blocks) {
  const { path, content } = file

  const wikiLinks = extractWikiLinks(content)
  const fileTags = extractTags(content)
  const fileBlocks = extractBlockRefs(content)

  // Forward index: which targets does this file point to?
  const targets = wikiLinks.map((l) => l.target)
  forward.set(path, targets)

  // Reverse index: for each target, record this file as a source
  for (const target of targets) {
    if (!reverse.has(target)) {
      reverse.set(target, [])
    }
    reverse.get(target).push(path)
  }

  tags.set(path, fileTags)
  blocks.set(path, fileBlocks)
}

/**
 * Build the full reference index from an array of { path, content } entries.
 * Files are processed in batches of BATCH_SIZE. Because JS is single-threaded
 * inside the worker, this is synchronous batch iteration — but it mirrors the
 * Promise.all pattern the main thread would use for true concurrency across
 * multiple workers in a future multi-worker expansion.
 *
 * @param {{ path: string, content: string }[]} files
 * @returns {{ forward: Object, reverse: Object, tags: Object, blocks: Object }}
 */
function buildIndex(files) {
  const forward = new Map()
  const reverse = new Map()
  const tags = new Map()
  const blocks = new Map()

  // Process in batches so progress events could be inserted later
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)
    for (const file of batch) {
      try {
        processFile(file, forward, reverse, tags, blocks)
      } catch (err) {
        // Non-fatal: skip the bad file but keep processing the rest
        console.error(`[reference.worker] Failed to process ${file.path}:`, err)
      }
    }
  }

  // Convert Maps to plain objects for structured-clone transfer
  return {
    forward: Object.fromEntries(forward),
    reverse: Object.fromEntries(reverse),
    tags: Object.fromEntries(tags),
    blocks: Object.fromEntries(blocks),
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event) => {
  const data = event.data

  if (!data || typeof data.type !== 'string') {
    self.postMessage({ type: 'error', id: null, message: 'Invalid message format' })
    return
  }

  switch (data.type) {
    case 'buildIndex': {
      try {
        const files = Array.isArray(data.files) ? data.files : []
        const index = buildIndex(files)
        self.postMessage({ type: 'indexReady', index })
      } catch (err) {
        self.postMessage({ type: 'error', id: null, message: err.message })
      }
      break
    }

    case 'extractRefs': {
      const { id, path, content } = data
      try {
        const wikiLinks = extractWikiLinks(content)
        const tags = extractTags(content)
        const blockRefs = extractBlockRefs(content)
        self.postMessage({
          type: 'refsExtracted',
          id,
          path,
          refs: { wikiLinks, tags, blockRefs },
        })
      } catch (err) {
        self.postMessage({ type: 'error', id, message: err.message })
      }
      break
    }

    default:
      self.postMessage({
        type: 'error',
        id: data.id ?? null,
        message: `Unknown message type: ${data.type}`,
      })
  }
}
