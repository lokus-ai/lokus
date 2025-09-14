import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'
import { invoke } from '@tauri-apps/api/core'
import { sanitizeUserInput, safeSetTextContent, createSafeTextNode } from '../../core/security/index.js'

// Create task import autocomplete widget
function createTaskImportWidget(editor) {
  console.log('📋 Creating task import widget')
  
  const widget = document.createElement('div')
  widget.className = 'task-import-widget'
  widget.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    min-width: 480px;
    max-width: 600px;
    backdrop-filter: blur(8px);
    font-family: system-ui, -apple-system, sans-serif;
    max-height: 400px;
    overflow: hidden;
  `
  
  const header = document.createElement('div')
  header.textContent = '📋 Import Existing Task'
  header.style.cssText = `
    font-size: 14px;
    color: #f3f4f6;
    margin-bottom: 12px;
    font-weight: 600;
  `
  
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.placeholder = 'Type to search tasks...'
  searchInput.style.cssText = `
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #4b5563;
    border-radius: 8px;
    background: #374151;
    color: #f9fafb;
    font-size: 14px;
    outline: none;
    margin-bottom: 12px;
    box-sizing: border-box;
  `
  
  const tasksList = document.createElement('div')
  tasksList.style.cssText = `
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid #4b5563;
    border-radius: 6px;
    background: #374151;
  `
  
  const loadingDiv = document.createElement('div')
  loadingDiv.textContent = 'Loading tasks...'
  loadingDiv.style.cssText = `
    padding: 20px;
    text-align: center;
    color: #9ca3af;
    font-size: 14px;
  `
  tasksList.appendChild(loadingDiv)
  
  const helpText = document.createElement('div')
  helpText.textContent = '↑↓ to navigate • Enter to select • Esc to cancel'
  helpText.style.cssText = `
    font-size: 12px;
    color: #9ca3af;
    margin-top: 12px;
    text-align: center;
    opacity: 0.8;
  `
  
  widget.appendChild(header)
  widget.appendChild(searchInput)
  widget.appendChild(tasksList)
  widget.appendChild(helpText)
  document.body.appendChild(widget)
  
  let allTasks = []
  let filteredTasks = []
  let selectedIndex = 0
  
  // Load existing tasks
  async function loadTasks() {
    try {
      const tasks = await invoke('get_all_tasks')
      console.log('📋 Loaded tasks for import:', tasks.length)
      allTasks = tasks
      filteredTasks = tasks
      renderTasks()
    } catch (error) {
      console.error('❌ Failed to load tasks:', error)
      console.error('Error details:', error)
      // Create error message safely
      const errorDiv = document.createElement('div')
      errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #ef4444;'
      safeSetTextContent(errorDiv, 'Failed to load tasks: ' + String(error).substring(0, 200))
      tasksList.innerHTML = ''
      tasksList.appendChild(errorDiv)
    }
  }
  
  function renderTasks() {
    if (filteredTasks.length === 0) {
      // Create no tasks message safely
      const noTasksDiv = document.createElement('div')
      noTasksDiv.style.cssText = 'padding: 20px; text-align: center; color: #9ca3af;'
      safeSetTextContent(noTasksDiv, 'No tasks found')
      tasksList.innerHTML = ''
      tasksList.appendChild(noTasksDiv)
      return
    }
    
    tasksList.innerHTML = ''
    filteredTasks.forEach((task, index) => {
      const taskItem = document.createElement('div')
      taskItem.className = 'task-import-item'
      taskItem.style.cssText = `
        padding: 10px 12px;
        border-bottom: 1px solid #4b5563;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s ease;
        ${index === selectedIndex ? 'background: #4b5563;' : ''}
      `
      
      // Status emoji
      const statusEmoji = getStatusEmoji(task.status)
      const statusSpan = document.createElement('span')
      statusSpan.textContent = statusEmoji
      statusSpan.style.cssText = 'font-size: 14px;'
      
      const titleSpan = document.createElement('span')
      titleSpan.textContent = task.title
      titleSpan.style.cssText = 'color: #f9fafb; font-size: 14px; flex: 1;'
      
      taskItem.appendChild(statusSpan)
      taskItem.appendChild(titleSpan)
      
      taskItem.addEventListener('click', () => selectTask(task))
      taskItem.addEventListener('mouseenter', () => {
        selectedIndex = index
        renderTasks()
      })
      
      tasksList.appendChild(taskItem)
    })
  }
  
  function getStatusEmoji(status) {
    const statusMap = {
      'urgent': '🔴',
      'needs-info': '🟡',
      'in-progress': '🔵',
      'todo': '⚪',
      'completed': '✅'
    }
    return statusMap[status] || '⚪'
  }
  
  function filterTasks(query) {
    const lowercaseQuery = query.toLowerCase()
    filteredTasks = allTasks.filter(task => 
      task.title.toLowerCase().includes(lowercaseQuery)
    )
    selectedIndex = 0
    renderTasks()
  }
  
  function selectTask(task) {
    console.log('✅ Selected task for import:', task.title)
    
    // Insert the task reference into editor using DOM element method
    const statusEmoji = getStatusEmoji(task.status)
    const fallbackText = `${statusEmoji} ${task.title}`
    
    try {
      console.log('🔗 Creating DOM element for imported task')
      
      // Create the task span element
      const taskElement = document.createElement('span')
      taskElement.setAttribute('data-task-text', 'true')
      taskElement.setAttribute('data-task-id', task.id)
      taskElement.setAttribute('data-task-status', task.status)
      taskElement.className = 'task-element imported-task'
      taskElement.textContent = `${statusEmoji} ${task.title}`
      
      // Apply inline styles
      taskElement.style.cssText = `
        background: rgba(var(--accent), 0.1);
        border: 1px solid rgba(var(--accent), 0.2);
        border-radius: 6px;
        padding: 0.25rem 0.5rem;
        margin: 0.125rem;
        cursor: pointer;
        font-weight: 500;
        display: inline-block;
        transition: all 0.2s ease;
      `
      
      // Insert with multiple methods
      if (editor.chain && typeof editor.chain === 'function') {
        try {
          // Try as TipTap link content
          editor.chain().focus().insertContent([{
            type: 'text',
            text: fallbackText,
            marks: [{
              type: 'link',
              attrs: {
                href: '#',
                'data-task-text': 'true',
                'data-task-id': task.id,
                'data-task-status': task.status
              }
            }]
          }]).run()
          console.log('✅ Imported task as TipTap link')
        } catch (error) {
          // Fallback to text
          editor.chain().focus().insertContent(fallbackText).run()
          console.log('✅ Imported task as text fallback')
        }
      }
      
      // Also try direct DOM insertion
      setTimeout(() => {
        const proseMirror = document.querySelector('.ProseMirror')
        if (proseMirror) {
          const selection = window.getSelection()
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            range.insertNode(document.createTextNode(' '))
            range.insertNode(taskElement.cloneNode(true))
            range.insertNode(document.createTextNode(' '))
            selection.removeAllRanges()
            console.log('✅ Direct DOM insertion for import completed')
          }
        }
      }, 100)
      
    } catch (error) {
      console.log('❌ Failed to import task:', error)
      // Ultimate fallback
      if (editor.chain && typeof editor.chain === 'function') {
        editor.chain().focus().insertContent(fallbackText).run()
      }
    }
    
    // Close widget
    widget.remove()
    try {
      if (editor && editor.commands) {
        editor.commands.focus()
      }
    } catch (error) {
      console.log('📝 Could not focus editor')
    }
  }
  
  // Handle keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, filteredTasks.length - 1)
      renderTasks()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
      renderTasks()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTasks[selectedIndex]) {
        selectTask(filteredTasks[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      widget.remove()
      try {
        if (editor && editor.commands) {
          editor.commands.focus()
        }
      } catch (error) {
        console.log('📝 Could not focus editor')
      }
    }
  })
  
  // Filter as user types
  searchInput.addEventListener('input', (e) => {
    filterTasks(e.target.value)
  })
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeWidget(e) {
      if (!widget.contains(e.target)) {
        widget.remove()
        document.removeEventListener('click', closeWidget)
      }
    })
  }, 100)
  
  // Focus search input and load tasks
  searchInput.focus()
  loadTasks()
}

// Create floating task input widget
function createInlineTaskInput(editor, taskType = 'urgent') {
  console.log('🔍 Editor received in createInlineTaskInput:', !!editor, typeof editor)
  console.log('🎯 Creating inline task input for:', taskType)
  
  // Use document body as container (simpler approach)
  const editorContainer = document.body
  
  // Create floating input container
  const widget = document.createElement('div')
  widget.className = 'task-input-widget'
  widget.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    min-width: 420px;
    backdrop-filter: blur(8px);
    font-family: system-ui, -apple-system, sans-serif;
  `
  
  // Task type indicator
  const typeColors = {
    urgent: '🔴 Urgent',
    question: '🟡 Question', 
    progress: '🔵 In Progress',
    todo: '⚪ Todo'
  }
  
  const typeLabel = document.createElement('div')
  typeLabel.textContent = typeColors[taskType] || typeColors.todo
  typeLabel.style.cssText = `
    font-size: 14px;
    color: #f3f4f6;
    margin-bottom: 12px;
    font-weight: 500;
  `
  
  // Input field
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Enter task description...'
  input.style.cssText = `
    width: 100%;
    padding: 14px 16px;
    border: 1px solid #4b5563;
    border-radius: 8px;
    background: #374151;
    color: #f9fafb;
    font-size: 15px;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
    box-sizing: border-box;
  `
  
  // Help text
  const help = document.createElement('div')
  help.textContent = 'Press Enter to save • Tab to change type • Esc to cancel'
  help.style.cssText = `
    font-size: 12px;
    color: #9ca3af;
    margin-top: 12px;
    text-align: center;
    opacity: 0.8;
  `
  
  // Assemble widget
  widget.appendChild(typeLabel)
  widget.appendChild(input)
  widget.appendChild(help)
  
  // Add to container
  editorContainer.appendChild(widget)
  
  // Add focus and hover effects
  input.addEventListener('focus', () => {
    input.style.borderColor = '#3b82f6'
    input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
  })
  
  input.addEventListener('blur', () => {
    input.style.borderColor = '#4b5563'
    input.style.boxShadow = 'none'
  })
  
  // Focus input
  input.focus()
  
  let currentType = taskType
  
  // Handle keyboard events
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const taskText = input.value.trim()
      if (taskText) {
        console.log('💾 Saving task:', taskText, 'Type:', currentType)
        
        // Create task in kanban
        try {
          const newTask = await invoke('create_task', {
            title: taskText,
            description: null,
            notePath: null,
            notePosition: null
          })
          
          console.log('✅ Task created:', newTask)
          
          // Map task types to backend statuses
          const statusMap = {
            'urgent': 'urgent',
            'question': 'needs-info',
            'progress': 'in-progress',
            'todo': 'todo'
          }
          
          const backendStatus = statusMap[currentType] || 'todo'
          
          console.log('🔄 Mapping:', currentType, '→', backendStatus)
          
          // Update task type
          await invoke('update_task', {
            taskId: newTask.id,
            title: null,
            description: null,
            status: backendStatus,
            priority: null
          })
          
          console.log('✅ Task updated to:', backendStatus)
          
          // Insert interactive task in editor
          try {
            console.log('🔍 Editor object check:', !!editor, !!editor?.chain, !!editor?.commands)
            
            if (editor && (editor.chain || editor.commands)) {
              const taskId = newTask.id
              const taskHtml = `<div class="editor-task task-${backendStatus}" data-task-id="${taskId}" data-status="${backendStatus}"><span class="task-indicator">${typeColors[currentType]}</span><span class="task-text">${taskText}</span><button class="task-jump-btn" title="View in kanban">📋</button></div>`
              
              console.log('📝 Attempting to insert task HTML:', taskHtml)
              
              // Create a styled task link as HTML
              const styledTaskHtml = `<span data-task-text="true" data-task-id="${taskId}" data-task-status="${backendStatus}">${typeColors[currentType]} ${taskText}</span>`
              
              // Also keep simple text as ultimate fallback
              const fallbackText = `${typeColors[currentType]} ${taskText}`
              
              // Create DOM element directly and insert it
              try {
                console.log('🔗 Creating DOM element for task')
                
                // Create the task span element
                const taskElement = document.createElement('span')
                taskElement.setAttribute('data-task-text', 'true')
                taskElement.setAttribute('data-task-id', taskId)
                taskElement.setAttribute('data-task-status', backendStatus)
                taskElement.className = 'task-element'
                taskElement.textContent = `${typeColors[currentType]} ${taskText}`
                
                // Apply inline styles to make it look like a clickable link
                taskElement.style.cssText = `
                  background: rgba(var(--accent), 0.1);
                  border: 1px solid rgba(var(--accent), 0.2);
                  border-radius: 6px;
                  padding: 0.25rem 0.5rem;
                  margin: 0.125rem;
                  cursor: pointer;
                  font-weight: 500;
                  display: inline-block;
                  transition: all 0.2s ease;
                `
                
                // Add hover effect
                taskElement.addEventListener('mouseenter', () => {
                  taskElement.style.background = 'rgba(var(--accent), 0.2)'
                  taskElement.style.borderColor = 'rgba(var(--accent), 0.4)'
                  taskElement.style.transform = 'translateY(-1px)'
                })
                
                taskElement.addEventListener('mouseleave', () => {
                  taskElement.style.background = 'rgba(var(--accent), 0.1)'
                  taskElement.style.borderColor = 'rgba(var(--accent), 0.2)'
                  taskElement.style.transform = 'translateY(0)'
                })
                
                console.log('✅ Created task element:', taskElement)
                
                // Insert using TipTap's insertContent with the DOM element
                if (editor.chain && typeof editor.chain === 'function') {
                  try {
                    // Try inserting the DOM element directly
                    editor.chain().focus().insertContent([{
                      type: 'text',
                      text: `${typeColors[currentType]} ${taskText}`,
                      marks: [
                        {
                          type: 'link',
                          attrs: {
                            href: '#',
                            'data-task-text': 'true',
                            'data-task-id': taskId,
                            'data-task-status': backendStatus
                          }
                        }
                      ]
                    }]).run()
                    console.log('✅ Inserted as TipTap content')
                  } catch (error) {
                    console.log('❌ TipTap content failed, trying HTML insertion:', error.message)
                    
                    // Fallback to HTML string
                    editor.chain().focus().insertContent(styledTaskHtml).run()
                    console.log('✅ Inserted as HTML string')
                  }
                } else {
                  console.log('❌ No editor chain available')
                }
                
                // Also try direct DOM insertion as fallback
                setTimeout(() => {
                  const proseMirror = document.querySelector('.ProseMirror')
                  if (proseMirror && proseMirror.contains(document.activeElement)) {
                    // Find the current cursor position and insert element
                    const selection = window.getSelection()
                    if (selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0)
                      range.insertNode(document.createTextNode(' '))
                      range.insertNode(taskElement.cloneNode(true))
                      range.insertNode(document.createTextNode(' '))
                      
                      // Clear selection
                      selection.removeAllRanges()
                      console.log('✅ Direct DOM insertion completed')
                    }
                  }
                }, 100)
                
              } catch (error) {
                console.log('❌ All insertion methods failed:', error)
                // Ultimate fallback to plain text
                if (editor.chain && typeof editor.chain === 'function') {
                  editor.chain().focus().insertContent(fallbackText).run()
                }
              }
              
              console.log('✅ Task HTML insertion attempted')
            } else {
              console.log('📝 Editor not available for content insertion')
            }
          } catch (error) {
            console.log('📝 Could not insert into editor:', error.message, error)
          }
          
        } catch (error) {
          console.error('❌ Failed to create task:', error)
        }
      }
      
      // Remove widget
      widget.remove()
      try {
        if (editor && editor.commands) {
          editor.commands.focus()
        }
      } catch (error) {
        console.log('📝 Could not focus editor')
      }
      
    } else if (e.key === 'Escape') {
      widget.remove()
      try {
        if (editor && editor.commands) {
          editor.commands.focus()
        }
      } catch (error) {
        console.log('📝 Could not focus editor')
      }
      
    } else if (e.key === 'Tab') {
      e.preventDefault()
      // Cycle through task types
      const types = ['urgent', 'question', 'progress', 'todo']
      const currentIndex = types.indexOf(currentType)
      currentType = types[(currentIndex + 1) % types.length]
      typeLabel.textContent = typeColors[currentType]
      console.log('🔄 Switched to:', currentType)
    }
  })
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeWidget(e) {
      if (!widget.contains(e.target)) {
        widget.remove()
        try {
          if (editor && editor.commands) {
            editor.commands.focus()
          }
        } catch (error) {
          console.log('📝 Could not focus editor')
        }
        document.removeEventListener('click', closeWidget)
      }
    })
  }, 100)
}

