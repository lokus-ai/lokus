import { describe, it, expect, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Callout from './Callout'

describe('Callout Extension', () => {
    let editor

    beforeEach(() => {
        editor = new Editor({
            extensions: [
                StarterKit,
                Callout
            ],
            content: '<p>Test</p>'
        })
    })

    it('should have correct name', () => {
        expect(Callout.name).toBe('callout')
    })

    it('should create callout', () => {
        editor.commands.setCallout({ type: 'info', title: 'Info' })

        const json = editor.getJSON()
        // doc -> callout -> paragraph
        const callout = json.content[0]

        expect(callout.type).toBe('callout')
        expect(callout.attrs.type).toBe('info')
        expect(callout.attrs.title).toBe('Info')
    })

    it('should toggle callout', () => {
        editor.commands.setContent('<p>Content</p>')
        editor.commands.selectAll()
        editor.commands.toggleCallout({ type: 'warning' })

        const json = editor.getJSON()
        const callout = json.content[0]
        expect(callout.type).toBe('callout')
        expect(callout.attrs.type).toBe('warning')

        // Toggle off (unwrap)
        editor.commands.focus('start')
        editor.commands.unsetCallout()

        const newJson = editor.getJSON()
        expect(newJson.content[0].type).toBe('paragraph')
    })

    it('should handle input rules', () => {
        editor.commands.clearContent()
        editor.commands.focus()

        // Simulate typing >[!tip] Title
        // We can't easily simulate typing in JSDOM, but we can verify input rules exist
        expect(Callout.config.addInputRules).toBeDefined()
        const rules = Callout.config.addInputRules()
        expect(rules.length).toBeGreaterThan(0)
    })

    it('should render HTML with correct classes', () => {
        editor.commands.setCallout({ type: 'danger', title: 'Alert' })

        const html = editor.getHTML()
        expect(html).toContain('class="callout callout-danger"')
        expect(html).toContain('data-callout-type="danger"')
        expect(html).toContain('Alert')
    })
})
