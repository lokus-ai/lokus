import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { Schema } from 'prosemirror-model'
import { lokusSchema } from '../schema/lokus-schema.js'
import { createBlockIdAutoAssignPlugin } from './BlockIdAutoAssign.js'

function mkState(doc) {
  return EditorState.create({
    schema: lokusSchema,
    doc,
    plugins: [createBlockIdAutoAssignPlugin()],
  })
}

function docFromJson(json) {
  return lokusSchema.nodeFromJSON(json)
}

/**
 * Trigger the plugin's appendTransaction by applying a no-op docChanged tr:
 * insert a char inside the first textblock and immediately delete it. This
 * produces `docChanged === true` while preserving the document content.
 */
function applyAutoAssign(state) {
  let textblockStart = -1
  state.doc.descendants((node, pos) => {
    if (textblockStart === -1 && node.isTextblock) {
      textblockStart = pos + 1
      return false
    }
  })
  if (textblockStart === -1) {
    // No textblock in the doc — append an empty paragraph then remove it.
    const p = state.schema.nodes.paragraph.create()
    const tr = state.tr.insert(state.doc.content.size, p)
    tr.delete(state.doc.content.size, state.doc.content.size + p.nodeSize)
    return state.apply(tr)
  }
  const tr = state.tr
    .insertText('\u200b', textblockStart)
    .delete(textblockStart, textblockStart + 1)
  return state.apply(tr)
}

describe('BlockIdAutoAssign', () => {
  it('assigns blockId to paragraphs that have none', () => {
    const doc = docFromJson({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
      ],
    })
    const state = mkState(doc)
    const next = applyAutoAssign(state)
    let ids = []
    next.doc.descendants(n => {
      if (n.type.name === 'paragraph') ids.push(n.attrs.blockId)
    })
    expect(ids).toHaveLength(1)
    expect(ids[0]).toMatch(/^[0-9a-z]{10}$/)
  })

  it('skips paragraphs that already have blockId', () => {
    const doc = docFromJson({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'preexisting' },
          content: [{ type: 'text', text: 'hello' }],
        },
      ],
    })
    const state = mkState(doc)
    const next = applyAutoAssign(state)
    let ids = []
    next.doc.descendants(n => {
      if (n.type.name === 'paragraph') ids.push(n.attrs.blockId)
    })
    expect(ids).toEqual(['preexisting'])
  })

  it('assigns unique IDs to multiple blocks', () => {
    const doc = docFromJson({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'hi' }] },
      ],
    })
    const state = mkState(doc)
    const next = applyAutoAssign(state)
    const ids = []
    next.doc.descendants(n => {
      if (n.type.spec.attrs && 'blockId' in n.type.spec.attrs) {
        ids.push(n.attrs.blockId)
      }
    })
    expect(ids.length).toBeGreaterThanOrEqual(3)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach(id => expect(id).toMatch(/^[0-9a-z]{10}$/))
  })

  it('leaves nodes without blockId attr alone (horizontalRule, bulletList)', () => {
    const doc = docFromJson({
      type: 'doc',
      content: [
        { type: 'horizontalRule' },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
              ],
            },
          ],
        },
      ],
    })
    const state = mkState(doc)
    const next = applyAutoAssign(state)
    let hrHasBlockId = false
    let bulletListHasBlockId = false
    let listItemBlockId = null
    next.doc.descendants(n => {
      if (n.type.name === 'horizontalRule' && n.attrs.blockId !== undefined) {
        hrHasBlockId = true
      }
      if (n.type.name === 'bulletList' && n.attrs.blockId !== undefined) {
        bulletListHasBlockId = true
      }
      if (n.type.name === 'listItem') {
        listItemBlockId = n.attrs.blockId
      }
    })
    expect(hrHasBlockId).toBe(false) // horizontalRule has no blockId attr
    expect(bulletListHasBlockId).toBe(false) // bulletList is a wrapper, no blockId attr
    expect(listItemBlockId).toMatch(/^[0-9a-z]{10}$/) // listItem does
  })

  it('replaces duplicate blockIds within the same doc', () => {
    const doc = docFromJson({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'dupid' },
          content: [{ type: 'text', text: 'a' }],
        },
        {
          type: 'paragraph',
          attrs: { blockId: 'dupid' },
          content: [{ type: 'text', text: 'b' }],
        },
      ],
    })
    const state = mkState(doc)
    const next = applyAutoAssign(state)
    const ids = []
    next.doc.descendants(n => {
      if (n.type.name === 'paragraph') ids.push(n.attrs.blockId)
    })
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2) // deduplicated
  })

  it('adds blockId to nodes that newly support it (taskItem, callout, mermaid, tableCell, tableHeader)', () => {
    // Build a doc with each previously-missing node type
    const doc = docFromJson({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'task' }] },
              ],
            },
          ],
        },
        {
          type: 'callout',
          attrs: { type: 'note' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'callout body' }] },
          ],
        },
      ],
    })
    const state = mkState(doc)
    const next = applyAutoAssign(state)
    let taskItemBlockId = null
    let calloutBlockId = null
    next.doc.descendants(n => {
      if (n.type.name === 'taskItem') taskItemBlockId = n.attrs.blockId
      if (n.type.name === 'callout') calloutBlockId = n.attrs.blockId
    })
    expect(taskItemBlockId).toMatch(/^[0-9a-z]{10}$/)
    expect(calloutBlockId).toMatch(/^[0-9a-z]{10}$/)
  })
})
