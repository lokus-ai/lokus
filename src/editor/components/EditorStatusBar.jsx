import React, { useMemo } from "react";
import { FileText, Timer, Type } from "lucide-react"; // Lucide icons

 function countFinder(editor) {
      let nodes = editor?.state.doc?.content?.content;
      // console.log(nodes);
      let WordCount = 0;
      let CharCount = 0;

      nodes?.forEach((node) => { 
        let contentArray = node?.content?.content;

        if(!contentArray && contentArray.length === 0) return;

        let wordPerNodeArray =  contentArray[0]?.text.trim().split(/\s+/);

        WordCount += wordPerNodeArray.filter(w => w.length > 0).length;

        return( 

          CharCount += contentArray.length > 0 ? contentArray[0]?.text?.split(/\s+/)
                  .reduce((accumulator, currentValue) => {
                    return accumulator + currentValue.length;
                  }, 0): 0
          )
      });

      return {WordCount, CharCount}
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
