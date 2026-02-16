import React, { useState, useCallback, useRef } from 'react';
import {
  Circle,
  CircleDot,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ListTodo,
  GripVertical,
  Trash2,
  ExternalLink,
  CheckSquare
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

/**
 * Status color mapping - reuses existing --task-* design tokens
 */
const STATUS_COLORS = {
  'todo': { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgb(107, 114, 128)', text: 'rgb(107, 114, 128)' },
  'in-progress': { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgb(59, 130, 246)', text: 'rgb(59, 130, 246)' },
  'urgent': { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgb(239, 68, 68)', text: 'rgb(239, 68, 68)' },
  'needs-info': { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgb(245, 158, 11)', text: 'rgb(245, 158, 11)' },
  'completed': { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgb(16, 185, 129)', text: 'rgb(16, 185, 129)' },
  'cancelled': { bg: 'rgba(107, 114, 128, 0.10)', border: 'rgb(107, 114, 128)', text: 'rgb(107, 114, 128)' },
  'delegated': { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgb(139, 92, 246)', text: 'rgb(139, 92, 246)' },
};

const STATUS_ICONS = {
  'todo': Circle,
  'in-progress': CircleDot,
  'urgent': AlertCircle,
  'needs-info': HelpCircle,
  'completed': CheckCircle2,
  'cancelled': XCircle,
  'delegated': ArrowRight,
};

/**
 * Schedule Block Component
 *
 * Renders a task time block on the calendar time grid.
 * Supports drag to move, resize via bottom edge, and context menu.
 */
export default function ScheduleBlockComponent({
  block,
  task,
  startHour,
  hourHeight,
  onMoveStart,
  onResizeEnd,
  onContextMenu,
  onClick,
  onDoubleClick,
  isDragging,
  dragOffset,
  overlappingIndex = 0,
  style: extraStyle = {}
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeOriginalHeight, setResizeOriginalHeight] = useState(0);
  const [currentResizeHeight, setCurrentResizeHeight] = useState(null);
  const blockRef = useRef(null);

  const colors = STATUS_COLORS[task?.status] || STATUS_COLORS['todo'];
  const StatusIcon = STATUS_ICONS[task?.status] || Circle;

  // Calculate position from block times
  const blockStart = parseISO(block.start);
  const blockEnd = parseISO(block.end);
  const startHourVal = blockStart.getHours() + blockStart.getMinutes() / 60;
  const endHourVal = blockEnd.getHours() + blockEnd.getMinutes() / 60;

  // Clamp to visible range
  const visibleStart = Math.max(startHourVal, startHour);
  const visibleEnd = Math.min(endHourVal, startHour + 24);

  const top = (visibleStart - startHour) * hourHeight;
  const height = Math.max((visibleEnd - visibleStart) * hourHeight, 24);

  // Resize handlers
  const handleResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStartY(e.clientY);
    setResizeOriginalHeight(height);
    setCurrentResizeHeight(height);

    const handleMouseMove = (moveE) => {
      const delta = moveE.clientY - e.clientY;
      const newHeight = Math.max(hourHeight / 4, resizeOriginalHeight + delta);
      setCurrentResizeHeight(newHeight);
    };

    const handleMouseUp = (upE) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);

      const delta = upE.clientY - e.clientY;
      const newHeight = Math.max(hourHeight / 4, height + delta);
      // Convert height change to hours and snap to 15 min
      const durationHours = newHeight / hourHeight;
      const snappedDuration = Math.round(durationHours * 4) / 4;
      const newEndHourVal = visibleStart + Math.max(0.25, snappedDuration);

      // Build new end time
      const newEndHours = Math.floor(newEndHourVal);
      const newEndMinutes = Math.round((newEndHourVal - newEndHours) * 60);
      const newEnd = new Date(blockStart);
      newEnd.setHours(newEndHours, newEndMinutes, 0, 0);

      onResizeEnd?.(block.id, newEnd.toISOString());
      setCurrentResizeHeight(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [block.id, height, hourHeight, visibleStart, blockStart, onResizeEnd]);

  const displayHeight = currentResizeHeight !== null ? currentResizeHeight : height;
  const isCompact = displayHeight < 40;

  return (
    <div
      ref={blockRef}
      className={`
        group absolute rounded-r px-1.5 py-1 overflow-hidden select-none
        ${isDragging ? 'opacity-70 scale-[1.02] ring-2 ring-app-accent shadow-lg pointer-events-none z-50' : 'cursor-pointer hover:brightness-110 transition-all z-20'}
        ${isResizing ? 'z-50' : ''}
      `}
      style={{
        top: `${top}px`,
        height: `${displayHeight}px`,
        left: `${overlappingIndex * 20}%`,
        right: '4px',
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        transform: isDragging && dragOffset
          ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
          : undefined,
        ...extraStyle
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(block, task);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(block, task);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onContextMenu?.(e, block, task);
      }}
      title={`${task?.title || 'Task'} — ${format(blockStart, 'h:mm a')} - ${format(blockEnd, 'h:mm a')}`}
    >
      {/* Content */}
      <div className="flex items-start gap-1 h-full">
        {/* Drag handle */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onMoveStart?.(block, task, e);
          }}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical className="w-3 h-3" style={{ color: colors.text }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-1">
            <ListTodo size={10} style={{ color: colors.text }} className="flex-shrink-0" />
            <span
              className="text-xs font-medium truncate"
              style={{ color: colors.text }}
            >
              {task?.title || 'Unknown Task'}
            </span>
          </div>

          {/* Time - only if not compact */}
          {!isCompact && (
            <div className="text-[10px] opacity-70 mt-0.5" style={{ color: colors.text }}>
              {format(blockStart, 'h:mm a')} - {format(blockEnd, 'h:mm a')}
            </div>
          )}

          {/* Status badge - only if enough space */}
          {displayHeight >= 56 && (
            <div className="flex items-center gap-1 mt-1">
              <StatusIcon size={10} style={{ color: colors.text }} />
              <span className="text-[10px] opacity-60" style={{ color: colors.text }}>
                {task?.status?.replace('-', ' ') || 'todo'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Resize handle at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      >
        <div
          className="mx-auto w-8 h-1 rounded-full mt-0.5"
          style={{ backgroundColor: colors.border }}
        />
      </div>
    </div>
  );
}

/**
 * Context menu for schedule blocks
 */
export function ScheduleBlockContextMenu({
  x,
  y,
  block,
  task,
  onClose,
  onDelete,
  onMarkComplete,
  onOpenNote
}) {
  const colors = STATUS_COLORS[task?.status] || STATUS_COLORS['todo'];

  const menuItems = [
    ...(task?.note_path ? [{
      icon: ExternalLink,
      label: 'Open linked note',
      action: () => { onOpenNote?.(task.note_path); onClose(); }
    }] : []),
    ...(task?.status !== 'completed' ? [{
      icon: CheckSquare,
      label: 'Mark task complete',
      action: () => { onMarkComplete?.(block, task); onClose(); }
    }] : []),
    {
      icon: Trash2,
      label: 'Remove from calendar',
      action: () => { onDelete?.(block.id); onClose(); },
      danger: true
    }
  ];

  return (
    <div
      className="fixed z-[9999] bg-app-panel border border-app-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-app-border">
        <div className="text-xs font-medium text-app-text truncate max-w-[200px]">
          {task?.title || 'Task'}
        </div>
        <div className="text-[10px] text-app-muted mt-0.5">
          {block ? `${format(parseISO(block.start), 'h:mm a')} - ${format(parseISO(block.end), 'h:mm a')}` : ''}
        </div>
      </div>

      {/* Menu items */}
      {menuItems.map((item, idx) => (
        <button
          key={idx}
          onClick={item.action}
          className={`
            w-full flex items-center gap-2 px-3 py-1.5 text-xs
            ${item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-app-text hover:bg-white/5'}
            transition-colors duration-100
          `}
        >
          <item.icon size={13} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
