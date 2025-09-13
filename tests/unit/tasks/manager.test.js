import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskManager, TASK_STATUSES, TASK_PRIORITIES } from '../../../src/core/tasks/manager.js'

// Mock Tauri invoke
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

describe('TaskManager', () => {
  let taskManager

  beforeEach(() => {
    taskManager = new TaskManager()
    mockInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllTasks', () => {
    it('should fetch all tasks from backend', async () => {
      const mockTasks = [
        { id: '1', title: 'Test task', status: 'todo' },
        { id: '2', title: 'Another task', status: 'completed' }
      ]
      mockInvoke.mockResolvedValue(mockTasks)

      const tasks = await taskManager.getAllTasks()

      expect(mockInvoke).toHaveBeenCalledWith('get_all_tasks')
      expect(tasks).toEqual(mockTasks)
    })

    it('should cache tasks and reuse them', async () => {
      const mockTasks = [{ id: '1', title: 'Test task', status: 'todo' }]
      mockInvoke.mockResolvedValue(mockTasks)

      // First call
      await taskManager.getAllTasks()
      // Second call should use cache
      await taskManager.getAllTasks()

      expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('should force refresh when requested', async () => {
      const mockTasks = [{ id: '1', title: 'Test task', status: 'todo' }]
      mockInvoke.mockResolvedValue(mockTasks)

      // First call
      await taskManager.getAllTasks()
      // Force refresh
      await taskManager.getAllTasks(true)

      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('createTask', () => {
    it('should create a new task', async () => {
      const newTask = { id: '123', title: 'New task', status: 'todo' }
      mockInvoke.mockResolvedValue(newTask)

      const result = await taskManager.createTask('New task')

      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        title: 'New task',
        description: null,
        notePath: null,
        notePosition: null
      })
      expect(result).toEqual(newTask)
    })

    it('should create task with custom status', async () => {
      const newTask = { id: '123', title: 'New task', status: 'todo' }
      const updatedTask = { id: '123', title: 'New task', status: 'urgent' }
      
      mockInvoke
        .mockResolvedValueOnce(newTask)
        .mockResolvedValueOnce(updatedTask)

      const result = await taskManager.createTask('New task', { status: 'urgent' })

      expect(mockInvoke).toHaveBeenCalledTimes(2)
      expect(result).toEqual(updatedTask)
    })

    it('should notify listeners when task is created', async () => {
      const newTask = { id: '123', title: 'New task', status: 'todo' }
      mockInvoke.mockResolvedValue(newTask)

      const listener = vi.fn()
      taskManager.addListener(listener)

      await taskManager.createTask('New task')

      expect(listener).toHaveBeenCalledWith({
        type: 'task_created',
        task: newTask
      })
    })
  })

  describe('updateTask', () => {
    it('should update a task', async () => {
      const updatedTask = { id: '123', title: 'Updated task', status: 'completed' }
      mockInvoke.mockResolvedValue(updatedTask)

      const result = await taskManager.updateTask('123', { title: 'Updated task' })

      expect(mockInvoke).toHaveBeenCalledWith('update_task', {
        taskId: '123',
        title: 'Updated task',
        description: null,
        status: null,
        priority: null
      })
      expect(result).toEqual(updatedTask)
    })

    it('should notify listeners when task is updated', async () => {
      const updatedTask = { id: '123', title: 'Updated task', status: 'completed' }
      mockInvoke.mockResolvedValue(updatedTask)

      const listener = vi.fn()
      taskManager.addListener(listener)

      await taskManager.updateTask('123', { title: 'Updated task' })

      expect(listener).toHaveBeenCalledWith({
        type: 'task_updated',
        task: updatedTask,
        updates: { title: 'Updated task' }
      })
    })

    it('should invalidate cache when updating', async () => {
      const tasks = [{ id: '1', title: 'Task 1' }]
      const updatedTask = { id: '123', title: 'Updated task' }
      
      mockInvoke
        .mockResolvedValueOnce(tasks) // First getAllTasks call
        .mockResolvedValueOnce(updatedTask) // updateTask call
        .mockResolvedValueOnce(tasks) // Second getAllTasks call

      await taskManager.getAllTasks()
      await taskManager.updateTask('123', { title: 'Updated task' })
      await taskManager.getAllTasks()

      // Should make 3 calls total (no cache hit for second getAllTasks)
      expect(mockInvoke).toHaveBeenCalledTimes(3)
    })
  })

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      mockInvoke.mockResolvedValue()

      await taskManager.deleteTask('123')

      expect(mockInvoke).toHaveBeenCalledWith('delete_task', { taskId: '123' })
    })

    it('should notify listeners when task is deleted', async () => {
      mockInvoke.mockResolvedValue()

      const listener = vi.fn()
      taskManager.addListener(listener)

      await taskManager.deleteTask('123')

      expect(listener).toHaveBeenCalledWith({
        type: 'task_deleted',
        taskId: '123'
      })
    })
  })

  describe('getTasksByStatus', () => {
    it('should fetch tasks by status', async () => {
      const todoTasks = [
        { id: '1', title: 'Todo 1', status: 'todo' },
        { id: '2', title: 'Todo 2', status: 'todo' }
      ]
      mockInvoke.mockResolvedValue(todoTasks)

      const result = await taskManager.getTasksByStatus('todo')

      expect(mockInvoke).toHaveBeenCalledWith('get_tasks_by_status', { status: 'todo' })
      expect(result).toEqual(todoTasks)
    })
  })

  describe('bulkUpdateStatus', () => {
    it('should update multiple tasks at once', async () => {
      const updatedTasks = [
        { id: '1', title: 'Task 1', status: 'completed' },
        { id: '2', title: 'Task 2', status: 'completed' }
      ]
      mockInvoke.mockResolvedValue(updatedTasks)

      const result = await taskManager.bulkUpdateStatus(['1', '2'], 'completed')

      expect(mockInvoke).toHaveBeenCalledWith('bulk_update_task_status', {
        taskIds: ['1', '2'],
        status: 'completed'
      })
      expect(result).toEqual(updatedTasks)
    })

    it('should notify listeners for bulk updates', async () => {
      const updatedTasks = [
        { id: '1', title: 'Task 1', status: 'completed' },
        { id: '2', title: 'Task 2', status: 'completed' }
      ]
      mockInvoke.mockResolvedValue(updatedTasks)

      const listener = vi.fn()
      taskManager.addListener(listener)

      await taskManager.bulkUpdateStatus(['1', '2'], 'completed')

      expect(listener).toHaveBeenCalledWith({
        type: 'tasks_bulk_updated',
        tasks: updatedTasks,
        status: 'completed'
      })
    })
  })

  describe('getTaskStats', () => {
    it('should calculate task statistics', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 1, note_path: 'file1.md', created_at: Date.now(), updated_at: Date.now() },
        { id: '2', title: 'Task 2', status: 'completed', priority: 2, note_path: null, created_at: Date.now() - 86400000, updated_at: Date.now() - 86400000 },
        { id: '3', title: 'Task 3', status: 'todo', priority: 1, note_path: 'file2.md', created_at: Date.now(), updated_at: Date.now() }
      ]
      mockInvoke.mockResolvedValue(mockTasks)

      const stats = await taskManager.getTaskStats()

      expect(stats.total).toBe(3)
      expect(stats.byStatus.todo).toBe(2)
      expect(stats.byStatus.completed).toBe(1)
      expect(stats.withNotes).toBe(2)
      expect(stats.recentlyCreated).toBe(2)
    })
  })

  describe('searchTasks', () => {
    it('should search tasks by query', async () => {
      const mockTasks = [
        { id: '1', title: 'Fix the bug', status: 'todo', priority: 1 },
        { id: '2', title: 'Add new feature', status: 'in-progress', priority: 2 },
        { id: '3', title: 'Bug in authentication', status: 'urgent', priority: 3 }
      ]
      mockInvoke.mockResolvedValue(mockTasks)

      const results = await taskManager.searchTasks('bug')

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('Fix the bug')
      expect(results[1].title).toBe('Bug in authentication')
    })

    it('should filter by status when provided', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 1 },
        { id: '2', title: 'Task 2', status: 'completed', priority: 2 }
      ]
      mockInvoke.mockResolvedValue(mockTasks)

      const results = await taskManager.searchTasks('task', { status: 'todo' })

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('todo')
    })
  })

  describe('listener management', () => {
    it('should add and remove listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      const unsubscribe1 = taskManager.addListener(listener1)
      const unsubscribe2 = taskManager.addListener(listener2)

      // Both listeners should be added
      expect(taskManager.listeners.size).toBe(2)

      unsubscribe1()
      expect(taskManager.listeners.size).toBe(1)

      unsubscribe2()
      expect(taskManager.listeners.size).toBe(0)
    })

    it('should handle listener errors gracefully', async () => {
      const goodListener = vi.fn()
      const badListener = vi.fn(() => {
        throw new Error('Listener error')
      })

      taskManager.addListener(goodListener)
      taskManager.addListener(badListener)

      // This should not throw despite the bad listener
      expect(() => {
        taskManager.notifyListeners({ type: 'test' })
      }).not.toThrow()

      expect(goodListener).toHaveBeenCalled()
      expect(badListener).toHaveBeenCalled()
    })
  })

  describe('constants and helpers', () => {
    it('should export task status constants', () => {
      expect(TASK_STATUSES.TODO).toBe('todo')
      expect(TASK_STATUSES.COMPLETED).toBe('completed')
      expect(TASK_STATUSES.URGENT).toBe('urgent')
    })

    it('should export task priority constants', () => {
      expect(TASK_PRIORITIES.LOW).toBe(0)
      expect(TASK_PRIORITIES.NORMAL).toBe(1)
      expect(TASK_PRIORITIES.HIGH).toBe(2)
      expect(TASK_PRIORITIES.URGENT).toBe(3)
    })
  })
})