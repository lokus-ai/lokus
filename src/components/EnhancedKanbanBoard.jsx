import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Plus, X, MoreHorizontal, RefreshCw, Settings, Cloud, Wifi, WifiOff } from 'lucide-react'
import { providerManager } from '../plugins/data/ProviderRegistry.js'

// Task status to column mapping (extended for provider compatibility)
const TASK_COLUMNS = {
  todo: { id: 'todo', title: 'Todo', status: 'todo' },
  'in-progress': { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
  urgent: { id: 'urgent', title: 'Urgent', status: 'urgent' },
  question: { id: 'question', title: 'Question', status: 'question' },
  completed: { id: 'completed', title: 'Completed', status: 'completed' }
}

// Enhanced status colors with provider indicators
const STATUS_COLORS = {
  todo: 'bg-gray-100 border-gray-300 text-gray-700',
  'in-progress': 'bg-blue-100 border-blue-300 text-blue-700',
  urgent: 'bg-red-100 border-red-300 text-red-700',
  question: 'bg-yellow-100 border-yellow-300 text-yellow-700',
  completed: 'bg-green-100 border-green-300 text-green-700',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-500 line-through',
  delegated: 'bg-purple-100 border-purple-300 text-purple-700'
}

// Enhanced task card component with provider metadata
function EnhancedTaskCard({ task, onUpdate, onDelete, providerInfo }) {
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
  const isProviderTask = task.provider_id || task.external_id

  return (
    <div className={`p-3 mb-2 rounded-md border-2 cursor-pointer transition-all hover:shadow-sm ${statusColor} relative`}>
      {/* Provider indicator */}
      {isProviderTask && (
        <div className="absolute top-1 right-1">
          <Cloud className="w-3 h-3 text-blue-500" title={`From ${task.provider_id || 'external'}`} />
        </div>
      )}

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
              {task.external_url && (
                <button
                  onClick={() => {
                    window.open(task.external_url, '_blank')
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
                >
                  Open External
                </button>
              )}
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

      {/* Provider metadata */}
      {task.provider_id && (
        <div className="mt-2 text-xs opacity-50 flex items-center gap-1">
          <Cloud className="w-3 h-3" />
          {task.provider_id}
          {task.last_synced && (
            <span className="ml-2">
              Synced: {new Date(task.last_synced).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
      
      <div className="mt-2 text-xs opacity-50">
        {new Date(task.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

// Enhanced column component with provider sync status
function EnhancedKanbanColumn({ column, tasks, onTaskUpdate, onTaskDelete, onAddTask, providerInfo, syncStatus }) {
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

  const localTasks = tasks.filter(task => !task.provider_id)
  const providerTasks = tasks.filter(task => task.provider_id)

  return (
    <div className="bg-app-panel rounded-lg p-4 min-w-80 max-w-80 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-app-text">
          {column.title}
          <span className="ml-2 px-2 py-1 bg-app-border/30 rounded-full text-xs">
            {tasks.length}
          </span>
          {providerTasks.length > 0 && (
            <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
              <Cloud className="w-3 h-3 inline mr-1" />
              {providerTasks.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {syncStatus && (
            <div className={`w-2 h-2 rounded-full ${
              syncStatus === 'synced' ? 'bg-green-500' : 
              syncStatus === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
            }`} title={`Sync status: ${syncStatus}`} />
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
            title="Add task"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-32">
        {/* Local tasks first */}
        {localTasks.map(task => (
          <EnhancedTaskCard
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            onDelete={onTaskDelete}
            providerInfo={providerInfo}
          />
        ))}

        {/* Provider tasks with separator */}
        {providerTasks.length > 0 && localTasks.length > 0 && (
          <div className="my-2 border-t border-app-border pt-2">
            <div className="text-xs text-app-muted mb-2 flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              External Tasks
            </div>
          </div>
        )}

        {providerTasks.map(task => (
          <EnhancedTaskCard
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            onDelete={onTaskDelete}
            providerInfo={providerInfo}
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

// Main Enhanced Kanban Board component
export default function EnhancedKanbanBoard({ 
  workspacePath, 
  onFileOpen,
  enableProviderSync = true,
  defaultProvider = null 
}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncStatus, setSyncStatus] = useState('disconnected')
  
  // Provider state
  const [currentProvider, setCurrentProvider] = useState(null)
  const [availableProviders, setAvailableProviders] = useState([])
  const [providerBoards, setProviderBoards] = useState([])
  const [selectedBoard, setSelectedBoard] = useState(null)
  const [showProviderSettings, setShowProviderSettings] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Initialize provider system
  useEffect(() => {
    const initializeProviders = async () => {
      try {
        await providerManager.initialize()
        
        const providers = providerManager.registry.getProvidersByType('kanban')
        setAvailableProviders(providers)

        if (defaultProvider) {
          const provider = providerManager.registry.getProvider(defaultProvider)
          if (provider) {
            await setActiveProvider(provider)
          }
        } else {
          const activeProvider = providerManager.registry.getActiveProvider('kanban')
          if (activeProvider) {
            await setActiveProvider(activeProvider)
          }
        }

      } catch (error) {
        console.error('Failed to initialize kanban providers:', error)
      }
    }

    if (enableProviderSync) {
      initializeProviders()
    }
  }, [enableProviderSync, defaultProvider])

  // Set active provider and load data
  const setActiveProvider = async (provider) => {
    try {
      setCurrentProvider(provider)
      setSyncStatus('connecting')

      if (provider.isConnected) {
        setSyncStatus('connected')
        await loadProviderData(provider)
      } else {
        await provider.connect()
        setSyncStatus('connected')
        await loadProviderData(provider)
      }

      // Start real-time sync if supported
      if (provider.capabilities.has('real-time-updates')) {
        await provider.startSync()
      }

    } catch (error) {
      console.error('Failed to set active provider:', error)
      setSyncStatus('error')
      setError(`Provider connection failed: ${error.message}`)
    }
  }

  // Load data from provider
  const loadProviderData = async (provider) => {
    try {
      // Get available boards
      const boards = await providerManager.executeKanbanOperation(
        async (kanbanProvider) => await kanbanProvider.getBoards()
      )
      setProviderBoards(boards)

      // Load tasks from selected board or first available board
      const boardToUse = selectedBoard || (boards.length > 0 ? boards[0] : null)
      if (boardToUse) {
        setSelectedBoard(boardToUse)
        await loadTasksFromProvider(provider, boardToUse.id)
      }

    } catch (error) {
      console.error('Failed to load provider data:', error)
      setSyncStatus('error')
    }
  }

  // Load tasks from provider and merge with local tasks
  const loadTasksFromProvider = async (provider, boardId) => {
    try {
      setSyncStatus('syncing')

      const providerTasks = await providerManager.executeKanbanOperation(
        async (kanbanProvider) => await kanbanProvider.getTasks(boardId)
      )

      // Load local tasks
      const localTasks = await invoke('get_all_tasks')

      // Merge tasks, marking provider tasks
      const mergedTasks = [
        ...localTasks.map(task => ({ ...task, provider_id: null })),
        ...providerTasks.map(task => ({ 
          ...task, 
          provider_id: provider.id,
          external_id: task.id,
          id: `${provider.id}_${task.id}`, // Unique local ID
          last_synced: Date.now()
        }))
      ]

      setTasks(mergedTasks)
      setSyncStatus('synced')

    } catch (error) {
      console.error('Failed to load tasks from provider:', error)
      setSyncStatus('error')
      
      // Fall back to local tasks only
      await loadLocalTasks()
    }
  }

  // Load local tasks only
  const loadLocalTasks = useCallback(async () => {
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

  // Initial load
  useEffect(() => {
    loadLocalTasks()
  }, [loadLocalTasks])

  // Add new task with provider sync
  const handleAddTask = useCallback(async (title, status = 'todo') => {
    try {
      // Create local task
      const newTask = await invoke('create_task', {
        title,
        description: null,
        notePath: null,
        notePosition: null
      })
      
      // Update status if not todo
      let finalTask = newTask
      if (status !== 'todo') {
        finalTask = await invoke('update_task', {
          taskId: newTask.id,
          title: null,
          description: null,
          status,
          priority: null
        })
      }

      // Sync to provider if available
      if (currentProvider && selectedBoard) {
        try {
          const providerTask = await providerManager.executeKanbanOperation(
            async (kanbanProvider) => await kanbanProvider.createTask(selectedBoard.id, {
              title,
              status,
              description: null
            })
          )
          
          // Mark as synced
          finalTask.provider_id = currentProvider.id
          finalTask.external_id = providerTask.id
          finalTask.last_synced = Date.now()
          
        } catch (providerError) {
          console.warn('Failed to sync task to provider:', providerError)
          // Task is still created locally
        }
      }

      setTasks(prev => [...prev, finalTask])

    } catch (error) {
      console.error('Failed to create task:', error)
      throw error
    }
  }, [currentProvider, selectedBoard])

  // Update task with provider sync
  const handleTaskUpdate = useCallback(async (taskId, updates) => {
    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      // Update local task
      if (!task.provider_id) {
        const updatedTask = await invoke('update_task', {
          taskId,
          title: updates.title || null,
          description: updates.description || null,
          status: updates.status || null,
          priority: updates.priority || null
        })
        
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t))
      }

      // Sync to provider if it's a provider task
      if (task.provider_id && task.external_id && currentProvider) {
        try {
          await providerManager.executeKanbanOperation(
            async (kanbanProvider) => await kanbanProvider.updateTask(task.external_id, updates)
          )
          
          // Update local representation
          setTasks(prev => prev.map(t => 
            t.id === taskId ? { 
              ...t, 
              ...updates, 
              last_synced: Date.now() 
            } : t
          ))
          
        } catch (providerError) {
          console.warn('Failed to sync task update to provider:', providerError)
          // Keep local changes
          setTasks(prev => prev.map(t => 
            t.id === taskId ? { ...t, ...updates } : t
          ))
        }
      }

    } catch (error) {
      console.error('Failed to update task:', error)
      throw error
    }
  }, [tasks, currentProvider])

  // Delete task with provider sync
  const handleTaskDelete = useCallback(async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      // Delete from provider first if it's a provider task
      if (task.provider_id && task.external_id && currentProvider) {
        try {
          await providerManager.executeKanbanOperation(
            async (kanbanProvider) => await kanbanProvider.deleteTask(task.external_id)
          )
        } catch (providerError) {
          console.warn('Failed to delete task from provider:', providerError)
        }
      }

      // Delete local task if it's not provider-only
      if (!task.provider_id) {
        await invoke('delete_task', { taskId })
      }

      setTasks(prev => prev.filter(t => t.id !== taskId))

    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [tasks, currentProvider])

  // Handle drag end with provider sync
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

  // Manual sync with provider
  const handleManualSync = useCallback(async () => {
    if (!currentProvider || !selectedBoard) return

    try {
      setSyncStatus('syncing')
      await loadTasksFromProvider(currentProvider, selectedBoard.id)
    } catch (error) {
      console.error('Manual sync failed:', error)
      setSyncStatus('error')
    }
  }, [currentProvider, selectedBoard])

  // Switch provider
  const switchProvider = useCallback(async (providerId) => {
    try {
      const provider = providerManager.registry.getProvider(providerId)
      if (provider) {
        await setActiveProvider(provider)
      }
    } catch (error) {
      console.error('Failed to switch provider:', error)
      setError(`Failed to switch provider: ${error.message}`)
    }
  }, [])

  // Group tasks by status
  const tasksByStatus = Object.keys(TASK_COLUMNS).reduce((acc, status) => {
    acc[status] = tasks.filter(task => task.status === status)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-app-muted">Loading enhanced kanban board...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-600 mb-2">{error}</div>
        <button
          onClick={() => {
            setError(null)
            loadLocalTasks()
          }}
          className="px-3 py-1 text-xs rounded border border-app-border hover:bg-app-hover"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Header with Provider Controls */}
      <div className="p-4 border-b border-app-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-app-text">Enhanced Task Board</h2>
          <div className="flex items-center gap-2">
            {/* Provider Status */}
            {enableProviderSync && (
              <div className="flex items-center gap-2 text-sm">
                {currentProvider ? (
                  <>
                    <Cloud className="w-4 h-4 text-blue-500" />
                    <span className="text-app-muted">
                      {currentProvider.config.name || currentProvider.id}
                    </span>
                    {syncStatus === 'synced' && <Wifi className="w-4 h-4 text-green-500" />}
                    {syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />}
                    {syncStatus === 'error' && <WifiOff className="w-4 h-4 text-red-500" />}
                  </>
                ) : (
                  <span className="text-app-muted">Local only</span>
                )}
              </div>
            )}

            {/* Provider Controls */}
            {enableProviderSync && (
              <>
                <button
                  onClick={() => setShowProviderSettings(!showProviderSettings)}
                  className="p-1 rounded hover:bg-app-hover"
                  title="Provider settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {currentProvider && (
                  <button
                    onClick={handleManualSync}
                    className="p-1 rounded hover:bg-app-hover"
                    title="Manual sync"
                    disabled={syncStatus === 'syncing'}
                  >
                    <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </>
            )}

            {/* Task Count */}
            <span className="text-xs text-app-muted">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
            
            <button
              onClick={loadLocalTasks}
              className="px-2 py-1 text-xs rounded border border-app-border hover:bg-app-hover"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Provider Settings Panel */}
        {showProviderSettings && (
          <div className="mt-4 p-3 bg-app-hover rounded border">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={currentProvider?.id || ''}
                  onChange={(e) => e.target.value ? switchProvider(e.target.value) : setCurrentProvider(null)}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value="">Local only</option>
                  {availableProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.config.name || provider.id}
                    </option>
                  ))}
                </select>
              </div>

              {providerBoards.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Board</label>
                  <select
                    value={selectedBoard?.id || ''}
                    onChange={(e) => {
                      const board = providerBoards.find(b => b.id === e.target.value)
                      setSelectedBoard(board)
                      if (board && currentProvider) {
                        loadTasksFromProvider(currentProvider, board.id)
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="">Select board</option>
                    {providerBoards.map(board => (
                      <option key={board.id} value={board.id}>
                        {board.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-4 min-h-full">
            {Object.values(TASK_COLUMNS).map(column => (
              <EnhancedKanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.status] || []}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                onAddTask={handleAddTask}
                providerInfo={currentProvider ? {
                  id: currentProvider.id,
                  name: currentProvider.config.name || currentProvider.id
                } : null}
                syncStatus={syncStatus}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}