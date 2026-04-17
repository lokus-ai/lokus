import { describe, it, expect } from 'vitest'
import { lokusSchema } from '../../editor/schema/lokus-schema.js'
import { extractBlocksSync } from './BlockIndexer.js'

function doc(json) {
  return lokusSchema.nodeFromJSON(json)
}

describe('extractBlocksSync', () => {
  it('extracts paragraphs with assigned blockIds', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'abc1234567' },
          content: [{ type: 'text', text: 'hello' }],
        },
      ],
    })
    const blocks = extractBlocksSync(d)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].id).toBe('abc1234567')
    expect(blocks[0].nodeType).toBe('paragraph')
    expect(blocks[0].textPreview).toBe('hello')
    expect(blocks[0].parentId).toBeNull()
    expect(blocks[0].outgoingRefs).toEqual([])
  })

  it('skips blocks without an assigned blockId', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: null },
          content: [{ type: 'text', text: 'no id' }],
        },
      ],
    })
    expect(extractBlocksSync(d)).toHaveLength(0)
  })

  it('tracks parent_id for nested blocks inside a callout', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { type: 'note', blockId: 'cal0000000' },
          content: [
            {
              type: 'paragraph',
              attrs: { blockId: 'par0000001' },
              content: [{ type: 'text', text: 'inside' }],
            },
          ],
        },
      ],
    })
    const blocks = extractBlocksSync(d)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].id).toBe('cal0000000')
    expect(blocks[0].parentId).toBeNull()
    expect(blocks[1].id).toBe('par0000001')
    expect(blocks[1].parentId).toBe('cal0000000')
  })

  it('extracts wikiLink refs with ^blockid', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'src0000000' },
          content: [
            { type: 'text', text: 'see ' },
            {
              type: 'wikiLink',
              attrs: {
                id: '',
                target: 'Notes^target1234',
                alt: 'Notes',
                embed: false,
                href: 'Notes^target1234',
                src: '',
              },
            },
          ],
        },
      ],
    })
    const blocks = extractBlocksSync(d)
    expect(blocks[0].outgoingRefs).toEqual([
      { targetBlockId: 'target1234', kind: 'link' },
    ])
  })

  it('ignores wikiLinks that are note-level (no ^)', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'src0000000' },
          content: [
            {
              type: 'wikiLink',
              attrs: {
                id: '',
                target: 'Notes',
                alt: 'Notes',
                embed: false,
                href: 'Notes',
                src: '',
              },
            },
          ],
        },
      ],
    })
    const blocks = extractBlocksSync(d)
    expect(blocks[0].outgoingRefs).toEqual([])
  })

  it('assigns positions in document order', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, blockId: 'h000000001' },
          content: [{ type: 'text', text: 'H' }],
        },
        {
          type: 'paragraph',
          attrs: { blockId: 'p000000001' },
          content: [{ type: 'text', text: 'one' }],
        },
        {
          type: 'paragraph',
          attrs: { blockId: 'p000000002' },
          content: [{ type: 'text', text: 'two' }],
        },
      ],
    })
    const blocks = extractBlocksSync(d)
    expect(blocks.map(b => b.id)).toEqual([
      'h000000001',
      'p000000001',
      'p000000002',
    ])
    expect(blocks.map(b => b.position)).toEqual([0, 1, 2])
  })

  it('strips trailing ^id marker from textPreview', () => {
    const d = doc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'abc1234567' },
          content: [{ type: 'text', text: 'hello world ^abc1234567' }],
        },
      ],
    })
    const blocks = extractBlocksSync(d)
    expect(blocks[0].textPreview).toBe('hello world')
  })

  it('computes stable checksums for identical content', () => {
    const make = () => doc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'abc1234567' },
          content: [{ type: 'text', text: 'same' }],
        },
      ],
    })
    const a = extractBlocksSync(make())
    const b = extractBlocksSync(make())
    expect(a[0].checksum).toBe(b[0].checksum)
  })
})
