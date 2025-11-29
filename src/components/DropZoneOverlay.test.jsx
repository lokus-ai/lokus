import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import DropZoneOverlay, { DropZoneHighlight } from './DropZoneOverlay'

describe('DropZoneOverlay Component', () => {
    const mockHandlers = {
        onDropZoneHover: vi.fn(),
        onDrop: vi.fn()
    }

    it('does not render when isVisible is false', () => {
        const { container } = render(
            <DropZoneOverlay isVisible={false} {...mockHandlers} groupId="group-1" />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders all drop zones when visible', () => {
        const { container } = render(
            <DropZoneOverlay isVisible={true} {...mockHandlers} groupId="group-1" />
        )
        // Should have 5 drop zones (top, bottom, left, right, center)
        // The container has one wrapper div, and 5 children divs
        expect(container.firstChild.children).toHaveLength(5)
    })

    it('calls onDropZoneHover when dragging over a zone', () => {
        const { container } = render(
            <DropZoneOverlay isVisible={true} {...mockHandlers} groupId="group-1" />
        )

        // Find the top zone (first one in the list usually, but let's check styles if needed)
        // Based on implementation order: top, bottom, left, right, center
        const topZone = container.firstChild.children[0]

        fireEvent.dragOver(topZone)

        expect(mockHandlers.onDropZoneHover).toHaveBeenCalledWith({
            groupId: 'group-1',
            position: 'top'
        })
    })

    it('calls onDrop when dropping on a zone', () => {
        const { container } = render(
            <DropZoneOverlay isVisible={true} {...mockHandlers} groupId="group-1" />
        )

        const centerZone = container.firstChild.children[4] // 5th item

        fireEvent.drop(centerZone)

        expect(mockHandlers.onDrop).toHaveBeenCalledWith({
            groupId: 'group-1',
            position: 'center'
        })
    })
})

describe('DropZoneHighlight Component', () => {
    it('does not render when dropTarget is null', () => {
        const { container } = render(<DropZoneHighlight dropTarget={null} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders highlight with correct style for top position', () => {
        const { container } = render(
            <DropZoneHighlight dropTarget={{ position: 'top' }} />
        )
        const highlight = container.firstChild.firstChild
        expect(highlight.className).toContain('top-0 left-0 right-0 h-1/2')
    })

    it('renders highlight with correct style for center position', () => {
        const { container } = render(
            <DropZoneHighlight dropTarget={{ position: 'center' }} />
        )
        const highlight = container.firstChild.firstChild
        expect(highlight.className).toContain('inset-0')
    })
})
