import React, { useMemo } from "react";
import { FileText, Timer, Type } from "lucide-react"; // Lucide icons

function countFinder(editor) {
  const nodes = editor?.state.doc?.content?.content;
  let WordCount = 0;
  let CharCount = 0;

  nodes?.forEach((node) => {
    const contentArray = node?.content?.content;

    // Skip empty nodes
    if (!contentArray || contentArray.length === 0) return;

    const text = contentArray[0]?.text || "";

    // Count characters including everything
    CharCount += text.length;

    // Split into words and filter out words without alphanumeric characters
    const words = text
      .trim()
      .split(/\s+/)
      .filter(word => /[a-zA-Z0-9]/.test(word)); // only words with letters/numbers

    WordCount += words.length;
  });

  return { WordCount, CharCount };
}

const EditorStatusBar = ({ editor, readingSpeed = 200 }) => {

  

  const stats = useMemo(() => {
    if (!editor) return null;

    const {WordCount, CharCount} = countFinder(editor);
  
    const minutes = WordCount ? Math.max(1, Math.ceil(WordCount / readingSpeed)) : 0;

    return {WordCount, CharCount, minutes };
    
  }, [editor?.state?.doc]);

  if (!stats) return null;

  return (
    <div className="editor-status-bar">
      <span>
        <FileText size={16} strokeWidth={1.75} />
        Words: {stats.WordCount.toLocaleString()}
      </span>

      <span className="separator">|</span>

      <span>
        <Timer size={16} strokeWidth={1.75} />
        Reading: ~{stats.minutes} min
      </span>

      <span className="separator">|</span>

      <span>
        <Type size={16} strokeWidth={1.75} />
        Chars: {stats.CharCount.toLocaleString()}
      </span>
    </div>
  );
};

export default EditorStatusBar;
