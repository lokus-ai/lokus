/**
 * transforms — the selection-transform catalog + runner (PRD §7 selection surface).
 *
 * The selection toolbar offers a fixed set of single-shot AI transforms over the
 * selected text (rewrite / simplify / expand / change tone / fix grammar /
 * translate). Each transform builds a prompt, streams a completion via aiClient,
 * and the caller stages the result through DiffPreview (replaceSelection) so the
 * user accepts/rejects before it lands.
 *
 * Keeping the catalog + prompt-building here (data, not UI) makes it unit-
 * testable and reusable by both the selection toolbar and the context menu.
 *
 * See LOKUS_AI_PRD.md §7 (selection transform → proxy Sonnet, medium credit).
 */

import { streamText } from './aiClient.js';

/**
 * The transform catalog. `id` doubles as the toolbar key; `system` is the
 * model instruction; `needsArg` transforms (tone, translate) take an argument.
 */
export const TRANSFORMS = [
  {
    id: 'rewrite',
    label: 'Rewrite',
    icon: 'Wand2',
    system: 'Rewrite the user-provided text to be clearer and more polished. Preserve meaning and any markdown. Return ONLY the rewritten text, no preamble.',
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: 'Minimize2',
    system: 'Rewrite the user-provided text to be simpler and easier to read, using plain language. Preserve meaning and markdown. Return ONLY the simplified text.',
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: 'Maximize2',
    system: 'Expand the user-provided text with more detail and supporting points. Preserve the original intent and markdown. Return ONLY the expanded text.',
  },
  {
    id: 'grammar',
    label: 'Fix grammar',
    icon: 'SpellCheck',
    system: 'Correct spelling, grammar, and punctuation in the user-provided text. Make no stylistic changes beyond corrections. Return ONLY the corrected text.',
  },
  {
    id: 'tone',
    label: 'Change tone',
    icon: 'Drama',
    needsArg: true,
    argLabel: 'Tone (e.g. formal, friendly, concise)',
    system: (arg) => `Rewrite the user-provided text in a ${arg || 'professional'} tone. Preserve meaning and markdown. Return ONLY the rewritten text.`,
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: 'Languages',
    needsArg: true,
    argLabel: 'Target language (e.g. Spanish)',
    system: (arg) => `Translate the user-provided text into ${arg || 'English'}. Preserve markdown formatting. Return ONLY the translation.`,
  },
];

/** Look up a transform by id. */
export function getTransform(id) {
  return TRANSFORMS.find((t) => t.id === id) ?? null;
}

/**
 * Run a transform over `text` and resolve to the transformed string.
 *
 * @param {string} id - transform id
 * @param {string} text - the selected text
 * @param {object} [opts]
 * @param {string} [opts.arg] - argument for needsArg transforms (tone/translate)
 * @param {AbortSignal} [opts.signal]
 * @param {(delta: string, full: string) => void} [opts.onDelta]
 * @param {string} [opts.model]
 * @returns {Promise<string>}
 */
export async function runTransform(id, text, opts = {}) {
  const t = getTransform(id);
  if (!t) throw new Error(`Unknown transform: ${id}`);
  if (!text || !text.trim()) throw new Error('No text selected to transform');

  const system = typeof t.system === 'function' ? t.system(opts.arg) : t.system;
  return streamText(
    [{ role: 'user', content: text }],
    { system, surface: 'selection', model: opts.model, signal: opts.signal },
    opts.onDelta,
  );
}

export default { TRANSFORMS, getTransform, runTransform };
