/**
 * block-commands.test.js
 *
 * Vitest tests for every command exported from block-commands.js.
 *
 * We build lightweight EditorState instances using the real lokusSchema so
 * tests exercise the actual schema constraints (blockId attrs, node types,
 * content rules, etc.).
 */

import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { lokusSchema } from '../schema/lokus-schema.js'
import {
  turnInto,
  duplicateBlock,
  deleteBlock,
  moveBlockUp,
  moveBlockDown,
  copyBlockLink,
  selectBlock,
} from './block-commands.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const schema = lokusSchema

/**
 * Build an EditorState whose document is `doc(...nodes)`.
 * Cursor is placed at position 1 (inside the first block) unless `selection`
 * override is provided.
 *
 * @param {import('prosemirror-model').Node[]} nodes  - doc children
 * @param {number} [cursorPos]  - absolute cursor position (default: 1)
 */
function makeState(nodes, cursorPos = 1) {
  const doc = schema.node('doc', null, nodes)
  const state = EditorState.create({ doc, schema })
  if (cursorPos !== 1) {
    const sel = TextSelection.create(doc, cursorPos)
    return state.apply(state.tr.setSelection(sel))
  }
  return state
}

/** Shorthand node factories */
const p = (text, attrs = {}) =>
  schema.node('paragraph', { blockId: null, ...attrs }, text ? schema.text(text) : [])

const h = (level, text, attrs = {}) =>
  schema.node('heading', { level, blockId: null, ...attrs }, text ? schema.text(text) : [])

const codeBlock = (text = '', attrs = {}) =>
  schema.node('codeBlock', { language: null, blockId: null, ...attrs }, text ? schema.text(text) : [])

/**
 * Collect a dispatch call and return the resulting state.
 * @param {import('prosemirror-state').EditorState} state
 * @param {Function} command
 * @returns {{ dispatched: boolean, nextState: import('prosemirror-state').EditorState }}
 */
function runCommand(state, command) {
  let nextState = state
  let dispatched = false
  const dispatch = (tr) => {
    dispatched = true
    nextState = state.apply(tr)
  }
  const result = command(state, dispatch)
  return { result, dispatched, nextState }
}

// ---------------------------------------------------------------------------
// turnInto
// ---------------------------------------------------------------------------

describe('turnInto', () => {
  it('converts a paragraph to a heading', () => {
    const state = makeState([p('Hello', { blockId: 'abc1234567' })])
    const cmd = turnInto(schema.nodes.heading, { level: 2 })
    const { result, dispatched, nextState } = runCommand(state, cmd)

    expect(result).toBe(true)
    expect(dispatched).toBe(true)

    const firstChild = nextState.doc.firstChild
    expect(firstChild.type.name).toBe('heading')
    expect(firstChild.attrs.level).toBe(2)
  })

  it('preserves blockId when converting', () => {
    const blockId = 'testidbcde'
    const state = makeState([p('Block', { blockId })])
    const cmd = turnInto(schema.nodes.heading, { level: 1 })
    const { nextState } = runCommand(state, cmd)

    expect(nextState.doc.firstChild.attrs.blockId).toBe(blockId)
  })

  it('cycles heading level when same level requested', () => {
    const state = makeState([h(1, 'Title', { blockId: 'h1blockidxy' })])
    const cmd = turnInto(schema.nodes.heading, { level: 1 })
    const { nextState } = runCommand(state, cmd)

    // Should cycle from 1 → 2
    expect(nextState.doc.firstChild.attrs.level).toBe(2)
  })

  it('cycles heading level 3 back to 1', () => {
    const state = makeState([h(3, 'Title', { blockId: 'h3blockidxy' })])
    const cmd = turnInto(schema.nodes.heading, { level: 3 })
    const { nextState } = runCommand(state, cmd)

    expect(nextState.doc.firstChild.attrs.level).toBe(1)
  })

  it('returns true (dry-run) when dispatch is omitted', () => {
    const state = makeState([p('Hello')])
    const cmd = turnInto(schema.nodes.heading, { level: 1 })
    const result = cmd(state, null)
    expect(result).toBe(true)
  })

  it('converts paragraph to codeBlock (text content)', () => {
    const state = makeState([p('some code', { blockId: 'codeblockid' })])
    const cmd = turnInto(schema.nodes.codeBlock, {})
    const { result, nextState } = runCommand(state, cmd)

    expect(result).toBe(true)
    const firstChild = nextState.doc.firstChild
    expect(firstChild.type.name).toBe('codeBlock')
    // Text content should be preserved
    expect(firstChild.textContent).toBe('some code')
  })
})

// ---------------------------------------------------------------------------
// duplicateBlock
// ---------------------------------------------------------------------------

