import React, { useState, useRef, useEffect } from 'react';
import { useEditorEngine } from './useEditorEngine';
import { Block } from './Block';

export const Editor = ({ content, onContentChange }) => {
  const { blocks, updateBlock, getFullContent } = useEditorEngine(content);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const blockRefs = useRef({});

  useEffect(() => {
    onContentChange(getFullContent());
  }, [blocks, getFullContent, onContentChange]);

  const handleInput = (id, newContent) => {
    updateBlock(id, newContent);
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Logic to add a new block will go here
    }
  };

  return (
    <div className="space-y-2">
      {blocks.map(block => (
        <Block
          key={block.id}
          ref={el => blockRefs.current[block.id] = el}
          block={block}
          isActive={block.id === activeBlockId}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
      ))}
    </div>
  );
};
