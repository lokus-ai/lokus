import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EnhancedSearchPanel from './EnhancedSearchPanel'
import { invoke } from '@tauri-apps/api/core'
import { providerManager } from '../plugins/data/ProviderRegistry.js'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

vi.mock('../plugins/data/ProviderRegistry.js', () => ({
    providerManager: {
        initialize: vi.fn(),
        registry: {
            getProvidersByType: vi.fn(),
            getProvider: vi.fn(),
            getActiveProvider: vi.fn()
        },
        executeSearchOperation: vi.fn()
    }
}))

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('EnhancedSearchPanel Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onFileOpen: vi.fn(),
        workspacePath: '/test/workspace'
    }

    afterEach(() => {
        vi.useRealTimers()
    })

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock provider registry
        providerManager.registry.getProvidersByType.mockReturnValue([])
    })

    it('renders correctly', () => {
        render(<EnhancedSearchPanel {...defaultProps} />)
        expect(screen.getByText('Enhanced Search')).toBeInTheDocument()
    })

    it('initializes providers on mount', () => {
        render(<EnhancedSearchPanel {...defaultProps} />)
        expect(providerManager.initialize).toHaveBeenCalled()
    })

    it('performs local search', async () => {
        invoke.mockResolvedValue([
            {
                file: '/test/local.md',
                fileName: 'local.md',
                matchCount: 1,
                matches: [{ line: 1, column: 0, text: 'local match', context: [] }]
            }
        ])

        render(<EnhancedSearchPanel {...defaultProps} />)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'query' } })

        await sleep(600)

        expect(invoke).toHaveBeenCalledWith('search_in_files', expect.any(Object))
        await waitFor(() => screen.getByText('local.md'))
    })

    it('debounces search queries', async () => {
        vi.useFakeTimers()
        render(<EnhancedSearchPanel isOpen={true} onClose={vi.fn()} workspacePath="/test/path" />)

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'query' } })

        // Should not search immediately
        expect(invoke).not.toHaveBeenCalled()

        // Fast forward time
        vi.advanceTimersByTime(500)

        // Should have searched
        expect(invoke).toHaveBeenCalledTimes(1)

        vi.useRealTimers()
    })

    it('performs provider search', async () => {
        const mockProvider = {
            id: 'test-provider',
            config: { name: 'Test Provider' },
            isConnected: true,
            getCapabilities: () => ['semantic-search']
        }

        providerManager.registry.getProvidersByType.mockReturnValue([mockProvider])
        providerManager.registry.getActiveProvider.mockReturnValue(mockProvider)

        providerManager.executeSearchOperation.mockResolvedValue([
            {
                file: 'external-doc',
                title: 'External Doc',
                matches: [{ text: 'external match' }],
                score: 0.9
            }
        ])

        render(<EnhancedSearchPanel {...defaultProps} />)

        // Wait for provider init
        await waitFor(() => expect(providerManager.registry.getActiveProvider).toHaveBeenCalled())

        const input = screen.getByPlaceholderText('Search in files...')
        fireEvent.change(input, { target: { value: 'query' } })

        await sleep(600)

        expect(providerManager.executeSearchOperation).toHaveBeenCalled()
        await waitFor(() => screen.getByText('External Doc'))
    })

    it('toggles filters', () => {
        render(<EnhancedSearchPanel {...defaultProps} />)

        const filterBtn = screen.getByTitle('Search filters')
        fireEvent.click(filterBtn)

        expect(screen.getByText('Search Options')).toBeInTheDocument()
        expect(screen.getByText('Case sensitive')).toBeInTheDocument()
    })
})
