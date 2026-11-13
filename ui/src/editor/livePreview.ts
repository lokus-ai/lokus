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
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
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

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

const INLINE_PARENTS = new Set(["StrongEmphasis", "Emphasis", "Strikethrough", "InlineCode", "Link", "Image"]);
const WIKI = /(!?)\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
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
          const isTask = /^\s\[[ xX]\]/.test(state.sliceDoc(node.to, node.to + 4));
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
          const m = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/.exec(state.sliceDoc(node.from, node.to));
          const url = m ? hooks.resolveImage(m[2]) : null;
          if (m && url && !touches(state, node.from, node.to)) {
            out.push(Decoration.replace({ widget: new Picture(url, m[1]) }).range(node.from, node.to));
          }
          return false;
        }
        if (name === "Link") {
          out.push(Decoration.mark({ class: "cm-link" }).range(node.from, node.to));
          if (!touches(state, node.from, node.to)) {
            const text = state.sliceDoc(node.from, node.to);
            const close = text.lastIndexOf("](");
            if (text.startsWith("[") && close > 0) {
              out.push(hide.range(node.from, node.from + 1));
              out.push(hide.range(node.from + close, node.to));
            }
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

/** Inline marks inside a table cell: bold, italic, code, strikethrough. */
function cellContent(cell: HTMLElement, text: string): void {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*)/);
  for (const part of parts) {
    const wrap = (tag: string, inner: string) => {
      const el = document.createElement(tag);
      el.textContent = inner;
      cell.append(el);
    };
    if (/^`.+`$/.test(part)) wrap("code", part.slice(1, -1));
    else if (/^\*\*.+\*\*$/.test(part)) wrap("strong", part.slice(2, -2));
    else if (/^~~.+~~$/.test(part)) wrap("s", part.slice(2, -2));
    else if (/^\*.+\*$/.test(part)) wrap("em", part.slice(1, -1));
    else cell.append(part);
  }
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

class Table extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
  ) {
    super();
  }
  eq(other: Table) {
    return other.source === this.source && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const lines = this.source.split("\n").filter((l) => l.trim());
    const align = cells(lines[1] ?? "").map((c) =>
      c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "",
    );
    const wrap = document.createElement("div");
    wrap.className = "cm-table";
    const table = wrap.appendChild(document.createElement("table"));
    lines.forEach((line, i) => {
      if (i === 1) return;
      const tr = table.appendChild(document.createElement("tr"));
      cells(line).forEach((text, col) => {
        const cell = tr.appendChild(document.createElement(i === 0 ? "th" : "td"));
        if (align[col]) cell.style.textAlign = align[col];
        cellContent(cell, text);
      });
    });
    // Clicking the table puts the cursor in its markdown, which reveals it.
    wrap.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from + 2 } });
      view.focus();
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
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
        const widget = new Table(state.sliceDoc(node.from, node.to), node.from);
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

/** Cmd/Ctrl-click a wiki link to open it. */
function linkClicks(open: (target: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(event) {
      if (!(event.metaKey || event.ctrlKey)) return false;
      const link = (event.target as HTMLElement).closest<HTMLElement>(".cm-wikilink");
      const target = link?.dataset.target;
      if (!target) return false;
      event.preventDefault();
      open(target);
      return true;
    },
  });
}

export interface PreviewHooks {
  openLink(target: string): void;
  resolveImage(src: string): string | null;
  /** Text of the note a link points at, or null if there is none. Leave out to turn embeds off. */
  loadNote?(target: string): Promise<string | null>;
  /** Show markdown read-only inside `parent`. */
  mountEmbed?(parent: HTMLElement, text: string): { destroy(): void };
}

export function livePreview(hooks: PreviewHooks) {
  return [blocks(hooks), inline(hooks), linkClicks(hooks.openLink)];
}
