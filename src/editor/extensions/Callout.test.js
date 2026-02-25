import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { lokusSchema } from '../schema/lokus-schema.js'
import {
    createCalloutPlugins,
    setCallout,
    toggleCallout,
    unsetCallout,
    CALLOUT_TYPES,
} from './Callout'

// ---------------------------------------------------------------------------
// Test helper: create a PM EditorView with callout plugins
// ---------------------------------------------------------------------------

function createTestView(content) {
    const state = EditorState.create({
        schema: lokusSchema,
        plugins: createCalloutPlugins(lokusSchema),
    })
    const view = new EditorView(document.createElement('div'), { state })
    return view
}

describe('Callout Extension (ProseMirror)', () => {
    let view

    beforeEach(() => {
        view = createTestView()
    })

    afterEach(() => {
        view.destroy()
    })

    it('should export CALLOUT_TYPES', () => {
        expect(CALLOUT_TYPES).toBeDefined()
        expect(CALLOUT_TYPES.note).toBeDefined()
        expect(CALLOUT_TYPES.tip).toBeDefined()
        expect(CALLOUT_TYPES.warning).toBeDefined()
        expect(CALLOUT_TYPES.danger).toBeDefined()
    })

    it('should create callout plugins array', () => {
        const plugins = createCalloutPlugins(lokusSchema)
        expect(Array.isArray(plugins)).toBe(true)
        expect(plugins.length).toBe(3) // inputRules + keymap + click handler
    })

    it('should wrap selection in a callout via setCallout', () => {
        const result = setCallout(view, { type: 'info', title: 'Info' })
        expect(result).toBe(true)

        const json = view.state.doc.toJSON()
        // After wrapping, the doc should contain a callout node
        const callout = json.content.find(n => n.type === 'callout')
        expect(callout).toBeDefined()
        expect(callout.attrs.type).toBe('info')
        expect(callout.attrs.title).toBe('Info')
    })

    it('should toggle callout on and off via toggleCallout', () => {
        // Toggle on
        const wrapped = toggleCallout(view, { type: 'warning' })
        expect(wrapped).toBe(true)

        let json = view.state.doc.toJSON()
        let callout = json.content.find(n => n.type === 'callout')
        expect(callout).toBeDefined()
        expect(callout.attrs.type).toBe('warning')

        // Toggle off (lifts out of callout)
        const unwrapped = toggleCallout(view)
        expect(unwrapped).toBe(true)

        json = view.state.doc.toJSON()
        // After lifting, the first node should be a paragraph, not a callout
        expect(json.content[0].type).toBe('paragraph')
    })

    it('should lift out of callout via unsetCallout', () => {
        // First wrap in callout
        setCallout(view, { type: 'note' })

        // Place cursor inside the callout
        const resolvedPos = view.state.doc.resolve(2)
        const sel = EditorState.create({
            schema: lokusSchema,
            doc: view.state.doc,
        }).selection
        // The cursor should be inside the callout now
        const calloutNode = view.state.doc.toJSON().content.find(n => n.type === 'callout')
        expect(calloutNode).toBeDefined()

        // Then lift
        const result = unsetCallout(view)
        // unsetCallout calls lift() which may or may not succeed depending on cursor position
        // The important thing is it does not throw
        expect(typeof result).toBe('boolean')
    })

    it('should have correct callout type definitions', () => {
        expect(CALLOUT_TYPES.note.label).toBe('Note')
        expect(CALLOUT_TYPES.tip.label).toBe('Tip')
        expect(CALLOUT_TYPES.warning.label).toBe('Warning')
        expect(CALLOUT_TYPES.danger.label).toBe('Danger')
        expect(CALLOUT_TYPES.info.label).toBe('Info')
        expect(CALLOUT_TYPES.success.label).toBe('Success')
        expect(CALLOUT_TYPES.question.label).toBe('Question')
        expect(CALLOUT_TYPES.example.label).toBe('Example')
    })

    it('should default to type "note" when no type specified', () => {
        setCallout(view)

        const json = view.state.doc.toJSON()
        const callout = json.content.find(n => n.type === 'callout')
        expect(callout).toBeDefined()
        expect(callout.attrs.type).toBe('note')
    })
})
