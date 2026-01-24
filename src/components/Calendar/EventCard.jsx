import React from 'react';
import { Clock, MapPin, Users, ExternalLink, Lock, Copy, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';

/**
 * Event Card Component
 *
 * Displays a calendar event with title, time, location, and attendees
 * Supports deduplicated events with also_in indicator and read-only badges
 *
 * @param {Object} event - The calendar event
 * @param {boolean} compact - Whether to show compact view
 * @param {Function} onClick - Click handler
 * @param {Array} alsoIn - Array of CalendarProviderInfo for duplicates
 * @param {boolean} isReadOnly - Whether the event is read-only (iCal)
 * @param {string} fingerprint - Event fingerprint for deduplication
 */
export default function EventCard({
  event,
  compact = false,
  onClick,
  alsoIn = [],
  isReadOnly = false,
  fingerprint = null
}) {
  const formatEventTime = () => {
    if (event.all_day) {
      return 'All day';
    }
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  };

  // Get color based on status or provider
  const getStatusColor = () => {
    switch (event.status) {
      case 'tentative':
        return 'border-l-yellow-500 bg-yellow-500/10';
      case 'cancelled':
        return 'border-l-red-500 bg-red-500/10 opacity-60';
      default:
        return 'border-l-app-accent bg-app-accent/10';
    }
  };

  // Format the "also in" tooltip
  const getAlsoInTooltip = () => {
    if (!alsoIn || alsoIn.length === 0) return null;
    const names = alsoIn.map(info => info.calendar_name).join(', ');
    return `Also in: ${names}`;
  };

  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
          hover:bg-app-panel transition-colors
          border-l-2 ${getStatusColor()}
        `}
        onClick={onClick}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="truncate">{event.title}</span>
            {/* Read-only badge */}
            {isReadOnly && (
              <Lock className="w-3 h-3 text-app-muted flex-shrink-0" title="Read-only (iCal)" />
            )}
            {/* Duplicate indicator */}
            {alsoIn && alsoIn.length > 0 && (
              <Layers
                className="w-3 h-3 text-app-muted flex-shrink-0"
                title={getAlsoInTooltip()}
              />
            )}
          </div>
          <div className="text-xs text-app-muted">{formatEventTime()}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        p-3 rounded-lg cursor-pointer
        hover:bg-app-panel transition-colors
        border-l-4 ${getStatusColor()}
      `}
      onClick={onClick}
    >
      {/* Title */}
      <div className="font-medium text-app-text mb-1 flex items-center gap-2">
        <span>{event.title}</span>
        {/* Status indicators */}
        {event.status === 'tentative' && (
          <span className="text-xs text-yellow-500">(Tentative)</span>
        )}
        {event.status === 'cancelled' && (
          <span className="text-xs text-red-500">(Cancelled)</span>
        )}
        {/* Read-only badge */}
        {isReadOnly && (
          <span className="inline-flex items-center gap-1 text-xs text-app-muted bg-app-bg px-1.5 py-0.5 rounded" title="Read-only calendar">
            <Lock className="w-3 h-3" />
            Read-only
          </span>
        )}
      </div>

      {/* Time */}
      <div className="flex items-center gap-1.5 text-sm text-app-muted mb-1">
        <Clock className="w-3.5 h-3.5" />
        <span>{formatEventTime()}</span>
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-center gap-1.5 text-sm text-app-muted mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate">{event.location}</span>
        </div>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-app-muted mb-1">
          <Users className="w-3.5 h-3.5" />
          <span>
            {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Description preview */}
      {event.description && (
        <div className="text-xs text-app-muted mt-2 line-clamp-2">
          {event.description}
        </div>
      )}

      {/* Link to Google Calendar */}
      {event.html_link && (
        <a
          href={event.html_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-app-accent hover:underline mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          Open in Google Calendar
        </a>
      )}

      {/* Also In indicator (duplicates across calendars) */}
      {alsoIn && alsoIn.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-app-muted mt-2 pt-2 border-t border-app-border">
          <Layers className="w-3.5 h-3.5" />
          <span>
            Also in: {alsoIn.map((info, i) => (
              <span key={info.event_id}>
                {i > 0 && ', '}
                <span className="text-app-text-secondary">{info.calendar_name}</span>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Event List Component
 *
 * Displays a list of events with optional grouping
 * Supports both regular events and deduplicated events
 *
 * @param {Array} events - Array of events or deduplicated event objects
 * @param {string} title - Optional section title
 * @param {string} emptyMessage - Message when no events
 * @param {Function} onEventClick - Click handler
 * @param {boolean} deduplicated - Whether events are in deduplicated format
 */
export function EventList({ events, title, emptyMessage = 'No events', onEventClick, deduplicated = false }) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-app-muted text-center py-4">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2">
          {title}
        </h3>
      )}
      <div className="space-y-2">
        {events.map(item => {
          // Handle both regular events and deduplicated event objects
          const event = deduplicated ? item.event : item;
          const alsoIn = deduplicated ? item.also_in : [];
          const isReadOnly = deduplicated ? item.is_read_only : false;
          const fingerprint = deduplicated ? item.fingerprint : null;

          return (
            <EventCard
              key={event.id}
              event={event}
              alsoIn={alsoIn}
              isReadOnly={isReadOnly}
              fingerprint={fingerprint}
              onClick={() => onEventClick?.(event)}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Mini Event Dot Component
 *
 * Small dot indicator for calendar cells
 */
export function EventDot({ event, size = 'sm' }) {
  const getColor = () => {
    switch (event.status) {
      case 'tentative':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-app-accent';
    }
  };

  const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2'
  };

  return (
    <div
      className={`rounded-full ${getColor()} ${sizeClasses[size]}`}
      title={event.title}
    />
  );
}
