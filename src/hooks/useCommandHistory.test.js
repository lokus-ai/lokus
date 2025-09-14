import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCommandHistory, createFileHistoryItem, createCommandHistoryItem } from './useCommandHistory.js'

// Mock the config store
vi.mock('../core/config/store.js', () => ({
  readConfig: vi.fn(),
  updateConfig: vi.fn()
}))

describe('useCommandHistory', () => {
  let mockReadConfig
  let mockUpdateConfig

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Get the mocked functions
    const configStore = await import('../core/config/store.js')
    mockReadConfig = vi.mocked(configStore.readConfig)
    mockUpdateConfig = vi.mocked(configStore.updateConfig)
    
    // Default mock implementations
    mockReadConfig.mockResolvedValue({})
    mockUpdateConfig.mockResolvedValue()
    // Mock Date.now for consistent timestamps
    vi.spyOn(Date, 'now').mockReturnValue(1234567890000)
    // Mock Math.random for consistent IDs
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty history', async () => {
      const { result } = renderHook(() => useCommandHistory())
      
      expect(result.current.loading).toBe(true)
      expect(result.current.history).toEqual([])
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(mockReadConfig).toHaveBeenCalledTimes(1)
    })

    it('should load existing history from config store', async () => {
      const existingHistory = [
        {
          id: 'file-123-abc',
          type: 'file',
          data: { name: 'test.md', path: '/test.md' },
          timestamp: 1234567890000
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.history).toEqual(existingHistory)
    })

    it('should handle config load errors gracefully', async () => {
      mockReadConfig.mockRejectedValue(new Error('Config load failed'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.history).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CommandHistory] Failed to load history:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('addToHistory', () => {
    it('should add file item to history', async () => {
      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const fileItem = createFileHistoryItem({
        name: 'test.md',
        path: '/test.md',
        fullPath: '/project/test.md'
      })

      await act(async () => {
        await result.current.addToHistory(fileItem)
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0]).toMatchObject({
        type: 'file',
        data: {
          name: 'test.md',
          path: '/test.md',
          fullPath: '/project/test.md'
        },
        timestamp: 1234567890000,
        id: expect.stringMatching(/^file-\d+-[a-z0-9]+$/)
      })
      
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        commandPaletteHistory: expect.arrayContaining([
          expect.objectContaining({ type: 'file' })
        ])
      })
    })

    it('should add command item to history', async () => {
      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const commandItem = createCommandHistoryItem('New File', { test: true })

      await act(async () => {
        await result.current.addToHistory(commandItem)
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0]).toMatchObject({
        type: 'command',
        data: {
          command: 'New File',
          test: true
        },
        timestamp: 1234567890000,
        id: expect.stringMatching(/^command-\d+-[a-z0-9]+$/)
      })
    })

    it('should remove duplicates when adding existing file', async () => {
      const existingHistory = [
        {
          id: 'file-111-old',
          type: 'file',
          data: { name: 'test.md', path: '/test.md' },
          timestamp: 1234567880000
        },
        {
          id: 'command-222-old',
          type: 'command',
          data: { command: 'Save File' },
          timestamp: 1234567885000
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const fileItem = createFileHistoryItem({
        name: 'test.md',
        path: '/test.md'
      })

      await act(async () => {
        await result.current.addToHistory(fileItem)
      })

      expect(result.current.history).toHaveLength(2)
      expect(result.current.history[0].data.path).toBe('/test.md')
      expect(result.current.history[0].timestamp).toBe(1234567890000) // New timestamp
      expect(result.current.history[1].data.command).toBe('Save File') // Command preserved
    })

    it('should remove duplicates when adding existing command', async () => {
      const existingHistory = [
        {
          id: 'command-111-old',
          type: 'command',
          data: { command: 'Save File' },
          timestamp: 1234567880000
        },
        {
          id: 'file-222-old',
          type: 'file',
          data: { name: 'other.md', path: '/other.md' },
          timestamp: 1234567885000
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const commandItem = createCommandHistoryItem('Save File')

      await act(async () => {
        await result.current.addToHistory(commandItem)
      })

      expect(result.current.history).toHaveLength(2)
      expect(result.current.history[0].data.command).toBe('Save File')
      expect(result.current.history[0].timestamp).toBe(1234567890000) // New timestamp
      expect(result.current.history[1].data.path).toBe('/other.md') // File preserved
    })

    it('should limit history to 20 items', async () => {
      const existingHistory = Array.from({ length: 19 }, (_, i) => ({
        id: `file-${i}-old`,
        type: 'file',
        data: { name: `file${i}.md`, path: `/file${i}.md` },
        timestamp: 1234567880000 + i
      }))
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const newFileItem = createFileHistoryItem({
        name: 'new.md',
        path: '/new.md'
      })

      await act(async () => {
        await result.current.addToHistory(newFileItem)
      })

      expect(result.current.history).toHaveLength(20)
      expect(result.current.history[0].data.name).toBe('new.md') // New item at front
      expect(result.current.history[19].data.name).toBe('file18.md') // Last old item
    })

    it('should handle config save errors gracefully', async () => {
      mockUpdateConfig.mockRejectedValue(new Error('Save failed'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const fileItem = createFileHistoryItem({
        name: 'test.md',
        path: '/test.md'
      })

      await act(async () => {
        await result.current.addToHistory(fileItem)
      })

      // History should still be updated in memory
      expect(result.current.history).toHaveLength(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CommandHistory] Failed to save history:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('removeFromHistory', () => {
    it('should remove specific item from history', async () => {
      const existingHistory = [
        {
          id: 'file-111-old',
          type: 'file',
          data: { name: 'test.md', path: '/test.md' },
          timestamp: 1234567880000
        },
        {
          id: 'command-222-old',
          type: 'command',
          data: { command: 'Save File' },
          timestamp: 1234567885000
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.removeFromHistory('file-111-old')
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].id).toBe('command-222-old')
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        commandPaletteHistory: expect.arrayContaining([
          expect.objectContaining({ id: 'command-222-old' })
        ])
      })
    })

    it('should handle removal of non-existent item gracefully', async () => {
      const existingHistory = [
        {
          id: 'file-111-old',
          type: 'file',
          data: { name: 'test.md', path: '/test.md' },
          timestamp: 1234567880000
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.removeFromHistory('non-existent-id')
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].id).toBe('file-111-old')
    })
  })

  describe('clearHistory', () => {
    it('should clear all history items', async () => {
      const existingHistory = [
        {
          id: 'file-111-old',
          type: 'file',
          data: { name: 'test.md', path: '/test.md' },
          timestamp: 1234567880000
        },
        {
          id: 'command-222-old',
          type: 'command',
          data: { command: 'Save File' },
          timestamp: 1234567885000
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.clearHistory()
      })

      expect(result.current.history).toHaveLength(0)
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        commandPaletteHistory: []
      })
    })
  })

  describe('formattedHistory', () => {
    it('should provide formatted history with display names and relative times', async () => {
      const existingHistory = [
        {
          id: 'file-111-old',
          type: 'file',
          data: { name: 'test.md', path: '/test.md' },
          timestamp: 1234567890000 - 60000 // 1 minute ago
        },
        {
          id: 'command-222-old',
          type: 'command',
          data: { command: 'Save File' },
          timestamp: 1234567890000 - 3600000 // 1 hour ago
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.formattedHistory).toHaveLength(2)
      expect(result.current.formattedHistory[0]).toMatchObject({
        id: 'file-111-old',
        displayName: 'test.md',
        relativeTime: '1m ago'
      })
      expect(result.current.formattedHistory[1]).toMatchObject({
        id: 'command-222-old',
        displayName: 'Save File',
        relativeTime: '1h ago'
      })
    })
  })

  describe('Time Formatting', () => {
    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(1234567890000)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should format relative time correctly', async () => {
      const testCases = [
        { diff: 30000, expected: 'Just now' }, // 30 seconds
        { diff: 60000, expected: '1m ago' }, // 1 minute
        { diff: 3600000, expected: '1h ago' }, // 1 hour
        { diff: 86400000, expected: 'Yesterday' }, // 1 day
        { diff: 172800000, expected: '2d ago' }, // 2 days
      ]

      for (const { diff, expected } of testCases) {
        const existingHistory = [
          {
            id: 'test-item',
            type: 'file',
            data: { name: 'test.md', path: '/test.md' },
            timestamp: 1234567890000 - diff
          }
        ]
        
        mockReadConfig.mockResolvedValue({
          commandPaletteHistory: existingHistory
        })

        const { result } = renderHook(() => useCommandHistory())
        
        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })

        expect(result.current.formattedHistory[0].relativeTime).toBe(expected)
      }
    })

    it('should format old dates as locale date string', async () => {
      const existingHistory = [
        {
          id: 'old-item',
          type: 'file',
          data: { name: 'old.md', path: '/old.md' },
          timestamp: 1234567890000 - (7 * 86400000) // 7 days ago
        }
      ]
      
      mockReadConfig.mockResolvedValue({
        commandPaletteHistory: existingHistory
      })

      const { result } = renderHook(() => useCommandHistory())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should be a formatted date string for items older than 7 days
      expect(result.current.formattedHistory[0].relativeTime).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })
  })
})

describe('Helper Functions', () => {
  describe('createFileHistoryItem', () => {
    it('should create file history item with required fields', () => {
      const file = {
        name: 'test.md',
        path: '/test.md',
        fullPath: '/project/test.md'
      }

      const result = createFileHistoryItem(file)

      expect(result).toEqual({
        type: 'file',
        data: {
          name: 'test.md',
          path: '/test.md',
          fullPath: '/project/test.md'
        }
      })
    })

    it('should use path as fallback for fullPath', () => {
      const file = {
        name: 'test.md',
        path: '/test.md'
      }

      const result = createFileHistoryItem(file)

      expect(result.data.fullPath).toBe('/test.md')
    })
  })

  describe('createCommandHistoryItem', () => {
    it('should create command history item with command name only', () => {
      const result = createCommandHistoryItem('New File')

      expect(result).toEqual({
        type: 'command',
        data: {
          command: 'New File'
        }
      })
    })

    it('should create command history item with additional data', () => {
      const result = createCommandHistoryItem('Save File', { fileName: 'test.md' })

      expect(result).toEqual({
        type: 'command',
        data: {
          command: 'Save File',
          fileName: 'test.md'
        }
      })
    })
  })
})