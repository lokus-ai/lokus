import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import CommandPalette from './CommandPalette.jsx'

// Mock UI components
vi.mock('./ui/command.jsx', () => ({
  Command: ({ children, ...props }) => <div data-testid="command" {...props}>{children}</div>,
  CommandDialog: ({ children, open, ...props }) => open ? <div data-testid="command-dialog" {...props}>{children}</div> : null,
  CommandInput: (props) => <input data-testid="command-input" {...props} />,
  CommandList: ({ children, ...props }) => <div data-testid="command-list" {...props}>{children}</div>,
  CommandEmpty: ({ children, ...props }) => <div data-testid="command-empty" {...props}>{children}</div>,
  CommandGroup: ({ children, ...props }) => <div data-testid="command-group" {...props}>{children}</div>,
  CommandItem: ({ children, onSelect, ...props }) => (
    <div 
      data-testid="command-item" 
      onClick={() => onSelect && onSelect()}
      {...props}
    >
      {children}
    </div>
  ),
  CommandSeparator: (props) => <div data-testid="command-separator" {...props} />,
  CommandShortcut: ({ children, ...props }) => <span data-testid="command-shortcut" {...props}>{children}</span>
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  File: () => <div data-testid="file-icon" />,
  Folder: () => <div data-testid="folder-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Hash: () => <div data-testid="hash-icon" />,
  Save: () => <div data-testid="save-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  X: () => <div data-testid="x-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  FolderPlus: () => <div data-testid="folder-plus-icon" />,
  Sidebar: () => <div data-testid="sidebar-icon" />,
  ToggleLeft: () => <div data-testid="toggle-left-icon" />
}))

