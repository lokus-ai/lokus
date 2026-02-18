import { invoke } from '@tauri-apps/api/core'

/**
 * Schedule Block Management System
 * Manages task-to-calendar time block mappings.
 * Follows the same singleton + listener + cache pattern as TaskManager.
 */

export class ScheduleBlockManager {
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
      } catch { }
    })
  }

  /**
   * Get all schedule blocks with caching
   */
  async getAllBlocks(forceRefresh = false) {
    const cacheKey = 'all_blocks'

    if (!forceRefresh && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const blocks = await invoke('get_all_schedule_blocks')
      this.cache.set(cacheKey, blocks)
      return blocks
    } catch (error) {
      throw error
    }
  }

  /**
   * Create a new schedule block
   */
  async createBlock(taskId, start, end) {
    try {
      const block = await invoke('create_schedule_block', {
        taskId,
        start,
        end
      })

      this.invalidateCache()
      this.notifyListeners({ type: 'block_created', block })
      return block
    } catch (error) {
      throw error
    }
  }

  /**
   * Update a schedule block (move or resize)
   */
  async updateBlock(blockId, updates) {
    try {
      const updatedBlock = await invoke('update_schedule_block', {
        blockId,
        start: updates.start || null,
        end: updates.end || null
      })

      this.invalidateCache()
      this.notifyListeners({
        type: 'block_updated',
        block: updatedBlock,
        updates
      })
      return updatedBlock
    } catch (error) {
      throw error
    }
  }

  /**
   * Delete a schedule block
   */
  async deleteBlock(blockId) {
    try {
      await invoke('delete_schedule_block', { blockId })
      this.invalidateCache()
      this.notifyListeners({ type: 'block_deleted', blockId })
    } catch (error) {
      throw error
    }
  }

  /**
   * Get all schedule blocks for a specific task
   */
  async getBlocksForTask(taskId) {
    try {
      const blocks = await invoke('get_schedule_blocks_for_task', { taskId })
      return blocks
    } catch (error) {
      throw error
    }
  }

  /**
   * Get schedule blocks within a date range (for calendar rendering)
   */
  async getBlocksInRange(rangeStart, rangeEnd) {
    const cacheKey = `range_${rangeStart}_${rangeEnd}`

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const blocks = await invoke('get_schedule_blocks_in_range', {
        rangeStart,
        rangeEnd
      })
      this.cache.set(cacheKey, blocks)
      return blocks
    } catch (error) {
      throw error
    }
  }

  /**
   * Delete all schedule blocks for a task (cleanup when task is deleted)
   */
  async deleteBlocksForTask(taskId) {
    try {
      const deletedIds = await invoke('delete_schedule_blocks_for_task', { taskId })
      this.invalidateCache()
      this.notifyListeners({
        type: 'blocks_deleted_for_task',
        taskId,
        deletedIds
      })
      return deletedIds
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
}

// Create singleton instance
export const scheduleBlockManager = new ScheduleBlockManager()

export default scheduleBlockManager
