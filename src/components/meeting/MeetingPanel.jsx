import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Clock,
  X,
  Loader2,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useMeeting } from '../../contexts/MeetingContext';
import MeetingTimer from './MeetingTimer';
import { insertMeetingSummary } from '../../services/daily-note-integration.js';

// ---------------------------------------------------------------------------
// Speaker colour palette — cycles through a small set of accent-compatible
// colours so each speaker label looks distinct without hard-coding a theme.
// ---------------------------------------------------------------------------
const SPEAKER_COLORS = [
  'text-blue-400',
  'text-emerald-400',
  'text-violet-400',
  'text-amber-400',
  'text-rose-400',
  'text-cyan-400',
];

function speakerColor(speaker) {
  // Extract trailing number if present ("Speaker 2" → 2), else hash the string
  const match = speaker && speaker.match(/(\d+)$/);
  const index = match
    ? (parseInt(match[1], 10) - 1) % SPEAKER_COLORS.length
    : [...(speaker || '')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
      SPEAKER_COLORS.length;
  return SPEAKER_COLORS[Math.max(0, index)];
}

// ---------------------------------------------------------------------------
// Helper: format raw seconds → "MM:SS" string (used for per-segment stamps)
// ---------------------------------------------------------------------------
function formatSeconds(s) {
  return (
    Math.floor(s / 60).toString().padStart(2, '0') +
    ':' +
    (s % 60).toString().padStart(2, '0')
  );
}

// ---------------------------------------------------------------------------
// TranscriptArea — scrolling list of transcript segments with smart
// auto-scroll: stays pinned to bottom unless the user has scrolled up.
// ---------------------------------------------------------------------------
function TranscriptArea({ transcript }) {
  const scrollRef = useRef(null);
  const pinnedRef = useRef(true); // whether we are pinned to the bottom

  // Track whether user has intentionally scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 40; // within 40 px → consider pinned
  }, []);

  // Auto-scroll when new segments arrive, but only when pinned
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcript]);

  if (transcript.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-app-muted select-none">
          Listening for speech…
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scroll-smooth"
    >
      {transcript.map((segment, i) => {
        const isFinal = segment.is_final !== false; // treat undefined as final
        const colorClass = speakerColor(segment.speaker);
        const stamp =
          typeof segment.timestamp === 'number'
            ? formatSeconds(segment.timestamp)
            : null;

        return (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              isFinal ? 'text-app-text' : 'text-app-muted italic'
            }`}
          >
            {/* Speaker + timestamp row */}
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className={`font-semibold text-[10px] uppercase tracking-wide ${colorClass}`}>
                {segment.speaker || 'Speaker'}
              </span>
              {stamp && (
                <span className="font-mono text-[10px] text-app-muted opacity-70">
                  [{stamp}]
                </span>
              )}
            </div>

            {/* Transcript text */}
            <p className="pl-0">{segment.text}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordingView — header + transcript + controls
// ---------------------------------------------------------------------------
function RecordingView({ title, setTitle, duration, transcript, isEnding, stopRecording }) {
  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-app-border">
        {/* Status row */}
        <div className="flex items-center gap-2 mb-2">
          {/* Status dot */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isEnding
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-emerald-400 animate-pulse'
            }`}
            title={isEnding ? 'Ending…' : 'Recording'}
          />
          <span className="text-[10px] font-medium uppercase tracking-wider text-app-muted">
            {isEnding ? 'Ending' : 'Recording'}
          </span>
          <div className="ml-auto flex items-center gap-1 text-app-muted">
            <Clock className="w-3 h-3" />
            <MeetingTimer duration={duration} />
          </div>
        </div>

        {/* Editable title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title…"
          className="
            w-full bg-transparent
            text-sm font-medium text-app-text
            placeholder:text-app-muted
            border-0 outline-none ring-0
            focus:ring-1 focus:ring-app-accent/50 rounded px-0
          "
          aria-label="Meeting title"
        />
      </div>

      {/* Live transcript */}
      <TranscriptArea transcript={transcript} />

      {/* Controls */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-app-border">
        <div className="flex items-center gap-2">
          {/* Pause placeholder — v1: disabled */}
          <button
            disabled
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded
              border border-app-border
              text-app-muted text-xs
              opacity-40 cursor-not-allowed
            "
            aria-label="Pause (coming soon)"
          >
            <MicOff className="w-3.5 h-3.5" />
            Pause
          </button>

          {/* Stop button */}
          <button
            onClick={stopRecording}
            className="
              flex-1
              flex items-center justify-center gap-1.5
              px-3 py-1.5 rounded
              bg-red-500/90 hover:bg-red-500
              text-white text-xs font-medium
              active:scale-95 transition-all
            "
            aria-label="Stop recording"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            Stop Recording
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ProcessingView — spinner + streaming summary text
// ---------------------------------------------------------------------------
function ProcessingView({ summary }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 pt-6 gap-4">
      {/* Spinner + label */}
      <div className="flex items-center gap-2 text-app-muted">
        <Loader2 className="w-4 h-4 animate-spin text-app-accent" />
        <span className="text-sm">Generating summary…</span>
      </div>

      {/* Stream the summary as it arrives */}
      {summary && (
        <div
          className="
            w-full text-xs text-app-text whitespace-pre-wrap leading-relaxed
            border border-app-border rounded p-3 bg-app-bg/40
          "
        >
          {summary}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompleteView — final summary + action buttons
// ---------------------------------------------------------------------------
function CompleteView({ summary, reset, meetingTitle, duration, workspacePath }) {
  const [inserting, setInserting] = useState(false);
  const [inserted, setInserted] = useState(false);

  const handleInsert = async () => {
    if (!summary || inserting || inserted) return;
    setInserting(true);
    try {
      await insertMeetingSummary({ summary, meetingTitle, duration, workspacePath });
      setInserted(true);
    } catch (e) {
      console.error('Failed to insert in daily note:', e);
    } finally {
      setInserting(false);
    }
  };
  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-app-border">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-app-text">Summary ready</span>
        </div>
      </div>

      {/* Summary body — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {summary ? (
          <div
            className="text-xs text-app-text whitespace-pre-wrap leading-relaxed"
            /* Summary may contain markdown-style text — preserve whitespace
               and newlines so it reads naturally without a heavy renderer. */
          >
            {summary}
          </div>
        ) : (
          <p className="text-xs text-app-muted">No summary was generated.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-app-border space-y-1.5">
        {/* Insert in Daily Note */}
        <button
          onClick={handleInsert}
          disabled={inserting || inserted || !summary}
          className={`
            w-full flex items-center justify-center gap-1.5
            px-3 py-1.5 rounded
            text-xs font-medium transition-opacity
            ${inserted
              ? 'bg-emerald-600 text-white'
              : 'bg-app-accent text-app-accent-fg hover:opacity-90 active:opacity-80'}
          `}
          aria-label="Insert summary in daily note"
        >
          {inserted ? <CheckCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          {inserting ? 'Inserting...' : inserted ? 'Inserted' : 'Insert in Daily Note'}
        </button>

        {/* Regenerate */}
        <button
          onClick={reset}
          className="
            w-full flex items-center justify-center gap-1.5
            px-3 py-1.5 rounded
            border border-app-border
            text-app-muted hover:text-app-text
            text-xs font-medium
            hover:bg-app-border/30 transition-colors
          "
          aria-label="Regenerate summary"
        >
          Regenerate
        </button>

        {/* Close */}
        <button
          onClick={reset}
          className="
            w-full flex items-center justify-center gap-1.5
            px-3 py-1.5 rounded
            border border-app-border
            text-app-muted hover:text-app-text
            text-xs font-medium
            hover:bg-app-border/30 transition-colors
          "
          aria-label="Close meeting panel"
        >
          <X className="w-3.5 h-3.5" />
          Close
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// MeetingPanel — root component
// ---------------------------------------------------------------------------
export default function MeetingPanel({ workspacePath }) {
  const {
    state,
    transcript,
    summary,
    meetingTitle,
    setMeetingTitle,
    duration,
    isEnding,
    stopRecording,
    reset,
  } = useMeeting();

  // Only render during active session states
  const isVisible =
    state === 'recording' ||
    state === 'processing' ||
    state === 'complete';

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="
        fixed right-0 top-[30px] bottom-0
        w-80 z-40
        flex flex-col
        bg-app-panel
        border-l border-app-border
        overflow-hidden
        select-none
        shadow-lg
      "
      aria-label="Meeting panel"
      role="complementary"
    >
      {state === 'recording' && (
        <RecordingView
          title={meetingTitle}
          setTitle={setMeetingTitle}
          duration={duration}
          transcript={transcript}
          isEnding={isEnding}
          stopRecording={stopRecording}
        />
      )}

      {state === 'processing' && (
        <ProcessingView summary={summary} />
      )}

      {state === 'complete' && (
        <CompleteView summary={summary} reset={reset} meetingTitle={meetingTitle} duration={duration} workspacePath={workspacePath} />
      )}
    </div>
  );
}
