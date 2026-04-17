/**
 * BlockIdAutoAssign — ProseMirror plugin that assigns a durable ID to every
 * block node as soon as it appears in the document.
 *
 * Unlike `BlockId.js` (which only detects user-typed `^id` markers), this
 * plugin generates IDs proactively. IDs are written to PM doc attrs, NOT to
 * the markdown file — the markdown stays clean. The SQLite index is populated
 * on save by `BlockIndexClient.upsertFile()`.
 *
 * Design doc: docs/plans/2026-04-16-block-identity-foundation-design.md §4
 *
 * Idempotent: nodes that already have `blockId` are skipped. Runs in
 * `appendTransaction` so it only emits a transaction when something actually
 * changes, avoiding infinite loops.
 */

import { Plugin, PluginKey } from 'prosemirror-state'
import { generateBlockId } from '../../core/blocks/id.js'

export const blockIdAutoAssignKey = new PluginKey('blockIdAutoAssign')

let _appendCount = 0

/**
 * Create the BlockIdAutoAssign plugin.
 * @returns {Plugin}
 */
export function createBlockIdAutoAssignPlugin() {
  return new Plugin({
    key: blockIdAutoAssignKey,

    appendTransaction(transactions, oldState, newState) {
      const docChanged = transactions.some(t => t.docChanged)
      if (!docChanged) return null

      // Hard guard: if PM calls appendTransaction more than 50 times in rapid
      // succession without a user-initiated transaction in between, bail out.
      // This prevents any theoretical infinite loop from freezing the app.
      _appendCount++
      if (_appendCount > 50) {
        console.warn('[BlockIdAutoAssign] appendTransaction called >50 times, bailing')
        return null
      }
      // Reset counter on next microtask (user transactions come async)
      if (_appendCount === 1) {
        queueMicrotask(() => { _appendCount = 0 })
      }

      console.log('[BlockIdAutoAssign] appendTransaction called, round:', _appendCount)

      const tr = newState.tr
      let modified = false
      const seen = new Set()
      let nodeCount = 0

      newState.doc.descendants((node, pos) => {
        if (!node.type.spec.attrs || !('blockId' in node.type.spec.attrs)) {
          return
        }

        // Safety cap — no doc should have >5000 blocks
        nodeCount++
        if (nodeCount > 5000) return false

        const existing = node.attrs.blockId
        if (!existing || seen.has(existing)) {
          const id = generateBlockId()
          tr.setNodeMarkup(pos, null, { ...node.attrs, blockId: id })
          seen.add(id)
          modified = true
        } else {
          seen.add(existing)
        }
      })

      return modified ? tr : null
    },
  })
}

export default createBlockIdAutoAssignPlugin
