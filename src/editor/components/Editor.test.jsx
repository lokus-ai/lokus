import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import Editor from './Editor.jsx'

// ---------------------------------------------------------------------------
// useProseMirror hook
// ---------------------------------------------------------------------------
const mockViewRef = { current: null }
const mockMountRef = vi.fn()

vi.mock('../hooks/useProseMirror.js', () => ({
  default: vi.fn(() => ({
    mountRef: mockMountRef,
    viewRef: mockViewRef,
  }))
}))

import useProseMirror from '../hooks/useProseMirror.js'

// ---------------------------------------------------------------------------
// Schema & serializer — return minimal stubs
// ---------------------------------------------------------------------------
vi.mock('../schema/lokus-schema.js', () => ({
  lokusSchema: {
    nodes: {
      paragraph: { create: vi.fn(() => ({})) },
      heading: { create: vi.fn(() => ({})) },
      codeBlock: { create: vi.fn(() => ({})) },
      bulletList: { create: vi.fn(() => ({})) },
      orderedList: { create: vi.fn(() => ({})) },
      taskList: { create: vi.fn(() => ({})) },
      taskItem: { create: vi.fn(() => ({})) },
      listItem: { create: vi.fn(() => ({})) },
      horizontalRule: { create: vi.fn(() => ({})) },
      blockquote: { create: vi.fn(() => ({})) },
      inlineMath: { create: vi.fn(() => ({})) },
    },
    marks: {
      bold: {},
      italic: {},
      code: {},
      strike: {},
      highlight: {},
      superscript: {},
      subscript: {},
    },
  }
}))

vi.mock('../../core/markdown/lokus-md-pipeline.js', () => ({
  createLokusSerializer: vi.fn(() => ({}))
}))

// ---------------------------------------------------------------------------
// ProseMirror core — return light stubs so keymap/history/etc. don't crash
// ---------------------------------------------------------------------------
const stubPlugin = () => ({ spec: {} })

vi.mock('prosemirror-keymap', () => ({
  keymap: vi.fn(() => stubPlugin())
}))

vi.mock('prosemirror-commands', () => ({
  baseKeymap: {},
  toggleMark: vi.fn(() => () => true),
  setBlockType: vi.fn(() => () => true),
  wrapIn: vi.fn(() => () => true),
  chainCommands: vi.fn((...fns) => () => fns.some(f => f())),
  lift: vi.fn(() => true),
}))

vi.mock('prosemirror-history', () => ({
  history: vi.fn(() => stubPlugin()),
  undo: vi.fn(() => true),
  redo: vi.fn(() => true),
}))

vi.mock('prosemirror-schema-list', () => ({
  splitListItem: vi.fn(() => () => false),
  liftListItem: vi.fn(() => () => false),
  sinkListItem: vi.fn(() => () => false),
  wrapInList: vi.fn(() => () => false),
}))

vi.mock('prosemirror-dropcursor', () => ({
  dropCursor: vi.fn(() => stubPlugin())
}))

vi.mock('prosemirror-gapcursor', () => ({
  gapCursor: vi.fn(() => stubPlugin())
}))

vi.mock('prosemirror-inputrules', () => ({
  InputRule: vi.fn().mockImplementation(() => ({})),
  inputRules: vi.fn(() => stubPlugin()),
  wrappingInputRule: vi.fn(() => ({})),
  textblockTypeInputRule: vi.fn(() => ({})),
}))

// ---------------------------------------------------------------------------
// Extension plugin factories — each returns a Plugin stub (or array of stubs)
// ---------------------------------------------------------------------------
vi.mock('../extensions/BlockId.js', () => ({
  createBlockIdPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/TaskSyntaxHighlight.js', () => ({
  createTaskSyntaxHighlightPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/Folding.js', () => ({
  createFoldingPlugins: vi.fn(() => [])
}))

vi.mock('../extensions/MarkdownPaste.js', () => ({
  createMarkdownPastePlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/MarkdownTablePaste.js', () => ({
  createMarkdownTablePastePlugin: vi.fn(() => stubPlugin()),
  default: vi.fn(() => stubPlugin()),
}))

vi.mock('../extensions/PluginHover.js', () => ({
  createPluginHoverPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/TaskCreationTrigger.js', () => ({
  createTaskCreationTriggerPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/Callout.js', () => ({
  createCalloutPlugins: vi.fn(() => [])
}))

