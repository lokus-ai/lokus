import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import DocumentOutline from './DocumentOutline'

// Mock setTextSelection from the commands module — DocumentOutline.jsx imports
// and calls `setTextSelection(editor, pos)` directly (not editor.commands.*).
vi.mock('../editor/commands/index.js', () => ({
    setTextSelection: vi.fn(),
}))

import { setTextSelection } from '../editor/commands/index.js'
import { editorAPI } from '../plugins/api/EditorAPI.js'

describe('DocumentOutline Component', () => {
    let mockEditor

    beforeEach(() => {
        vi.useFakeTimers()
        editorAPI.removeAllListeners('editor-update')

        // Build a ProseMirror-style editor mock.
        // DocumentOutline uses:
        //   editor.state.doc.descendants(callback)
        //   editor.coordsAtPos(pos)   (directly on the view, not view.coordsAtPos)
        //   setTextSelection(editor, pos) from commands module
        mockEditor = {
            state: {
                doc: {
                    descendants: vi.fn((callback) => {
                        const nodes = [
                            { type: { name: 'heading' }, attrs: { level: 1 }, textContent: 'Heading 1' },
                            { type: { name: 'paragraph' }, textContent: 'text' },
                            { type: { name: 'heading' }, attrs: { level: 2 }, textContent: 'Heading 2' }
                        ]
                        nodes.forEach((node, index) => callback(node, index * 10))
                    })
                }
            },
            dom: document.createElement('div'),
            coordsAtPos: vi.fn(() => ({ top: 100 })),
        }

        // Mock window.scrollTo
        window.scrollTo = vi.fn()
    })

    afterEach(() => {
        vi.useRealTimers()
        editorAPI.removeAllListeners('editor-update')
        vi.clearAllMocks()
    })

    it('renders "No editor available" when editor is null', () => {
        render(<DocumentOutline editor={null} />)
        expect(screen.getByText('No editor available')).toBeInTheDocument()
    })

    it('renders headings extracted from editor.state.doc', () => {
        render(<DocumentOutline editor={mockEditor} />)

        expect(screen.getByText('Heading 1')).toBeInTheDocument()
        expect(screen.getByText('Heading 2')).toBeInTheDocument()
        // Paragraph text is NOT a heading — must not appear
        expect(screen.queryByText('text')).not.toBeInTheDocument()
    })

    it('scrolls to heading on click via setTextSelection (which scrollIntoViews the editor)', () => {
        render(<DocumentOutline editor={mockEditor} />)

        fireEvent.click(screen.getByText('Heading 1'))

        // setTextSelection is imported from commands/index.js and called with
        // (editor, pos + 1) — pos+1 places the cursor INSIDE the heading node,
        // and setTextSelection itself dispatches scrollIntoView on the editor's
        // scroll container. window.scrollTo scrolled the window, not the
        // editor, so it was removed.
        expect(setTextSelection).toHaveBeenCalledWith(mockEditor, 1)
        expect(window.scrollTo).not.toHaveBeenCalled()
    })

    // The outline listens for the editor's own update event rather than
    // observing the ProseMirror DOM. A MutationObserver with subtree +
    // characterData fired on every keystroke's text mutation, building records
    // that were then discarded by the debounce.
    it('subscribes to editor updates on mount', () => {
        expect(editorAPI.listenerCount('editor-update')).toBe(0)

        render(<DocumentOutline editor={mockEditor} />)

        expect(editorAPI.listenerCount('editor-update')).toBe(1)
    })

    it('updates headings after an editor update and the debounce expires', () => {
        render(<DocumentOutline editor={mockEditor} />)

        // Verify initial headings are shown
        expect(screen.getByText('Heading 1')).toBeInTheDocument()

        // Change the descendants mock to return different headings
        mockEditor.state.doc.descendants = vi.fn((callback) => {
            const nodes = [
                { type: { name: 'heading' }, attrs: { level: 1 }, textContent: 'New Heading' }
            ]
            nodes.forEach((node, index) => callback(node, index * 10))
        })

        act(() => {
            editorAPI.emit('editor-update')
            vi.advanceTimersByTime(500) // advance past the 500ms debounce
        })

        expect(screen.getByText('New Heading')).toBeInTheDocument()
        expect(screen.queryByText('Heading 1')).not.toBeInTheDocument()
    })

    it('unsubscribes on unmount', () => {
        const { unmount } = render(<DocumentOutline editor={mockEditor} />)

        expect(editorAPI.listenerCount('editor-update')).toBe(1)

        unmount()

        expect(editorAPI.listenerCount('editor-update')).toBe(0)
    })
})
