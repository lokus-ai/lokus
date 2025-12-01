import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import ConnectionStatus from './ConnectionStatus'
import { gmailAuth, gmailQueue } from '../services/gmail.js'

// Mock services
vi.mock('../services/gmail.js', () => ({
    gmailAuth: {
        isAuthenticated: vi.fn()
    },
    gmailQueue: {
        getQueueStats: vi.fn()
    }
}))

describe('ConnectionStatus Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows checking state initially', () => {
        // Return a promise that doesn't resolve immediately to keep it in checking state
        gmailAuth.isAuthenticated.mockReturnValue(new Promise(() => { }))

        render(<ConnectionStatus />)
        expect(screen.getByText('Gmail')).toBeInTheDocument()
    })

    it('shows connected state when authenticated', async () => {
        gmailAuth.isAuthenticated.mockResolvedValue(true)
        gmailQueue.getQueueStats.mockResolvedValue({ pending: 0, failed: 0 })

        render(<ConnectionStatus />)

        await waitFor(() => {
            const gmailText = screen.getByText('Gmail')
            expect(gmailText).toHaveClass('text-app-success')
        })
    })

    it('shows disconnected state when not authenticated', async () => {
        gmailAuth.isAuthenticated.mockResolvedValue(false)

        render(<ConnectionStatus />)

        await waitFor(() => {
            const gmailText = screen.getByText('Gmail')
            expect(gmailText).toHaveClass('text-app-text-secondary')
        })
    })

    it('shows error state when check fails', async () => {
        gmailAuth.isAuthenticated.mockRejectedValue(new Error('Network error'))

        render(<ConnectionStatus />)

        await waitFor(() => {
            expect(screen.getByTitle('Network error')).toBeInTheDocument()
        })
    })

    it('displays queue stats when connected', async () => {
        gmailAuth.isAuthenticated.mockResolvedValue(true)
        gmailQueue.getQueueStats.mockResolvedValue({ pending: 5, failed: 2 })

        render(<ConnectionStatus />)

        await waitFor(() => {
            expect(screen.getByText('(5 pending, 2 failed)')).toBeInTheDocument()
        })
    })

    it('checks status periodically', async () => {
        vi.useFakeTimers()
        gmailAuth.isAuthenticated.mockResolvedValue(true)
        gmailQueue.getQueueStats.mockResolvedValue({ pending: 0, failed: 0 })

        render(<ConnectionStatus />)

        expect(gmailAuth.isAuthenticated).toHaveBeenCalledTimes(1)

        // Fast forward 30 seconds
        act(() => {
            vi.advanceTimersByTime(31000)
        })

        expect(gmailAuth.isAuthenticated).toHaveBeenCalledTimes(2)
    })
})
