/**
 * Meeting Summary Prompt Builder
 *
 * Builds the system + user message pair for the Lokus meeting summary LLM call.
 * Uses a single universal prompt that auto-detects meeting type and smart-merges
 * user notes by intent.
 *
 * @module services/summary-templates
 */

// ---------------------------------------------------------------------------
// System prompt — the "Lokus voice"
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Lokus, an expert meeting note-taker built into a desktop app. You produce clean, structured meeting summaries in Markdown.

Your principles:

1. USER NOTES ARE PRIMARY. The user typed sparse notes during the meeting because those moments mattered to them. Every user note must appear in the output — classified by intent and placed in the appropriate section. Never drop a user note.

2. SMART MERGE. Classify each user note by intent:
   - Looks like a task/to-do → Action Items (as a checkbox)
   - Looks like a decision or agreement → Key Decisions
   - Looks like a question or uncertainty → Open Questions
   - Everything else → Notes (enriched with transcript context)
   Then fill remaining sections from the transcript.

3. BE CONCISE AND PROFESSIONAL. Write in clear, complete sentences. No filler, no hedging, no "the team proceeded to discuss." State what happened and what was decided. If something was unresolved, say so plainly.

4. OMIT EMPTY SECTIONS. Only include a section if there is meaningful content for it. Never output placeholder text like "[No decisions were made]".

5. ADAPT TO THE MEETING. Detect the meeting type from the conversation content and adjust your sections accordingly:
   - Sales/client call → add Prospect Needs, Objections, Deal Assessment
   - 1:1/check-in → add Feedback, Blockers, Goal Progress
   - Standup/daily sync → organize by participant (Yesterday/Today/Blockers)
   - General/other → use the standard sections
   If the user provides a type hint, follow it.

6. PRESERVE SPECIFICS. Names, numbers, dates, deadlines, dollar amounts — always keep these exact. Never generalize "Alice said she'd send it Friday" into "a team member will follow up."

7. ACTION ITEMS NEED OWNERS. Every action item must have an owner name (from speaker labels or context). If the owner is ambiguous, note it.

8. IDENTIFY SPEAKERS BY NAME. The transcript uses numeric labels (Speaker 0, Speaker 1, etc.). Scan the conversation for name mentions — people greet each other, say "Thanks Alice", "Bob, what do you think?", introduce themselves. Map numeric IDs to real names wherever the evidence is clear. Use the real name from that point on. If a speaker's name never appears, keep the numeric label (Speaker 2). Never guess — only assign a name when the transcript clearly supports it.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format today's date as YYYY-MM-DD - Day of week in local time.
 * @returns {string}
 */
function _today() {
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} - ${days[d.getDay()]}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the { system, user } prompt pair for a meeting summary.
 *
 * @param {Object} ctx
 * @param {string}  ctx.transcript    - Formatted transcript ("Speaker 0 [00:01:23]: ...")
 * @param {string}  [ctx.sparseNotes] - User's notes taken during the meeting.
 * @param {string}  [ctx.meetingTitle] - Meeting title (falls back to "Ad-hoc Call").
 * @param {number}  [ctx.duration]     - Meeting length in minutes.
 * @param {string}  [ctx.typeHint]     - User override: "sales", "standup", "1on1", or "auto-detect".
 * @returns {{ system: string, user: string }}
 */
export function buildMeetingPrompt({
  transcript,
  sparseNotes,
  meetingTitle,
  duration,
  typeHint = 'auto-detect',
} = {}) {
  const title    = meetingTitle?.trim() || 'Ad-hoc Call';
  const durText  = duration != null ? `${duration} minutes` : 'unknown';
  const notes    = sparseNotes?.trim() || '(no notes taken)';
  const tx       = transcript?.trim()  || '(no transcript available)';

  const user = `## Meeting Context
- **Title:** ${title}
- **Date:** ${_today()}
- **Duration:** ${durText}
- **Type hint:** ${typeHint}

## User Notes (taken during the meeting)
${notes}

## Transcript
${tx}

## Output Format

### ${title}

#### Summary
[2-3 sentences: what was discussed, main outcome]

#### Key Decisions
- [Decision with context on who decided and why]

#### Action Items
- [ ] [Specific task] — **Owner:** [Name]

#### Notes
[User's notes enriched with transcript context]

#### Open Questions
- [Unresolved item that needs follow-up]`;

  return { system: SYSTEM_PROMPT, user };
}

/**
 * Return metadata for available type hints (for UI dropdown).
 *
 * @returns {Array<{ id: string, name: string, description: string }>}
 */
export function getTypeHints() {
  return [
    { id: 'auto-detect', name: 'Auto-detect',    description: 'AI determines the meeting type from content.' },
    { id: 'sales',       name: 'Sales Call',      description: 'Adds prospect needs, objections, deal assessment.' },
    { id: '1on1',        name: '1:1 Meeting',     description: 'Adds feedback, blockers, goal progress.' },
    { id: 'standup',     name: 'Daily Standup',   description: 'Organizes updates by participant.' },
    { id: 'general',     name: 'General Meeting', description: 'Standard sections for any meeting.' },
  ];
}

// Backwards-compatible exports so existing callers don't break during migration.
// getTemplate returns a function that produces a flat string (old interface).
// buildMeetingPrompt is the new preferred export.
export function getTemplate(_id) {
  return (ctx) => {
    const { system, user } = buildMeetingPrompt({
      ...ctx,
      typeHint: _id === 'general' ? 'auto-detect' : _id,
    });
    return `${system}\n---\n${user}`;
  };
}
