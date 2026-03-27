/**
 * Meeting Session Hook
 *
 * Manages the full lifecycle of an AI-assisted meeting recording session via
 * a deterministic state machine:
 *
 *   idle → detecting → prompted → recording → processing → complete → idle
 *
 * Responsibilities:
 *   - Driving state transitions in response to user actions and Tauri events
 *   - Starting/stopping the Rust audio capture and Deepgram STT
 *   - Accumulating transcript segments from Deepgram WebSocket
 *   - Auto-stop handling when the Rust side detects meeting silence
 *   - Streaming summary generation via the LLM summary service
 *   - Duration tracking via a one-second setInterval
 *
 * All Tauri event listeners are torn down on unmount. Mutable bookkeeping
 * values (interval IDs, unlisten functions, start timestamp) live in refs so
 * they never cause spurious re-renders.
 *
 * @module hooks/useMeetingSession
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { streamMeetingSummary } from '../services/llm-summary.js';
import { calendarAuth, events as calendarEventsApi } from '../services/calendar.js';
import { createDeepgramSession } from '../services/deepgram-transcription.js';
import { loadProviderConfig } from '../services/ai-provider.js';

// Use console directly for meeting diagnostics (the app logger is a no-op in dev)
const log = (...args) => console.log('[MeetingSession]', ...args);
const logError = (...args) => console.error('[MeetingSession]', ...args);

// ---------------------------------------------------------------------------
// Session state machine
// ---------------------------------------------------------------------------

/**
 * Ordered states of the meeting session state machine.
 * Transitions must always move forward (or reset to idle).
 *
 * @readonly
 * @enum {string}
 */
