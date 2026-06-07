/**
 * DiffPreview — the AI write-safety primitive (PRD §9.1).
 *
 * Every AI surface that writes to the editor MUST go through this primitive
 * first: AI content is inserted, decorated as a pending change, and a confirm
 * bar offers Accept / Reject. Accept keeps the change; Reject (or Cmd-Z) undoes
 * it via `prosemirror-history` (already installed — no new dependency, no schema
 * change). This is the "ship-now" path from PRD §9.1 (option 1): self-contained
 * decorations on top of the existing history plugin, so it works against the
 * Lokus schema unmodified.
 *
 * A richer tracked-changes mode (prosemirror-suggestion-mode, added to
 * package.json) can later back the same interface once the schema owner
 * registers the suggestion marks (integrator / Workspace.jsx wiring). Until
 * then this decoration-based mode is the active implementation.
 *
 * Public API (used by Cmd-K, selection toolbar, slash /ai, agent loop):
 *   createDiffPreviewPlugin()                  → ProseMirror Plugin (mount once)
 *   previewWriteBuffer(view, ops, opts?)       → stage AI writes as pending
 *   acceptPreview(view)                        → commit pending writes
 *   rejectPreview(view)                        → undo pending writes
 *   hasPendingPreview(view)                    → boolean
 *
 * `ops` is the write buffer the agent loop / pipeline accumulates. Each op:
 *   { type: 'insert',  text, at? }                  insert at `at` (default: cursor)
 *   { type: 'replace', text, from, to }             replace [from,to)
 *   { type: 'replaceSelection', text }              replace current selection
 *
 * Every accept/reject appends one line to `.lokus/ai-audit.jsonl` via the Rust
 * `append_audit_log` command. The command may not exist yet (providers/integrator
 * own the Rust side) — the call is best-effort and never throws into the editor.
 *
 * See LOKUS_AI_PRD.md §9.1 / §9.2.
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { undo } from 'prosemirror-history';

/** Shared plugin key so external helpers can read/update preview state. */
export const diffPreviewKey = new PluginKey('lokusAiDiffPreview');

/** CSS classes the editor stylesheet can target (see styles, optional). */
const INSERT_CLASS = 'lokus-ai-diff-insert';
const PENDING_ATTR = 'data-lokus-ai-pending';

/**
 * Lazily resolve the Tauri `invoke` so this module stays unit-testable in a
 * plain jsdom environment (no Tauri runtime). Returns a no-op resolver if the
 * Tauri API is unavailable.
 * @returns {(cmd: string, args?: object) => Promise<any>}
 */
