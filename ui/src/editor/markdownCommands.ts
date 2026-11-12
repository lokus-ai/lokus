/** @part-of ui.editor */
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";

function runBefore(state: EditorState, pos: number, ch: string): number {
  let n = 0;
  while (pos - n > 0 && state.sliceDoc(pos - n - 1, pos - n) === ch) n++;
  return n;
}

function runAfter(state: EditorState, pos: number, ch: string): number {
  let n = 0;
  while (pos + n < state.doc.length && state.sliceDoc(pos + n, pos + n + 1) === ch) n++;
  return n;
}

/** Is `mark` already wrapped around [from, to]? `*` must not mistake `**`. */
function isWrapped(state: EditorState, from: number, to: number, mark: string): boolean {
  const ch = mark[0];
  const run = Math.min(runBefore(state, from, ch), runAfter(state, to, ch));
  if (mark.length === 2) return run >= 2;
  return ch === "*" || ch === "_" ? run % 2 === 1 : run >= 1;
}

/**
 * Toggle an inline mark (`**`, `*`, `~~`, `==`, `` ` ``) around each
 * selection. With nothing selected it inserts an empty pair, or removes
 * the empty pair the cursor is sitting in.
 */
export function toggleMark(state: EditorState, mark: string): TransactionSpec {
  const len = mark.length;
  return {
    ...state.changeByRange((range) => {
      const { from, to } = range;
      const inner = state.sliceDoc(from, to);
      if (inner.length >= 2 * len && inner.startsWith(mark) && inner.endsWith(mark)) {
        // The marks themselves are selected: **bold** -> bold
        return {
          changes: [
            { from, to: from + len },
            { from: to - len, to },
          ],
          range: EditorSelection.range(from, to - 2 * len),
        };
      }
      if (isWrapped(state, from, to, mark)) {
        return {
          changes: [
            { from: from - len, to: from },
            { from: to, to: to + len },
          ],
          range: EditorSelection.range(from - len, to - len),
        };
      }
      return {
        changes: [
          { from, insert: mark },
          { from: to, insert: mark },
        ],
        range: EditorSelection.range(from + len, to + len),
      };
    }),
    scrollIntoView: true,
    userEvent: "input.format",
  };
}

/** Wrap the selection as `[text](url)` and put the cursor in the url. */
export function insertLink(state: EditorState): TransactionSpec {
  return {
    ...state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const insert = `[${text}]()`;
      const cursor = text ? range.from + insert.length - 1 : range.from + 1;
      return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(cursor) };
    }),
    userEvent: "input.format",
  };
}

/** Set or clear the heading level (0 = paragraph) of each selected line. */
export function setHeading(state: EditorState, level: number): TransactionSpec {
  const changes = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to; ) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        const existing = /^#{1,6}\s+/.exec(line.text)?.[0] ?? "";
        const wanted = level > 0 ? "#".repeat(level) + " " : "";
        if (existing !== wanted) changes.push({ from: line.from, to: line.from + existing.length, insert: wanted });
      }
      pos = line.to + 1;
    }
  }
  return { changes, userEvent: "input.format" };
}

const FM_OPEN = /^---[ \t]*\r?\n/;

export interface Frontmatter {
  /** Offset just past the closing `---` line, or 0 when there is none. */
  end: number;
  values: Record<string, string>;
}

/** Top-level `key: value` pairs only; enough for icon, cover and title. */
export function readFrontmatter(text: string): Frontmatter {
  const none = { end: 0, values: {} };
  if (!FM_OPEN.test(text)) return none;
  const close = /\n---[ \t]*(\n|$)/.exec(text.slice(3));
  if (!close) return none;
  const bodyEnd = 3 + close.index;
  const values: Record<string, string> = {};
  for (const line of text.slice(text.indexOf("\n") + 1, bodyEnd).split("\n")) {
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (m) values[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return { end: bodyEnd + close[0].length, values };
}

function yamlValue(value: string): string {
  return /^[\w ./-]+$/.test(value) ? value : JSON.stringify(value);
}

/** Add, change or (with `null`) remove one top-level frontmatter key. */
export function setFrontmatterKey(state: EditorState, key: string, value: string | null): TransactionSpec {
  const text = state.doc.toString();
  const fm = readFrontmatter(text);
  const line = value === null ? "" : `${key}: ${yamlValue(value)}\n`;
  if (fm.end === 0) {
    return value === null ? {} : { changes: { from: 0, insert: `---\n${line}---\n\n` } };
  }
  const bodyStart = text.indexOf("\n") + 1;
  const closeStart = text.lastIndexOf("---", fm.end - 1);
  const existing = new RegExp(`^${key}:.*\\n?`, "m").exec(text.slice(bodyStart, closeStart));
  if (existing) {
    const from = bodyStart + existing.index;
    return { changes: { from, to: from + existing[0].length, insert: line } };
  }
  return { changes: { from: closeStart, insert: line } };
}
