import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { lokusSchema } from '../schema/lokus-schema.js'
import {
    createWikiLinkPlugins,
    insertWikiLink,
    createWikiLinkNodeView,
    parseParts,
    toHref,
    buildWikiLinkPattern,
} from './WikiLink'

// Mock the wiki resolver
vi.mock('../../core/wiki/resolve.js', () => ({
    resolveWikiTarget: vi.fn().mockResolvedValue({
        href: 'test-page',
        src: '',
        isImage: false
    })
}))

// Mock markdown syntax config
vi.mock('../../core/markdown/syntax-config.js', () => ({
    default: {
        get: vi.fn((category, key) => {
            if (category === 'link' && key === 'wikiLink') {
                return { open: '[[', close: ']]' }
            }
            if (category === 'image' && key === 'marker') {
                return '!'
            }
            return null
        }),
        onChange: vi.fn(() => () => {}),
    }
}))

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function createTestView() {
    const state = EditorState.create({
        schema: lokusSchema,
        plugins: createWikiLinkPlugins(lokusSchema),
    })
    const view = new EditorView(document.createElement('div'), { state })
    return view
}

describe('WikiLink Extension (ProseMirror)', () => {
    let view

    beforeEach(() => {
        view = createTestView()
    })

    afterEach(() => {
        view.destroy()
    })

    it('should create plugins array', () => {
        const plugins = createWikiLinkPlugins(lokusSchema)
        expect(Array.isArray(plugins)).toBe(true)
        expect(plugins.length).toBe(3) // inputRules + asyncResolve + configChange
    })

    it('should insert a wikiLink node via insertWikiLink', () => {
        const result = insertWikiLink(view, 'My Page')
        expect(result).toBe(true)

        const json = view.state.doc.toJSON()
        // Find the wikiLink node
        const findWikiLink = (nodes) => {
            for (const node of nodes || []) {
                if (node.type === 'wikiLink') return node
                if (node.content) {
                    const found = findWikiLink(node.content)
                    if (found) return found
                }
            }
            return null
        }
        const wl = findWikiLink(json.content)
        expect(wl).toBeDefined()
        expect(wl.attrs.target).toBe('My Page')
        expect(wl.attrs.href).toBe('My Page')
        expect(wl.attrs.embed).toBe(false)
    })

    it('should insert an embed wikiLink when embed option is true', () => {
        insertWikiLink(view, 'Image.png', { embed: true })

        const json = view.state.doc.toJSON()
        const findWikiLink = (nodes) => {
            for (const node of nodes || []) {
                if (node.type === 'wikiLink') return node
                if (node.content) {
                    const found = findWikiLink(node.content)
                    if (found) return found
                }
            }
            return null
        }
        const wl = findWikiLink(json.content)
        expect(wl).toBeDefined()
        expect(wl.attrs.embed).toBe(true)
    })

    it('should handle piped aliases', () => {
        insertWikiLink(view, 'Long Page Name|Alias')

        const json = view.state.doc.toJSON()
        const findWikiLink = (nodes) => {
            for (const node of nodes || []) {
                if (node.type === 'wikiLink') return node
                if (node.content) {
                    const found = findWikiLink(node.content)
                    if (found) return found
                }
            }
            return null
        }
        const wl = findWikiLink(json.content)
        expect(wl).toBeDefined()
        expect(wl.attrs.alt).toBe('Alias')
        expect(wl.attrs.target).toBe('Long Page Name|Alias')
    })
})

describe('WikiLink parseParts', () => {
    it('should parse simple target', () => {
        const result = parseParts('My Page')
        expect(result.path).toBe('My Page')
        expect(result.hash).toBe('')
        expect(result.alt).toBe('')
    })

    it('should parse target with alias', () => {
        const result = parseParts('My Page|Alias')
        expect(result.path).toBe('My Page')
        expect(result.alt).toBe('Alias')
    })

    it('should parse target with heading', () => {
        const result = parseParts('My Page#Heading')
        expect(result.path).toBe('My Page')
        expect(result.hash).toBe('Heading')
        expect(result.separator).toBe('#')
    })

    it('should parse target with block reference', () => {
        const result = parseParts('My Page^blockid')
        expect(result.path).toBe('My Page')
        expect(result.hash).toBe('blockid')
        expect(result.separator).toBe('^')
    })
})

describe('WikiLink toHref', () => {
    it('should return path when no hash', () => {
        expect(toHref({ path: 'My Page', hash: '', separator: '' })).toBe('My Page')
    })

    it('should return path#hash when hash present', () => {
        expect(toHref({ path: 'My Page', hash: 'Heading', separator: '#' })).toBe('My Page#Heading')
    })

    it('should return path^hash for block refs', () => {
        expect(toHref({ path: 'My Page', hash: 'blockid', separator: '^' })).toBe('My Page^blockid')
    })
})

describe('WikiLink buildWikiLinkPattern', () => {
    it('should build a regex for file links', () => {
        const pattern = buildWikiLinkPattern(false)
        expect(pattern).toBeInstanceOf(RegExp)
        expect(pattern.test('[[Page]]')).toBe(true)
    })

    it('should build a regex for image embeds', () => {
        const pattern = buildWikiLinkPattern(true)
        expect(pattern).toBeInstanceOf(RegExp)
        expect(pattern.test('![[Image.png]]')).toBe(true)
    })
})

describe('WikiLink createWikiLinkNodeView', () => {
    it('should create a link node view', () => {
        const mockNode = {
            attrs: {
                embed: false,
                src: '',
                alt: '',
                target: 'My Page',
                href: 'My Page',
            }
        }
        const mockView = {}
        const mockGetPos = () => 0

        const nodeView = createWikiLinkNodeView(mockNode, mockView, mockGetPos)
        expect(nodeView.dom).toBeInstanceOf(HTMLElement)
        expect(nodeView.dom.tagName).toBe('A')
        expect(nodeView.dom.classList.contains('wiki-link')).toBe(true)
        expect(nodeView.dom.getAttribute('data-type')).toBe('wiki-link')
        expect(nodeView.dom.textContent).toBe('My Page')

        // Clean up
        nodeView.destroy?.()
    })

    it('should create an image node view for embeds with src', () => {
        const mockNode = {
            attrs: {
                embed: true,
                src: '/path/to/image.png',
                alt: 'Alt text',
                target: 'image.png',
                href: 'image.png',
            }
        }
        const mockView = {}
        const mockGetPos = () => 0

        const nodeView = createWikiLinkNodeView(mockNode, mockView, mockGetPos)
        expect(nodeView.dom.tagName).toBe('IMG')
        expect(nodeView.dom.classList.contains('wiki-image')).toBe(true)
        expect(nodeView.dom.getAttribute('src')).toBe('/path/to/image.png')
    })

    it('should display alias text when present', () => {
        const mockNode = {
            attrs: {
                embed: false,
                src: '',
                alt: 'Custom Alias',
                target: 'My Page|Custom Alias',
                href: 'My Page',
            }
        }
        const nodeView = createWikiLinkNodeView(mockNode, {}, () => 0)
        expect(nodeView.dom.textContent).toBe('Custom Alias')
        nodeView.destroy?.()
    })
})
