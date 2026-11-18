/** @part-of ui.editor */
import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";

import { readFrontmatter } from "./markdownCommands";

/**
 * Live preview: the document is always the markdown text. Syntax marks are
 * hidden with decorations and come back when the cursor touches them, so
 * nothing is ever converted and nothing can be lost.
 */

const hide = Decoration.replace({});

/** Does any selection range touch [from, to]? */
function touches(state: EditorState, from: number, to: number): boolean {
  // A read-only preview (an embed) has no cursor worth revealing syntax for.
  if (state.readOnly) return false;
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
}

class Checkbox extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super();
  }
  eq(other: Checkbox) {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task-box";
    box.checked = this.checked;
    box.disabled = view.state.readOnly || !view.state.facet(EditorView.editable);
    box.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.ctrlKey) return;
      e.preventDefault();
      if (view.state.readOnly || !view.state.facet(EditorView.editable) || !box.isConnected || !view.dom.getClientRects().length || view.dom.closest("[inert]")) return;
      const marker = view.state.sliceDoc(this.pos, this.pos + 3);
      if (!/^\[[ xX]\]$/.test(marker) || /x/i.test(marker) !== this.checked) return;
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" },
        userEvent: "input.format",
      });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class Bullet extends WidgetType {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-bullet";
    dot.textContent = "•";
    return dot;
  }
}
const bullet = Decoration.replace({ widget: new Bullet() });

class Rule extends WidgetType {
  toDOM() {
    const hr = document.createElement("span");
    hr.className = "cm-rule";
    return hr;
  }
}
const rule = Decoration.replace({ widget: new Rule() });

class Picture extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }
  eq(other: Picture) {
    return other.url === this.url && other.alt === this.alt;
  }
  toDOM() {
    const img = document.createElement("img");
    img.className = "cm-image";
    img.src = this.url;
    img.alt = this.alt;
    img.draggable = false;
    return img;
  }
}