// Simple task creation with unique symbols
export const SimpleTask = Extension.create({
  name: 'simpleTask',
  
  addStorage() {
    return {
      editorInstance: null,
    }
  },
  
  onCreate() {
    console.log('🚀 SimpleTask extension loaded!')
    
    // Store editor reference
    this.storage.editorInstance = this.editor
    console.log('💾 Stored editor reference:', !!this.storage.editorInstance)
    
    // Add click handlers for task elements immediately and with delay
    this.addTaskClickHandlers()
    setTimeout(() => {
      this.addTaskClickHandlers()
    }, 1000)
    
    // Test if tasks exist on page
    setTimeout(() => {
      const taskElements = document.querySelectorAll('[data-task-text]')
      console.log('🔍 Found task elements on page:', taskElements.length)
      taskElements.forEach((el, i) => {
        console.log(`Task ${i}:`, el.getAttribute('data-task-id'), el.textContent)
      })
    }, 2000)
  },
  
  addTaskClickHandlers() {
    console.log('🔗 Setting up task click handlers')
    
    // Store reference to extension methods for use in event handler
    const extensionContext = this
    
    // Remove any existing handlers first to avoid duplicates
    document.removeEventListener('click', this.taskClickHandler)
    
    // Create the handler function
    this.taskClickHandler = (e) => {
      console.log('🖱️ CLICK EVENT DETECTED! Target:', e.target.tagName)
      
      // Always log clicks within ProseMirror for debugging
      const proseMirrorElement = e.target.closest('.ProseMirror')
      if (proseMirrorElement) {
        console.log('📝 Click within ProseMirror!')
        console.log('🎯 Target attributes:', Array.from(e.target.attributes || []).map(a => `${a.name}="${a.value}"`))
      }
      
      // Check if clicked on a task span (direct or parent)
      const taskSpan = e.target.closest('[data-task-text]') || (e.target.hasAttribute && e.target.hasAttribute('data-task-text') ? e.target : null)
      
      if (taskSpan) {
        console.log('✅ TASK SPAN DETECTED!')
        const taskId = taskSpan.getAttribute('data-task-id')
        const taskStatus = taskSpan.getAttribute('data-task-status') 
        const taskText = taskSpan.textContent
        
        console.log('📋 Task details:', { taskId, taskStatus, taskText })
        
        if (taskId) {
          console.log('🚀 NAVIGATING TO KANBAN with task ID:', taskId)
          e.preventDefault()
          e.stopPropagation()
          
          // Call jumpToKanban method
          try {
            extensionContext.jumpToKanban(taskId)
          } catch (error) {
            console.error('❌ Error jumping to kanban:', error)
          }
          return
        }
      }
      
      // Fallback text pattern matching for tasks without proper attributes
      if (proseMirrorElement) {
        const clickedText = e.target.textContent || e.target.innerText || ''
        const taskPattern = /^(🔴|🟡|🔵|⚪|✅)\s+(.+?)$/
        const match = clickedText.match(taskPattern)
        
        if (match) {
          console.log('🎯 Task pattern detected in text:', match[2])
          e.preventDefault()
          e.stopPropagation()
          extensionContext.jumpToKanbanByTitle(match[2].trim())
          return
        }
      }
    }
    
    // Add the event listener
    document.addEventListener('click', this.taskClickHandler, true) // Use capture phase
    console.log('✅ Task click handler registered')
  },
  
  jumpToKanban(taskId) {
    console.log('🎯 Opening kanban board and highlighting task:', taskId)
    
    // Find the kanban tab button in the navigation
    const kanbanTab = document.querySelector('[data-file="__kanban__"]')
    if (kanbanTab) {
      console.log('📋 Found kanban tab, clicking it...')
      kanbanTab.click()
      
      // After a short delay, try to highlight the specific task
      setTimeout(() => {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`)
        if (taskElement) {
          console.log('🎯 Found task in kanban, highlighting...')
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          taskElement.style.outline = '2px solid var(--app-accent)'
          taskElement.style.outlineOffset = '2px'
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            taskElement.style.outline = ''
            taskElement.style.outlineOffset = ''
          }, 3000)
        }
      }, 500)
    } else {
      console.log('❌ Kanban tab not found')
    }
  },
  
  jumpToKanbanByTitle(taskTitle) {
    console.log('🎯 Opening kanban board and finding task by title:', taskTitle)
    
    // Find the kanban tab button in the navigation
    const kanbanTab = document.querySelector('[data-file="__kanban__"]')
    if (kanbanTab) {
      console.log('📋 Found kanban tab, clicking it...')
      kanbanTab.click()
      
      // After a short delay, try to find and highlight the task by title
      setTimeout(() => {
        // Look for task elements containing the title
        const allTasks = document.querySelectorAll('[data-task-id]')
        let foundTask = null
        
        for (const taskElement of allTasks) {
          const taskText = taskElement.textContent || taskElement.innerText || ''
          if (taskText.includes(taskTitle)) {
            foundTask = taskElement
            break
          }
        }
        
        if (foundTask) {
          console.log('🎯 Found task in kanban by title, highlighting...')
          foundTask.scrollIntoView({ behavior: 'smooth', block: 'center' })
          foundTask.style.outline = '2px solid var(--app-accent)'
          foundTask.style.outlineOffset = '2px'
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            foundTask.style.outline = ''
            foundTask.style.outlineOffset = ''
          }, 3000)
        } else {
          console.log('❌ Could not find task with title:', taskTitle)
        }
      }, 500)
    } else {
      console.log('❌ Kanban tab not found')
    }
  },
  
  showTaskDetails(taskId) {
    // Show a tooltip or modal with task details
    console.log('ℹ️ Showing details for task:', taskId)
    // This could be expanded to show a tooltip with task info
  },
  
  addInputRules() {
    console.log('📝 Adding SimpleTask input rules...')
    return [
      // !task -> opens task creation widget
      new InputRule({
        find: /!task\s$/,
        handler: ({ chain, range, match, editor }) => {
          console.log('🔥 TASK WIDGET TRIGGERED!')
          console.log('🔍 Editor from handler:', !!editor, typeof editor)
          console.log('🔍 Editor from storage:', !!this.storage.editorInstance, typeof this.storage.editorInstance)
          
          // Remove !task trigger
          chain().deleteRange(range).run()
          
          // Use stored editor reference which should be more reliable
          const editorToUse = this.storage.editorInstance || editor
          console.log('🎯 Using editor:', !!editorToUse)
          
          // Delay widget creation to ensure editor is ready
          setTimeout(() => {
            createInlineTaskInput(editorToUse, 'urgent')
          }, 50)
          
          return true
        },
      }),
      
      // @task -> opens task import widget
      new InputRule({
        find: /@task\s$/,
        handler: ({ chain, range, match, editor }) => {
          console.log('📋 TASK IMPORT TRIGGERED!')
          console.log('🔍 Editor from handler:', !!editor, typeof editor)
          console.log('🔍 Editor from storage:', !!this.storage.editorInstance, typeof this.storage.editorInstance)
          
          // Remove @task trigger
          chain().deleteRange(range).run()
          
          // Use stored editor reference which should be more reliable
          const editorToUse = this.storage.editorInstance || editor
          console.log('🎯 Using editor for import:', !!editorToUse)
          
          // Delay widget creation to ensure editor is ready
          setTimeout(() => {
            createTaskImportWidget(editorToUse)
          }, 50)
          
          return true
        },
      })
    ]
  },
})

export default SimpleTask