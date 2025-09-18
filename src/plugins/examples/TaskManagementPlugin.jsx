/**
 * TaskManagementPlugin.js - Advanced Task Management Panel
 * 
 * Provides comprehensive task management features including:
 * - Task lists with different statuses
 * - Priority levels and due dates
 * - Progress tracking and analytics
 * - Project organization
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { uiAPI, PANEL_POSITIONS, PANEL_TYPES } from '../api/UIAPI.js';
import { invoke } from '@tauri-apps/api/core';
import { 
  CheckSquare,
  Circle,
  Square,
  Clock,
  AlertCircle,
  Calendar,
  Filter,
  Plus,
  Search,
  BarChart3,
  Target,
  Flag,
  User,
  Tag,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

// Task status constants
const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const PRIORITY_LEVELS = {
  LOW: { id: 'low', label: 'Low', color: 'text-app-muted', icon: ArrowDown },
  MEDIUM: { id: 'medium', label: 'Medium', color: 'text-app-warning', icon: Minus },
  HIGH: { id: 'high', label: 'High', color: 'text-app-danger', icon: ArrowUp },
  URGENT: { id: 'urgent', label: 'Urgent', color: 'text-red-500', icon: AlertCircle }
};

// Task item component
const TaskItem = ({ task, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  const handleStatusChange = (newStatus) => {
    onUpdate(task.id, { ...task, status: newStatus, completedAt: newStatus === TASK_STATUS.COMPLETED ? new Date().toISOString() : null });
  };

  const handleSaveEdit = () => {
    if (editTitle.trim()) {
      onUpdate(task.id, { ...task, title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case TASK_STATUS.COMPLETED:
        return <CheckSquare className="w-4 h-4 text-app-success" />;
      case TASK_STATUS.IN_PROGRESS:
        return <Circle className="w-4 h-4 text-app-accent" />;
      case TASK_STATUS.CANCELLED:
        return <Square className="w-4 h-4 text-app-muted line-through" />;
      default:
        return <Square className="w-4 h-4 text-app-muted" />;
    }
  };

  const getPriorityInfo = () => {
    return PRIORITY_LEVELS[task.priority?.toUpperCase()] || PRIORITY_LEVELS.MEDIUM;
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TASK_STATUS.COMPLETED;

  return (
    <div className={`
      p-3 border border-app-border rounded bg-app-panel hover:bg-app-border/20 transition-colors
      ${isOverdue ? 'border-app-danger/50 bg-app-danger/5' : ''}
      ${task.status === TASK_STATUS.COMPLETED ? 'opacity-70' : ''}
    `}>
      <div className="flex items-start gap-3">
        {/* Status checkbox */}
        <button
          onClick={() => {
            const nextStatus = task.status === TASK_STATUS.COMPLETED ? TASK_STATUS.TODO : TASK_STATUS.COMPLETED;
            handleStatusChange(nextStatus);
          }}
          className="mt-0.5 hover:scale-110 transition-transform"
        >
          {getStatusIcon()}
        </button>

        {/* Task content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') {
                  setEditTitle(task.title);
                  setIsEditing(false);
                }
              }}
              className="w-full px-2 py-1 bg-app-bg border border-app-border rounded text-sm text-app-text focus:outline-none focus:border-app-accent"
              autoFocus
            />
          ) : (
            <h4
              onClick={() => setIsEditing(true)}
              className={`
                text-sm font-medium cursor-pointer hover:text-app-accent transition-colors
                ${task.status === TASK_STATUS.COMPLETED ? 'line-through text-app-muted' : 'text-app-text'}
              `}
            >
              {task.title}
            </h4>
          )}

          {/* Task metadata */}
          <div className="flex items-center gap-2 mt-2 text-xs text-app-muted">
            {/* Priority */}
            <div className="flex items-center gap-1">
              {React.createElement(getPriorityInfo().icon, { className: `w-3 h-3 ${getPriorityInfo().color}` })}
              <span className={getPriorityInfo().color}>{getPriorityInfo().label}</span>
            </div>

            {/* Due date */}
            {task.dueDate && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-app-danger' : ''}`}>
                <Calendar className="w-3 h-3" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                {isOverdue && <AlertCircle className="w-3 h-3" />}
              </div>
            )}

            {/* Project */}
            {task.project && (
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                <span>{task.project}</span>
              </div>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>{task.tags.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="mt-2 text-xs text-app-muted line-clamp-2">
              {task.description}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {task.status !== TASK_STATUS.COMPLETED && (
            <button
              onClick={() => handleStatusChange(
                task.status === TASK_STATUS.IN_PROGRESS ? TASK_STATUS.TODO : TASK_STATUS.IN_PROGRESS
              )}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-border/50 text-app-muted hover:text-app-accent transition-colors"
              title={task.status === TASK_STATUS.IN_PROGRESS ? 'Mark as todo' : 'Mark as in progress'}
            >
              <Clock className="w-3 h-3" />
            </button>
          )}
          
          <button
            onClick={() => onDelete(task.id)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-danger/20 text-app-muted hover:text-app-danger transition-colors"
            title="Delete task"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

// Task statistics component
const TaskStats = ({ tasks }) => {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length;
    const inProgress = tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length;
    const overdue = tasks.filter(t => 
      t.dueDate && 
      new Date(t.dueDate) < new Date() && 
      t.status !== TASK_STATUS.COMPLETED
    ).length;

    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [tasks]);

  return (
    <div className="grid grid-cols-2 gap-3 p-4 bg-app-panel/50 rounded">
      <div className="text-center">
        <div className="text-lg font-bold text-app-text">{stats.completed}</div>
        <div className="text-xs text-app-muted">Completed</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-app-accent">{stats.inProgress}</div>
        <div className="text-xs text-app-muted">In Progress</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-app-warning">{stats.overdue}</div>
        <div className="text-xs text-app-muted">Overdue</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-app-success">{stats.completionRate}%</div>
        <div className="text-xs text-app-muted">Complete</div>
      </div>
    </div>
  );
};

// Main Task Management Panel
const TaskManagementPanel = ({ panel }) => {
  const [tasks, setTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Load tasks from localStorage
  useEffect(() => {
    loadTasks();
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    saveTasks();
  }, [tasks]);

  const loadTasks = () => {
    try {
      const saved = localStorage.getItem('lokus-task-management-tasks');
      if (saved) {
        setTasks(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const saveTasks = () => {
    try {
      localStorage.setItem('lokus-task-management-tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  const addTask = useCallback((title) => {
    if (!title.trim()) return;

    const newTask = {
      id: Date.now().toString(),
      title: title.trim(),
      status: TASK_STATUS.TODO,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      description: '',
      tags: [],
      project: '',
      dueDate: null
    };

    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle('');
    setShowAddForm(false);
  }, []);

  const updateTask = useCallback((id, updatedTask) => {
    setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  }, []);

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(task => task.status === activeFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.project.toLowerCase().includes(query) ||
        task.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [tasks, activeFilter, searchQuery]);

  const filterOptions = [
    { id: 'all', label: 'All Tasks', count: tasks.length },
    { id: TASK_STATUS.TODO, label: 'To Do', count: tasks.filter(t => t.status === TASK_STATUS.TODO).length },
    { id: TASK_STATUS.IN_PROGRESS, label: 'In Progress', count: tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length },
    { id: TASK_STATUS.COMPLETED, label: 'Completed', count: tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length },
  ];

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="p-4 border-b border-app-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-app-text">Task Management</h2>
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-border/50 text-app-muted hover:text-app-text transition-colors"
            title="Toggle statistics"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>

        {/* Statistics */}
        {showStats && <TaskStats tasks={tasks} />}

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-app-bg border border-app-border rounded text-sm text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
          />
        </div>

        {/* Add task */}
        {showAddForm ? (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Enter task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask(newTaskTitle);
                if (e.key === 'Escape') {
                  setShowAddForm(false);
                  setNewTaskTitle('');
                }
              }}
              className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded text-sm text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
              autoFocus
            />
            <button
              onClick={() => addTask(newTaskTitle)}
              className="px-3 py-2 bg-app-accent text-app-accent-fg rounded text-sm hover:bg-app-accent/80 transition-colors"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full mt-3 px-3 py-2 border border-dashed border-app-border rounded text-sm text-app-muted hover:text-app-text hover:border-app-accent transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add new task
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-app-border">
        {filterOptions.map(option => (
          <button
            key={option.id}
            onClick={() => setActiveFilter(option.id)}
            className={`
              flex-1 px-3 py-2 text-sm border-r border-app-border transition-colors last:border-r-0
              ${activeFilter === option.id 
                ? 'bg-app-accent text-app-accent-fg' 
                : 'text-app-muted hover:text-app-text hover:bg-app-border/50'
              }
            `}
          >
            <div>{option.label}</div>
            <div className="text-xs opacity-75">{option.count}</div>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-app-muted">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery ? 'No tasks match your search' : 'No tasks yet'}
            </p>
            {!searchQuery && (
              <p className="text-xs mt-1">Add your first task to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={updateTask}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Plugin definition
export const TaskManagementPlugin = {
  id: 'task-management',
  name: 'Task Management',
  version: '1.0.0',
  description: 'Advanced task management with priorities, due dates, and project organization',
  author: 'Lokus Team',

  activate() {
    console.log('✅ Activating Task Management Plugin...');
    
    try {
      // Register the task management panel
      const panel = uiAPI.registerPanel('task-management', {
        id: 'task-manager',
        title: 'Task Manager',
        type: PANEL_TYPES.REACT,
        position: PANEL_POSITIONS.SIDEBAR_RIGHT,
        component: TaskManagementPanel,
        icon: <CheckSquare className="w-4 h-4" />,
        initialSize: { width: 350, height: 600 },
        minSize: { width: 300, height: 400 },
        resizable: true,
        closable: true,
        visible: false,
        order: 30,
        settings: {
          showCompleted: true,
          defaultPriority: 'medium',
          sortBy: 'createdAt'
        }
      });

      // Register commands
      uiAPI.registerCommand('task-management', {
        id: 'toggle-task-manager',
        title: 'Toggle Task Manager',
        category: 'View',
        handler: () => {
          uiAPI.togglePanel('task-management.task-manager');
        }
      });

      uiAPI.registerCommand('task-management', {
        id: 'quick-add-task',
        title: 'Quick Add Task',
        category: 'Task',
        handler: () => {
          const title = window.prompt('Task title:');
          if (title) {
            // Add task through panel if visible, or show panel
            const panel = uiAPI.getPanel('task-management.task-manager');
            if (panel && panel.visible) {
              // Task would be added through panel
            } else {
              uiAPI.showPanel('task-management.task-manager');
            }
          }
        }
      });

      // Register status bar item with task count
      const updateTaskCount = () => {
        try {
          const saved = localStorage.getItem('lokus-task-management-tasks');
          const tasks = saved ? JSON.parse(saved) : [];
          const pendingCount = tasks.filter(t => t.status !== 'completed').length;
          
          const statusItem = uiAPI.statusBarItems.get('task-management.task-count');
          if (statusItem) {
            statusItem.updateText(`${pendingCount} tasks`);
          }
        } catch (error) {
          console.error('Failed to update task count:', error);
        }
      };

      uiAPI.registerStatusBarItem('task-management', {
        id: 'task-count',
        text: '0 tasks',
        tooltip: 'Pending tasks - Click to open task manager',
        command: 'task-management.toggle-task-manager',
        alignment: 'right',
        priority: 70
      });

      // Update task count periodically
      setInterval(updateTaskCount, 5000);
      updateTaskCount();

      console.log('✅ Task Management Plugin activated successfully');
      return panel;
      
    } catch (error) {
      console.error('❌ Failed to activate Task Management Plugin:', error);
      throw error;
    }
  },

  deactivate() {
    console.log('✅ Deactivating Task Management Plugin...');
    
    try {
      uiAPI.unregisterPlugin('task-management');
      console.log('✅ Task Management Plugin deactivated successfully');
    } catch (error) {
      console.error('❌ Failed to deactivate Task Management Plugin:', error);
      throw error;
    }
  }
};

export default TaskManagementPlugin;