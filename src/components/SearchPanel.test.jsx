import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchPanel from './SearchPanel.jsx'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Get the mocked invoke function
import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  X: () => <div data-testid="x-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
  MoreVertical: () => <div data-testid="more-vertical-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  FolderOpen: () => <div data-testid="folder-open-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Settings: () => <div data-testid="settings-icon" />
}))

// Mock search utilities
vi.mock('../core/search/index.js', () => ({
  debounce: (fn, delay) => fn, // Remove debounce for testing
  highlightText: (text, query) => text.replace(new RegExp(query, 'gi'), `<mark>${query}</mark>`)
}))

describe('SearchPanel', () => {
  let mockProps
  let user

  beforeEach(() => {
    user = userEvent.setup()
    
    mockProps = {
      isOpen: true,
      onClose: vi.fn(),
      onFileOpen: vi.fn(),
      workspacePath: '/test/workspace',
      fileTree: [
        { name: 'test.md', path: '/test/workspace/test.md', is_directory: false },
        { name: 'docs', path: '/test/workspace/docs', is_directory: true }
      ]
    }

    // Reset mocks
    mockInvoke.mockReset()
    localStorage.clear()
  })

  it('should not render when closed', () => {
    render(<SearchPanel {...mockProps} isOpen={false} />)
    
    expect(screen.queryByText('Search Files')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(<SearchPanel {...mockProps} />)
    
    expect(screen.getByText('Search Files')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search in files...')).toBeInTheDocument()
  })

  it('should auto-focus search input when opened', () => {
    render(<SearchPanel {...mockProps} />)
    
    expect(screen.getByPlaceholderText('Search in files...')).toHaveFocus()
  })

  it('should close when close button clicked', async () => {
    render(<SearchPanel {...mockProps} />)
    
    const closeButton = screen.getByTitle('Close search')
    await user.click(closeButton)
    
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  it('should show search filters when filter button clicked', async () => {
    render(<SearchPanel {...mockProps} />)
    
    const filterButton = screen.getByTitle('Search filters')
    await user.click(filterButton)
    
    expect(screen.getByText('Case sensitive')).toBeInTheDocument()
    expect(screen.getByText('Whole word')).toBeInTheDocument()
    expect(screen.getByText('Regular expression')).toBeInTheDocument()
  })

  it('should perform search when typing', async () => {
    const mockResults = [
      {
        file: '/test/workspace/test.md',
        fileName: 'test.md',
        matches: [
          {
            line: 1,
            column: 0,
            text: 'Hello world',
            match: 'Hello',
            context: [
              { lineNumber: 1, text: 'Hello world', isMatch: true }
            ]
          }
        ],
        matchCount: 1
      }
    ]

    mockInvoke.mockResolvedValue(mockResults)
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'Hello')
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('search_in_files', {
        query: 'Hello',
        workspacePath: '/test/workspace',
        options: {
          caseSensitive: false,
          wholeWord: false,
          regex: false,
          fileTypes: ['md', 'txt'],
          maxResults: 100,
          contextLines: 2
        }
      })
    })

    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument()
      expect(screen.getByText('1 matches in 1 files')).toBeInTheDocument()
    })
  })

  it('should show no results message when no matches found', async () => {
    mockInvoke.mockResolvedValue([])
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'nonexistent')
    
    await waitFor(() => {
      expect(screen.getByText('No results found for "nonexistent"')).toBeInTheDocument()
    })
  })

  it('should show loading indicator while searching', async () => {
    mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)))
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'test')
    
    expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument()
  })

  it('should handle Tauri search failure with client fallback', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri search failed'))
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'test')
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled()
    })
    // Should fall back to client-side search
  })

  it('should toggle search options', async () => {
    render(<SearchPanel {...mockProps} />)
    
    const filterButton = screen.getByTitle('Search filters')
    await user.click(filterButton)
    
    const caseSensitiveCheckbox = screen.getByLabelText('Case sensitive')
    await user.click(caseSensitiveCheckbox)
    
    expect(caseSensitiveCheckbox).toBeChecked()
  })

  it('should save and load search history', async () => {
    // Pre-populate localStorage with search history
    const searchHistory = ['previous search', 'another search']
    localStorage.setItem('lokus-search-history', JSON.stringify(searchHistory))
    
    render(<SearchPanel {...mockProps} />)
    
    expect(screen.getByText('Recent Searches')).toBeInTheDocument()
    expect(screen.getByText('previous search')).toBeInTheDocument()
    expect(screen.getByText('another search')).toBeInTheDocument()
  })

  it('should use search history when clicked', async () => {
    const searchHistory = ['previous search']
    localStorage.setItem('lokus-search-history', JSON.stringify(searchHistory))
    
    render(<SearchPanel {...mockProps} />)
    
    const historyItem = screen.getByText('previous search')
    await user.click(historyItem)
    
    expect(screen.getByDisplayValue('previous search')).toBeInTheDocument()
  })

  it('should open file when result clicked', async () => {
    const mockResults = [
      {
        file: '/test/workspace/test.md',
        fileName: 'test.md',
        matches: [
          {
            line: 5,
            column: 10,
            text: 'Hello world',
            match: 'Hello',
            context: []
          }
        ],
        matchCount: 1
      }
    ]

    mockInvoke.mockResolvedValue(mockResults)
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'Hello')
    
    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument()
    })

    const resultButton = screen.getByText('Hello world')
    await user.click(resultButton)
    
    expect(mockProps.onFileOpen).toHaveBeenCalledWith({
      path: '/test/workspace/test.md',
      name: 'test.md',
      lineNumber: 5,
      column: 10
    })
  })

  it('should toggle file collapse state', async () => {
    const mockResults = [
      {
        file: '/test/workspace/test.md',
        fileName: 'test.md',
        matches: [
          {
            line: 1,
            column: 0,
            text: 'Hello world',
            match: 'Hello',
            context: []
          }
        ],
        matchCount: 1
      }
    ]

    mockInvoke.mockResolvedValue(mockResults)
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'Hello')
    
    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument()
    })

    // Should show chevron down (expanded) by default
    expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument()
    
    const collapseButton = screen.getByTitle('Collapse matches')
    await user.click(collapseButton)
    
    // Should now show chevron right (collapsed)
    expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument()
    
    // Match content should be hidden when collapsed
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument()
  })

  it('should handle keyboard navigation', async () => {
    const mockResults = [
      {
        file: '/test/workspace/test.md',
        fileName: 'test.md',
        matches: [
          { line: 1, column: 0, text: 'Hello world', match: 'Hello', context: [] },
          { line: 2, column: 0, text: 'Hello again', match: 'Hello', context: [] }
        ],
        matchCount: 2
      }
    ]

    mockInvoke.mockResolvedValue(mockResults)
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'Hello')
    
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })

    // Arrow key navigation
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    
    expect(mockProps.onFileOpen).toHaveBeenCalled()
  })

  it('should clear results when search is closed', () => {
    const { rerender } = render(<SearchPanel {...mockProps} />)
    
    // Close the panel
    rerender(<SearchPanel {...mockProps} isOpen={false} />)
    
    // Should clear the search state
  })

  it('should highlight search terms in results', async () => {
    const mockResults = [
      {
        file: '/test/workspace/test.md',
        fileName: 'test.md',
        matches: [
          {
            line: 1,
            column: 0,
            text: 'Hello world',
            match: 'Hello',
            context: []
          }
        ],
        matchCount: 1
      }
    ]

    mockInvoke.mockResolvedValue(mockResults)
    
    render(<SearchPanel {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search in files...')
    await user.type(searchInput, 'Hello')
    
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })

    // Should have highlighted text
    const resultElement = screen.getByText('Hello world')
    expect(resultElement.innerHTML).toContain('<mark>Hello</mark>')
  })
})