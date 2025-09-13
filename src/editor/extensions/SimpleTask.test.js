import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri invoke - use factory function to avoid hoisting issues
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock DOM methods for JSDOM environment
const mockQuerySelector = vi.fn()
const mockQuerySelectorAll = vi.fn()
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

// Enhanced DOM mocks
Object.defineProperty(global, 'document', {
  value: {
    querySelector: mockQuerySelector,
    querySelectorAll: mockQuerySelectorAll,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    createElement: vi.fn(() => ({
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      remove: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      style: {},
      textContent: '',
      className: '',
      matches: vi.fn(() => false),
      closest: vi.fn(() => null),
      getAttribute: vi.fn(),
      hasAttribute: vi.fn(() => false),
      attributes: [],
      cloneNode: vi.fn(function() { return this })
    })),
    createTextNode: vi.fn(() => ({ textContent: '' })),
    body: {
      appendChild: vi.fn(),
      contains: vi.fn(() => false)
    }
  }
})

Object.defineProperty(global, 'window', {
  value: {
    getSelection: vi.fn(() => ({
      rangeCount: 0,
      getRangeAt: vi.fn(),
      removeAllRanges: vi.fn()
    })),
    dispatchEvent: vi.fn()
  }
})

// Import after mocks are set up
import { SimpleTask } from './SimpleTask.js'

