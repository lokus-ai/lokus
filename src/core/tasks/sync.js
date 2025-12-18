/**
 * Task-Editor Synchronization System
 * Handles two-way sync between kanban tasks and editor content
 */

import { taskManager } from './manager.js'
import { extractActionableTasks } from './parser.js'

/**
 * Two-way task synchronization manager
 */
export class TaskSyncManager {
  constructor() {
    this.syncCallbacks = new Map() // filePath -> callback
    this.lastSyncTimes = new Map() // filePath -> timestamp
    this.syncInProgress = new Set() // prevent concurrent syncs
  }

  /**
   * Register a callback for editor changes
   */
  onEditorChange(filePath, callback) {
    this.syncCallbacks.set(filePath, callback)
    return () => this.syncCallbacks.delete(filePath)
  }

  /**
   * Sync tasks from editor content to kanban
   * Called when editor content changes
   */
  async syncFromEditor(filePath, content) {
    if (this.syncInProgress.has(filePath)) {
      return // Prevent recursive syncs
    }

    try {
      this.syncInProgress.add(filePath)

      // Extract tasks from content
      const extractedTasks = extractActionableTasks(content, filePath, {
        excludeCompleted: false,
        includeSimple: true
      })

      // Get existing tasks for this file
      const existingTasks = await taskManager.getTasksByNote(filePath)

      // Sync logic
      const syncResult = await this.performSync(filePath, extractedTasks, existingTasks, content)

      // Update last sync time
      this.lastSyncTimes.set(filePath, Date.now())

      return syncResult
    } catch (error) {
      throw error
    } finally {
      this.syncInProgress.delete(filePath)
    }
  }

  /**
   * Sync tasks from kanban to editor content
   * Called when tasks are modified in kanban
   */
  async syncToEditor(filePath, updatedTask) {
    if (this.syncInProgress.has(filePath)) {
      return // Prevent recursive syncs
    }

    const callback = this.syncCallbacks.get(filePath)
    if (!callback) {
      return // No editor callback registered
    }

    try {
      this.syncInProgress.add(filePath)

      // Get current editor content
      const currentContent = await callback.getCurrentContent()
      
      // Update the specific task in content
      const updatedContent = this.updateTaskInContent(currentContent, updatedTask)
      
      if (updatedContent !== currentContent) {
        // Apply changes to editor
        await callback.updateContent(updatedContent)
      }

    } catch (error) {
      throw error
    } finally {
      this.syncInProgress.delete(filePath)
    }
  }

  /**
   * Perform the actual synchronization logic
   */
  async performSync(filePath, extractedTasks, existingTasks, content) {
    const result = {
      created: [],
      updated: [],
      deleted: [],
      unchanged: []
    }

    // Create a map of existing tasks by position and title for matching
    const existingMap = new Map()
    existingTasks.forEach(task => {
      const key = `${task.note_position}-${task.title}`
      existingMap.set(key, task)
    })

    // Process extracted tasks
    for (const extracted of extractedTasks) {
      const key = `${extracted.note_position}-${extracted.title}`
      const existing = existingMap.get(key)

      if (existing) {
        // Check if task status has changed in content
        if (existing.status !== extracted.status) {
          const updated = await taskManager.updateTask(existing.id, {
            status: extracted.status
          })
          result.updated.push(updated)
        } else {
          result.unchanged.push(existing)
        }
        existingMap.delete(key) // Mark as processed
      } else {
        // Create new task
        const created = await taskManager.createTask(extracted.title, {
          description: extracted.metadata?.original_title || null,
          notePath: filePath,
          notePosition: extracted.note_position,
          status: extracted.status
        })
        result.created.push(created)
      }
    }

    // Handle tasks that exist in DB but not in content
    const orphanedTasks = Array.from(existingMap.values())
    for (const orphaned of orphanedTasks) {
      // Check if the task still exists somewhere in the content
      // (maybe moved to a different line)
      const stillExists = this.findTaskInContent(content, orphaned.title)
      
      if (!stillExists) {
        // Task was deleted from content
        await taskManager.deleteTask(orphaned.id)
        result.deleted.push(orphaned)
      }
    }

    return result
  }

