import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeeting } from '../../contexts/MeetingContext';
import MeetingTimer from './MeetingTimer';
import { insertMeetingSummary } from '../../services/daily-note-integration.js';

// ---------------------------------------------------------------------------
// Helper: format raw seconds → "MM:SS"
// ---------------------------------------------------------------------------
function formatSeconds(s) {
  return (
    Math.floor(s / 60).toString().padStart(2, '0') +
    ':' +
    (s % 60).toString().padStart(2, '0')
  );
}

// ---------------------------------------------------------------------------
// AudioBars — animated bars that react to recording state
// ---------------------------------------------------------------------------
function AudioBars({ active }) {
  return (
    <div className="mp-audio-bars" data-active={active || undefined}>
      <span style={{ animationDelay: '0ms' }} />
      <span style={{ animationDelay: '150ms' }} />
      <span style={{ animationDelay: '300ms' }} />
      <span style={{ animationDelay: '100ms' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TranscriptArea — auto-scrolling transcript feed
// ---------------------------------------------------------------------------
function TranscriptArea({ transcript }) {
  const scrollRef = useRef(null);
  const pinnedRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  if (transcript.length === 0) {
    return (
      <div className="mp-empty-state">
        <AudioBars active />
        <p>Listening for speech...</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="mp-transcript">
      {transcript.map((segment, i) => {
        const isFinal = segment.is_final !== false;
        const stamp =
          typeof segment.timestamp === 'number'
            ? formatSeconds(segment.timestamp)
            : null;

        return (
          <div key={i} className={`mp-segment ${isFinal ? '' : 'interim'}`}>
            {stamp && <span className="mp-stamp">{stamp}</span>}
            <p>{segment.text}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordingView
// ---------------------------------------------------------------------------
function RecordingView({ title, setTitle, duration, transcript, isEnding, stopRecording }) {
  return (
    <>
      {/* Header */}
      <div className="mp-header">
        <div className="mp-status-row">
          <div className="mp-status-badge" data-ending={isEnding || undefined}>
            <span className="mp-status-dot" />
            <span>{isEnding ? 'Ending' : 'Recording'}</span>
          </div>
          <div className="mp-timer">
            <MeetingTimer duration={duration} />
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title..."
          className="mp-title-input"
          aria-label="Meeting title"
        />
      </div>

      {/* Transcript */}
      <TranscriptArea transcript={transcript} />

      {/* Stop bar */}
      <div className="mp-controls">
        <button onClick={stopRecording} className="mp-stop-btn">
          <span className="mp-stop-icon" />
          Stop Recording
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ProcessingView
// ---------------------------------------------------------------------------
function ProcessingView({ summary }) {
  return (
    <div className="mp-processing">
      <div className="mp-processing-header">
        <div className="mp-spinner" />
        <span>Generating summary...</span>
      </div>
      {summary && <div className="mp-summary-stream">{summary}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompleteView
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
      <div className="mp-header">
        <div className="mp-status-row">
          <div className="mp-status-badge done">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Summary ready</span>
          </div>
        </div>
      </div>

      <div className="mp-summary-body">
        {summary ? (
          <div className="mp-summary-text">{summary}</div>
        ) : (
          <p className="mp-no-summary">No summary was generated.</p>
        )}
      </div>

      <div className="mp-actions">
        <button
          onClick={handleInsert}
          disabled={inserting || inserted || !summary}
          className={`mp-action-btn primary ${inserted ? 'inserted' : ''}`}
        >
          {inserted ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Inserted
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              {inserting ? 'Inserting...' : 'Insert in Daily Note'}
            </>
          )}
        </button>

        <button onClick={reset} className="mp-action-btn ghost">
          Close
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// MeetingPanel — root
// ---------------------------------------------------------------------------
export default function MeetingPanel({ workspacePath }) {
  const {
    state,
    transcript,
    summary,
    meetingTitle,
    setMeetingTitle,
    duration,
    error,
    isEnding,
    stopRecording,
    reset,
  } = useMeeting();

  const isVisible =
    state === 'recording' ||
    state === 'processing' ||
    state === 'complete';

  if (!isVisible) return null;

  return (
    <>
      <div className="mp-root" aria-label="Meeting panel" role="complementary">
        {error && (
          <div className="mp-error">
            <span>{error}</span>
            <button onClick={reset} className="mp-error-dismiss">Dismiss</button>
          </div>
        )}
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
        {state === 'processing' && <ProcessingView summary={summary} />}
        {state === 'complete' && (
          <CompleteView
            summary={summary}
            reset={reset}
            meetingTitle={meetingTitle}
            duration={duration}
            workspacePath={workspacePath}
          />
        )}
      </div>

      <style>{`
        /* --------------------------------------------------------
           MeetingPanel — Lokus-native design
           -------------------------------------------------------- */

        .mp-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          user-select: none;
          animation: mp-fade-in 0.2s ease both;
          font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        }

        @keyframes mp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ---- Error banner ---- */
        .mp-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          margin: 8px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          font-size: 12px;
          line-height: 1.4;
        }
        .mp-error span { flex: 1; }
        .mp-error-dismiss {
          flex-shrink: 0;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          background: transparent;
          color: #f87171;
          font-size: 11px;
          cursor: pointer;
        }
        .mp-error-dismiss:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        /* ---- Header ---- */

        .mp-header {
          flex-shrink: 0;
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgb(var(--border));
        }

        .mp-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .mp-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgb(var(--success));
        }

        .mp-status-badge[data-ending] {
          color: rgb(var(--warning));
        }

        .mp-status-badge.done {
          color: rgb(var(--success));
        }

        .mp-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          animation: mp-pulse 1.5s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes mp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .mp-timer {
          font-variant-numeric: tabular-nums;
        }

        .mp-timer span {
          font-size: 13px;
          font-weight: 500;
          color: rgb(var(--text-secondary));
          font-family: var(--font-mono);
        }

        .mp-title-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          font-weight: 600;
          color: rgb(var(--text));
          padding: 0;
          line-height: 1.4;
        }

        .mp-title-input::placeholder {
          color: rgb(var(--muted));
          font-weight: 400;
        }

        .mp-title-input:focus {
          box-shadow: none;
        }

        /* ---- Transcript ---- */

        .mp-transcript {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          scroll-behavior: smooth;
        }

        .mp-transcript::-webkit-scrollbar {
          width: 4px;
        }

        .mp-transcript::-webkit-scrollbar-track {
          background: transparent;
        }

        .mp-transcript::-webkit-scrollbar-thumb {
          background: rgb(var(--border));
          border-radius: 2px;
        }

        .mp-segment {
          padding: 6px 0;
          position: relative;
        }

        .mp-segment + .mp-segment {
          border-top: 1px solid rgb(var(--border) / 0.4);
        }

        .mp-segment p {
          font-size: 13px;
          line-height: 1.55;
          color: rgb(var(--text));
          margin: 0;
        }

        .mp-segment.interim p {
          color: rgb(var(--muted));
          font-style: italic;
        }

        .mp-stamp {
          display: inline-block;
          font-size: 10px;
          font-family: var(--font-mono);
          color: rgb(var(--muted));
          opacity: 0.7;
          margin-bottom: 2px;
        }

        /* ---- Empty state ---- */

        .mp-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .mp-empty-state p {
          font-size: 12px;
          color: rgb(var(--muted));
          margin: 0;
        }

        /* Audio bars */

        .mp-audio-bars {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 24px;
        }

        .mp-audio-bars span {
          width: 3px;
          height: 6px;
          border-radius: 1.5px;
          background: rgb(var(--accent));
          opacity: 0.3;
          transition: height 0.15s ease;
        }

        .mp-audio-bars[data-active] span {
          animation: mp-bar-bounce 0.8s ease-in-out infinite alternate;
          opacity: 0.8;
        }

        @keyframes mp-bar-bounce {
          0% { height: 6px; }
          100% { height: 20px; }
        }

        /* ---- Controls ---- */

        .mp-controls {
          flex-shrink: 0;
          padding: 12px 16px;
          border-top: 1px solid rgb(var(--border));
        }

        .mp-stop-btn {
          width: 100%;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: var(--radius, 6px);
          background: rgb(var(--danger) / 0.12);
          color: rgb(var(--danger));
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mp-stop-btn:hover {
          background: rgb(var(--danger) / 0.2);
        }

        .mp-stop-btn:active {
          transform: scale(0.98);
        }

        .mp-stop-icon {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          background: currentColor;
          flex-shrink: 0;
        }

        /* ---- Processing ---- */

        .mp-processing {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          gap: 16px;
          overflow-y: auto;
        }

        .mp-processing-header {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgb(var(--text-secondary));
          font-size: 13px;
          font-weight: 500;
        }

        .mp-spinner {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgb(var(--border));
          border-top-color: rgb(var(--accent));
          animation: mp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes mp-spin {
          to { transform: rotate(360deg); }
        }

        .mp-summary-stream {
          font-size: 13px;
          line-height: 1.6;
          color: rgb(var(--text));
          white-space: pre-wrap;
          padding: 12px;
          border-radius: var(--radius, 6px);
          background: rgb(var(--panel-secondary));
          border: 1px solid rgb(var(--border) / 0.5);
        }

        /* ---- Complete ---- */

        .mp-summary-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .mp-summary-body::-webkit-scrollbar {
          width: 4px;
        }

        .mp-summary-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .mp-summary-body::-webkit-scrollbar-thumb {
          background: rgb(var(--border));
          border-radius: 2px;
        }

        .mp-summary-text {
          font-size: 13px;
          line-height: 1.65;
          color: rgb(var(--text));
          white-space: pre-wrap;
        }

        .mp-no-summary {
          font-size: 13px;
          color: rgb(var(--muted));
        }

        /* ---- Action buttons ---- */

        .mp-actions {
          flex-shrink: 0;
          padding: 12px 16px;
          border-top: 1px solid rgb(var(--border));
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .mp-action-btn {
          width: 100%;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: var(--radius, 6px);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mp-action-btn:active {
          transform: scale(0.98);
        }

        .mp-action-btn.primary {
          background: rgb(var(--accent));
          color: rgb(var(--accent-fg));
        }

        .mp-action-btn.primary:hover {
          background: rgb(var(--accent-hover));
        }

        .mp-action-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mp-action-btn.primary.inserted {
          background: rgb(var(--success));
        }

        .mp-action-btn.ghost {
          background: transparent;
          color: rgb(var(--muted));
          border: 1px solid rgb(var(--border));
        }

        .mp-action-btn.ghost:hover {
          color: rgb(var(--text));
          border-color: rgb(var(--border-hover));
          background: rgb(var(--panel-secondary));
        }
      `}</style>
    </>
  );
}
