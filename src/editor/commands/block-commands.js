/**
 * block-commands.js
 *
 * Pure ProseMirror commands for block-level operations.
 * Each exported command follows the standard PM signature:
 *   (state, dispatch, view?) => boolean
 *
 * "Returns true" means the command is applicable and was (or would be)
 * dispatched. When `dispatch` is null the command performs a dry run
 * (capability check only) — never mutate state in that case.
 */

import { NodeSelection, TextSelection } from 'prosemirror-state'
import { generateBlockId } from '../../core/blocks/id.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the outermost block node that is a direct child of the document root
 * (depth 1), starting from the resolved position `$pos`.
 *
 * Returns `{ node, pos }` where `pos` is the absolute position *before* the
 * node (suitable for tr.setNodeMarkup, tr.delete, etc.), or null if nothing
 * was found.
 *
 * @param {import('prosemirror-state').ResolvedPos} $pos
 * @returns {{ node: import('prosemirror-model').Node, pos: number } | null}
 */
function findRootBlock($pos) {
  // Walk up until we are a direct child of the doc (depth 1).
  for (let d = $pos.depth; d >= 1; d--) {
    if ($pos.node(d - 1).type.name === 'doc') {
      return { node: $pos.node(d), pos: $pos.before(d) }
    }
  }
  return null
}

/**
 * Derive the root-level block from the current selection.
 * Works for both TextSelection and NodeSelection.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @returns {{ node: import('prosemirror-model').Node, pos: number } | null}
 */
function blockFromSelection(state) {
  const { selection } = state

  if (selection instanceof NodeSelection) {
    // If this IS a top-level node, return it directly.
    const $anchor = selection.$anchor
    if ($anchor.depth === 1) {
      return { node: selection.node, pos: selection.from }
    }
  }

  const $from = selection.$from
  return findRootBlock($from)
}

// ---------------------------------------------------------------------------
// turnInto
// ---------------------------------------------------------------------------

/**
 * Returns a PM command that converts the block at the current selection to
 * `newType` with `attrs`.  The existing blockId is always preserved.
 *
 * Special behaviour:
 *   - heading → heading of same level: cycles level 1→2→3→1.
 *   - any → heading: defaults to level 1 if attrs.level is omitted.
 *   - any → codeBlock: wraps the block's inline text as raw text content.
 *
 * @param {import('prosemirror-model').NodeType} newType
 * @param {Object} [attrs]
 * @returns {(state: import('prosemirror-state').EditorState, dispatch?: Function, view?: import('prosemirror-view').EditorView) => boolean}
 */
export function turnInto(newType, attrs = {}) {
  return function (state, dispatch) {
    const block = blockFromSelection(state)
    if (!block) return false

    const { node, pos } = block

    // Preserve blockId from the current block if the target type supports it.
    const oldBlockId = node.attrs?.blockId ?? null
    const newAttrs = { ...attrs }
    if (oldBlockId !== undefined) {
      newAttrs.blockId = oldBlockId
    }

    // Heading-level cycling: if already a heading of the same level, cycle.
    if (newType.name === 'heading') {
      if (!newAttrs.level) newAttrs.level = 1
      if (node.type.name === 'heading' && node.attrs.level === newAttrs.level) {
        newAttrs.level = newAttrs.level >= 3 ? 1 : newAttrs.level + 1
      }
    }

    // Verify the new node type can accept the current content.
    // setNodeMarkup will throw if content is invalid — guard with canSetNodeMarkup.
    if (!newType.validContent(node.content)) {
      // For incompatible content (e.g. codeBlock which only accepts text*),
      // extract the text of the node and use that as plain content.
      const textContent = node.textContent
      if (dispatch) {
        const textNode = textContent ? state.schema.text(textContent) : null
        const newContent = textNode
          ? state.schema.nodes[newType.name]?.create
            ? newType.createAndFill(newAttrs, textNode)
            : null
          : newType.createAndFill(newAttrs)

        if (!newContent) return false

        const tr = state.tr.replaceWith(pos, pos + node.nodeSize, newContent)
        tr.scrollIntoView()
        dispatch(tr)
      }
      return true
    }

    if (dispatch) {
      const tr = state.tr.setNodeMarkup(pos, newType, newAttrs)
      tr.scrollIntoView()
      dispatch(tr)
    }
    return true
  }
}

