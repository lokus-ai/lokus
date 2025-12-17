import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react';
import { format, subDays, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import DailyNotesCalendar from './Calendar.jsx';
import dailyNotesManager from '../../core/daily-notes/manager.js';

/**
 * Daily Notes Panel Component
 *
 * Sidebar panel providing quick access to daily notes
 * - Recent daily notes list
 * - Quick access buttons (Today, Yesterday, Tomorrow)
 * - Embedded calendar
 * - Navigation between dates
 */
export default function DailyNotesPanel({ workspacePath, onOpenDailyNote, currentDate }) {
  const [recentNotes, setRecentNotes] = useState([]);
  const [showCalendar, setShowCalendar] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Load recent daily notes
  useEffect(() => {
    if (!workspacePath) return;

    const loadRecentNotes = async () => {
      setIsLoading(true);
      try {
        const allNotes = await dailyNotesManager.listDailyNotes();
        // Get most recent 10 notes
        setRecentNotes(allNotes.slice(0, 10));
      } catch { } finally {
        setIsLoading(false);
      }
    };

    loadRecentNotes();
  }, [workspacePath]);

  const handleDateSelect = async (date) => {
    if (onOpenDailyNote) {
      await onOpenDailyNote(date);
    }
  };

  const handleQuickAccess = async (date) => {
    if (onOpenDailyNote) {
      await onOpenDailyNote(date);
    }
  };

  const getDateLabel = (date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d, yyyy');
  };

  const handlePrevDay = () => {
    if (currentDate) {
      const prevDay = subDays(currentDate, 1);
      handleQuickAccess(prevDay);
    }
  };

  const handleNextDay = () => {
    if (currentDate) {
      const nextDay = addDays(currentDate, 1);
      handleQuickAccess(nextDay);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b border-app-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-app-accent" />
          <h2 className="text-sm font-semibold">Daily Notes</h2>
        </div>
      </div>

      {/* Quick Access Buttons */}
      <div className="p-3 space-y-2 border-b border-app-border">
        <button
          onClick={() => handleQuickAccess(new Date())}
          className="w-full px-3 py-2 text-sm bg-app-accent text-app-accent-fg rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Open Today's Note
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleQuickAccess(subDays(new Date(), 1))}
            className="px-2 py-1.5 text-xs bg-app-bg border border-app-border rounded hover:bg-app-panel transition-colors"
          >
            Yesterday
          </button>
          <button
            onClick={() => handleQuickAccess(addDays(new Date(), 1))}
            className="px-2 py-1.5 text-xs bg-app-bg border border-app-border rounded hover:bg-app-panel transition-colors"
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Current Date Navigation (if viewing a daily note) */}
      {currentDate && (
        <div className="px-3 py-2 border-b border-app-border bg-app-panel/50">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevDay}
              className="p-1 hover:bg-app-bg rounded transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4 text-app-text" />
            </button>

            <div className="text-xs font-medium text-app-text">
              {getDateLabel(currentDate)}
            </div>

            <button
              onClick={handleNextDay}
              className="p-1 hover:bg-app-bg rounded transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4 text-app-text" />
            </button>
          </div>
        </div>
      )}

      {/* Calendar Toggle */}
      <div className="px-3 py-2 border-b border-app-border">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full flex items-center justify-between text-xs text-app-muted hover:text-app-text transition-colors"
        >
          <span>Calendar View</span>
          <ChevronRight
            className={`w-3 h-3 transition-transform ${showCalendar ? 'rotate-90' : ''}`}
          />
        </button>
      </div>

      {/* Calendar */}
      {showCalendar && (
        <div className="p-3 border-b border-app-border">
          <DailyNotesCalendar
            workspacePath={workspacePath}
            onDateSelect={handleDateSelect}
          />
        </div>
      )}

      {/* Recent Notes List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3 h-3 text-app-muted" />
            <h3 className="text-xs font-semibold text-app-muted uppercase tracking-wide">
              Recent Notes
            </h3>
          </div>

          {isLoading ? (
            <div className="text-xs text-app-muted py-4 text-center">
              Loading...
            </div>
          ) : recentNotes.length === 0 ? (
            <div className="text-xs text-app-muted py-4 text-center">
              No daily notes yet
            </div>
          ) : (
            <div className="space-y-1">
              {recentNotes.map((note) => (
                <button
                  key={note.path}
                  onClick={() => handleDateSelect(note.date)}
                  className="w-full px-2 py-1.5 text-left rounded hover:bg-app-bg transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-3 h-3 text-app-muted mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-app-text truncate">
                        {getDateLabel(note.date)}
                      </div>
                      <div className="text-xs text-app-muted">
                        {format(note.date, 'EEE')}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