function getInvoke() {
  try {
    // Avoid a static import so vitest/jsdom doesn't need the Tauri bridge.
    const api = globalThis.__TAURI__?.core ?? globalThis.__TAURI__?.tauri;
    if (api?.invoke) return api.invoke.bind(api);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Append one NDJSON line to the local AI audit log. Best-effort: a missing
 * `append_audit_log` command or a non-Tauri environment is swallowed so the
 * write surface never breaks on audit failure (PRD §9.2).
 * @param {object} entry
 */
export async function appendAuditLine(entry) {
  const invoke = getInvoke();
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  if (!invoke) return;
  try {
    await invoke('append_audit_log', { line });
  } catch {
    // command not registered yet / write failed — degrade silently.
  }
}

/**
 * The plugin holds a DecorationSet over the pending ranges plus bookkeeping:
 *   { decorations, steps, ranges, meta }
 * `steps` counts how many history-undoable transactions the active preview
 * produced, so rejectPreview can undo exactly that many.
 */
export function createDiffPreviewPlugin() {
  return new Plugin({
    key: diffPreviewKey,
    state: {
      init() {
        return { decorations: DecorationSet.empty, steps: 0, ranges: [], meta: null };
      },
      apply(tr, prev, _oldState, newState) {
        const action = tr.getMeta(diffPreviewKey);

        if (action?.type === 'set') {
          // A fresh preview was staged: build decorations over the new ranges.
          const decos = action.ranges.map((r) =>
            Decoration.inline(r.from, r.to, {
              class: INSERT_CLASS,
              [PENDING_ATTR]: 'true',
            }),
          );
          return {
            decorations: DecorationSet.create(newState.doc, decos),
            steps: action.steps ?? 1,
            ranges: action.ranges,
            meta: action.meta ?? null,
          };
        }

        if (action?.type === 'clear') {
          return { decorations: DecorationSet.empty, steps: 0, ranges: [], meta: null };
        }

        // No preview action: map existing decorations through the doc change so
        // they stay anchored to the right text as the user keeps typing.
        if (prev.decorations === DecorationSet.empty) return prev;
        return {
          ...prev,
          decorations: prev.decorations.map(tr.mapping, tr.doc),
        };
      },
    },
    props: {
      decorations(state) {
        return diffPreviewKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}

/**
 * Read the current preview state.
 * @param {import('prosemirror-view').EditorView} view
 * @returns {{ decorations: DecorationSet, steps: number, ranges: Array, meta: any }|null}
 */
function previewState(view) {
  if (!view?.state) return null;
  return diffPreviewKey.getState(view.state) ?? null;
}

/**
 * Is there an active, un-accepted/un-rejected preview?
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
export function hasPendingPreview(view) {
  const s = previewState(view);
  return !!s && s.steps > 0;
}

/**
 * Apply a single write op to a transaction, returning the inserted/replaced
 * range so it can be decorated. Pure text writes only (the AI buffer is text);
 * block content can be added later via the schema-aware path.
 * @param {import('prosemirror-state').Transaction} tr
 * @param {import('prosemirror-model').Schema} schema
 * @param {object} op
 * @param {import('prosemirror-state').Selection} selection
 * @returns {{ from: number, to: number }|null}
 */
function applyOp(tr, schema, op, selection) {
  const text = op.text ?? '';
  if (op.type === 'replace' && Number.isFinite(op.from) && Number.isFinite(op.to)) {
    const from = tr.mapping.map(op.from);
    const to = tr.mapping.map(op.to);
    tr.insertText(text, from, to);
    return { from, to: from + text.length };
  }
  if (op.type === 'replaceSelection') {
    const from = tr.mapping.map(selection.from);
    const to = tr.mapping.map(selection.to);
    tr.insertText(text, from, to);
    return { from, to: from + text.length };
  }
  // default: insert
  const at = Number.isFinite(op.at) ? tr.mapping.map(op.at) : tr.mapping.map(selection.to);
  tr.insertText(text, at, at);
  return { from: at, to: at + text.length };
}

/**
 * Stage a write buffer as a pending preview. The content is really inserted
 * (so it is visible and `prosemirror-history` records it for undo), decorated
 * as pending, and the cursor is left after the change. Call acceptPreview /
 * rejectPreview to resolve it.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {object[]} ops - write buffer (see module doc)
 * @param {object} [opts]
 * @param {object} [opts.meta] - audit metadata (surface, actionId, model, …)
 * @returns {boolean} true if anything was staged
 */
export function previewWriteBuffer(view, ops, opts = {}) {
  if (!view?.state || !Array.isArray(ops) || ops.length === 0) return false;

  // Reject any in-flight preview before staging a new one (one at a time).
  if (hasPendingPreview(view)) rejectPreview(view);

  const { state } = view;
  const tr = state.tr;
  const ranges = [];
  for (const op of ops) {
    const r = applyOp(tr, state.schema, op, state.selection);
    if (r && r.to > r.from) ranges.push(r);
  }
  if (ranges.length === 0) return false;

  // Place the cursor at the end of the last staged range.
  const last = ranges[ranges.length - 1];
  const caret = Math.min(last.to, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, caret));
  tr.setMeta(diffPreviewKey, {
    type: 'set',
    ranges,
    steps: 1,
    meta: opts.meta ?? null,
  });
  tr.setMeta('addToHistory', true);
  tr.scrollIntoView();
  view.dispatch(tr);
  return true;
}

/**
 * Accept the pending preview: drop the decorations, keep the inserted content.
 * Appends an audit line.
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
export function acceptPreview(view) {
  const s = previewState(view);
  if (!s || s.steps === 0) return false;
  const meta = s.meta;
  const tr = view.state.tr.setMeta(diffPreviewKey, { type: 'clear' });
  view.dispatch(tr);
  appendAuditLine({ outcome: 'accepted', ...(meta ? { ...meta } : {}) });
  return true;
}

/**
 * Reject the pending preview: undo the staged transaction(s) via
 * `prosemirror-history`, then drop the decorations. Appends an audit line.
 * Cmd-Z performs the same undo natively; this is the explicit-button path.
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
export function rejectPreview(view) {
  const s = previewState(view);
  if (!s || s.steps === 0) return false;
  const meta = s.meta;
  const steps = s.steps;

  // Undo exactly the transactions this preview produced. We clear decorations
  // first so the post-undo state starts from a clean preview slate.
  view.dispatch(view.state.tr.setMeta(diffPreviewKey, { type: 'clear' }));
  for (let i = 0; i < steps; i += 1) {
    undo(view.state, view.dispatch);
  }
  appendAuditLine({ outcome: 'rejected', ...(meta ? { ...meta } : {}) });
  return true;
}

export default {
  createDiffPreviewPlugin,
  previewWriteBuffer,
  acceptPreview,
  rejectPreview,
  hasPendingPreview,
  appendAuditLine,
  diffPreviewKey,
};
