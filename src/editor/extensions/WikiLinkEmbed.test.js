import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { lokusSchema } from '../schema/lokus-schema.js'
import {
    createWikiLinkEmbedPlugins,
    setWikiLinkEmbed,
} from './WikiLinkEmbed'
import { extractBlockContent } from '../../core/blocks/block-parser.js'

// Mock dependencies
vi.mock('../../core/blocks/block-parser.js', () => ({
    extractBlockContent: vi.fn()
}))

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function createTestView() {
    const state = EditorState.create({
        schema: lokusSchema,
        plugins: createWikiLinkEmbedPlugins(lokusSchema),
    })
    const view = new EditorView(document.createElement('div'), { state })
    return view
}

describe('WikiLinkEmbed Extension (ProseMirror)', () => {
    let view

    beforeEach(() => {
        vi.clearAllMocks()
        view = createTestView()
    })

    afterEach(() => {
        view.destroy()
    })

    it('should create plugins array', () => {
        const plugins = createWikiLinkEmbedPlugins(lokusSchema)
        expect(Array.isArray(plugins)).toBe(true)
        expect(plugins.length).toBe(1) // embedResolverPlugin
    })

    it('should have wikiLinkEmbed node type in schema', () => {
        expect(lokusSchema.nodes.wikiLinkEmbed).toBeDefined()
    })

    describe('setWikiLinkEmbed command', () => {
        it('should insert embed node and fetch content', async () => {
            extractBlockContent.mockResolvedValue('Fetched Content')

            const result = setWikiLinkEmbed(view, 'Note', '123', '/path/to/Note.md')
            expect(result).toBe(true)

            // The node should be inserted with loading=true initially
            let json = view.state.doc.toJSON()
            const findEmbed = (nodes) => {
                for (const node of nodes || []) {
                    if (node.type === 'wikiLinkEmbed') return node
                    if (node.content) {
                        const found = findEmbed(node.content)
                        if (found) return found
                    }
                }
                return null
            }
            let embedNode = findEmbed(json.content)
            expect(embedNode).toBeDefined()
            expect(embedNode.attrs.fileName).toBe('Note')
            expect(embedNode.attrs.blockId).toBe('123')
            expect(embedNode.attrs.loading).toBe(true)

            // Wait for async content resolution
            await new Promise(resolve => setTimeout(resolve, 50))

            // After resolution, the node should be updated
            json = view.state.doc.toJSON()
            embedNode = findEmbed(json.content)
            expect(embedNode).toBeDefined()
            expect(embedNode.attrs.content).toBe('Fetched Content')
            expect(embedNode.attrs.loading).toBe(false)
        })

        it('should handle fetch error', async () => {
            extractBlockContent.mockRejectedValue(new Error('Fetch Failed'))

            setWikiLinkEmbed(view, 'Note', '123', '/path/to/Note.md')

            // Wait for async error handling
            await new Promise(resolve => setTimeout(resolve, 50))

            const json = view.state.doc.toJSON()
            const findEmbed = (nodes) => {
                for (const node of nodes || []) {
                    if (node.type === 'wikiLinkEmbed') return node
                    if (node.content) {
                        const found = findEmbed(node.content)
                        if (found) return found
                    }
                }
                return null
            }
            const embedNode = findEmbed(json.content)
            expect(embedNode).toBeDefined()
            expect(embedNode.attrs.error).toBe('Fetch Failed')
            expect(embedNode.attrs.loading).toBe(false)
        })
    })
})
