/**
 * Daily Note Integration Service
 *
 * Inserts structured meeting summaries into the daily note for today.
 * Each meeting summary is appended as a new Markdown section delimited by
 * a horizontal rule, so multiple meetings recorded on the same day stack
 * up cleanly in a single file.
 *
 * File operations use Tauri's filesystem plugin because this is a desktop
 * application — not the browser's File API.
 *
 * Depends on:
 *   - src/core/daily-notes/index.js — dailyNotesManager singleton
 *   - src/utils/logger.js           — logger
 *   - @tauri-apps/plugin-fs         — readTextFile, writeTextFile
 *
 * @module services/daily-note-integration
 */

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { dailyNotesManager }           from '../core/daily-notes/index.js';
import { logger }                      from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the daily notes manager is initialised for the given workspace.
 * Re-calling init is safe — the manager simply overwrites its workspacePath
 * and reloads config from the global store.
 *
 * @param {string} workspacePath - Absolute path to the user's workspace root.
 * @returns {Promise<void>}
 */
async function _ensureInitialised(workspacePath) {
  await dailyNotesManager.init(workspacePath);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a raw LLM summary into a consistent Markdown section suitable for
 * appending to a daily note.
 *
 * The section is delimited by a horizontal rule and carries a heading that
 * identifies the meeting, plus a metadata line showing the duration and the
 * recording attribution.
 *
 * @param {string} summary       - Raw summary text produced by the LLM.
 * @param {string} [meetingTitle] - Human-readable meeting name. Falls back to
 *                                  "Ad-hoc Call" when falsy.
 * @param {number} [duration=0]  - Meeting duration in **seconds**. Converted to
 *                                  rounded minutes for display.
 * @returns {string} Formatted Markdown section string, beginning with a blank
 *                   line so appending it to existing content always produces
 *                   correct spacing.
 *
 * @example
 * const section = formatMeetingSummarySection(
 *   '**Action items:** ...',
 *   'Q2 Planning',
 *   3723,
 * );
 * // Returns:
 * //
 * // ---
 * //
 * // ## Meeting Notes: Q2 Planning
 * // *Duration: 62 min | Recorded by Lokus*
 * //
 * // **Action items:** ...
 */
export function formatMeetingSummarySection(summary, meetingTitle, duration = 0) {
  const title       = meetingTitle?.trim() || 'Ad-hoc Call';
  const durationMin = Math.round((duration ?? 0) / 60);
  const now         = new Date();
  const time        = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const metaLine    = `*${time} | ${durationMin} min | Recorded by Lokus*`;

  return [
    '',
    '---',
    '',
    `## Meeting Notes: ${title}`,
    metaLine,
    '',
    summary ?? '',
  ].join('\n');
}

/**
 * Insert a meeting summary into today's daily note, creating the note (and
 * its parent folder) when it does not yet exist.
 *
 * When the daily note already exists every call appends a new section
 * separated by a horizontal rule — multiple meetings in one day accumulate
 * in chronological order within the same file.
 *
 * @param {Object} options
 * @param {string}  options.summary       - Raw LLM summary text.
 * @param {string}  [options.meetingTitle] - Human-readable meeting name.
 * @param {number}  [options.duration=0]  - Meeting duration in seconds.
 * @param {string}  options.workspacePath - Absolute path to the workspace root.
 *                                          Required — the daily notes manager
 *                                          cannot resolve paths without it.
 * @returns {Promise<{ path: string, created: boolean }>}
 *   - `path`    — Absolute path to the daily note that was written.
 *   - `created` — `true` when the file did not exist before this call.
 *
 * @throws {Error} When `workspacePath` is not provided, or when any
 *                 filesystem operation fails.
 *
 * @example
 * const result = await insertMeetingSummary({
 *   summary:       '**Decisions:** ...',
 *   meetingTitle:  'Q2 Planning',
 *   duration:      3723,
 *   workspacePath: '/Users/alice/Notes',
 * });
 * console.log(result.path);    // /Users/alice/Notes/Daily Notes/2026-02-21.md
 * console.log(result.created); // true | false
 */
export async function insertMeetingSummary({
  summary,
  meetingTitle,
  duration = 0,
  workspacePath,
} = {}) {
  if (!workspacePath) {
    throw new Error('insertMeetingSummary: workspacePath is required.');
  }

  if (typeof summary !== 'string') {
    throw new Error('insertMeetingSummary: summary must be a string.');
  }

  logger.info('DailyNoteIntegration', `Inserting meeting summary — title: "${meetingTitle ?? 'Ad-hoc Call'}"`);

  // Initialise the manager so getDailyNotePath resolves against the current workspace.
  try {
    await _ensureInitialised(workspacePath);
  } catch (err) {
    logger.error('DailyNoteIntegration', 'Failed to initialise daily notes manager:', err);
    throw new Error(`insertMeetingSummary: could not initialise daily notes manager — ${err.message}`);
  }

  const today    = new Date();
  const notePath = dailyNotesManager.getDailyNotePath(today);

  logger.info('DailyNoteIntegration', `Target daily note path: ${notePath}`);

  const formattedSection = formatMeetingSummarySection(summary, meetingTitle, duration);

  let noteExists;
  try {
    noteExists = await dailyNotesManager.fileExists(notePath);
  } catch (err) {
    logger.error('DailyNoteIntegration', 'Failed to check daily note existence:', err);
    throw new Error(`insertMeetingSummary: could not check if daily note exists — ${err.message}`);
  }

  if (!noteExists) {
    // ------------------------------------------------------------------
    // Daily note does not exist — create it from the template then append
    // the meeting summary in a single write.
    // ------------------------------------------------------------------
    logger.info('DailyNoteIntegration', 'Daily note not found — creating new file from template.');

    try {
      await dailyNotesManager.ensureFolder();
    } catch (err) {
      logger.error('DailyNoteIntegration', 'Failed to ensure daily notes folder:', err);
      throw new Error(`insertMeetingSummary: could not create daily notes folder — ${err.message}`);
    }

    let templateContent;
    try {
      templateContent = await dailyNotesManager.getDailyNoteContent(today);
    } catch (err) {
      logger.error('DailyNoteIntegration', 'Failed to get daily note template content:', err);
      throw new Error(`insertMeetingSummary: could not generate daily note template — ${err.message}`);
    }

    // Combine template with the meeting section, ensuring a trailing newline.
    const newContent = templateContent + formattedSection + '\n';

    try {
      await writeTextFile(notePath, newContent);
    } catch (err) {
      logger.error('DailyNoteIntegration', 'Failed to write new daily note:', err);
      throw new Error(`insertMeetingSummary: could not write daily note — ${err.message}`);
    }

    logger.info('DailyNoteIntegration', 'New daily note created and meeting summary inserted.');

    return { path: notePath, created: true };
  }

  // ------------------------------------------------------------------------
  // Daily note already exists — read it and append the new meeting section.
  // ------------------------------------------------------------------------
  logger.info('DailyNoteIntegration', 'Daily note found — appending meeting summary.');

  let existingContent;
  try {
    existingContent = await readTextFile(notePath);
  } catch (err) {
    logger.error('DailyNoteIntegration', 'Failed to read existing daily note:', err);
    throw new Error(`insertMeetingSummary: could not read daily note at "${notePath}" — ${err.message}`);
  }

  // Strip any trailing newline before appending so we control the exact
  // number of blank lines between the existing content and the new section.
  const trimmedExisting = existingContent.replace(/\n+$/, '');
  const updatedContent  = trimmedExisting + formattedSection + '\n';

  try {
    await writeTextFile(notePath, updatedContent);
  } catch (err) {
    logger.error('DailyNoteIntegration', 'Failed to write updated daily note:', err);
    throw new Error(`insertMeetingSummary: could not write updated daily note at "${notePath}" — ${err.message}`);
  }

  logger.info('DailyNoteIntegration', 'Meeting summary appended to existing daily note.');

  return { path: notePath, created: false };
}
