import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VersionHistoryPanel from './features/VersionHistoryPanel'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

describe('VersionHistoryPanel Component', () => {
    const defaultProps = {
        workspacePath: '/test/workspace',
        filePath: '/test/file.md',
        onClose: vi.fn(),
        onSelectVersion: vi.fn(),
        onRestore: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads versions on mount', async () => {
        const now = Date.now()
        invoke.mockResolvedValue([
            { timestamp: now, action: 'save', lines: 10, size: 100 }
        ])

        render(<VersionHistoryPanel {...defaultProps} />)

        expect(screen.getByText('Loading versions...')).toBeInTheDocument()

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('get_file_versions', {
                workspacePath: '/test/workspace',
                filePath: '/test/file.md'
            })
        })

        expect(screen.getByText('Today')).toBeInTheDocument()
        expect(screen.getByText('save')).toBeInTheDocument()
    })

    it('handles empty history', async () => {
        invoke.mockResolvedValue([])

        render(<VersionHistoryPanel {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('No version history yet')).toBeInTheDocument()
        })
    })

    it('groups versions correctly', async () => {
        const now = Date.now()
        const yesterday = now - 24 * 60 * 60 * 1000

        invoke.mockResolvedValue([
            { timestamp: now, action: 'v1', lines: 10, size: 100 },
            { timestamp: yesterday, action: 'v2', lines: 5, size: 50 }
        ])

        render(<VersionHistoryPanel {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('Today')).toBeInTheDocument()
            expect(screen.getByText('Yesterday')).toBeInTheDocument()
        })

        // Expand yesterday
        fireEvent.click(screen.getByText('Yesterday'))
        expect(screen.getByText('v2')).toBeInTheDocument()
    })

    it('handles restore action', async () => {
        const now = Date.now()
        const version = { timestamp: now, action: 'save', lines: 10, size: 100 }
        invoke.mockResolvedValue([version])

        render(<VersionHistoryPanel {...defaultProps} />)

        await waitFor(() => screen.getByText('Today'))

        // Click restore button
        const restoreBtn = screen.getByText('Restore')
        fireEvent.click(restoreBtn)

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('restore_version', {
                workspacePath: '/test/workspace',
                filePath: '/test/file.md',
                timestamp: now
            })
        })

        expect(defaultProps.onRestore).toHaveBeenCalled()
    })

    it('handles view diff action', async () => {
        const now = Date.now()
        const version = { timestamp: now, action: 'save', lines: 10, size: 100 }
        invoke.mockResolvedValue([version])

        render(<VersionHistoryPanel {...defaultProps} />)

        await waitFor(() => screen.getByText('Today'))

        const viewBtn = screen.getByText('View')
        fireEvent.click(viewBtn)

        expect(defaultProps.onSelectVersion).toHaveBeenCalledWith(version)
    })
})
