import React from 'react';
import { X } from 'lucide-react';
import './ProgressIndicator.css';

export function ProgressIndicator({
  title,
  message,
  percentage,
  cancellable = false,
  onCancel,
  location = 'notification' // 'notification' | 'window' | 'source-control'
}) {
  const showPercentage = percentage !== undefined && percentage !== null;
  const isIndeterminate = !showPercentage;

  return (
    <div className={`progress-indicator progress-${location}`}>
      <div className="progress-header">
        {title && <div className="progress-title">{title}</div>}
        {cancellable && (
          <button
            className="progress-cancel-button"
            onClick={onCancel}
            title="Cancel"
            aria-label="Cancel operation"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {message && <div className="progress-message">{message}</div>}
      <div className="progress-bar-container">
        <div
          className={`progress-bar-fill ${isIndeterminate ? 'indeterminate' : ''}`}
          style={showPercentage ? { width: `${Math.min(Math.max(percentage, 0), 100)}%` } : {}}
        />
      </div>
      {showPercentage && (
        <div className="progress-percentage">{Math.round(percentage)}%</div>
      )}
    </div>
  );
}

// Wrapper component for managing multiple progress indicators
export function ProgressIndicatorContainer({ progressItems = [] }) {
  if (progressItems.length === 0) return null;

  return (
    <div className="progress-indicator-container">
      {progressItems.map((item, index) => (
        <ProgressIndicator key={item.id || index} {...item} />
      ))}
    </div>
  );
}
