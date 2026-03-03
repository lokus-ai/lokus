import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchPanel from './SearchPanel'
import { invoke } from '@tauri-apps/api/core'

/**
 * Additional tests for SearchPanel component.
 * SearchPanel.test.jsx covers core functionality.
 * These tests cover additional edge cases and behaviors.
 */

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

vi.mock('../platform/index.js', () => ({
    isDesktop: vi.fn().mockReturnValue(true),
    isMobile: vi.fn().mockReturnValue(false),
}))

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('SearchPanel Additional Coverage', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onFileOpen: vi.fn(),
        workspacePath: '/test/workspace'
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render when isOpen is false', () => {
        render(<SearchPanel {...defaultProps} isOpen={false} />)
        expect(screen.queryByPlaceholderText('Search in files...')).not.toBeInTheDocument()
    })

    it('closes on Escape key press', () => {
        render(<SearchPanel {...defaultProps} />)
        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('closes when close button is clicked', () => {
        render(<SearchPanel {...defaultProps} />)
        const closeBtn = screen.getByTitle('Close search')
        fireEvent.click(closeBtn)
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('shows search title', () => {
        render(<SearchPanel {...defaultProps} />)
        expect(screen.getByText('Search Files')).toBeInTheDocument()
    })

    it('shows no results message when search returns empty', async () => {
        invoke.mockResolvedValue([])

        render(<SearchPanel {...defaultProps} />)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'nomatch' } })

        await sleep(600)

        await waitFor(() => {
            expect(screen.getByText('No results found')).toBeInTheDocument()
        })
    })

    it('shows result count when results found', async () => {
        invoke.mockResolvedValue([
            {
                file: '/test/file1.md',
                fileName: 'file1.md',
                matchCount: 2,
                matches: [
                    { line: 1, column: 0, text: 'match1', context: [] },
                    { line: 2, column: 0, text: 'match2', context: [] }
                ]
            },
            {
                file: '/test/file2.md',
                fileName: 'file2.md',
                matchCount: 1,
                matches: [{ line: 3, column: 0, text: 'match3', context: [] }]
            }
        ])

        render(<SearchPanel {...defaultProps} />)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'match' } })

        await sleep(600)

        await waitFor(() => {
            expect(screen.getByText('2 files found')).toBeInTheDocument()
        })
    })

    it('toggles whole word search option', async () => {
        render(<SearchPanel {...defaultProps} />)

        // Open filters
        const settingsBtn = screen.getByTitle('Search filters')
        fireEvent.click(settingsBtn)

        // Toggle Whole Word
        const wholeWordCheckbox = screen.getByLabelText('Whole word')
        fireEvent.click(wholeWordCheckbox)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'query' } })

        await sleep(600)

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('search_in_files', expect.objectContaining({
                options: expect.objectContaining({
                    wholeWord: true
                })
            }))
        })
    })

    it('shows searching indicator while search is in progress', async () => {
        // Use a slow mock to catch the loading state
        invoke.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 300)))

        render(<SearchPanel {...defaultProps} />)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'loading' } })

        await sleep(600)

        await waitFor(() => {
            expect(screen.getByText('Searching...')).toBeInTheDocument()
        })
    })

    it('clears results when query is empty', async () => {
        invoke.mockResolvedValue([
            {
                file: '/test/file.md',
                fileName: 'file.md',
                matchCount: 1,
                matches: [{ line: 1, column: 0, text: 'match', context: [] }]
            }
        ])

        render(<SearchPanel {...defaultProps} />)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'query' } })
        await sleep(600)

        await waitFor(() => screen.getByText('file.md'))

        // Clear the query
        fireEvent.change(input, { target: { value: '' } })

        await waitFor(() => {
            expect(screen.queryByText('file.md')).not.toBeInTheDocument()
        })
    })
})
