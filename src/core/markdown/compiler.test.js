import { describe, it, expect, vi, beforeEach } from 'vitest'
import MarkdownCompilerClient, { getMarkdownCompiler } from './compiler'

vi.mock('./markdown.worker.js?worker', () => {
    class MockWorker {
        constructor() {
            this.onmessage = null
        }

        postMessage(data) {
            // Simulate async response
            setTimeout(() => {
                if (this.onmessage) {
                    this.onmessage({
                        data: {
                            id: data.id,
                            result: data.type === 'isMarkdown' ? true : '<p>compiled</p>',
                            error: null
                        }
                    })
                }
            }, 10)
        }
    }

    return { default: MockWorker }
})

describe('MarkdownCompiler', () => {
    let compiler

    beforeEach(() => {
        compiler = new MarkdownCompilerClient()
    })

    it('compiles markdown', async () => {
        const result = await compiler.compile('# Hello')
        expect(result).toBe('<p>compiled</p>')
    })

    it('checks if text is markdown', async () => {
        const result = await compiler.isMarkdown('# Hello')
        expect(result).toBe(true)
    })

    it('processes text (check + compile)', async () => {
        const result = await compiler.process('# Hello')
        expect(result).toBe('<p>compiled</p>')
    })

    it('returns singleton instance', () => {
        const instance1 = getMarkdownCompiler()
        const instance2 = getMarkdownCompiler()
        expect(instance1).toBe(instance2)
    })

    it('handles worker errors', async () => {
        // Override worker for error case
        compiler.worker.postMessage = (data) => {
            setTimeout(() => {
                compiler.worker.onmessage({
                    data: {
                        id: data.id,
                        result: null,
                        error: 'Compilation failed'
                    }
                })
            }, 10)
        }

        await expect(compiler.compile('bad')).rejects.toThrow('Compilation failed')
    })
})
