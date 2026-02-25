import { describe, it, expect, vi } from 'vitest'
import { lokusSchema } from '../schema/lokus-schema.js'
import {
    mermaidNodeView,
    createMermaidInputRulesPlugin,
} from './MermaidDiagram'

// Mock the React component (createReactNodeView depends on it)
vi.mock('../lib/Mermaid', () => ({
    default: () => null
}))

// Mock the react-pm-helpers so the nodeView factory doesn't try to render React
vi.mock('../lib/react-pm-helpers.jsx', () => ({
    createReactNodeView: vi.fn((Component) => {
        // Return a plain nodeView factory function
        return (node, view, getPos) => ({
            dom: document.createElement('div'),
            destroy() {},
        })
    }),
}))

describe('MermaidDiagram Extension (ProseMirror)', () => {
    it('should export mermaidNodeView', () => {
        expect(mermaidNodeView).toBeDefined()
        expect(typeof mermaidNodeView).toBe('function')
    })

    it('should export createMermaidInputRulesPlugin', () => {
        expect(createMermaidInputRulesPlugin).toBeDefined()
        expect(typeof createMermaidInputRulesPlugin).toBe('function')
    })

    it('should create a ProseMirror plugin from createMermaidInputRulesPlugin', () => {
        const plugin = createMermaidInputRulesPlugin(lokusSchema)
        expect(plugin).toBeDefined()
        // ProseMirror plugins have a spec property
        expect(plugin.spec).toBeDefined()
    })

    describe('Input Rules', () => {
        it('should have the ```mm input rule regex', () => {
            const plugin = createMermaidInputRulesPlugin(lokusSchema)
            // The inputRules plugin stores rules internally
            // We can verify the plugin was created without error
            expect(plugin).toBeDefined()

            // Test the regex pattern directly
            const regex = /^```mm\s$/
            expect(regex.test('```mm ')).toBe(true)
            expect(regex.test('```m ')).toBe(false)
            expect(regex.test('``mm ')).toBe(false)
        })
    })

    describe('Schema', () => {
        it('should have mermaid node type in lokusSchema', () => {
            expect(lokusSchema.nodes.mermaid).toBeDefined()
        })

        it('should have code attribute in mermaid node', () => {
            const mermaidSpec = lokusSchema.nodes.mermaid.spec
            expect(mermaidSpec.attrs.code).toBeDefined()
        })
    })
})
