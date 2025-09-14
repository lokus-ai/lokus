import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Plus, X, MoreHorizontal } from 'lucide-react'

// Task status to column mapping
const TASK_COLUMNS = {
  todo: { id: 'todo', title: 'Todo', status: 'todo' },
  'in-progress': { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
  urgent: { id: 'urgent', title: 'Urgent', status: 'urgent' },
  question: { id: 'question', title: 'Question', status: 'question' },
  completed: { id: 'completed', title: 'Completed', status: 'completed' }
}

// Task status colors
const STATUS_COLORS = {
  todo: 'bg-gray-100 border-gray-300 text-gray-700',
  'in-progress': 'bg-blue-100 border-blue-300 text-blue-700',
  urgent: 'bg-red-100 border-red-300 text-red-700',
  question: 'bg-yellow-100 border-yellow-300 text-yellow-700',
  completed: 'bg-green-100 border-green-300 text-green-700',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-500 line-through',
  delegated: 'bg-purple-100 border-purple-300 text-purple-700'
}

// Individual task card component
function TaskCard({ task, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [showMenu, setShowMenu] = useState(false)

  const handleSave = useCallback(async () => {
    if (title.trim() && title !== task.title) {
      try {
        await onUpdate(task.id, { title: title.trim() })
      } catch (error) {
        console.error('Failed to update task:', error)
        setTitle(task.title) // Revert on error
      }
    }
    setIsEditing(false)
  }, [task.id, task.title, title, onUpdate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setTitle(task.title)
      setIsEditing(false)
    }
  }, [task.title, handleSave])

  const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.todo

  return (
    <div className={`p-3 mb-2 rounded-md border-2 cursor-pointer transition-all hover:shadow-sm ${statusColor}`}>
      <div className="flex items-start justify-between gap-2">
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
            autoFocus
          />
        ) : (
          <div 
            className="flex-1 text-sm font-medium cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            {task.title}
          </div>
        )}
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-black/10 opacity-60 hover:opacity-100"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-32">
              <button
                onClick={() => {
                  setIsEditing(true)
                  setShowMenu(false)
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete(task.id)
                  setShowMenu(false)
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      
      {task.description && (
        <div className="mt-2 text-xs opacity-70">
          {task.description}
        </div>
      )}
      
      {task.note_path && (
        <div className="mt-2 text-xs opacity-60 truncate">
          📝 {task.note_path.split('/').pop()}
        </div>
      )}
      
      <div className="mt-2 text-xs opacity-50">
        {new Date(task.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

// Column component
function KanbanColumn({ column, tasks, onTaskUpdate, onTaskDelete, onAddTask }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

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
    <div className="bg-app-panel rounded-lg p-4 min-w-80 max-w-80 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-app-text">
          {column.title}
          <span className="ml-2 px-2 py-1 bg-app-border/30 rounded-full text-xs">
            {tasks.length}
          </span>
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
          title="Add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-32">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            onDelete={onTaskDelete}
          />
        ))}
        
        {isAdding && (
          <div className="p-3 mb-2 rounded-md border-2 border-dashed border-app-border bg-app-bg">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={handleAddTask}
              onKeyDown={handleKeyDown}
              placeholder="Task title..."
              className="w-full bg-transparent border-none outline-none text-sm"
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Main Kanban Board component
export default function KanbanBoard({ workspacePath, onFileOpen }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    
    if (!over || active.id === over.id) return

    const taskId = active.id
    const newStatus = over.id

    if (!TASK_COLUMNS[newStatus]) return

    try {
      await handleTaskUpdate(taskId, { status: newStatus })
    } catch (error) {
      console.error('Failed to move task:', error)
    }
  }, [handleTaskUpdate])

  // Group tasks by status
  const tasksByStatus = Object.keys(TASK_COLUMNS).reduce((acc, status) => {
    acc[status] = tasks.filter(task => task.status === status)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-app-muted">Loading tasks...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-600 mb-2">{error}</div>
        <button
          onClick={loadTasks}
          className="px-3 py-1 text-xs rounded border border-app-border hover:bg-app-hover"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-app-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-app-text">Task Board</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-app-muted">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
            <button
              onClick={loadTasks}
              className="px-2 py-1 text-xs rounded border border-app-border hover:bg-app-hover"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-4 min-h-full">
            {Object.values(TASK_COLUMNS).map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.status] || []}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                onAddTask={handleAddTask}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}