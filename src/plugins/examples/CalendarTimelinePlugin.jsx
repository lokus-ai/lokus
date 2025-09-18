/**
 * CalendarTimelinePlugin.js - Calendar & Timeline View Plugin
 * 
 * Provides calendar and timeline views for notes and tasks,
 * allowing users to visualize their content chronologically.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { uiAPI, PANEL_POSITIONS, PANEL_TYPES } from '../api/UIAPI.js';
import { invoke } from '@tauri-apps/api/core';
import { 
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Search,
  FileText,
  CheckSquare,
  Grid,
  List
} from 'lucide-react';

// Calendar component
const CalendarView = ({ onDateSelect, selectedDate, events }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const dayEvents = events[dateString] || [];
      
      days.push({
        date,
        day,
        events: dayEvents,
        isToday: date.toDateString() === new Date().toDateString(),
        isSelected: selectedDate && date.toDateString() === selectedDate.toDateString()
      });
    }
    
    return days;
  }, [currentMonth, events, selectedDate]);

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  return (
    <div className="p-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-app-text">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-app-border/50 text-app-muted hover:text-app-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 text-xs rounded bg-app-border/50 hover:bg-app-accent hover:text-app-accent-fg text-app-text transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-app-border/50 text-app-muted hover:text-app-text transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-app-muted">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {daysInMonth.map((day, index) => (
          <div
            key={index}
            className={`
              h-12 p-1 border border-app-border/30 cursor-pointer transition-colors
              ${day ? 'hover:bg-app-border/20' : ''}
              ${day?.isToday ? 'bg-app-accent/10 border-app-accent/30' : ''}
              ${day?.isSelected ? 'bg-app-accent/20 border-app-accent' : ''}
            `}
            onClick={() => day && onDateSelect(day.date)}
          >
            {day && (
              <div className="h-full flex flex-col">
                <div className={`text-xs ${day.isToday ? 'text-app-accent font-medium' : 'text-app-text'}`}>
                  {day.day}
                </div>
                {day.events.length > 0 && (
                  <div className="flex-1 flex flex-wrap gap-0.5 mt-1">
                    {day.events.slice(0, 2).map((event, i) => (
                      <div
                        key={i}
                        className={`
                          w-1.5 h-1.5 rounded-full
                          ${event.type === 'note' ? 'bg-app-accent' : 'bg-app-success'}
                        `}
                        title={event.title}
                      />
                    ))}
                    {day.events.length > 2 && (
                      <div className="text-xs text-app-muted">+{day.events.length - 2}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Timeline component
const TimelineView = ({ events, onEventClick }) => {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = useMemo(() => {
    let filtered = Object.entries(events).flatMap(([date, dayEvents]) =>
      dayEvents.map(event => ({ ...event, date }))
    );

    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.type === filterType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.content?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [events, filterType, searchQuery]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className="p-4">
      {/* Timeline controls */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-app-muted" />
          <input
            type="text"
            placeholder="Search timeline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1 bg-app-bg border border-app-border rounded text-sm text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-app-muted" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-1 bg-app-bg border border-app-border rounded text-sm text-app-text focus:outline-none focus:border-app-accent"
          >
            <option value="all">All Events</option>
            <option value="note">Notes</option>
            <option value="task">Tasks</option>
          </select>
        </div>
      </div>

      {/* Timeline events */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-app-muted">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events found</p>
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <div
              key={`${event.date}-${index}`}
              className="flex gap-3 cursor-pointer group"
              onClick={() => onEventClick(event)}
            >
              {/* Timeline marker */}
              <div className="flex flex-col items-center">
                <div className={`
                  w-3 h-3 rounded-full flex-shrink-0 mt-1
                  ${event.type === 'note' ? 'bg-app-accent' : 'bg-app-success'}
                `} />
                {index < filteredEvents.length - 1 && (
                  <div className="w-px h-full bg-app-border/50 mt-2" />
                )}
              </div>
              
              {/* Event content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  {event.type === 'note' ? (
                    <FileText className="w-4 h-4 text-app-accent" />
                  ) : (
                    <CheckSquare className="w-4 h-4 text-app-success" />
                  )}
                  <h4 className="text-sm font-medium text-app-text group-hover:text-app-accent transition-colors">
                    {event.title}
                  </h4>
                  <span className="text-xs text-app-muted">
                    {formatDate(event.date)}
                  </span>
                </div>
                
                {event.content && (
                  <p className="text-sm text-app-muted line-clamp-2">
                    {event.content}
                  </p>
                )}
                
                {event.tags && event.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {event.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs rounded bg-app-border/50 text-app-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Main Calendar Timeline Panel
const CalendarTimelinePanel = ({ panel }) => {
  const [activeView, setActiveView] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);

  // Load events from workspace
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const workspacePath = window.__LOKUS_WORKSPACE_PATH__;
      if (!workspacePath) return;

      // Load files and extract events
      const files = await invoke('read_workspace_files', { workspacePath });
      const eventsMap = {};

      const processFiles = (fileList) => {
        fileList.forEach(file => {
          if (file.is_directory) {
            if (file.children) {
              processFiles(file.children);
            }
          } else if (file.name.endsWith('.md')) {
            // Extract date from filename or content
            const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              const date = dateMatch[1];
              if (!eventsMap[date]) eventsMap[date] = [];
              
              eventsMap[date].push({
                type: 'note',
                title: file.name.replace(/\.md$/, ''),
                path: file.path,
                content: 'Daily note', // Could read actual content
                tags: []
              });
            }
          }
        }
      };

      processFiles(files);
      setEvents(eventsMap);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    // Could show events for selected date
  }, []);

  const handleEventClick = useCallback((event) => {
    if (event.path) {
      // Open the file
      const openEvent = new CustomEvent('lokus:open-file', { detail: event.path });
      window.dispatchEvent(openEvent);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-app-muted">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between p-4 border-b border-app-border">
        <h2 className="text-lg font-medium text-app-text">Calendar & Timeline</h2>
        
        <div className="flex items-center bg-app-panel rounded">
          <button
            onClick={() => setActiveView('calendar')}
            className={`
              px-3 py-1 text-xs rounded-l flex items-center gap-1 transition-colors
              ${activeView === 'calendar' 
                ? 'bg-app-accent text-app-accent-fg' 
                : 'text-app-muted hover:text-app-text'
              }
            `}
          >
            <Grid className="w-3 h-3" />
            Calendar
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            className={`
              px-3 py-1 text-xs rounded-r flex items-center gap-1 transition-colors
              ${activeView === 'timeline' 
                ? 'bg-app-accent text-app-accent-fg' 
                : 'text-app-muted hover:text-app-text'
              }
            `}
          >
            <List className="w-3 h-3" />
            Timeline
          </button>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-y-auto">
        {activeView === 'calendar' ? (
          <CalendarView
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
            events={events}
          />
        ) : (
          <TimelineView
            events={events}
            onEventClick={handleEventClick}
          />
        )}
      </div>
    </div>
  );
};

// Plugin definition
export const CalendarTimelinePlugin = {
  id: 'calendar-timeline',
  name: 'Calendar & Timeline',
  version: '1.0.0',
  description: 'Provides calendar and timeline views for notes and tasks',
  author: 'Lokus Team',

  activate() {
    console.log('📅 Activating Calendar Timeline Plugin...');
    
    try {
      // Register the calendar timeline panel
      const panel = uiAPI.registerPanel('calendar-timeline', {
        id: 'calendar-timeline-view',
        title: 'Calendar & Timeline',
        type: PANEL_TYPES.REACT,
        position: PANEL_POSITIONS.SIDEBAR_RIGHT,
        component: CalendarTimelinePanel,
        icon: <Calendar className="w-4 h-4" />,
        initialSize: { width: 350, height: 600 },
        minSize: { width: 300, height: 400 },
        resizable: true,
        closable: true,
        visible: false,
        order: 20,
        settings: {
          defaultView: 'calendar',
          showWeekends: true,
          timeFormat: '24h'
        }
      });

      // Register commands
      uiAPI.registerCommand('calendar-timeline', {
        id: 'toggle-calendar',
        title: 'Toggle Calendar & Timeline',
        category: 'View',
        handler: () => {
          uiAPI.togglePanel('calendar-timeline.calendar-timeline-view');
        }
      });

      uiAPI.registerCommand('calendar-timeline', {
        id: 'create-daily-note',
        title: 'Create Daily Note',
        category: 'File',
        handler: () => {
          const today = new Date().toISOString().split('T')[0];
          const event = new CustomEvent('lokus:create-daily-note', { detail: today });
          window.dispatchEvent(event);
        }
      });

      // Register status bar item
      uiAPI.registerStatusBarItem('calendar-timeline', {
        id: 'calendar-status',
        text: new Date().toLocaleDateString(),
        tooltip: 'Today\'s date - Click to open calendar',
        command: 'calendar-timeline.toggle-calendar',
        alignment: 'right',
        priority: 80
      });

      console.log('✅ Calendar Timeline Plugin activated successfully');
      return panel;
      
    } catch (error) {
      console.error('❌ Failed to activate Calendar Timeline Plugin:', error);
      throw error;
    }
  },

  deactivate() {
    console.log('📅 Deactivating Calendar Timeline Plugin...');
    
    try {
      uiAPI.unregisterPlugin('calendar-timeline');
      console.log('✅ Calendar Timeline Plugin deactivated successfully');
    } catch (error) {
      console.error('❌ Failed to deactivate Calendar Timeline Plugin:', error);
      throw error;
    }
  }
};

export default CalendarTimelinePlugin;