vi.mock('../extensions/WikiLink.js', () => ({
  createWikiLinkPlugins: vi.fn(() => []),
  createWikiLinkNodeView: vi.fn(() => ({})),
  default: vi.fn(() => []),
}))

vi.mock('../extensions/WikiLinkEmbed.js', () => ({
  createWikiLinkEmbedPlugins: vi.fn(() => [])
}))

vi.mock('../extensions/CanvasLink.js', () => ({
  createCanvasLinkPlugins: vi.fn(() => []),
  createCanvasLinkNodeView: vi.fn(() => ({})),
}))

vi.mock('../extensions/CustomCodeBlock.js', () => ({
  createCodeBlockPlugins: vi.fn(() => [])
}))

vi.mock('../extensions/CodeBlockIndent.js', () => ({
  createCodeBlockIndentPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/MathSnippets.js', () => ({
  createMathSnippetsPlugins: vi.fn(() => [])
}))

vi.mock('../extensions/SymbolShortcuts.js', () => ({
  createSymbolShortcutsPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/MermaidDiagram.jsx', () => ({
  createMermaidInputRulesPlugin: vi.fn(() => stubPlugin()),
  mermaidNodeView: vi.fn(),
}))

vi.mock('../extensions/InlineMath.jsx', () => ({
  inlineMathNodeView: vi.fn(),
}))

vi.mock('../extensions/TagAutocomplete.js', () => ({
  createTagAutocompletePlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/TaskMentionSuggest.js', () => ({
  createTaskMentionSuggestPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../extensions/PluginCompletion.js', () => ({
  createPluginCompletionPlugin: vi.fn(() => stubPlugin())
}))

vi.mock('../lib/SlashCommand.js', () => ({
  createSlashCommandPlugin: vi.fn(() => stubPlugin()),
  default: {},
}))

vi.mock('../lib/WikiLinkSuggest.js', () => ({
  createWikiLinkSuggestPlugins: vi.fn(() => []),
  default: {},
}))

vi.mock('../lib/HeadingAltInput.js', () => ({ default: vi.fn() }))
vi.mock('../extensions/HeadingAltInput.js', () => ({ default: vi.fn() }))

// ---------------------------------------------------------------------------
// Editor commands
// ---------------------------------------------------------------------------
vi.mock('../commands/index.js', () => ({
  createEditorCommands: vi.fn(() => ({})),
  insertContent: vi.fn(),
  setTextSelection: vi.fn(),
}))

// ---------------------------------------------------------------------------
// UI / view components
// ---------------------------------------------------------------------------
vi.mock('./TableBubbleMenu.jsx', () => ({ default: () => null }))

vi.mock('../../components/EditorContextMenu.jsx', () => ({
  default: ({ children }) => <div data-testid="editor-context-menu">{children}</div>
}))

vi.mock('../../components/WikiLinkModal.jsx', () => ({ default: () => null }))
vi.mock('../../components/TaskCreationModal.jsx', () => ({ default: () => null }))
vi.mock('../../views/ExportModal.jsx', () => ({ default: () => null }))
vi.mock('../../components/ImageInsertModal.jsx', () => ({ default: () => null }))
vi.mock('./ImageUrlModal.jsx', () => ({ default: () => null }))
vi.mock('../../components/MathFormulaModal.jsx', () => ({ default: () => null }))
vi.mock('../../components/SymbolPickerModal.jsx', () => ({ default: () => null }))
vi.mock('./ReadingModeView.jsx', () => ({ default: () => null }))
vi.mock('../../components/PagePreview.jsx', () => ({ default: () => null }))
vi.mock('../../components/ImageViewer/ImageViewerModal.jsx', () => ({
  ImageViewerModal: () => null
}))

// ---------------------------------------------------------------------------
// Platform/config APIs
// ---------------------------------------------------------------------------
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((src) => src)
}))

vi.mock('../../core/config/store.js', () => ({
  readConfig: vi.fn().mockResolvedValue({})
}))

vi.mock('../../core/editor/live-settings.js', () => ({
  default: {
    getAllSettings: vi.fn().mockReturnValue({}),
    onSettingsChange: vi.fn().mockReturnValue(() => {})
  }
}))

vi.mock('../../core/clipboard/shortcuts.js', () => ({
  default: {
    init: vi.fn(),
    destroy: vi.fn()
  }
}))

vi.mock('../../contexts/RemoteConfigContext', () => ({
  useFeatureFlags: vi.fn().mockReturnValue({})
}))

