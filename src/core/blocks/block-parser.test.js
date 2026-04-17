import { describe, it, expect, beforeEach } from 'vitest'
import { parseBlocks } from './block-parser.js'
import blockIdManager from './block-id-manager.js'

describe('parseBlocks — HTML', () => {
  beforeEach(() => {
    blockIdManager.clear()
  })

  it('extracts blocks with data-block-id attributes', () => {
    const html = '<p data-block-id="abc1234567">hello</p>'
    const blocks = parseBlocks(html, 'a.md')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].blockId).toBe('abc1234567')
    expect(blocks[0].type).toBe('paragraph')
  })

  it('auto-generates slug IDs for untagged headings', () => {
    const html = '<h2>Section Title</h2>'
    const blocks = parseBlocks(html, 'a.md')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].blockId).toBe('section-title')
    expect(blocks[0].type).toBe('heading')
    expect(blocks[0].auto).toBe(true)
  })

  it('regression: two identical paragraphs in different files no longer collide', () => {
    // Before Phase 1, virtual content-hash IDs would collide across files.
    // After removing Strategy 3, untagged paragraphs are simply not returned
    // by parseBlocks — they get durable IDs elsewhere (BlockIdAutoAssign + SQLite).
    const fileA = '<p>identical text</p>'
    const fileB = '<p>identical text</p>'
    const blocksA = parseBlocks(fileA, 'a.md')
    const blocksB = parseBlocks(fileB, 'b.md')
    // No virtual IDs → untagged paragraphs produce no entries
    expect(blocksA).toHaveLength(0)
    expect(blocksB).toHaveLength(0)
  })

  it('still returns explicit data-block-id paragraphs distinctly across files', () => {
    const fileA = '<p data-block-id="id_a">same text</p>'
    const fileB = '<p data-block-id="id_b">same text</p>'
    const blocksA = parseBlocks(fileA, 'a.md')
    const blocksB = parseBlocks(fileB, 'b.md')
    expect(blocksA[0].blockId).toBe('id_a')
    expect(blocksB[0].blockId).toBe('id_b')
  })
})

describe('parseBlocks — Markdown', () => {
  beforeEach(() => {
    blockIdManager.clear()
  })

  it('parses markdown heading with custom ID', () => {
    const md = '## My Heading {#custom-id}\n'
    const blocks = parseBlocks(md, 'a.md')
    const heading = blocks.find(b => b.type === 'heading')
    expect(heading?.blockId).toBe('custom-id')
  })

  it('parses markdown line with ^blockid', () => {
    const md = 'Some text ^myid\n'
    const blocks = parseBlocks(md, 'a.md')
    expect(blocks[0].blockId).toBe('myid')
  })

  it('auto-generates slug for heading without explicit ID', () => {
    const md = '## Hello World\n'
    const blocks = parseBlocks(md, 'a.md')
    expect(blocks[0].blockId).toBe('hello-world')
    expect(blocks[0].auto).toBe(true)
  })
})
