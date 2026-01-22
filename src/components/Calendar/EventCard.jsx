import React from 'react';
import { Clock, MapPin, Users, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';

/**
 * Event Card Component
 *
 * Displays a calendar event with title, time, location, and attendees
 */
export default function EventCard({ event, compact = false, onClick }) {
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
          <div className="text-sm truncate">{event.title}</div>
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
      <div className="font-medium text-app-text mb-1">
        {event.title}
        {event.status === 'tentative' && (
          <span className="ml-2 text-xs text-yellow-500">(Tentative)</span>
        )}
        {event.status === 'cancelled' && (
          <span className="ml-2 text-xs text-red-500">(Cancelled)</span>
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
    </div>
  );
}

/**
 * Event List Component
 *
 * Displays a list of events with optional grouping
 */
export function EventList({ events, title, emptyMessage = 'No events', onEventClick }) {
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
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
          />
        ))}
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
