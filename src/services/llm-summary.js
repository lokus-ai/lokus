/**
 * LLM Meeting Summary Service
 *
 * Orchestrates the end-to-end flow of generating a structured meeting summary:
 *
 *   1. Load the current AI provider configuration.
 *   2. Select and invoke the appropriate prompt template.
 *   3. Create an LLM client and dispatch the request (streaming or one-shot).
 *   4. Return the completed summary (and token usage where available).
 *
 * This module contains no React or UI code — it is pure async service logic.
 *
 * Depends on:
 *   - src/services/ai-provider.js  — createLLMClient, loadProviderConfig
 *   - src/services/summary-templates.js — getTemplate
 *   - src/utils/logger.js           — logger
 *
 * LLM client interface expected (from ai-provider.js spec):
 *   generateSummary(prompt: string) → Promise<string>
 *   streamSummary(prompt: string, onChunk: (text: string) => void) → Promise<string>
 *
 * @module services/llm-summary
 */

import { createLLMClient, loadProviderConfig } from './ai-provider.js';
import { buildMeetingPrompt }                   from './summary-templates.js';
import { logger }                               from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the { system, user } prompt pair for the LLM.
 *
 * @param {Object} ctx
 * @param {string}  ctx.transcript
 * @param {string}  ctx.sparseNotes
 * @param {string}  [ctx.meetingTitle]
 * @param {number}  [ctx.duration]
 * @param {string}  [ctx.typeHint='auto-detect']
 * @returns {{ system: string, user: string }}
 */
function _buildPrompt({ transcript, sparseNotes, meetingTitle, duration, typeHint = 'auto-detect' }) {
  return buildMeetingPrompt({ transcript, sparseNotes, meetingTitle, duration, typeHint });
}

/**
 * Validate that the essential string inputs are present and throw a
 * descriptive error when they are missing.
 *
 * @param {string|undefined} transcript
 * @param {string|undefined} sparseNotes
 */
