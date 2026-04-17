/**
 * BlockIndexBootstrap — first-run workspace indexer.
 *
 * On upgrade (or first launch with block_index_v1 ON), walks every .md file
 * in the workspace, parses it into a ProseMirror doc, extracts block records,
 * and upserts them into the SQLite index.
 *
 * Designed to run once. Checks block_index_stats() first — if blocks already
 * exist, skips the rebuild. Emits progress events so the UI can show
 * "Indexing 42/100" in the status bar.
 *
 * Yields to the main thread between files (requestIdleCallback / setTimeout)
 * so the editor stays responsive.
 *
 * Design doc: docs/plans/2026-04-16-block-identity-foundation-design.md §7
 */

import { invoke } from '@tauri-apps/api/core'
import { createLokusParser } from '../markdown/lokus-md-pipeline.js'
import { lokusSchema } from '../../editor/schema/lokus-schema.js'
import { extractBlocksSync } from './BlockIndexer.js'
import blockIndexClient from './BlockIndexClient.js'

const BATCH_CONCURRENCY = 10

const parser = createLokusParser(lokusSchema)

function yieldToMain() {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(resolve, { timeout: 50 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

function emitProgress(processed, total, currentFile) {
  try {
    window.dispatchEvent(
      new CustomEvent('lokus:block-index-progress', {
        detail: { processed, total, currentFile, done: processed >= total },
      })
    )
  } catch { /* swallow in non-browser */ }
}

function flattenMdFiles(tree) {
  const files = []
  const walk = (entries) => {
    for (const entry of entries) {
      if (entry.is_directory) {
        if (entry.name === '.lokus' || entry.name === 'node_modules' || entry.name === '.git') continue
        if (entry.children) walk(entry.children)
      } else if (entry.path?.endsWith('.md')) {
        files.push(entry.path)
      }
    }
  }
  walk(tree)
  return files
}

/**
 * Run the first-time block index rebuild.
 *
 * @param {string} workspacePath
 * @param {object} [options]
 * @param {boolean} [options.force] — rebuild even if index is non-empty
 * @returns {Promise<{ indexed: number, skipped: boolean }>}
 */
export async function bootstrapBlockIndex(workspacePath, options = {}) {
  if (!workspacePath) return { indexed: 0, skipped: true }

  await blockIndexClient.setWorkspace(workspacePath)

  // Check if index is already populated
  if (!options.force) {
    try {
      const stats = await blockIndexClient.stats()
      if (stats.blocks > 0) {
        return { indexed: 0, skipped: true }
      }
    } catch {
      // stats call failed — Tauri not ready or DB issue. Skip silently.
      return { indexed: 0, skipped: true }
    }
  }

  // Get file tree from Rust
  let fileTree
  try {
    fileTree = await invoke('read_workspace_files', { workspacePath })
  } catch {
    return { indexed: 0, skipped: true }
  }

  const mdFiles = flattenMdFiles(fileTree)
  const total = mdFiles.length

  if (total === 0) {
    emitProgress(0, 0, null)
    return { indexed: 0, skipped: false }
  }

  emitProgress(0, total, null)

  let indexed = 0

  // Process in batches to limit concurrency and memory
  for (let i = 0; i < mdFiles.length; i += BATCH_CONCURRENCY) {
    const batch = mdFiles.slice(i, i + BATCH_CONCURRENCY)

    const results = await Promise.allSettled(
      batch.map(async (filePath) => {
        try {
          const content = await invoke('read_file_content', { path: filePath })
          if (!content || typeof content !== 'string') return

          const doc = parser.parse(content)
          if (!doc) return

          const blocks = extractBlocksSync(doc)
          if (blocks.length === 0) return

          await blockIndexClient.upsertFile(filePath, blocks)
        } catch {
          // Per-file failure is non-fatal — skip and continue.
        }
      })
    )

    indexed += results.filter(r => r.status === 'fulfilled').length
    emitProgress(Math.min(i + batch.length, total), total, batch[batch.length - 1])

    // Yield to main thread so the UI stays responsive
    await yieldToMain()
  }

  emitProgress(total, total, null)

  return { indexed, skipped: false }
}

export default bootstrapBlockIndex
