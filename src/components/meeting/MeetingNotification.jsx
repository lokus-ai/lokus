import { Mic, X } from 'lucide-react';
import { useMeeting } from '../../contexts/MeetingContext';

/**
 * MeetingNotification — compact in-app fallback banner shown when the app is
 * in the foreground and the native OS notification has already been sent.
 *
 * This component is the SECONDARY notification path. The primary path is the
 * native macOS notification dispatched from MeetingContext via the Rust layer.
 * This banner is intentionally smaller and lower-prominence than the original
 * design so it complements rather than duplicates the OS notification.
 *
 * Only renders when state === 'prompted'. Positioned bottom-right with a
 * subtle slide-up entrance animation.
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
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .meeting-notification-enter {
          animation: meeting-slide-up 0.2s ease-out both;
        }
      `}</style>

      {/*
        Compact fallback banner — smaller than the original design.
        The native OS notification is the primary prompt; this is a
        secondary in-app affordance for users who are already looking
        at the window.
      */}
      <div
        className="
          meeting-notification-enter
          fixed bottom-4 right-4 z-50
          w-64
          bg-app-panel border border-app-border
          rounded-md shadow-md
          px-3 py-2.5
          flex items-center gap-2.5
        "
        role="alertdialog"
        aria-modal="false"
        aria-label="Meeting detected — in-app fallback"
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-app-accent/15 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 text-app-accent" />
          </div>
        </div>

        {/* Label + actions */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-app-text leading-tight">
            Meeting detected
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={acceptPrompt}
              className="
                px-2 py-0.5 rounded
                bg-app-accent text-app-accent-fg
                text-xs font-medium
                hover:opacity-90 active:opacity-80
                transition-opacity
              "
            >
              Record
            </button>
            <button
              onClick={dismissPrompt}
              className="
                px-2 py-0.5 rounded
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

        {/* Close */}
        <button
          onClick={dismissPrompt}
          className="
            flex-shrink-0
            w-5 h-5 rounded
            flex items-center justify-center
            text-app-muted hover:text-app-text
            hover:bg-app-border/50
            transition-colors
          "
          aria-label="Dismiss notification"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}