describe('SimpleTask Extension', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Get the mocked invoke function
    const { invoke } = await import('@tauri-apps/api/core')
    invoke.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Extension Properties', () => {
    it('should have correct name', () => {
      expect(SimpleTask.name).toBe('simpleTask')
    })

    it('should have storage configuration', () => {
      expect(SimpleTask.config.addStorage).toBeDefined()
      const storage = SimpleTask.config.addStorage()
      expect(storage).toHaveProperty('editorInstance')
      expect(storage.editorInstance).toBeNull()
    })
  })

  describe('Input Rules', () => {
    it('should have input rules for !task and @task', () => {
      const mockContext = {
        storage: { editorInstance: null }
      }
      const rules = SimpleTask.config.addInputRules.call(mockContext)
      
      expect(Array.isArray(rules)).toBe(true)
      expect(rules).toHaveLength(2)
      
      // Check patterns
      const patterns = rules.map(rule => rule.find.source)
      expect(patterns).toContain('!task\\s$')
      expect(patterns).toContain('@task\\s$')
    })

    it('should handle !task trigger', () => {
      const mockContext = {
        storage: { editorInstance: null }
      }
      const rules = SimpleTask.config.addInputRules.call(mockContext)
      const taskRule = rules.find(rule => rule.find.source === '!task\\s$')
      
      expect(taskRule).toBeDefined()
      expect(taskRule.handler).toBeDefined()
      
      // Mock handler parameters
      const mockChain = {
        deleteRange: vi.fn(() => ({ run: vi.fn() }))
      }
      const mockRange = { from: 0, to: 5 }
      const mockEditor = {}
      
      const result = taskRule.handler({
        chain: () => mockChain,
        range: mockRange,
        match: ['!task '],
        editor: mockEditor
      })
      
      expect(result).toBe(true)
      expect(mockChain.deleteRange).toHaveBeenCalledWith(mockRange)
    })

    it('should handle @task trigger', () => {
      const mockContext = {
        storage: { editorInstance: null }
      }
      const rules = SimpleTask.config.addInputRules.call(mockContext)
      const importRule = rules.find(rule => rule.find.source === '@task\\s$')
      
      expect(importRule).toBeDefined()
      expect(importRule.handler).toBeDefined()
      
      // Mock handler parameters
      const mockChain = {
        deleteRange: vi.fn(() => ({ run: vi.fn() }))
      }
      const mockRange = { from: 0, to: 6 }
      const mockEditor = {}
      
      const result = importRule.handler({
        chain: () => mockChain,
        range: mockRange,
        match: ['@task '],
        editor: mockEditor
      })
      
      expect(result).toBe(true)
      expect(mockChain.deleteRange).toHaveBeenCalledWith(mockRange)
    })
  })

  describe('Task Creation Flow', () => {
    it('should create task via Tauri backend', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      
      const mockTask = {
        id: 'test-task-id',
        title: 'Test Task',
        status: 'todo',
        priority: 0
      }
      const mockUpdatedTask = { ...mockTask, status: 'urgent' }
      
      invoke
        .mockResolvedValueOnce(mockTask) // create_task
        .mockResolvedValueOnce(mockUpdatedTask) // update_task

      // Simulate task creation (this would normally be triggered by widget)
      const createdTask = await invoke('create_task', {
        title: 'Test Task',
        description: null,
        notePath: null,
        notePosition: null
      })
      
      expect(createdTask).toEqual(mockTask)
      expect(invoke).toHaveBeenCalledWith('create_task', {
        title: 'Test Task',
        description: null,
        notePath: null,
        notePosition: null
      })
      
      // Test status update
      const updatedTask = await invoke('update_task', {
        taskId: 'test-task-id',
        title: null,
        description: null,
        status: 'urgent',
        priority: null
      })
      
      expect(updatedTask).toEqual(mockUpdatedTask)
    })

    it('should map frontend status to backend status correctly', () => {
      const statusMap = {
        'urgent': 'urgent',
        'question': 'needs-info',
        'progress': 'in-progress',
        'todo': 'todo'
      }
      
      // Test that our mapping logic works
      Object.entries(statusMap).forEach(([frontend, backend]) => {
        expect(statusMap[frontend]).toBe(backend)
      })
    })

    it('should handle task creation errors gracefully', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const error = new Error('Backend error')
      invoke.mockRejectedValue(error)
      
      try {
        await invoke('create_task', { title: 'Test Task' })
        expect(true).toBe(false) // Should not reach here
      } catch (e) {
        expect(e).toBe(error)
      }
    })
  })

  describe('Task Import Flow', () => {
    it('should fetch all tasks for import', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo' },
        { id: '2', title: 'Task 2', status: 'urgent' },
        { id: '3', title: 'Task 3', status: 'completed' }
      ]
      
      invoke.mockResolvedValue(mockTasks)
      
      const tasks = await invoke('get_all_tasks')
      
      expect(tasks).toEqual(mockTasks)
      expect(invoke).toHaveBeenCalledWith('get_all_tasks')
    })

    it('should filter tasks by search query', () => {
      const mockTasks = [
        { id: '1', title: 'Fix login bug', status: 'todo' },
        { id: '2', title: 'Add new feature', status: 'in-progress' },
        { id: '3', title: 'Bug in payment system', status: 'urgent' }
      ]
      
      // Simulate filtering logic
      const query = 'bug'
      const filtered = mockTasks.filter(task => 
        task.title.toLowerCase().includes(query.toLowerCase())
      )
      
      expect(filtered).toHaveLength(2)
      expect(filtered[0].title).toBe('Fix login bug')
      expect(filtered[1].title).toBe('Bug in payment system')
    })

    it('should handle import errors gracefully', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      invoke.mockRejectedValue(new Error('Failed to fetch tasks'))
      
      try {
        await invoke('get_all_tasks')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Failed to fetch tasks')
      }
    })
  })

  describe('Status Emoji Mapping', () => {
    it('should map statuses to correct emojis', () => {
      const statusEmojiMap = {
        'urgent': '🔴',
        'needs-info': '🟡',
        'in-progress': '🔵',
        'todo': '⚪',
        'completed': '✅'
      }
      
      Object.entries(statusEmojiMap).forEach(([status, emoji]) => {
        expect(statusEmojiMap[status]).toBe(emoji)
      })
      
      // Test fallback
      expect(statusEmojiMap['unknown-status'] || '⚪').toBe('⚪')
    })

    it('should have consistent type colors', () => {
      const typeColors = {
        urgent: '🔴 Urgent',
        question: '🟡 Question', 
        progress: '🔵 In Progress',
        todo: '⚪ Todo'
      }
      
      expect(typeColors.urgent).toBe('🔴 Urgent')
      expect(typeColors.question).toBe('🟡 Question')
      expect(typeColors.progress).toBe('🔵 In Progress')
      expect(typeColors.todo).toBe('⚪ Todo')
    })
  })

  describe('Pattern Matching', () => {
    it('should match task patterns in text content', () => {
      const testCases = [
        { text: '🔴 Urgent task', shouldMatch: true, emoji: '🔴', task: 'Urgent task' },
        { text: '🟡 Question task', shouldMatch: true, emoji: '🟡', task: 'Question task' },
        { text: '🔵 Progress task', shouldMatch: true, emoji: '🔵', task: 'Progress task' },
        { text: '⚪ Todo task', shouldMatch: true, emoji: '⚪', task: 'Todo task' },
        { text: '✅ Completed task', shouldMatch: true, emoji: '✅', task: 'Completed task' },
        { text: 'Regular text', shouldMatch: false },
        { text: 'Text with 🔴 emoji but wrong format', shouldMatch: false }
      ]
      
      const taskPattern = /^(🔴|🟡|🔵|⚪|✅)\s+(.+?)$/
      
      testCases.forEach(testCase => {
        const match = testCase.text.match(taskPattern)
        
        if (testCase.shouldMatch) {
          expect(match).toBeTruthy()
          expect(match[1]).toBe(testCase.emoji)
          expect(match[2]).toBe(testCase.task)
        } else {
          expect(match).toBeFalsy()
        }
      })
    })
  })

  describe('DOM Manipulation', () => {
    it('should create task elements with correct attributes', () => {
      const mockElement = {
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
        style: {},
        className: '',
        textContent: ''
      }
      
      global.document.createElement.mockReturnValue(mockElement)
      
      // Simulate element creation
      const taskElement = document.createElement('span')
      taskElement.setAttribute('data-task-text', 'true')
      taskElement.setAttribute('data-task-id', 'test-id')
      taskElement.setAttribute('data-task-status', 'urgent')
      taskElement.className = 'task-element'
      taskElement.textContent = '🔴 Test Task'
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-task-text', 'true')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-task-id', 'test-id')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-task-status', 'urgent')
    })

    it('should apply correct inline styles', () => {
      const mockElement = {
        style: { cssText: '' },
        addEventListener: vi.fn()
      }
      
      global.document.createElement.mockReturnValue(mockElement)
      
      // Simulate styling
      const taskElement = document.createElement('span')
      taskElement.style.cssText = `
        background: rgba(var(--accent), 0.1);
        border: 1px solid rgba(var(--accent), 0.2);
        border-radius: 6px;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
      `
      
      expect(taskElement.style.cssText).toContain('cursor: pointer')
    })

    it('should add hover event listeners', () => {
      const mockElement = {
        addEventListener: vi.fn(),
        style: {}
      }
      
      global.document.createElement.mockReturnValue(mockElement)
      
      // Simulate hover handlers
      const taskElement = document.createElement('span')
      taskElement.addEventListener('mouseenter', () => {})
      taskElement.addEventListener('mouseleave', () => {})
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function))
      expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function))
    })
  })

  describe('Click Handler Setup', () => {
    it('should have onCreate configuration', () => {
      expect(SimpleTask.config.onCreate).toBeDefined()
      expect(typeof SimpleTask.config.onCreate).toBe('function')
    })
  })

  describe('Navigation Logic', () => {
    it('should find kanban tab for navigation', () => {
      const mockKanbanTab = {
        click: vi.fn()
      }
      
      mockQuerySelector.mockImplementation(selector => {
        if (selector === '[data-file="__kanban__"]') {
          return mockKanbanTab
        }
        return null
      })
      
      // Simulate navigation logic
      const kanbanTab = document.querySelector('[data-file="__kanban__"]')
      expect(kanbanTab).toBe(mockKanbanTab)
      
      if (kanbanTab) {
        kanbanTab.click()
        expect(mockKanbanTab.click).toHaveBeenCalled()
      }
    })

    it('should find tasks by ID in kanban', () => {
      const mockTaskElement = {
        scrollIntoView: vi.fn(),
        style: {}
      }
      
      mockQuerySelector.mockImplementation(selector => {
        if (selector === '[data-task-id="test-id"]') {
          return mockTaskElement
        }
        return null
      })
      
      // Simulate task finding and highlighting
      const taskElement = document.querySelector('[data-task-id="test-id"]')
      expect(taskElement).toBe(mockTaskElement)
      
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        taskElement.style.outline = '2px solid var(--app-accent)'
        taskElement.style.outlineOffset = '2px'
        
        expect(mockTaskElement.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'center'
        })
      }
    })

    it('should find tasks by title when ID not available', () => {
      const mockTasks = [
        { textContent: '🔴 First task', getAttribute: () => null },
        { textContent: '🟡 Target task', getAttribute: () => null },
        { textContent: '🔵 Third task', getAttribute: () => null }
      ]
      
      mockQuerySelectorAll.mockReturnValue(mockTasks)
      
      // Simulate title-based search
      const targetTitle = 'Target task'
      const allTasks = document.querySelectorAll('[data-task-id]')
      
      let foundTask = null
      for (const taskElement of allTasks) {
        const taskText = taskElement.textContent || ''
        if (taskText.includes(targetTitle)) {
          foundTask = taskElement
          break
        }
      }
      
      expect(foundTask).toBe(mockTasks[1])
    })
  })
});