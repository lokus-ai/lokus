import React, { useMemo } from "react";
import { BubbleMenu } from "@tiptap/react/menus";

const Btn = ({ onClick, title, children, disabled }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`px-2 py-1 text-sm rounded border transition-colors
      ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-app-accent/10"}
      bg-app-panel border-app-border text-app-text`}
  >
    {children || title}
  </button>
);

const TableBubbleMenu = ({ editor }) => {
  const shouldShow = useMemo(
    () => () =>
      editor.isActive("table") ||
      editor.isActive("tableCell") ||
      editor.isActive("tableHeader"),
    [editor]
  );

  if (!editor) return null;

  const can = editor.can();

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      options={{
        tippyOptions: {
          placement: "top",
          offset: [0, 8],
        },
      }}
      className="flex gap-1 p-1 rounded-md border bg-app-panel border-app-border shadow-md"
    >
      <Btn title="Insert row above" disabled={!can.addRowBefore?.()} onClick={() => editor.chain().focus().addRowBefore().run()}>+ Row ↑</Btn>
      <Btn title="Insert row below" disabled={!can.addRowAfter?.()} onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row ↓</Btn>
      <Btn title="Insert column left" disabled={!can.addColumnBefore?.()} onClick={() => editor.chain().focus().addColumnBefore().run()}>+ Col ←</Btn>
      <Btn title="Insert column right" disabled={!can.addColumnAfter?.()} onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Col →</Btn>

      <span className="w-px bg-app-border mx-1" />

      <Btn title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Hdr Row</Btn>
      <Btn title="Toggle header column" onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>Hdr Col</Btn>
      <Btn title="Toggle header cell" onClick={() => editor.chain().focus().toggleHeaderCell().run()}>Hdr Cell</Btn>

      <span className="w-px bg-app-border mx-1" />

      <Btn title="Merge cells" disabled={!can.mergeCells?.()} onClick={() => editor.chain().focus().mergeCells().run()}>Merge</Btn>
      <Btn title="Split cell" disabled={!can.splitCell?.()} onClick={() => editor.chain().focus().splitCell().run()}>Split</Btn>

      <span className="w-px bg-app-border mx-1" />

      <Btn title="Delete row" disabled={!can.deleteRow?.()} onClick={() => editor.chain().focus().deleteRow().run()}>Del Row</Btn>
      <Btn title="Delete column" disabled={!can.deleteColumn?.()} onClick={() => editor.chain().focus().deleteColumn().run()}>Del Col</Btn>
      <Btn title="Delete table" disabled={!can.deleteTable?.()} onClick={() => editor.chain().focus().deleteTable().run()}>Del Tbl</Btn>
    </BubbleMenu>
  );
};

export default TableBubbleMenu;