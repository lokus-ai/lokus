import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImageInsertModal from './ImageInsertModal'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri invoke and convertFileSrc
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
    convertFileSrc: vi.fn((path) => `asset://${path}`)
}))

describe('ImageInsertModal Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onInsert: vi.fn(),
        workspacePath: '/test/workspace'
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders URL mode by default', () => {
        render(<ImageInsertModal {...defaultProps} />)
        expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Image URL' })).toHaveClass('text-app-accent')
    })

    it('switches to file mode and loads images', async () => {
        invoke.mockResolvedValue(['/test/workspace/img1.png', '/test/workspace/img2.jpg'])

        render(<ImageInsertModal {...defaultProps} />)

        fireEvent.click(screen.getByText('Workspace File'))

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('find_workspace_images', { workspacePath: '/test/workspace' })
        })

        expect(screen.getByAltText('img1.png')).toBeInTheDocument()
        expect(screen.getByAltText('img2.jpg')).toBeInTheDocument()
    })

    it('handles URL input and insertion', () => {
        render(<ImageInsertModal {...defaultProps} />)

        const input = screen.getByPlaceholderText('https://example.com/image.jpg')
        fireEvent.change(input, { target: { value: 'https://example.com/test.png' } })

        const altInput = screen.getByPlaceholderText('Describe the image')
        fireEvent.change(altInput, { target: { value: 'Test Image' } })

        fireEvent.click(screen.getByRole('button', { name: 'Insert Image' }))

        expect(defaultProps.onInsert).toHaveBeenCalledWith({
            src: 'https://example.com/test.png',
            alt: 'Test Image'
        })
    })

    it('handles file selection and insertion', async () => {
        invoke.mockResolvedValue(['/test/workspace/img1.png'])

        render(<ImageInsertModal {...defaultProps} />)
        fireEvent.click(screen.getByText('Workspace File'))

        await waitFor(() => {
            expect(screen.getByAltText('img1.png')).toBeInTheDocument()
        })

        // Click the image button
        const imgButton = screen.getByAltText('img1.png').closest('button')
        fireEvent.click(imgButton)

        // Check if alt text was auto-filled
        expect(screen.getByDisplayValue('img1')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Insert Image' }))

        // The component uses convertFileSrc which transforms the path to asset:// protocol
        expect(defaultProps.onInsert).toHaveBeenCalledWith({
            src: 'asset:///test/workspace/img1.png',
            alt: 'img1'
        })
    })

    it('validates URL preview', async () => {
        render(<ImageInsertModal {...defaultProps} />)

        const input = screen.getByPlaceholderText('https://example.com/image.jpg')
        fireEvent.change(input, { target: { value: 'invalid-url' } })

        await waitFor(() => {
            expect(screen.getByText('Invalid URL')).toBeInTheDocument()
        })
    })
})
