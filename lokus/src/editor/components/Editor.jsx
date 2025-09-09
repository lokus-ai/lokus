import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import SlashCommand from "../lib/SlashCommand.js";

import "../styles/editor.css";

const Editor = ({ content, onContentChange }) => {
  const isSettingRef = useRef(false);
  const [extensions, setExtensions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Load markdown preferences
      let prefs = { links: true, taskList: true, tables: true, images: true };
      try {
        const { readConfig } = await import("../../core/config/store.js");
        const cfg = await readConfig();
        if (cfg.markdown) prefs = { ...prefs, ...cfg.markdown };
      } catch {}

      const exts = [StarterKit];
      // Dynamic import helpers to avoid ESM default pitfalls
      const safe = async (path) => {
        try {
          const m = await import(path);
          return m.default ?? m;
        } catch (e) {
          console.warn("Failed to load extension:", path, e);
          return null;
        }
      };

      if (prefs.links) {
        const Link = await safe("@tiptap/extension-link");
        if (Link) exts.push(Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }));
      }
      if (prefs.taskList) {
        const TaskList = await safe("@tiptap/extension-task-list");
        const TaskItem = await safe("@tiptap/extension-task-item");
        if (TaskList && TaskItem) { exts.push(TaskList, TaskItem); }
      }
      if (prefs.images) {
        const Image = await safe("@tiptap/extension-image");
        if (Image) exts.push(Image);
      }
      if (prefs.tables) {
        const Table = await safe("@tiptap/extension-table");
        const TableRow = await safe("@tiptap/extension-table-row");
        const TableHeader = await safe("@tiptap/extension-table-header");
        const TableCell = await safe("@tiptap/extension-table-cell");
        if (Table && TableRow && TableHeader && TableCell) {
          exts.push(Table.configure({ resizable: true }), TableRow, TableHeader, TableCell);
        }
      }

      exts.push(Placeholder.configure({ placeholder: "Press '/' for commands..." }));
      exts.push(SlashCommand);

      if (!cancelled) setExtensions(exts);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const editor = useEditor({
    extensions: [
      ...(extensions || [StarterKit, Placeholder.configure({ placeholder: "Press '/' for commands..." }), SlashCommand]),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none tiptap-area pb-16 smooth-type",
      },
    },
    content: content,
    onUpdate: ({ editor }) => {
      if (isSettingRef.current) {
        // Ignore updates triggered by programmatic setContent
        isSettingRef.current = false;
        return;
      }
      onContentChange(editor.getHTML());
    },
  }, [extensions]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isSettingRef.current = true;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
};

export default Editor;