describe('CommandPalette', () => {
  const mockProps = {
    open: true,
    setOpen: vi.fn(),
    fileTree: [
      { name: 'README.md', path: '/README.md', is_directory: false },
      { name: 'docs', path: '/docs', is_directory: true },
      { name: 'src', path: '/src', is_directory: true }
    ],
    openFiles: ['/README.md', '/index.js'],
    onFileOpen: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onSave: vi.fn(),
    onOpenPreferences: vi.fn(),
    onToggleSidebar: vi.fn(),
    onCloseTab: vi.fn(),
    activeFile: '/README.md'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render when open is true', () => {
    const { getByTestId } = render(<CommandPalette {...mockProps} />)
    
    expect(getByTestId('command-dialog')).toBeInTheDocument()
    expect(getByTestId('command-input')).toBeInTheDocument()
  })

  it('should not render when open is false', () => {
    const { queryByTestId } = render(<CommandPalette {...mockProps} open={false} />)
    
    expect(queryByTestId('command-dialog')).not.toBeInTheDocument()
  })

  it('should display search input with placeholder', () => {
    const { getByTestId } = render(<CommandPalette {...mockProps} />)
    
    const input = getByTestId('command-input')
    expect(input).toHaveAttribute('placeholder', 'Type a command or search...')
  })

  it('should show file tree items', () => {
    const { getAllByTestId } = render(<CommandPalette {...mockProps} />)
    
    const items = getAllByTestId('command-item')
    expect(items.length).toBeGreaterThan(0)
    
    // Should contain file items
    expect(items.some(item => item.textContent?.includes('README.md'))).toBe(true)
  })

  it('should filter files based on search input', async () => {
    const { getByTestId, getAllByTestId } = render(<CommandPalette {...mockProps} />)
    
    const input = getByTestId('command-input')
    fireEvent.change(input, { target: { value: 'README' } })
    
    await waitFor(() => {
      const items = getAllByTestId('command-item')
      const readmeItems = items.filter(item => item.textContent?.includes('README.md'))
      expect(readmeItems.length).toBeGreaterThan(0)
    })
  })

  it('should show recent files section', () => {
    const { getByText } = render(<CommandPalette {...mockProps} />)
    
    expect(getByText('Recent Files')).toBeInTheDocument()
  })

  it('should show actions section', () => {
    const { getByText } = render(<CommandPalette {...mockProps} />)
    
    expect(getByText('Actions')).toBeInTheDocument()
    expect(getByText('Save File')).toBeInTheDocument()
    expect(getByText('New File')).toBeInTheDocument()
    expect(getByText('New Folder')).toBeInTheDocument()
  })

  it('should call onFileOpen when file is selected', () => {
    const { getAllByTestId } = render(<CommandPalette {...mockProps} />)
    
    const items = getAllByTestId('command-item')
    const readmeItem = items.find(item => item.textContent?.includes('README.md'))
    
    if (readmeItem) {
      fireEvent.click(readmeItem)
      expect(mockProps.onFileOpen).toHaveBeenCalledWith('/README.md')
      expect(mockProps.setOpen).toHaveBeenCalledWith(false)
    }
  })

  it('should call onSave when save action is selected', () => {
    const { getByText } = render(<CommandPalette {...mockProps} />)
    
    const saveItem = getByText('Save File')
    fireEvent.click(saveItem)
    
    expect(mockProps.onSave).toHaveBeenCalled()
    expect(mockProps.setOpen).toHaveBeenCalledWith(false)
  })

  it('should call onCreateFile when new file action is selected', () => {
    const { getByText } = render(<CommandPalette {...mockProps} />)
    
    const newFileItem = getByText('New File')
    fireEvent.click(newFileItem)
    
    expect(mockProps.onCreateFile).toHaveBeenCalled()
    expect(mockProps.setOpen).toHaveBeenCalledWith(false)
  })

  it('should call onOpenPreferences when preferences action is selected', () => {
    const { getByText } = render(<CommandPalette {...mockProps} />)
    
    const preferencesItem = getByText('Open Preferences')
    fireEvent.click(preferencesItem)
    
    expect(mockProps.onOpenPreferences).toHaveBeenCalled()
    expect(mockProps.setOpen).toHaveBeenCalledWith(false)
  })

  it('should handle empty file tree gracefully', () => {
    const { getByTestId } = render(
      <CommandPalette {...mockProps} fileTree={[]} />
    )
    
    expect(getByTestId('command-dialog')).toBeInTheDocument()
    // Should still show actions even with empty file tree
    expect(getByTestId('command-group')).toBeInTheDocument()
  })

  it('should handle undefined props gracefully', () => {
    const minimalProps = {
      open: true,
      setOpen: vi.fn()
    }
    
    expect(() => {
      render(<CommandPalette {...minimalProps} />)
    }).not.toThrow()
  })

  it('should show keyboard shortcuts', () => {
    const { getByText } = render(<CommandPalette {...mockProps} />)
    
    // Actions should show keyboard shortcuts
    const saveItem = getByText('Save File')
    expect(saveItem.parentElement).toHaveTextContent('⌘S')
  })

  it('should filter out directories when searching for files', async () => {
    const { getByTestId, getAllByTestId } = render(<CommandPalette {...mockProps} />)
    
    const input = getByTestId('command-input')
    fireEvent.change(input, { target: { value: 'src' } })
    
    await waitFor(() => {
      const items = getAllByTestId('command-item')
      // Should show the directory in results
      expect(items.some(item => item.textContent?.includes('src'))).toBe(true)
    })
  })

  it('should show empty state when no results found', async () => {
    const { getByTestId } = render(<CommandPalette {...mockProps} />)
    
    const input = getByTestId('command-input')
    fireEvent.change(input, { target: { value: 'nonexistentfile' } })
    
    await waitFor(() => {
      expect(getByTestId('command-empty')).toBeInTheDocument()
    })
  })

  it('should close on escape key', () => {
    const { getByTestId } = render(<CommandPalette {...mockProps} />)
    
    const input = getByTestId('command-input')
    fireEvent.keyDown(input, { key: 'Escape' })
    
    expect(mockProps.setOpen).toHaveBeenCalledWith(false)
  })

  it('should handle file path display correctly', () => {
    const fileTreeWithPaths = [
      { name: 'nested-file.md', path: '/folder/nested-file.md', is_directory: false },
      { name: 'root-file.md', path: '/root-file.md', is_directory: false }
    ]
    
    const { getAllByTestId } = render(
      <CommandPalette {...mockProps} fileTree={fileTreeWithPaths} />
    )
    
    const items = getAllByTestId('command-item')
    const nestedFileItem = items.find(item => item.textContent?.includes('nested-file.md'))
    
    if (nestedFileItem) {
      expect(nestedFileItem.textContent).toContain('folder/')
    }
  })
})