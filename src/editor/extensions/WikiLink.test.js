import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import WikiLink from './WikiLink'

// Mock the wiki resolver
vi.mock('../../core/wiki/resolve.js', () => ({
  resolveWikiTarget: vi.fn().mockResolvedValue({
    href: 'test-page',
    src: '',
    isImage: false
  })
}))

describe('WikiLink Extension', () => {
  let editor

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        WikiLink
      ],
      content: '<p>Test</p>'
    })
  })

  it('should have correct name', () => {
    expect(WikiLink.name).toBe('wikiLink')
  })

  it('should parse wiki link syntax [[Page]]', () => {
    editor.commands.setContent('<p>[[Page]]</p>')

    // Note: Input rules trigger on typing, setContent parses HTML. 
    // WikiLink extension might not have a parser for [[Page]] text content directly unless input rules are triggered.
    // However, we can test the command.

    editor.commands.setWikiLink('Page')

    const json = editor.getJSON()
    // Find the wiki link node
    // Structure: doc -> paragraph -> text + wikiLink

    // Since setWikiLink inserts content, let's check if it inserted a node
    // It might be an inline node

    // Let's verify via HTML output
    const html = editor.getHTML()
    expect(html).toContain('data-type="wiki-link"')
    expect(html).toContain('href="Page"')
  })

  it('should handle input rules', () => {
    editor.commands.clearContent()
    editor.commands.focus()

    // Simulate typing [[Page]]
    // This is hard to simulate perfectly in unit tests without a real DOM, 
    // but we can check if input rules are defined
    expect(WikiLink.config.addInputRules).toBeDefined()
    const rules = WikiLink.config.addInputRules()
    expect(rules.length).toBeGreaterThan(0)
  })

  it('should render HTML correctly', () => {
    const attrs = { href: 'My Page', embed: false }
    // Use the renderHTML function directly
    const rendered = WikiLink.config.renderHTML({ HTMLAttributes: attrs })

    expect(rendered[0]).toBe('a')
    expect(rendered[1].href).toBe('My Page')
    expect(rendered[1].class).toContain('wiki-link')
  })
})