/** The address a link or a picture names: `\(` in it is a bracket, not a backslash and a bracket. */
const plain = (written: string) => written.replace(/^<|>$/g, "").replace(/\\([!-/:-@[-`{-~])/g, "$1");
const address = (state: EditorState, url: { from: number; to: number }) => plain(state.sliceDoc(url.from, url.to));

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

const INLINE_PARENTS = new Set(["StrongEmphasis", "Emphasis", "Strikethrough", "InlineCode", "Link", "Image"]);
const WIKI = /(!?)\[\[([^[\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
const HIGHLIGHT = /==(?=\S)([^=\n]+?)==/g;

function build(view: EditorView, hooks: PreviewHooks): DecorationSet {
  const { state } = view;
  const out: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const codeRanges: [number, number][] = [];

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        const name = node.name;

        if (name.startsWith("ATXHeading")) {
          const level = name.slice(-1);
          out.push(Decoration.line({ class: `cm-heading cm-h${level}` }).range(state.doc.lineAt(node.from).from));
          return;
        }
        if (name === "HeaderMark") {
          const line = state.doc.lineAt(node.from);
          if (!touches(state, line.from, line.to) && node.from === line.from) {
            const end = /^\s+/.exec(state.sliceDoc(node.to, line.to));
            out.push(hide.range(node.from, node.to + (end ? end[0].length : 0)));
          }
          return;
        }
        if (name === "Blockquote") {
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            out.push(Decoration.line({ class: "cm-quote" }).range(line.from));
            pos = line.to + 1;
          }
          return;
        }
        if (name === "QuoteMark") {
          const line = state.doc.lineAt(node.from);
          if (!touches(state, line.from, line.to)) {
            const space = state.sliceDoc(node.to, node.to + 1) === " " ? 1 : 0;
            out.push(hide.range(node.from, node.to + space));
          }
          return;
        }
        if (name === "FencedCode" || name === "CodeBlock") {
          codeRanges.push([node.from, node.to]);
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(node.to).number;
          for (let n = first; n <= last; n++) {
            const cls = n === first ? " cm-code-first" : n === last ? " cm-code-last" : "";
            out.push(Decoration.line({ class: `cm-code-line${cls}` }).range(state.doc.line(n).from));
          }
          return;
        }
        if (name === "InlineCode") {
          codeRanges.push([node.from, node.to]);
          out.push(Decoration.mark({ class: "cm-inline-code" }).range(node.from, node.to));
          return;
        }
        if (name === "HorizontalRule") {
          const line = state.doc.lineAt(node.from);
          if (!touches(state, line.from, line.to)) out.push(rule.range(node.from, node.to));
          return;
        }
        if (name === "ListMark") {
          const text = state.sliceDoc(node.from, node.to);
          const line = state.doc.lineAt(node.from);
          const isTask = /^[ \t]\[[ xX]\]/.test(state.sliceDoc(node.to, node.to + 4)); // not a box on the line below
          if (isTask && !touches(state, line.from, node.to + 4)) {
            out.push(hide.range(node.from, node.to + 1));
          } else if (/^[-*+]$/.test(text) && !touches(state, node.from, node.to)) {
            out.push(bullet.range(node.from, node.to));
          } else {
            out.push(Decoration.mark({ class: "cm-list-mark" }).range(node.from, node.to));
          }
          return;
        }
        if (name === "TaskMarker") {
          const line = state.doc.lineAt(node.from);
          const checked = /x/i.test(state.sliceDoc(node.from, node.to));
          if (checked) out.push(Decoration.line({ class: "cm-task-done" }).range(line.from));
          const markStart = line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0);
          if (!touches(state, markStart, node.to)) {
            out.push(Decoration.replace({ widget: new Checkbox(checked, node.from) }).range(node.from, node.to));
          }
          return;
        }
        if (name === "Image") {
          // The file is the one the Markdown names, so a name with brackets or spaces in it is still found.
          const named = node.node.getChild("URL");
          const url = named ? hooks.resolveImage(address(state, named)) : null;
          // A picture written over two lines stays as text: a line break cannot be folded away here.
          if (named && url && !touches(state, node.from, node.to) && !state.sliceDoc(node.from, node.to).includes("\n")) {
            const text = state.sliceDoc(node.from, named.from);
            out.push(Decoration.replace({ widget: new Picture(url, text.slice(2, text.lastIndexOf("]("))) }).range(node.from, node.to));
          }
          return false;
        }
        if (name === "Link") {
          const text = state.sliceDoc(node.from, node.to);
          const close = text.lastIndexOf("](");
          // An address written on the line below stays as text: a line break cannot be folded away here.
          const folded = !touches(state, node.from, node.to) && text.startsWith("[") && close > 0 && !text.slice(close).includes("\n");
          // Folded to its words, a link to a web page is followed with a click, as a link to a note is.
          const url = folded ? node.node.getChild("URL") : null;
          const web = url ? address(state, url) : "";
          out.push(Decoration.mark({ class: "cm-link", attributes: web.startsWith("https://") ? { "data-target": web } : undefined }).range(node.from, node.to));
          if (folded) {
            out.push(hide.range(node.from, node.from + 1));
            out.push(hide.range(node.from + close, node.to));
          }
          return;
        }
        if (name === "EmphasisMark" || name === "StrikethroughMark" || name === "CodeMark") {
          const parent = node.node.parent;
          if (parent && INLINE_PARENTS.has(parent.name) && !touches(state, parent.from, parent.to)) {
            out.push(hide.range(node.from, node.to));
          }
        }
      },
    });

    // Wiki links and ==highlights== are not in the markdown grammar.
    const inCode = (pos: number) => codeRanges.some(([a, b]) => pos >= a && pos <= b);
    const text = state.sliceDoc(from, to);
    for (const m of text.matchAll(WIKI)) {
      const start = from + m.index;
      const end = start + m[0].length;
      if (inCode(start)) continue;
      const target = m[2].trim();
      if (m[1] && IMAGE_FILE.test(target)) {
        const url = hooks.resolveImage(target);
        if (url && !touches(state, start, end)) {
          out.push(Decoration.replace({ widget: new Picture(url, m[3] ?? target) }).range(start, end));
        }
        continue;
      }
      out.push(Decoration.mark({ class: "cm-wikilink", attributes: { "data-target": target } }).range(start, end));
      if (!touches(state, start, end)) {
        const open = m[1].length + 2;
        const labelStart = m[3] ? start + m[0].length - 2 - m[3].length : start + open;
        out.push(hide.range(start, labelStart));
        out.push(hide.range(end - 2, end));
      }
    }
    for (const m of text.matchAll(HIGHLIGHT)) {
      const start = from + m.index;
      const end = start + m[0].length;
      if (inCode(start)) continue;
      out.push(Decoration.mark({ class: "cm-highlight" }).range(start + 2, end - 2));
      if (!touches(state, start, end)) {
        out.push(hide.range(start, start + 2));
        out.push(hide.range(end - 2, end));
      }
    }
  }
  return Decoration.set(out, true);
}

const inline = (hooks: PreviewHooks) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, hooks);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet || syntaxTree(u.startState) !== syntaxTree(u.state)) {
          this.decorations = build(u.view, hooks);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );

/** `[words](address)` in a table cell, not a picture, a linked picture or `\[escaped\]`: the address may hold `(1)` or `\)`, and a "title" may follow it. */
const CELL_LINK = /(?<!!|(?<!\\)(?:\\\\)*\\)\[(?!!\[)[^\]]+\]\((?:\\.|[^()\s\\]|\((?:\\.|[^()\s\\])*\))+(?:\s+"[^"]*")?\)/;
const WHOLE_CELL_LINK = new RegExp(`^${CELL_LINK.source}$`);

/** Inline marks inside a table cell: bold, italic, code, strikethrough, links. */
function cellContent(cell: HTMLElement, text: string): void {
  const parts = text.split(new RegExp(`(\`[^\`]+\`|\\[\\[[^\\]]+\\]\\]|${CELL_LINK.source}|\\*\\*[^*]+\\*\\*|~~[^~]+~~|\\*[^*]+\\*)`));
  for (const part of parts) {
    const wrap = (tag: string, inner: string) => {
      const el = document.createElement(tag);
      el.textContent = inner;
      cell.append(el);
    };
    if (/^\[\[.+\]\]$/.test(part)) {
      // A link to a note works in a table as it does in a sentence.
      const [target, shown] = part.slice(2, -2).split("|");
      const link = document.createElement("span");
      link.className = "cm-wikilink";
      link.dataset.target = target.trim();
      link.textContent = (shown ?? target).trim();
      cell.append(link);
    } else if (WHOLE_CELL_LINK.test(part)) {
      // A web link reads as its words and opens its address, as it does in a sentence.
      const at = part.indexOf("](");
      const web = plain(part.slice(at + 2, -1).replace(/\s+"[^"]*"$/, ""));
      const link = document.createElement("span");
      link.className = "cm-link";
      if (web.startsWith("https://")) link.dataset.target = web;
      cellContent(link, part.slice(1, at));
      cell.append(link);
    } else if (/^`.+`$/.test(part)) wrap("code", part.slice(1, -1));
    else if (/^\*\*.+\*\*$/.test(part)) wrap("strong", part.slice(2, -2));
    else if (/^~~.+~~$/.test(part)) wrap("s", part.slice(2, -2));
    else if (/^\*.+\*$/.test(part)) wrap("em", part.slice(1, -1));
    else cell.append(part);
  }
}

/** What a line of a table starts with when the table sits in a quote or a list: `> ` or its indent. */
const lead = (row: string) => /^[ \t]*(>[ \t]*)*/.exec(row)![0];

/** Where each cell of a row sits in its line: the text between two bars, spacing included. */
function cellSpans(row: string): { from: number; to: number }[] {
  const bars = [...row.matchAll(/(?<!\\)\|/g)].map((m) => m.index);
  const edges = [lead(row).length - 1, ...bars, row.length];
  const spans = edges.slice(1).map((to, i) => ({ from: edges[i] + 1, to }));
  if (!row.slice(spans[0].from, spans[0].to).trim()) spans.shift();
  const last = spans[spans.length - 1];
  if (last && !row.slice(last.from, last.to).trim()) spans.pop();
  return spans;
}

const cells = (row: string) => cellSpans(row).map((s) => row.slice(s.from, s.to).trim().replace(/\\\|/g, "|"));

/** A table's rows as the text of their cells, without the line of dashes under the heading. */
function grid(source: string): string[][] {
  const rows = source.split("\n").map(cells);
  const width = rows[0].length;
  return rows.filter((_, i) => i !== 1).map((row) => Array.from({ length: width }, (_, col) => row[col] ?? ""));
}

const rowLine = (texts: string[]) => `| ${texts.map((t) => t.replace(/\s*\n\s*/g, " ").trim().replace(/(?<!\\)\|/g, "\\|")).join(" | ")} |`;

type TableBox = HTMLElement & { widget: Table };
const cellAt = (wrap: HTMLElement, row: number, col: number) =>
  wrap.querySelector("table")?.rows[row]?.cells[col] as HTMLElement | undefined;

function caretToEnd(cell: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** The one stretch of `old` that has to be replaced to make it `next`. */
export function differing(old: string, next: string): { from: number; to: number; insert: string } {
  let start = 0;
  while (start < next.length && start < old.length && next[start] === old[start]) start++;
  let end = 0;
  while (end < next.length - start && end < old.length - start && next.at(-1 - end) === old.at(-1 - end)) end++;
  // An emoji is two units: one that both texts share is not cut in half.
  const half = (at: number, low: number) => (old.charCodeAt(at) & 0xfc00) === low;
  if (start && half(start - 1, 0xd800)) start--;
  if (end && half(old.length - end, 0xdc00)) end--;
  return { from: start, to: old.length - end, insert: next.slice(start, next.length - end) };
}

/**
 * A table is edited as a table: a click in a cell types into that cell, and each keystroke is
 * written into the cell's markdown. The cell being typed in shows its own markdown; the rest
 * stay rendered. Moving the caret into the table with the arrow keys still shows it as text.
 */
class Table extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
    readonly menu?: PreviewHooks["tableMenu"],
  ) {
    super();
  }
  eq(other: Table) {
    return other.source === this.source && other.from === this.from;
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div") as unknown as TableBox;
    wrap.className = "cm-table";
    wrap.widget = this;
    wrap.appendChild(document.createElement("table"));
    this.draw(wrap, view);
    if (view.state.readOnly || !view.state.facet(EditorView.editable)) return wrap;

    const place = (cell: HTMLElement) => {
      const tr = cell.parentElement as HTMLTableRowElement;
      return { row: tr.rowIndex, col: (cell as HTMLTableCellElement).cellIndex };
    };
    const edit = (row: number, col: number) => {
      const cell = cellAt(wrap, row, col);
      if (!cell) return;
      cell.focus();
      caretToEnd(cell);
    };
    wrap.addEventListener("mousedown", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("th, td");
      if (!cell || e.button !== 0 || document.activeElement === cell) return;
      if (!wrap.widget.ignoreEvent(e)) return;
      // The cell is about to show its markdown, so the caret goes where the click landed in that.
      e.preventDefault();
      cell.focus();
      const at = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (at && cell.contains(at.startContainer)) {
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(at);
      } else caretToEnd(cell);
    });
    wrap.addEventListener("focusin", (e) => {
      const cell = e.target as HTMLElement;
      const { row, col } = place(cell);
      cell.textContent = grid(wrap.widget.source)[row]?.[col] ?? "";
    });
    wrap.addEventListener("focusout", (e) => {
      const cell = e.target as HTMLElement;
      if (!cell.isConnected) return;
      const { row, col } = place(cell);
      cell.replaceChildren();
      cellContent(cell, grid(wrap.widget.source)[row]?.[col] ?? "");
    });
    wrap.addEventListener("input", (e) => {
      const cell = e.target as HTMLElement;
      const { row, col } = place(cell);
      wrap.widget.write(view, row, col, cell.textContent ?? "");
    });
    wrap.addEventListener("keydown", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("th, td");
      if (!cell || e.isComposing) return;
      if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
        if (!wrap.widget.menu) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = cell.getBoundingClientRect();
        wrap.widget.menu(cell, tableTarget(wrap, cell), { x: rect.left, y: rect.bottom });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "a") {
        // Select all is the cell's, not the note's: the next key replaces what is in this cell.
        e.preventDefault();
        getSelection()?.selectAllChildren(cell);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { row, col } = place(cell);
      const rows = grid(wrap.widget.source);
      const width = rows[0].length;
      if (e.key === "Escape") {
        e.preventDefault();
        view.focus();
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const back = e.key === "Tab" && e.shiftKey;
        let next = e.key === "Enter" ? { row: row + 1, col } : { row, col: col + (back ? -1 : 1) };
        if (next.col < 0) next = { row: row - 1, col: width - 1 };
        if (next.col >= width) next = { row: row + 1, col: 0 };
        if (next.row < 0) return;
        // Past the last row there is a new one, as in any table.
        if (next.row >= rows.length) wrap.widget.change(view, (lines) => lines.push(lead(lines[1]) + rowLine(Array(width).fill(""))));
        edit(next.row, next.col);
      }
    });
    wrap.addEventListener("contextmenu", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("th, td");
      if (!cell || !wrap.widget.menu) return;
      e.preventDefault();
      wrap.widget.menu(cell, tableTarget(wrap, cell), { x: e.clientX, y: e.clientY });
    });
    return wrap;
  }

  /** Fill the table in, leaving a cell that is being typed in as the person has it. */
  private draw(wrap: HTMLElement, view: EditorView, before?: string): void {
    const lines = this.source.split("\n");
    const align = cells(lines[1] ?? "").map((c) =>
      c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "",
    );
    const table = wrap.querySelector("table")!;
    const rows = grid(this.source);
    const typing = document.activeElement?.closest(".cm-table") === wrap ? (document.activeElement as HTMLElement) : null;
    const same = table.rows.length === rows.length && [...table.rows].every((tr) => tr.cells.length === rows[0].length);
    if (!same) {
      // Rows or columns came or went: build it again, and keep typing in the row the person was in.
      // That row is known by what it held. When it is gone, the next key goes nowhere, not into
      // the row that took its place.
      let was: { row: number; col: number } | null = null;
      if (typing && before !== undefined) {
        const at = (typing.parentElement as HTMLTableRowElement).rowIndex;
        const held = grid(before)[at]?.join("\n");
        const found = rows
          .map((row, i) => (row.join("\n") === held ? i : -1))
          .filter((i) => i >= 0)
          .sort((a, b) => Math.abs(a - at) - Math.abs(b - at))[0];
        if (found !== undefined) was = { row: found, col: (typing as HTMLTableCellElement).cellIndex };
      }
      table.replaceChildren();
      rows.forEach((row, i) => {
        const tr = table.appendChild(document.createElement("tr"));
        row.forEach(() => {
          const cell = tr.appendChild(document.createElement(i === 0 ? "th" : "td"));
          if (!view.state.readOnly) cell.contentEditable = "plaintext-only";
        });
      });
      const again = was && cellAt(wrap, was.row, was.col);
      if (again) {
        again.focus();
        caretToEnd(again);
      }
    }
    rows.forEach((row, i) =>
      row.forEach((text, col) => {
        const cell = table.rows[i].cells[col];
        cell.style.textAlign = align[col] ?? "";
        if (cell === document.activeElement) {
          // Own typing already matches. Anything else is a teammate's change to this cell: show it,
          // or the next key pressed would write the old text back over theirs.
          const has = (cell.textContent ?? "").replace(/\s*\n\s*/g, " ").trim().replace(/\\\|/g, "|");
          if (has !== text) {
            cell.textContent = text;
            caretToEnd(cell);
          }
          return;
        }
        cell.replaceChildren();
        cellContent(cell, text);
      }),
    );
  }

  updateDOM(dom: HTMLElement, view: EditorView) {
    const before = (dom as TableBox).widget.source;
    (dom as TableBox).widget = this;
    this.draw(dom, view, before);
    return true;
  }

  /** Put what was typed into one cell's markdown, touching nothing else in the table. */
  write(view: EditorView, row: number, col: number, typed: string): void {
    const text = typed.replace(/\s*\n\s*/g, " ").replace(/(?<!\\)\|/g, "\\|");
    this.change(view, (lines) => {
      const n = row === 0 ? 0 : row + 1;
      const texts = cells(lines[n]);
      const span = cellSpans(lines[n])[col];
      // A row shorter than the heading gets the cells it was missing.
      while (texts.length < col) texts.push("");
      texts[col] = typed;
      const whole = lead(lines[n]) + rowLine(texts);
      if (!span) {
        lines[n] = whole;
        return;
      }
      const old = lines[n].slice(span.from, span.to);
      const pad = old.trim() ? [/^\s*/.exec(old)![0], /\s*$/.exec(old)![0]] : [" ", " "];
      const [before, after] = [lines[n].slice(0, span.from), lines[n].slice(span.to)];
      const line = before + (pad[0] || (before.length > lead(lines[n]).length ? " " : "")) + text.trim() + (pad[1] || (after ? " " : "")) + after;
      // A row written without its outer bars cannot hold an empty first or last cell: it gets them.
      lines[n] = cells(line).length === texts.length ? line : whole;
    });
  }

  /** Change the table's lines and write only the part that differs. */
  change(view: EditorView, how: (lines: string[]) => void): void {
    if (view.state.readOnly || !view.state.facet(EditorView.editable) || this.from < 0 || this.from + this.source.length > view.state.doc.length) return;
    const lines = this.source.split("\n");
    how(lines);
    const next = lines.join("\n");
    // A table that is no longer what this was drawn from (another note, a teammate) is left alone.
    if (next === this.source || view.state.sliceDoc(this.from, this.from + this.source.length) !== this.source) return;
    const { from, to, insert } = differing(this.source, next);
    view.dispatch({ changes: { from: this.from + from, to: this.from + to, insert }, userEvent: "input.type" });
  }

  /** A click on a link follows it; everything else in the table is the table's own. */
  ignoreEvent(e: Event) {
    const link = e.type === "mousedown" && (e.target as HTMLElement).closest?.(".cm-wikilink, .cm-link[data-target]");
    return !(link && !(e as MouseEvent).altKey && !(e as MouseEvent).shiftKey && (e as MouseEvent).button === 0);
  }
}

