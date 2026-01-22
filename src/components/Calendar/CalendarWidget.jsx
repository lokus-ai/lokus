import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  Clock,
  RefreshCw,
  ExternalLink,
  Plus,
  Settings,
  Loader2,
  X
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns';
import { useCalendarContext } from '../../contexts/CalendarContext.jsx';

/**
 * Calendar Widget Component
 *
 * Sidebar widget providing quick access to calendar events
 * - Connection status and connect button
 * - Today's events
 * - Upcoming events (next 7 days)
 * - Quick sync button
 */
export default function CalendarWidget({ onOpenCalendarView, onOpenSettings }) {
  const {
    isAuthenticated,
    account,
    authLoading,
    connectGoogle,
    disconnect,
    upcomingEvents,
    upcomingEventsLoading,
    eventsByDate,
    todayEvents,
    syncInProgress,
    triggerSync,
    refreshUpcomingEvents
  } = useCalendarContext();

  const [showUpcoming, setShowUpcoming] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle Google Calendar connection
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connectGoogle();
    } catch (error) {
      console.error('Failed to connect Google Calendar:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle disconnect - disconnect the active provider
  const handleDisconnect = async () => {
    try {
      const provider = account?.provider || 'google';
      await disconnect(provider);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Get the provider name for display
  const getProviderName = () => {
    if (account?.provider === 'caldav') return 'iCloud Calendar';
    return 'Google Calendar';
  };

  // Format event time
  const formatEventTime = (event) => {
    if (event.all_day) {
      return 'All day';
    }
    const start = parseISO(event.start);
    return format(start, 'h:mm a');
  };

  // Get date label
  const getDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  // Sort upcoming dates
  const sortedDates = useMemo(() => {
    return Object.keys(eventsByDate).sort((a, b) => new Date(a) - new Date(b));
  }, [eventsByDate]);

  // Loading state - show spinner while checking auth
  if (authLoading) {
    return (
      <div className="flex flex-col h-full bg-app-panel">
        {/* Header */}
        <div className="px-3 py-2 border-b border-app-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-app-accent" />
            <h2 className="text-sm font-semibold">Calendar</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-app-muted" />
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full bg-app-panel">
        {/* Header */}
        <div className="px-3 py-2 border-b border-app-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-app-accent" />
            <h2 className="text-sm font-semibold">Calendar</h2>
          </div>
        </div>

        {/* Connect prompt */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <Calendar className="w-12 h-12 text-app-muted mb-4 opacity-50" />
          <h3 className="text-sm font-medium text-app-text mb-2">
            Connect Your Calendar
          </h3>
          <p className="text-xs text-app-muted mb-4 max-w-[200px]">
            Connect Google Calendar or iCloud to see your events in Lokus
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleConnect}
              disabled={isConnecting || authLoading}
              className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isConnecting || authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Connect Google
                </>
              )}
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-4 py-2 text-sm text-app-muted hover:text-app-text transition-colors flex items-center gap-2 justify-center"
              >
                <Settings className="w-4 h-4" />
                More options (iCloud)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="flex flex-col h-full bg-app-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b border-app-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-app-accent" />
            <h2 className="text-sm font-semibold">Calendar</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => triggerSync()}
              disabled={syncInProgress}
              className="p-1 hover:bg-app-bg rounded transition-colors"
              title="Sync calendars"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-app-muted ${syncInProgress ? 'animate-spin' : ''}`} />
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-1 hover:bg-app-bg rounded transition-colors"
                title="Calendar settings"
              >
                <Settings className="w-3.5 h-3.5 text-app-muted" />
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm(`Disconnect from ${getProviderName()}?`)) {
                  handleDisconnect();
                }
              }}
              className="p-1 hover:bg-app-bg rounded transition-colors"
              title={`Disconnect ${getProviderName()}`}
            >
              <X className="w-3.5 h-3.5 text-app-muted" />
            </button>
          </div>
        </div>
        {/* Account info */}
        {account && (
          <div className="text-xs text-app-muted mt-1 truncate">
            {account.email}
          </div>
        )}
      </div>

      {/* Today's Events */}
      <div className="px-3 py-2 border-b border-app-border">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3 h-3 text-app-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">Today</h3>
          <span className="text-xs text-app-muted">
            ({todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''})
          </span>
        </div>

        {upcomingEventsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-app-muted" />
          </div>
        ) : todayEvents.length === 0 ? (
          <div className="text-xs text-app-muted py-2 text-center">
            No events today
          </div>
        ) : (
          <div className="space-y-1">
            {todayEvents.slice(0, 3).map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
            {todayEvents.length > 3 && (
              <button
                onClick={onOpenCalendarView}
                className="text-xs text-app-accent hover:underline"
              >
                +{todayEvents.length - 3} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Events Toggle */}
      <div className="px-3 py-2 border-b border-app-border">
        <button
          onClick={() => setShowUpcoming(!showUpcoming)}
          className="w-full flex items-center justify-between text-xs text-app-muted hover:text-app-text transition-colors"
        >
          <span>Upcoming Events</span>
          <ChevronRight
            className={`w-3 h-3 transition-transform ${showUpcoming ? 'rotate-90' : ''}`}
          />
        </button>
      </div>

      {/* Upcoming Events List */}
      {showUpcoming && (
        <div className="flex-1 overflow-y-auto">
          {upcomingEventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-app-muted" />
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="text-xs text-app-muted py-8 text-center">
              No upcoming events
            </div>
          ) : (
            <div className="divide-y divide-app-border">
              {sortedDates.slice(0, 7).map((dateStr) => (
                <div key={dateStr} className="px-3 py-2">
                  <div className="text-xs font-medium text-app-muted mb-1">
                    {getDateLabel(dateStr)}
                  </div>
                  <div className="space-y-1">
                    {eventsByDate[dateStr].slice(0, 3).map((event) => (
                      <EventItem key={event.id} event={event} compact />
                    ))}
                    {eventsByDate[dateStr].length > 3 && (
                      <div className="text-xs text-app-muted">
                        +{eventsByDate[dateStr].length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open Full Calendar */}
      {onOpenCalendarView && (
        <div className="px-3 py-2 border-t border-app-border">
          <button
            onClick={onOpenCalendarView}
            className="w-full px-3 py-2 text-xs bg-app-bg border border-app-border rounded hover:bg-app-panel transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-3 h-3" />
            Open Calendar View
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Event Item Component
 */
function EventItem({ event, compact = false }) {
  const formatEventTime = (evt) => {
    if (evt.all_day) {
      return 'All day';
    }
    const start = parseISO(evt.start);
    return format(start, 'h:mm a');
  };

  // Get color indicator based on calendar (could be extended)
  const getColorClass = () => {
    // Default to accent color, could use event.color_id or calendar color
    return 'bg-app-accent';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className={`w-1.5 h-1.5 rounded-full ${getColorClass()} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-app-text truncate">
            {event.title}
          </div>
        </div>
        <div className="text-xs text-app-muted flex-shrink-0">
          {formatEventTime(event)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded hover:bg-app-bg transition-colors group">
      <div className={`w-2 h-2 rounded-full ${getColorClass()} mt-1.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-app-text font-medium truncate">
          {event.title}
        </div>
        <div className="text-xs text-app-muted">
          {formatEventTime(event)}
          {event.location && (
            <span className="ml-2">{event.location}</span>
          )}
        </div>
      </div>
      {event.html_link && (
        <a
          href={event.html_link}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open in Google Calendar"
        >
          <ExternalLink className="w-3 h-3 text-app-muted" />
        </a>
      )}
    </div>
  );
}
