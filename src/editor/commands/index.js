/**
 * ProseMirror command helpers — drop-in replacements for TipTap's
 * `editor.chain().focus().<command>().run()` pattern.
 *
 * All functions accept a ProseMirror EditorView as their first argument.
 * They focus the view before dispatching so keyboard focus is always
 * restored, matching TipTap's `.focus()` step.
 */

import {
  toggleMark,
  setBlockType,
  wrapIn,
  lift,
  selectTextblockStart,
  selectTextblockEnd,
  deleteSelection as pmDeleteSelection,
  selectAll as pmSelectAll,
} from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import { TextSelection } from 'prosemirror-state';
import { undo as pmUndo, redo as pmRedo } from 'prosemirror-history';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Focus the DOM element of the editor view.
 * Avoids a re-render / re-dispatch cycle — we just call the DOM focus so PM
 * registers focus before we dispatch a transaction.
 *
 * @param {import('prosemirror-view').EditorView} view
 */
function focusView(view) {
  if (!view || !view.dom) return;
  if (document.activeElement !== view.dom) {
    view.dom.focus({ preventScroll: true });
  }
}

/**
 * Run a PM command function `(state, dispatch, view) => bool` after focusing.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {Function} command - standard PM command signature
 * @returns {boolean}
 */
export function exec(view, command) {
  if (!view) return false;
  focusView(view);
  return command(view.state, view.dispatch, view);
}

// ---------------------------------------------------------------------------
// Content insertion
// ---------------------------------------------------------------------------

/**
 * Resolve arbitrary content to a ProseMirror Fragment or Node array.
 * Accepts:
 *   - A PM Node directly
 *   - A JSON node spec `{ type: 'paragraph', content: [...] }`
 *   - A plain string (inserted as a text node)
 *
 * @param {import('prosemirror-model').Schema} schema
 * @param {import('prosemirror-model').Node | Object | string} content
 * @returns {import('prosemirror-model').Node[]} array of nodes ready for insertion
 */
function resolveContent(schema, content) {
  if (typeof content === 'string') {
    // Plain text — wrap in a text node
    return [schema.text(content)];
  }

  // Already a PM Node
  if (content && typeof content === 'object' && content.type && content.type.name) {
    return [content];
  }

  // JSON node spec
  if (content && typeof content === 'object' && typeof content.type === 'string') {
    return [schema.nodeFromJSON(content)];
  }

  throw new TypeError(
    `insertContent: unsupported content type. Expected PM Node, JSON node spec, or string. Got: ${typeof content}`
  );
}

/**
 * Insert content at the current cursor / selection end.
 * Content can be a PM Node, a JSON node spec, or a plain string.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {import('prosemirror-model').Node | Object | string} content
 * @returns {boolean}
 */
export function insertContent(view, content) {
  if (!view) return false;
  focusView(view);

  const { state } = view;
  const { schema, selection, tr } = state;
  const nodes = resolveContent(schema, content);
  const pos = selection.to;

  // Delete any existing selection first, then insert
  let transaction = tr;
  if (!selection.empty) {
    transaction = transaction.deleteSelection();
  }

  // Inline text nodes can be inserted directly; block nodes need their own
  // logic. We rely on PM's replaceSelectionWith for a single node and a
  // sequential insert for multiple.
  if (nodes.length === 1) {
    const node = nodes[0];
    if (node.isInline) {
      // For inline nodes, insert at the mapped cursor position directly.
      // Re-build the transaction from scratch so the mapping is clean.
      transaction = state.tr;
      if (!selection.empty) transaction = transaction.deleteSelection();
      transaction = transaction.insert(transaction.mapping.map(pos), node);
    } else {
      transaction = transaction.replaceSelectionWith(node);
    }
  } else {
    // Multiple nodes — insert sequentially after current position
    let insertAt = transaction.mapping.map(pos);
    for (const node of nodes) {
      transaction = transaction.insert(insertAt, node);
      insertAt += node.nodeSize;
    }
  }

  transaction = transaction.scrollIntoView();
  view.dispatch(transaction);
  return true;
}

/**
 * Insert a plain text string at the cursor, replacing any selection.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} text
 * @returns {boolean}
 */
