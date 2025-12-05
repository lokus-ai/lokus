import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import UpdateChecker from './features/UpdateChecker'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-updater', () => ({
    check: vi.fn()
}))

vi.mock('@tauri-apps/plugin-process', () => ({
    relaunch: vi.fn()
}))

describe('UpdateChecker Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render when no update is available', async () => {
        check.mockResolvedValue({ available: false })

        // Trigger check via event
        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(check).toHaveBeenCalled()
        })

        expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    it('shows modal when update is available', async () => {
        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(screen.getByText('Update Available')).toBeInTheDocument()
            expect(screen.getByText('Version 2.0.0 is now available')).toBeInTheDocument()
        })
    })

    it('handles download and install flow', async () => {
        const mockDownloadAndInstall = vi.fn((callback) => {
            // Simulate progress
            callback({ event: 'Started' })
            callback({ event: 'Progress', data: { chunkLength: 50, contentLength: 100 } })
            callback({ event: 'Finished' })
            return Promise.resolve()
        })

        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: mockDownloadAndInstall
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => screen.getByText('Update Now'))

        fireEvent.click(screen.getByText('Update Now'))

        await waitFor(() => {
            expect(screen.getByText('Downloading Update...')).toBeInTheDocument()
        })

        await waitFor(() => {
            expect(relaunch).toHaveBeenCalled()
        })
    })

    it('handles update check errors gracefully', async () => {
        check.mockRejectedValue(new Error('Network error'))

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        // Should verify it doesn't crash or show modal
        await waitFor(() => {
            expect(check).toHaveBeenCalled()
        })

        expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })
})
