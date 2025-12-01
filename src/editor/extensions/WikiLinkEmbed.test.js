import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import WikiLinkEmbed from './WikiLinkEmbed'
import { extractBlockContent } from '../../core/blocks/block-parser.js'

// Mock dependencies
vi.mock('../../core/blocks/block-parser.js', () => ({
    extractBlockContent: vi.fn()
}))

describe('WikiLinkEmbed Extension', () => {
    let editor

    beforeEach(() => {
        vi.clearAllMocks()
        editor = new Editor({
            extensions: [StarterKit, WikiLinkEmbed],
        })
    })

    it('should have correct name and group', () => {
        expect(WikiLinkEmbed.name).toBe('wikiLinkEmbed')
        expect(WikiLinkEmbed.config.group).toBe('block')
    })

    describe('renderHTML', () => {
        it('renders loading state', () => {
            const node = {
                attrs: {
                    fileName: 'Note',
                    blockId: '123',
                    loading: true,
                    error: null
                }
            }
            const result = WikiLinkEmbed.config.renderHTML({ node })
            expect(result[1].class).toContain('wiki-embed-loading')
            expect(result[3][2]).toBe('Loading...')
        })

        it('renders error state', () => {
            const node = {
                attrs: {
                    fileName: 'Note',
                    blockId: '123',
                    loading: false,
                    error: 'Not found'
                }
            }
            const result = WikiLinkEmbed.config.renderHTML({ node })
            expect(result[1].class).toContain('wiki-embed-error')
            expect(result[3][2]).toContain('Not found')
        })

        it('renders content state', () => {
            const node = {
                attrs: {
                    fileName: 'Note',
                    blockId: '123',
                    loading: false,
                    error: null,
                    content: 'Hello World'
                }
            }
            const result = WikiLinkEmbed.config.renderHTML({ node })
            expect(result[1].class).not.toContain('wiki-embed-loading')
            expect(result[1].class).not.toContain('wiki-embed-error')
            expect(result[3][2]).toBe('Hello World')
        })
    })

    describe('commands', () => {
        it('inserts embed and fetches content', async () => {
            extractBlockContent.mockResolvedValue('Fetched Content')

            await editor.commands.setWikiLinkEmbed('Note', '123', '/path/to/Note.md')

            // Check if content is updated
            const json = editor.getJSON()
            const embedNode = json.content.find(n => n.type === 'wikiLinkEmbed')

            expect(embedNode).toBeDefined()
            expect(embedNode.attrs.fileName).toBe('Note')
            expect(embedNode.attrs.blockId).toBe('123')
            expect(embedNode.attrs.content).toBe('Fetched Content')
            expect(embedNode.attrs.loading).toBe(false)
        })

        it('handles fetch error', async () => {
            extractBlockContent.mockRejectedValue(new Error('Fetch Failed'))

            await editor.commands.setWikiLinkEmbed('Note', '123', '/path/to/Note.md')

            const json = editor.getJSON()
            const embedNode = json.content.find(n => n.type === 'wikiLinkEmbed')

            expect(embedNode.attrs.error).toBe('Fetch Failed')
            expect(embedNode.attrs.loading).toBe(false)
        })
    })
})
