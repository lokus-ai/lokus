import { invoke } from '@tauri-apps/api/core'

/**
 * Task Management System
 * Provides high-level task operations and state management
 */

export class TaskManager {
  constructor() {
    this.listeners = new Set()
    this.cache = new Map()
  }

  /**
   * Add a change listener
   */
  addListener(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
      }
    })
  }

  /**
   * Get all tasks with caching
   */
  async getAllTasks(forceRefresh = false) {
    const cacheKey = 'all_tasks'
    
    if (!forceRefresh && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const tasks = await invoke('get_all_tasks')
      this.cache.set(cacheKey, tasks)
      return tasks
    } catch (error) {
      throw error
    }
  }

  /**
   * Create a new task
   */
  async createTask(title, options = {}) {
    try {
      const task = await invoke('create_task', {
        title,
        description: options.description || null,
        notePath: options.notePath || null,
        notePosition: options.notePosition || null
      })

      // Update status if provided
      if (options.status && options.status !== 'todo') {
        const updatedTask = await this.updateTask(task.id, { status: options.status })
        this.invalidateCache()
        this.notifyListeners({ type: 'task_created', task: updatedTask })
        return updatedTask
      }

      this.invalidateCache()
      this.notifyListeners({ type: 'task_created', task })
      return task
    } catch (error) {
      throw error
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId, updates) {
    try {
      const updatedTask = await invoke('update_task', {
        taskId,
        title: updates.title || null,
        description: updates.description || null,
        status: updates.status || null,
        priority: updates.priority || null
      })

      this.invalidateCache()
      this.notifyListeners({ 
        type: 'task_updated', 
        task: updatedTask, 
        updates 
      })
      return updatedTask
    } catch (error) {
      throw error
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    try {
      await invoke('delete_task', { taskId })
      this.invalidateCache()
      this.notifyListeners({ type: 'task_deleted', taskId })
    } catch (error) {
      throw error
    }
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status) {
    try {
      const tasks = await invoke('get_tasks_by_status', { status })
      return tasks
    } catch (error) {
      throw error
    }
  }

  /**
   * Get tasks from a specific note
   */
  async getTasksByNote(notePath) {
    try {
      const tasks = await invoke('get_tasks_by_note', { notePath })
      return tasks
    } catch (error) {
      throw error
    }
  }

  /**
   * Bulk update task statuses
   */
  async bulkUpdateStatus(taskIds, status) {
    try {
      const updatedTasks = await invoke('bulk_update_task_status', { 
        taskIds, 
        status 
      })
      
      this.invalidateCache()
      this.notifyListeners({ 
        type: 'tasks_bulk_updated', 
        tasks: updatedTasks,
        status 
      })
      return updatedTasks
    } catch (error) {
      throw error
    }
  }

  /**
   * Extract tasks from content
   */
  async extractTasksFromContent(content, notePath) {
    try {
      const extractedTasks = await invoke('extract_tasks_from_content', { 
        content, 
        notePath 
      })
      return extractedTasks
    } catch (error) {
      throw error
    }
  }

  /**
   * Sync tasks with editor content
   */
  async syncWithEditor(editorContent, notePath) {
    try {
      // Extract tasks from current content
      const extractedTasks = await this.extractTasksFromContent(editorContent, notePath)
      
      // Get existing tasks for this note
      const existingTasks = await this.getTasksByNote(notePath)
      
      // Create new tasks that don't exist
      const newTasks = []
      for (const extracted of extractedTasks) {
        const exists = existingTasks.find(existing => 
          existing.note_position === extracted.note_position &&
          existing.title === extracted.title
        )
        
        if (!exists) {
          const created = await this.createTask(extracted.title, {
            description: extracted.description,
            notePath: extracted.note_path,
            notePosition: extracted.note_position,
            status: extracted.status
          })
          newTasks.push(created)
        }
      }

      this.notifyListeners({ 
        type: 'tasks_synced', 
        notePath, 
        newTasks,
        totalExtracted: extractedTasks.length
      })
      
      return {
        extracted: extractedTasks,
        created: newTasks,
        existing: existingTasks
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats() {
    try {
      const tasks = await this.getAllTasks()
      const stats = {
        total: tasks.length,
        byStatus: {},
        byPriority: {},
        withNotes: 0,
        recentlyCreated: 0,
        recentlyUpdated: 0
      }

      const now = Date.now()
      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      
      tasks.forEach(task => {
        // Status distribution
        stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1
        
        // Priority distribution
        const priority = task.priority || 0
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1
        
        // Notes association
        if (task.note_path) {
          stats.withNotes++
        }
        
        // Recent activity
        if (task.created_at > oneDayAgo) {
          stats.recentlyCreated++
        }
        if (task.updated_at > oneDayAgo && task.updated_at !== task.created_at) {
          stats.recentlyUpdated++
        }
      })

      return stats
    } catch (error) {
      throw error
    }
  }

  /**
   * Search tasks
   */
  async searchTasks(query, options = {}) {
    try {
      const tasks = await this.getAllTasks()
      const lowerQuery = query.toLowerCase()
      
      const filtered = tasks.filter(task => {
        // Text search
        const titleMatch = task.title.toLowerCase().includes(lowerQuery)
        const descMatch = task.description?.toLowerCase().includes(lowerQuery)
        const textMatch = titleMatch || descMatch
        
        // Status filter
        const statusMatch = !options.status || task.status === options.status
        
        // Priority filter
        const priorityMatch = options.priority === undefined || task.priority === options.priority
        
        // Note filter
        const noteMatch = !options.notePath || task.note_path === options.notePath
        
        return textMatch && statusMatch && priorityMatch && noteMatch
      })

      return filtered
    } catch (error) {
      throw error
    }
  }

  /**
   * Clear cache
   */
  invalidateCache() {
    this.cache.clear()
  }

  /**
   * Get a single task
   */
  async getTask(taskId) {
    try {
      const task = await invoke('get_task', { taskId })
      return task
    } catch (error) {
      throw error
    }
  }
}

// Create singleton instance
export const taskManager = new TaskManager()

// Task status constants
export const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  URGENT: 'urgent',
  QUESTION: 'question',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELEGATED: 'delegated'
}

// Task priority constants
export const TASK_PRIORITIES = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3
}

// Helper functions
export function getStatusLabel(status) {
  const labels = {
    [TASK_STATUSES.TODO]: 'Todo',
    [TASK_STATUSES.IN_PROGRESS]: 'In Progress',
    [TASK_STATUSES.URGENT]: 'Urgent',
    [TASK_STATUSES.QUESTION]: 'Question',
    [TASK_STATUSES.COMPLETED]: 'Completed',
    [TASK_STATUSES.CANCELLED]: 'Cancelled',
    [TASK_STATUSES.DELEGATED]: 'Delegated'
  }
  return labels[status] || status
}

export function getPriorityLabel(priority) {
  const labels = {
    [TASK_PRIORITIES.LOW]: 'Low',
    [TASK_PRIORITIES.NORMAL]: 'Normal',
    [TASK_PRIORITIES.HIGH]: 'High',
    [TASK_PRIORITIES.URGENT]: 'Urgent'
  }
  return labels[priority] || 'Normal'
}

export function getStatusSymbol(status) {
  const symbols = {
    [TASK_STATUSES.TODO]: '◯',
    [TASK_STATUSES.IN_PROGRESS]: '◔',
    [TASK_STATUSES.URGENT]: '◉',
    [TASK_STATUSES.QUESTION]: '?',
    [TASK_STATUSES.COMPLETED]: '●',
    [TASK_STATUSES.CANCELLED]: '✕',
    [TASK_STATUSES.DELEGATED]: '→'
  }
  return symbols[status] || '◯'
}

export default taskManager