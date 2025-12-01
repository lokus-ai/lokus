import { describe, it, expect, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import MermaidDiagram from './MermaidDiagram'

// Mock ReactNodeViewRenderer
vi.mock('@tiptap/react', () => ({
    ReactNodeViewRenderer: vi.fn(() => () => { })
}))

vi.mock('../lib/Mermaid', () => ({
    default: () => null
}))

describe('MermaidDiagram Extension', () => {
    it('should have correct name and group', () => {
        expect(MermaidDiagram.name).toBe('mermaid')
        expect(MermaidDiagram.config.group).toBe('block')
    })

    it('should define attributes', () => {
        const attrs = MermaidDiagram.config.addAttributes()
        expect(attrs.code).toBeDefined()
        expect(attrs.theme).toBeDefined()
        expect(attrs.updatedAt).toBeDefined()
    })

    describe('parseHTML', () => {
        const parseHTML = MermaidDiagram.config.parseHTML()

        it('parses base64 data-code', () => {
            const code = 'graph TD; A-->B;'
            const encoded = btoa(code)
            const element = document.createElement('mermaid-block')
            element.setAttribute('data-code', encoded)

            const attrs = parseHTML[0].getAttrs(element)
            expect(attrs.code).toBe(code)
        })

        it('parses legacy code element', () => {
            const code = 'graph TD; A-->B;'
            const element = document.createElement('mermaid-block')
            const codeEl = document.createElement('code')
            codeEl.textContent = code
            element.appendChild(codeEl)

            const attrs = parseHTML[0].getAttrs(element)
            expect(attrs.code).toBe(code)
        })

        it('parses markdown code block', () => {
            const code = 'graph TD; A-->B;'
            const element = document.createElement('pre')
            const codeEl = document.createElement('code')
            codeEl.className = 'language-mermaid'
            codeEl.textContent = code
            element.appendChild(codeEl)

            const attrs = parseHTML[1].getAttrs(element)
            expect(attrs.code).toBe(code)
        })
    })

    describe('renderHTML', () => {
        it('encodes code to base64', () => {
            const code = 'graph TD; A-->B;'
            const node = { attrs: { code, theme: 'default', updatedAt: 123 } }
            const result = MermaidDiagram.config.renderHTML({ node, HTMLAttributes: {} })

            expect(result[0]).toBe('mermaid-block')
            expect(result[1]['data-code']).toBe(btoa(code))
        })
    })

    describe('Input Rules', () => {
        it('triggers on ``mm', () => {
            const rule = MermaidDiagram.config.addInputRules()[0]
            expect(rule.find.test('``mm')).toBe(true)
            expect(rule.find.test('``m')).toBe(false)
        })
    })
})
