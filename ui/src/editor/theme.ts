/** @part-of ui.editor */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** Layout only; every colour comes from the design tokens in tokens.css. */
const layout = EditorView.theme({
  "&": { fontSize: "var(--text-body)", color: "var(--fg)", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-editor)", lineHeight: "1.6", overflow: "visible" },
  ".cm-content": { padding: "0 0 40vh", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "1.5px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
  ".cm-placeholder": { color: "var(--fg-3)" },
});

const highlight = HighlightStyle.define([
  { tag: t.strong, fontWeight: "650" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--fg-2)" },
  { tag: t.heading, fontWeight: "650" },
  { tag: [t.processingInstruction, t.meta], color: "var(--fg-3)" },
  { tag: t.url, color: "var(--fg-3)" },
  { tag: t.monospace, fontFamily: "var(--font-mono)" },
  { tag: t.contentSeparator, color: "var(--fg-3)" },
  { tag: [t.keyword, t.atom, t.bool], color: "var(--syntax-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syntax-string)" },
  { tag: [t.number, t.propertyName], color: "var(--syntax-number)" },
  { tag: t.comment, color: "var(--fg-3)", fontStyle: "italic" },
]);

export const editorTheme = [layout, syntaxHighlighting(highlight)];
