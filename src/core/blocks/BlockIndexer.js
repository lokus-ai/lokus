/**
 * BlockIndexer — extract block records from a ProseMirror document for the
 * SQLite index.
 *
 * The PM doc is the source of truth for identity during an editing session
 * (block IDs live in node attrs, assigned by BlockIdAutoAssign). This module
 * walks that doc and produces the flat record list the Rust side expects.
 *
 * Design doc: docs/plans/2026-04-16-block-identity-foundation-design.md §1, §6
 */

const TEXT_PREVIEW_MAX = 200
const CHECKSUM_LENGTH = 12 // first 12 hex chars of SHA-1

/**
 * Compute a short SHA-1 checksum of a string. Used for block diffing on
 * re-parse (match old→new by position + checksum to carry forward IDs).
 */
async function checksumAsync(text) {
  const enc = new TextEncoder().encode(text)
  // `crypto.subtle.digest` is available in Tauri webview.
  const buf = await crypto.subtle.digest('SHA-1', enc)
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length && hex.length < CHECKSUM_LENGTH; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex.slice(0, CHECKSUM_LENGTH)
}

/**
 * Synchronous fallback for tests / environments without crypto.subtle.
 * NOT cryptographic, just stable.
 */
function checksumSync(text) {
  // djb2 → hex
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return h.toString(16).padStart(CHECKSUM_LENGTH, '0').slice(0, CHECKSUM_LENGTH)
}

function nodeTextPreview(node) {
  const text = node.textContent || ''
  // Strip the user-typed `^blockid` trailing marker from the preview so two
  // blocks that differ only by that marker don't produce different checksums
  // on round-trip.
  return text.replace(/\s+\^[a-zA-Z0-9_-]+\s*$/, '').slice(0, TEXT_PREVIEW_MAX)
}

/**
 * Extract the target block ID from a wikiLink's `target` attr.
 * Format: "File" (no ref) or "File^blockid" (block ref) or "File#heading" (heading ref, not a block).
 * Returns block id or null.
 */
function extractBlockRef(target) {
  if (!target || typeof target !== 'string') return null
  const idx = target.indexOf('^')
  if (idx === -1) return null
  const id = target.slice(idx + 1).split('|')[0].trim()
  return id || null
}

/**
 * Walk the PM doc and extract outgoing refs keyed by the containing block's ID.
 * Handles both inline `wikiLink` nodes with `^id` targets and `wikiLinkEmbed`
 * block nodes (which are themselves refs).
 *
 * Returns Map<sourceBlockId, [{targetBlockId, kind}]>.
 */
function collectRefs(doc) {
  const refs = new Map()
  const blockStack = []

  doc.descendants((node, pos, parent) => {
    const isBlockWithId =
      node.type.spec.attrs && 'blockId' in node.type.spec.attrs
    // Maintain a stack of ancestor blocks so we attribute refs to the
    // innermost block that owns them.
    // When re-entering a new block, pop ancestors we've left.
    while (blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1]
      if (pos < top.pos || pos >= top.pos + top.size) {
        blockStack.pop()
      } else {
        break
      }
    }

    if (isBlockWithId && node.attrs.blockId) {
      blockStack.push({
        id: node.attrs.blockId,
        pos,
        size: node.nodeSize,
      })
    }

    const currentBlock = blockStack[blockStack.length - 1]

    // wikiLinkEmbed is itself the source block (atom), ref goes FROM it
    if (node.type.name === 'wikiLinkEmbed' && node.attrs.blockId) {
      const targetId = node.attrs.blockId // embed's blockId is the referenced block
      if (targetId) {
        const list = refs.get(node.attrs.blockId) || []
        // Note: wikiLinkEmbed's own blockId is for the target block, not the
        // embed itself. We don't have a stable id for the embed position
        // (atom, no editable attrs), so we attribute to the nearest textblock
        // ancestor instead.
        if (currentBlock) {
          const parentList = refs.get(currentBlock.id) || []
          parentList.push({ targetBlockId: targetId, kind: 'embed' })
          refs.set(currentBlock.id, parentList)
        }
      }
    }

    // Inline wikiLink with ^blockid
    if (node.type.name === 'wikiLink' && currentBlock) {
      const targetId = extractBlockRef(node.attrs.target || node.attrs.href || '')
      if (targetId) {
        const parentList = refs.get(currentBlock.id) || []
        parentList.push({ targetBlockId: targetId, kind: 'link' })
        refs.set(currentBlock.id, parentList)
      }
    }
  })

  return refs
}

/**
 * Extract flat block records from a PM doc.
 *
 * @param {import('prosemirror-model').Node} doc
 * @param {object} [options]
 * @param {Function} [options.checksum] — async string → string. Defaults to SHA-1.
 * @returns {Promise<Array<{id, nodeType, level, textPreview, position, checksum, parentId, outgoingRefs}>>}
 */
export async function extractBlocks(doc, options = {}) {
  const checksum = options.checksum || checksumAsync
  const refs = collectRefs(doc)
  const records = []
  const parentStack = []
  let position = 0

  const promises = []
  doc.descendants((node, pos) => {
    if (!node.type.spec.attrs || !('blockId' in node.type.spec.attrs)) {
      return
    }
    const id = node.attrs.blockId
    if (!id) return // Not yet assigned — auto-assign plugin hasn't run

    // Maintain parent stack by position
    while (parentStack.length > 0) {
      const top = parentStack[parentStack.length - 1]
      if (pos < top.pos || pos >= top.pos + top.size) {
        parentStack.pop()
      } else {
        break
      }
    }

    const parentId = parentStack.length > 0
      ? parentStack[parentStack.length - 1].id
      : null

    const textPreview = nodeTextPreview(node)
    const record = {
      id,
      nodeType: node.type.name,
      level: typeof node.attrs.level === 'number' ? node.attrs.level : null,
      textPreview,
      position: position++,
      checksumPromise: checksum(`${node.type.name}|${textPreview}`),
      parentId,
      outgoingRefs: refs.get(id) || [],
    }
    records.push(record)
    parentStack.push({ id, pos, size: node.nodeSize })
  })

  await Promise.all(records.map(async r => {
    r.checksum = await r.checksumPromise
    delete r.checksumPromise
  }))

  return records
}

/**
 * Synchronous variant for tests and environments without crypto.subtle.
 */
export function extractBlocksSync(doc) {
  const refs = collectRefs(doc)
  const records = []
  const parentStack = []
  let position = 0

  doc.descendants((node, pos) => {
    if (!node.type.spec.attrs || !('blockId' in node.type.spec.attrs)) {
      return
    }
    const id = node.attrs.blockId
    if (!id) return

    while (parentStack.length > 0) {
      const top = parentStack[parentStack.length - 1]
      if (pos < top.pos || pos >= top.pos + top.size) {
        parentStack.pop()
      } else {
        break
      }
    }

    const parentId = parentStack.length > 0
      ? parentStack[parentStack.length - 1].id
      : null

    const textPreview = nodeTextPreview(node)
    records.push({
      id,
      nodeType: node.type.name,
      level: typeof node.attrs.level === 'number' ? node.attrs.level : null,
      textPreview,
      position: position++,
      checksum: checksumSync(`${node.type.name}|${textPreview}`),
      parentId,
      outgoingRefs: refs.get(id) || [],
    })
    parentStack.push({ id, pos, size: node.nodeSize })
  })

  return records
}

export default extractBlocks
