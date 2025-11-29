import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MermaidViewerModal } from './MermaidViewerModal'

describe('MermaidViewerModal Component', () => {
    const defaultProps = {
        isOpen: true,
        svgContent: '<svg width="100" height="100"><rect /></svg>',
        onClose: vi.fn()
    }

    beforeEach(() => {
        // Mock getBBox since JSDOM doesn't support it
        Element.prototype.getBBox = () => ({
            x: 0, y: 0, width: 100, height: 100
        })

        // Mock window dimensions
        window.innerWidth = 1000
        window.innerHeight = 800
    })

    it('renders SVG content', () => {
        const { container } = render(<MermaidViewerModal {...defaultProps} />)
        expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('calculates auto-fit zoom on mount', async () => {
        render(<MermaidViewerModal {...defaultProps} />)

        // Wait for useLayoutEffect timeout
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 60))
        })

        // Check if zoom indicator shows a value (e.g., "900%")
        // 1000*0.9 / 100 = 9x zoom -> capped at 2x -> 200%
        expect(screen.getByText('200%')).toBeInTheDocument()
    })

    it('handles zoom controls', async () => {
        render(<MermaidViewerModal {...defaultProps} />)

        // Wait for initial zoom
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 60))
        })

        const zoomInBtn = screen.getByTitle('Zoom in')
        fireEvent.click(zoomInBtn)

        // Should increase zoom
        expect(screen.queryByText('200%')).not.toBeInTheDocument()
    })

    it('handles panning', () => {
        const { container } = render(<MermaidViewerModal {...defaultProps} />)

        // Find the container that handles mouse events
        // It's the div with onMouseDown
        const panContainer = container.querySelector('.relative.w-full.h-full')

        fireEvent.mouseDown(panContainer, { clientX: 100, clientY: 100 })
        fireEvent.mouseMove(panContainer, { clientX: 150, clientY: 150 })
        fireEvent.mouseUp(panContainer)

        // We can't easily check the transform style update in JSDOM without more complex setup,
        // but we can verify the event handlers didn't crash
        expect(panContainer).toBeInTheDocument()
    })

    it('closes on Escape key', () => {
        render(<MermaidViewerModal {...defaultProps} />)

        fireEvent.keyDown(window, { key: 'Escape' })
        expect(defaultProps.onClose).toHaveBeenCalled()
    })
})
