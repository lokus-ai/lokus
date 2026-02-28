/**
 * Suggestion Plugin Factory
 *
 * Drop-in replacement for @tiptap/suggestion that works with raw ProseMirror.
 * Creates a ProseMirror Plugin that detects trigger characters in text before the
 * cursor and drives a render lifecycle (onStart, onUpdate, onKeyDown, onExit) for
 * autocomplete / suggestion UIs.
 *
 * Config shape is intentionally identical to @tiptap/suggestion so that existing
 * consumer code (SlashCommand, WikiLinkSuggest, TagAutocomplete, TaskMentionSuggest,
 * PluginCompletion) can migrate with minimal changes.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// Re-export PluginKey for convenience -- consumers previously imported it
// alongside suggestion from @tiptap/pm/state.
export { PluginKey };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape special regex characters in a string.
 * Equivalent to @tiptap/core's `escapeForRegEx`.
 */
function escapeForRegEx(string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Find a suggestion match in the text node immediately before `$position`.
 *
 * This is a faithful JS port of @tiptap/suggestion's `findSuggestionMatch`.
 *
 * @param {object} config
 * @param {string} config.char - Trigger character (e.g. '/', '@', '#', '[', '^').
 * @param {boolean} config.allowSpaces - If true, spaces do not end the query.
 * @param {string[]|null} config.allowedPrefixes - Characters allowed before the trigger.
 *   `null` means any prefix is allowed.  Default `[' ']`.
 * @param {boolean} config.startOfLine - If true, trigger must appear at the start of the line.
 * @param {ResolvedPos} config.$position - ProseMirror ResolvedPos of the cursor.
 * @returns {{ range: { from: number, to: number }, query: string, text: string } | null}
 */
function findSuggestionMatch(config) {
  const {
    char,
    allowSpaces = false,
    allowedPrefixes = [' '],
    startOfLine = false,
    $position,
  } = config;

  const escapedChar = escapeForRegEx(char);
  const suffix = new RegExp(`\\s${escapedChar}$`);
  const prefix = startOfLine ? '^' : '';
  const regexp = allowSpaces
    ? new RegExp(`${prefix}${escapedChar}.*?(?=\\s${escapedChar}|$)`, 'gm')
    : new RegExp(`${prefix}(?:^)?${escapedChar}[^\\s${escapedChar}]*`, 'gm');

  const text = $position.nodeBefore?.isText && $position.nodeBefore.text;

  if (!text) {
    return null;
  }

  const textFrom = $position.pos - text.length;
  const match = Array.from(text.matchAll(regexp)).pop();

  if (!match || match.input === undefined || match.index === undefined) {
    return null;
  }

  // JavaScript doesn't have lookbehinds in all targets. This hacks a check
  // that the character before the match is an allowed prefix (space, specific
  // char, or start of text node).
  const matchPrefix = match.input.slice(Math.max(0, match.index - 1), match.index);
  const matchPrefixIsAllowed = new RegExp(
    `^[${allowedPrefixes?.join('')}\0]?$`,
  ).test(matchPrefix);

  if (allowedPrefixes !== null && !matchPrefixIsAllowed) {
    return null;
  }

  // Absolute position of the match in the document.
  const from = textFrom + match.index;
  let to = from + match[0].length;

  // Edge case: if spaces are allowed and we're directly between two triggers.
  if (allowSpaces && suffix.test(text.slice(to - 1, to + 1))) {
    match[0] += ' ';
    to += 1;
  }

  // Only return if the cursor ($position.pos) is within the matched range.
  if (from < $position.pos && to >= $position.pos) {
    return {
      range: { from, to },
      query: match[0].slice(char.length),
      text: match[0],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Default plugin key (matches TipTap's default)
// ---------------------------------------------------------------------------

export const SuggestionPluginKey = new PluginKey('suggestion');

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

/**
 * Create a ProseMirror suggestion plugin.
 *
 * @param {object} options
 * @param {PluginKey}           [options.pluginKey]        Plugin key. Defaults to a shared 'suggestion' key.
 * @param {EditorView}          options.editor             The ProseMirror EditorView (was TipTap `editor`).
 * @param {string}              [options.char='@']         Trigger character.
 * @param {boolean}             [options.allowSpaces=false] Allow spaces in query.
 * @param {string[]|null}       [options.allowedPrefixes]  Chars allowed before trigger. Default `[' ']`.
 * @param {boolean}             [options.startOfLine=false] Trigger only at line start.
 * @param {string}              [options.decorationTag='span'] HTML tag for decoration.
 * @param {string}              [options.decorationClass='suggestion'] CSS class for decoration.
 * @param {string}              [options.decorationContent=''] Decoration content data attr.
 * @param {string}              [options.decorationEmptyClass='is-empty'] Extra class when query is empty.
 * @param {Function}            [options.command]          Called when a suggestion item is selected.
 * @param {Function}            [options.items]            Returns (possibly async) array of items for a query.
 * @param {Function}            [options.render]           Returns lifecycle callbacks object.
 * @param {Function}            [options.allow]            Gate function `({ editor, state, range, isActive }) => bool`.
 * @param {Function}            [options.shouldShow]       Optional additional gate with transaction context.
 * @param {Function}            [options.findSuggestionMatch] Override the match finder.
 * @returns {Plugin}
 */
export function createSuggestionPlugin({
  pluginKey = SuggestionPluginKey,
  editor,
  char = '@',
  allowSpaces = false,
  allowedPrefixes = [' '],
  startOfLine = false,
  decorationTag = 'span',
  decorationClass = 'suggestion',
  decorationContent = '',
  decorationEmptyClass = 'is-empty',
  command: commandFn = () => null,
  items: itemsFn = () => [],
  render: renderFn = () => ({}),
  allow: allowFn = () => true,
  shouldShow,
  findSuggestionMatch: findMatch = findSuggestionMatch,
} = {}) {
  // `editor` is the EditorView passed by the consumer. During the TipTap era
  // this was the TipTap Editor instance; after migration it is the raw
  // EditorView. We keep the parameter name `editor` for API compatibility so
  // that consumers' spread configs work without changes.

  let props; // SuggestionProps currently visible to the view callbacks
  const renderer = renderFn?.();

  // -----------------------------------------------------------------------
  // Helpers for clientRect
  // -----------------------------------------------------------------------

  /**
   * Fallback clientRect using the current anchor position.
   */
  const getAnchorClientRect = () => {
    try {
      const view = resolveView();
      const pos = view.state.selection.$anchor.pos;
      const coords = view.coordsAtPos(pos);
      const { top, right, bottom, left } = coords;
      return new DOMRect(left, top, right - left, bottom - top);
    } catch {
      return null;
    }
  };

  /**
   * Build a clientRect callback that uses the decoration node if available,
   * falling back to the anchor position.
   */
  const clientRectFor = (view, decorationNode) => {
    if (!decorationNode) {
      return getAnchorClientRect;
    }
    return () => {
      try {
        const state = pluginKey.getState(view.state);
        const decorationId = state?.decorationId;
        const currentNode = view.dom.querySelector(
          `[data-decoration-id="${decorationId}"]`,
        );
        return currentNode?.getBoundingClientRect() || null;
      } catch {
        return null;
      }
    };
  };

  // -----------------------------------------------------------------------
  // Resolve the EditorView.
  //
  // During the migration period `editor` may be either:
  //   - A raw ProseMirror EditorView (has `.state` directly)
  //   - A TipTap Editor (has `.view` which is the EditorView)
  //
  // We normalise to always return the EditorView.
  // -----------------------------------------------------------------------
  const resolveView = () => {
    if (editor && typeof editor.dispatch === 'function' && editor.dom) {
      // Looks like a raw EditorView
      return editor;
    }
    if (editor && editor.view) {
      // TipTap Editor -- unwrap
      return editor.view;
    }
    return editor;
  };

  /**
   * Whether the editor is currently editable.
   */
  const isEditable = () => {
    // TipTap Editor exposes `.isEditable`
    if (editor && typeof editor.isEditable === 'boolean') {
      return editor.isEditable;
    }
    // Raw EditorView: check `editable` prop
    const view = resolveView();
    return view?.editable ?? true;
  };

  /**
   * Whether the view is currently composing (IME).
   */
  const isComposing = () => {
    const view = resolveView();
    return view?.composing ?? false;
  };

  // -----------------------------------------------------------------------
  // Exit helper
  // -----------------------------------------------------------------------

  function dispatchExit(view) {
    try {
      const state = pluginKey.getState(view.state);
      const decorationNode = state?.decorationId
        ? view.dom.querySelector(
            `[data-decoration-id="${state.decorationId}"]`,
          )
        : null;

      const exitProps = {
        editor,
        range: state?.range || { from: 0, to: 0 },
        query: state?.query || null,
        text: state?.text || null,
        items: [],
        command: (commandProps) => {
          return commandFn({
            editor,
            range: state?.range || { from: 0, to: 0 },
            props: commandProps,
          });
        },
        decorationNode,
        clientRect: clientRectFor(view, decorationNode),
      };

      renderer?.onExit?.(exitProps);
    } catch {
      // Ignore errors from consumer renderers during cleanup.
    }

    const tr = view.state.tr.setMeta(pluginKey, { exit: true });
    view.dispatch(tr);
  }

  // -----------------------------------------------------------------------
  // Plugin
  // -----------------------------------------------------------------------

  const plugin = new Plugin({
    key: pluginKey,

    // ----- View callbacks -----
    view() {
      return {
        update: async (view, prevState) => {
          const prev = pluginKey.getState(prevState);
          const next = pluginKey.getState(view.state);

          if (!prev || !next) return;

          // Compute what changed between prev and next state.
          const moved =
            prev.active && next.active && prev.range.from !== next.range.from;
          const started = !prev.active && next.active;
          const stopped = prev.active && !next.active;
          const changed = !started && !stopped && prev.query !== next.query;

          const handleStart = started || (moved && changed);
          const handleChange = changed || moved;
          const handleExit = stopped || (moved && changed);

          // Nothing relevant happened -- bail.
          if (!handleStart && !handleChange && !handleExit) {
            return;
          }

          const state = handleExit && !handleStart ? prev : next;
          const decorationNode = view.dom.querySelector(
            `[data-decoration-id="${state.decorationId}"]`,
          );

          props = {
            editor,
            range: state.range,
            query: state.query,
            text: state.text,
            items: [],
            command: (commandProps) => {
              return commandFn({
                editor,
                range: state.range,
                props: commandProps,
              });
            },
            decorationNode,
            clientRect: clientRectFor(view, decorationNode),
          };

          if (handleStart) {
            renderer?.onBeforeStart?.(props);
          }

          if (handleChange) {
            renderer?.onBeforeUpdate?.(props);
          }

          if (handleChange || handleStart) {
            props.items = await itemsFn({
              editor,
              query: state.query,
            });

            // After the async item fetch, the state may have changed
            // (e.g., user typed more, suggestion was dismissed, or a
            // plugin reconfiguration occurred). Re-check current state
            // to avoid acting on stale data.
            const currentState = pluginKey.getState(view.state);
            if (!currentState?.active) {
              return;
            }
          }

          if (handleExit) {
            renderer?.onExit?.(props);
          }

          if (handleChange) {
            renderer?.onUpdate?.(props);
          }

          if (handleStart) {
            renderer?.onStart?.(props);
          }
        },

        destroy: () => {
          if (!props) {
            return;
          }
          renderer?.onExit?.(props);
        },
      };
    },

    // ----- State management -----
    state: {
      init() {
        return {
          active: false,
          range: { from: 0, to: 0 },
          query: null,
          text: null,
          composing: false,
          decorationId: null,
        };
      },

      apply(transaction, prev, _oldState, state) {
        const composing = isComposing();
        const editable = isEditable();
        const { selection } = transaction;
        const { empty, from } = selection;
        const next = { ...prev };

        // If a transaction carries the exit meta for this plugin, immediately
        // deactivate the suggestion.
        const meta = transaction.getMeta(pluginKey);
        if (meta && meta.exit) {
          next.active = false;
          next.decorationId = null;
          next.range = { from: 0, to: 0 };
          next.query = null;
          next.text = null;
          return next;
        }

        next.composing = composing;

        // We can only be suggesting if the view is editable, and:
        //   * there is no selection, or
        //   * a composition is active (IME input)
        if (editable && (empty || composing)) {
          // Reset active state if cursor moved outside the previous range
          if (
            (from < prev.range.from || from > prev.range.to) &&
            !composing &&
            !prev.composing
          ) {
            next.active = false;
          }

          // Try to match against the current cursor position.
          const match = findMatch({
            char,
            allowSpaces,
            allowedPrefixes,
            startOfLine,
            $position: selection.$from,
          });

          const decorationId = `id_${Math.floor(Math.random() * 0xffffffff)}`;

          if (
            match &&
            allowFn({
              editor,
              state,
              range: match.range,
              isActive: prev.active,
            }) &&
            (!shouldShow ||
              shouldShow({
                editor,
                range: match.range,
                query: match.query,
                text: match.text,
                transaction,
              }))
          ) {
            next.active = true;
            next.decorationId = prev.decorationId
              ? prev.decorationId
              : decorationId;
            next.range = match.range;
            next.query = match.query;
            next.text = match.text;
          } else {
            next.active = false;
          }
        } else {
          next.active = false;
        }

        // Clear fields when inactive.
        if (!next.active) {
          next.decorationId = null;
          next.range = { from: 0, to: 0 };
          next.query = null;
          next.text = null;
        }

        return next;
      },
    },

    // ----- Plugin props -----
    props: {
      handleKeyDown(view, event) {
        const { active, range } = plugin.getState(view.state);

        if (!active) {
          return false;
        }

        // Escape handling: give consumer renderer a chance to handle it first.
        if (event.key === 'Escape' || event.key === 'Esc') {
          const state = plugin.getState(view.state);
          const cachedNode = props?.decorationNode ?? null;
          const decorationNode =
            cachedNode ??
            (state?.decorationId
              ? view.dom.querySelector(
                  `[data-decoration-id="${state.decorationId}"]`,
                )
              : null);

          // Let the consumer handle Escape via onKeyDown first.
          const handledByKeyDown =
            renderer?.onKeyDown?.({
              view,
              event,
              range: state.range,
            }) || false;

          if (handledByKeyDown) {
            return true;
          }

          // Consumer did not handle it -- call onExit and dispatch exit meta.
          const exitProps = {
            editor,
            range: state.range,
            query: state.query,
            text: state.text,
            items: [],
            command: (commandProps) => {
              return commandFn({
                editor,
                range: state.range,
                props: commandProps,
              });
            },
            decorationNode,
            clientRect: decorationNode
              ? () => decorationNode.getBoundingClientRect() || null
              : null,
          };

          renderer?.onExit?.(exitProps);

          // Dispatch metadata-only transaction to clear plugin state.
          dispatchExit(view);

          return true;
        }

        // All other keys: delegate to renderer.
        const handled =
          renderer?.onKeyDown?.({ view, event, range }) || false;
        return handled;
      },

      // Inline decoration around the active suggestion range.
      decorations(state) {
        const { active, range, decorationId, query } =
          plugin.getState(state);

        if (!active) {
          return null;
        }

        const isEmpty = !query?.length;
        const classNames = [decorationClass];

        if (isEmpty) {
          classNames.push(decorationEmptyClass);
        }

        return DecorationSet.create(state.doc, [
          Decoration.inline(range.from, range.to, {
            nodeName: decorationTag,
            class: classNames.join(' '),
            'data-decoration-id': decorationId,
            'data-decoration-content': decorationContent,
          }),
        ]);
      },
    },
  });

  return plugin;
}

/**
 * Programmatically exit a suggestion plugin by dispatching a metadata-only
 * transaction. This is the safe API to remove suggestion decorations without
 * touching the document.
 *
 * @param {EditorView} view
 * @param {PluginKey} [pluginKeyRef]
 */
export function exitSuggestion(view, pluginKeyRef = SuggestionPluginKey) {
  const tr = view.state.tr.setMeta(pluginKeyRef, { exit: true });
  view.dispatch(tr);
}

// Also export findSuggestionMatch for consumers that need custom matching.
export { findSuggestionMatch };

// Default export matches TipTap's default export pattern so that
// `import suggestion from './suggestion-plugin.js'` works as a drop-in.
export default createSuggestionPlugin;
