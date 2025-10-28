import React, { useState } from 'react';
import { Download, RefreshCw, Check, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export default function UpdateNotification({
  updateState,
  version,
  downloadProgress,
  releaseNotes,
  onUpdate,
  onDismiss,
  error
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no update, idle, or just checking
  if (updateState === 'idle' || updateState === 'checking' || !updateState) return null;

  const getStatusConfig = () => {
    switch (updateState) {
      case 'checking':
        return {
          icon: <RefreshCw className="w-5 h-5 animate-spin" />,
          title: 'Checking for updates...',
          showActions: false
        };
      case 'available':
        return {
          icon: <Download className="w-5 h-5" />,
          title: 'Update Available',
          message: `Version ${version} is ready to download`,
          showActions: true,
          primaryAction: { label: 'Update Now', onClick: onUpdate }
        };
      case 'downloading':
        return {
          icon: <Download className="w-5 h-5" />,
          title: 'Downloading Update',
          message: `${downloadProgress}% complete`,
          showProgress: true,
          showActions: false
        };
      case 'ready':
        return {
          icon: <Check className="w-5 h-5" />,
          title: 'Update Downloaded',
          message: 'Restart to complete installation',
          showActions: true,
          primaryAction: { label: 'Restart Now', onClick: onUpdate }
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          title: 'Update Failed',
          message: error || 'Something went wrong',
          showActions: true,
          primaryAction: { label: 'Try Again', onClick: onUpdate }
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div
      className="fixed bottom-6 right-6 w-96 bg-app-panel rounded-lg border border-app-border shadow-2xl slide-in-bottom-right z-50"
      role="dialog"
      aria-labelledby="update-title"
      aria-describedby="update-description"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 text-accent mt-0.5">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 id="update-title" className="text-sm font-semibold text-app-text">
            {config.title}
          </h3>
          {config.message && (
            <p id="update-description" className="text-xs text-app-muted mt-1">
              {config.message}
            </p>
          )}
        </div>
        {onDismiss && updateState !== 'downloading' && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:bg-app-hover rounded transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4 text-app-muted" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {config.showProgress && (
        <div className="px-4 pb-3">
          <div className="w-full h-2 bg-app-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
              role="progressbar"
              aria-valuenow={downloadProgress}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>
      )}

      {/* Release Notes Section */}
      {releaseNotes && (updateState === 'available' || updateState === 'ready') && (
        <div className="border-t border-app-border">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-app-hover transition-colors text-left"
            aria-expanded={isExpanded}
          >
            <span className="text-xs font-medium text-app-text">What's New</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-app-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-app-muted" />
            )}
          </button>
          {isExpanded && (
            <div className="px-4 pb-3 max-h-48 overflow-y-auto">
              <div className="text-xs text-app-muted whitespace-pre-wrap">
                {releaseNotes}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {config.showActions && (
        <div className="flex gap-2 px-4 py-3 border-t border-app-border">
          {config.primaryAction && (
            <button
              onClick={config.primaryAction.onClick}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors text-sm font-medium"
            >
              {config.primaryAction.label}
            </button>
          )}
          {onDismiss && updateState !== 'ready' && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-app-hover text-app-text rounded-md hover:bg-app-hover/70 transition-colors text-sm font-medium"
            >
              Later
            </button>
          )}
        </div>
      )}
    </div>
  );
}