type Reshape = (lines: string[], line: number, col: number) => void;
export interface TableTarget {
  from: number;
  source: string;
  row: number;
  col: number;
}

function tableTarget(wrap: TableBox, cell: HTMLElement): TableTarget {
  return {
    from: wrap.widget.from,
    source: wrap.widget.source,
    row: (cell.parentElement as HTMLTableRowElement).rowIndex,
    col: (cell as HTMLTableCellElement).cellIndex,
  };
}

const eachRow = (lines: string[], how: (texts: string[], i: number) => string[]) =>
  lines.forEach((line, i) => (lines[i] = lead(line) + rowLine(how(cells(line), i))));
export const tableActions: { id: string; label: string; reshape: Reshape; where?: "body" | "wide" }[] = [
  { id: "editor.table.addRowAbove", label: "Add row above", reshape: (lines, at) => lines.splice(at, 0, lead(lines[1]) + rowLine(Array(cells(lines[0]).length).fill(""))), where: "body" },
  { id: "editor.table.addRowBelow", label: "Add row below", reshape: (lines, at) => lines.splice(Math.max(at, 1) + 1, 0, lead(lines[1]) + rowLine(Array(cells(lines[0]).length).fill(""))) },
  { id: "editor.table.addColumnLeft", label: "Add column left", reshape: (lines, _, col) => eachRow(lines, (t, i) => t.toSpliced(col, 0, i === 1 ? "---" : "")) },
  { id: "editor.table.addColumnRight", label: "Add column right", reshape: (lines, _, col) => eachRow(lines, (t, i) => t.toSpliced(col + 1, 0, i === 1 ? "---" : "")) },
  { id: "editor.table.deleteRow", label: "Delete row", reshape: (lines, at) => lines.splice(at, 1), where: "body" },
  { id: "editor.table.deleteColumn", label: "Delete column", reshape: (lines, _, col) => eachRow(lines, (t) => t.toSpliced(col, 1)), where: "wide" },
  { id: "editor.table.delete", label: "Delete table", reshape: (lines) => lines.splice(0) },
];

