import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import { Plus, MoreHorizontal, RefreshCw, Search, Filter, Calendar, Tag, ExternalLink } from 'lucide-react'

// Task status to column mapping for full kanban
const FULL_COLUMNS = {
  todo: { id: 'todo', title: 'Todo', status: 'todo', color: 'border-[rgb(var(--task-todo))]', headerColor: 'text-[rgb(var(--task-todo))]' },
  'in-progress': { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: 'border-[rgb(var(--task-progress))]', headerColor: 'text-[rgb(var(--task-progress))]' },
  urgent: { id: 'urgent', title: 'Urgent', status: 'urgent', color: 'border-[rgb(var(--task-urgent))]', headerColor: 'text-[rgb(var(--task-urgent))]' },
  question: { id: 'question', title: 'Question', status: 'question', color: 'border-[rgb(var(--task-question))]', headerColor: 'text-[rgb(var(--task-question))]' },
  completed: { id: 'completed', title: 'Completed', status: 'completed', color: 'border-[rgb(var(--task-completed))]', headerColor: 'text-[rgb(var(--task-completed))]' },
  cancelled: { id: 'cancelled', title: 'Cancelled', status: 'cancelled', color: 'border-[rgb(var(--task-cancelled))]', headerColor: 'text-[rgb(var(--task-cancelled))]' },
  delegated: { id: 'delegated', title: 'Delegated', status: 'delegated', color: 'border-[rgb(var(--task-delegated))]', headerColor: 'text-[rgb(var(--task-delegated))]' }
}

// Task status colors for cards
const STATUS_COLORS = {
  todo: 'bg-app-panel border-app-border text-app-text',
  'in-progress': 'bg-app-panel border-[rgb(var(--task-progress))] text-app-text',
  urgent: 'bg-app-panel border-[rgb(var(--task-urgent))] text-app-text',
  question: 'bg-app-panel border-[rgb(var(--task-question))] text-app-text',
  completed: 'bg-app-panel border-[rgb(var(--task-completed))] text-app-text opacity-75',
  cancelled: 'bg-app-panel border-[rgb(var(--task-cancelled))] text-app-muted line-through opacity-60',
  delegated: 'bg-app-panel border-[rgb(var(--task-delegated))] text-app-text'
}

