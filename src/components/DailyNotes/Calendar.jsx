import React, { useState, useEffect, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import dailyNotesManager from '../../core/daily-notes/manager.js';

/**
 * Daily Notes Calendar Component
 *
 * Interactive monthly calendar for daily notes navigation
 * - Click dates to open/create daily notes
 * - Visual indicators for existing notes
 * - Month navigation
 * - Highlights today's date
 */
export default function DailyNotesCalendar({ onDateSelect, workspacePath }) {
  const [currentMonth, setCurrentMonth] = useState(startOfToday());
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [noteDates, setNoteDates] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Load existing daily notes when workspace or month changes
  useEffect(() => {
    if (!workspacePath) return;

    const loadNoteDates = async () => {
      setIsLoading(true);
      try {
        const dailyNotes = await dailyNotesManager.listDailyNotes();
        const dates = new Set(
          dailyNotes.map(note =>
            format(note.date, 'yyyy-MM-dd')
          )
        );
        setNoteDates(dates);
      } catch (error) {
        console.error('Failed to load daily notes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNoteDates();
  }, [workspacePath, currentMonth]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    const today = startOfToday();
    setCurrentMonth(today);
    handleDateClick(today);
  };

  const hasNote = (date) => {
    return noteDates.has(format(date, 'yyyy-MM-dd'));
  };

  return (
    <div className="flex flex-col h-full bg-app-panel border border-app-border rounded-lg overflow-hidden">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-app-border bg-app-panel">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-app-bg rounded transition-colors"
          title="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-app-text" />
        </button>

        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-app-accent" />
          <span className="text-sm font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-app-bg rounded transition-colors"
          title="Next month"
        >
          <ChevronRight className="w-4 h-4 text-app-text" />
        </button>
      </div>

      {/* Today Button */}
      <div className="px-3 py-2 border-b border-app-border">
        <button
          onClick={handleToday}
          className="w-full px-2 py-1 text-xs rounded bg-app-accent text-app-accent-fg hover:opacity-90 transition-opacity"
        >
          Go to Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-3">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-app-muted"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isSelected = isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const noteExists = hasNote(date);

            return (
              <button
                key={index}
                onClick={() => handleDateClick(date)}
                disabled={!isCurrentMonth}
                className={`
                  relative aspect-square flex items-center justify-center text-xs rounded transition-all
                  ${!isCurrentMonth ? 'text-app-muted/30 cursor-default' : 'text-app-text'}
                  ${isTodayDate && !isSelected ? 'bg-app-accent/20 font-semibold text-app-accent' : ''}
                  ${isSelected ? 'bg-app-accent text-app-accent-fg font-semibold ring-2 ring-app-accent' : ''}
                  ${isCurrentMonth && !isSelected && !isTodayDate ? 'hover:bg-app-bg/50' : ''}
                `}
                title={format(date, 'MMMM d, yyyy')}
              >
                <span className="relative z-10">
                  {format(date, 'd')}
                </span>

                {/* Note Indicator Dot */}
                {noteExists && isCurrentMonth && (
                  <span
                    className={`
                      absolute bottom-0.5 w-1 h-1 rounded-full
                      ${isSelected ? 'bg-app-accent-fg' : 'bg-app-accent'}
                    `}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer with Stats */}
      <div className="px-3 py-2 border-t border-app-border bg-app-panel/50">
        <div className="text-xs text-app-muted text-center">
          {isLoading ? (
            'Loading notes...'
          ) : (
            `${noteDates.size} notes total`
          )}
        </div>
      </div>
    </div>
  );
}