export function tableMenuItems(target: TableTarget) {
  const width = grid(target.source)[0].length;
  return tableActions.filter(({ where }) => !(where === "body" && target.row === 0) && !(where === "wide" && width < 2))
    .map(({ id, label }) => ({ id, label, danger: label.startsWith("Delete") }));
}

/** Commands accept only the unchanged source of a real markdown table. */
export function reshapeTable(view: EditorView, id: string, args: Record<string, unknown>): boolean {
  const { from, source, row, col } = args;
  if (typeof from !== "number" || !Number.isInteger(from) || from < 0 || typeof source !== "string" ||
      typeof row !== "number" || !Number.isInteger(row) || row < 0 || typeof col !== "number" || !Number.isInteger(col) || col < 0 ||
      from + source.length > view.state.doc.length || view.state.sliceDoc(from, from + source.length) !== source) return false;
  let found = false;
  syntaxTree(view.state).iterate({ from, to: from + source.length, enter(node) {
    if (node.name === "Table" && node.from === from && node.to === from + source.length) found = true;
  } });
  if (!found || row >= grid(source).length || col >= grid(source)[0].length) return false;
  const action = tableActions.find((action) => action.id === id);
  if (!action || !tableMenuItems({ from, source, row, col }).some((item) => item.id === id)) return false;
  if (view.state.readOnly || !view.state.facet(EditorView.editable)) return false;
  new Table(source, from).change(view, (lines) => action.reshape(lines, row === 0 ? 0 : row + 1, col));
  return true;
}

