import { describe, it, expect, vi } from 'vitest'
import createSlashCommandPlugin from './SlashCommand'

// Mock dependencies
vi.mock('./slash-command.jsx', () => ({
    default: {
        items: () => [],
        render: () => ({})
    }
}))

vi.mock('./suggestion-plugin.js', () => ({
    createSuggestionPlugin: (config) => ({
        key: { key: config.pluginKey?.key || 'slashCommandSuggestion$' },
        _config: config,
    }),
    PluginKey: class PluginKey {
        constructor(name) { this.key = name + '$' }
    },
}))

describe('createSlashCommandPlugin', () => {
    it('should be a function', () => {
        expect(typeof createSlashCommandPlugin).toBe('function')
    })

    it('should return a plugin when called with a view', () => {
        const mockView = { state: {}, dispatch: () => {}, dom: document.createElement('div') }
        const plugin = createSlashCommandPlugin(mockView)
        expect(plugin).toBeDefined()
        expect(plugin.key.key).toContain('slashCommandSuggestion')
    })

    it('should configure with slash character trigger', () => {
        const mockView = { state: {}, dispatch: () => {}, dom: document.createElement('div') }
        const plugin = createSlashCommandPlugin(mockView)
        expect(plugin._config.char).toBe('/')
    })

    it('should not allow spaces in query', () => {
        const mockView = { state: {}, dispatch: () => {}, dom: document.createElement('div') }
        const plugin = createSlashCommandPlugin(mockView)
        expect(plugin._config.allowSpaces).toBe(false)
    })
})
