import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import DocumentOutline from './DocumentOutline'

describe('DocumentOutline Component', () => {
    let mockEditor

    beforeEach(() => {
        vi.useFakeTimers()

        // Mock TipTap editor
        mockEditor = {
            state: {
                doc: {
                    descendants: vi.fn((callback) => {
                        // Simulate document traversal
                        const nodes = [
                            { type: { name: 'heading' }, attrs: { level: 1 }, textContent: 'Heading 1' },
                            { type: { name: 'paragraph' }, textContent: 'text' },
                            { type: { name: 'heading' }, attrs: { level: 2 }, textContent: 'Heading 2' }
                        ]
                        nodes.forEach((node, index) => callback(node, index * 10))
                    })
                }
            },
            on: vi.fn(),
            off: vi.fn(),
            commands: {
                focus: vi.fn(),
                setTextSelection: vi.fn()
            },
            view: {
                coordsAtPos: vi.fn(() => ({ top: 100 }))
            }
        }

        // Mock window.scrollTo
        window.scrollTo = vi.fn()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders "No editor available" when editor is null', () => {
        render(<DocumentOutline editor={null} />)
        expect(screen.getByText('No editor available')).toBeInTheDocument()
    })

    it('renders headings from editor', () => {
        render(<DocumentOutline editor={mockEditor} />)

        expect(screen.getByText('Heading 1')).toBeInTheDocument()
        expect(screen.getByText('Heading 2')).toBeInTheDocument()
        expect(screen.queryByText('text')).not.toBeInTheDocument()
    })

    it('scrolls to heading on click', () => {
        render(<DocumentOutline editor={mockEditor} />)

        fireEvent.click(screen.getByText('Heading 1'))

        expect(mockEditor.commands.focus).toHaveBeenCalled()
        expect(mockEditor.commands.setTextSelection).toHaveBeenCalledWith(0) // pos 0
        expect(window.scrollTo).toHaveBeenCalled()
    })

    it('updates headings when editor updates', () => {
        render(<DocumentOutline editor={mockEditor} />)

        // Verify initial render
        expect(screen.getByText('Heading 1')).toBeInTheDocument()

        // Simulate editor update with new content
        mockEditor.state.doc.descendants = vi.fn((callback) => {
            const nodes = [
                { type: { name: 'heading' }, attrs: { level: 1 }, textContent: 'New Heading' }
            ]
            nodes.forEach((node, index) => callback(node, index * 10))
        })

        // Trigger update handler
        const updateHandler = mockEditor.on.mock.calls[0][1]

        act(() => {
            updateHandler()
            vi.advanceTimersByTime(500) // Fast forward debounce
        })

        expect(screen.getByText('New Heading')).toBeInTheDocument()
        expect(screen.queryByText('Heading 1')).not.toBeInTheDocument()
    })

    it('cleans up event listeners on unmount', () => {
        const { unmount } = render(<DocumentOutline editor={mockEditor} />)
        unmount()
        expect(mockEditor.off).toHaveBeenCalled()
    })
})