describe('duplicateBlock', () => {
  it('inserts a copy of the block after the original', () => {
    const state = makeState([p('Original', { blockId: 'orig123456' })])

    const { result, dispatched, nextState } = runCommand(state, duplicateBlock)

    expect(result).toBe(true)
    expect(dispatched).toBe(true)
    expect(nextState.doc.childCount).toBe(2)

    const first = nextState.doc.child(0)
    const second = nextState.doc.child(1)

    expect(first.textContent).toBe('Original')
    expect(second.textContent).toBe('Original')
  })

  it('assigns a different blockId to the duplicate', () => {
    const originalId = 'orig123456'
    const state = makeState([p('Block', { blockId: originalId })])

    const { nextState } = runCommand(state, duplicateBlock)

    const first = nextState.doc.child(0)
    const second = nextState.doc.child(1)

    expect(first.attrs.blockId).toBe(originalId)
    expect(second.attrs.blockId).not.toBe(originalId)
    expect(second.attrs.blockId).toBeTruthy()
    expect(second.attrs.blockId).toHaveLength(10)
  })

  it('works with multiple blocks — inserts after the active one', () => {
    // Two paragraphs; cursor in first one
    const state = makeState([p('First', { blockId: 'first12345' }), p('Second', { blockId: 'secnd12345' })])
    const { nextState } = runCommand(state, duplicateBlock)

    expect(nextState.doc.childCount).toBe(3)
    expect(nextState.doc.child(0).textContent).toBe('First')
    expect(nextState.doc.child(1).textContent).toBe('First')
    expect(nextState.doc.child(2).textContent).toBe('Second')
  })

  it('returns true (dry-run) when dispatch is omitted', () => {
    const state = makeState([p('Hello')])
    const result = duplicateBlock(state, null)
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// deleteBlock
// ---------------------------------------------------------------------------

describe('deleteBlock', () => {
  it('removes the block at selection', () => {
    const state = makeState([p('First', { blockId: 'frstblkxyz' }), p('Second', { blockId: 'scndblkxyz' })])

    const { result, dispatched, nextState } = runCommand(state, deleteBlock)

    expect(result).toBe(true)
    expect(dispatched).toBe(true)
    expect(nextState.doc.childCount).toBe(1)
    expect(nextState.doc.firstChild.textContent).toBe('Second')
  })

  it('replaces the last block with an empty paragraph instead of deleting', () => {
    const state = makeState([p('Only block', { blockId: 'onlyblocki' })])

    const { nextState } = runCommand(state, deleteBlock)

    expect(nextState.doc.childCount).toBe(1)
    expect(nextState.doc.firstChild.type.name).toBe('paragraph')
    expect(nextState.doc.firstChild.textContent).toBe('')
  })

  it('deletes the correct block when cursor is in the second block', () => {
    const block1 = p('First', { blockId: 'blk1aaaaaa' })
    const block2 = p('Second', { blockId: 'blk2bbbbbb' })
    const doc = schema.node('doc', null, [block1, block2])
    // Position 1 is inside first block; position after block1 = block1.nodeSize+1 is inside second
    const cursorInSecond = block1.nodeSize + 1
    const state = makeState([block1, block2], cursorInSecond)

    const { nextState } = runCommand(state, deleteBlock)

    expect(nextState.doc.childCount).toBe(1)
    expect(nextState.doc.firstChild.textContent).toBe('First')
  })

  it('returns true (dry-run) when dispatch is omitted', () => {
    const state = makeState([p('Hello'), p('World')])
    const result = deleteBlock(state, null)
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// moveBlockUp
// ---------------------------------------------------------------------------

describe('moveBlockUp', () => {
  it('swaps the selected block with the one above it', () => {
    const state = makeState(
      [p('First', { blockId: 'blk1aaaaaa' }), p('Second', { blockId: 'blk2bbbbbb' })],
      // cursor in second block
      p('First', { blockId: 'blk1aaaaaa' }).nodeSize + 1,
    )

    const { result, dispatched, nextState } = runCommand(state, moveBlockUp)

    expect(result).toBe(true)
    expect(dispatched).toBe(true)
    expect(nextState.doc.child(0).textContent).toBe('Second')
    expect(nextState.doc.child(1).textContent).toBe('First')
  })

  it('returns false when the block is already first', () => {
    const state = makeState([p('Only'), p('Other')])
    // cursor in first block (default pos 1)
    const result = moveBlockUp(state, null)
    expect(result).toBe(false)
  })

  it('preserves blockIds after move', () => {
    const blk1 = p('First', { blockId: 'id1aaaaaaa' })
    const blk2 = p('Second', { blockId: 'id2bbbbbbb' })
    const state = makeState([blk1, blk2], blk1.nodeSize + 1)

    const { nextState } = runCommand(state, moveBlockUp)

    expect(nextState.doc.child(0).attrs.blockId).toBe('id2bbbbbbb')
    expect(nextState.doc.child(1).attrs.blockId).toBe('id1aaaaaaa')
  })
})

// ---------------------------------------------------------------------------
// moveBlockDown
// ---------------------------------------------------------------------------

describe('moveBlockDown', () => {
  it('swaps the selected block with the one below it', () => {
    const state = makeState(
      [p('First', { blockId: 'blk1aaaaaa' }), p('Second', { blockId: 'blk2bbbbbb' })],
    )
    // cursor in first block

    const { result, dispatched, nextState } = runCommand(state, moveBlockDown)

    expect(result).toBe(true)
    expect(dispatched).toBe(true)
    expect(nextState.doc.child(0).textContent).toBe('Second')
    expect(nextState.doc.child(1).textContent).toBe('First')
  })

  it('returns false when the block is already last', () => {
    const blk1 = p('First')
    const blk2 = p('Second')
    const state = makeState([blk1, blk2], blk1.nodeSize + 1)
    const result = moveBlockDown(state, null)
    expect(result).toBe(false)
  })

  it('preserves blockIds after move', () => {
    const blk1 = p('First', { blockId: 'id1aaaaaaa' })
    const blk2 = p('Second', { blockId: 'id2bbbbbbb' })
    const state = makeState([blk1, blk2])

    const { nextState } = runCommand(state, moveBlockDown)

    expect(nextState.doc.child(0).attrs.blockId).toBe('id2bbbbbbb')
    expect(nextState.doc.child(1).attrs.blockId).toBe('id1aaaaaaa')
  })

  it('moves the middle block down in a 3-block doc', () => {
    // Cursor is in blk2 (middle block) — it should swap with blk3
    const blk1 = p('A', { blockId: 'ida1111111' })
    const blk2 = p('B', { blockId: 'idb2222222' })
    const blk3 = p('C', { blockId: 'idc3333333' })
    // blk2 starts at offset blk1.nodeSize; place cursor one step inside
    const state = makeState([blk1, blk2, blk3], blk1.nodeSize + 1)

    const { nextState } = runCommand(state, moveBlockDown)

    // blk2 moved down past blk3: order becomes A, C, B
    expect(nextState.doc.child(0).textContent).toBe('A')
    expect(nextState.doc.child(1).textContent).toBe('C')
    expect(nextState.doc.child(2).textContent).toBe('B')
  })

  it('moves first block past second in 3-block doc (order check)', () => {
    const blk1 = p('A', { blockId: 'ida1111111' })
    const blk2 = p('B', { blockId: 'idb2222222' })
    const blk3 = p('C', { blockId: 'idc3333333' })
    const state = makeState([blk1, blk2, blk3]) // cursor at pos 1 = first block

    const { nextState } = runCommand(state, moveBlockDown)

    expect(nextState.doc.child(0).textContent).toBe('B')
    expect(nextState.doc.child(1).textContent).toBe('A')
    expect(nextState.doc.child(2).textContent).toBe('C')
  })
})

// ---------------------------------------------------------------------------
// selectBlock
// ---------------------------------------------------------------------------

describe('selectBlock', () => {
  it('creates a NodeSelection for the block at the cursor', () => {
    const state = makeState([p('Hello', { blockId: 'selblockid' })])

    const { result, dispatched, nextState } = runCommand(state, selectBlock)

    expect(result).toBe(true)
    expect(dispatched).toBe(true)
    expect(nextState.selection instanceof NodeSelection).toBe(true)
  })

  it('the NodeSelection contains the correct block', () => {
    const state = makeState([p('Target', { blockId: 'trgblockid' }), p('Other', { blockId: 'othblockid' })])

    const { nextState } = runCommand(state, selectBlock)
    const sel = nextState.selection

    expect(sel instanceof NodeSelection).toBe(true)
    expect(sel.node.textContent).toBe('Target')
  })

  it('returns true (dry-run) when dispatch is omitted', () => {
    const state = makeState([p('Hello')])
    const result = selectBlock(state, null)
    expect(result).toBe(true)
  })

  it('selects the correct block when cursor is in the second block', () => {
    const blk1 = p('First', { blockId: 'blk1select' })
    const blk2 = p('Second', { blockId: 'blk2select' })
    const state = makeState([blk1, blk2], blk1.nodeSize + 1)

    const { nextState } = runCommand(state, selectBlock)
    const sel = nextState.selection

    expect(sel instanceof NodeSelection).toBe(true)
    expect(sel.node.textContent).toBe('Second')
  })
})

// ---------------------------------------------------------------------------
// copyBlockLink
// ---------------------------------------------------------------------------

describe('copyBlockLink', () => {
  it('returns false when the block has no blockId', () => {
    const state = makeState([p('No ID')]) // blockId: null
    const result = copyBlockLink(state, null, null)
    expect(result).toBe(false)
  })

  it('returns true when the block has a blockId', () => {
    const state = makeState([p('Has ID', { blockId: 'hasblocki0' })])
    const result = copyBlockLink(state, null, null)
    expect(result).toBe(true)
  })

  it('dispatches a no-op transaction', () => {
    const state = makeState([p('Has ID', { blockId: 'hasblocki0' })])
    let dispatched = false
    copyBlockLink(state, () => { dispatched = true }, null)
    expect(dispatched).toBe(true)
  })
})
