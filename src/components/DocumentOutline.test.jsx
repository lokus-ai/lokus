import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import DocumentOutline from './DocumentOutline'

// Mock setTextSelection from the commands module — DocumentOutline.jsx imports
// and calls `setTextSelection(editor, pos)` directly (not editor.commands.*).
vi.mock('../editor/commands/index.js', () => ({
    setTextSelection: vi.fn(),
}))

import { setTextSelection } from '../editor/commands/index.js'

// jsdom does not ship with a real MutationObserver implementation that fires
// callbacks synchronously. We provide a manual mock that records observer
// instances so tests can trigger the callback themselves.
const observerInstances = []
const OriginalMutationObserver = globalThis.MutationObserver

class MockMutationObserver {
    constructor(callback) {
        this.callback = callback
        this.observed = false
        observerInstances.push(this)
    }
    observe() { this.observed = true }
    disconnect() { this.observed = false }
}

describe('DocumentOutline Component', () => {
    let mockEditor

    beforeEach(() => {
        vi.useFakeTimers()

        // Replace the global MutationObserver with our mock
        globalThis.MutationObserver = MockMutationObserver
        observerInstances.length = 0

        // Build a ProseMirror-style editor mock.
        // DocumentOutline uses:
        //   editor.state.doc.descendants(callback)
        //   editor.dom                (to pass to MutationObserver.observe)
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
        globalThis.MutationObserver = OriginalMutationObserver
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

    it('scrolls to heading on click using setTextSelection and editor.coordsAtPos', () => {
        render(<DocumentOutline editor={mockEditor} />)

        fireEvent.click(screen.getByText('Heading 1'))

        // setTextSelection is imported from commands/index.js and called with
        // (editor, pos). Heading 1 is at pos=0 (first node, index 0 * 10 = 0).
        expect(setTextSelection).toHaveBeenCalledWith(mockEditor, 0)

        // coordsAtPos is called directly on the editor view object
        expect(mockEditor.coordsAtPos).toHaveBeenCalledWith(0)

        // window.scrollTo is called with the coords
        expect(window.scrollTo).toHaveBeenCalled()
    })

    it('attaches a MutationObserver to editor.dom on mount', () => {
        render(<DocumentOutline editor={mockEditor} />)

        // At least one observer should have been created and started observing
        expect(observerInstances.length).toBeGreaterThan(0)
        expect(observerInstances[0].observed).toBe(true)
    })

    it('updates headings after MutationObserver fires and debounce expires', () => {
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

        // Simulate the MutationObserver callback firing (mimics a DOM mutation)
        act(() => {
            observerInstances[0].callback([], observerInstances[0])
            vi.advanceTimersByTime(500) // advance past the 500ms debounce
        })

        expect(screen.getByText('New Heading')).toBeInTheDocument()
        expect(screen.queryByText('Heading 1')).not.toBeInTheDocument()
    })

    it('disconnects the MutationObserver on unmount', () => {
        const { unmount } = render(<DocumentOutline editor={mockEditor} />)

        expect(observerInstances[0].observed).toBe(true)

        unmount()

        expect(observerInstances[0].observed).toBe(false)
    })
})
