import { useState, useEffect, useCallback } from 'react'
import { readConfig, updateConfig } from '../core/config/store.js'

const HISTORY_KEY = 'commandPaletteHistory'
const MAX_HISTORY_ITEMS = 20

export function useCommandHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Load history from config on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const config = await readConfig()
        const savedHistory = config[HISTORY_KEY] || []
        setHistory(savedHistory)
      } catch (error) {
        setHistory([])
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  // Save history to config
  const saveHistory = useCallback(async (newHistory) => {
    try {
      await updateConfig({ [HISTORY_KEY]: newHistory })
    } catch { }
  }, [])

  // Add item to history
  const addToHistory = useCallback(async (item) => {
    const timestamp = Date.now()
    const historyItem = {
      ...item,
      timestamp,
      id: `${item.type}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
    }

    setHistory(prevHistory => {
      // Remove duplicate entries (same type and data)
      const filteredHistory = prevHistory.filter(h => {
        if (h.type !== item.type) return true
        if (item.type === 'file') {
          return h.data.path !== item.data.path
        }
        return h.data.command !== item.data.command
      })

      // Add new item at the beginning and limit to MAX_HISTORY_ITEMS
      const newHistory = [historyItem, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS)

      // Save to config asynchronously
      saveHistory(newHistory)

      return newHistory
    })
  }, [saveHistory])

  // Remove specific item from history
  const removeFromHistory = useCallback(async (itemId) => {
    setHistory(prevHistory => {
      const newHistory = prevHistory.filter(item => item.id !== itemId)
      saveHistory(newHistory)
      return newHistory
    })
  }, [saveHistory])

  // Clear all history
  const clearHistory = useCallback(async () => {
    setHistory([])
    await saveHistory([])
  }, [saveHistory])

  // Get formatted history items for display
  const getFormattedHistory = useCallback(() => {
    return history.map(item => ({
      ...item,
      relativeTime: formatRelativeTime(item.timestamp),
      displayName: getDisplayName(item)
    }))
  }, [history])

  return {
    history,
    formattedHistory: getFormattedHistory(),
    loading,
    addToHistory,
    removeFromHistory,
    clearHistory
  }
}

// Helper function to format relative time
function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (diff < 60000) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

// Helper function to get display name for history item
function getDisplayName(item) {
  switch (item.type) {
    case 'file':
      return item.data.name
    case 'command':
      return item.data.command
    default:
      return 'Unknown'
  }
}

// Helper function to create file history item
export function createFileHistoryItem(file) {
  return {
    type: 'file',
    data: {
      name: file.name,
      path: file.path,
      fullPath: file.fullPath || file.path
    }
  }
}

// Helper function to create command history item
export function createCommandHistoryItem(commandName, commandData = {}) {
  return {
    type: 'command',
    data: {
      command: commandName,
      ...commandData
    }
  }
}