class Properties extends WidgetType {
  constructor(readonly count: number) {
    super();
  }
  eq(other: Properties) {
    return other.count === this.count;
  }
  toDOM(view: EditorView) {
    const el = document.createElement("div");
    el.className = "cm-properties";
    el.textContent = this.count === 1 ? "1 property" : `${this.count} properties`;
    el.title = "Show properties";
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: Math.min(4, view.state.doc.length) } });
      view.focus();
    });
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

/** Frontmatter collapses to one quiet line until the cursor goes into it. */
/** The part of a note an embed asks for: all of it, one heading's section, or one block. */
export function sliceNote(text: string, ref: string): string {
  const body = text.slice(readFrontmatter(text).end).replace(/^\n+/, "");
  if (!ref) return body;
  const lines = body.split("\n");
  if (ref.startsWith("^")) {
    const at = lines.findIndex((l) => l.trimEnd().endsWith(ref));
    if (at < 0) return "";
    let from = at;
    while (from > 0 && lines[from - 1].trim()) from--;
    return lines.slice(from, at + 1).join("\n").replace(new RegExp(`\\s*\\${ref}\\s*$`), "");
  }
  const want = ref.replace(/^#/, "").trim().toLowerCase();
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s+/, "").trim().toLowerCase() === want);
  if (start < 0) return "";
  const level = /^#+/.exec(lines[start])![0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s/.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** `![[Note]]` on its own line shows that note, read-only, in place. */
