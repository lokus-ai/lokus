import { Mic } from 'lucide-react';
import { useMeeting } from '../../contexts/MeetingContext';

/**
 * MeetingFAB — small floating action button that allows manual recording start.
 *
 * Visible when state is 'idle' or 'detecting' (i.e. no active session).
 * Hidden during recording/processing/complete (MeetingPanel handles those).
 * Hidden during 'prompted' (MeetingNotification handles that).
 */
export default function MeetingFAB() {
  const { state, startRecording } = useMeeting();

  // Only show when idle or detecting — other states have their own UI
  if (state !== 'idle' && state !== 'detecting') {
    return null;
  }

  return (
    <button
      onClick={startRecording}
      className="
        fixed bottom-16 right-6 z-40
        w-10 h-10 rounded-full
        bg-app-accent text-app-accent-fg
        flex items-center justify-center
        shadow-lg
        hover:opacity-90 active:scale-95
        transition-all
      "
      title="Start meeting recording"
      aria-label="Start meeting recording"
    >
      <Mic className="w-4.5 h-4.5" />
    </button>
  );
}
