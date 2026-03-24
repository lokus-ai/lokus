import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  ExternalLink,
  RefreshCw,
  Square,
  TriangleAlert,
} from 'lucide-react';
import { endOfWeek, format, isSameDay, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { useCalendarContext } from '../../contexts/CalendarContext.jsx';
import { taskManager } from '../../core/tasks/manager.js';
import { parseTasksFromContent } from '../../core/tasks/parser.js';
import calendarService from '../../services/calendar.js';
import { useViewStore } from '../../stores/views';
import { getFilename } from '../../utils/pathUtils.js';
import { buildAgendaSections, getAgendaItemDate } from './agenda-utils.js';

const DEFAULT_EXPANDED_SECTIONS = {
  today: true,
  tomorrow: true,
  thisWeek: false,
  overdue: true,
};

const KANBAN_UPDATED_EVENT = 'lokus:kanban-updated';
const CALENDAR_UPDATED_EVENT = 'lokus:calendar-events-updated';
const TASKS_UPDATED_EVENT = 'lokus:tasks-updated';
const COMPLETION_COLUMN_PATTERN = /\b(done|completed?|closed|finished|archive[sd]?)\b/i;

function isCompletionColumn(columnName) {
  return COMPLETION_COLUMN_PATTERN.test((columnName || '').trim());
}

function findCompletionColumn(columns) {
  return Object.entries(columns || {}).find(([, column]) =>
    isCompletionColumn(column?.name),
  )?.[0] ?? null;
}

function parseExplicitDueDate(text) {
  if (!text) return null;

  const isoMatch = text.match(
    /\b(?:due|deadline|by)(?:\s*::?|\s+)(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?\b/i,
  );
  if (isoMatch) {
    const [, datePart, timePart] = isoMatch;
    const parsed = new Date(timePart ? `${datePart}T${timePart}` : `${datePart}T00:00:00`);

    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: parsed,
        isAllDay: !timePart,
      };
    }
  }

  const timeOnlyMatch = text.match(/\b(?:due|deadline|by)(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeOnlyMatch) {
    const [, hoursPart, minutesPart = '00', meridiem] = timeOnlyMatch;
    const parsed = new Date();
    let hours = parseInt(hoursPart, 10) % 12;

    if (meridiem.toLowerCase() === 'pm') {
      hours += 12;
    }

    parsed.setHours(hours, parseInt(minutesPart, 10), 0, 0);
    return {
      date: parsed,
      isAllDay: false,
    };
  }

  return null;
}

function extractDueMetadata(text) {
  const explicit = parseExplicitDueDate(text);
  if (explicit) {
    return explicit;
  }

  if (!text) {
    return null;
  }

  const parsedTasks = parseTasksFromContent(text);
  const taskWithDeadline = parsedTasks.find((task) => task.due_date);
  const parsedDateValue = taskWithDeadline?.due_date
    ? new Date(taskWithDeadline.due_date)
    : taskWithDeadline?.metadata?.deadline?.parsed_date;
  const parsedDate =
    parsedDateValue instanceof Date ? parsedDateValue : new Date(parsedDateValue);

  if (!parsedDateValue || Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    date: parsedDate,
    isAllDay: Boolean(taskWithDeadline?.due_date_is_all_day ?? true),
  };
}

function getStoredTaskDueMetadata(task) {
  if (!task?.due_date) {
    return null;
  }

  const date = new Date(task.due_date);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    isAllDay: Boolean(task.due_date_is_all_day),
  };
}

function getTaskLine(task, noteContents) {
  if (!task.note_path || !task.note_position) {
    return null;
  }

  const content = noteContents.get(task.note_path);
  if (!content) {
    return null;
  }

  const lines = content.split(/\r?\n/);
  return lines[task.note_position - 1] || null;
}

function formatEventTime(item) {
  const start = getAgendaItemDate(item);
  if (!start) {
    return '';
  }

  if (item.isAllDay) {
    return 'All day';
  }

  return format(start, 'h:mm a');
}

function formatTaskDueLabel(item) {
  const dueDate = getAgendaItemDate(item);
  if (!dueDate) {
    return '';
  }

  if (item.isAllDay) {
    return `Due ${format(dueDate, 'MMM d')}`;
  }

  return isSameDay(dueDate, new Date())
    ? `Due ${format(dueDate, 'h:mm a')}`
    : `Due ${format(dueDate, 'MMM d, h:mm a')}`;
}

function emitKanbanUpdated(boardPath = null) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(KANBAN_UPDATED_EVENT, {
      detail: { boardPath },
    }),
  );
}

