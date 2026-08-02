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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import dailyNotesManager from '../../core/daily-notes/manager.js';

/**
 * Daily Notes Calendar Component
 *
 * Compact monthly calendar for daily-note navigation, flat against the
 * sidebar (no box-in-box chrome). Accent appears only as a tint: today is
 * accent text, the selected day an accent-tinted pill, existing notes a dot.
 */
export default function DailyNotesCalendar({ onDateSelect, workspacePath }) {
  const [currentMonth, setCurrentMonth] = useState(startOfToday());
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [noteDates, setNoteDates] = useState(new Set());

  // Load existing daily notes when workspace or month changes
  useEffect(() => {
    if (!workspacePath) return;

    const loadNoteDates = async () => {
      try {
        const dailyNotes = await dailyNotesManager.listDailyNotes();
        setNoteDates(new Set(
          dailyNotes.map(note => format(note.date, 'yyyy-MM-dd'))
        ));
      } catch { }
    };

    loadNoteDates();
  }, [workspacePath, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [currentMonth]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const handleToday = () => {
    const today = startOfToday();
    setCurrentMonth(today);
    handleDateClick(today);
  };

  const hasNote = (date) => noteDates.has(format(date, 'yyyy-MM-dd'));
  const viewingToday = isSameMonth(currentMonth, startOfToday());

  return (
    <div className="flex flex-col">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-app-text pl-1">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-0.5">
          {!viewingToday && (
            <button
              onClick={handleToday}
              className="px-1.5 py-0.5 text-[11px] rounded text-app-accent hover:bg-app-accent/10 transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
            className="p-1 rounded hover:bg-[rgb(var(--text)/0.07)] transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-app-muted" />
          </button>
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="p-1 rounded hover:bg-[rgb(var(--text)/0.07)] transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5 text-app-muted" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-center text-[10px] font-medium text-app-muted/70 py-0.5">
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
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
                relative h-7 w-full flex items-center justify-center text-xs rounded-md transition-colors
                ${!isCurrentMonth ? 'text-app-muted/25 cursor-default' : ''}
                ${isCurrentMonth && !isSelected && !isTodayDate ? 'text-app-muted hover:text-app-text hover:bg-[rgb(var(--text)/0.06)]' : ''}
                ${isTodayDate && !isSelected ? 'text-app-accent font-semibold hover:bg-app-accent/10' : ''}
                ${isSelected ? 'bg-app-accent/20 text-app-accent font-semibold' : ''}
              `}
              title={format(date, 'MMMM d, yyyy')}
            >
              {format(date, 'd')}
              {noteExists && isCurrentMonth && (
                <span className="absolute bottom-1 w-[3px] h-[3px] rounded-full bg-app-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
