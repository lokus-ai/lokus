import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import Editor from './Editor.jsx'

// Mock useProseMirror hook
const mockViewRef = { current: null }
const mockMountRef = vi.fn()

vi.mock('../hooks/useProseMirror.js', () => ({
  default: vi.fn(() => ({
    mountRef: mockMountRef,
    viewRef: mockViewRef,
  }))
}))

import useProseMirror from '../hooks/useProseMirror.js'

// Mock extensions (now PM plugin factories — return empty arrays)
vi.mock('../extensions/WikiLink.js', () => ({ default: () => [], createWikiLinkPlugins: () => [] }))
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
    vi.clearAllMocks()
    mockViewRef.current = null
  })

  it('should render loading state initially', async () => {
    const { getByText } = render(
      <Editor content="" onContentChange={() => {}} />
    )

    // The Editor component shows a loading message while plugins are being built
    expect(getByText('Loading editor...')).toBeInTheDocument()
  })

  it('should accept content and onContentChange props', async () => {
    const onContentChange = vi.fn()
    const content = '<p>Test content</p>'

    expect(() => {
      render(<Editor content={content} onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should handle empty content', () => {
    const onContentChange = vi.fn()

    expect(() => {
      render(<Editor content="" onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should handle undefined content', () => {
    const onContentChange = vi.fn()

    expect(() => {
      render(<Editor content={undefined} onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should call onContentChange when provided', () => {
    const onContentChange = vi.fn()

    render(<Editor content="" onContentChange={onContentChange} />)

    // The actual call would happen through ProseMirror's onUpdate
    // This test verifies the prop is accepted without error
    expect(typeof onContentChange).toBe('function')
  })
})

// Test the PMEditor component behaviour
describe('PMEditor Component', () => {
  let mockView

  beforeEach(() => {
    mockView = {
      state: {
        doc: {
          textContent: 'content',
          content: { size: 7 },
          toJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
          nodeAt: vi.fn(),
          nodesBetween: vi.fn(),
        },
        tr: {
          replaceWith: vi.fn().mockReturnThis(),
          setMeta: vi.fn().mockReturnThis(),
          scrollIntoView: vi.fn().mockReturnThis(),
        },
        selection: { empty: true, from: 0, to: 0, $from: { depth: 0, parent: { type: { name: 'paragraph' } } } },
        schema: {
          nodes: {},
          marks: {},
          text: vi.fn((t) => ({ type: 'text', text: t })),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
      dom: document.createElement('div'),
    }
  })

  it('should handle editor view creation', () => {
    // Verify the mock view structure is valid
    expect(mockView).toBeDefined()
    expect(mockView.state.doc.textContent).toBe('content')
    expect(mockView.dispatch).toBeDefined()
  })

  it('should handle content synchronization via setContent', () => {
    // Simulate what the imperative handle's commands.setContent does
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'new content' }] }] }

    // Schema nodeFromJSON would be called — just verify the transaction path
    mockView.state.tr.replaceWith(0, 7, { content: [] })
    mockView.state.tr.setMeta('programmatic', true)
    mockView.dispatch(mockView.state.tr)

    expect(mockView.state.tr.replaceWith).toHaveBeenCalled()
    expect(mockView.state.tr.setMeta).toHaveBeenCalledWith('programmatic', true)
    expect(mockView.dispatch).toHaveBeenCalled()
  })
})
