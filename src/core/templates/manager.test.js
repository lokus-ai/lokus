import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateManager } from './manager'

// Mock dates.js to prevent recursion issues with date-fns
vi.mock('./dates.js', () => ({
    dateHelpers: {
        now: () => new Date(),
        format: () => '2023-01-01',
        week: 1,
        year: 2023
    }
}))

// Mock IntegratedTemplateProcessor
vi.mock('./processor-integrated.js', () => {
    class MockProcessor {
        constructor() { }
        process(content, variables) {
            // Simple variable replacement for testing
            return Promise.resolve({
                result: content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key]),
                variables,
                metadata: {}
            })
        }
    }
    return {
        IntegratedTemplateProcessor: MockProcessor,
        TemplateProcessor: MockProcessor
    }
})

describe('TemplateManager', () => {
    let manager

    beforeEach(() => {
        manager = new TemplateManager({
            storage: new Map() // Use in-memory storage
        })
    })

    it('creates a template', async () => {
        const template = await manager.create({
            id: 't1',
            name: 'Test Template',
            content: 'Hello {{name}}',
            category: 'general'
        })

        expect(template.id).toBe('t1')
        expect(manager.storage.has('t1')).toBe(true)
    })

    it('validates template content', async () => {
        await expect(manager.create({
            id: 't2',
            name: 'Bad Template',
            content: '{{unclosed'
        })).rejects.toThrow('Invalid template syntax')
    })

    it('updates a template', async () => {
        await manager.create({
            id: 't1',
            name: 'Original',
            content: 'Content'
        })

        const updated = await manager.update('t1', {
            name: 'Updated'
        })

        expect(updated.name).toBe('Updated')
        expect(updated.metadata.version).toBe('1.0.1')
    })

    it('deletes a template', async () => {
        await manager.create({
            id: 't1',
            name: 'To Delete',
            content: 'Content'
        })

        const result = await manager.delete('t1')
        expect(result).toBe(true)
        expect(manager.storage.has('t1')).toBe(false)
    })

    it('lists templates with filtering', async () => {
        await manager.create({
            id: 't1',
            name: 'General Template',
            content: 'Content',
            category: 'general'
        })
        await manager.create({
            id: 't2',
            name: 'Report Template',
            content: 'Content',
            category: 'reports'
        })

        const general = manager.list({ category: 'general' })
        expect(general.templates).toHaveLength(1)
        expect(general.templates[0].id).toBe('t1')
    })

    it('processes a template', async () => {
        await manager.create({
            id: 't1',
            name: 'Process Me',
            content: 'Hello {{name}}'
        })

        const result = await manager.process('t1', { name: 'World' })
        expect(result.result).toBe('Hello World')
    })
})
