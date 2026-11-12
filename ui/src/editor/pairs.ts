/** @part-of ui.editor */
import { EditorSelection, Prec, RangeSet, RangeValue, StateEffect, StateField } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

/**
 * Markdown auto-pairing, Obsidian style:
 *  - typing the second `*` gives `**|**` (also `__`, `~~`, `==`)
 *  - a backtick gives `` `|` ``
 *  - typing a mark with text selected wraps the selection
 *  - typing a closer we inserted steps over it; Backspace in an empty pair removes it
 */
const DOUBLE = new Set(["*", "_", "~", "="]);
const WRAPS = new Set(["*", "_", "~", "`"]);

class Closer extends RangeValue {}
const closer = new Closer();
closer.startSide = 1;
closer.endSide = -1;

const addClosers = StateEffect.define<number[]>({
  map: (positions, changes) => positions.map((p) => changes.mapPos(p, 1)),
});

/** Positions of closing marks we inserted and the user has not typed past. */
const closers = StateField.define<RangeSet<Closer>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addClosers)) {
        set = set.update({ add: effect.value.map((p) => closer.range(p, p + 1)), sort: true });
      }
    }
    if (tr.selection || tr.docChanged) {
      // A closer is only "ours" while the cursor stays on its line.
      const line = tr.state.doc.lineAt(tr.state.selection.main.head);
      set = set.update({ filter: (from) => from >= line.from && from <= line.to });
    }
    return set;
  },
});

function trackedAt(view: EditorView, pos: number): boolean {
  let found = false;
  view.state.field(closers).between(pos, pos + 1, (from) => {
    if (from === pos) found = true;
  });
  return found;
}

const isWord = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

const input = EditorView.inputHandler.of((view, _from, _to, text) => {
  if (text.length !== 1 || (!DOUBLE.has(text) && text !== "`")) return false;
  const { state } = view;
  if (state.readOnly) return false;

  if (!state.selection.main.empty) {
    if (!WRAPS.has(text)) return false;
    view.dispatch({
      ...state.changeByRange((range) => ({
        changes: [
          { from: range.from, insert: text },
          { from: range.to, insert: text },
        ],
        range: EditorSelection.range(range.anchor + 1, range.head + 1),
      })),
      userEvent: "input.type",
    });
    return true;
  }

  if (state.selection.ranges.length > 1) return false;
  const pos = state.selection.main.head;
  const prev = state.sliceDoc(Math.max(0, pos - 1), pos);
  const prev2 = state.sliceDoc(Math.max(0, pos - 2), Math.max(0, pos - 1));
  const next = state.sliceDoc(pos, pos + 1);

  if (next === text && trackedAt(view, pos)) {
    view.dispatch({ selection: EditorSelection.cursor(pos + 1), userEvent: "input.type" });
    return true;
  }

  if (text === "`") {
    if (prev === "`" || isWord(prev) || isWord(next) || next === "`") return false;
    view.dispatch({
      changes: { from: pos, insert: "``" },
      selection: EditorSelection.cursor(pos + 1),
      effects: addClosers.of([pos + 1]),
      userEvent: "input.type",
    });
    return true;
  }

  // The second mark in a row opens a pair: `*` then `*` gives `**|**`.
  if (prev === text && prev2 !== text && next !== text && !isWord(next)) {
    view.dispatch({
      changes: { from: pos, insert: text.repeat(3) },
      selection: EditorSelection.cursor(pos + 1),
      effects: addClosers.of([pos + 1, pos + 2]),
      userEvent: "input.type",
    });
    return true;
  }
  return false;
});

const backspace = keymap.of([
  {
    key: "Backspace",
    run(view) {
      const { state } = view;
      const sel = state.selection.main;
      if (!sel.empty || state.selection.ranges.length > 1) return false;
      const pos = sel.head;
      if (!trackedAt(view, pos)) return false;
      const ch = state.sliceDoc(pos, pos + 1);
      let n = 0;
      while (trackedAt(view, pos + n) && state.sliceDoc(pos + n, pos + n + 1) === ch) n++;
      if (state.sliceDoc(pos - n, pos) !== ch.repeat(n)) return false;
      view.dispatch({ changes: { from: pos - n, to: pos + n }, userEvent: "delete.backward" });
      return true;
    },
  },
]);

export const markdownPairs = [closers, input, Prec.high(backspace)];

/**
 * Feed text through the same input handlers real typing uses, one character
 * at a time. Used by the `editor.type` command so pairing can be exercised
 * from a script exactly as a keyboard would.
 */
export function typeText(view: EditorView, text: string): void {
  for (const ch of text) {
    const { from, to } = view.state.selection.main;
    const insert = () => view.state.update(view.state.replaceSelection(ch), { userEvent: "input.type" });
    const handled = view.state.facet(EditorView.inputHandler).some((h) => h(view, from, to, ch, insert));
    if (!handled) view.dispatch(insert());
  }
}
