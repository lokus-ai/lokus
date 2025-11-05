import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import DailyNotesCalendar from './Calendar.jsx';

/**
 * Date Picker Modal
 *
 * Modal dialog for selecting a date to jump to
 * - Visual calendar picker
 * - Text input for direct date entry
 * - Quick access to today
 */
export default function DatePickerModal({ isOpen, onClose, onDateSelect, workspacePath }) {
  const [dateInput, setDateInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDateInputChange = (e) => {
    setDateInput(e.target.value);
    setError('');
  };

  const handleDateInputSubmit = () => {
    if (!dateInput) return;

    // Try to parse the input date
    // Support multiple formats
    const formats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'MMMM d, yyyy',
      'MMM d, yyyy'
    ];

    let parsedDate = null;
    for (const fmt of formats) {
      try {
        const date = parse(dateInput, fmt, new Date());
        if (isValid(date)) {
          parsedDate = date;
          break;
        }
      } catch (e) {
        // Try next format
      }
    }

    if (parsedDate) {
      onDateSelect(parsedDate);
      setDateInput('');
      setError('');
    } else {
      setError('Invalid date format. Try: YYYY-MM-DD or MM/DD/YYYY');
    }
  };

  const handleCalendarSelect = (date) => {
    onDateSelect(date);
    setDateInput('');
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleDateInputSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-app-panel border border-app-border rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-app-accent" />
            <h2 className="text-sm font-semibold">Jump to Date</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-app-bg rounded transition-colors"
          >
            <X className="w-4 h-4 text-app-muted" />
          </button>
        </div>

        {/* Date Input */}
        <div className="p-4 border-b border-app-border">
          <label className="block text-xs font-medium text-app-muted mb-2">
            Enter Date
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={dateInput}
              onChange={handleDateInputChange}
              onKeyDown={handleKeyDown}
              placeholder="YYYY-MM-DD or MM/DD/YYYY"
              className="flex-1 px-3 py-2 text-sm bg-app-bg border border-app-border rounded outline-none focus:border-app-accent"
              autoFocus
            />
            <button
              onClick={handleDateInputSubmit}
              className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded hover:opacity-90 transition-opacity"
            >
              Go
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs text-red-500">
              {error}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="p-4">
          <DailyNotesCalendar
            workspacePath={workspacePath}
            onDateSelect={handleCalendarSelect}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-app-border bg-app-panel/50 flex justify-between items-center">
          <div className="text-xs text-app-muted">
            Click a date or type to jump
          </div>
          <button
            onClick={() => handleCalendarSelect(new Date())}
            className="px-3 py-1.5 text-xs bg-app-bg border border-app-border rounded hover:bg-app-panel transition-colors"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
}
