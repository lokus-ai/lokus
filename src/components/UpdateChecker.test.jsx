import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

const SNOOZE_STORAGE_KEY = 'lokus_update_snoozed';

describe('UpdateChecker Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
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

    it('shows default expandedContent when body is empty', async () => {
        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            body: '',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    expandedContent: 'This update includes bug fixes and improvements.',
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

describe('UpdateChecker Snooze Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    it('snoozes update for 24 hours when Later is clicked', async () => {
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

        // Check localStorage was set
        const snoozed = JSON.parse(localStorage.getItem(SNOOZE_STORAGE_KEY))
        expect(snoozed.version).toBe('2.0.0')
        expect(new Date(snoozed.until)).toBeInstanceOf(Date)

        // Snooze should be ~24 hours in the future
        const snoozedUntil = new Date(snoozed.until)
        const expectedMinTime = Date.now() + (23 * 60 * 60 * 1000) // At least 23 hours
        expect(snoozedUntil.getTime()).toBeGreaterThan(expectedMinTime)
    })

    it('does not show toast when update is snoozed', async () => {
        // Set snooze for version 2.0.0
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify({
            version: '2.0.0',
            until: futureDate.toISOString()
        }))

        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(check).toHaveBeenCalled()
        })

        // Should NOT show toast because it's snoozed
        expect(showEnhancedToast).not.toHaveBeenCalled()
    })

    it('shows toast when snooze has expired', async () => {
        // Set expired snooze
        const pastDate = new Date(Date.now() - 1000)
        localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify({
            version: '2.0.0',
            until: pastDate.toISOString()
        }))

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
    })

    it('shows toast for different version even if another version is snoozed', async () => {
        // Set snooze for version 2.0.0
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify({
            version: '2.0.0',
            until: futureDate.toISOString()
        }))

        // But update is 3.0.0
        check.mockResolvedValue({
            available: true,
            version: '3.0.0',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Update Available: v3.0.0',
                })
            )
        })
    })

    it('clears snooze when user clicks Update Now', async () => {
        // Set snooze
        localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify({
            version: '1.0.0',
            until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }))

        const mockDownloadAndInstall = vi.fn(() => Promise.resolve())

        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: mockDownloadAndInstall
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalled()
        })

        // Simulate clicking "Update Now"
        const toastCall = showEnhancedToast.mock.calls[0][0]
        await toastCall.action.onClick()

        // Snooze should be cleared
        expect(localStorage.getItem(SNOOZE_STORAGE_KEY)).toBeNull()
    })

    it('handles invalid snooze data gracefully', async () => {
        // Set invalid JSON
        localStorage.setItem(SNOOZE_STORAGE_KEY, 'invalid-json')

        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            // Should still show toast despite invalid snooze data
            expect(showEnhancedToast).toHaveBeenCalled()
        })
    })

    it('handles missing snooze.until gracefully', async () => {
        // Set snooze without 'until' field
        localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify({
            version: '2.0.0'
        }))

        check.mockResolvedValue({
            available: true,
            version: '2.0.0',
            downloadAndInstall: vi.fn()
        })

        render(<UpdateChecker />)
        window.dispatchEvent(new Event('check-for-update'))

        await waitFor(() => {
            // Should show toast because snooze is invalid
            expect(showEnhancedToast).toHaveBeenCalled()
        })
    })
})

describe('UpdateChecker Download Progress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('shows progress percentage during download', async () => {
        const mockDownloadAndInstall = vi.fn((callback) => {
            callback({ event: 'Started' })
            callback({ event: 'Progress', data: { chunkLength: 25, contentLength: 100 } })
            callback({ event: 'Progress', data: { chunkLength: 50, contentLength: 100 } })
            callback({ event: 'Progress', data: { chunkLength: 75, contentLength: 100 } })
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

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalled()
        })

        const toastCall = showEnhancedToast.mock.calls[0][0]
        await toastCall.action.onClick()

        await waitFor(() => {
            // Should have been called with various progress percentages
            expect(toast.loading).toHaveBeenCalledWith(
                'Downloading update...',
                expect.objectContaining({ description: '0% complete' })
            )
        })
    })

    it('shows installing message after download finishes', async () => {
        const mockDownloadAndInstall = vi.fn((callback) => {
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

        await waitFor(() => {
            expect(showEnhancedToast).toHaveBeenCalled()
        })

        const toastCall = showEnhancedToast.mock.calls[0][0]
        await toastCall.action.onClick()

        await waitFor(() => {
            expect(toast.loading).toHaveBeenCalledWith(
                'Installing update...',
                expect.objectContaining({ description: 'Preparing to restart...' })
            )
        })
    })
})
