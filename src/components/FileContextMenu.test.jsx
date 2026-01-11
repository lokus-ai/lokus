import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'
import FileContextMenu from './FileContextMenu.jsx'

// Mock PlatformService
vi.mock('../services/platform/PlatformService', () => ({
  default: {
    isWindows: () => false,
    isMacOS: () => true,
    isLinux: () => false
  },
  isDesktop: () => true,
  isMobile: () => false
}))

// Mock context menu UI components
vi.mock('./ui/context-menu', () => ({
  ContextMenu: ({ children, ...props }) => {
    const { asChild, ...safeProps } = props
    return <div data-testid="context-menu" {...safeProps}>{children}</div>
  },
  ContextMenuTrigger: ({ children, asChild, ...props }) => {
    // Handle asChild prop by rendering children directly if asChild is true
    if (asChild) {
      return React.cloneElement(children, {
        ...props,
        'data-testid': 'context-menu-trigger',
        onContextMenu: (e) => {
          // Simulate context menu opening
          e.preventDefault()
          // Trigger the context menu content to show
        }
      })
    }
    return <div data-testid="context-menu-trigger" {...props}>{children}</div>
  },
  ContextMenuContent: ({ children, ...props }) => {
    const { asChild, ...safeProps } = props
    return <div data-testid="context-menu-content" {...safeProps}>{children}</div>
  },
  ContextMenuItem: ({ children, onClick, disabled, ...props }) => {
    const { asChild, ...safeProps } = props
    return (
      <div
        data-testid="context-menu-item"
        onClick={disabled ? undefined : onClick}
        data-disabled={disabled || undefined}
        {...safeProps}
      >
        {children}
      </div>
    )
  },
  ContextMenuSeparator: (props) => {
    const { asChild, ...safeProps } = props
    return <div data-testid="context-menu-separator" {...safeProps} />
  },
  ContextMenuSub: ({ children, ...props }) => {
    const { asChild, ...safeProps } = props
    return <div data-testid="context-menu-sub" {...safeProps}>{children}</div>
  },
  ContextMenuSubTrigger: ({ children, ...props }) => {
    const { asChild, ...safeProps } = props
    return <div data-testid="context-menu-sub-trigger" {...safeProps}>{children}</div>
  },
  ContextMenuSubContent: ({ children, ...props }) => {
    const { asChild, ...safeProps } = props
    return <div data-testid="context-menu-sub-content" {...safeProps}>{children}</div>
  },
  ContextMenuShortcut: ({ children, ...props }) => {
    const { asChild, ...safeProps } = props
    return <span data-testid="context-menu-shortcut" {...safeProps}>{children}</span>
  }
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  FolderOpen: () => <div data-testid="folder-open-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  Terminal: () => <div data-testid="terminal-icon" />,
  Share2: () => <div data-testid="share-icon" />,
  GitCompare: () => <div data-testid="compare-icon" />,
  Scissors: () => <div data-testid="scissors-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Edit3: () => <div data-testid="edit-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  GitBranch: () => <div data-testid="git-branch-icon" />,
  Clipboard: () => <div data-testid="clipboard-icon" />,
  Files: () => <div data-testid="files-icon" />,
  Star: () => <div data-testid="star-icon" />,
  StarOff: () => <div data-testid="star-off-icon" />,
  Tag: () => <div data-testid="tag-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Archive: () => <div data-testid="archive-icon" />,
  Upload: () => <div data-testid="upload-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  FolderTree: () => <div data-testid="folder-tree-icon" />,
  FilePlus: () => <div data-testid="file-plus-icon" />,
  FolderPlus: () => <div data-testid="folder-plus-icon" />,
  Image: () => <div data-testid="image-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Pencil: () => <div data-testid="pencil-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Link: () => <div data-testid="link-icon" />,
  Search: () => <div data-testid="search-icon" />
}))

