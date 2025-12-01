import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { MathInline, MathBlock } from './Math'

// Mock KaTeX
global.window.katex = {
    renderToString: vi.fn((tex) => `<span class="katex">${tex}</span>`)
}

describe('Math Extensions', () => {
    let editor

    beforeEach(() => {
        editor = new Editor({
            extensions: [
                StarterKit,
                MathInline,
                MathBlock
            ],
            content: '<p>Test</p>'
        })
    })

    describe('MathInline', () => {
        it('should have correct name', () => {
            expect(MathInline.name).toBe('mathInline')
        })

        it('should insert inline math', () => {
            editor.commands.setMathInline('E=mc^2')

            const html = editor.getHTML()
            expect(html).toContain('data-type="math-inline"')
            expect(html).toContain('data-src="E=mc^2"')
        })

        it('should parse inline math HTML', () => {
            editor.commands.setContent('<p><span data-type="math-inline" data-src="x^2"></span></p>')

            const json = editor.getJSON()
            // doc -> p -> mathInline
            const mathNode = json.content[0].content[0]
            expect(mathNode.type).toBe('mathInline')
            expect(mathNode.attrs.src).toBe('x^2')
        })
    })

    describe('MathBlock', () => {
        it('should have correct name', () => {
            expect(MathBlock.name).toBe('mathBlock')
        })

        it('should insert math block', () => {
            editor.commands.setMathBlock('\\sum_{i=0}^n i^2')

            const html = editor.getHTML()
            expect(html).toContain('data-type="math-block"')
            expect(html).toContain('data-src="\\sum_{i=0}^n i^2"')
        })

        it('should parse math block HTML', () => {
            editor.commands.setContent('<div data-type="math-block" data-src="x^2"></div>')

            const json = editor.getJSON()
            const mathNode = json.content[0]
            expect(mathNode.type).toBe('mathBlock')
            expect(mathNode.attrs.src).toBe('x^2')
        })
    })
})
