import React, { useMemo } from "react";
import { FileText, Timer, Type } from "lucide-react"; // Lucide icons

function countFinder(editor) {

  const nodes = editor?.state.doc?.content?.content;

  let wordCount = 0;
  let charCount = 0;

  const wordRegex =
    /^(?:\(?\+?\d{1,3}\)?[ -]?)?(?:\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4})$|^[\w@.'’+-]+$/;


  console.log("nodes: ", nodes);
  
  nodes?.forEach((node) => {
    const contentArray = node?.content?.content;

    // Skip empty nodes
    if (!contentArray || contentArray.length === 0) return;

  console.log("contentArray: ", contentArray);

  // const text = contentArray[0]?.text || "";

    const text = contentArray.map(seg => seg.text || "").join(" ");

    // Count characters including everything
    charCount += text.length;

    // Split into words and filter out words without alphanumeric characters
 const words = text
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/^[^\w@]+|[^\w@]+$/g, "")) // remove punctuation from edges
        .filter((w) => w.length > 0)
        .filter((word) => wordRegex.test(word));

console.log(`${text} | ${words.join("-")} | ${words.length}`);
    wordCount += words.length;
  });

  return { wordCount, charCount };
}

const EditorStatusBar = ({ editor, readingSpeed = 200 }) => {

  

  const stats = useMemo(() => {
    if (!editor) return null;

    const {wordCount, charCount} = countFinder(editor);
  
    const minutes = wordCount ? Math.max(1, Math.ceil(wordCount / readingSpeed)) : 0;

    return {wordCount, charCount, minutes };
    
  }, [editor?.state?.doc, readingSpeed]);

  if (!stats) return null;

  return (
    <div className="editor-status-bar">
      <span>
        <FileText size={16} strokeWidth={1.75} />
        Words: {stats.wordCount.toLocaleString()}
      </span>

      <span className="separator">|</span>

      <span>
        <Timer size={16} strokeWidth={1.75} />
        Reading: ~{stats.minutes} min
      </span>

      <span className="separator">|</span>

      <span>
        <Type size={16} strokeWidth={1.75} />
        Chars: {stats.charCount.toLocaleString()}
      </span>
    </div>
  );
};

export default EditorStatusBar;