// ---------------------------------------------------------------------------
// duplicateBlock
// ---------------------------------------------------------------------------

/**
 * Duplicate the block at the current selection.
 * The copy is inserted immediately after the original and receives a fresh
 * blockId.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} [dispatch]
 * @returns {boolean}
 */
export function duplicateBlock(state, dispatch) {
  const block = blockFromSelection(state)
  if (!block) return false

  const { node, pos } = block
  const endPos = pos + node.nodeSize

  if (dispatch) {
    // Deep copy the node and assign a fresh blockId.
    const freshId = generateBlockId()
    let copy = node.copy(node.content)

    // Patch the blockId attribute on the copy if the node type has it.
    if (copy.attrs && 'blockId' in copy.attrs) {
      copy = copy.type.create({ ...copy.attrs, blockId: freshId }, copy.content, copy.marks)
    }

    const tr = state.tr.insert(endPos, copy)

    // After inserting at `endPos`, the duplicate block starts at exactly
    // `endPos` in the new document (the original block is unchanged before
    // it). We step one position inside the block to land the cursor there.
    // Clamp to the doc size to avoid out-of-range errors (e.g. atom nodes
    // where endPos+1 might exceed the new doc size).
    const newBlockInner = Math.min(endPos + 1, tr.doc.content.size - 1)
    const $newStart = tr.doc.resolve(newBlockInner)
    tr.setSelection(TextSelection.near($newStart))
    tr.scrollIntoView()
    dispatch(tr)
  }
  return true
}

// ---------------------------------------------------------------------------
// deleteBlock
// ---------------------------------------------------------------------------

/**
 * Delete the block at the current selection.
 * If deleting would leave the document empty (i.e. only one child block),
 * replace it with an empty paragraph instead of deleting it outright.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} [dispatch]
 * @returns {boolean}
 */
export function deleteBlock(state, dispatch) {
  const block = blockFromSelection(state)
  if (!block) return false

  const { node, pos } = block
  const isLastBlock = state.doc.childCount === 1

  if (dispatch) {
    const tr = state.tr

    if (isLastBlock) {
      // Replace with empty paragraph to keep the doc valid.
      const emptyPara = state.schema.nodes.paragraph.create()
      tr.replaceWith(pos, pos + node.nodeSize, emptyPara)
      // Place cursor inside the new paragraph.
      const $newPos = tr.doc.resolve(pos + 1)
      tr.setSelection(TextSelection.near($newPos))
    } else {
      tr.delete(pos, pos + node.nodeSize)
      // Keep cursor in document bounds.
      const safePos = Math.min(pos, tr.doc.content.size - 1)
      const $safe = tr.doc.resolve(Math.max(0, safePos))
      tr.setSelection(TextSelection.near($safe))
    }

    tr.scrollIntoView()
    dispatch(tr)
  }
  return true
}

// ---------------------------------------------------------------------------
// moveBlockUp
// ---------------------------------------------------------------------------

/**
 * Swap the block at the selection with its previous sibling.
 * Preserves the selection on the moved block.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} [dispatch]
 * @returns {boolean}
 */
export function moveBlockUp(state, dispatch) {
  const block = blockFromSelection(state)
  if (!block) return false

  const { node, pos } = block
  const doc = state.doc

  // Find the index of this block among doc's children.
  let blockIndex = -1
  let offset = 0
  doc.forEach((child, childOffset, index) => {
    if (childOffset === pos) {
      blockIndex = index
      offset = childOffset
    }
  })

  if (blockIndex <= 0) return false // already first block

  // Get the previous sibling.
  const prevNode = doc.child(blockIndex - 1)
  let prevOffset = 0
  doc.forEach((child, childOffset, index) => {
    if (index === blockIndex - 1) prevOffset = childOffset
  })

  if (dispatch) {
    // We need to swap the two nodes.
    // Strategy: replace the range [prevOffset, pos + node.nodeSize] with
    // [node, prevNode] — the current block moved before the previous block.
    const from = prevOffset
    const to = pos + node.nodeSize

    const tr = state.tr.replaceWith(from, to, [node, prevNode])

    // The moved block now starts at `from`. Place cursor inside it.
    const $movedStart = tr.doc.resolve(from + 1)
    tr.setSelection(TextSelection.near($movedStart))
    tr.scrollIntoView()
    dispatch(tr)
  }
  return true
}

