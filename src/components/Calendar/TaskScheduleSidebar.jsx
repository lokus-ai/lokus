import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  ListTodo,
  Search,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  GripVertical,
  Clock
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Status icon mapping - matches existing task status design tokens
 */
const STATUS_CONFIG = {
  'todo': { icon: Circle, color: 'rgb(107, 114, 128)', label: 'Todo' },
  'in-progress': { icon: CircleDot, color: 'rgb(59, 130, 246)', label: 'In Progress' },
  'urgent': { icon: AlertCircle, color: 'rgb(239, 68, 68)', label: 'Urgent' },
  'needs-info': { icon: HelpCircle, color: 'rgb(245, 158, 11)', label: 'Needs Info' },
  'completed': { icon: CheckCircle2, color: 'rgb(16, 185, 129)', label: 'Completed' },
  'cancelled': { icon: XCircle, color: 'rgb(107, 114, 128)', label: 'Cancelled' },
  'delegated': { icon: ArrowRight, color: 'rgb(139, 92, 246)', label: 'Delegated' },
};

/**
 * Draggable task card for the sidebar
 */
function DraggableTaskCard({ task, scheduledBlockCount }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task: task
    }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG['todo'];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-start gap-2 px-2.5 py-2 rounded-md
        border border-transparent
        hover:bg-white/5 hover:border-app-border
        cursor-grab active:cursor-grabbing
        transition-colors duration-150
        ${isDragging ? 'z-50 shadow-lg bg-app-panel border-app-accent/30' : ''}
      `}
      {...listeners}
      {...attributes}
    >
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon
          size={14}
          style={{ color: statusConfig.color }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-app-text truncate leading-tight">
          {task.title}
        </div>
        {scheduledBlockCount > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={10} className="text-app-muted" />
            <span className="text-[10px] text-app-muted">
              {scheduledBlockCount} block{scheduledBlockCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical size={12} className="text-app-muted" />
      </div>
    </div>
  );
}

/**
 * Task Schedule Sidebar
 *
 * Shows a list of tasks that can be dragged onto the calendar time grid.
 * Only visible in week and day views.
 */
export default function TaskScheduleSidebar({ isOpen, onToggle, scheduleBlocks }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('unscheduled'); // 'unscheduled', 'all', 'active'
  const searchInputRef = useRef(null);

  // Load tasks from backend
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const allTasks = await invoke('get_all_tasks');
      setTasks(allTasks || []);
    } catch (err) {
      console.error('Failed to load tasks for sidebar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen, loadTasks]);

  // Build a set of task IDs that have schedule blocks
  const scheduledTaskIds = new Set(
    (scheduleBlocks || []).map(b => b.task_id)
  );

  // Count blocks per task
  const blockCountByTask = {};
  (scheduleBlocks || []).forEach(b => {
    blockCountByTask[b.task_id] = (blockCountByTask[b.task_id] || 0) + 1;
  });

  // Filter and search tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(q);
      const descMatch = task.description?.toLowerCase().includes(q);
      if (!titleMatch && !descMatch) return false;
    }

    // Mode filter
    if (filterMode === 'unscheduled') {
      // Show tasks that have no schedule blocks AND are not completed/cancelled
      return !scheduledTaskIds.has(task.id) &&
        task.status !== 'completed' &&
        task.status !== 'cancelled';
    }
    if (filterMode === 'active') {
      // Show all non-completed, non-cancelled tasks
      return task.status !== 'completed' && task.status !== 'cancelled';
    }
    // 'all' mode - show everything
    return true;
  });

  // Sort: urgent first, then by priority, then by creation date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'urgent' && b.status !== 'urgent') return -1;
    if (b.status === 'urgent' && a.status !== 'urgent') return 1;
    if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return (b.created_at || 0) - (a.created_at || 0);
  });

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-0 top-12 z-10 flex items-center gap-1 px-1.5 py-2 
          bg-app-panel border border-app-border rounded-r-md
          text-app-muted hover:text-app-text hover:bg-white/5
          transition-colors duration-150"
        title="Show task sidebar"
      >
        <ListTodo size={14} />
        <ChevronRight size={12} />
      </button>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 border-r border-app-border bg-app-panel flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-app-border">
        <div className="flex items-center gap-1.5">
          <ListTodo size={14} className="text-app-accent" />
          <span className="text-xs font-medium text-app-text">Tasks</span>
        </div>
        <button
          onClick={onToggle}
          className="p-0.5 rounded hover:bg-white/10 text-app-muted hover:text-app-text transition-colors"
          title="Hide task sidebar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-app-border">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-6 pr-2 py-1 text-xs bg-transparent border border-app-border 
              rounded text-app-text placeholder:text-app-muted
              focus:outline-none focus:border-app-accent/50
              transition-colors duration-150"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex px-2 py-1 gap-0.5 border-b border-app-border">
        {[
          { key: 'unscheduled', label: 'Unscheduled' },
          { key: 'active', label: 'Active' },
          { key: 'all', label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterMode(key)}
            className={`
              flex-1 px-1.5 py-0.5 text-[10px] rounded transition-colors duration-150
              ${filterMode === key
                ? 'bg-app-accent/15 text-app-accent font-medium'
                : 'text-app-muted hover:text-app-text hover:bg-white/5'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs text-app-muted animate-pulse">Loading tasks...</div>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
            <ListTodo size={24} className="text-app-muted/50 mb-2" />
            <div className="text-xs text-app-muted">
              {searchQuery
                ? 'No tasks match your search'
                : filterMode === 'unscheduled'
                  ? 'All tasks are scheduled!'
                  : 'No tasks found'}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedTasks.map(task => (
              <DraggableTaskCard
                key={task.id}
                task={task}
                scheduledBlockCount={blockCountByTask[task.id] || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-3 py-1.5 border-t border-app-border">
        <div className="text-[10px] text-app-muted">
          {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
          {filterMode === 'unscheduled' && ' unscheduled'}
        </div>
      </div>
    </div>
  );
}
