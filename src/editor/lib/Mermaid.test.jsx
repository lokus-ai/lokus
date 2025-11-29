import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MermaidComponent from './Mermaid'
import mermaid from 'mermaid'

// Mock dependencies
vi.mock('mermaid', () => ({
    default: {
        initialize: vi.fn(),
        render: vi.fn(() => Promise.resolve({ svg: '<svg>mock</svg>' }))
    }
}))

vi.mock('@tiptap/react', () => ({
    NodeViewWrapper: ({ children, ...props }) => <div data-testid="node-view-wrapper" {...props}>{children}</div>
}))

vi.mock('../../components/MermaidViewerModal.jsx', () => ({
    MermaidViewerModal: ({ isOpen }) => isOpen ? <div data-testid="mermaid-modal">Modal</div> : null
}))

vi.mock('lucide-react', () => ({
    Eye: () => <span>Eye</span>,
    SquarePen: () => <span>Edit</span>,
    Maximize2: () => <span>Max</span>
}))

describe('MermaidComponent', () => {
    const mockUpdateAttributes = vi.fn()
    const defaultProps = {
        node: { attrs: { code: 'graph TD; A-->B;' } },
        updateAttributes: mockUpdateAttributes
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mermaid.render.mockReset()
        mermaid.render.mockResolvedValue({ svg: '<svg>mock</svg>' })
    })

    it('renders diagram initially', async () => {
        render(<MermaidComponent {...defaultProps} />)

        await waitFor(() => {
            expect(mermaid.initialize).toHaveBeenCalled()
            expect(mermaid.render).toHaveBeenCalled()
        })
    })

    it('toggles edit mode', () => {
        render(<MermaidComponent {...defaultProps} />)

        // Initially viewing (since code exists)
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

        // Click edit button
        fireEvent.click(screen.getByTitle('Edit Diagram'))

        expect(screen.getByRole('textbox')).toBeInTheDocument()
        expect(screen.getByRole('textbox')).toHaveValue('graph TD; A-->B;')

        // Click view button
        fireEvent.click(screen.getByTitle('View Diagram'))
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('updates attributes on blur', () => {
        render(<MermaidComponent {...defaultProps} />)

        // Enter edit mode
        fireEvent.click(screen.getByTitle('Edit Diagram'))

        const textarea = screen.getByRole('textbox')
        fireEvent.change(textarea, { target: { value: 'graph TD; B-->C;' } })
        fireEvent.blur(textarea)

        expect(mockUpdateAttributes).toHaveBeenCalledWith({ code: 'graph TD; B-->C;' })
    })

    it('handles mermaid render error', async () => {
        mermaid.render.mockRejectedValue(new Error('Syntax Error'))

        render(<MermaidComponent {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByTestId('node-view-wrapper')).toHaveTextContent('Syntax Error')
        })
    })

    it('opens fullscreen viewer', async () => {
        // We need to mock containerRef.current.querySelector('svg')
        // But since we can't easily access ref, we rely on component setting innerHTML
        // and JSDOM updating it.
        // However, XMLSerializer might not work in JSDOM without polyfill or mock.
        // We'll mock XMLSerializer.
        global.XMLSerializer = class {
            serializeToString() { return '<svg>serialized</svg>' }
        }

        render(<MermaidComponent {...defaultProps} />)

        // Wait for render
        await waitFor(() => expect(mermaid.render).toHaveBeenCalled())

        // We need to ensure the DOM has the SVG.
        // The component does containerRef.current.innerHTML = svg.
        // JSDOM should handle this.

        const maxBtn = await screen.findByTitle('View fullscreen')
        fireEvent.click(maxBtn)

        expect(screen.getByTestId('mermaid-modal')).toBeInTheDocument()
    })
})

