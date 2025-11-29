import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBar from './StatusBar'

// Mock useStatusBar hook
const mockLeftItems = []
const mockRightItems = []

vi.mock('../hooks/useStatusBar', () => ({
    useStatusBar: () => ({
        leftItems: mockLeftItems,
        rightItems: mockRightItems
    })
}))

// Mock SyncStatus component
vi.mock('./Auth/SyncStatus.jsx', () => ({
    default: () => <div data-testid="sync-status">Sync</div>
}))

describe('StatusBar Component', () => {
    const defaultProps = {
        activeFile: '/path/to/file.md',
        unsavedChanges: new Set(),
        openTabs: ['file1.md', 'file2.md'],
        editor: null
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render core items', () => {
        render(<StatusBar {...defaultProps} />)

        expect(screen.getByText('Ready')).toBeInTheDocument()
        expect(screen.getByText('Markdown')).toBeInTheDocument()
        expect(screen.getByText('Settings')).toBeInTheDocument()
        expect(screen.getByTestId('sync-status')).toBeInTheDocument()
    })

    it('should display active file name', () => {
        render(<StatusBar {...defaultProps} />)
        expect(screen.getByText('file.md')).toBeInTheDocument()
    })

    it('should display open tabs count', () => {
        render(<StatusBar {...defaultProps} />)
        expect(screen.getByText('2 files')).toBeInTheDocument()
    })

    it('should display unsaved changes count', () => {
        const props = {
            ...defaultProps,
            unsavedChanges: new Set(['/path/to/file.md'])
        }
        render(<StatusBar {...props} />)
        expect(screen.getByText('1 unsaved')).toBeInTheDocument()
    })

    it('should display editor stats', () => {
        // Mock editor state
        const mockEditor = {
            state: {
                doc: {
                    content: {
                        content: [
                            {
                                content: {
                                    content: [
                                        { text: 'Hello world' }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        }

        render(<StatusBar {...defaultProps} editor={mockEditor} />)

        // "Hello world" -> 2 words, 11 chars
        // Note: The component formats numbers with toLocaleString()
        expect(screen.getByText(/Words: 2/)).toBeInTheDocument()
        expect(screen.getByText(/Chars: 11/)).toBeInTheDocument()
        expect(screen.getByText(/~1 min/)).toBeInTheDocument()
    })
})
