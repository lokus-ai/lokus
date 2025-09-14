import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Plus, ExternalLink, RefreshCw } from 'lucide-react'

// Task status to column mapping for mini kanban
const MINI_COLUMNS = {
  todo: { id: 'todo', title: 'Todo', status: 'todo', color: 'text-[rgb(var(--task-todo))]' },
  'in-progress': { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: 'text-[rgb(var(--task-progress))]' },
  urgent: { id: 'urgent', title: 'Urgent', status: 'urgent', color: 'text-[rgb(var(--task-urgent))]' },
  completed: { id: 'completed', title: 'Done', status: 'completed', color: 'text-[rgb(var(--task-completed))]' }
}

// Compact task card for mini view
function MiniTaskCard({ task, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(task.title)

  const handleSave = useCallback(async () => {
    if (title.trim() && title !== task.title) {
      try {
        await onUpdate(task.id, { title: title.trim() })
      } catch (error) {
        console.error('Failed to update task:', error)
        setTitle(task.title)
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

  const cycleStatus = useCallback(async () => {
    const statuses = ['todo', 'in-progress', 'completed']
    const currentIndex = statuses.indexOf(task.status)
    const nextStatus = statuses[(currentIndex + 1) % statuses.length]
    
    try {
      await onUpdate(task.id, { status: nextStatus })
    } catch (error) {
      console.error('Failed to update task status:', error)
    }
  }, [task.id, task.status, onUpdate])

  const getStatusSymbol = (status) => {
    switch (status) {
      case 'todo': return '◯'
      case 'in-progress': return '◔'
      case 'urgent': return '◉'
      case 'completed': return '●'
      case 'question': return '?'
      case 'cancelled': return '✕'
      case 'delegated': return '→'
      default: return '◯'
    }
  }

  return (
    <div className="flex items-center gap-2 p-2 text-xs rounded-md hover:bg-app-hover/50 group transition-all duration-200">
      <button
        onClick={cycleStatus}
        className={`w-3 h-3 flex items-center justify-center rounded-full text-xs hover:scale-110 transition-transform ${
          MINI_COLUMNS[task.status]?.color || 'text-gray-500'
        }`}
        title={`Status: ${task.status}. Click to cycle.`}
      >
        {getStatusSymbol(task.status)}
      </button>
      
      {isEditing ? (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-xs"
          autoFocus
        />
      ) : (
        <div 
          className={`flex-1 truncate cursor-pointer ${
            task.status === 'completed' ? 'line-through opacity-60' : ''
          }`}
          onClick={() => setIsEditing(true)}
          title={task.title}
        >
          {task.title}
        </div>
      )}
    </div>
  )
}

// Mini column component
function MiniColumn({ column, tasks, onTaskUpdate, onAddTask }) {
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
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-current ${column.color}`}></div>
          <div className="text-xs font-medium text-app-text">
            {column.title}
          </div>
          <span className="text-xs text-app-muted">({tasks.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="p-0.5 rounded-md hover:bg-app-hover text-app-muted hover:text-app-text transition-colors"
          title="Add task"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {tasks.map(task => (
          <MiniTaskCard
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
          />
        ))}
        
        {isAdding && (
          <div className="flex items-center gap-2 p-2 text-xs rounded bg-app-panel/50">
            <div className="w-3 text-center text-app-muted">+</div>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={handleAddTask}
              onKeyDown={handleKeyDown}
              placeholder="New task..."
              className="flex-1 bg-transparent border-none outline-none text-xs"
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Main Mini Kanban component
export default function MiniKanban({ workspacePath, onOpenFull }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  // Group tasks by status for mini columns
  const tasksByStatus = Object.keys(MINI_COLUMNS).reduce((acc, status) => {
    acc[status] = tasks.filter(task => task.status === status)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-xs text-app-muted">Loading tasks...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="text-xs text-[rgb(var(--danger))] mb-2">{error}</div>
        <button
          onClick={loadTasks}
          className="p-1 text-xs rounded border border-app-border hover:bg-app-hover"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    )
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-app-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-app-text">Task Board</h3>
          <button
            onClick={onOpenFull}
            className="p-1.5 rounded-md hover:bg-app-hover text-app-muted hover:text-app-text transition-colors"
            title="Open full kanban board"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress indicator */}
        {totalTasks > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-app-muted">
              <span>Progress</span>
              <span className="font-medium">{completedTasks}/{totalTasks} ({Math.round((completedTasks / totalTasks) * 100)}%)</span>
            </div>
            <div className="w-full bg-app-panel rounded-full h-1.5">
              <div 
                className="bg-[rgb(var(--task-completed))] h-1.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Task columns */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.values(MINI_COLUMNS).map(column => (
          <MiniColumn
            key={column.id}
            column={column}
            tasks={tasksByStatus[column.status] || []}
            onTaskUpdate={handleTaskUpdate}
            onAddTask={handleAddTask}
          />
        ))}
        
        {totalTasks === 0 && (
          <div className="text-center text-xs text-app-muted mt-4">
            <div>No tasks yet</div>
            <div className="mt-1">Click + to add your first task</div>
          </div>
        )}
      </div>
      
      {/* Quick actions */}
      <div className="p-3 border-t border-app-border/50">
        <button
          onClick={() => handleAddTask('New task')}
          className="w-full text-xs py-2 px-3 rounded-md border border-dashed border-app-border/70 hover:bg-app-panel/50 hover:border-app-accent text-app-muted hover:text-app-text transition-all duration-200"
        >
          + Quick add task
        </button>
      </div>
    </div>
  )
}