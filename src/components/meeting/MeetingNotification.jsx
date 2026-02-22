import { Mic, X, AlertTriangle } from 'lucide-react';
import { useMeeting } from '../../contexts/MeetingContext';

/**
 * MeetingNotification — floating card that appears when a meeting is detected.
 *
 * Only renders when state === 'prompted'. Displays bottom-right with a
 * slide-up entrance animation driven by CSS keyframes.
 */
export default function MeetingNotification() {
  const { state, acceptPrompt, dismissPrompt } = useMeeting();

  if (state !== 'prompted') {
    return null;
  }

  return (
    <>
      {/* Keyframe definition — inlined so it works without a separate CSS file */}
      <style>{`
        @keyframes meeting-slide-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .meeting-notification-enter {
          animation: meeting-slide-up 0.25s ease-out both;
        }
      `}</style>

      <div
        className="
          meeting-notification-enter
          fixed bottom-6 right-6 z-50
          w-80
          bg-app-panel border border-app-border
          rounded-lg shadow-lg
          p-4
          flex flex-col gap-3
        "
        role="alertdialog"
        aria-modal="false"
        aria-label="Meeting detected"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-app-accent/15 flex items-center justify-center">
              <Mic className="w-4 h-4 text-app-accent" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text leading-tight">
              Meeting detected
            </p>
            <p className="text-xs text-app-muted mt-0.5 leading-snug">
              Audio activity has been detected. Would you like to start taking meeting notes?
            </p>
          </div>

          <button
            onClick={dismissPrompt}
            className="
              flex-shrink-0 -mt-1 -mr-1
              w-6 h-6 rounded
              flex items-center justify-center
              text-app-muted hover:text-app-text
              hover:bg-app-border/50
              transition-colors
            "
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={acceptPrompt}
            className="
              flex-1
              px-3 py-1.5 rounded
              bg-app-accent text-app-accent-fg
              text-xs font-medium
              hover:opacity-90 active:opacity-80
              transition-opacity
              flex items-center justify-center gap-1.5
            "
          >
            <Mic className="w-3.5 h-3.5" />
            Start Recording
          </button>

          <button
            onClick={dismissPrompt}
            className="
              flex-1
              px-3 py-1.5 rounded
              border border-app-border
              text-app-muted hover:text-app-text
              text-xs font-medium
              hover:bg-app-border/30
              transition-colors
            "
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}
