/**
 * GhostText — inline next-phrase suggestion (PRD §7, "Ghost text").
 *
 * OPT-IN and DEFAULT OFF (privacy + flow — PRD §7). The plugin renders a single
 * dimmed inline widget after the cursor with a model-suggested continuation;
 * Tab accepts it, Escape / any edit dismisses it. When disabled (the default) it
 * is completely inert: it registers no listeners' side effects, requests nothing,
 * and renders nothing.
 *
 * Suggestions are produced by an injected async `fetchSuggestion(context)` —
 * the surface wires this to aiClient.streamText with surface:'ghost' (local
 * Ollama qwen3:1.7b per ModelRouter; never cloud, never credits). The plugin
 * itself is provider-agnostic and unit-testable with a stub fetcher.
 *
 * Public API:
 *   createGhostTextPlugin(options) → { plugin, controller }
 *     options:
 *       enabled?: boolean                 default false
 *       fetchSuggestion?: (ctx) => Promise<string>
 *       debounceMs?: number               default 400
 *       minChars?: number                 default 3   (chars before cursor)
 *     controller:
 *       setEnabled(view, on)              toggle at runtime (persists OFF by default)
 *       isEnabled()                       boolean
 *       accept(view) / dismiss(view)      imperative (also bound to Tab / Esc)
 *       request(view)                     manually trigger a suggestion
 *
 * The widget never enters the document until accepted, so it never affects
 * serialization, the graph index, or sync.
 *
 * See LOKUS_AI_PRD.md §7 / §8.1 (ModelRouter ghost → ollama qwen3:1.7b).
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const ghostTextKey = new PluginKey('lokusAiGhostText');

const GHOST_CLASS = 'lokus-ai-ghost-text';

/**
 * Build the inline ghost widget DOM. A non-editable span the cursor sits before.
 * @param {string} text
 * @returns {HTMLElement}
 */
function ghostWidget(text) {
  const span = document.createElement('span');
  span.className = GHOST_CLASS;
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('aria-hidden', 'true');
  span.textContent = text;
  return span;
}

/**
 * @param {object} [options]
 * @returns {{ plugin: import('prosemirror-state').Plugin, controller: object }}
 */
export function createGhostTextPlugin(options = {}) {
  const config = {
    enabled: options.enabled ?? false, // DEFAULT OFF
    fetchSuggestion: options.fetchSuggestion ?? null,
    debounceMs: options.debounceMs ?? 400,
    minChars: options.minChars ?? 3,
  };

  let debounceTimer = null;
  let requestSeq = 0;

  /** Read plugin state from a view. */
  const getState = (view) => (view?.state ? ghostTextKey.getState(view.state) : null);

  /** Dispatch a meta action into the plugin. */
  const dispatch = (view, action) => {
    if (!view?.state) return;
    view.dispatch(view.state.tr.setMeta(ghostTextKey, action));
  };

  /** Clear any pending debounce. */
  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const plugin = new Plugin({
    key: ghostTextKey,
    state: {
      init() {
        return { enabled: config.enabled, suggestion: null, pos: null };
      },
      apply(tr, prev) {
        const action = tr.getMeta(ghostTextKey);
        if (action?.type === 'enable') return { ...prev, enabled: !!action.value, suggestion: null, pos: null };
        if (action?.type === 'show') {
          if (!prev.enabled) return prev;
          return { ...prev, suggestion: action.text, pos: action.pos };
        }
        if (action?.type === 'clear') return { ...prev, suggestion: null, pos: null };
        // Any real document change clears a stale suggestion.
        if (tr.docChanged && prev.suggestion) return { ...prev, suggestion: null, pos: null };
        return prev;
      },
    },
    props: {
      decorations(state) {
        const s = ghostTextKey.getState(state);
        if (!s?.enabled || !s.suggestion || s.pos == null) return DecorationSet.empty;
        const deco = Decoration.widget(s.pos, () => ghostWidget(s.suggestion), {
          side: 1,
          ignoreSelection: true,
          key: `ghost-${s.suggestion.length}`,
        });
        return DecorationSet.create(state.doc, [deco]);
      },
      handleKeyDown(view, event) {
        const s = getState(view);
        if (!s?.enabled || !s.suggestion) return false;
        if (event.key === 'Tab') {
          event.preventDefault();
          controller.accept(view);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          controller.dismiss(view);
          return true;
        }
        return false;
      },
    },
    view() {
      return {
        destroy() {
          clearDebounce();
        },
      };
    },
  });

  const controller = {
    isEnabled: () => config.enabled,

    setEnabled(view, on) {
      config.enabled = !!on;
      clearDebounce();
      dispatch(view, { type: 'enable', value: config.enabled });
    },

    /** Accept the current suggestion: insert it as real text at the cursor. */
    accept(view) {
      const s = getState(view);
      if (!s?.suggestion || s.pos == null) return false;
      const text = s.suggestion;
      const at = Math.min(s.pos, view.state.doc.content.size);
      const tr = view.state.tr.insertText(text, at, at);
      tr.setMeta(ghostTextKey, { type: 'clear' });
      tr.scrollIntoView();
      view.dispatch(tr);
      return true;
    },

    /** Dismiss without inserting. */
    dismiss(view) {
      clearDebounce();
      dispatch(view, { type: 'clear' });
      return true;
    },

    /**
     * Request a suggestion now (debounced). No-op when disabled, when no fetcher
     * is wired, or when there are too few characters before the cursor.
     * @param {import('prosemirror-view').EditorView} view
     */
    request(view) {
      if (!config.enabled || !config.fetchSuggestion || !view?.state) return;
      const { selection, doc } = view.state;
      if (!selection.empty) return; // only suggest at a collapsed cursor
      const pos = selection.to;
      const before = doc.textBetween(Math.max(0, pos - 200), pos, '\n', '\n');
      if (before.trim().length < config.minChars) return;

      clearDebounce();
      const seq = ++requestSeq;
      debounceTimer = setTimeout(async () => {
        let text = '';
        try {
          text = await config.fetchSuggestion({ before, pos });
        } catch {
          text = ''; // ghost failures are silent (PRD §7 / §8.3 fire-and-forget)
        }
        // Drop stale responses (newer request issued) or if disabled meanwhile.
        if (seq !== requestSeq || !config.enabled || !text) return;
        // Only show if the cursor hasn't moved past where we asked.
        if (view.state.selection.to === pos) {
          dispatch(view, { type: 'show', text, pos });
        }
      }, config.debounceMs);
    },
  };

  return { plugin, controller };
}

export default createGhostTextPlugin;
