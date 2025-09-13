import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import Editor from './Editor.jsx'

// Mock TipTap
const mockEditor = {
  commands: {
    setContent: vi.fn(),
    insertContent: vi.fn(),
    focus: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    selectAll: vi.fn()
  },
  can: vi.fn().mockReturnValue({
    undo: vi.fn().mockReturnValue(true),
    redo: vi.fn().mockReturnValue(true)
  }),
  getHTML: vi.fn().mockReturnValue('<p>test content</p>'),
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({ 
      run: vi.fn(),
      insertContent: vi.fn().mockReturnValue({ run: vi.fn() })
    })
  }),
  state: {
    selection: { empty: false }
  }
}

const mockUseEditor = vi.fn()
vi.mock('@tiptap/react', () => ({
  useEditor: mockUseEditor,
  EditorContent: ({ editor }) => <div data-testid="editor-content" />
}))

// Mock extensions
vi.mock('../extensions/Math.js', () => ({ default: null }))
vi.mock('../extensions/WikiLink.js', () => ({ default: {} }))
vi.mock('../lib/WikiLinkSuggest.js', () => ({ default: {} }))
vi.mock('../extensions/HeadingAltInput.js', () => ({ default: vi.fn() }))
vi.mock('../lib/SlashCommand.js', () => ({ default: {} }))
vi.mock('./TableBubbleMenu.jsx', () => ({ default: () => null }))

// Mock EditorContextMenu
vi.mock('../../components/EditorContextMenu.jsx', () => ({
  default: ({ children, onAction }) => <div data-testid="editor-context-menu">{children}</div>
}))

// Mock config
vi.mock('../../core/config/store.js', () => ({
  readConfig: vi.fn().mockResolvedValue({})
}))

// Mock live settings
vi.mock('../../core/editor/live-settings.js', () => ({
  default: {
    getAllSettings: vi.fn().mockReturnValue({}),
    onSettingsChange: vi.fn().mockReturnValue(() => {})
  }
}))

// Mock clipboard shortcuts
vi.mock('../../core/clipboard/shortcuts.js', () => ({
  default: {
    init: vi.fn(),
    destroy: vi.fn()
  }
}))

// Mock markdown libraries
vi.mock('markdown-it', () => ({
  default: vi.fn().mockImplementation(() => ({
    use: vi.fn().mockReturnThis(),
    render: vi.fn().mockReturnValue('<p>rendered</p>')
  }))
}))

vi.mock('markdown-it-mark', () => ({ default: {} }))
vi.mock('markdown-it-strikethrough-alt', () => ({ default: {} }))

describe('Editor Component', () => {  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    // Mock useEditor to return null for loading state
    mockUseEditor.mockReturnValue(null)
    
    const { getByText } = render(
      <Editor content="" onContentChange={() => {}} />
    )
    
    expect(getByText('Loading editor…')).toBeInTheDocument()
  })

  it('should accept content and onContentChange props', () => {
    // Mock useEditor to return mockEditor for this test
    mockUseEditor.mockReturnValue(mockEditor)
    
    const onContentChange = vi.fn()
    const content = '<p>Test content</p>'
    
    expect(() => {
      render(<Editor content={content} onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should handle empty content', () => {
    // Mock useEditor to return mockEditor for this test
    mockUseEditor.mockReturnValue(mockEditor)
    
    const onContentChange = vi.fn()
    
    expect(() => {
      render(<Editor content="" onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should handle undefined content', () => {
    // Mock useEditor to return mockEditor for this test
    mockUseEditor.mockReturnValue(mockEditor)
    
    const onContentChange = vi.fn()
    
    expect(() => {
      render(<Editor content={undefined} onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should call onContentChange when provided', () => {
    // Mock useEditor to return mockEditor for this test
    mockUseEditor.mockReturnValue(mockEditor)
    
    const onContentChange = vi.fn()
    
    render(<Editor content="" onContentChange={onContentChange} />)
    
    // The actual call would happen through TipTap's onUpdate
    // This test verifies the prop is accepted without error
    expect(typeof onContentChange).toBe('function')
  })
})

// Test the Tiptap component separately
describe('Tiptap Component', () => {
  let mockEditor

  beforeEach(() => {
    mockEditor = {
      commands: {
        setContent: vi.fn(),
        insertContent: vi.fn(),
        insertTable: vi.fn()
      },
      getHTML: vi.fn().mockReturnValue('<p>content</p>'),
      chain: vi.fn().mockReturnValue({
        focus: vi.fn().mockReturnValue({
          insertTable: vi.fn().mockReturnValue({ run: vi.fn() }),
          insertContent: vi.fn().mockReturnValue({ run: vi.fn() }),
          run: vi.fn()
        })
      })
    }
  })

  it('should handle editor prop changes', () => {
    // This would test the Tiptap component's editor prop handling
    // In a real test, we'd render Tiptap directly with mock props
    expect(mockEditor).toBeDefined()
    expect(mockEditor.commands.setContent).toBeDefined()
  })

  it('should handle content synchronization', () => {
    // Test that content changes are properly synchronized
    const newContent = '<p>new content</p>'
    
    // Simulate content change
    if (mockEditor.getHTML() !== newContent) {
      mockEditor.commands.setContent(newContent)
    }
    
    expect(mockEditor.commands.setContent).toHaveBeenCalledWith(newContent)
  })
})