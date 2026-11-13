/** @part-of ui.editor */
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { indentUnit } from "@codemirror/language";
import { EditorState, type Extension, Prec, type TransactionSpec } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder } from "@codemirror/view";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { Awareness } from "y-protocols/awareness";
import { type Text as YText, UndoManager } from "yjs";

import { livePreview } from "./livePreview";
import { insertLink, readFrontmatter, setFrontmatterKey, setHeading, toggleMark } from "./markdownCommands";
import { markdownPairs, typeText } from "./pairs";
import { completions } from "./slash";
import { editorTheme } from "./theme";

export interface EditorHooks {
  onChange(text: string): void;
  onOpenLink(target: string): void;
  /** Turn an image path from a note into something the window can load. */
  resolveImage(src: string): string | null;
  /** Text of the note a link points at, for `![[embeds]]`. */
  loadNote(target: string): Promise<string | null>;
  /** Paths of every note, for `[[` suggestions. */
  notePaths(): string[];
  /** Keep a pasted or dropped file in the vault; resolves to the link target to insert, or null. */
  saveFile(file: File): Promise<string | null>;
  /** Extra slash-menu entries, from plugins. */
  snippets(): { label: string; detail: string; insert: string }[];
}

/** One editing surface. Each open note keeps its own state (and undo history). */
export class Editor {
  readonly view: EditorView;
  private hooks: EditorHooks;

  constructor(parent: HTMLElement, hooks: EditorHooks) {
    this.hooks = hooks;
    this.view = new EditorView({ parent, state: this.createState("") });
  }

  createState(text: string): EditorState {
    return this.build(text, [history(), keymap.of(historyKeymap)]);
  }

  /** A state bound to a shared document: edits, undo and cursors go through it. */
  createSharedState(text: YText, awareness: Awareness): EditorState {
    const undoManager = new UndoManager(text);
    return this.build(text.toString(), [yCollab(text, awareness, { undoManager }), keymap.of(yUndoManagerKeymap)]);
  }

