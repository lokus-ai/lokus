import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShortcutHelpModal from './ShortcutHelpModal'

describe('ShortcutHelpModal Component', () => {
    it('does not render when isOpen is false', () => {
        const { container } = render(
            <ShortcutHelpModal isOpen={false} onClose={vi.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders correctly when open', () => {
        render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
        expect(screen.getByText('File Operations')).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(<ShortcutHelpModal isOpen={true} onClose={onClose} />)

        // Find the close button (it has an X icon)
        // We can find it by the button element that contains the X icon
        const buttons = screen.getAllByRole('button')
        // The close button is usually the first one or we can look for specific class/style
        // In this component, it's the button in the header
        const closeButton = buttons[0]

        fireEvent.click(closeButton)
        expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn()
        render(<ShortcutHelpModal isOpen={true} onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalled()
    })

    it('detects Mac platform correctly', () => {
        // Mock navigator.platform
        Object.defineProperty(navigator, 'platform', {
            value: 'MacIntel',
            configurable: true
        })

        render(<ShortcutHelpModal isOpen={true} onClose={vi.fn()} />)
        expect(screen.getAllByText(/⌘/).length).toBeGreaterThan(0)
    })
})