  /**
   * Find a task by title in content (fuzzy search)
   */
  findTaskInContent(content, taskTitle) {
    const lines = content.split('\n')
    const normalizedTitle = taskTitle.toLowerCase().trim()
    
    return lines.some(line => {
      const normalizedLine = line.toLowerCase().trim()
      return normalizedLine.includes(normalizedTitle) ||
             this.calculateSimilarity(normalizedLine, normalizedTitle) > 0.8
    })
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * Update a specific task in content
   */
  updateTaskInContent(content, task) {
    if (!task.note_position) {
      return content // Can't update without position
    }

    const lines = content.split('\n')
    const lineIndex = task.note_position - 1 // Convert to 0-based

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return content // Invalid position
    }

    const currentLine = lines[lineIndex]
    const updatedLine = this.updateTaskLine(currentLine, task)
    
    if (updatedLine !== currentLine) {
      lines[lineIndex] = updatedLine
      return lines.join('\n')
    }

    return content
  }

  /**
   * Update a task line with new status
   */
  updateTaskLine(line, task) {
    // Update checkbox status
    const checkboxMatch = line.match(/^(\s*-\s*\[)([x X/!?\->]|\s)(\]\s*.+)$/)
    if (checkboxMatch) {
      const [, prefix, , suffix] = checkboxMatch
      const newSymbol = this.getStatusSymbol(task.status)
      return `${prefix}${newSymbol}${suffix}`
    }

    // For non-checkbox tasks, we might need more sophisticated updating
    // For now, return unchanged
    return line
  }

  /**
   * Get status symbol for checkbox
   */
  getStatusSymbol(status) {
    const symbolMap = {
      'todo': ' ',
      'completed': 'x',
      'in-progress': '/',
      'urgent': '!',
      'question': '?',
      'cancelled': '-',
      'delegated': '>'
    }
    return symbolMap[status] || ' '
  }

  /**
   * Auto-sync all open files
   */
  async syncAllFiles() {
    const syncPromises = []
    
    for (const [filePath, callback] of this.syncCallbacks.entries()) {
      try {
        const content = await callback.getCurrentContent()
        syncPromises.push(this.syncFromEditor(filePath, content))
      } catch { }
    }

    return Promise.allSettled(syncPromises)
  }

  /**
   * Get sync status for a file
   */
  getSyncStatus(filePath) {
    return {
      isRegistered: this.syncCallbacks.has(filePath),
      lastSyncTime: this.lastSyncTimes.get(filePath),
      isSyncing: this.syncInProgress.has(filePath)
    }
  }

  /**
   * Clear sync data for a file (when file is closed)
   */
  clearFileSync(filePath) {
    this.syncCallbacks.delete(filePath)
    this.lastSyncTimes.delete(filePath)
    this.syncInProgress.delete(filePath)
  }

  /**
   * Bulk sync optimization
   * Groups multiple changes and syncs them together
   */
  async batchSync(changes) {
    const fileGroups = new Map()
    
    // Group changes by file
    changes.forEach(change => {
      if (!fileGroups.has(change.filePath)) {
        fileGroups.set(change.filePath, [])
      }
      fileGroups.get(change.filePath).push(change)
    })

    const results = []
    
    // Process each file's changes
    for (const [filePath, fileChanges] of fileGroups.entries()) {
      try {
        const result = await this.processBatchForFile(filePath, fileChanges)
        results.push({ filePath, result })
      } catch (error) {
        results.push({ filePath, error })
      }
    }

    return results
  }

  /**
   * Process batch changes for a single file
   */
  async processBatchForFile(filePath, changes) {
    const callback = this.syncCallbacks.get(filePath)
    if (!callback) {
      return { skipped: true, reason: 'No callback registered' }
    }

    try {
      let content = await callback.getCurrentContent()
      let hasChanges = false

      // Apply all changes to content
      for (const change of changes) {
        if (change.type === 'task_updated') {
          const newContent = this.updateTaskInContent(content, change.task)
          if (newContent !== content) {
            content = newContent
            hasChanges = true
          }
        }
      }

      // Apply changes if any
      if (hasChanges) {
        await callback.updateContent(content)
      }

      return { 
        applied: hasChanges, 
        changeCount: changes.length,
        filePath 
      }
    } catch (error) {
      throw error
    }
  }
}

// Create singleton instance
export const taskSyncManager = new TaskSyncManager()

// Setup task manager listener for kanban changes
taskManager.addListener((event) => {
  if (event.type === 'task_updated' && event.task.note_path) {
    taskSyncManager.syncToEditor(event.task.note_path, event.task)
  }
})

export default taskSyncManager