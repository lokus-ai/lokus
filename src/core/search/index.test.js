import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  debounce, 
  highlightText, 
  createSearchDecorations,
  searchCommands,
  searchPluginKey 
} from './index.js'
import { DecorationSet } from '@tiptap/pm/view'

// Mock ProseMirror
vi.mock('@tiptap/pm/view', () => ({
  Decoration: {
    inline: vi.fn((from, to, attrs) => ({ from, to, attrs, type: 'inline' }))
  },
  DecorationSet: {
    empty: { type: 'empty' },
    create: vi.fn((doc, decorations) => ({ doc, decorations, type: 'set' }))
  }
}))

vi.mock('@tiptap/pm/state', () => ({
  Plugin: vi.fn(),
  PluginKey: vi.fn(() => ({ 
    getState: vi.fn(),
    toString: () => 'search'
  }))
}))

describe('Search Utilities', () => {
  describe('debounce', () => {
    it('should delay function execution', async () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)
      
      debouncedFn('test')
      expect(fn).not.toHaveBeenCalled()
      
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(fn).toHaveBeenCalledWith('test')
    })

    it('should cancel previous calls', async () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)
      
      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')
      
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('third')
    })
  })

  describe('highlightText', () => {
    it('should highlight matching text with default options', () => {
      const text = 'Hello world'
      const searchTerm = 'world'
      const result = highlightText(text, searchTerm)
      
      expect(result).toBe('Hello <mark class="search-highlight">world</mark>')
    })

    it('should handle case insensitive search by default', () => {
      const text = 'Hello WORLD'
      const searchTerm = 'world'
      const result = highlightText(text, searchTerm)
      
      expect(result).toBe('Hello <mark class="search-highlight">WORLD</mark>')
    })

    it('should handle case sensitive search', () => {
      const text = 'Hello WORLD'
      const searchTerm = 'world'
      const result = highlightText(text, searchTerm, { caseSensitive: true })
      
      expect(result).toBe('Hello WORLD') // No match
    })

    it('should handle whole word search', () => {
      const text = 'Hello world wonderful'
      const searchTerm = 'world'
      const result = highlightText(text, searchTerm, { wholeWord: true })
      
      expect(result).toBe('Hello <mark class="search-highlight">world</mark> wonderful')
    })

    it('should handle regex search', () => {
      const text = 'test123 and test456'
      const searchTerm = 'test\\d+'
      const result = highlightText(text, searchTerm, { regex: true })
      
      expect(result).toBe('<mark class="search-highlight">test123</mark> and <mark class="search-highlight">test456</mark>')
    })

    it('should return original text if no search term', () => {
      const text = 'Hello world'
      const result = highlightText(text, '')
      
      expect(result).toBe('Hello world')
    })

    it('should handle invalid regex gracefully', () => {
      const text = 'Hello world'
      const searchTerm = '[invalid'
      const result = highlightText(text, searchTerm, { regex: true })
      
      expect(result).toBe('Hello world')
    })
  })

  describe('createSearchDecorations', () => {
    let mockDoc

    beforeEach(() => {
      mockDoc = {
        textContent: 'Hello world, this is a test world',
        descendants: vi.fn((callback) => {
          // Mock text node traversal
          callback({ isText: true, text: 'Hello world, this is a test world' }, 1)
        })
      }
    })

    it('should create decorations for matches', () => {
      const result = createSearchDecorations(mockDoc, 'world')
      
      expect(DecorationSet.create).toHaveBeenCalledWith(mockDoc, expect.any(Array))
    })

    it('should return empty set for empty search term', () => {
      const result = createSearchDecorations(mockDoc, '')
      
      expect(result).toBe(DecorationSet.empty)
    })

    it('should handle case sensitive search', () => {
      const result = createSearchDecorations(mockDoc, 'WORLD', { caseSensitive: true })
      
      expect(DecorationSet.create).toHaveBeenCalledWith(mockDoc, [])
    })

    it('should mark current match differently', () => {
      createSearchDecorations(mockDoc, 'world', { currentMatchIndex: 1 })
      
      expect(DecorationSet.create).toHaveBeenCalled()
    })
  })

  describe('searchCommands', () => {
    let mockState, mockTr, mockDispatch

    beforeEach(() => {
      mockTr = {
        setMeta: vi.fn().mockReturnThis()
      }
      mockState = {
        tr: mockTr
      }
      mockDispatch = vi.fn()
    })

    it('should set search term', () => {
      const result = searchCommands.setSearchTerm('test')({
        tr: mockTr,
        dispatch: mockDispatch
      })

      expect(mockTr.setMeta).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should clear search', () => {
      const result = searchCommands.clearSearch()({
        tr: mockTr,
        dispatch: mockDispatch
      })

      expect(mockTr.setMeta).toHaveBeenCalledWith(expect.anything(), {
        searchTerm: '',
        matches: [],
        currentMatch: 0
      })
      expect(result).toBe(true)
    })

    it('should navigate to next match', () => {
      const mockSearchState = {
        matches: [1, 2, 3],
        currentMatch: 0
      }
      
      vi.mocked(searchPluginKey.getState).mockReturnValue(mockSearchState)
      
      const result = searchCommands.nextMatch()({
        state: { ...mockState },
        tr: mockTr,
        dispatch: mockDispatch
      })

      expect(result).toBe(true)
    })

    it('should navigate to previous match', () => {
      const mockSearchState = {
        matches: [1, 2, 3],
        currentMatch: 2
      }
      
      vi.mocked(searchPluginKey.getState).mockReturnValue(mockSearchState)
      
      const result = searchCommands.previousMatch()({
        state: { ...mockState },
        tr: mockTr,
        dispatch: mockDispatch
      })

      expect(result).toBe(true)
    })
  })
})