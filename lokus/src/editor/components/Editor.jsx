import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import SlashCommand from "../lib/SlashCommand.js";

import "../styles/editor.css";

const Editor = ({ content, onContentChange }) => {
  const isSettingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Press '/' for commands...",
      }),
      SlashCommand,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none tiptap-area pb-16",
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
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isSettingRef.current = true;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
};

export default Editor;