class Embed extends WidgetType {
  constructor(
    readonly target: string,
    readonly from: number,
    readonly hooks: PreviewHooks,
  ) {
    super();
  }
  eq(other: Embed) {
    return other.target === this.target && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const [name, ...rest] = this.target.split(/(?=[#^])/);
    const ref = rest.join("");
    const box = document.createElement("div");
    box.className = "cm-embed";
    const head = box.appendChild(document.createElement("div"));
    head.className = "cm-embed-head";
    const title = head.appendChild(document.createElement("button"));
    title.textContent = name.trim() + (ref ? ` › ${ref.replace(/^[#^]/, "")}` : "");
    title.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hooks.openLink(name.trim());
    });
    const body = box.appendChild(document.createElement("div"));
    body.className = "cm-embed-body";
    void this.hooks.loadNote?.(name.trim()).then((text) => {
      if (!box.isConnected) return;
      const shown = text === null ? null : sliceNote(text, ref);
      if (!shown) {
        body.textContent = text === null ? "This note does not exist yet." : "Nothing matches this link.";
        body.classList.add("cm-embed-missing");
        return;
      }
      const mounted = this.hooks.mountEmbed?.(body, shown);
      (box as HTMLElement & { cleanup?: () => void }).cleanup = () => mounted?.destroy();
    });
    // Clicking the frame puts the cursor on the `![[...]]` line, which reveals it.
    box.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest(".cm-embed-body .cm-editor")) return;
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from } });
      view.focus();
    });
    return box;
  }
  destroy(dom: HTMLElement) {
    (dom as HTMLElement & { cleanup?: () => void }).cleanup?.();
  }
  ignoreEvent() {
    return true;
  }
}

