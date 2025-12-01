import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';

/**
 * Daily Note Navigation Buttons
 *
 * Shows previous/next day navigation when viewing a daily note
 * Displays prominently in the editor header
 */
export default function NavigationButtons({ currentDate, onNavigate, onShowDatePicker }) {
  if (!currentDate) return null;

  const handlePrevDay = () => {
    const prevDay = subDays(currentDate, 1);
    onNavigate(prevDay);
  };

  const handleNextDay = () => {
    const nextDay = addDays(currentDate, 1);
    onNavigate(nextDay);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-app-panel border-b border-app-border">
      <button
        onClick={handlePrevDay}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-app-bg transition-colors text-app-text"
        title="Previous day (Alt+Left)"
      >
        <ChevronLeft className="w-3 h-3" />
        <span>Previous</span>
      </button>

      <button
        onClick={onShowDatePicker}
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-app-accent/10 hover:bg-app-accent/20 transition-colors text-app-accent"
        title="Jump to date"
      >
        <Calendar className="w-3 h-3" />
        <span>{format(currentDate, 'MMM d, yyyy')}</span>
      </button>

      <button
        onClick={handleNextDay}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-app-bg transition-colors text-app-text"
        title="Next day (Alt+Right)"
      >
        <span>Next</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}
