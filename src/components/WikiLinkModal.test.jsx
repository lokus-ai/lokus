import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WikiLinkModal from './editor/WikiLinkModal'
import * as tauriApi from '@tauri-apps/api/core'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

// Mock platform service
vi.mock('../services/platform/PlatformService.js', () => ({
    default: {
        getModifierSymbol: () => '⌘'
    }
}))

describe('WikiLinkModal Component', () => {
    const mockFiles = [
        { name: 'Note 1.md', is_directory: false },
        { name: 'Note 2.md', is_directory: false },
        {
            name: 'Folder',
            is_directory: true,
            children: [
                { name: 'Nested Note.md', is_directory: false }
            ]
        }
    ]

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onSelectFile: vi.fn(),
        workspacePath: '/test/workspace',
        currentFile: null
    }

    beforeEach(() => {
        vi.clearAllMocks()
        tauriApi.invoke.mockResolvedValue(mockFiles)
    })

    it('should not render when closed', () => {
        render(<WikiLinkModal {...defaultProps} isOpen={false} />)
        expect(screen.queryByPlaceholderText('Search files...')).not.toBeInTheDocument()
    })

    it('should render and load files when open', async () => {
        render(<WikiLinkModal {...defaultProps} />)

        expect(screen.getByPlaceholderText('Search files...')).toBeInTheDocument()

        await waitFor(() => {
            expect(tauriApi.invoke).toHaveBeenCalledWith('read_workspace_files', {
                workspacePath: '/test/workspace'
            })
        })

        await waitFor(() => {
            expect(screen.getByText('Note 1')).toBeInTheDocument()
            expect(screen.getByText('Note 2')).toBeInTheDocument()
            expect(screen.getByText('Nested Note')).toBeInTheDocument()
        })
    })

    it('should filter files based on search query', async () => {
        render(<WikiLinkModal {...defaultProps} />)

        await waitFor(() => screen.getByText('Note 1'))

        const input = screen.getByPlaceholderText('Search files...')
        fireEvent.change(input, { target: { value: 'Nested' } })

        expect(screen.getAllByText((content, element) =>
            element.tagName.toLowerCase() === 'div' &&
            element.textContent.includes('Nested') &&
            element.textContent.includes('Note')
        )[0]).toBeInTheDocument()
        expect(screen.queryByText('Note 1')).not.toBeInTheDocument()
    })

    it('should select file on click', async () => {
        render(<WikiLinkModal {...defaultProps} />)

        await waitFor(() => screen.getByText('Note 1'))

        fireEvent.click(screen.getByText('Note 1'))

        expect(defaultProps.onSelectFile).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Note 1',
            path: 'Note 1.md'
        }))
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should handle keyboard navigation', async () => {
        render(<WikiLinkModal {...defaultProps} />)

        await waitFor(() => screen.getByText('Note 1'))

        // Initially first item selected (Note 1)

        // Press ArrowDown -> Note 2
        fireEvent.keyDown(document, { key: 'ArrowDown' })

        // Press Enter -> Select Note 2
        fireEvent.keyDown(document, { key: 'Enter' })

        expect(defaultProps.onSelectFile).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Note 2'
        }))
    })

    it('should close on Escape', () => {
        render(<WikiLinkModal {...defaultProps} />)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(defaultProps.onClose).toHaveBeenCalled()
    })
})