const EMBED_LINE = /^!\[\[([^\]\n|]+)(?:\|[^\]\n]*)?\]\]\s*$/;

/** Multi-line replacements have to come from a state field, not a view plugin. */
const blocks = (hooks: PreviewHooks) =>
  StateField.define<DecorationSet>({
    create: (state) => buildBlocks(state, hooks),
    update(value, tr) {
      const reparsed = syntaxTree(tr.startState) !== syntaxTree(tr.state);
      return tr.docChanged || tr.selection || reparsed ? buildBlocks(tr.state, hooks) : value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

function buildBlocks(state: EditorState, hooks: PreviewHooks): DecorationSet {
  const out: Range<Decoration>[] = [...foldFrontmatter(state)];
  if (hooks.loadNote) {
    const tree = syntaxTree(state);
    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n);
      if (!line.text.startsWith("![[")) continue;
      const m = EMBED_LINE.exec(line.text);
      if (!m || IMAGE_FILE.test(m[1].trim()) || touches(state, line.from, line.to)) continue;
      if (/Code|Frontmatter/.test(tree.resolveInner(line.from, 1).name)) continue;
      const widget = new Embed(m[1].trim(), line.from, hooks);
      out.push(Decoration.replace({ widget, block: true }).range(line.from, line.to));
    }
  }
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Table") return;
      if (!touches(state, node.from, node.to)) {
        const widget = new Table(state.sliceDoc(node.from, node.to), node.from, hooks.tableMenu);
        out.push(Decoration.replace({ widget, block: true }).range(node.from, node.to));
      }
      return false;
    },
  });
  return Decoration.set(out, true);
}

