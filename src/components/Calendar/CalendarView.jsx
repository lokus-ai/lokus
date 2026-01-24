import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Settings,
  Loader2,
  Grid3X3,
  List,
  LayoutGrid,
  X,
  Clock,
  MapPin,
  Users,
  ExternalLink,
  Edit3,
  Trash2,
  Copy,
  Eye,
  CalendarPlus,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO
} from 'date-fns';
import { useCalendarContext } from '../../contexts/CalendarContext.jsx';
import calendarService from '../../services/calendar.js';
import EventCard from './EventCard.jsx';

/**
 * Calendar View Component
 *
 * Full calendar view with month, week, and day views
 */
export default function CalendarView({ onClose, onOpenSettings }) {
  const {
    isAuthenticated,
    calendars,
    upcomingEvents,
    upcomingEventsLoading,
    eventsByDate,
    syncInProgress,
    triggerSync,
    connectGoogle,
    getVisibleCalendars,
    getWritableCalendars
  } = useCalendarContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewEvents, setViewEvents] = useState([]);
  const [viewEventsLoading, setViewEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEventData, setCreateEventData] = useState(null); // { date, startTime, endTime }

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, type, data }
  // type can be: 'event', 'timeSlot', 'dayCell', 'allDaySlot'
  // data contains relevant info: event object, date, hour, etc.

  // Drag state for event dragging (grip handle based)
  const [dragState, setDragState] = useState(null); // { event, isDragging, startX, startY, currentX, currentY }

  // ============== STATE-OF-THE-ART CACHING SYSTEM ==============
  // - Aggressive pre-fetching (3 months ahead/behind)
  // - Smart range merging to avoid redundant fetches
  // - In-place event updates (no full cache clears)
  // - Stale-while-revalidate pattern for instant UI

  const eventsCacheRef = useRef({
    events: new Map(),    // Map<eventId, event> for O(1) lookups
    fetchedRanges: [],    // Array of {start, end} ISO strings
    lastFullSync: null,   // Timestamp of last full sync
  });

  // Check if a date range is covered by cached ranges
  const isRangeCovered = useCallback((start, end) => {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return eventsCacheRef.current.fetchedRanges.some(range =>
      new Date(range.start).getTime() <= startTime &&
      new Date(range.end).getTime() >= endTime
    );
  }, []);

  // Get events from cache for a date range
  const getEventsFromCache = useCallback((start, end) => {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const events = [];
    eventsCacheRef.current.events.forEach(event => {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();
      // Include event if it overlaps with the range
      if (eventStart <= endTime && eventEnd >= startTime) {
        events.push(event);
      }
    });
    return events.sort((a, b) => new Date(a.start) - new Date(b.start));
  }, []);

  // Merge overlapping ranges to keep the list clean
  const mergeRanges = useCallback((ranges) => {
    if (ranges.length <= 1) return ranges;

    const sorted = [...ranges].sort((a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];
      const lastEnd = new Date(last.end).getTime();
      const currentStart = new Date(current.start).getTime();

      // If ranges overlap or are adjacent (within 1 day), merge them
      if (currentStart <= lastEnd + 86400000) {
        last.end = new Date(Math.max(lastEnd, new Date(current.end).getTime())).toISOString();
      } else {
        merged.push(current);
      }
    }
    return merged;
  }, []);

  // Add events to cache (smart merge)
  const addToCache = useCallback((events, start, end) => {
    // Update events map (upsert)
    events.forEach(event => {
      eventsCacheRef.current.events.set(event.id, event);
    });

    // Add and merge ranges
    eventsCacheRef.current.fetchedRanges.push({
      start: start.toISOString(),
      end: end.toISOString()
    });
    eventsCacheRef.current.fetchedRanges = mergeRanges(eventsCacheRef.current.fetchedRanges);
  }, [mergeRanges]);

  // Update a single event in cache (for optimistic updates)
  const updateEventInCache = useCallback((eventId, updatedEvent) => {
    if (updatedEvent) {
      eventsCacheRef.current.events.set(eventId, updatedEvent);
    } else {
      eventsCacheRef.current.events.delete(eventId);
    }
  }, []);

  // Soft cache invalidation - marks data as stale but keeps it for instant display
  const invalidateCache = useCallback(() => {
    eventsCacheRef.current.fetchedRanges = [];
    // Keep events for stale-while-revalidate
  }, []);

  // Full cache clear (only on disconnect/reconnect)
  const clearCache = useCallback(() => {
    eventsCacheRef.current = { events: new Map(), fetchedRanges: [], lastFullSync: null };
  }, []);

  // Calculate extended fetch range (pre-fetch 2 months ahead/behind)
  const getExtendedRange = useCallback((baseStart, baseEnd, viewMode) => {
    let start = new Date(baseStart);
    let end = new Date(baseEnd);

    if (viewMode === 'month') {
      // Fetch 2 months before and after
      start = subMonths(start, 2);
      end = addMonths(end, 2);
    } else if (viewMode === 'week') {
      // Fetch 4 weeks before and after
      start = subWeeks(start, 4);
      end = addWeeks(end, 4);
    } else {
      // Day view - fetch 2 weeks around
      start = subWeeks(start, 2);
      end = addWeeks(end, 2);
    }

    return { start, end };
  }, []);

  // Fetch events with smart caching
  useEffect(() => {
    const fetchEventsForView = async () => {
      if (!isAuthenticated) return;

      let viewStart, viewEnd;

      // Calculate current view range
      if (viewMode === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        viewStart = startOfWeek(monthStart);
        viewEnd = endOfWeek(monthEnd);
      } else if (viewMode === 'week') {
        viewStart = startOfWeek(currentDate);
        viewEnd = endOfWeek(currentDate);
      } else {
        viewStart = new Date(currentDate);
        viewStart.setHours(0, 0, 0, 0);
        viewEnd = new Date(currentDate);
        viewEnd.setHours(23, 59, 59, 999);
      }

      // INSTANT: Always show cached data first (stale-while-revalidate)
      const cachedEvents = getEventsFromCache(viewStart, viewEnd);
      if (cachedEvents.length > 0 || eventsCacheRef.current.events.size > 0) {
        setViewEvents(cachedEvents);
      }

      // Check if we need to fetch
      if (isRangeCovered(viewStart, viewEnd)) {
        // Cache hit - no fetch needed
        if (cachedEvents.length === 0 && eventsCacheRef.current.events.size > 0) {
          setViewEvents(cachedEvents);
        }
        return;
      }

      // Calculate extended range to pre-fetch
      const { start: fetchStart, end: fetchEnd } = getExtendedRange(viewStart, viewEnd, viewMode);

      setViewEventsLoading(true);
      try {
        // Ensure calendars are loaded (uses its own cache)
        const calendarsLoaded = await calendarService.calendars.getCachedCalendars();
        if (calendarsLoaded.length === 0) {
          await calendarService.calendars.getCalendars();
        }

        // Fetch extended range
        const events = await calendarService.events.getAllEvents(fetchStart, fetchEnd);

        // Add to cache
        addToCache(events, fetchStart, fetchEnd);

        // Update view with events for current range
        const viewEvents = getEventsFromCache(viewStart, viewEnd);
        setViewEvents(viewEvents);
      } catch (error) {
        console.error('Failed to fetch events for view:', error);
      } finally {
        setViewEventsLoading(false);
      }
    };

    fetchEventsForView();
  }, [isAuthenticated, currentDate, viewMode, isRangeCovered, getEventsFromCache, addToCache, getExtendedRange]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => subMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'day':
        setCurrentDate(prev => subDays(prev, 1));
        break;
    }
  }, [viewMode]);

  const goToNext = useCallback(() => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }, []);

  // Get events for a specific date (handles all-day events timezone correctly)
  const getEventsForDate = useCallback((date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    return viewEvents.filter(event => {
      const eventStart = new Date(event.start);

      // For all-day events, compare using UTC date parts to avoid timezone shifts
      if (event.all_day) {
        return eventStart.getUTCFullYear() === targetYear &&
               eventStart.getUTCMonth() === targetMonth &&
               eventStart.getUTCDate() === targetDay;
      }

      // For timed events, use local date comparison
      return eventStart.getFullYear() === targetYear &&
             eventStart.getMonth() === targetMonth &&
             eventStart.getDate() === targetDay;
    });
  }, [viewEvents]);

  // Get header title based on view mode
  const getHeaderTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      default:
        return '';
    }
  };

  // Open create event modal
  const openCreateModal = useCallback((date = null, startHour = null) => {
    const eventDate = date || currentDate;
    let startTime, endTime, endDate;

    // Helper to format time and handle overflow
    const formatTime = (hours, minutes) => {
      // Handle minutes overflow
      if (minutes >= 60) {
        hours += 1;
        minutes = 0;
      }
      // Clamp to valid range (0-23:59)
      hours = Math.min(23, Math.max(0, hours));
      minutes = Math.min(59, Math.max(0, minutes));
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    if (startHour !== null) {
      // Clicked on a specific time slot - snap to 15 min intervals
      let hours = Math.floor(startHour);
      let minutes = Math.round((startHour - hours) * 60 / 15) * 15;

      // Handle minutes overflow
      if (minutes >= 60) {
        hours += 1;
        minutes = 0;
      }

      startTime = formatTime(hours, minutes);

      // Default 1 hour duration, but cap at 23:59 if needed
      let endHours = hours + 1;
      let endMinutes = minutes;

      if (endHours >= 24) {
        // Cap at end of day
        endHours = 23;
        endMinutes = 59;
      }

      endTime = formatTime(endHours, endMinutes);
      endDate = eventDate;
    } else {
      // Default to current time rounded to next 15 min
      const now = new Date();
      const mins = Math.ceil(now.getMinutes() / 15) * 15;
      now.setMinutes(mins, 0, 0);

      // Handle overflow from rounding
      startTime = format(now, 'HH:mm');

      // Add 1 hour for end time
      const endDateTime = new Date(now);
      endDateTime.setHours(endDateTime.getHours() + 1);

      // If end time crosses midnight, cap at 23:59
      if (endDateTime.getDate() !== now.getDate()) {
        endTime = '23:59';
        endDate = eventDate;
      } else {
        endTime = format(endDateTime, 'HH:mm');
        endDate = eventDate;
      }
    }

    setCreateEventData({
      date: eventDate,
      endDate: endDate || eventDate,
      startTime,
      endTime,
      allDay: false
    });
    setShowCreateModal(true);
  }, [currentDate]);

  // Get writable calendars for event creation (only visible ones)
  const writableCalendars = calendars.filter(c => c.is_writable !== false && c.visible);

  // Context menu handlers
  const handleContextMenu = useCallback((e, type, data) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      data
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on click outside or escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = () => closeContextMenu();
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu, closeContextMenu]);

  // Context menu actions
  const handleContextMenuAction = useCallback(async (action) => {
    if (!contextMenu) return;

    const { type, data } = contextMenu;
    closeContextMenu();

    switch (action) {
      case 'create':
        if (type === 'timeSlot') {
          openCreateModal(data.date, data.hour);
        } else if (type === 'dayCell' || type === 'allDaySlot') {
          openCreateModal(data.date);
        }
        break;

      case 'edit':
        if (type === 'event' && data.event) {
          setSelectedEvent(data.event);
        }
        break;

      case 'delete':
        if (type === 'event' && data.event) {
          const event = data.event;
          const calendar = calendars.find(c => c.id === event.calendar_id);
          if (calendar?.is_writable === false) {
            toast.error('Cannot delete', { description: 'This calendar is read-only' });
            return;
          }
          if (window.confirm(`Delete "${event.title}"?`)) {
            // Optimistic delete - remove from UI immediately
            setViewEvents(prev => prev.filter(e => e.id !== event.id));

            // Delete in background (pass etag for CalDAV concurrency)
            calendarService.events.deleteEvent(event.calendar_id, event.id, event.etag)
              .then(() => {
                toast.success('Event deleted', { description: event.title });
                updateEventInCache(event.id, null); // Remove from cache
              })
              .catch(err => {
                console.error('Failed to delete event:', err);
                // Revert - add event back
                setViewEvents(prev => [...prev, event].sort((a, b) => new Date(a.start) - new Date(b.start)));
                toast.error('Failed to delete', { description: err.message });
              });
          }
        }
        break;

      case 'duplicate':
        if (type === 'event' && data.event) {
          const event = data.event;
          // Find a writable calendar (prefer the same one if writable)
          const targetCalendar = calendars.find(c => c.id === event.calendar_id && c.is_writable !== false)
            || calendars.find(c => c.is_writable !== false);

          if (!targetCalendar) {
            toast.error('Cannot duplicate', { description: 'No writable calendar available' });
            return;
          }

          // Create optimistic event with temp ID
          const tempId = `temp-${Date.now()}`;
          const optimisticEvent = {
            ...event,
            id: tempId,
            title: event.title + ' (copy)',
            calendar_id: targetCalendar.id,
          };
          setViewEvents(prev => [...prev, optimisticEvent].sort((a, b) => new Date(a.start) - new Date(b.start)));

          // Create in background
          calendarService.events.createEvent(targetCalendar.id, {
            title: event.title + ' (copy)',
            description: event.description,
            start: event.start,
            end: event.end,
            allDay: event.all_day,
            location: event.location
          })
            .then(createdEvent => {
              // Replace temp event with real one
              setViewEvents(prev => prev.map(e => e.id === tempId ? createdEvent : e));
              toast.success('Event duplicated', { description: createdEvent.title });
              updateEventInCache(createdEvent.id, createdEvent); // Add to cache
            })
            .catch(err => {
              console.error('Failed to duplicate event:', err);
              // Remove optimistic event
              setViewEvents(prev => prev.filter(e => e.id !== tempId));
              toast.error('Failed to duplicate', { description: err.message });
            });
        }
        break;

      case 'openExternal':
        if (type === 'event' && data.event?.html_link) {
          window.open(data.event.html_link, '_blank');
        }
        break;

      case 'goToDay':
        if (data.date) {
          setCurrentDate(data.date);
          setSelectedDate(data.date);
          setViewMode('day');
        }
        break;

      default:
        break;
    }
  }, [contextMenu, closeContextMenu, openCreateModal, calendars, clearCache, currentDate]);

  // Drag handler - triggered by grip handle mousedown
  const handleEventMouseDown = useCallback((event, e) => {
    // Only handle left click
    if (e.button !== 0) return;

    e.preventDefault(); // Prevent text selection
    e.stopPropagation(); // Don't trigger parent click

    // Check if the calendar is writable
    const calendar = calendars?.find(c => c.id === event.calendar_id);
    if (calendar?.is_writable === false) {
      toast.error('Cannot move', { description: 'This event is from a read-only calendar' });
      return;
    }

    // Start dragging immediately (grip handle was clicked)
    setDragState({
      event,
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      originalStart: event.start,
      originalEnd: event.end,
    });
  }, [calendars]);

  // Handle click on event (for MonthView which doesn't use drag system)
  const handleEventClick = useCallback((event) => {
    setSelectedEvent(event);
  }, []);

  // Handle double-click on event to open details modal
  const handleEventDoubleClick = useCallback((event) => {
    setSelectedEvent(event);
  }, []);

  // Ref to track time grid for drop calculations
  const timeGridRef = useRef(null);

  // Global mouse move handler for dragging
  useEffect(() => {
    if (!dragState || !dragState.isDragging) return;

    const handleMouseMove = (e) => {
      setDragState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
      }));
    };

    const handleMouseUp = async (e) => {
      if (!dragState?.isDragging || !dragState?.event) {
        setDragState(null);
        return;
      }

      const event = dragState.event;

      // Find the time grid element under the mouse
      const timeGrid = document.querySelector('[data-time-grid]');
      if (!timeGrid) {
        setDragState(null);
        return;
      }

      const rect = timeGrid.getBoundingClientRect();
      const y = e.clientY - rect.top;

      // Check if mouse is within the time grid
      if (y < 0 || y > rect.height || e.clientX < rect.left || e.clientX > rect.right) {
        setDragState(null);
        return;
      }

      // Calculate new hour (6 AM start, 80px per hour)
      const START_HOUR = 6;
      const HOUR_HEIGHT = 80;
      const hour = START_HOUR + (y / HOUR_HEIGHT);
      const snappedHour = Math.floor(hour * 4) / 4; // Snap to 15 min

      // Parse original times
      const originalStart = parseISO(event.start);
      const originalEnd = parseISO(event.end);
      const duration = originalEnd.getTime() - originalStart.getTime();

      // Build new start time (use current date from view)
      const newStart = new Date(currentDate);
      const hours = Math.floor(snappedHour);
      const minutes = Math.round((snappedHour - hours) * 60);
      newStart.setHours(hours, minutes, 0, 0);

      // Calculate new end
      const newEnd = new Date(newStart.getTime() + duration);

      // Check if times changed
      if (newStart.getTime() === originalStart.getTime()) {
        setDragState(null);
        return;
      }

      // Optimistic update - update local state immediately
      const updatedEvent = {
        ...event,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      };
      setViewEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      setDragState(null);

      // Update in background (pass etag for CalDAV concurrency)
      try {
        await calendarService.events.updateEvent(event.calendar_id, event.id, {
          title: event.title,
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
          allDay: event.all_day,
        }, event.etag);
        toast.success('Event moved', { description: `${event.title} moved to ${format(newStart, 'h:mm a')}` });
        updateEventInCache(event.id, updatedEvent); // Update in cache
      } catch (err) {
        console.error('Failed to move event:', err);
        // Revert optimistic update
        setViewEvents(prev => prev.map(e => e.id === event.id ? event : e));
        updateEventInCache(event.id, event); // Revert cache too
        toast.error('Failed to move event', { description: err.message });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, currentDate, updateEventInCache]);

  // Handle drop on a time slot (kept for week view day changes)
  const handleEventDrop = useCallback(async (newDate, newHour) => {
    if (!dragState?.isDragging || !dragState?.event) return;

    const event = dragState.event;

    // Parse original start and end
    const originalStart = parseISO(event.start);
    const originalEnd = parseISO(event.end);
    const duration = originalEnd.getTime() - originalStart.getTime();

    // Build new start time
    let newStart;
    if (event.all_day) {
      newStart = new Date(newDate);
      newStart.setHours(0, 0, 0, 0);
    } else {
      newStart = new Date(newDate);
      const hours = Math.floor(newHour);
      const minutes = Math.round((newHour - hours) * 60);
      newStart.setHours(hours, minutes, 0, 0);
    }

    // Calculate new end based on duration
    const newEnd = new Date(newStart.getTime() + duration);

    // Check if times actually changed
    if (newStart.getTime() === originalStart.getTime()) {
      setDragState(null);
      return;
    }

    // Optimistic update
    const updatedEvent = {
      ...event,
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    };
    setViewEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
    setDragState(null);

    try {
      // Pass etag for CalDAV concurrency
      await calendarService.events.updateEvent(event.calendar_id, event.id, {
        title: event.title,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        allDay: event.all_day,
      }, event.etag);
      toast.success('Event moved', { description: `${event.title} moved to ${format(newStart, 'MMM d, h:mm a')}` });
      updateEventInCache(event.id, updatedEvent); // Update cache
    } catch (err) {
      console.error('Failed to move event:', err);
      // Revert
      setViewEvents(prev => prev.map(e => e.id === event.id ? event : e));
      updateEventInCache(event.id, event);
      toast.error('Failed to move event', { description: err.message });
    }
  }, [dragState, updateEventInCache]);

  // Not connected state
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full bg-app-bg">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <CalendarIcon className="w-16 h-16 text-app-muted mb-4 opacity-50" />
          <h2 className="text-lg font-medium text-app-text mb-2">
            Connect Your Calendar
          </h2>
          <p className="text-sm text-app-muted mb-6 max-w-md">
            Connect Google Calendar or iCloud to view and manage your events in Lokus.
            Your events will sync automatically.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={connectGoogle}
              className="px-6 py-3 text-sm bg-app-accent text-app-accent-fg rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Connect Google Calendar
            </button>
            <p className="text-xs text-app-muted">
              For iCloud Calendar, go to{' '}
              <span className="text-app-accent">Preferences → Connections</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-app-bg rounded transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm border border-app-border rounded hover:bg-app-bg transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-app-bg rounded transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Title */}
          <h1 className="text-lg font-semibold">
            {getHeaderTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Event Button */}
          {writableCalendars.length > 0 && (
            <button
              onClick={() => openCreateModal()}
              className="p-2 hover:bg-app-bg rounded-lg transition-colors text-app-muted hover:text-app-text"
              title="Create event"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* View Mode Selector */}
          <div className="flex items-center border border-app-border rounded overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className={`p-2 transition-colors ${viewMode === 'month' ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'}`}
              title="Month view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`p-2 transition-colors ${viewMode === 'week' ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'}`}
              title="Week view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`p-2 transition-colors ${viewMode === 'day' ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'}`}
              title="Day view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sync button - also spins subtly when loading events */}
          <button
            onClick={triggerSync}
            disabled={syncInProgress}
            className="p-2 hover:bg-app-bg rounded transition-colors"
            title={viewEventsLoading ? 'Loading events...' : 'Sync calendars'}
          >
            <RefreshCw className={`w-4 h-4 ${syncInProgress || viewEventsLoading ? 'animate-spin' : ''} ${viewEventsLoading && !syncInProgress ? 'text-app-muted' : ''}`} />
          </button>

          {/* Settings */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 hover:bg-app-bg rounded transition-colors"
              title="Calendar settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Calendar Content - Always show grid, events populate when ready */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onDayDoubleClick={(date) => {
              setCurrentDate(date);
              setSelectedDate(date);
              setViewMode('day');
            }}
            getEventsForDate={getEventsForDate}
            calendars={calendars}
            onEventClick={handleEventClick}
            onCreateEvent={openCreateModal}
            onContextMenu={handleContextMenu}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onDayDoubleClick={(date) => {
              setCurrentDate(date);
              setSelectedDate(date);
              setViewMode('day');
            }}
            getEventsForDate={getEventsForDate}
            calendars={calendars}
            onCreateEvent={openCreateModal}
            onContextMenu={handleContextMenu}
            onEventDoubleClick={handleEventDoubleClick}
            onEventMouseDown={handleEventMouseDown}
            onEventDrop={handleEventDrop}
            dragState={dragState}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            getEventsForDate={getEventsForDate}
            calendars={calendars}
            onCreateEvent={openCreateModal}
            onContextMenu={handleContextMenu}
            onEventClick={handleEventClick}
            onEventDoubleClick={handleEventDoubleClick}
            onEventMouseDown={handleEventMouseDown}
            onEventDrop={handleEventDrop}
            dragState={dragState}
          />
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          calendars={calendars}
          onClose={() => setSelectedEvent(null)}
          onOptimisticUpdate={(updatedEvent) => {
            setViewEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
            updateEventInCache(updatedEvent.id, updatedEvent);
          }}
          onOptimisticDelete={(eventId) => {
            setViewEvents(prev => prev.filter(e => e.id !== eventId));
            updateEventInCache(eventId, null);
          }}
          onRevert={(originalEvent) => {
            setViewEvents(prev => prev.map(e => e.id === originalEvent.id ? originalEvent : e));
            updateEventInCache(originalEvent.id, originalEvent);
          }}
          onRevertDelete={(event) => {
            setViewEvents(prev => [...prev, event].sort((a, b) => new Date(a.start) - new Date(b.start)));
            updateEventInCache(event.id, event);
          }}
        />
      )}

      {/* Create Event Modal */}
      {showCreateModal && createEventData && (
        <CreateEventModal
          initialData={createEventData}
          calendars={writableCalendars}
          onClose={() => {
            setShowCreateModal(false);
            setCreateEventData(null);
          }}
          onOptimisticAdd={(tempEvent) => {
            setViewEvents(prev => [...prev, tempEvent].sort((a, b) => new Date(a.start) - new Date(b.start)));
          }}
          onReplaceTemp={(tempId, realEvent) => {
            setViewEvents(prev => prev.map(e => e.id === tempId ? realEvent : e));
            updateEventInCache(realEvent.id, realEvent);
          }}
          onRemoveTemp={(tempId) => {
            setViewEvents(prev => prev.filter(e => e.id !== tempId));
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <CalendarContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          data={contextMenu.data}
          calendars={calendars}
          onAction={handleContextMenuAction}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

/**
 * Month View Component
 */
function MonthView({ currentDate, selectedDate, onSelectDate, onDayDoubleClick, getEventsForDate, calendars, onEventClick, onCreateEvent, onContextMenu }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get calendar color
  const getCalendarColor = (calendarId) => {
    const calendar = calendars?.find(c => c.id === calendarId);
    return calendar?.color || '#6366f1';
  };

  return (
    <div className="p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-app-muted py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-app-border rounded overflow-hidden">
        {weeks.map((week, weekIndex) => (
          week.map((day, dayIndex) => {
            const events = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);

            // Separate all-day and timed events
            const allDayEvents = events.filter(e => e.all_day);
            const timedEvents = events.filter(e => !e.all_day);
            const displayEvents = [...allDayEvents, ...timedEvents]; // All-day first

            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                onClick={() => onSelectDate(day)}
                onDoubleClick={() => onDayDoubleClick && onDayDoubleClick(day)}
                onContextMenu={(e) => onContextMenu?.(e, 'dayCell', { date: day })}
                className={`
                  min-h-[100px] p-2 bg-app-bg cursor-pointer transition-colors group relative
                  ${isCurrentMonth ? 'hover:bg-app-panel' : 'bg-app-panel/50'}
                  ${isSelected ? 'ring-2 ring-app-accent ring-inset' : ''}
                `}
              >
                {/* Add event button - appears on hover */}
                {onCreateEvent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEvent(day);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded bg-app-bg/80 text-app-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-app-border hover:text-app-text"
                    title="Create event"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
                <div className={`
                  text-sm font-medium mb-1
                  ${!isCurrentMonth ? 'text-app-muted' : ''}
                  ${isTodayDate ? 'w-6 h-6 rounded-full bg-app-accent text-app-accent-fg flex items-center justify-center' : ''}
                `}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {displayEvents.slice(0, 3).map(event => {
                    const color = getCalendarColor(event.calendar_id);
                    const isAllDay = event.all_day;
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        onContextMenu={(e) => {
                          e.stopPropagation();
                          onContextMenu?.(e, 'event', { event, date: day });
                        }}
                        className={`text-xs truncate px-1 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                          isAllDay ? 'font-medium' : ''
                        }`}
                        style={{
                          backgroundColor: isAllDay ? color : `${color}20`,
                          color: isAllDay ? '#fff' : color
                        }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    );
                  })}
                  {displayEvents.length > 3 && (
                    <div className="text-xs text-app-muted px-1">
                      +{displayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}

/**
 * Week View Component
 */
function WeekView({ currentDate, selectedDate, onSelectDate, onDayDoubleClick, getEventsForDate, calendars, onCreateEvent, onContextMenu, onEventDoubleClick, onEventMouseDown, onEventDrop, dragState }) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const timeGridRefs = useRef({});

  // Time slots (6 AM to 11 PM)
  const START_HOUR = 6;
  const END_HOUR = 23;
  const HOUR_HEIGHT = 60; // pixels per hour
  const timeSlots = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    timeSlots.push(hour);
  }

  // Current time indicator
  const [currentTime, setCurrentTime] = useState(new Date());
  const todayInWeek = days.find(day => isToday(day));

  // Update current time every minute
  useEffect(() => {
    if (!todayInWeek) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [todayInWeek]);

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours() + currentTime.getMinutes() / 60;
    if (hours < START_HOUR || hours > END_HOUR + 1) return null;
    return (hours - START_HOUR) * HOUR_HEIGHT;
  };

  const timeIndicatorPosition = todayInWeek ? getCurrentTimePosition() : null;

  // Handle click on time grid to create event
  const handleTimeGridClick = (day, e) => {
    // Don't trigger click when dragging
    if (dragState?.isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + (y / HOUR_HEIGHT);
    // Snap to 15 min intervals
    const snappedHour = Math.floor(hour * 4) / 4;
    onCreateEvent?.(day, snappedHour);
  };

  // Handle right-click on time grid
  const handleTimeGridContextMenu = (day, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + (y / HOUR_HEIGHT);
    const snappedHour = Math.floor(hour * 4) / 4;
    onContextMenu?.(e, 'timeSlot', { date: day, hour: snappedHour });
  };

  // Handle mouse up on time grid for drop
  const handleTimeGridMouseUp = (day, e) => {
    if (!dragState?.isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + (y / HOUR_HEIGHT);
    // Snap to 15 min intervals
    const snappedHour = Math.floor(hour * 4) / 4;

    onEventDrop?.(day, snappedHour);
  };

  // Check if calendar is writable
  const isEventDraggable = (event) => {
    const calendar = calendars?.find(c => c.id === event.calendar_id);
    return calendar?.is_writable !== false;
  };

  // Get calendar color
  const getCalendarColor = (calendarId) => {
    const calendar = calendars?.find(c => c.id === calendarId);
    return calendar?.color || '#6366f1'; // default indigo
  };

  // Calculate event position and height
  const getEventStyle = (event) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    // Clamp to visible range
    const visibleStart = Math.max(startHour, START_HOUR);
    const visibleEnd = Math.min(endHour, END_HOUR + 1);

    const top = (visibleStart - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((visibleEnd - visibleStart) * HOUR_HEIGHT, 20); // min height 20px

    const color = getCalendarColor(event.calendar_id);

    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: `${color}20`,
      borderLeft: `3px solid ${color}`,
    };
  };

  // Get all-day events for a date
  const getAllDayEvents = (day) => {
    return getEventsForDate(day).filter(e => e.all_day);
  };

  // Get timed events for a date
  const getTimedEvents = (day) => {
    return getEventsForDate(day).filter(e => !e.all_day);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="flex border-b border-app-border bg-app-panel sticky top-0 z-10">
        <div className="w-16 flex-shrink-0" />
        {days.map(day => (
          <div
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            onDoubleClick={() => onDayDoubleClick && onDayDoubleClick(day)}
            className={`
              flex-1 text-center py-2 cursor-pointer hover:bg-app-bg transition-colors border-l border-app-border
              ${isToday(day) ? 'bg-app-accent/10' : ''}
            `}
          >
            <div className="text-xs text-app-muted">
              {format(day, 'EEE')}
            </div>
            <div className={`
              text-lg font-medium
              ${isToday(day) ? 'w-8 h-8 rounded-full bg-app-accent text-app-accent-fg flex items-center justify-center mx-auto' : ''}
            `}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events row */}
      <div className="flex border-b border-app-border bg-app-panel/50 min-h-[36px]">
        <div className="w-16 flex-shrink-0 text-xs text-app-muted py-2 px-2 text-right">
          All-day
        </div>
        {days.map(day => {
          const allDayEvents = getAllDayEvents(day);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 border-l border-app-border p-1 flex flex-col gap-1"
              onContextMenu={(e) => onContextMenu?.(e, 'allDaySlot', { date: day })}
            >
              {allDayEvents.map(event => {
                const color = getCalendarColor(event.calendar_id);
                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      onContextMenu?.(e, 'event', { event, date: day });
                    }}
                    className="text-xs truncate px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity font-medium"
                    style={{ backgroundColor: color, color: '#fff' }}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 relative">
            {timeSlots.map(hour => (
              <div
                key={hour}
                className="absolute w-full text-xs text-app-muted px-2 text-right"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
              >
                {format(new Date().setHours(hour, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns - clickable to create events */}
          {days.map(day => {
            const timedEvents = getTimedEvents(day);
            return (
              <div
                key={day.toISOString()}
                ref={el => timeGridRefs.current[day.toISOString()] = el}
                className={`flex-1 relative border-l border-app-border cursor-pointer ${dragState?.isDragging ? 'bg-app-accent/5' : ''}`}
                onClick={(e) => handleTimeGridClick(day, e)}
                onContextMenu={(e) => handleTimeGridContextMenu(day, e)}
                onMouseUp={(e) => handleTimeGridMouseUp(day, e)}
              >
                {/* Hour grid lines */}
                {timeSlots.map(hour => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-app-border/50 pointer-events-none"
                    style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* Current time indicator - only on today's column */}
                {isToday(day) && timeIndicatorPosition !== null && (
                  <div
                    className="absolute left-0 right-0 z-50 pointer-events-none flex items-center"
                    style={{ top: `${timeIndicatorPosition}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-sm" />
                    <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
                  </div>
                )}

                {/* Events */}
                {timedEvents.map((event, idx) => {
                  const style = getEventStyle(event);
                  // Handle overlapping events by offsetting them
                  const overlappingCount = timedEvents.filter((e, i) => {
                    if (i >= idx) return false;
                    const eStart = parseISO(e.start);
                    const eEnd = parseISO(e.end);
                    const thisStart = parseISO(event.start);
                    const thisEnd = parseISO(event.end);
                    return thisStart < eEnd && thisEnd > eStart;
                  }).length;

                  const canDrag = isEventDraggable(event);
                  const isDragging = dragState?.isDragging && dragState?.event?.id === event.id;

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isDragging) onEventDoubleClick?.(event);
                      }}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e, 'event', { event, date: day });
                      }}
                      className={`group absolute rounded-r px-1 py-1 hover:opacity-90 overflow-hidden select-none cursor-pointer ${
                        isDragging ? 'opacity-70 scale-105 ring-2 ring-app-accent shadow-lg pointer-events-none' : 'transition-all'
                      }`}
                      style={{
                        ...style,
                        left: `${overlappingCount * 20}%`,
                        right: '4px',
                        zIndex: isDragging ? 100 : idx + 10,
                        transform: isDragging ? `translate(${dragState.currentX - dragState.startX}px, ${dragState.currentY - dragState.startY}px)` : undefined,
                      }}
                      title={event.title}
                    >
                      <div className="flex items-start gap-1">
                        {/* Drag handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onEventMouseDown?.(event, e);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          className="flex-shrink-0 cursor-grab active:cursor-grabbing"
                          title="Drag to move"
                        >
                          <GripVertical className="w-3.5 h-3.5" style={{ color: getCalendarColor(event.calendar_id) }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: getCalendarColor(event.calendar_id) }}>
                            {event.title}
                          </div>
                          <div className="text-xs opacity-70" style={{ color: getCalendarColor(event.calendar_id) }}>
                            {format(parseISO(event.start), 'h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Day View Component
 */
function DayView({ currentDate, getEventsForDate, calendars, onCreateEvent, onContextMenu, onEventClick, onEventDoubleClick, onEventMouseDown, onEventDrop, dragState }) {
  const events = getEventsForDate(currentDate);
  const allDayEvents = events.filter(e => e.all_day);
  const timedEvents = events.filter(e => !e.all_day);

  // Time slots (6 AM to 10 PM)
  const START_HOUR = 6;
  const END_HOUR = 22;
  const HOUR_HEIGHT = 80;
  const timeSlots = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    timeSlots.push(hour);
  }

  // Current time indicator
  const [currentTime, setCurrentTime] = useState(new Date());
  const isTodayView = isToday(currentDate);

  // Update current time every minute
  useEffect(() => {
    if (!isTodayView) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isTodayView]);

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours() + currentTime.getMinutes() / 60;
    if (hours < START_HOUR || hours > END_HOUR + 1) return null;
    return (hours - START_HOUR) * HOUR_HEIGHT;
  };

  const timeIndicatorPosition = isTodayView ? getCurrentTimePosition() : null;

  // Handle click on time grid to create event
  const handleTimeGridClick = (e) => {
    // Don't trigger click when dragging
    if (dragState?.isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + (y / HOUR_HEIGHT);
    // Snap to 15 min intervals
    const snappedHour = Math.floor(hour * 4) / 4;
    onCreateEvent?.(currentDate, snappedHour);
  };

  // Handle right-click on time grid
  const handleTimeGridContextMenu = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + (y / HOUR_HEIGHT);
    const snappedHour = Math.floor(hour * 4) / 4;
    onContextMenu?.(e, 'timeSlot', { date: currentDate, hour: snappedHour });
  };

  // Handle mouse up on time grid for drop
  const handleTimeGridMouseUp = (e) => {
    if (!dragState?.isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = START_HOUR + (y / HOUR_HEIGHT);
    // Snap to 15 min intervals
    const snappedHour = Math.floor(hour * 4) / 4;

    onEventDrop?.(currentDate, snappedHour);
  };

  // Check if calendar is writable
  const isEventDraggable = (event) => {
    const calendar = calendars?.find(c => c.id === event.calendar_id);
    return calendar?.is_writable !== false;
  };

  // Get calendar color
  const getCalendarColor = (calendarId) => {
    const calendar = calendars?.find(c => c.id === calendarId);
    return calendar?.color || '#6366f1';
  };

  // Calculate event position and height
  const getEventStyle = (event) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    const visibleStart = Math.max(startHour, START_HOUR);
    const visibleEnd = Math.min(endHour, END_HOUR + 1);

    const top = (visibleStart - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((visibleEnd - visibleStart) * HOUR_HEIGHT, 30);

    const color = getCalendarColor(event.calendar_id);

    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: `${color}20`,
      borderLeft: `3px solid ${color}`,
    };
  };

  return (
    <div className="flex flex-col h-full">
      {/* All-day events - always show this section */}
      <div className="border-b border-app-border px-4 py-3 bg-app-panel">
        <div className="flex items-center gap-4">
          <div className="text-xs text-app-muted w-16 text-right">All-day</div>
          <div
            className="flex-1 flex flex-wrap gap-2 min-h-[28px]"
            onContextMenu={(e) => onContextMenu?.(e, 'allDaySlot', { date: currentDate })}
          >
            {allDayEvents.length > 0 ? (
              allDayEvents.map(event => {
                const color = getCalendarColor(event.calendar_id);
                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      onContextMenu?.(e, 'event', { event, date: currentDate });
                    }}
                    className="text-sm px-3 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity font-medium"
                    style={{ backgroundColor: color, color: '#fff' }}
                  >
                    {event.title}
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-app-muted italic">No all-day events</span>
            )}
          </div>
        </div>
      </div>

      {/* Timed events */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-20 flex-shrink-0 relative border-r border-app-border">
            {timeSlots.map(hour => (
              <div
                key={hour}
                className="absolute w-full text-sm text-app-muted px-4 text-right"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
              >
                {format(new Date().setHours(hour, 0), 'h:mm a')}
              </div>
            ))}
          </div>

          {/* Events column - clickable to create events */}
          <div
            data-time-grid
            className={`flex-1 relative cursor-pointer ${dragState?.isDragging ? 'bg-app-accent/5' : ''}`}
            onClick={handleTimeGridClick}
            onContextMenu={handleTimeGridContextMenu}
            onMouseUp={handleTimeGridMouseUp}
          >
            {/* Hour grid lines */}
            {timeSlots.map(hour => (
              <div
                key={hour}
                className="absolute w-full border-t border-app-border/50 pointer-events-none"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              />
            ))}

            {/* Current time indicator */}
            {timeIndicatorPosition !== null && (
              <div
                className="absolute left-0 right-0 z-50 pointer-events-none flex items-center"
                style={{ top: `${timeIndicatorPosition}px` }}
              >
                <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shadow-sm" />
                <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
              </div>
            )}

            {/* Events */}
            {timedEvents.map((event, idx) => {
              const style = getEventStyle(event);
              const overlappingCount = timedEvents.filter((e, i) => {
                if (i >= idx) return false;
                const eStart = parseISO(e.start);
                const eEnd = parseISO(e.end);
                const thisStart = parseISO(event.start);
                const thisEnd = parseISO(event.end);
                return thisStart < eEnd && thisEnd > eStart;
              }).length;

              const canDrag = isEventDraggable(event);
              const isDragging = dragState?.isDragging && dragState?.event?.id === event.id;

              return (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDragging) onEventClick?.(event);
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    onContextMenu?.(e, 'event', { event, date: currentDate });
                  }}
                  className={`group absolute rounded-r px-2 py-2 hover:opacity-90 overflow-hidden select-none cursor-pointer ${
                    isDragging ? 'opacity-70 scale-105 ring-2 ring-app-accent shadow-lg pointer-events-none' : 'transition-all'
                  }`}
                  style={{
                    ...style,
                    left: `${8 + overlappingCount * 120}px`,
                    right: '16px',
                    zIndex: isDragging ? 100 : idx + 10,
                    transform: isDragging ? `translateY(${dragState.currentY - dragState.startY}px)` : undefined,
                  }}
                  title={event.title}
                >
                  <div className="flex items-start gap-1.5">
                    {/* Drag handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onEventMouseDown?.(event, e);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      className="flex-shrink-0 cursor-grab active:cursor-grabbing"
                      title="Drag to move"
                    >
                      <GripVertical className="w-4 h-4" style={{ color: getCalendarColor(event.calendar_id) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: getCalendarColor(event.calendar_id) }}>
                        {event.title}
                      </div>
                      <div className="text-xs opacity-70" style={{ color: getCalendarColor(event.calendar_id) }}>
                        {format(parseISO(event.start), 'h:mm a')} - {format(parseISO(event.end), 'h:mm a')}
                      </div>
                      {event.location && (
                        <div className="text-xs opacity-60 mt-1" style={{ color: getCalendarColor(event.calendar_id) }}>
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Event Edit Popover
 */
function EventDetailsModal({ event, calendars, onClose, onOptimisticUpdate, onOptimisticDelete, onRevert, onRevertDelete }) {
  const [title, setTitle] = useState(event.title || '');
  const [location, setLocation] = useState(event.location || '');
  const [description, setDescription] = useState(event.description || '');
  const [allDay, setAllDay] = useState(event.all_day || false);
  const [startDate, setStartDate] = useState(() => {
    const d = parseISO(event.start);
    return format(d, 'yyyy-MM-dd');
  });
  const [startTime, setStartTime] = useState(() => {
    const d = parseISO(event.start);
    return format(d, 'HH:mm');
  });
  const [endDate, setEndDate] = useState(() => {
    const d = parseISO(event.end);
    return format(d, 'yyyy-MM-dd');
  });
  const [endTime, setEndTime] = useState(() => {
    const d = parseISO(event.end);
    return format(d, 'HH:mm');
  });
  const [error, setError] = useState(null);

  const getCalendar = (calendarId) => {
    return calendars?.find(c => c.id === calendarId);
  };

  const getCalendarColor = (calendarId) => {
    const calendar = getCalendar(calendarId);
    return calendar?.color || '#6366f1';
  };

  const getCalendarName = (calendarId) => {
    const calendar = getCalendar(calendarId);
    return calendar?.name || 'Calendar';
  };

  const calendar = getCalendar(event.calendar_id);
  const isWritable = calendar?.is_writable !== false; // Default to true if not set
  const color = getCalendarColor(event.calendar_id);

  // Get reason why calendar is read-only
  const getReadOnlyReason = () => {
    if (!calendar) return 'This calendar is read-only';
    const id = calendar.id || '';
    if (id.includes('#holiday@group')) {
      return 'Holiday calendars cannot be edited';
    }
    if (id.includes('@import.calendar.google.com')) {
      return 'Imported calendars are read-only. Re-import events into your primary calendar to edit them.';
    }
    if (id.includes('@group.v.calendar.google.com')) {
      return 'Subscribed calendars cannot be edited';
    }
    return 'Ask the calendar owner to give you edit permission in Google Calendar';
  };

  // Build ISO string from date and time
  const buildDateTime = (dateStr, timeStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(year, month - 1, day, hours, minutes);
    return d.toISOString();
  };

  // Save changes
  const handleSave = async () => {
    if (!isWritable) {
      toast.error('Cannot edit', { description: 'This calendar is read-only' });
      return;
    }

    const startDateTime = allDay
      ? new Date(startDate + 'T00:00:00').toISOString()
      : buildDateTime(startDate, startTime);
    const endDateTime = allDay
      ? new Date(endDate + 'T23:59:59').toISOString()
      : buildDateTime(endDate, endTime);

    // Create optimistic update
    const updatedEvent = {
      ...event,
      title,
      location: location || null,
      description: description || null,
      start: startDateTime,
      end: endDateTime,
      all_day: allDay
    };

    // Apply optimistic update and close modal
    onOptimisticUpdate?.(updatedEvent);
    onClose();

    // Save in background (pass etag for CalDAV concurrency)
    try {
      await calendarService.events.updateEvent(event.calendar_id, event.id, {
        title,
        location: location || null,
        description: description || null,
        start: startDateTime,
        end: endDateTime,
        allDay
      }, event.etag);
      toast.success('Event updated', { description: title });
    } catch (err) {
      console.error('Failed to save event:', err);
      // Revert optimistic update
      onRevert?.(event);
      if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        toast.error('Permission denied', { description: 'This calendar may be read-only' });
      } else {
        toast.error('Failed to save', { description: err.message });
      }
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!isWritable) {
      toast.error('Cannot delete', { description: 'This calendar is read-only' });
      return;
    }

    if (!window.confirm('Delete this event?')) return;

    // Apply optimistic delete and close modal
    onOptimisticDelete?.(event.id);
    onClose();

    // Delete in background (pass etag for CalDAV concurrency)
    try {
      await calendarService.events.deleteEvent(event.calendar_id, event.id, event.etag);
      toast.success('Event deleted', { description: event.title });
    } catch (err) {
      console.error('Failed to delete event:', err);
      // Revert - add event back
      onRevertDelete?.(event);
      if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        toast.error('Permission denied', { description: 'This calendar may be read-only' });
      } else {
        toast.error('Failed to delete', { description: err.message });
      }
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#2c2c2e] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with calendar color */}
        <div className="h-1.5" style={{ backgroundColor: color }} />

        {/* Title */}
        <div className="p-4 pb-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full text-xl font-semibold bg-transparent text-white placeholder-gray-500 outline-none"
            autoFocus
          />
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm text-gray-400">{getCalendarName(event.calendar_id)}</span>
            {!isWritable && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">Read-only</span>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Location */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-3 bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* All Day Toggle */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-between bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <span className="text-sm text-white">All-day</span>
            <button
              type="button"
              onClick={() => setAllDay(!allDay)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                allDay ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  allDay ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Start Date/Time */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-400 w-10">Start</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none text-sm [color-scheme:dark]"
              />
              {!allDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-transparent text-white outline-none text-sm [color-scheme:dark]"
                />
              )}
            </div>
          </div>
        </div>

        {/* End Date/Time */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm text-gray-400 w-10">End</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none text-sm [color-scheme:dark]"
              />
              {!allDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-transparent text-white outline-none text-sm [color-scheme:dark]"
                />
              )}
            </div>
          </div>
        </div>

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="px-4 py-2">
            <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Attendees</p>
                  {event.attendees.map((a, i) => (
                    <p key={i} className="text-sm text-white">{a.name || a.email}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full bg-transparent text-white placeholder-gray-500 outline-none text-sm resize-none"
            />
          </div>
        </div>

        {/* Read-only notice */}
        {!isWritable && (
          <div className="mx-4 mb-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400">{getReadOnlyReason()}</p>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 pt-2 flex items-center gap-3">
          {isWritable && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          {event.html_link && (
            <a
              href={event.html_link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300"
            >
              Open in Google
            </a>
          )}
          {isWritable && (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Create Event Modal
 */
function CreateEventModal({ initialData, calendars, onClose, onOptimisticAdd, onReplaceTemp, onRemoveTemp }) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [allDay, setAllDay] = useState(initialData?.allDay || false);
  const [startDate, setStartDate] = useState(() => format(initialData?.date || new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00');
  const [endDate, setEndDate] = useState(() => format(initialData?.endDate || initialData?.date || new Date(), 'yyyy-MM-dd'));
  const [endTime, setEndTime] = useState(initialData?.endTime || '10:00');
  const [selectedCalendarId, setSelectedCalendarId] = useState(calendars[0]?.id || '');
  const [error, setError] = useState(null);

  const selectedCalendar = calendars.find(c => c.id === selectedCalendarId);
  const color = selectedCalendar?.color || '#6366f1';

  // Build ISO string from date and time
  const buildDateTime = (dateStr, timeStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(year, month - 1, day, hours, minutes);
    return d.toISOString();
  };

  // Create event
  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (!selectedCalendarId) {
      setError('Please select a calendar');
      return;
    }

    // Validate time range for non-all-day events
    if (!allDay) {
      const startDT = new Date(buildDateTime(startDate, startTime));
      const endDT = new Date(buildDateTime(endDate, endTime));
      if (endDT <= startDT) {
        setError('End time must be after start time');
        return;
      }
    }

    const startDateTime = allDay
      ? new Date(startDate + 'T00:00:00').toISOString()
      : buildDateTime(startDate, startTime);
    const endDateTime = allDay
      ? new Date(endDate + 'T23:59:59').toISOString()
      : buildDateTime(endDate, endTime);

    // Create optimistic event with temp ID
    const tempId = `temp-${Date.now()}`;
    const optimisticEvent = {
      id: tempId,
      calendar_id: selectedCalendarId,
      title,
      location: location || null,
      description: description || null,
      start: startDateTime,
      end: endDateTime,
      all_day: allDay,
      provider: 'google',
    };

    // Add to UI and close modal
    onOptimisticAdd?.(optimisticEvent);
    onClose();

    // Create in background
    try {
      const createdEvent = await calendarService.events.createEvent(selectedCalendarId, {
        title,
        location: location || null,
        description: description || null,
        start: startDateTime,
        end: endDateTime,
        allDay
      });
      // Replace temp event with real one
      onReplaceTemp?.(tempId, createdEvent);
      toast.success('Event created', { description: title });
    } catch (err) {
      console.error('Failed to create event:', err);
      // Remove optimistic event
      onRemoveTemp?.(tempId);
      toast.error('Failed to create event', { description: err.message });
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#2c2c2e] rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with calendar color */}
        <div className="h-1.5" style={{ backgroundColor: color }} />

        {/* Title */}
        <div className="p-4 pb-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New Event"
            className="w-full text-xl font-semibold bg-transparent text-white placeholder-gray-500 outline-none"
            autoFocus
          />
        </div>

        {/* Calendar selector */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <select
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none text-sm [color-scheme:dark]"
              >
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id}>{cal.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Location */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-3 bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* All Day Toggle */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-between bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <span className="text-sm text-white">All-day</span>
            <button
              type="button"
              onClick={() => setAllDay(!allDay)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                allDay ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  allDay ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Start Date/Time */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-400 w-10">Start</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none text-sm [color-scheme:dark]"
              />
              {!allDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-transparent text-white outline-none text-sm [color-scheme:dark]"
                />
              )}
            </div>
          </div>
        </div>

        {/* End Date/Time */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm text-gray-400 w-10">End</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none text-sm [color-scheme:dark]"
              />
              {!allDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-transparent text-white outline-none text-sm [color-scheme:dark]"
                />
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="px-4 py-2">
          <div className="bg-[#1c1c1e] rounded-lg px-3 py-2.5">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes..."
              rows={2}
              className="w-full bg-transparent text-white placeholder-gray-500 outline-none text-sm resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Calendar Context Menu Component
 *
 * Displays context-aware menu options based on what was right-clicked
 */
function CalendarContextMenu({ x, y, type, data, calendars, onAction, onClose }) {
  const menuRef = useRef(null);

  // Adjust position to keep menu in viewport
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust X if menu would overflow right edge
      if (x + rect.width > viewportWidth - 10) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // Adjust Y if menu would overflow bottom edge
      if (y + rect.height > viewportHeight - 10) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Get the calendar for the event (if applicable)
  const getEventCalendar = () => {
    if (type !== 'event' || !data?.event) return null;
    return calendars?.find(c => c.id === data.event.calendar_id);
  };

  const eventCalendar = getEventCalendar();
  const isEventWritable = eventCalendar?.is_writable !== false;
  const hasWritableCalendar = calendars?.some(c => c.is_writable !== false);

  // Determine which menu items to show based on type
  const getMenuItems = () => {
    switch (type) {
      case 'event':
        // Right-clicked on an event
        return [
          {
            id: 'edit',
            label: 'Edit Event',
            icon: Edit3,
            action: 'edit',
          },
          ...(isEventWritable ? [{
            id: 'delete',
            label: 'Delete Event',
            icon: Trash2,
            action: 'delete',
            danger: true,
          }] : []),
          {
            id: 'duplicate',
            label: 'Duplicate Event',
            icon: Copy,
            action: 'duplicate',
            disabled: !hasWritableCalendar,
          },
          { id: 'divider1', divider: true },
          ...(data?.event?.html_link ? [{
            id: 'openExternal',
            label: 'Open in Google Calendar',
            icon: ExternalLink,
            action: 'openExternal',
          }] : []),
        ].filter(Boolean);

      case 'timeSlot':
        // Right-clicked on a time slot
        return [
          ...(hasWritableCalendar ? [{
            id: 'create',
            label: 'Create Event Here',
            icon: CalendarPlus,
            action: 'create',
          }] : []),
          { id: 'divider1', divider: true },
          {
            id: 'goToDay',
            label: 'Go to Day View',
            icon: Eye,
            action: 'goToDay',
          },
        ];

      case 'dayCell':
        // Right-clicked on a day cell (month view)
        return [
          ...(hasWritableCalendar ? [{
            id: 'create',
            label: 'Create Event',
            icon: CalendarPlus,
            action: 'create',
          }] : []),
          { id: 'divider1', divider: true },
          {
            id: 'goToDay',
            label: 'View Day',
            icon: Eye,
            action: 'goToDay',
          },
        ];

      case 'allDaySlot':
        // Right-clicked on all-day section
        return [
          ...(hasWritableCalendar ? [{
            id: 'create',
            label: 'Create All-Day Event',
            icon: CalendarPlus,
            action: 'create',
          }] : []),
          { id: 'divider1', divider: true },
          {
            id: 'goToDay',
            label: 'View Day',
            icon: Eye,
            action: 'goToDay',
          },
        ];

      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  if (menuItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] bg-[#2c2c2e] rounded-lg shadow-2xl border border-white/10 py-1 overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={item.id}
              className="my-1 border-t border-white/10"
            />
          );
        }

        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (!item.disabled) {
                onAction(item.action);
              }
            }}
            disabled={item.disabled}
            className={`
              w-full px-3 py-2 text-left text-sm flex items-center gap-3 transition-colors
              ${item.disabled
                ? 'text-gray-500 cursor-not-allowed'
                : item.danger
                  ? 'text-red-400 hover:bg-red-500/20'
                  : 'text-white hover:bg-white/10'
              }
            `}
          >
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