  private build(text: string, editing: Extension[]): EditorState {
    const apply = (spec: (state: EditorState) => TransactionSpec) => (view: EditorView) => {
      view.dispatch(spec(view.state));
      return true;
    };
    // The cursor starts in the body, so the properties block opens folded away.
    const start = Math.min(readFrontmatter(text.slice(0, 20_000)).end, text.length);
    return EditorState.create({
      doc: text,
      selection: { anchor: start },
      extensions: [
        editing,
        drawSelection(),
        EditorView.lineWrapping,
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        markdownPairs,
        closeBrackets(),
        completions(() => this.hooks.notePaths(), () => this.hooks.snippets()),
        yamlFrontmatter({ content: markdown({ base: markdownLanguage, addKeymap: false }) }),
        livePreview({
          openLink: (target) => this.hooks.onOpenLink(target),
          resolveImage: (src) => this.hooks.resolveImage(src),
          loadNote: (target) => this.hooks.loadNote(target),
          mountEmbed: (parent, text) => this.mountEmbed(parent, text),
        }),
        editorTheme,
        placeholder("Write something, or press / for commands…"),
        Prec.high(
          keymap.of([
            { key: "Mod-b", run: apply((s) => toggleMark(s, "**")) },
            { key: "Mod-i", run: apply((s) => toggleMark(s, "*")) },
            { key: "Mod-e", run: apply((s) => toggleMark(s, "`")) },
            { key: "Mod-Shift-x", run: apply((s) => toggleMark(s, "~~")) },
            { key: "Mod-Shift-h", run: apply((s) => toggleMark(s, "==")) },
            { key: "Mod-k", run: apply(insertLink) },
          ]),
        ),
        keymap.of([...markdownKeymap, ...closeBracketsKeymap, ...defaultKeymap, indentWithTab]),
        EditorView.domEventHandlers({
          paste: (e, view) => this.takeFiles(view, e.clipboardData?.files, null, e),
          drop: (e, view) => this.takeFiles(view, e.dataTransfer?.files, view.posAtCoords({ x: e.clientX, y: e.clientY }), e),
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) this.hooks.onChange(u.state.doc.toString());
        }),
      ],
    });
  }

  /** A read-only preview of some markdown; embeds inside it are not expanded again. */
  private mountEmbed(parent: HTMLElement, text: string): EditorView {
    return new EditorView({
      parent,
      state: EditorState.create({
        doc: text,
        extensions: [
          EditorView.lineWrapping,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          yamlFrontmatter({ content: markdown({ base: markdownLanguage, addKeymap: false }) }),
          livePreview({
            openLink: (target) => this.hooks.onOpenLink(target),
            resolveImage: (src) => this.hooks.resolveImage(src),
          }),
          editorTheme,
        ],
      }),
    });
  }

  /** Show some markdown read-only, rendered like a note. Returns how to remove it. */
  preview(parent: HTMLElement, text: string): () => void {
    const view = this.mountEmbed(parent, text);
    return () => view.destroy();
  }

  /** Pasted or dropped files are saved into the vault and linked where they landed. */
  private takeFiles(view: EditorView, files: FileList | undefined, at: number | null, event: Event): boolean {
    if (!files?.length || view.state.readOnly) return false;
    event.preventDefault();
    void (async () => {
      for (const file of [...files]) {
        const target = await this.hooks.saveFile(file);
        if (!target) continue;
        const link = `${file.type.startsWith("image/") ? "!" : ""}[${file.type.startsWith("image/") ? "" : file.name}](${target})`;
        const pos = Math.min(at ?? view.state.selection.main.head, view.state.doc.length);
        const line = view.state.doc.lineAt(pos);
        // An image gets a line of its own.
        const insert = file.type.startsWith("image/") ? `${view.state.sliceDoc(line.from, pos).trim() ? "\n" : ""}${link}\n` : link;
        const end = at === null ? view.state.selection.main.to : pos;
        view.dispatch({ changes: { from: pos, to: end, insert }, selection: { anchor: pos + insert.length }, userEvent: "input.paste" });
        at = at === null ? null : pos + insert.length;
      }
    })();
    return true;
  }

  /** Every heading in the note, in order. */
  headings(): { level: number; text: string; pos: number }[] {
    const out: { level: number; text: string; pos: number }[] = [];
    const doc = this.view.state.doc;
    let fenced = false;
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n);
      if (/^(```|~~~)/.test(line.text)) fenced = !fenced;
      const m = fenced ? null : /^(#{1,6})\s+(.*?)\s*#*$/.exec(line.text);
      if (m) out.push({ level: m[1].length, text: m[2], pos: line.from });
    }
    return out;
  }

  /** Move to a place in the note and bring it into view near the top. */
  goTo(pos: number): void {
    const at = Math.min(pos, this.view.state.doc.length);
    const end = this.view.state.doc.lineAt(at).to;
    this.view.dispatch({ selection: { anchor: end }, effects: EditorView.scrollIntoView(at, { y: "start", yMargin: 96 }) });
    this.view.focus();
  }

  /** Go to what a link points at inside this note: `#Heading` or `^block`. */
  reveal(ref: string): boolean {
    if (ref.startsWith("^")) {
      const at = this.text.indexOf(ref);
      if (at < 0) return false;
      this.goTo(at);
      return true;
    }
    const want = ref.replace(/^#/, "").trim().toLowerCase();
    const found = this.headings().find((h) => h.text.toLowerCase() === want);
    if (found) this.goTo(found.pos);
    return Boolean(found);
  }

  /** Put text where the cursor is, replacing any selection. */
  insert(text: string): void {
    this.view.dispatch(this.view.state.replaceSelection(text));
    this.view.focus();
  }

  get text(): string {
    return this.view.state.doc.toString();
  }

  /** Swap in another note's state; returns the state being replaced. */
  swap(next: EditorState): EditorState {
    const previous = this.view.state;
    this.view.setState(next);
    return previous;
  }

  /** Replace the text after an outside change, keeping the cursor near where it was. */
  replaceText(text: string): void {
    const head = Math.min(this.view.state.selection.main.head, text.length);
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
      selection: { anchor: head },
    });
  }

  mark(mark: string): void {
    this.view.dispatch(toggleMark(this.view.state, mark));
  }
  heading(level: number): void {
    this.view.dispatch(setHeading(this.view.state, level));
  }
  link(): void {
    this.view.dispatch(insertLink(this.view.state));
  }
  setProperty(key: string, value: string | null): void {
    this.view.dispatch(setFrontmatterKey(this.view.state, key, value));
  }
  properties(): Record<string, string> {
    return readFrontmatter(this.view.state.sliceDoc(0, 20_000)).values;
  }
  type(text: string): void {
    typeText(this.view, text);
  }
  select(anchor: number, head = anchor): void {
    const max = this.view.state.doc.length;
    this.view.dispatch({ selection: { anchor: Math.min(anchor, max), head: Math.min(head, max) } });
  }

  /** What is actually on screen, line by line, with hidden syntax left out. */
  rendered(): string[] {
    return [...this.view.contentDOM.querySelectorAll<HTMLElement>(".cm-line")].map((l) => l.innerText);
  }
}