export const SESSION_STATE = {
  /** No active session; the app is at rest. */
  IDLE: 'idle',
  /** Background mic-activity detection is running. */
  DETECTING: 'detecting',
  /** Detection fired; waiting for the user to accept or dismiss. */
  PROMPTED: 'prompted',
  /** Audio capture and transcription are active. */
  RECORDING: 'recording',
  /** Recording stopped; LLM summary is being generated. */
  PROCESSING: 'processing',
  /** Summary is ready for the user to review. */
  COMPLETE: 'complete',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a total number of elapsed seconds as "MM:SS".
 *
 * @param {number} totalSeconds - Non-negative integer.
 * @returns {string} e.g. "04:37"
 */
function _formatTimestamp(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Build a plain-text transcript string from an array of final segments.
 * Only `is_final === true` segments are included so the LLM sees clean text.
 *
 * Format per line: "Speaker N [MM:SS]: text"
 *
 * @param {Array<{text: string, speaker: string|number|null, timestamp: number, is_final: boolean}>} segments
 * @param {number} startTimeMs - Unix ms timestamp when recording started.
 * @returns {string}
 */
function _buildTranscriptString(segments, startTimeMs) {
  return segments
    .filter((seg) => seg.is_final && seg.text && seg.text.trim())
    .map((seg) => {
      const speakerLabel = seg.speaker != null ? `Speaker ${seg.speaker}` : 'Speaker';
      const elapsedSecs = Math.max(0, Math.round((seg.timestamp - startTimeMs) / 1000));
      const ts = _formatTimestamp(elapsedSecs);
      return `${speakerLabel} [${ts}]: ${seg.text.trim()}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a complete meeting recording and summarisation session.
 *
 * @returns {Object} Session state and action callbacks — see exports below.
 */
export function useMeetingSession() {
  // ------------------------------------------------------------------
  // React state — values that must drive re-renders
  // ------------------------------------------------------------------

  /** Current state-machine position. */
  const [state, setState] = useState(SESSION_STATE.IDLE);

  /**
   * All transcript segments received from Tauri (interim + final).
   * Kept for real-time display; only final segments feed the summary.
   * @type {Array<{text: string, speaker: string|null, timestamp: number, is_final: boolean, words?: Array}>}
   */
  const [transcript, setTranscript] = useState([]);

  /** Accumulated streaming summary text; populated during/after processing. */
  const [summary, setSummary] = useState('');

  /** User's sparse notes typed during the meeting. */
  const [sparseNotes, setSparseNotes] = useState('');

  /** Optional meeting title supplied by the user or inferred from detection. */
  const [meetingTitle, setMeetingTitle] = useState('');

  /** Elapsed recording duration in whole seconds (updated every second). */
  const [duration, setDuration] = useState(0);

  /** Latest error message, or null when no error is present. */
  const [error, setError] = useState(null);

  /**
   * True while the Rust side is in its grace-period warning phase
   * (i.e. a `lokus:meeting-ending` event arrived but auto-stop has not
   * fired yet).
   */
  const [isEnding, setIsEnding] = useState(false);

  // ------------------------------------------------------------------
  // Refs — mutable bookkeeping that must NOT cause re-renders
  // ------------------------------------------------------------------

  /** Unix ms timestamp captured when recording transitions to RECORDING. */
  const startTimeRef = useRef(null);

  /** ID of the setInterval that increments `duration` every second. */
  const durationIntervalRef = useRef(null);

  /**
   * Accumulates all transcript segments received during a session.
   * Kept in a ref (mirroring the `transcript` state array) so async
   * callbacks such as the processing trigger can read the latest value
   * without stale-closure issues.
   */
  const transcriptRef = useRef([]);

  /**
   * Array of unlisten functions returned by `listen()` calls.
   * All are called during the cleanup phase of the outer useEffect.
   */
  const unlistenFnsRef = useRef([]);

  /**
   * Holds a reference to the sparse-notes string so the processing
   * callback can read the current value without capturing a stale closure.
   */
  const sparseNotesRef = useRef('');

  /** Mirror meeting title for the same stale-closure reason. */
  const meetingTitleRef = useRef('');

  /** Active Deepgram transcription session handle. */
  const deepgramRef = useRef(null);

  // Keep refs in sync with their corresponding state values
  useEffect(() => { sparseNotesRef.current = sparseNotes; }, [sparseNotes]);
  useEffect(() => { meetingTitleRef.current = meetingTitle; }, [meetingTitle]);

  // ------------------------------------------------------------------
  // Internal helpers (stable across renders via useCallback)
  // ------------------------------------------------------------------

  /** Clear the running duration interval if one is active. */
  const _clearDurationInterval = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /** Start the one-second duration counter, anchored to startTimeRef. */
  const _startDurationInterval = useCallback(() => {
    _clearDurationInterval();
    durationIntervalRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }
    }, 1000);
  }, [_clearDurationInterval]);

  /**
   * Run the LLM summary pipeline over the accumulated transcript and
   * sparse notes. Transitions state to COMPLETE when the stream finishes,
   * or sets an error if the pipeline throws.
   *
   * @param {Array} segments - Snapshot of transcriptRef.current at stop time.
   * @param {number} startTimeMs - Recording start timestamp.
   */
  const _runSummary = useCallback(async (segments, startTimeMs) => {
    log('Starting summary generation');
    setSummary('');

    try {
      const transcriptString = _buildTranscriptString(segments, startTimeMs);
      const currentNotes = sparseNotesRef.current;
      const currentTitle = meetingTitleRef.current;

      // Skip the LLM call when there's nothing to summarize.
      if (!transcriptString.trim() && !currentNotes?.trim()) {
        log('No transcript or notes — skipping summary generation');
        setSummary('*No transcript was captured for this meeting.*');
        setState(SESSION_STATE.COMPLETE);
        return;
      }

      // Try to enrich from Google Calendar — pull meeting title and participants.
      let calendarTitle = null;
      let participants  = null;

      try {
        const isAuthed = await calendarAuth.isGoogleAuthenticated();
        if (isAuthed && startTimeMs) {
          const recordingStart = new Date(startTimeMs);
          const recordingEnd   = new Date();

          const allEvents = await calendarEventsApi.getAllEvents(recordingStart, recordingEnd);
          log(`Calendar lookup: ${allEvents.length} event(s) overlapping recording window`);

          if (allEvents.length > 0) {
            // Pick the event with the most time overlap with the recording window.
            const recStart = recordingStart.getTime();
            const recEnd   = recordingEnd.getTime();

            let bestEvent   = allEvents[0];
            let bestOverlap = 0;

            for (const evt of allEvents) {
              const evtStart = new Date(evt.start).getTime();
              const evtEnd   = new Date(evt.end).getTime();
              const overlap  = Math.min(recEnd, evtEnd) - Math.max(recStart, evtStart);
              if (overlap > bestOverlap) {
                bestOverlap = overlap;
                bestEvent   = evt;
              }
            }

            if (bestEvent.title) {
              calendarTitle = bestEvent.title;
              setMeetingTitle(calendarTitle);
              log(`Calendar match: "${calendarTitle}"`);
            }

            if (bestEvent.attendees?.length) {
              participants = bestEvent.attendees
                .map((a) => a.name || a.email)
                .filter(Boolean)
                .join(', ');
              log(`Participants from calendar: ${participants}`);
            }
          }
        }
      } catch (calErr) {
        // Calendar lookup is best-effort — never block summary generation.
        log('Calendar lookup failed (non-fatal):', calErr.message);
      }

      const effectiveTitle = calendarTitle || currentTitle || undefined;

      const { summary: completedSummary } = await streamMeetingSummary({
        transcript:   transcriptString,
        sparseNotes:  currentNotes,
        meetingTitle: effectiveTitle,
        participants: participants || undefined,
        duration:     startTimeMs
          ? Math.round((Date.now() - startTimeMs) / 60000)
          : undefined,
        typeHint:     'auto-detect',
        onChunk: (chunk) => {
          setSummary((prev) => prev + chunk);
        },
      });

      // Ensure state reflects the fully assembled summary (in case onChunk
      // and the resolved value diverge due to timing).
      if (completedSummary) {
        setSummary(completedSummary);
      }

      setState(SESSION_STATE.COMPLETE);
      log('Summary generation complete');
    } catch (err) {
      logError('Summary generation failed:', err);
      // LLM unavailable — fall back to showing the raw transcript.
      const transcriptString = _buildTranscriptString(segments, startTimeMs);
      if (transcriptString.trim()) {
        log('Falling back to raw transcript');
        setSummary(`## Raw Transcript\n\n${transcriptString}`);
      } else {
        setError(`Summary generation failed: ${err.message}`);
      }
      setState(SESSION_STATE.COMPLETE);
    }
  }, []);

  // ------------------------------------------------------------------
  // Tauri event listener setup (mount once, tear down on unmount)
  // ------------------------------------------------------------------

  useEffect(() => {
    const unlistenFns = unlistenFnsRef.current;

    /**
     * Register a single Tauri event listener and store its cleanup handle.
     *
     * @param {string} event - Tauri event name.
     * @param {function} handler - Payload handler.
     */
    const register = async (event, handler) => {
      try {
        const unlisten = await listen(event, handler);
        unlistenFns.push(unlisten);
      } catch (err) {
        logError(`Failed to register listener for "${event}":`, err);
      }
    };

    // ----------------------------------------------------------------
    // lokus:meeting-detected
    // Background detection fired — ask the user whether to start.
    // ----------------------------------------------------------------
    register('lokus:meeting-detected', () => {
      log('Meeting detected — transitioning to prompted');
      setState((prev) => {
        if (prev === SESSION_STATE.DETECTING) {
          return SESSION_STATE.PROMPTED;
        }
        return prev;
      });
    });

    // ----------------------------------------------------------------
    // lokus:meeting-ending
    // Grace-period warning from the Rust meeting monitor.
    // ----------------------------------------------------------------
    register('lokus:meeting-ending', ({ payload }) => {
      log(`Meeting ending grace period: ${payload?.grace_period_secs ?? '?'}s`);
      setIsEnding(true);
    });

    // ----------------------------------------------------------------
    // lokus:meeting-ended
    // Rust-side silence auto-stop — mirror the recording stop flow.
    // ----------------------------------------------------------------
    register('lokus:meeting-ended', () => {
      log('Meeting ended event received — auto-stopping');
      setIsEnding(false);

      // Stop Deepgram transcription on auto-stop.
      if (deepgramRef.current) {
        deepgramRef.current.stop();
        deepgramRef.current = null;
      }
      invoke('stop_audio_capture').catch(() => {});

      setState((prev) => {
        if (prev !== SESSION_STATE.RECORDING) return prev;
        return SESSION_STATE.PROCESSING;
      });
    });

    // Cleanup: remove all listeners when the component unmounts.
    return () => {
      unlistenFns.forEach((fn) => {
        if (typeof fn === 'function') fn();
      });
      unlistenFnsRef.current = [];
    };
  }, []); // Run once on mount

  // ------------------------------------------------------------------
  // Duration timer — start/stop in response to recording state
  // ------------------------------------------------------------------

  useEffect(() => {
    if (state === SESSION_STATE.RECORDING) {
      _startDurationInterval();
    } else {
      _clearDurationInterval();
    }

    return _clearDurationInterval;
  }, [state, _startDurationInterval, _clearDurationInterval]);

  // ------------------------------------------------------------------
  // Trigger summary generation when we enter PROCESSING state
  // ------------------------------------------------------------------

  useEffect(() => {
    if (state !== SESSION_STATE.PROCESSING) return;

    // Capture a snapshot of the accumulated segments at stop time.
    const segmentsSnapshot = [...transcriptRef.current];
    log(`Processing: ${segmentsSnapshot.length} transcript segments captured, ${segmentsSnapshot.filter(s => s.is_final).length} final`);
    const startTimeMs = startTimeRef.current;

    _runSummary(segmentsSnapshot, startTimeMs);
  }, [state, _runSummary]);

  // ------------------------------------------------------------------
  // Public action callbacks
  // ------------------------------------------------------------------

  /**
   * Enable background mic-activity detection.
   * Transitions: idle → detecting
   */
  const startDetecting = useCallback(async () => {
    try {
      setError(null);
      await invoke('enable_meeting_detection');
      setState(SESSION_STATE.DETECTING);
      log('Background detection enabled');
    } catch (err) {
      logError('enable_meeting_detection failed:', err);
      setError(`Failed to start detection: ${err.message ?? err}`);
    }
  }, []);

  /**
   * Disable background mic-activity detection.
   * Transitions: detecting → idle
   */
  const stopDetecting = useCallback(async () => {
    try {
      await invoke('disable_meeting_detection');
      setState((prev) =>
        prev === SESSION_STATE.DETECTING ? SESSION_STATE.IDLE : prev
      );
      log('Background detection disabled');
    } catch (err) {
      logError('disable_meeting_detection failed:', err);
      setError(`Failed to stop detection: ${err.message ?? err}`);
    }
  }, []);

  /**
   * Core recording start logic — shared by acceptPrompt and startRecording.
   *
   * Calls, in order:
   *   1. Load AI provider config (to get Deepgram API key)
   *   2. start_audio_capture  — begins mic capture in Rust
   *   3. Start Deepgram WebSocket — streams audio to Deepgram for STT
   *   4. start_meeting_monitoring — switches to active-meeting monitoring
   *
   * On any failure the Rust layer is asked to stop whatever started.
   */
  const _doStartRecording = useCallback(async () => {
    setError(null);
    startTimeRef.current = Date.now();
    transcriptRef.current = [];
    setTranscript([]);
    setSummary('');
    setDuration(0);
    setIsEnding(false);

    // Set recording state immediately so the MeetingPanel is visible in the
    // sidebar — the user should see status/errors inline rather than a blank
    // sidebar if something goes wrong.
    setState(SESSION_STATE.RECORDING);

    // Load config to get the Deepgram API key.
    let config;
    try {
      config = await loadProviderConfig();
    } catch (err) {
      logError('loadProviderConfig failed:', err);
      setError('Failed to load API configuration. Check Settings → Meeting Notes.');
      startTimeRef.current = null;
      return false;
    }

    if (!config.deepgramApiKey) {
      logError('No Deepgram API key configured');
      setError('Deepgram API key not set. Go to Settings → Meeting Notes to add it.');
      startTimeRef.current = null;
      return false;
    }

    try {
      await invoke('start_audio_capture', {
        config: {
          deviceId:        null,
          sampleRate:      16000,
          channels:        1,
          chunkDurationMs: 100,
        },
      });
    } catch (err) {
      logError('start_audio_capture failed:', err);
      setError(`Failed to start audio capture: ${err.message ?? err}`);
      startTimeRef.current = null;
      return false;
    }

    // Start Deepgram transcription session.
    try {
      const session = createDeepgramSession({
        apiKey: config.deepgramApiKey,
        onTranscript: (segment) => {
          log('Transcript segment received:', segment.text?.substring(0, 60));
          transcriptRef.current = [...transcriptRef.current, segment];
          setTranscript((prev) => [...prev, segment]);
        },
        onError: (msg) => {
          logError('Deepgram error:', msg);
          setError(`Transcription error: ${msg}`);
        },
      });
      await session.start();
      deepgramRef.current = session;
    } catch (err) {
      logError('Deepgram session start failed:', err);
      setError(`Failed to start transcription: ${err.message ?? err}`);
      invoke('stop_audio_capture').catch(() => {});
      startTimeRef.current = null;
      return false;
    }

    try {
      await invoke('start_meeting_monitoring');
    } catch (err) {
      // Non-fatal — monitoring enhances auto-stop but the session can
      // continue without it.
      logError('start_meeting_monitoring failed (non-fatal):', err);
    }

    log('Recording started');
    return true;
  }, []);

  /**
   * User accepted the detection prompt — start recording.
   * Transitions: prompted → recording
   */
  const acceptPrompt = useCallback(async () => {
    if (state !== SESSION_STATE.PROMPTED) return;
    await _doStartRecording();
  }, [state, _doStartRecording]);

  /**
   * User dismissed the detection prompt — apply the 5-minute cooldown.
   * Transitions: prompted → detecting (cooldown managed by Rust)
   */
  const dismissPrompt = useCallback(async () => {
    try {
      await invoke('dismiss_detection');
      setState(SESSION_STATE.DETECTING);
      log('Detection prompt dismissed (5 min cooldown)');
    } catch (err) {
      logError('dismiss_detection failed:', err);
      setError(`Failed to dismiss: ${err.message ?? err}`);
    }
  }, []);

  /**
   * Manual recording start (bypasses detection flow).
   * Transitions: idle | detecting → recording
   */
  const startRecording = useCallback(async () => {
    if (
      state !== SESSION_STATE.IDLE &&
      state !== SESSION_STATE.DETECTING
    ) {
      return;
    }
    await _doStartRecording();
  }, [state, _doStartRecording]);

  /**
   * Manual recording stop.
   * Transitions: recording → processing (which triggers summary generation).
   *
   * Calls, in order:
   *   1. stop_meeting_monitoring
   *   2. Stop Deepgram transcription session
   *   3. stop_audio_capture
   */
  const stopRecording = useCallback(async () => {
    if (state !== SESSION_STATE.RECORDING) return;

    log('Stopping recording');
    setIsEnding(false);

    // Attempt each stop command independently so a failure in one does
    // not prevent the others from running.
    try {
      await invoke('stop_meeting_monitoring');
    } catch (err) {
      logError('stop_meeting_monitoring failed (non-fatal):', err);
    }

    // Stop Deepgram transcription.
    if (deepgramRef.current) {
      deepgramRef.current.stop();
      deepgramRef.current = null;
    }

    try {
      await invoke('stop_audio_capture');
    } catch (err) {
      logError('stop_audio_capture failed:', err);
      setError(`Failed to stop audio capture: ${err.message ?? err}`);
    }

    // Transition to processing — the useEffect watching `state` will
    // kick off the LLM summary pipeline.
    setState(SESSION_STATE.PROCESSING);
  }, [state]);

  /**
   * Reset the session back to the idle state.
   * Safe to call from any state.
   */
  const reset = useCallback(() => {
    _clearDurationInterval();

    // Stop Deepgram transcription if active.
    if (deepgramRef.current) {
      deepgramRef.current.stop();
      deepgramRef.current = null;
    }

    // Clean up any active Rust-side processes best-effort.
    invoke('stop_meeting_monitoring').catch(() => {});
    invoke('stop_audio_capture').catch(() => {});
    invoke('disable_meeting_detection').catch(() => {});

    startTimeRef.current = null;
    transcriptRef.current = [];

    setTranscript([]);
    setSummary('');
    setSparseNotes('');
    setMeetingTitle('');
    setDuration(0);
    setError(null);
    setIsEnding(false);
    setState(SESSION_STATE.IDLE);

    log('Session reset to idle');
  }, [_clearDurationInterval]);

  // ------------------------------------------------------------------
  // Public interface
  // ------------------------------------------------------------------

  return {
    // State
    state,
    transcript,
    summary,
    sparseNotes,
    setSparseNotes,
    meetingTitle,
    setMeetingTitle,
    duration,
    error,
    isEnding,

    // Actions
    startDetecting,
    stopDetecting,
    acceptPrompt,
    dismissPrompt,
    startRecording,
    stopRecording,
    reset,
  };
}

export default useMeetingSession;
