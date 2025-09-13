import { describe, it, expect, beforeEach, vi } from 'vitest'
import clipboardShortcuts from './shortcuts.js'

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock clipboard module
vi.mock('./index.js', () => ({
  default: {
    writeHTML: vi.fn().mockResolvedValue(true),
    pasteToEditor: vi.fn().mockResolvedValue(true),
    selectAll: vi.fn().mockResolvedValue(true)
  }
}))

describe('Clipboard Shortcuts', () => {
  let mockEditor

  beforeEach(() => {
    mockEditor = {
      commands: {
        selectAll: vi.fn().mockReturnValue({ run: vi.fn() }),
        focus: vi.fn().mockReturnValue({ run: vi.fn() }),
        deleteSelection: vi.fn(),
        selectTextblockStart: vi.fn(),
        selectTextblockEnd: vi.fn()
      },
      chain: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnValue({ run: vi.fn() }),
        focus: vi.fn().mockReturnValue({ run: vi.fn() })
      }),
      getHTML: vi.fn().mockReturnValue('<p>test content</p>'),
      getText: vi.fn().mockReturnValue('test content'),
      state: {
        selection: {
          from: 0,
          to: 5,
          empty: false
        },
        doc: {
          slice: vi.fn().mockReturnValue({
            textContent: 'test content'
          }),
          resolve: vi.fn().mockReturnValue({
            start: vi.fn().mockReturnValue(0),
            end: vi.fn().mockReturnValue(5),
            depth: 0,
            parent: {
              textContent: 'test content',
              type: { name: 'paragraph' }
            }
          })
        }
      },
      view: {
        dom: {
          focus: vi.fn()
        }
      }
    }
    
    // Reset any previous state
    clipboardShortcuts.destroy()
  })

  it('should initialize without error', () => {
    expect(() => {
      clipboardShortcuts.init(mockEditor)
    }).not.toThrow()
  })

  it('should store editor reference', () => {
    clipboardShortcuts.init(mockEditor)
    expect(clipboardShortcuts.editor).toBe(mockEditor)
  })

  it('should handle copy operation', async () => {
    clipboardShortcuts.init(mockEditor)
    
    const clipboard = await import('./index.js')
    const writeHTMLSpy = vi.spyOn(clipboard.default, 'writeHTML')

    await clipboardShortcuts.handleCopy()
    expect(writeHTMLSpy).toHaveBeenCalledWith(expect.any(String), 'test content')
  })

  it('should handle select all operation', async () => {
    clipboardShortcuts.init(mockEditor)
    
    const clipboard = await import('./index.js')
    const selectAllSpy = vi.spyOn(clipboard.default, 'selectAll')
    
    await clipboardShortcuts.handleSelectAll()
    expect(selectAllSpy).toHaveBeenCalledWith(mockEditor)
  })

  it('should clean up on destroy', () => {
    clipboardShortcuts.init(mockEditor)
    clipboardShortcuts.destroy()
    expect(clipboardShortcuts.editor).toBeNull()
  })

  it('should handle operations when no editor is set', () => {
    expect(() => {
      clipboardShortcuts.handleCopy()
      clipboardShortcuts.handleSelectAll()
    }).not.toThrow()
  })
})