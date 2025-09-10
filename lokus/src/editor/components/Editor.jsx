import React, { useEffect, useRef, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import * as StarterKitExt from "@tiptap/starter-kit";
import * as PlaceholderExt from "@tiptap/extension-placeholder";
import SlashCommand from "../lib/SlashCommand.js";
import TableBubbleMenu from "./TableBubbleMenu.jsx";
import * as LinkExt from "@tiptap/extension-link";
import * as TaskListExt from "@tiptap/extension-task-list";
import * as TaskItemExt from "@tiptap/extension-task-item";
import * as ImageExt from "@tiptap/extension-image";
import * as SuperscriptExt from "@tiptap/extension-superscript";
import * as SubscriptExt from "@tiptap/extension-subscript";
import * as TableExt from "@tiptap/extension-table";
import * as TableRowExt from "@tiptap/extension-table-row";
import * as TableHeaderExt from "@tiptap/extension-table-header";
import * as TableCellExt from "@tiptap/extension-table-cell";
import MathExt from "../extensions/Math.js";
import WikiLink from "../extensions/WikiLink.js";
import WikiLinkSuggest from "../lib/WikiLinkSuggest.js";

import "../styles/editor.css";

const Editor = ({ content, onContentChange }) => {
  const [extensions, setExtensions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pick = (ns, named) => ns?.default ?? ns?.[named] ?? null;
    const StarterKit = pick(StarterKitExt, 'StarterKit');
    const Placeholder = pick(PlaceholderExt, 'Placeholder');
    const Link = pick(LinkExt, 'Link');
    const TaskList = pick(TaskListExt, 'TaskList');
    const TaskItem = pick(TaskItemExt, 'TaskItem');
    const Image = pick(ImageExt, 'Image');
    const Superscript = pick(SuperscriptExt, 'Superscript');
    const Subscript = pick(SubscriptExt, 'Subscript');
    const Table = pick(TableExt, 'Table');
    const TableRow = pick(TableRowExt, 'TableRow');
    const TableHeader = pick(TableHeaderExt, 'TableHeader');
    const TableCell = pick(TableCellExt, 'TableCell');

    const exts = [StarterKit];
    if (Link) exts.push(Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }));
    if (TaskList && TaskItem) exts.push(TaskList, TaskItem);
    if (Image) exts.push(Image);
    if (Superscript) exts.push(Superscript);
    if (Subscript) exts.push(Subscript);
    if (Table && TableRow && TableHeader && TableCell) {
      exts.push(Table.configure({ resizable: true }), TableRow, TableHeader, TableCell);
    }
    // Math (inline + block) – local extension
    if (Array.isArray(MathExt)) exts.push(...MathExt)
    else if (MathExt) exts.push(MathExt)

    // Obsidian‑style wikilinks and image embeds
    exts.push(WikiLink)
    exts.push(WikiLinkSuggest)

    exts.push(Placeholder.configure({ placeholder: "Press '/' for commands..." }));
    exts.push(SlashCommand);
    setExtensions(exts);
    setLoading(false);
  }, []);

  if (loading || !extensions) {
    return <div className="m-5 text-app-muted">Loading editor…</div>;
  }

  return <Tiptap extensions={extensions} content={content} onContentChange={onContentChange} />;
};

function Tiptap({ extensions, content, onContentChange }) {
  const isSettingRef = useRef(false);
  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: { class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none tiptap-area pb-16 smooth-type" },
      handleDOMEvents: {
        click: (view, event) => {
          const t = event.target;
          if (!(t instanceof Element)) return false;
          const el = t.closest('[data-type="wiki-link"]');
          if (!el) return false;
          const href = el.getAttribute('href') || '';
          if (!href) return true;
          event.preventDefault();
          // Emit to workspace to open file (Tauri or DOM event)
          (async () => {
            try {
              const { emit } = await import('@tauri-apps/api/event');
              await emit('lokus:open-file', href);
            } catch {
              try { window.dispatchEvent(new CustomEvent('lokus:open-file', { detail: href })); } catch {}
            }
          })();
          return true;
        },
      },
    },
    content,
    onUpdate: ({ editor }) => {
      if (isSettingRef.current) { isSettingRef.current = false; return; }
      onContentChange(editor.getHTML());
    },
  }, [extensions]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isSettingRef.current = true;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const showDebug = useMemo(() => {
    try { const p = new URLSearchParams(window.location.search); if (p.get('dev') === '1') return true; } catch {}
    try { return !!import.meta?.env?.DEV; } catch { return false; }
  }, []);

  async function waitForCommand(cmd, { interval = 100, timeout = 5000 } = {}) {
    const start = Date.now();
    for (;;) {
      if (editor?.commands?.[cmd]) return true;
      if (Date.now() - start >= timeout) return false;
      await new Promise(r => setTimeout(r, interval));
    }
  }
  const insertTestTable = async () => {
    if (editor?.commands?.insertTable) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      return;
    }
    // Fallback: insert HTML table content, which works as long as table nodes are in the schema
    const body = Array.from({ length: 3 }).map(() => `<tr><td> </td><td> </td><td> </td></tr>`).join('');
    const html = `<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody>${body}</tbody></table>`;
    editor.chain().focus().insertContent(html).run();
  };

  return (
    <>
      {editor && showDebug && (
        <div className="m-5 mb-0 flex gap-2">
          <button type="button" onClick={insertTestTable} className="px-2 py-1 text-sm rounded border bg-app-panel border-app-border hover:bg-app-accent/10">Insert Test Table</button>
        </div>
      )}
      {editor && <TableBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}

export default Editor;
