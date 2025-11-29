import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import EditorContextMenu from './EditorContextMenu.jsx'

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
  Scissors: () => <div data-testid="scissors-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  Clipboard: () => <div data-testid="clipboard-icon" />,
  MousePointer: () => <div data-testid="mouse-pointer-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  RotateCw: () => <div data-testid="rotate-cw-icon" />,
  Search: () => <div data-testid="search-icon" />,
  SearchX: () => <div data-testid="search-x-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Upload: () => <div data-testid="upload-icon" />,
  Type: () => <div data-testid="type-icon" />,
  Table: () => <div data-testid="table-icon" />,
  Code: () => <div data-testid="code-icon" />,
  Link: () => <div data-testid="link-icon" />,
  Image: () => <div data-testid="image-icon" />,
  Terminal: () => <div data-testid="terminal-icon" />,
  Bold: () => <div data-testid="bold-icon" />,
  Italic: () => <div data-testid="italic-icon" />,
  Strikethrough: () => <div data-testid="strikethrough-icon" />,
  MousePointer2: () => <div data-testid="mouse-pointer-2-icon" />,
  AlignLeft: () => <div data-testid="align-left-icon" />,
  AlignCenter: () => <div data-testid="align-center-icon" />,
  AlignRight: () => <div data-testid="align-right-icon" />,
  List: () => <div data-testid="list-icon" />,
  ListOrdered: () => <div data-testid="list-ordered-icon" />,
  CheckSquare: () => <div data-testid="check-square-icon" />,
  Quote: () => <div data-testid="quote-icon" />,
  Heading: () => <div data-testid="heading-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  BookOpen: () => <div data-testid="book-open-icon" />,
  FileCode: () => <div data-testid="file-code-icon" />,
  Braces: () => <div data-testid="braces-icon" />,
  SeparatorHorizontal: () => <div data-testid="separator-horizontal-icon" />
}))

describe('EditorContextMenu', () => {
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render context menu trigger', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    expect(getByText('Editor Content')).toBeInTheDocument()
  })

  it('should show basic edit options', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} hasSelection={true} canUndo={true} canRedo={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    expect(getByText('Cut')).toBeInTheDocument()
    expect(getByText('Copy')).toBeInTheDocument()
    expect(getByText('Paste')).toBeInTheDocument()
    expect(getByText('Select All')).toBeInTheDocument()
  })

  it('should show undo/redo options', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} canUndo={true} canRedo={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    expect(getByText('Undo')).toBeInTheDocument()
    expect(getByText('Redo')).toBeInTheDocument()
  })

  it('should disable cut and copy when no selection', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} hasSelection={false}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    const cutButton = getByText('Cut')
    const copyButton = getByText('Copy')

    // Check if the elements have the disabled attribute (value might be empty string or "true")
    expect(cutButton.closest('[data-disabled]')).toHaveAttribute('data-disabled')
    expect(copyButton.closest('[data-disabled]')).toHaveAttribute('data-disabled')
  })

  it('should disable undo when canUndo is false', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} canUndo={false} canRedo={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    const undoButton = getByText('Undo')
    expect(undoButton.closest('[data-disabled]')).toHaveAttribute('data-disabled')
  })

  it('should show search options', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    expect(getByText('Find')).toBeInTheDocument()
    expect(getByText('Replace')).toBeInTheDocument()
  })

  it('should show commands submenu', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    expect(getByText('Insert')).toBeInTheDocument()
  })

  it('should show export options', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    expect(getByText('Export as Markdown')).toBeInTheDocument()
    expect(getByText('Export as HTML')).toBeInTheDocument()
    expect(getByText('Import File...')).toBeInTheDocument()
  })

  it('should call onAction when menu item is clicked', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} hasSelection={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    // Click on "Cut" option
    fireEvent.click(getByText('Cut'))

    expect(mockOnAction).toHaveBeenCalledWith('cut', {})
  })

  it('should call onAction with correct parameters for different actions', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} canUndo={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    // Test undo action
    fireEvent.click(getByText('Undo'))
    expect(mockOnAction).toHaveBeenCalledWith('undo', {})

    // Test find action
    fireEvent.click(getByText('Find'))
    expect(mockOnAction).toHaveBeenCalledWith('find', {})

    // Test select all action
    fireEvent.click(getByText('Select All'))
    expect(mockOnAction).toHaveBeenCalledWith('selectAll', {})
  })

  it('should handle missing onAction prop gracefully', () => {
    const { getByText } = render(
      <EditorContextMenu hasSelection={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    // Click should not throw error
    expect(() => {
      fireEvent.click(getByText('Cut'))
    }).not.toThrow()
  })

  it('should display keyboard shortcuts', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction} hasSelection={true}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    // Check for keyboard shortcut indicators
    const cutOption = getByText('Cut')
    expect(cutOption.parentElement).toHaveTextContent('⌘X')

    const copyOption = getByText('Copy')
    expect(copyOption.parentElement).toHaveTextContent('⌘C')

    const pasteOption = getByText('Paste')
    expect(pasteOption.parentElement).toHaveTextContent('⌘V')

    const findOption = getByText('Find')
    expect(findOption.parentElement).toHaveTextContent('⌘F')
  })

  it('should work with default props', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    // Should render without errors
    expect(getByText('Cut')).toBeInTheDocument()
    expect(getByText('Copy')).toBeInTheDocument()
    expect(getByText('Paste')).toBeInTheDocument()
  })

  it('should handle commands submenu actions', () => {
    const { getByText } = render(
      <EditorContextMenu onAction={mockOnAction}>
        <div>Editor Content</div>
      </EditorContextMenu>
    )

    // Right-click to open context menu
    fireEvent.contextMenu(getByText('Editor Content'))

    // Hover over Commands to open submenu
    const commandsMenu = getByText('Insert')
    fireEvent.mouseEnter(commandsMenu)

    // Check if submenu items exist (they should be rendered)
    expect(getByText('Command Palette')).toBeInTheDocument()
    expect(getByText('Table')).toBeInTheDocument()
    expect(getByText('Code Block')).toBeInTheDocument()
    expect(getByText('Link')).toBeInTheDocument()
    expect(getByText('Image')).toBeInTheDocument()
  })
})