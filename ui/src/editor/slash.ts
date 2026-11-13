/** @part-of ui.editor */
import { autocompletion, type Completion, type CompletionContext, completionKeymap } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";

/**
 * The slash menu. Typing `/` at the start of a line or after a space offers
 * blocks to insert; each one just writes the markdown for it.
 */
interface Block {
  label: string;
  /** The markdown shortcut, shown on the right so people learn it. */
  hint: string;
  /** Text to insert; `§` marks where the cursor goes. */
  insert: string;
  /** Block-level items start their own line. */
  block?: boolean;
}

const BLOCKS: Block[] = [
  { label: "Heading 1", hint: "#", insert: "# §", block: true },
  { label: "Heading 2", hint: "##", insert: "## §", block: true },
  { label: "Heading 3", hint: "###", insert: "### §", block: true },
  { label: "Bulleted list", hint: "-", insert: "- §", block: true },
  { label: "Numbered list", hint: "1.", insert: "1. §", block: true },
  { label: "To-do", hint: "- [ ]", insert: "- [ ] §", block: true },
  { label: "Quote", hint: ">", insert: "> §", block: true },
  { label: "Code block", hint: "```", insert: "```§\n\n```", block: true },
  { label: "Divider", hint: "---", insert: "---\n§", block: true },
  { label: "Table", hint: "| |", insert: "| Column | Column |\n| --- | --- |\n| § |  |", block: true },
  { label: "Link", hint: "[]()", insert: "[§]()" },
  { label: "Link to note", hint: "[[ ]]", insert: "[[§]]" },
  { label: "Image", hint: "![]()", insert: "![](§)" },
  { label: "Highlight", hint: "== ==", insert: "==§==" },
];

function apply(block: Block) {
  return (view: EditorView, _c: Completion, from: number, to: number) => {
    const line = view.state.doc.lineAt(from);
    const slash = from - 1;
    // Mid-line, a block starts on a fresh line.
    const lead = block.block && view.state.sliceDoc(line.from, slash).trim() ? "\n" : "";
    const text = lead + block.insert;
    const cursor = text.indexOf("§");
    const insert = text.slice(0, cursor) + text.slice(cursor + 1);
    view.dispatch({
      changes: { from: slash, to, insert },
      selection: EditorSelection.cursor(slash + cursor),
      userEvent: "input.complete",
    });
  };
}

function source(context: CompletionContext) {
  const match = context.matchBefore(/\/[\w ]*/);
  if (!match) return null;
  const before = context.state.sliceDoc(Math.max(0, match.from - 1), match.from);
  if (before && !/\s/.test(before)) return null;
  return {
    from: match.from + 1,
    validFor: /^[\w ]*$/,
    options: BLOCKS.map((block, i) => ({
      label: block.label,
      detail: block.hint,
      boost: -i,
      apply: apply(block),
    })),
  };
}

/** After `[[`, offer the vault's notes. */
function noteLinks(notePaths: () => string[]) {
  return (context: CompletionContext) => {
    const match = context.matchBefore(/\[\[[^\]\n|#^]*/);
    if (!match) return null;
    const from = match.from + 2;
    return {
      from,
      validFor: /^[^\]\n|#^]*$/,
      options: notePaths().map((path) => {
        const name = path.replace(/\.md$/i, "");
        const label = name.split("/").pop()!;
        return {
          label,
          detail: name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : undefined,
          apply(view: EditorView, _c: Completion, start: number, to: number) {
            const closed = view.state.sliceDoc(to, to + 2) === "]]";
            view.dispatch({
              changes: { from: start, to, insert: closed ? label : `${label}]]` },
              selection: EditorSelection.cursor(start + label.length + 2),
              userEvent: "input.complete",
            });
          },
        };
      }),
    };
  };
}

/** The slash menu and `[[` note suggestions share one popup. */
export function completions(notePaths: () => string[]) {
  return [
    autocompletion({ override: [source, noteLinks(notePaths)], icons: false, activateOnTyping: true, defaultKeymap: false }),
    keymap.of(completionKeymap),
  ];
}
