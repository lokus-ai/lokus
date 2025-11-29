import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DiffView from './DiffView'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

// Mock react-diff-view components since they might be complex to render in JSDOM
vi.mock('react-diff-view', () => ({
    parseDiff: vi.fn(() => [{ oldPath: 'file', newPath: 'file', type: 'modify', hunks: [] }]),
    Diff: ({ children }) => <div data-testid="diff-component">{children([])}</div>,
    Hunk: () => <div data-testid="hunk-component" />
}))

// Mock unidiff
vi.mock('unidiff', () => ({
    diffLines: vi.fn(),
    formatLines: vi.fn(() => 'diff content')
}))

describe('DiffView Component', () => {
    const defaultProps = {
        workspacePath: '/test/workspace',
        filePath: '/test/file.md',
        version1: { timestamp: 1000, lines: 10, size: 100 },
        version2: { timestamp: 2000, lines: 12, size: 120 },
        onClose: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads diff on mount', async () => {
        invoke.mockResolvedValue('content')

        render(<DiffView {...defaultProps} />)

        expect(screen.getByText('Loading diff...')).toBeInTheDocument()

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledTimes(2) // Once for each version
        })

        expect(screen.getByTestId('diff-component')).toBeInTheDocument()
    })

    it('handles loading error', async () => {
        invoke.mockRejectedValue(new Error('Failed to load'))

        render(<DiffView {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('Failed to load diff')).toBeInTheDocument()
        })
    })

    it('toggles view type', async () => {
        invoke.mockResolvedValue('content')

        render(<DiffView {...defaultProps} />)

        await waitFor(() => screen.getByTestId('diff-component'))

        const unifiedBtn = screen.getByTitle('Unified view')
        fireEvent.click(unifiedBtn)

        expect(unifiedBtn).toHaveClass('active')
    })

    it('toggles fullscreen', async () => {
        invoke.mockResolvedValue('content')

        const { container } = render(<DiffView {...defaultProps} />)

        await waitFor(() => screen.getByTestId('diff-component'))

        const fullscreenBtn = screen.getByTitle('Enter fullscreen')
        fireEvent.click(fullscreenBtn)

        expect(container.firstChild).toHaveClass('fullscreen')
    })
})
