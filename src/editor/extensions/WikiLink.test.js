import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Node } from '@tiptap/core'
import WikiLink from './WikiLink.js'

// Mock the wiki resolver
vi.mock('../../core/wiki/resolve.js', () => ({
  resolveWikiTarget: vi.fn().mockResolvedValue({
    href: 'test-page',
    src: '',
    isImage: false
  })
}))

describe('WikiLink Extension', () => {
  let extension

  beforeEach(() => {
    extension = WikiLink
  })

  it('should have correct name', () => {
    expect(extension.name).toBe('wikiLink')
  })

  it('should be a Node extension', () => {
    expect(extension.type).toBe('node')
  })

  it('should have correct attributes', () => {
    expect(extension.config.addAttributes).toBeDefined()
    
    const attributes = extension.config.addAttributes()
    expect(attributes.href).toBeDefined()
    expect(attributes.href.default).toBe('')
    expect(attributes.embed).toBeDefined()
    expect(attributes.embed.default).toBe(false)
    expect(attributes.target).toBeDefined()
    expect(attributes.target.default).toBe('')
  })

  it('should parse HTML correctly', () => {
    expect(extension.config.parseHTML).toBeDefined()
    
    const parseRules = extension.config.parseHTML()
    expect(parseRules).toHaveLength(1)
    expect(parseRules[0].tag).toBe('span[data-type="wiki-link"]')
  })

  it('should render HTML correctly', () => {
    expect(extension.config.renderHTML).toBeDefined()
    
    const mockAttrs = { href: 'test-page', embed: false, target: 'test', alt: 'Test Page' }
    const result = extension.config.renderHTML({ HTMLAttributes: mockAttrs })
    
    expect(result[0]).toBe('a')
    expect(result[1]['data-type']).toBe('wiki-link')
    expect(result[1].class).toBe('wiki-link')
    expect(result[1].href).toBe('test-page')
    expect(result[2]).toBe('Test Page')
  })

  it('should have input rules for wiki links', () => {
    expect(extension.config.addInputRules).toBeDefined()
    
    const inputRules = extension.config.addInputRules()
    expect(inputRules).toHaveLength(2)
  })

  it('should have commands', () => {
    expect(extension.config.addCommands).toBeDefined()
    
    const commands = extension.config.addCommands()
    expect(commands.setWikiLink).toBeDefined()
  })
})