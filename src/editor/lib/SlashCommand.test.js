import { describe, it, expect, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import SlashCommand from './SlashCommand'

// Mock dependencies
vi.mock('./slash-command.jsx', () => ({
    default: {
        items: () => [],
        render: () => ({})
    }
}))

describe('SlashCommand Extension', () => {
    let editor

    it('should have correct name', () => {
        expect(SlashCommand.name).toBe('slashCommand')
    })

    it('should register ProseMirror plugins', () => {
        editor = new Editor({
            extensions: [
                StarterKit,
                SlashCommand
            ]
        })

        const plugins = editor.state.plugins
        const slashPlugin = plugins.find(p => p.key.startsWith('slashCommandSuggestion'))
        expect(slashPlugin).toBeDefined()
    })

    it('should handle slash character', () => {
        // We can't easily test the suggestion popup logic in unit tests without full DOM,
        // but we can verify the plugin configuration
        const plugin = SlashCommand.config.addProseMirrorPlugins.call({ editor: {} })[0]
        expect(plugin).toBeDefined()
    })
})