function EventRow({ item, onOpen }) {
  return (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span
          className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: item.calendarColor || 'rgb(var(--accent))' }}
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-app-text">{item.title}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-app-muted">
            <Clock className="h-3 w-3" />
            <span>{formatEventTime(item)}</span>
            {item.calendarName && <span className="truncate">{item.calendarName}</span>}
          </div>
        </div>
      </button>

      {item.event?.html_link && (
        <button
          type="button"
          onClick={() => {
            window.open(item.event.html_link, '_blank', 'noopener,noreferrer');
          }}
          className="rounded p-1 text-app-muted opacity-0 transition-opacity hover:bg-white/10 hover:text-app-text group-hover:opacity-100"
          title="Open in calendar provider"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function TaskRow({ item, onOpen, onComplete }) {
  const dueDate = getAgendaItemDate(item);
  const overdue = dueDate && dueDate < new Date() && !item.isAllDay;

  return (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors">
      <button
        type="button"
        onClick={() => onComplete(item)}
        disabled={item.canComplete === false}
        className="mt-0.5 rounded text-app-muted transition-colors hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
        title={item.canComplete === false ? 'Open the task source to complete it' : 'Complete task'}
      >
        {item.canComplete === false ? (
          <Square className="h-4 w-4" />
        ) : (
          <CheckSquare className="h-4 w-4" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 text-left"
      >
        <div className={`truncate text-sm font-medium ${overdue ? 'text-red-400' : 'text-app-text'}`}>
          {item.title}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-app-muted">
          <Clock className="h-3 w-3" />
          <span>{formatTaskDueLabel(item)}</span>
          {item.sourceLabel && <span className="truncate">{item.sourceLabel}</span>}
        </div>
      </button>
    </div>
  );
}

function Section({ section, expanded, onToggle, onOpenEvent, onOpenTask, onCompleteTask }) {
  return (
    <section className="border-b border-app-border last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(section.key)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`h-3.5 w-3.5 text-app-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <span className={`text-xs font-semibold uppercase tracking-wide ${
            section.key === 'overdue' ? 'text-amber-400' : 'text-app-text'
          }`}>
            {section.title}
          </span>
        </div>

        <span className="text-[11px] text-app-muted">
          {section.count} item{section.count === 1 ? '' : 's'}
        </span>
      </button>

      {expanded && (
        <div className="pb-2">
          {section.dayGroups.map((group) => (
            <div key={group.key}>
              {(section.key === 'thisWeek' || section.key === 'overdue') && (
                <div className="px-3 py-1 text-[11px] font-medium text-app-muted">
                  {group.label}
                </div>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) =>
                  item.kind === 'event' ? (
                    <EventRow key={item.id} item={item} onOpen={onOpenEvent} />
                  ) : (
                    <TaskRow
                      key={item.id}
                      item={item}
                      onOpen={onOpenTask}
                      onComplete={onCompleteTask}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AgendaPanel({ workspacePath, onFileOpen, onOpenCalendarView }) {
  const {
    calendars,
    isAuthenticated,
    syncInProgress,
    triggerSync,
  } = useCalendarContext();
  const switchView = useViewStore((state) => state.switchView);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(DEFAULT_EXPANDED_SECTIONS);
  const loadRequestRef = useRef(0);

  const calendarsById = useMemo(
    () => new Map((calendars || []).map((calendar) => [calendar.id, calendar])),
    [calendars],
  );

  const loadStoredTaskItems = useCallback(async () => {
    const tasks = await taskManager.getAllTasks(true);
    const activeTasks = (tasks || []).filter(
      (task) => task.status !== 'completed' && task.status !== 'cancelled',
    );

    if (activeTasks.length === 0) {
      return [];
    }

    const tasksMissingStoredDue = activeTasks.filter((task) => !getStoredTaskDueMetadata(task));
    const notePaths = [...new Set(tasksMissingStoredDue.map((task) => task.note_path).filter(Boolean))];
    const noteContents = new Map(
      await Promise.all(
        notePaths.map(async (path) => {
          try {
            return [path, await invoke('read_file_content', { path })];
          } catch {
            return [path, null];
          }
        }),
      ),
    );

    const backfillPromises = [];
    const items = activeTasks
      .map((task) => {
        const storedDueMetadata = getStoredTaskDueMetadata(task);
        const noteLine = storedDueMetadata ? null : getTaskLine(task, noteContents);
        const dueMetadata =
          storedDueMetadata ||
          extractDueMetadata(noteLine) ||
          extractDueMetadata(task.description) ||
          extractDueMetadata(task.title);

        if (!dueMetadata?.date || Number.isNaN(dueMetadata.date.getTime())) {
          return null;
        }

        if (!storedDueMetadata) {
          backfillPromises.push(
            taskManager.updateTask(task.id, {
              dueDate: dueMetadata.date.toISOString(),
              dueDateIsAllDay: dueMetadata.isAllDay,
            }),
          );
        }

        return {
          id: `task:${task.id}`,
          kind: 'task',
          source: 'task',
          title: task.title,
          dueAt: dueMetadata.date.toISOString(),
          isAllDay: dueMetadata.isAllDay,
          task,
          notePath: task.note_path,
          notePosition: task.note_position,
          sourceLabel: task.note_path ? getFilename(task.note_path) : 'Task',
          canComplete: true,
        };
      })
      .filter(Boolean);

    if (backfillPromises.length > 0) {
      void Promise.allSettled(backfillPromises);
    }

    return items;
  }, []);

  const loadKanbanTaskItems = useCallback(async () => {
    if (!workspacePath) {
      return [];
    }

    const boardInfos = await invoke('list_kanban_boards', { workspacePath });
    const boardEntries = await Promise.all(
      (boardInfos || []).map(async (info) => {
        try {
          const board = await invoke('open_kanban_board', { filePath: info.path });
          return { info, board };
        } catch {
          return null;
        }
      }),
    );

    const items = [];

    for (const entry of boardEntries) {
      if (!entry?.board?.columns) {
        continue;
      }

      const completionColumnId = findCompletionColumn(entry.board.columns);

      for (const [columnId, column] of Object.entries(entry.board.columns)) {
        if (isCompletionColumn(column?.name)) {
          continue;
        }

        for (const card of column?.cards || []) {
          if (!card?.due_date) {
            continue;
          }

          const dueDate = new Date(card.due_date);
          if (Number.isNaN(dueDate.getTime())) {
            continue;
          }

          items.push({
            id: `kanban:${entry.info.path}:${card.id}`,
            kind: 'task',
            source: 'kanban',
            title: card.title || 'Untitled',
            dueAt: dueDate.toISOString(),
            isAllDay: !card.due_date.includes('T'),
            sourceLabel: entry.board.name || entry.info.name,
            boardPath: entry.info.path,
            boardName: entry.board.name || entry.info.name,
            boardFileName: getFilename(entry.info.path),
            currentColumnId: columnId,
            completionColumnId,
            canComplete: Boolean(completionColumnId),
            card,
          });
        }
      }
    }

    return items;
  }, [workspacePath]);

  const loadEventItems = useCallback(async () => {
    if (!isAuthenticated) {
      return [];
    }

    const rangeStart = startOfDay(new Date());
    const rangeEnd = endOfWeek(new Date());
    const events = await calendarService.events.getAllEvents(rangeStart, rangeEnd);

    return (events || [])
      .map((event) => {
        const start = new Date(event.start);
        if (Number.isNaN(start.getTime())) {
          return null;
        }

        const calendar = calendarsById.get(event.calendar_id);

        return {
          id: `event:${event.id}`,
          kind: 'event',
          title: event.title || 'Untitled event',
          start: event.start,
          isAllDay: event.all_day,
          calendarColor: calendar?.color || 'rgb(var(--accent))',
          calendarName: calendar?.name || 'Calendar',
          event,
        };
      })
      .filter(Boolean);
  }, [calendarsById, isAuthenticated]);

  const loadAgenda = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++loadRequestRef.current;

    if (!silent) {
      setLoading(true);
    }

    const results = await Promise.allSettled([
      loadEventItems(),
      loadStoredTaskItems(),
      loadKanbanTaskItems(),
    ]);

    if (requestId !== loadRequestRef.current) {
      return;
    }

    const nextItems = results
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value);
    const failedResult = results.find((result) => result.status === 'rejected');

    setItems(nextItems);
    setError(failedResult ? 'Some agenda sources could not be loaded.' : null);
    setLoading(false);
  }, [loadEventItems, loadKanbanTaskItems, loadStoredTaskItems]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    let removeCalendarListener = null;

    const removeTaskListener = taskManager.addListener(() => {
      loadAgenda({ silent: true });
    });

    const handleKanbanUpdated = () => {
      loadAgenda({ silent: true });
    };
    const handleCalendarUpdated = () => {
      loadAgenda({ silent: true });
    };
    const handleTasksUpdated = () => {
      loadAgenda({ silent: true });
    };
    const handleWindowFocus = () => {
      loadAgenda({ silent: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAgenda({ silent: true });
      }
    };

    window.addEventListener(KANBAN_UPDATED_EVENT, handleKanbanUpdated);
    window.addEventListener(CALENDAR_UPDATED_EVENT, handleCalendarUpdated);
    window.addEventListener(TASKS_UPDATED_EVENT, handleTasksUpdated);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const refreshTimer = window.setInterval(() => {
      loadAgenda({ silent: true });
    }, 60000);

    calendarService.listeners.onSyncComplete(() => {
      loadAgenda({ silent: true });
    }).then((unsubscribe) => {
      removeCalendarListener = unsubscribe;
    }).catch(() => {});

    return () => {
      removeTaskListener();
      removeCalendarListener?.();
      window.clearInterval(refreshTimer);
      window.removeEventListener(KANBAN_UPDATED_EVENT, handleKanbanUpdated);
      window.removeEventListener(CALENDAR_UPDATED_EVENT, handleCalendarUpdated);
      window.removeEventListener(TASKS_UPDATED_EVENT, handleTasksUpdated);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadAgenda]);

  const sections = useMemo(() => buildAgendaSections(items, new Date()), [items]);

  const toggleSection = useCallback((sectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }, []);

  const handleOpenEvent = useCallback((item) => {
    onOpenCalendarView?.({
      date: item.start,
      eventId: item.event.id,
    });
  }, [onOpenCalendarView]);

  const handleOpenTask = useCallback((item) => {
    switchView('editor');

    if (item.source === 'kanban' && item.boardPath) {
      onFileOpen?.({
        path: item.boardPath,
        name: item.boardFileName || getFilename(item.boardPath),
        is_directory: false,
      });
      return;
    }

    if (item.notePath) {
      onFileOpen?.({
        path: item.notePath,
        lineNumber: item.notePosition || undefined,
        column: 0,
      });
      return;
    }

    if (item.task?.kanban_board) {
      onFileOpen?.({
        path: item.task.kanban_board,
        name: getFilename(item.task.kanban_board),
        is_directory: false,
      });
    }
  }, [onFileOpen, switchView]);

  const handleCompleteTask = useCallback(async (item) => {
    try {
      if (item.source === 'kanban') {
        if (!item.completionColumnId) {
          toast.error('No completed column found for this board');
          return;
        }

        await invoke('move_card_between_columns', {
          boardPath: item.boardPath,
          cardId: item.card.id,
          fromColumn: item.currentColumnId,
          toColumn: item.completionColumnId,
        });

        emitKanbanUpdated(item.boardPath);
        toast.success('Task completed', { description: item.title });
      } else if (item.task?.id) {
        await taskManager.updateTask(item.task.id, { status: 'completed' });
        toast.success('Task completed', { description: item.title });
      }

      await loadAgenda({ silent: true });
    } catch (taskError) {
      console.error('Failed to complete agenda task:', taskError);
      toast.error('Failed to complete task');
    }
  }, [loadAgenda]);

  const handleRefresh = useCallback(async () => {
    try {
      if (isAuthenticated) {
        await triggerSync();
      }
    } catch {
      // Fall back to a direct refresh below.
    }

    await loadAgenda();
  }, [isAuthenticated, loadAgenda, triggerSync]);

  return (
    <div className="flex h-full flex-col bg-app-panel">
      <div className="border-b border-app-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-app-accent" />
            <h2 className="text-sm font-semibold text-app-text">Agenda</h2>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="rounded p-1 text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
            title="Refresh agenda"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || syncInProgress ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="mt-1 text-[11px] text-app-muted">
          Events and due tasks, grouped by what needs attention first.
        </p>
      </div>

      {error && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-app-muted">
            Loading agenda…
          </div>
        ) : sections.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-app-muted/40" />
            <div className="text-sm font-medium text-app-text">Nothing due right now</div>
            <div className="mt-1 text-xs text-app-muted">
              Connect a calendar or add due dates to tasks to populate the agenda.
            </div>
          </div>
        ) : (
          <div className="py-2">
            {sections.map((section) => (
              <Section
                key={section.key}
                section={section}
                expanded={expandedSections[section.key] ?? DEFAULT_EXPANDED_SECTIONS[section.key] ?? true}
                onToggle={toggleSection}
                onOpenEvent={handleOpenEvent}
                onOpenTask={handleOpenTask}
                onCompleteTask={handleCompleteTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
