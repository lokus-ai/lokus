import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/pm/inputrules'

// Enhanced task states with visual indicators
const TASK_STATES = {
  ' ': { checked: false, state: 'todo', label: 'Todo', class: 'task-todo' },
  'x': { checked: true, state: 'completed', label: 'Completed', class: 'task-completed' },
  'X': { checked: true, state: 'completed', label: 'Completed', class: 'task-completed' },
  '/': { checked: false, state: 'in-progress', label: 'In Progress', class: 'task-in-progress' },
  '!': { checked: false, state: 'urgent', label: 'Urgent', class: 'task-urgent' },
  '?': { checked: false, state: 'question', label: 'Question', class: 'task-question' },
  '-': { checked: false, state: 'cancelled', label: 'Cancelled', class: 'task-cancelled' },
  '>': { checked: false, state: 'delegated', label: 'Delegated', class: 'task-delegated' }
}

// Convert extended task syntax into Task List items with enhanced states
export const SmartTask = Extension.create({
  name: 'smartTask',
  
  addGlobalAttributes() {
    return [
      {
        types: ['taskItem'],
        attributes: {
          taskState: {
            default: 'todo',
            parseHTML: element => {
              const checkbox = element.querySelector('input[type="checkbox"]')
              if (!checkbox) return 'todo'
              
              // Check for custom data attributes or classes
              for (const [symbol, config] of Object.entries(TASK_STATES)) {
                if (element.classList.contains(config.class)) {
                  return config.state
                }
              }
              
              // Fallback to checked status
              return checkbox.checked ? 'completed' : 'todo'
            },
            renderHTML: attributes => {
              const state = attributes.taskState || 'todo'
              const config = Object.values(TASK_STATES).find(s => s.state === state)
              return {
                'data-task-state': state,
                class: config ? config.class : 'task-todo'
              }
            }
          }
        }
      }
    ]
  },
  
  addInputRules() {
    return [
      // Enhanced input rule for task states in list items: [!] text
      new InputRule({
        find: /\[([xX\/!\?\->\s])\]\s$/,
        handler: ({ chain, range, match, editor }) => {
          const symbol = match[1]
          const taskConfig = TASK_STATES[symbol]
          
          if (!taskConfig || !editor?.commands?.toggleTaskList) return false
          
          // Convert current list to task list
          chain().deleteRange(range).toggleTaskList().run()
          
          // Set the appropriate attributes based on the symbol
          const attributes = {
            checked: taskConfig.checked,
            taskState: taskConfig.state
          }
          
          editor.commands.updateAttributes('taskItem', attributes)
          
          // Trigger a task state change event for potential sync with kanban
          if (editor.options?.onTaskStateChange) {
            editor.options.onTaskStateChange({
              state: taskConfig.state,
              symbol: symbol,
              position: range.from
            })
          }
          
          return true
        },
      }),
      
      // Also handle pasted markdown with enhanced task states
      new InputRule({
        find: /^(\s*)-\s\[([x X/!?\->]|\s)\]\s(.+)$/,
        handler: ({ chain, range, match, editor }) => {
          const indent = match[1]
          const symbol = match[2]
          const content = match[3]
          const taskConfig = TASK_STATES[symbol]
          
          if (!taskConfig || !editor?.commands?.toggleTaskList) return false
          
          // Replace the entire line with a proper task item
          chain()
            .deleteRange(range)
            .toggleTaskList()
            .insertContent(content)
            .run()
          
          // Set task state
          const attributes = {
            checked: taskConfig.checked,
            taskState: taskConfig.state
          }
          
          editor.commands.updateAttributes('taskItem', attributes)
          
          return true
        },
      })
    ]
  },
  
  addCommands() {
    return {
      setTaskState: (state) => ({ commands, editor }) => {
        const taskConfig = Object.values(TASK_STATES).find(s => s.state === state)
        if (!taskConfig) return false
        
        return commands.updateAttributes('taskItem', {
          checked: taskConfig.checked,
          taskState: state
        })
      },
      
      toggleTaskState: () => ({ commands, editor }) => {
        const selection = editor.state.selection
        const node = selection.$from.node()
        
        if (node.type.name !== 'taskItem') return false
        
        const currentState = node.attrs.taskState || 'todo'
        const currentIndex = Object.values(TASK_STATES).findIndex(s => s.state === currentState)
        const nextIndex = (currentIndex + 1) % Object.values(TASK_STATES).length
        const nextState = Object.values(TASK_STATES)[nextIndex]
        
        return commands.updateAttributes('taskItem', {
          checked: nextState.checked,
          taskState: nextState.state
        })
      },
      
      // Command to cycle through specific common states
      cycleTaskState: () => ({ commands, editor }) => {
        const commonStates = ['todo', 'in-progress', 'completed']
        const selection = editor.state.selection
        const node = selection.$from.node()
        
        if (node.type.name !== 'taskItem') return false
        
        const currentState = node.attrs.taskState || 'todo'
        const currentIndex = commonStates.indexOf(currentState)
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % commonStates.length : 0
        const nextState = commonStates[nextIndex]
        const taskConfig = Object.values(TASK_STATES).find(s => s.state === nextState)
        
        return commands.updateAttributes('taskItem', {
          checked: taskConfig.checked,
          taskState: nextState
        })
      }
    }
  },
  
  addKeyboardShortcuts() {
    return {
      // Ctrl/Cmd + Shift + T to cycle through task states
      'Mod-Shift-t': () => this.editor.commands.cycleTaskState(),
      
      // Alt + T to toggle between todo and completed
      'Alt-t': () => {
        const selection = this.editor.state.selection
        const node = selection.$from.node()
        
        if (node.type.name !== 'taskItem') return false
        
        const currentState = node.attrs.taskState || 'todo'
        const newState = currentState === 'completed' ? 'todo' : 'completed'
        const taskConfig = Object.values(TASK_STATES).find(s => s.state === newState)
        
        return this.editor.commands.updateAttributes('taskItem', {
          checked: taskConfig.checked,
          taskState: newState
        })
      }
    }
  },
  
  // Add node view for custom rendering if needed
  addNodeView() {
    return {
      taskItem: ({ node, HTMLAttributes, editor }) => {
        const state = node.attrs.taskState || 'todo'
        const config = Object.values(TASK_STATES).find(s => s.state === state)
        
        if (!config) return null
        
        // Add custom classes and data attributes
        const attrs = {
          ...HTMLAttributes,
          'data-task-state': state,
          class: `${HTMLAttributes.class || ''} ${config.class}`.trim()
        }
        
        return ['li', attrs]
      }
    }
  }
})

export default SmartTask

// Helper function to extract task state from checkbox symbol
export const getTaskStateFromSymbol = (symbol) => {
  return TASK_STATES[symbol] || TASK_STATES[' ']
}

// Helper function to get symbol from task state
export const getSymbolFromTaskState = (state) => {
  const entry = Object.entries(TASK_STATES).find(([, config]) => config.state === state)
  return entry ? entry[0] : ' '
}

// Export task states for use in other components
export { TASK_STATES }