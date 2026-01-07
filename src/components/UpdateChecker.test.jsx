import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import UpdateChecker from './UpdateChecker'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { toast } from 'sonner'
import { showEnhancedToast } from './ui/enhanced-toast'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-updater', () => ({
    check: vi.fn()
}))

vi.mock('@tauri-apps/plugin-process', () => ({
    relaunch: vi.fn()
}))

// Mock sonner and enhanced-toast
vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        loading: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        dismiss: vi.fn(),
    }),
}))

vi.mock('./ui/enhanced-toast', () => ({
    showEnhancedToast: vi.fn(),
}))

describe('UpdateChecker Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not show toast when no update is available', async () => {
        check.mockResolvedValue({ available: false })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(check).toHaveBeenCalled()
        })

        expect(showEnhancedToast).not.toHaveBeenCalled()
    })

    it('shows enhanced toast when update is available', async () => {
        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            body: 'New features and bug fixes',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'update-available',
                    title: 'Update Available: v2.0.0',
                    message: 'A new version of Lokus is ready to install',
                    variant: 'update',
                    expandedContent: 'New features and bug fixes',
                    persistent: true,
                })
            )
        })
    })

    it('shows loading toast during download', async () => {
        const mockDownloadAndInstall = vi.fn((callback) => {
            callback({ event: 'Started' })
            callback({ event: 'Progress', data: { chunkLength: 50, contentLength: 100 } })
            callback({ event: 'Finished' })
            return Promise.resolve()
        })

        const updateData = {
            available: true,
            version: '2.0.0',
            downloadAndInstall: mockDownloadAndInstall
        }

        check.mockResolvedValue(updateData)

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalled()
        })

        // Simulate clicking "Update Now" by calling the action onClick
        const toastCall = showEnhancedToast.mock.calls[0][0]
        await toastCall.action.onClick()

        await waitFor(() => {
            expect(toast.loading).toHaveBeenCalledWith(
                'Downloading update...',
                expect.objectContaining({ id: 'update-download' })
            )
        })

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith(
                'Update installed!',
                expect.objectContaining({ id: 'update-download' })
            )
        })
    })

    it('handles update check errors gracefully', async () => {
        check.mockRejectedValue(new Error('Network error'))

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(check).toHaveBeenCalled()
        })

        // Should show error toast for non-"Could not fetch" errors
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                'Update Check Failed',
                expect.objectContaining({ description: 'Network error' })
            )
        })
    })

    it('suppresses "Could not fetch" errors silently', async () => {
        check.mockRejectedValue(new Error('Could not fetch latest version'))

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(check).toHaveBeenCalled()
        })

        // Should NOT show error toast for "Could not fetch" errors
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('handles download errors and shows error toast', async () => {
        const mockDownloadAndInstall = vi.fn().mockRejectedValue(new Error('Download failed'))

        const updateData = {
            available: true,
            version: '2.0.0',
            downloadAndInstall: mockDownloadAndInstall
        }

        check.mockResolvedValue(updateData)

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalled()
        })

        // Simulate clicking "Update Now"
        const toastCall = showEnhancedToast.mock.calls[0][0]
        await toastCall.action.onClick()

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                'Update Failed',
                expect.objectContaining({
                    id: 'update-download',
                    description: 'Download failed'
                })
            )
        })
    })

    it('dismisses update toast when Later is clicked', async () => {
        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalled()
        })

        // Simulate clicking "Later"
        const toastCall = showEnhancedToast.mock.calls[0][0]
        toastCall.cancel.onClick()

        expect(toast.dismiss).toHaveBeenCalledWith('update-available')
    })
})
