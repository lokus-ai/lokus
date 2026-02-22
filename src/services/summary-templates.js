/**
 * Meeting Summary Prompt Templates
 *
 * Each template function accepts a context object and returns a complete
 * prompt string ready to be sent to an LLM. Templates produce structured
 * Markdown output tailored to the meeting type.
 *
 * Context shape accepted by every template:
 * {
 *   transcript:    string  — formatted transcript, e.g. "Speaker 1 [00:01:23]: Hello..."
 *   sparseNotes:   string  — user's own notes taken during the meeting
 *   meetingTitle:  string  — optional title; falls back to "Ad-hoc Call"
 *   participants:  string  — optional participant list (names or labels)
 *   duration:      number  — optional meeting length in minutes
 * }
 *
 * @module services/summary-templates
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format today's date as YYYY-MM-DD in local time.
 * @returns {string}
 */
function _today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build the common meeting header block used by all templates.
 *
 * @param {string} meetingTitle
 * @param {string|number|undefined} duration
 * @param {string|undefined} participants
 * @returns {string}
 */
function _header(meetingTitle, duration, participants) {
  const title        = meetingTitle?.trim() || 'Ad-hoc Call';
  const durationText = duration != null ? `${duration} min` : 'unknown';
  const partText     = participants?.trim() || 'unknown';

  return [
    `## Meeting: ${title}`,
    `**Date:** ${_today()} | **Duration:** ${durationText} | **Participants:** ${partText}`,
  ].join('\n');
}

/**
 * Build the shared input block that provides the LLM with source material.
 *
 * @param {string} transcript
 * @param {string} sparseNotes
 * @returns {string}
 */
