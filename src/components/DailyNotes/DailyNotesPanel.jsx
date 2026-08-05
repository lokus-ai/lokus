import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { format, subDays, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import DailyNotesCalendar from './Calendar.jsx';
import dailyNotesManager from '../../core/daily-notes/manager.js';

/**
 * Daily Notes Panel Component
 *
 * Sidebar panel providing quick access to daily notes. Styled to match the
 * app's muted chrome (file tree / outline): quiet surfaces, accent used as
 * a tint, no solid color slabs.
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
      handleQuickAccess(subDays(currentDate, 1));
    }
  };

  const handleNextDay = () => {
    if (currentDate) {
      handleQuickAccess(addDays(currentDate, 1));
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-panel">
      {/* Header */}
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-app-muted">
          Daily Notes
        </h2>
      </div>

      {/* Quick access: Yesterday · Today · Tomorrow */}
      <div className="px-3 py-2">
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => handleQuickAccess(subDays(new Date(), 1))}
            className="px-2 py-1.5 text-xs rounded-md text-app-muted hover:text-app-text hover:bg-[rgb(var(--text)/0.06)] transition-colors"
          >
            Yesterday
          </button>
          <button
            onClick={() => handleQuickAccess(new Date())}
            className="px-2 py-1.5 text-xs font-medium rounded-md bg-app-accent/15 text-app-accent hover:bg-app-accent/25 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => handleQuickAccess(addDays(new Date(), 1))}
            className="px-2 py-1.5 text-xs rounded-md text-app-muted hover:text-app-text hover:bg-[rgb(var(--text)/0.06)] transition-colors"
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Current date navigation (when viewing a daily note) */}
      {currentDate && (
        <div className="px-3 py-1.5">
          <div className="flex items-center justify-between rounded-md bg-[rgb(var(--text)/0.04)] px-1 py-0.5">
            <button
              onClick={handlePrevDay}
              className="p-1 rounded hover:bg-[rgb(var(--text)/0.07)] transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-app-muted" />
            </button>

            <div className="text-xs font-medium text-app-text">
              {getDateLabel(currentDate)}
            </div>

            <button
              onClick={handleNextDay}
              className="p-1 rounded hover:bg-[rgb(var(--text)/0.07)] transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-3.5 h-3.5 text-app-muted" />
            </button>
          </div>
        </div>
      )}

      {/* Calendar section */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-app-muted hover:text-app-text transition-colors"
        >
          <ChevronRight
            className={`w-3 h-3 transition-transform ${showCalendar ? 'rotate-90' : ''}`}
          />
          <span>Calendar</span>
        </button>
      </div>

      {showCalendar && (
        <div className="px-3 py-2">
          <DailyNotesCalendar
            workspacePath={workspacePath}
            onDateSelect={handleDateSelect}
          />
        </div>
      )}

      {/* Recent notes */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-app-muted mb-1">
            Recent
          </h3>

          {isLoading ? (
            <div className="text-xs text-app-muted py-3">Loading…</div>
          ) : recentNotes.length === 0 ? (
            <div className="text-xs text-app-muted/70 py-3">No daily notes yet</div>
          ) : (
            <div>
              {recentNotes.map((note) => (
                <button
                  key={note.path}
                  onClick={() => handleDateSelect(note.date)}
                  className="w-full flex items-center gap-2 px-2 py-1 min-h-[26px] text-left rounded-[5px] text-app-muted hover:text-app-text hover:bg-[rgb(var(--text)/0.06)] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-70" style={{ strokeWidth: 1.75 }} />
                  <span className="text-xs truncate flex-1">{getDateLabel(note.date)}</span>
                  <span className="text-[11px] text-app-muted/60 flex-shrink-0">{format(note.date, 'EEE')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