// ---------------------------------------------------------------------------
// moveBlockDown
// ---------------------------------------------------------------------------

/**
 * Swap the block at the selection with its next sibling.
 * Preserves the selection on the moved block.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} [dispatch]
 * @returns {boolean}
 */
export function moveBlockDown(state, dispatch) {
  const block = blockFromSelection(state)
  if (!block) return false

  const { node, pos } = block
  const doc = state.doc

  let blockIndex = -1
  doc.forEach((child, childOffset, index) => {
    if (childOffset === pos) blockIndex = index
  })

  if (blockIndex < 0 || blockIndex >= doc.childCount - 1) return false // already last

  const nextNode = doc.child(blockIndex + 1)
  let nextOffset = 0
  doc.forEach((child, childOffset, index) => {
    if (index === blockIndex + 1) nextOffset = childOffset
  })

  if (dispatch) {
    const from = pos
    const to = nextOffset + nextNode.nodeSize

    // Swap: [nextNode, node]
    const tr = state.tr.replaceWith(from, to, [nextNode, node])

    // After the swap, `node` now starts at `from + nextNode.nodeSize`.
    // The +2 accounts for the opening token of nextNode.
    const movedPos = from + nextNode.nodeSize
    const $movedStart = tr.doc.resolve(movedPos + 1)
    tr.setSelection(TextSelection.near($movedStart))
    tr.scrollIntoView()
    dispatch(tr)
  }
  return true
}

// ---------------------------------------------------------------------------
// copyBlockLink
// ---------------------------------------------------------------------------

/**
 * Copy a wiki-style block link (`[[filename^blockId]]`) to the clipboard.
 *
 * The filename is derived (in priority order) from:
 *   1. `globalThis.__LOKUS_CURRENT_FILE__`
 *   2. The `data-file-path` attribute on the nearest ancestor DOM element.
 *
 * This command always returns true when the block has a blockId; it relies on
 * the Clipboard API (async). In test environments where `navigator.clipboard`
 * is absent it will log a warning and still return true.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} [dispatch]
 * @param {import('prosemirror-view').EditorView} [view]
 * @returns {boolean}
 */
export function copyBlockLink(state, dispatch, view) {
  const block = blockFromSelection(state)
  if (!block) return false

  const { node } = block
  const blockId = node.attrs?.blockId
  if (!blockId) return false

  // Resolve file path / name.
  let filePath =
    globalThis.__LOKUS_CURRENT_FILE__ ||
    (view?.dom?.closest('[data-file-path]')?.getAttribute('data-file-path')) ||
    ''

  const fileName = filePath
    ? filePath.split('/').pop().replace(/\.md$/i, '')
    : 'unknown'

  const link = `[[${fileName}^${blockId}]]`

  if (dispatch) {
    // The dispatch call is a no-op here (we have nothing to dispatch to PM),
    // but we call it to satisfy the PM command contract (commands that do
    // something should call dispatch with *some* tr — use a no-change tr).
    dispatch(state.tr)
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(link).catch((err) => {
      console.warn('[copyBlockLink] clipboard write failed:', err)
    })
  } else {
    console.warn('[copyBlockLink] clipboard API not available. Link:', link)
  }

  return true
}

// ---------------------------------------------------------------------------
// selectBlock
// ---------------------------------------------------------------------------

/**
 * Create a NodeSelection for the block containing the cursor.
 * Useful for drag-and-drop handles and block-level operations that need the
 * full node selected.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} [dispatch]
 * @returns {boolean}
 */
export function selectBlock(state, dispatch) {
  const block = blockFromSelection(state)
  if (!block) return false

  const { pos } = block

  // Resolve the position before the block node.
  const $pos = state.doc.resolve(pos)

  // NodeSelection requires that the position points to a selectable node.
  // Some nodes (e.g. inline atoms) are always selectable; block nodes are too
  // unless their spec sets `selectable: false`. All Lokus root-level block
  // nodes are selectable by default.
  if (dispatch) {
    const sel = NodeSelection.create(state.doc, pos)
    const tr = state.tr.setSelection(sel).scrollIntoView()
    dispatch(tr)
  }
  return true
}