function foldFrontmatter(state: EditorState): Range<Decoration>[] {
  const fm = readFrontmatter(state.sliceDoc(0, 20_000));
  if (fm.end === 0) return [];
  const to = state.sliceDoc(fm.end - 1, fm.end) === "\n" ? fm.end - 1 : fm.end;
  if (touches(state, 0, to)) {
    const lines: Range<Decoration>[] = [];
    for (let n = 1; n <= state.doc.lineAt(to).number; n++) {
      lines.push(Decoration.line({ class: "cm-frontmatter" }).range(state.doc.line(n).from));
    }
    return lines;
  }
  const widget = new Properties(Object.keys(fm.values).length);
  return [Decoration.replace({ widget, block: true }).range(0, to)];
}

/**
 * A link is followed with a plain click, and opened in a new tab with Cmd or Ctrl held, the way
 * links work everywhere else. To change a link instead of following it: move the caret into it
 * with the arrow keys, or hold Option (Alt) and click. While its brackets are showing it is
 * being edited, so clicks inside it place the caret as usual.
 */
function linkClicks(open: (target: string, newTab: boolean) => void) {
  return EditorView.domEventHandlers({
    mousedown(event) {
      if (event.button !== 0 || event.altKey || event.shiftKey) return false;
      const link = (event.target as HTMLElement).closest<HTMLElement>(".cm-wikilink, .cm-link[data-target]");
      const target = link?.dataset.target;
      if (!link || !target || link.textContent?.includes("[[")) return false;
      event.preventDefault();
      open(target, event.metaKey || event.ctrlKey);
      return true;
    },
  });
}

export interface PreviewHooks {
  /** Follow a link to a note; `newTab` when the person asked for it to open beside this one. */
  openLink(target: string, newTab?: boolean): void;
  resolveImage(src: string): string | null;
  /** Text of the note a link points at, or null if there is none. Leave out to turn embeds off. */
  loadNote?(target: string): Promise<string | null>;
  /** Show markdown read-only inside `parent`. */
  mountEmbed?(parent: HTMLElement, text: string): { destroy(): void };
  tableMenu?(cell: HTMLElement, target: TableTarget, at: { x: number; y: number }): void;
}

export function livePreview(hooks: PreviewHooks) {
  return [blocks(hooks), inline(hooks), linkClicks(hooks.openLink)];
}