describe('FileContextMenu', () => {
  const mockFile = {
    name: 'test.md',
    path: '/test/path/test.md',
    type: 'file'
  }

  const mockFolder = {
    name: 'test-folder',
    path: '/test/path/test-folder',
    type: 'folder'
  }

  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render context menu trigger', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    expect(getByText('Test Child')).toBeInTheDocument()
  })

  it('should show file-specific options for files', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    expect(screen.getAllByText(/Open/)[0]).toBeInTheDocument()
    expect(getByText('Open to the Side')).toBeInTheDocument()
    expect(getByText('Open With...')).toBeInTheDocument()
  })

  it('should not show file-specific options for folders', () => {
    const { getByText, queryByText } = render(
      <FileContextMenu file={mockFolder} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))


    expect(queryByText('Open to the Side')).not.toBeInTheDocument()
  })

  it('should show common options for both files and folders', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    expect(screen.getAllByText(/Reveal in Finder/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Open in Terminal/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Cut/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Copy/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Copy Path/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Rename/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Delete/)[0]).toBeInTheDocument()
  })

  it('should call onAction when menu item is clicked', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    // Click on "Open" option
    fireEvent.click(screen.getAllByText(/Open/)[0])

    expect(mockOnAction).toHaveBeenCalledWith('open', { file: mockFile })
  })

  it('should call onAction with correct parameters for different actions', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    // Test reveal in finder action
    fireEvent.click(screen.getAllByText(/Reveal in Finder/)[0])
    expect(mockOnAction).toHaveBeenCalledWith('revealInFinder', { file: mockFile })

    // Test copy path action
    fireEvent.click(screen.getAllByText(/Copy Path/)[1])
    expect(mockOnAction).toHaveBeenCalledWith('copyPath', { file: mockFile })

    // Test delete action
    fireEvent.click(screen.getAllByText(/Delete/)[0])
    expect(mockOnAction).toHaveBeenCalledWith('delete', { file: mockFile })
  })



  it('should handle missing onAction prop gracefully', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    // Click should not throw error
    expect(() => {
      fireEvent.click(screen.getAllByText(/Open/)[0])
    }).not.toThrow()
  })

  it('should display keyboard shortcuts', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    // Check for keyboard shortcut indicators
    const cutOption = getByText('Cut')
    expect(cutOption.parentElement).toHaveTextContent('⌘X')

    const copyOption = getByText('Copy')
    expect(copyOption.parentElement).toHaveTextContent('⌘C')
  })

  it('should render with different file types', () => {
    const imageFile = { ...mockFile, name: 'image.png', type: 'file' }

    const { getByText } = render(
      <FileContextMenu file={imageFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Test Child'))

    // Should still show file-specific options
    expect(screen.getAllByText(/Open/)[0]).toBeInTheDocument()
    expect(getByText('Open to the Side')).toBeInTheDocument()
  })
  it('should show folder-specific options', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFolder} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    fireEvent.contextMenu(getByText('Test Child'))

    expect(getByText('New File')).toBeInTheDocument()
    expect(getByText('New Folder')).toBeInTheDocument()
  })

  it('should not show folder-specific options for files', () => {
    const { getByText, queryByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    fireEvent.contextMenu(getByText('Test Child'))

    expect(queryByText('New File')).not.toBeInTheDocument()
    expect(queryByText('New Folder')).not.toBeInTheDocument()
  })

  it('should trigger copy relative path action', () => {
    const { getByText } = render(
      <FileContextMenu file={mockFile} onAction={mockOnAction}>
        <div>Test Child</div>
      </FileContextMenu>
    )

    fireEvent.contextMenu(getByText('Test Child'))

    // "Copy Relative Path" might be "Copy Relative Path" or similar
    // We use getAllByText to be safe if there are multiple matches (unlikely for full string)
    // But let's use regex
    const copyRelative = screen.getAllByText(/Copy Relative Path/)[0]
    fireEvent.click(copyRelative)

    expect(mockOnAction).toHaveBeenCalledWith('copyRelativePath', { file: mockFile })
  })
})