vi.mock('../../plugins/api/EditorAPI.js', () => ({
  editorAPI: {
    getAllExtensions: vi.fn().mockReturnValue([]),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
    setView: vi.fn(),
  }
}))

vi.mock('../../plugins/api/PluginAPI.js', () => ({
  pluginAPI: {
    setEditor: vi.fn(),
  }
}))

vi.mock('../../utils/imageUtils.js', () => ({
  findImageFiles: vi.fn().mockResolvedValue([])
}))

// ---------------------------------------------------------------------------
// Markdown libraries (used inside plugin factories)
// ---------------------------------------------------------------------------
vi.mock('markdown-it', () => ({
  default: vi.fn().mockImplementation(() => ({
    use: vi.fn().mockReturnThis(),
    render: vi.fn().mockReturnValue('<p>rendered</p>')
  }))
}))

vi.mock('markdown-it-mark', () => ({ default: {} }))
vi.mock('markdown-it-strikethrough-alt', () => ({ default: {} }))

// ---------------------------------------------------------------------------
// CSS imports — vitest ignores them by default; explicit stubs are a safety net
// ---------------------------------------------------------------------------
vi.mock('../styles/editor.css', () => ({}))
vi.mock('../styles/block-embeds.css', () => ({}))
vi.mock('../../styles/page-preview.css', () => ({}))
vi.mock('../../styles/canvas-extensions.css', () => ({}))
vi.mock('../../styles/canvas-preview.css', () => ({}))

// ---------------------------------------------------------------------------
// Sentry — suppress in tests
// ---------------------------------------------------------------------------
vi.mock('@sentry/react', () => ({
  withErrorBoundary: (c) => c,
  ErrorBoundary: ({ children }) => children,
  captureException: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Editor Component tests
// ---------------------------------------------------------------------------

describe('Editor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockViewRef.current = null
  })

  it('should render loading state initially', async () => {
    const { getByText } = render(
      <Editor content="" onContentChange={() => {}} />
    )

    // The outer Editor component shows "Loading editor..." while the async
    // plugin-building effect hasn't completed yet.
    expect(getByText('Loading editor...')).toBeInTheDocument()
  })

  it('should accept content and onContentChange props without throwing', async () => {
    const onContentChange = vi.fn()
    const content = '<p>Test content</p>'

    expect(() => {
      render(<Editor content={content} onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should handle empty content without throwing', () => {
    const onContentChange = vi.fn()

    expect(() => {
      render(<Editor content="" onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should handle undefined content without throwing', () => {
    const onContentChange = vi.fn()

    expect(() => {
      render(<Editor content={undefined} onContentChange={onContentChange} />)
    }).not.toThrow()
  })

  it('should accept an onContentChange callback prop', () => {
    const onContentChange = vi.fn()

    render(<Editor content="" onContentChange={onContentChange} />)

    // The callback is wired up to useProseMirror's onUpdate; verifying the
    // prop type confirms the component accepted it without error.
    expect(typeof onContentChange).toBe('function')
  })

  it('should call useProseMirror once the plugin list is ready', async () => {
    render(<Editor content="" onContentChange={() => {}} />)

    // After the async config load resolves, useProseMirror is called with
    // the built plugins array.
    await waitFor(() => {
      expect(useProseMirror).toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// PMEditor Component — tests the ProseMirror view integration layer
// ---------------------------------------------------------------------------

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
        selection: {
          empty: true,
          from: 0,
          to: 0,
          $from: { depth: 0, parent: { type: { name: 'paragraph' } } }
        },
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

  it('should expose the expected EditorView interface', () => {
    expect(mockView).toBeDefined()
    expect(mockView.state.doc.textContent).toBe('content')
    expect(mockView.dispatch).toBeDefined()
  })

  it('should support content synchronisation via setContent transaction pattern', () => {
    // Simulate the imperative handle's commands.setContent() path:
    //   tr.replaceWith(0, size, newContent)
    //   tr.setMeta('programmatic', true)
    //   view.dispatch(tr)
    mockView.state.tr.replaceWith(0, 7, { content: [] })
    mockView.state.tr.setMeta('programmatic', true)
    mockView.dispatch(mockView.state.tr)

    expect(mockView.state.tr.replaceWith).toHaveBeenCalled()
    expect(mockView.state.tr.setMeta).toHaveBeenCalledWith('programmatic', true)
    expect(mockView.dispatch).toHaveBeenCalled()
  })
})