export function insertText(view, text) {
  if (!view) return false;
  focusView(view);

  const { state } = view;
  const { from, to } = state.selection;
  const tr = state.tr.insertText(text, from, to).scrollIntoView();
  view.dispatch(tr);
  return true;
}

// ---------------------------------------------------------------------------
// Document-level content replacement
// ---------------------------------------------------------------------------

/**
 * Replace the entire document content.
 * Sets `tr.setMeta('programmatic', true)` so update handlers can distinguish
 * this from user edits.
 *
 * Content can be a PM Node (doc node) or a JSON document spec.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {import('prosemirror-model').Node | Object} content
 * @param {import('prosemirror-model').Schema} [schema] - only required when content is JSON
 * @returns {boolean}
 */
export function setContent(view, content, schema) {
  if (!view) return false;

  const resolvedSchema = schema ?? view.state.schema;

  let docNode;
  if (content && typeof content === 'object' && content.type && content.type.name) {
    // Already a PM Node
    docNode = content;
  } else if (content && typeof content === 'object') {
    // JSON doc spec
    docNode = resolvedSchema.nodeFromJSON(content);
  } else {
    throw new TypeError('setContent: content must be a PM Node or JSON document spec');
  }

  const tr = view.state.tr
    .replaceWith(0, view.state.doc.content.size, docNode.content)
    .setMeta('programmatic', true)
    .scrollIntoView();

  view.dispatch(tr);
  return true;
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/**
 * Set a text selection (cursor or range) by absolute document positions.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {number} from
 * @param {number} [to] - if omitted, collapsed cursor at `from`
 * @returns {boolean}
 */
export function setTextSelection(view, from, to) {
  if (!view) return false;
  focusView(view);

  const { state } = view;
  const resolvedTo = to ?? from;
  const sel = TextSelection.create(state.doc, from, resolvedTo);
  const tr = state.tr.setSelection(sel).scrollIntoView();
  view.dispatch(tr);
  return true;
}

/**
 * Delete the current selection (no-op on empty selection).
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
export function deleteSelection(view) {
  return exec(view, pmDeleteSelection);
}

/**
 * Select the entire document.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
export function selectAll(view) {
  return exec(view, pmSelectAll);
}

// ---------------------------------------------------------------------------
// Mark toggle
// ---------------------------------------------------------------------------

/**
 * Toggle a mark by name on the current selection.
 * If the mark does not exist in the schema, silently returns false.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} markName
 * @param {Object} [attrs]
 * @returns {boolean}
 */
export function toggleMarkCommand(view, markName, attrs) {
  if (!view) return false;
  const markType = view.state.schema.marks[markName];
  if (!markType) return false;
  return exec(view, toggleMark(markType, attrs));
}

// ---------------------------------------------------------------------------
// Internal block-type helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the selection's anchor node matches the given node type
 * (and optional attrs).
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {import('prosemirror-model').NodeType} nodeType
 * @param {Object} [attrs]
 * @returns {boolean}
 */
function isBlockActive(state, nodeType, attrs) {
  const { $from, to } = state.selection;
  let found = false;
  state.doc.nodesBetween($from.pos, to, (node) => {
    if (found) return false;
    if (node.type === nodeType) {
      if (!attrs) { found = true; return false; }
      // Check all provided attrs match
      found = Object.entries(attrs).every(([k, v]) => node.attrs[k] === v);
    }
    return true;
  });
  return found;
}

/**
 * Toggle a block node type: if already active, lift back to paragraph;
 * otherwise apply the block type.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {import('prosemirror-model').NodeType} nodeType
 * @param {Object} [attrs]
 * @returns {boolean}
 */
function toggleBlockType(view, nodeType, attrs) {
  if (!view) return false;
  focusView(view);

  const { state, dispatch } = view;
  const paragraphType = state.schema.nodes.paragraph;

  if (isBlockActive(state, nodeType, attrs)) {
    // Already this block type — revert to paragraph
    return setBlockType(paragraphType)(state, dispatch, view);
  }
  return setBlockType(nodeType, attrs)(state, dispatch, view);
}

/**
 * Toggle a wrapping block (blockquote, etc.): if already wrapped, lift;
 * otherwise wrap.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {import('prosemirror-model').NodeType} wrapType
 * @returns {boolean}
 */
function toggleWrap(view, wrapType) {
  if (!view) return false;
  focusView(view);

  const { state, dispatch } = view;

  if (isBlockActive(state, wrapType)) {
    return lift(state, dispatch);
  }
  return wrapIn(wrapType)(state, dispatch, view);
}

/**
 * Toggle a list type (bulletList / orderedList / taskList).
 * If currently in the target list type, lift the list item out.
 * If in a different list type, lift first then wrap in the target type.
 * Otherwise, wrap in the target list type.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {import('prosemirror-model').NodeType} listType
 * @param {import('prosemirror-model').NodeType} itemType
 * @returns {boolean}
 */
function toggleList(view, listType, itemType) {
  if (!view) return false;
  focusView(view);

  const { state, dispatch } = view;
  const nodes = state.schema.nodes;

  // Detect if we're inside ANY list type
  const inTargetList = isBlockActive(state, listType);
  const inBullet = nodes.bulletList && isBlockActive(state, nodes.bulletList);
  const inOrdered = nodes.orderedList && isBlockActive(state, nodes.orderedList);
  const inTask = nodes.taskList && isBlockActive(state, nodes.taskList);
  const inAnyList = inBullet || inOrdered || inTask;

  if (inTargetList) {
    // Already in this list — lift out
    return liftListItem(itemType)(state, dispatch);
  }

  if (inAnyList) {
    // In a different list type — lift then re-wrap
    const lifted = liftListItem(itemType)(state, dispatch);
    if (lifted) {
      // After lift the state has changed — re-read it
      return wrapInList(listType)(view.state, view.dispatch, view);
    }
    return false;
  }

  // Not in any list — wrap
  return wrapInList(listType)(state, dispatch, view);
}

// ---------------------------------------------------------------------------
// Table helper
// ---------------------------------------------------------------------------

/**
 * Insert an empty table at the cursor.
 * Uses prosemirror-tables nodes from the schema.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {number} rows
 * @param {number} cols
 * @returns {boolean}
 */
function insertTableNode(view, rows, cols) {
  if (!view) return false;
  focusView(view);

  const { state } = view;
  const { schema } = state;
  const { table, tableRow, tableCell, tableHeader } = schema.nodes;

  if (!table || !tableRow || !tableCell) {
    // Schema does not include table nodes
    return false;
  }

  const headerRow = tableRow.create(
    null,
    Array.from({ length: cols }, () => (tableHeader ?? tableCell).create(null, schema.nodes.paragraph.create()))
  );

  const bodyRows = Array.from({ length: rows - 1 }, () =>
    tableRow.create(
      null,
      Array.from({ length: cols }, () => tableCell.create(null, schema.nodes.paragraph.create()))
    )
  );

  const tableNode = table.create(null, [headerRow, ...bodyRows]);
  const tr = state.tr.replaceSelectionWith(tableNode).scrollIntoView();
  view.dispatch(tr);
  return true;
}

// ---------------------------------------------------------------------------
// Horizontal rule helper
// ---------------------------------------------------------------------------

/**
 * Insert a horizontal rule node at the cursor.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
function insertHorizontalRule(view) {
  if (!view) return false;
  focusView(view);

  const { state } = view;
  const { schema } = state;
  const hrType = schema.nodes.horizontalRule ?? schema.nodes.horizontal_rule;

  if (!hrType) return false;

  const tr = state.tr.replaceSelectionWith(hrType.create()).scrollIntoView();
  view.dispatch(tr);
  return true;
}

// ---------------------------------------------------------------------------
// WikiLink helper
// ---------------------------------------------------------------------------

/**
 * Open the WikiLink insertion modal by dispatching a custom DOM event.
 * This mirrors TipTap's `commands.insertWikiLink()` which, in the Editor
 * component, toggles `isWikiLinkModalOpen` state. We replicate that by
 * firing the same window event the Editor listens for internally (Ctrl+L
 * keydown). Using a CustomEvent keeps the bridge decoupled from React state.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
function triggerInsertWikiLink(view) {
  if (!view) return false;
  focusView(view);

  // Simulate the Ctrl+L shortcut the Editor component listens for.
  // This is the same path that `editor.commands.insertWikiLink()` (TipTap)
  // followed when the WikiLink extension caught it.
  view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      metaKey: false,
      bubbles: true,
      cancelable: true,
    })
  );
  return true;
}

// ---------------------------------------------------------------------------
// scrollIntoView helper
// ---------------------------------------------------------------------------

/**
 * Scroll the current selection into view.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
function scrollIntoView(view) {
  if (!view) return false;
  const tr = view.state.tr.scrollIntoView();
  view.dispatch(tr);
  return true;
}

// ---------------------------------------------------------------------------
// createEditorCommands — the primary public API
// ---------------------------------------------------------------------------

/**
 * Create a commands object bound to a specific EditorView.
 *
 * The returned object exposes every method that was previously called via
 * TipTap's `editor.commands.*` or `editor.chain().focus().<cmd>().run()`.
 * Consumers can destructure or call methods directly without caring about
 * the view reference.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {Object} commands object
 *
 * @example
 * const commands = createEditorCommands(view);
 * commands.toggleBold();
 * commands.toggleHeading({ level: 2 });
 * commands.insertContent('hello');
 */
export function createEditorCommands(view) {
  /**
   * Lazily resolve schema nodes/marks so callers do not blow up if the schema
   * is not yet populated when the commands object is created.
   */
  function schema() {
    return view?.state?.schema;
  }

  function mark(name) {
    return schema()?.marks?.[name] ?? null;
  }

  function node(name) {
    return schema()?.nodes?.[name] ?? null;
  }

  return {
    // ------------------------------------------------------------------
    // History
    // ------------------------------------------------------------------

    /** Undo the last change. */
    undo() {
      return exec(view, pmUndo);
    },

    /** Redo the previously undone change. */
    redo() {
      return exec(view, pmRedo);
    },

    // ------------------------------------------------------------------
    // Inline marks
    // ------------------------------------------------------------------

    /** Toggle bold (strong) mark. */
    toggleBold() {
      const m = mark('strong') ?? mark('bold');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /** Toggle italic (em) mark. */
    toggleItalic() {
      const m = mark('em') ?? mark('italic');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /**
     * Toggle inline code mark.
     * TipTap's `code` mark maps to PM's `code` mark.
     */
    toggleCode() {
      const m = mark('code');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /** Toggle strikethrough mark. */
    toggleStrike() {
      const m = mark('strike') ?? mark('strikethrough');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /** Toggle highlight mark. */
    toggleHighlight() {
      const m = mark('highlight');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /** Toggle superscript mark. */
    toggleSuperscript() {
      const m = mark('superscript');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /** Toggle subscript mark. */
    toggleSubscript() {
      const m = mark('subscript');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /**
     * Toggle underline mark.
     * Underline is not part of PM's base schema — it exists only when an
     * underline mark has been added (e.g., via a TipTap extension that
     * adds it to the schema). If the mark is absent, this is a no-op.
     */
    toggleUnderline() {
      const m = mark('underline');
      if (!m) return false;
      return exec(view, toggleMark(m));
    },

    /**
     * Remove all marks from the selection.
     * Iterates over every mark type in the schema and removes them.
     */
    unsetAllMarks() {
      if (!view) return false;
      focusView(view);

      const { state } = view;
      const { from, to } = state.selection;
      if (from === to) return false;

      let tr = state.tr;
      for (const markType of Object.values(state.schema.marks)) {
        tr = tr.removeMark(from, to, markType);
      }
      tr = tr.scrollIntoView();
      view.dispatch(tr);
      return true;
    },

    // ------------------------------------------------------------------
    // Block types
    // ------------------------------------------------------------------

    /**
     * Toggle a heading of a given level (1-6).
     * @param {{ level: number }} options
     */
    toggleHeading({ level } = {}) {
      const headingType = node('heading');
      if (!headingType) return false;
      return toggleBlockType(view, headingType, { level });
    },

    /** Toggle blockquote wrapping. */
    toggleBlockquote() {
      const blockquoteType = node('blockquote');
      if (!blockquoteType) return false;
      return toggleWrap(view, blockquoteType);
    },

    /**
     * Toggle a code block.
     * TipTap uses a `codeBlock` node; standard PM schema uses `code_block`.
     */
    toggleCodeBlock() {
      const codeBlockType = node('codeBlock') ?? node('code_block');
      if (!codeBlockType) return false;
      return toggleBlockType(view, codeBlockType);
    },

    // ------------------------------------------------------------------
    // Lists
    // ------------------------------------------------------------------

    /** Toggle a bullet (unordered) list. */
    toggleBulletList() {
      const listType = node('bulletList') ?? node('bullet_list');
      const itemType = node('listItem') ?? node('list_item');
      if (!listType || !itemType) return false;
      return toggleList(view, listType, itemType);
    },

    /** Toggle an ordered (numbered) list. */
    toggleOrderedList() {
      const listType = node('orderedList') ?? node('ordered_list');
      const itemType = node('listItem') ?? node('list_item');
      if (!listType || !itemType) return false;
      return toggleList(view, listType, itemType);
    },

    /**
     * Toggle a task (checkbox) list.
     * Requires `taskList` and `taskItem` nodes in the schema
     * (provided by TipTap's extension or an equivalent PM plugin).
     */
    toggleTaskList() {
      const listType = node('taskList') ?? node('task_list');
      const itemType = node('taskItem') ?? node('task_item');
      if (!listType || !itemType) return false;
      return toggleList(view, listType, itemType);
    },

    // ------------------------------------------------------------------
    // Insertions
    // ------------------------------------------------------------------

    /** Insert a horizontal rule at the cursor. */
    setHorizontalRule() {
      return insertHorizontalRule(view);
    },

    /**
     * Insert a table with the given dimensions.
     * @param {{ rows: number, cols: number }} options
     */
    insertTable({ rows = 3, cols = 3 } = {}) {
      return insertTableNode(view, rows, cols);
    },

    /**
     * Insert content at the cursor.
     * Accepts a PM Node, a JSON node spec, or a plain string.
     * @param {import('prosemirror-model').Node | Object | string} content
     */
    insertContent(content) {
      return insertContent(view, content);
    },

    /**
     * Open the WikiLink insertion dialog.
     * This dispatches the internal keyboard event the Editor component
     * already listens for (Ctrl+L) rather than coupling to React state
     * directly.
     */
    insertWikiLink() {
      return triggerInsertWikiLink(view);
    },

    // ------------------------------------------------------------------
    // Document management
    // ------------------------------------------------------------------

    /**
     * Replace the entire document.
     * @param {import('prosemirror-model').Node | Object} content
     */
    setContent(content) {
      return setContent(view, content);
    },

    /**
     * Set a text selection by document positions.
     * @param {{ from: number, to?: number } | number} fromOrRange
     * @param {number} [to]
     */
    setTextSelection(fromOrRange, to) {
      if (fromOrRange !== null && typeof fromOrRange === 'object') {
        return setTextSelection(view, fromOrRange.from, fromOrRange.to);
      }
      return setTextSelection(view, fromOrRange, to);
    },

    /** Delete the current selection. */
    deleteSelection() {
      return deleteSelection(view);
    },

    /** Select the entire document. */
    selectAll() {
      return selectAll(view);
    },

    /**
     * Move selection to the start of the current text block.
     * Used by clipboard operations (selectTextblockStart + selectTextblockEnd
     * to select the entire current line before deleting).
     */
    selectTextblockStart() {
      return exec(view, selectTextblockStart);
    },

    /**
     * Move selection to the end of the current text block.
     */
    selectTextblockEnd() {
      return exec(view, selectTextblockEnd);
    },

    /** Scroll the current selection position into view. */
    scrollIntoView() {
      return scrollIntoView(view);
    },

    /**
     * Focus the editor DOM element.
     * Mirrors TipTap's `editor.commands.focus()`.
     */
    focus() {
      focusView(view);
      return true;
    },
  };
}