// Draggable task card component
function DraggableTaskCard({ task, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [showMenu, setShowMenu] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  } : undefined

  const handleSave = useCallback(async () => {
    const updates = {}
    if (title.trim() && title !== task.title) {
      updates.title = title.trim()
    }
    if (description !== (task.description || '')) {
      updates.description = description || null
    }
    
    if (Object.keys(updates).length > 0) {
      try {
        await onUpdate(task.id, updates)
      } catch (error) {
        console.error('Failed to update task:', error)
        setTitle(task.title)
        setDescription(task.description || '')
      }
    }
    setIsEditing(false)
  }, [task.id, task.title, task.description, title, description, onUpdate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setTitle(task.title)
      setDescription(task.description || '')
      setIsEditing(false)
    }
  }, [task.title, task.description, handleSave])

  const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.todo
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card-professional ${statusColor} ${
        isDragging ? 'dragging' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {isEditing ? (
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none font-medium text-sm"
              placeholder="Task title..."
              autoFocus
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none text-xs resize-none"
              placeholder="Description (optional)..."
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs bg-app-accent text-app-accent-fg rounded hover:bg-app-accent/80"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTitle(task.title)
                  setDescription(task.description || '')
                  setIsEditing(false)
                }}
                className="px-2 py-1 text-xs bg-app-border text-app-text rounded hover:bg-app-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => setIsEditing(true)}
            >
              <div className="task-card-title">{task.title}</div>
              {task.description && (
                <div className="task-card-description line-clamp-2">{task.description}</div>
              )}
            </div>
            
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
                className="p-1 rounded hover:bg-black/10 opacity-60 hover:opacity-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-36">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsEditing(true)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-t-lg"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDetails(!showDetails)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    {showDetails ? 'Hide Details' : 'Show Details'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(task.id)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600 rounded-b-lg"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Task metadata */}
      {!isEditing && (
        <div className="space-y-2">
          {task.note_path && (
            <div className="flex items-center gap-1 text-xs opacity-60">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{task.note_path.split('/').pop()}</span>
            </div>
          )}
          
          {showDetails && (
            <div className="space-y-1 text-xs opacity-60 border-t border-current/20 pt-2">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Created: {formatDate(task.created_at)}</span>
              </div>
              {task.updated_at !== task.created_at && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Updated: {formatDate(task.updated_at)}</span>
                </div>
              )}
              <div>ID: {task.id.slice(0, 8)}...</div>
              {task.priority !== 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>Priority: {task.priority}</span>
                </div>
              )}
            </div>
          )}
          
          <div className="task-card-meta">
            <span>{formatDate(task.created_at)}</span>
            <span className="capitalize">{task.status.replace('-', ' ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Droppable column component
function DroppableColumn({ column, tasks, onTaskUpdate, onTaskDelete, onAddTask }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id: column.id,
  })

  const handleAddTask = useCallback(async () => {
    if (newTaskTitle.trim()) {
      try {
        await onAddTask(newTaskTitle.trim(), column.status)
        setNewTaskTitle('')
        setIsAdding(false)
      } catch (error) {
        console.error('Failed to add task:', error)
      }
    }
  }, [newTaskTitle, column.status, onAddTask])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleAddTask()
    } else if (e.key === 'Escape') {
      setNewTaskTitle('')
      setIsAdding(false)
    }
  }, [handleAddTask])

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <div className="task-status-indicator" style={{ backgroundColor: `rgb(var(--task-${column.status}))` }}></div>
        <div className="kanban-column-title">
          <span className={column.headerColor}>{column.title}</span>
          <span className="kanban-column-count">{tasks.length}</span>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="ml-auto p-1.5 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors"
          title="Add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`kanban-column-content ${
          isOver ? 'bg-app-accent/10 rounded-lg' : ''
        }`}
      >
        {tasks.map(task => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            onDelete={onTaskDelete}
          />
        ))}
        
        {tasks.length === 0 && !isAdding && (
          <div className="text-center text-app-muted py-8">
            <div className="text-sm mb-2">No {column.title.toLowerCase()} tasks</div>
            <div className="text-xs">Drag tasks here or click + to add</div>
          </div>
        )}
      </div>
      
      <div className="add-task-area">
        {isAdding ? (
          <div className="p-3 mb-2 rounded-lg border border-app-border bg-app-bg/50">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={handleAddTask}
              onKeyDown={handleKeyDown}
              placeholder="Enter task title..."
              className="w-full bg-transparent border-none outline-none text-sm font-medium"
              autoFocus
            />
            <div className="mt-2 text-xs text-app-muted">
              Press Enter to save, Esc to cancel
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="add-task-button"
          >
            + Add new task
          </button>
        )}
      </div>
    </div>
  )
}

// Main Full Kanban component
export default function FullKanban({ workspacePath, onFileOpen }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Load all tasks
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      const allTasks = await invoke('get_all_tasks')
      setTasks(allTasks || [])
      setError(null)
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load tasks on mount
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Add new task
  const handleAddTask = useCallback(async (title, status = 'todo') => {
    try {
      const newTask = await invoke('create_task', {
        title,
        description: null,
        notePath: null,
        notePosition: null
      })
      
      // Update status if not todo
      if (status !== 'todo') {
        const updatedTask = await invoke('update_task', {
          taskId: newTask.id,
          title: null,
          description: null,
          status,
          priority: null
        })
        setTasks(prev => [...prev, updatedTask])
      } else {
        setTasks(prev => [...prev, newTask])
      }
    } catch (error) {
      console.error('Failed to create task:', error)
      throw error
    }
  }, [])

  // Update task
  const handleTaskUpdate = useCallback(async (taskId, updates) => {
    try {
      const updatedTask = await invoke('update_task', {
        taskId,
        title: updates.title || null,
        description: updates.description || null,
        status: updates.status || null,
        priority: updates.priority || null
      })
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
    } catch (error) {
      console.error('Failed to update task:', error)
      throw error
    }
  }, [])

  // Delete task
  const handleTaskDelete = useCallback(async (taskId) => {
    try {
      await invoke('delete_task', { taskId })
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [])

  // Handle drag end - moving tasks between columns
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event
    setActiveId(null)
    
    if (!over || active.id === over.id) return

    const taskId = active.id
    const newStatus = over.id

    if (!FULL_COLUMNS[newStatus]) return

    try {
      await handleTaskUpdate(taskId, { status: newStatus })
    } catch (error) {
      console.error('Failed to move task:', error)
    }
  }, [handleTaskUpdate])

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  // Filter tasks based on search and status filter
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = searchTerm === '' || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Group filtered tasks by status
  const tasksByStatus = Object.keys(FULL_COLUMNS).reduce((acc, status) => {
    acc[status] = filteredTasks.filter(task => task.status === status)
    return acc
  }, {})

  const activeTask = activeId ? tasks.find(task => task.id === activeId) : null

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-app-muted" />
          <div className="text-app-muted">Loading tasks...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={loadTasks}
            className="px-4 py-2 rounded-lg border border-app-border hover:bg-app-hover flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length

  return (
    <div className="h-full flex flex-col full-kanban">
      {/* Header */}
      <div className="kanban-header">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-app-text">Task Board</h1>
            <div className="text-sm text-app-muted mt-1">
              {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} • {completedTasks} completed
              {totalTasks > 0 && (
                <span className="ml-2">
                  ({Math.round((completedTasks / totalTasks) * 100)}% done)
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={loadTasks}
              className="p-2 rounded-lg border border-app-border hover:bg-app-hover"
              title="Refresh tasks"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-app-muted" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-app-border bg-app-bg text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-app-border bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent"
          >
            <option value="all">All Status</option>
            {Object.values(FULL_COLUMNS).map(column => (
              <option key={column.id} value={column.status}>
                {column.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-columns-container">
            {Object.values(FULL_COLUMNS).map(column => (
              <DroppableColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.status] || []}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                onAddTask={handleAddTask}
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeTask ? (
              <div className={`p-4 rounded-lg border-2 ${STATUS_COLORS[activeTask.status]} opacity-90 shadow-lg rotate-3`}>
                <div className="font-medium text-sm">{activeTask.title}</div>
                {activeTask.description && (
                  <div className="text-xs opacity-70 mt-1">{activeTask.description}</div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}