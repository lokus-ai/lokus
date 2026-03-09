/**
 * Meeting Context
 *
 * Provides a single React context that makes the full meeting session API
 * available anywhere in the component tree without prop-drilling.
 *
 * Usage
 * -----
 * Wrap the part of the tree that needs meeting state with `MeetingProvider`,
 * then call `useMeeting()` in any descendant component:
 *
 *   // In your app root or layout:
 *   <MeetingProvider>
 *     <App />
 *   </MeetingProvider>
 *
 *   // In any descendant:
 *   const { state, startRecording, stopRecording, transcript } = useMeeting();
 *
 * The context value is the full object returned by `useMeetingSession` — see
 * that hook's JSDoc for the complete API surface.
 *
 * @module contexts/MeetingContext
 */

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useMeetingSession } from '../hooks/useMeetingSession.js';

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

/**
 * The raw React context object.
 * Default value is `null` so that `useMeeting` can detect when a consumer
 * is rendered outside of a `MeetingProvider` and throw a helpful error.
 *
 * @type {React.Context<import('../hooks/useMeetingSession.js').MeetingSessionAPI | null>}
 */
const MeetingContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Provides meeting session state to all descendants.
 *
 * Internally calls `useMeetingSession()` once and passes the resulting object
 * as the context value, ensuring a single shared session across the subtree.
 *
 * @param {Object}         props
 * @param {React.ReactNode} props.children - Child components that may consume
 *                                           the meeting context.
 * @returns {JSX.Element}
 */
export function MeetingProvider({ children }) {
  const session = useMeetingSession();

  // Request native notification permission once on mount.
  useEffect(() => {
    invoke('request_notification_permission_cmd').catch(console.error);
  }, []);

  // Auto-start meeting detection whenever state returns to idle (including
  // initial mount, after a session completes, and after a reset).
  useEffect(() => {
    if (session.state !== 'idle') return;

    const settings = JSON.parse(localStorage.getItem('lokus-meeting-settings') || '{}');
    const micDetection = settings.detectAdHocCalls !== false; // default true
    console.log('[Lokus Meeting] Auto-start check:', { micDetection, state: session.state });
    if (micDetection) {
      console.log('[Lokus Meeting] Starting detection...');
      session.startDetecting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]); // re-run whenever state changes

  // Show/close Notion-style floating overlay based on meeting state.
  const prevState = useRef(session.state);
  useEffect(() => {
    if (session.state === 'prompted') {
      console.log('[Lokus Meeting] Meeting detected — showing overlay');
      invoke('open_meeting_overlay').catch((err) => {
        console.warn('[Lokus Meeting] Overlay failed:', err);
      });
    } else if (prevState.current === 'prompted' && session.state !== 'prompted') {
      // State left prompted — close the overlay window
      invoke('close_meeting_overlay').catch(() => {});
    }
    prevState.current = session.state;
  }, [session.state]);

  // Listen for action buttons from native notification banner.
  useEffect(() => {
    const unlisten = listen('lokus:notification-action', (event) => {
      const { action } = event.payload;
      if (
        action === 'start_recording' ||
        action === 'com.apple.UNNotificationDefaultActionIdentifier'
      ) {
        session.acceptPrompt();
      } else if (action === 'dismiss') {
        session.dismissPrompt();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.acceptPrompt, session.dismissPrompt]);

  // Listen for "Start transcribing" from the MeetingOverlay window.
  useEffect(() => {
    const unlisten = listen('meeting:start-recording', () => {
      console.log('[Lokus Meeting] Overlay start-recording received');
      session.acceptPrompt();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.acceptPrompt]);

  return (
    <MeetingContext.Provider value={session}>
      {children}
    </MeetingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Access the current meeting session from any component inside `MeetingProvider`.
 *
 * Throws an error with a clear message when called outside of a provider so
 * that misconfigured trees are caught early during development.
 *
 * @returns {import('../hooks/useMeetingSession.js').MeetingSessionAPI}
 *
 * @throws {Error} When called outside of a `MeetingProvider`.
 *
 * @example
 * function RecordButton() {
 *   const { state, startRecording, stopRecording } = useMeeting();
 *   const isRecording = state === 'recording';
 *   return (
 *     <button onClick={isRecording ? stopRecording : startRecording}>
 *       {isRecording ? 'Stop' : 'Record'}
 *     </button>
 *   );
 * }
 */
export function useMeeting() {
  const ctx = useContext(MeetingContext);

  if (!ctx) {
    throw new Error(
      'useMeeting must be used within a MeetingProvider. ' +
      'Wrap your component tree with <MeetingProvider> to fix this.'
    );
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default MeetingContext;