function _inputBlock(transcript, sparseNotes) {
  const tx    = transcript?.trim()   || '(no transcript available)';
  const notes = sparseNotes?.trim()  || '(no notes)';

  return [
    '---',
    '## Source Material',
    '',
    '### Transcript',
    tx,
    '',
    '### User Notes',
    notes,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Template functions
// ---------------------------------------------------------------------------

/**
 * General-purpose meeting summary template.
 *
 * Produces structured Markdown covering summary, decisions, action items,
 * merged notes, and open questions — suitable for any meeting type.
 *
 * @param {Object} ctx
 * @param {string} ctx.transcript
 * @param {string} ctx.sparseNotes
 * @param {string} [ctx.meetingTitle]
 * @param {string} [ctx.participants]
 * @param {number} [ctx.duration]
 * @returns {string} Full prompt string ready for the LLM.
 */
export function general({ transcript, sparseNotes, meetingTitle, participants, duration }) {
  const header = _header(meetingTitle, duration, participants);
  const inputs = _inputBlock(transcript, sparseNotes);

  const systemInstructions = `You are an expert meeting note-taker. You receive a meeting transcript and \
sparse notes typed by the user during the meeting. Produce a clean, structured summary in Markdown. \
Be concise. Preserve specific details such as names, numbers, and decisions. \
If speaker labels are present in the transcript (e.g. "Speaker 1 [00:01:23]:"), use them. \
Only include sections that have meaningful content — omit empty sections entirely.`;

  const outputFormat = `## Required Output Format

${header}

### Summary
[2-3 sentence overview of what was discussed and the main outcome]

### Key Decisions
- [Decision 1]
- [Decision 2]

### Action Items
- [ ] [Task description] — Owner: [Speaker or party responsible]

### Notes
[User's sparse notes merged with relevant context from the transcript. \
Preserve the user's own wording where possible and enrich it with transcript detail.]

### Open Questions
- [Unresolved item or question that needs follow-up]`;

  return [systemInstructions, '', inputs, '', outputFormat].join('\n');
}

/**
 * Sales call summary template.
 *
 * Emphasises prospect needs, objections raised, deal stage, and next steps.
 * Adds a "Deal Assessment" section not present in the general template.
 *
 * @param {Object} ctx
 * @param {string} ctx.transcript
 * @param {string} ctx.sparseNotes
 * @param {string} [ctx.meetingTitle]
 * @param {string} [ctx.participants]
 * @param {number} [ctx.duration]
 * @returns {string} Full prompt string ready for the LLM.
 */
export function sales({ transcript, sparseNotes, meetingTitle, participants, duration }) {
  const header = _header(meetingTitle, duration, participants);
  const inputs = _inputBlock(transcript, sparseNotes);

  const systemInstructions = `You are an expert sales analyst and note-taker. You receive a sales call \
transcript and sparse notes typed by the sales rep during the call. Produce a structured summary in \
Markdown that a sales manager or CRM system can act on immediately. \
Be concise and factual. Extract specific names, numbers, timelines, and commitments. \
If speaker labels are present (e.g. "AE [00:02:10]:"), use them to distinguish rep from prospect. \
Only include sections with meaningful content — omit empty sections entirely.`;

  const outputFormat = `## Required Output Format

${header}

### Summary
[2-3 sentence overview of the call outcome and current deal status]

### Prospect Needs & Pain Points
- [Specific need or pain point expressed by the prospect]

### Key Objections
- [Objection raised — include any response or rebuttal from the rep]

### Deal Assessment
- **Stage:** [e.g. Discovery / Demo / Proposal / Negotiation / Closed]
- **Budget:** [mentioned budget or "not discussed"]
- **Timeline:** [prospect's purchasing timeline or "not discussed"]
- **Decision Makers:** [names/roles identified]
- **Competitors Mentioned:** [any competing solutions discussed]

### Next Steps
- [ ] [Specific action] — Owner: [Rep / Prospect / Both]

### Notes
[User's sparse notes merged with relevant call context. Preserve the rep's own wording.]

### Open Questions
- [Unresolved item or question to address in follow-up]`;

  return [systemInstructions, '', inputs, '', outputFormat].join('\n');
}

/**
 * One-on-one (1:1) meeting summary template.
 *
 * Focuses on personal feedback, blockers, goal progress, and career development
 * topics typical of manager–report check-ins.
 *
 * @param {Object} ctx
 * @param {string} ctx.transcript
 * @param {string} ctx.sparseNotes
 * @param {string} [ctx.meetingTitle]
 * @param {string} [ctx.participants]
 * @param {number} [ctx.duration]
 * @returns {string} Full prompt string ready for the LLM.
 */
export function oneOnOne({ transcript, sparseNotes, meetingTitle, participants, duration }) {
  const header = _header(meetingTitle, duration, participants);
  const inputs = _inputBlock(transcript, sparseNotes);

  const systemInstructions = `You are an expert in team management and personal development. You receive \
the transcript of a one-on-one meeting between a manager and a direct report, along with sparse notes \
taken during the meeting. Produce a structured, actionable summary in Markdown. \
Be concise. Highlight specific feedback (both positive and constructive), any blockers raised, \
goal updates, and career development topics. \
If speaker labels are present, use them to distinguish manager from report. \
Only include sections with meaningful content — omit empty sections entirely.`;

  const outputFormat = `## Required Output Format

${header}

### Summary
[2-3 sentence overview of the 1:1 — main themes and how the conversation went]

### Feedback Exchanged
- **Positive:** [recognition or praise given]
- **Constructive:** [areas for improvement discussed]

### Blockers & Challenges
- [Blocker or challenge raised — include who owns resolving it]

### Goal Progress
- [Goal name or description]: [current status or progress update]

### Career Development
- [Career topic, aspiration, or development area discussed]

### Action Items
- [ ] [Task description] — Owner: [Manager / Report]

### Notes
[User's sparse notes merged with relevant 1:1 context. Preserve the user's own wording.]

### Follow-ups for Next 1:1
- [Item to revisit or check in on at the next meeting]`;

  return [systemInstructions, '', inputs, '', outputFormat].join('\n');
}

/**
 * Standup meeting summary template.
 *
 * Organises content into per-person blocks covering yesterday, today, and
 * blockers. Omits sections not relevant to a time-boxed daily sync.
 *
 * @param {Object} ctx
 * @param {string} ctx.transcript
 * @param {string} ctx.sparseNotes
 * @param {string} [ctx.meetingTitle]
 * @param {string} [ctx.participants]
 * @param {number} [ctx.duration]
 * @returns {string} Full prompt string ready for the LLM.
 */
export function standup({ transcript, sparseNotes, meetingTitle, participants, duration }) {
  const header = _header(meetingTitle, duration, participants);
  const inputs = _inputBlock(transcript, sparseNotes);

  const systemInstructions = `You are an expert scrum facilitator and note-taker. You receive the \
transcript of a daily standup meeting and sparse notes taken during the standup. \
Produce a concise, structured summary in Markdown organised by speaker. \
For each participant extract: what they completed yesterday, what they plan to do today, \
and any blockers. Keep each section brief — standups are time-boxed and notes should be scannable. \
If speaker labels are present (e.g. "Alice [00:00:45]:"), use them as the per-person headings. \
Only include sections with meaningful content — omit empty sections entirely.`;

  const outputFormat = `## Required Output Format

${header}

### Summary
[1-2 sentence team status overview — overall health and any shared blockers]

### Updates by Participant

**[Speaker / Name]**
- **Yesterday:** [what they completed]
- **Today:** [what they plan to work on]
- **Blockers:** [any blockers, or "None"]

*(Repeat the above block for each participant)*

### Blockers & Follow-ups
- [Blocking item — include owner and who can help unblock]

### Notes
[User's sparse notes merged with standup context. Preserve the user's own wording.]`;

  return [systemInstructions, '', inputs, '', outputFormat].join('\n');
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

/**
 * Registry mapping template IDs to their functions and metadata.
 * @type {Map<string, { fn: Function, name: string, description: string }>}
 */
const TEMPLATE_REGISTRY = new Map([
  [
    'general',
    {
      fn:          general,
      name:        'General Meeting',
      description: 'Default template for any meeting. Covers summary, decisions, action items, and open questions.',
    },
  ],
  [
    'sales',
    {
      fn:          sales,
      name:        'Sales Call',
      description: 'Optimised for sales calls. Highlights prospect needs, objections, deal stage, and next steps.',
    },
  ],
  [
    'oneOnOne',
    {
      fn:          oneOnOne,
      name:        '1:1 Meeting',
      description: 'Tailored for manager–report check-ins. Focuses on feedback, blockers, goals, and career development.',
    },
  ],
  [
    'standup',
    {
      fn:          standup,
      name:        'Daily Standup',
      description: 'Structured per-person blocks for yesterday, today, and blockers. Ideal for daily syncs.',
    },
  ],
]);

/**
 * Return metadata for all registered templates.
 *
 * @returns {Array<{ id: string, name: string, description: string }>}
 *
 * @example
 * const list = getTemplateList();
 * // [{ id: 'general', name: 'General Meeting', description: '...' }, ...]
 */
export function getTemplateList() {
  return Array.from(TEMPLATE_REGISTRY.entries()).map(([id, { name, description }]) => ({
    id,
    name,
    description,
  }));
}

/**
 * Return the template function for the given id.
 *
 * Falls back to the 'general' template when the id is not recognised, so
 * callers never need to guard against an undefined return value.
 *
 * @param {string} [id='general'] - Template identifier.
 * @returns {Function} Template function with signature (ctx) => string.
 *
 * @example
 * const templateFn = getTemplate('sales');
 * const prompt = templateFn({ transcript, sparseNotes, meetingTitle, participants, duration });
 */
export function getTemplate(id = 'general') {
  const entry = TEMPLATE_REGISTRY.get(id);
  if (!entry) {
    // Unknown id: fall back gracefully to 'general'
    return TEMPLATE_REGISTRY.get('general').fn;
  }
  return entry.fn;
}
