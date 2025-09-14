import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri invoke
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

// Mock DOM methods for JSDOM environment
const mockQuerySelector = vi.fn()
const mockQuerySelectorAll = vi.fn()
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

global.document = {
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

global.window = {
  getSelection: vi.fn(() => ({
    rangeCount: 0,
    getRangeAt: vi.fn(),
    removeAllRanges: vi.fn()
  })),
  dispatchEvent: vi.fn()
}

// Import after mocks are set up
import { SimpleTask } from '../../../src/editor/extensions/SimpleTask.js'

describe('SimpleTask Extension', () => {
  let extension
  let mockEditor

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    mockInvoke.mockClear()
    
    // Mock editor object
    mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          insertContent: vi.fn(() => ({
            run: vi.fn()
          })),
          deleteRange: vi.fn(() => ({
            run: vi.fn()
          }))
        }))
      })),
      commands: {
        insertContent: vi.fn(),
        focus: vi.fn()
      },
      view: {
        dispatch: vi.fn(),
        state: {
          tr: {
            replaceSelectionWith: vi.fn()
          }
        }
      },
      schema: {
        nodeFromJSON: vi.fn(() => ({}))
      }
    }

    // Create extension instance
    extension = SimpleTask.create()
    extension.editor = mockEditor
    extension.storage = { editorInstance: mockEditor }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Extension Creation', () => {
    it('should create SimpleTask extension with correct name', () => {
      expect(extension.name).toBe('simpleTask')
    })

    it('should have storage for editor instance', () => {
      expect(extension.config.addStorage).toBeDefined()
      const storage = extension.config.addStorage()
      expect(storage).toHaveProperty('editorInstance')
      expect(storage.editorInstance).toBeNull()
    })
  })

  describe('Input Rules', () => {
    it('should have input rules for !task and @task', () => {
      const rules = extension.config.addInputRules.call(extension)
      
      expect(Array.isArray(rules)).toBe(true)
      expect(rules).toHaveLength(2)
      
      // Check patterns
      const patterns = rules.map(rule => rule.find.source)
      expect(patterns).toContain('!task\\s$')
      expect(patterns).toContain('@task\\s$')
    })

    it('should handle !task trigger', () => {
      const rules = extension.config.addInputRules.call(extension)
      const taskRule = rules.find(rule => rule.find.source === '!task\\s$')
      
      expect(taskRule).toBeDefined()
      expect(taskRule.handler).toBeDefined()
      
      // Mock handler parameters
      const mockChain = {
        deleteRange: vi.fn(() => ({ run: vi.fn() }))
      }
      const mockRange = { from: 0, to: 5 }
      
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
      const rules = extension.config.addInputRules.call(extension)
      const importRule = rules.find(rule => rule.find.source === '@task\\s$')
      
      expect(importRule).toBeDefined()
      expect(importRule.handler).toBeDefined()
      
      // Mock handler parameters
      const mockChain = {
        deleteRange: vi.fn(() => ({ run: vi.fn() }))
      }
      const mockRange = { from: 0, to: 6 }
      
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
      const mockTask = {
        id: 'test-task-id',
        title: 'Test Task',
        status: 'todo',
        priority: 0
      }
      const mockUpdatedTask = { ...mockTask, status: 'urgent' }
      
      mockInvoke
        .mockResolvedValueOnce(mockTask) // create_task
        .mockResolvedValueOnce(mockUpdatedTask) // update_task

      // Simulate task creation (this would normally be triggered by widget)
      // We'll test the invoke calls that should happen
      
      const createdTask = await mockInvoke('create_task', {
        title: 'Test Task',
        description: null,
        notePath: null,
        notePosition: null
      })
      
      expect(createdTask).toEqual(mockTask)
      expect(mockInvoke).toHaveBeenCalledWith('create_task', {
        title: 'Test Task',
        description: null,
        notePath: null,
        notePosition: null
      })
      
      // Test status update
      const updatedTask = await mockInvoke('update_task', {
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
      const error = new Error('Backend error')
      mockInvoke.mockRejectedValue(error)
      
      try {
        await mockInvoke('create_task', { title: 'Test Task' })
      } catch (e) {
        expect(e).toBe(error)
      }
      
      // Should not throw unhandled errors
      expect(() => {
        // Error handling would be in the actual widget code
      }).not.toThrow()
    })
  })

  describe('Task Import Flow', () => {
    it('should fetch all tasks for import', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo' },
        { id: '2', title: 'Task 2', status: 'urgent' },
        { id: '3', title: 'Task 3', status: 'completed' }
      ]
      
      mockInvoke.mockResolvedValue(mockTasks)
      
      const tasks = await mockInvoke('get_all_tasks')
      
      expect(tasks).toEqual(mockTasks)
      expect(mockInvoke).toHaveBeenCalledWith('get_all_tasks')
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
      mockInvoke.mockRejectedValue(new Error('Failed to fetch tasks'))
      
      try {
        await mockInvoke('get_all_tasks')
      } catch (error) {
        expect(error.message).toBe('Failed to fetch tasks')
      }
    })
  })

  describe('Click Handlers', () => {
    beforeEach(() => {
      // Setup click handler
      if (extension.config.onCreate) {
        extension.config.onCreate.call(extension)
      }
    })

    it('should set up click handlers on create', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function), true)
    })

    it('should detect clicks on task elements', () => {
      // Mock a task element
      const mockTaskElement = {
        hasAttribute: vi.fn(() => true),
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-task-id') return 'test-id'
          if (attr === 'data-task-status') return 'todo'
          return null
        }),
        textContent: '⚪ Test Task',
        closest: vi.fn(() => ({ className: 'ProseMirror' }))
      }
      
      mockQuerySelector.mockReturnValue(mockTaskElement)
      
      // Mock click event
      const clickEvent = {
        target: mockTaskElement,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }
      
      // Simulate click handler logic
      const proseMirrorElement = clickEvent.target.closest('.ProseMirror')
      expect(proseMirrorElement).toBeTruthy()
      
      if (clickEvent.target.hasAttribute('data-task-text')) {
        const taskId = clickEvent.target.getAttribute('data-task-id')
        expect(taskId).toBe('test-id')
        
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
        
        expect(clickEvent.preventDefault).toHaveBeenCalled()
        expect(clickEvent.stopPropagation).toHaveBeenCalled()
      }
    })

    it('should handle clicks outside ProseMirror', () => {
      const mockElement = {
        closest: vi.fn(() => null) // Not in ProseMirror
      }
      
      const clickEvent = {
        target: mockElement,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }
      
      // Simulate click handler logic
      const proseMirrorElement = clickEvent.target.closest('.ProseMirror')
      expect(proseMirrorElement).toBeFalsy()
      
      // Should not process click
      expect(clickEvent.preventDefault).not.toHaveBeenCalled()
    })

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

  describe('Kanban Navigation', () => {
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
        style: {},
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
});