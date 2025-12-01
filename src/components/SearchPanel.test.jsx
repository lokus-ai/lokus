import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchPanel from './SearchPanel'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('SearchPanel Component', () => {
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
  })

  it('renders correctly when open', () => {
    render(<SearchPanel {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search in files...')).toBeInTheDocument()
  })

  it('debounces search queries', async () => {
    vi.useFakeTimers()
    render(<SearchPanel isOpen={true} onClose={vi.fn()} workspacePath="/test/path" />)

    const input = screen.getByPlaceholderText('Search in files...')
    fireEvent.change(input, { target: { value: 'query' } })

    // Should not search immediately
    expect(invoke).not.toHaveBeenCalled()

    // Fast forward time
    vi.advanceTimersByTime(500)

    // Should have searched
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('search_in_files', expect.objectContaining({
      query: 'query'
    }))

    vi.useRealTimers()
  })

  it('performs search on input change', async () => {
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

    // Wait for debounce
    await sleep(600)

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('search_in_files', expect.objectContaining({
        query: 'query',
        workspacePath: '/test/workspace'
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('file.md')).toBeInTheDocument()
    })
  })

  it('handles file opening', async () => {
    invoke.mockResolvedValue([
      {
        file: '/test/file.md',
        fileName: 'file.md',
        matchCount: 1,
        matches: [{ line: 10, column: 5, text: 'match', context: [] }]
      }
    ])

    render(<SearchPanel {...defaultProps} />)

    // Trigger search
    const input = screen.getByPlaceholderText('Search in files...')
    fireEvent.change(input, { target: { value: 'query' } })
    await sleep(600)
    await waitFor(() => screen.getByText('file.md'))

    // Click match
    const match = await screen.findByText(/Line 10:5/)
    fireEvent.click(match)

    expect(defaultProps.onFileOpen).toHaveBeenCalledWith({
      path: '/test/file.md',
      name: 'file.md',
      lineNumber: 10,
      column: 5
    })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('navigates results with keyboard', async () => {
    invoke.mockResolvedValue([
      {
        file: '/test/file1.md',
        fileName: 'file1.md',
        matchCount: 1,
        matches: [{ line: 1, column: 0, text: 'match1', context: [] }]
      },
      {
        file: '/test/file2.md',
        fileName: 'file2.md',
        matchCount: 1,
        matches: [{ line: 2, column: 0, text: 'match2', context: [] }]
      }
    ])

    render(<SearchPanel {...defaultProps} />)

    const input = screen.getByPlaceholderText('Search in files...')
    fireEvent.change(input, { target: { value: 'query' } })
    await sleep(600)
    await waitFor(() => screen.getByText('file1.md'))

    // Arrow Down to select first result
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // Arrow Down to select second result
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // Enter to open
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(defaultProps.onFileOpen).toHaveBeenCalledWith(expect.objectContaining({
      path: '/test/file2.md'
    }))
  })
  it('toggles regex search', async () => {
    render(<SearchPanel {...defaultProps} />)

    // Open filters
    const settingsBtn = screen.getByTitle('Search filters')
    fireEvent.click(settingsBtn)

    // Toggle Regex
    const regexCheckbox = screen.getByLabelText('Regular expression')
    fireEvent.click(regexCheckbox)

    const input = screen.getByPlaceholderText('Search in files...')
    fireEvent.change(input, { target: { value: 'query' } })

    await sleep(600)

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('search_in_files', expect.objectContaining({
        options: expect.objectContaining({
          regex: true
        })
      }))
    })
  })

  it('toggles case sensitivity', async () => {
    render(<SearchPanel {...defaultProps} />)

    // Open filters
    const settingsBtn = screen.getByTitle('Search filters')
    fireEvent.click(settingsBtn)

    // Toggle Case Sensitive
    const caseCheckbox = screen.getByLabelText('Case sensitive')
    fireEvent.click(caseCheckbox)

    const input = screen.getByPlaceholderText('Search in files...')
    fireEvent.change(input, { target: { value: 'query' } })

    await sleep(600)

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('search_in_files', expect.objectContaining({
        options: expect.objectContaining({
          caseSensitive: true
        })
      }))
    })
  })
})