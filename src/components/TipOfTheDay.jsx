import React, { useState, useEffect } from 'react';
import { Lightbulb, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTips } from '../contexts/RemoteConfigContext';

const STORAGE_KEY = 'lokus_tip_state';

/**
 * TipOfTheDay - Displays rotating tips from server config
 *
 * Server config example:
 * {
 *   "tips": {
 *     "enabled": true,
 *     "items": [
 *       { "id": "tip-1", "text": "Use [[double brackets]] to create wiki links" },
 *       { "id": "tip-2", "text": "Press Cmd+K to insert a link quickly" },
 *       { "id": "tip-3", "text": "Type / to access slash commands" }
 *     ]
 *   }
 * }
 */
const TipOfTheDay = ({ position = 'bottom' }) => {
  const tips = useTips();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [dismissedToday, setDismissedToday] = useState(false);

  // Load saved state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        const today = new Date().toDateString();

        // If dismissed today, keep it dismissed
        if (state.dismissedDate === today) {
          setDismissedToday(true);
        }

        // Set the current tip index
        if (typeof state.lastIndex === 'number' && tips?.items?.length) {
          // Move to next tip each day
          const nextIndex = (state.lastIndex + 1) % tips.items.length;
          setCurrentIndex(nextIndex);
        }
      }
    } catch {
      // Ignore errors
    }
  }, [tips?.items?.length]);

  // Save state when index changes
  useEffect(() => {
    if (tips?.items?.length) {
      const state = {
        lastIndex: currentIndex,
        dismissedDate: dismissedToday ? new Date().toDateString() : null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [currentIndex, dismissedToday, tips?.items?.length]);

  const handleDismissToday = () => {
    setDismissedToday(true);
    const state = {
      lastIndex: currentIndex,
      dismissedDate: new Date().toDateString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const handlePrevTip = () => {
    if (tips?.items?.length) {
      setCurrentIndex((prev) => (prev - 1 + tips.items.length) % tips.items.length);
    }
  };

  const handleNextTip = () => {
    if (tips?.items?.length) {
      setCurrentIndex((prev) => (prev + 1) % tips.items.length);
    }
  };

  // Don't render if tips are disabled or no tips available
  if (!tips?.enabled || !tips?.items?.length) return null;
  if (dismissed || dismissedToday) return null;

  const currentTip = tips.items[currentIndex];
  if (!currentTip) return null;

  const positionClasses = position === 'bottom'
    ? 'fixed bottom-4 left-1/2 -translate-x-1/2'
    : 'relative';

  return (
    <div className={`${positionClasses} z-40 max-w-md w-full mx-4`}>
      <div className="bg-app-panel border border-app-border rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 p-1.5 bg-yellow-500/10 rounded-lg">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-app-muted uppercase tracking-wide">
                Tip
              </span>
              {tips.items.length > 1 && (
                <span className="text-xs text-app-muted">
                  {currentIndex + 1}/{tips.items.length}
                </span>
              )}
            </div>
            <p className="text-sm text-app-text">{currentTip.text}</p>
          </div>

          {/* Navigation & Close */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {tips.items.length > 1 && (
              <>
                <button
                  onClick={handlePrevTip}
                  className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
                  aria-label="Previous tip"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextTip}
                  className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
                  aria-label="Next tip"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={handleDismissToday}
              className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text ml-1"
              aria-label="Dismiss for today"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TipOfTheDay;