function _validateInputs(transcript, sparseNotes) {
  if (transcript !== undefined && typeof transcript !== 'string') {
    throw new Error('llm-summary: transcript must be a string.');
  }
  if (sparseNotes !== undefined && typeof sparseNotes !== 'string') {
    throw new Error('llm-summary: sparseNotes must be a string.');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a structured meeting summary in a single (non-streaming) request.
 *
 * @param {Object} options
 * @param {string}        options.transcript    - Full transcript text formatted as
 *                                               "Speaker 1 [00:01:23]: Hello everyone..."
 * @param {string}        [options.sparseNotes=''] - User's own notes taken during the meeting.
 * @param {string}        [options.meetingTitle]   - Optional meeting title.
 * @param {string}        [options.participants]   - Optional participant names / labels.
 * @param {number}        [options.duration]       - Optional meeting length in minutes.
 * @param {string}        [options.typeHint='auto-detect'] - Hint for the meeting type used to
 *                                                          select the prompt style.
 * @returns {Promise<{ summary: string, tokensUsed: { prompt: number, completion: number } }>}
 *
 * @throws {Error} When the AI provider configuration cannot be loaded or the
 *                 LLM request fails.
 *
 * @example
 * const result = await generateMeetingSummary({
 *   transcript:   'Alice [00:00:05]: Good morning everyone...',
 *   sparseNotes:  'Discussed Q2 targets. Alice to send deck.',
 *   meetingTitle: 'Q2 Planning',
 *   participants: 'Alice, Bob, Carol',
 *   duration:     30,
 *   typeHint:     'auto-detect',
 * });
 * console.log(result.summary);
 */
export async function generateMeetingSummary({
  transcript    = '',
  sparseNotes   = '',
  meetingTitle,
  participants,
  duration,
  typeHint      = 'auto-detect',
} = {}) {
  _validateInputs(transcript, sparseNotes);

  logger.info('LLMSummary', `generateMeetingSummary — typeHint: "${typeHint}"`);

  let config;
  try {
    config = await loadProviderConfig();
  } catch (err) {
    logger.error('LLMSummary', 'Failed to load provider config:', err);
    throw new Error(`generateMeetingSummary: could not load AI provider config — ${err.message}`);
  }

  const prompt = _buildPrompt({ transcript, sparseNotes, meetingTitle, duration, typeHint });

  const client = createLLMClient(config);

  let raw;
  try {
    raw = await client.generateSummary(prompt);
  } catch (err) {
    logger.error('LLMSummary', 'generateSummary LLM call failed:', err);
    throw new Error(`generateMeetingSummary: LLM request failed — ${err.message}`);
  }

  // The LLM client may return a plain string or an object that carries token
  // usage. Normalise both shapes here so callers always get a consistent result.
  if (typeof raw === 'string') {
    return {
      summary:    raw,
      tokensUsed: { prompt: 0, completion: 0 },
    };
  }

  // Object shape: { text/summary/content, usage/tokensUsed }
  const summary = raw?.summary ?? raw?.text ?? raw?.content ?? '';
  const usage   = raw?.usage   ?? raw?.tokensUsed ?? {};
  return {
    summary,
    tokensUsed: {
      prompt:     usage?.prompt_tokens     ?? usage?.prompt     ?? 0,
      completion: usage?.completion_tokens ?? usage?.completion ?? 0,
    },
  };
}

/**
 * Generate a structured meeting summary using real-time streaming.
 *
 * The `onChunk` callback is invoked for every text fragment the LLM produces,
 * enabling the UI to render the summary progressively. The returned Promise
 * resolves with the complete assembled summary once the stream closes.
 *
 * @param {Object} options
 * @param {string}        options.transcript    - Full transcript text formatted as
 *                                               "Speaker 1 [00:01:23]: Hello everyone..."
 * @param {string}        [options.sparseNotes=''] - User's own notes taken during the meeting.
 * @param {string}        [options.meetingTitle]   - Optional meeting title.
 * @param {string}        [options.participants]   - Optional participant names / labels.
 * @param {number}        [options.duration]       - Optional meeting length in minutes.
 * @param {string}        [options.typeHint='auto-detect'] - Hint for the meeting type used to
 *                                                          select the prompt style.
 * @param {function(string): void} options.onChunk - Called for each incremental text chunk.
 *                                                   Must be a function.
 * @returns {Promise<{ summary: string }>} Resolves when the stream is complete.
 *
 * @throws {Error} When onChunk is not a function, config cannot be loaded, or
 *                 the LLM stream fails.
 *
 * @example
 * let accumulated = '';
 * const result = await streamMeetingSummary({
 *   transcript:   'Alice [00:00:05]: Good morning everyone...',
 *   sparseNotes:  'Discussed Q2 targets.',
 *   meetingTitle: 'Q2 Planning',
 *   participants: 'Alice, Bob',
 *   duration:     30,
 *   typeHint:     'auto-detect',
 *   onChunk:      (chunk) => { accumulated += chunk; },
 * });
 * console.log(result.summary); // same as accumulated
 */
export async function streamMeetingSummary({
  transcript    = '',
  sparseNotes   = '',
  meetingTitle,
  participants,
  duration,
  typeHint      = 'auto-detect',
  onChunk,
} = {}) {
  if (typeof onChunk !== 'function') {
    throw new Error('streamMeetingSummary: onChunk must be a function.');
  }

  _validateInputs(transcript, sparseNotes);

  logger.info('LLMSummary', `streamMeetingSummary — typeHint: "${typeHint}"`);

  let config;
  try {
    config = await loadProviderConfig();
  } catch (err) {
    logger.error('LLMSummary', 'Failed to load provider config:', err);
    throw new Error(`streamMeetingSummary: could not load AI provider config — ${err.message}`);
  }

  const prompt = _buildPrompt({ transcript, sparseNotes, meetingTitle, duration, typeHint });

  const client = createLLMClient(config);

  // Accumulate chunks so we can return the full assembled summary.
  const chunks = [];

  const handleChunk = (text) => {
    chunks.push(text);
    onChunk(text);
  };

  try {
    // streamSummary returns the full summary string when the stream is done,
    // or void — handle both shapes.
    const result = await client.streamSummary(prompt, handleChunk);

    // Prefer the return value from the client if it provides one; otherwise
    // assemble from accumulated chunks.
    const summary = (typeof result === 'string' && result.length > 0)
      ? result
      : chunks.join('');

    return { summary };
  } catch (err) {
    logger.error('LLMSummary', 'streamSummary LLM call failed:', err);
    throw new Error(`streamMeetingSummary: LLM stream failed — ${err.message}`);
  }
}

/**
 * Convenience wrapper that re-generates a meeting summary using a different
 * template. Useful for reformatting an existing meeting's notes without
 * changing any other inputs.
 *
 * This is intentionally a thin wrapper around {@link generateMeetingSummary};
 * the caller is responsible for supplying the original transcript and notes.
 *
 * @param {Object} options
 * @param {string}        options.transcript    - Full transcript text.
 * @param {string}        [options.sparseNotes=''] - User's notes from the meeting.
 * @param {string}        [options.meetingTitle]   - Optional meeting title.
 * @param {string}        [options.participants]   - Optional participant names / labels.
 * @param {number}        [options.duration]       - Optional meeting length in minutes.
 * @param {string}        [options.typeHint='auto-detect'] - Hint for the meeting type used to
 *                                                          select the prompt style.
 * @returns {Promise<{ summary: string, tokensUsed: { prompt: number, completion: number } }>}
 *
 * @throws {Error} Propagates any errors from {@link generateMeetingSummary}.
 *
 * @example
 * // Reformat an existing meeting with a standup hint
 * const result = await regenerateSummary({
 *   transcript:   existingTranscript,
 *   sparseNotes:  existingNotes,
 *   meetingTitle: 'Morning Sync',
 *   typeHint:     'standup',
 * });
 */
export async function regenerateSummary({
  transcript    = '',
  sparseNotes   = '',
  meetingTitle,
  participants,
  duration,
  typeHint      = 'auto-detect',
} = {}) {
  logger.info('LLMSummary', `regenerateSummary — switching to typeHint: "${typeHint}"`);

  return generateMeetingSummary({
    transcript,
    sparseNotes,
    meetingTitle,
    participants,
    duration,
    typeHint,
  });
}
