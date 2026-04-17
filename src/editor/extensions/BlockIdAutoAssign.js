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

/**
 * Create the BlockIdAutoAssign plugin.
 * @returns {Plugin}
 */
export function createBlockIdAutoAssignPlugin() {
  return new Plugin({
    key: blockIdAutoAssignKey,

    appendTransaction(transactions, oldState, newState) {
      // Skip if nothing relevant changed — critical for idempotency
      const docChanged = transactions.some(t => t.docChanged)
      if (!docChanged) return null

      const tr = newState.tr
      let modified = false
      const seen = new Set()

      newState.doc.descendants((node, pos) => {
        // Only nodes that declare a blockId attr in their schema spec
        if (!node.type.spec.attrs || !('blockId' in node.type.spec.attrs)) {
          return
        }
        const existing = node.attrs.blockId
        // Assign if missing OR if duplicate within the same document
        // (duplicates can arise from paste operations copying node attrs).
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
