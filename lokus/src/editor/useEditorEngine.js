import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const parseLine = (text) => {
  if (text.startsWith('## ')) return { type: 'h2', content: text.substring(3) };
  if (text.startsWith('# ')) return { type: 'h1', content: text.substring(2) };
  if (text.startsWith('> ')) return { type: 'blockquote', content: text.substring(2) };
  // Add more rules here, e.g., for task lists, etc.
  return { type: 'p', content: text };
};

const getRawText = (block) => {
  switch (block.type) {
    case 'h1': return `# ${block.content}`;
    case 'h2': return `## ${block.content}`;
    case 'blockquote': return `> ${block.content}`;
    default: return block.content;
  }
};

export const useEditorEngine = (initialContent = "") => {
  const [blocks, setBlocks] = useState(() => 
    initialContent.split('\n').map(line => ({
      id: uuidv4(),
      ...parseLine(line)
    }))
  );

  const updateBlock = useCallback((id, newContent) => {
    setBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      const index = newBlocks.findIndex(b => b.id === id);
      if (index !== -1) {
        const { type } = parseLine(newContent);
        newBlocks[index] = { ...newBlocks[index], type, content: newContent };
      }
      return newBlocks;
    });
  }, []);
  
  const getFullContent = useCallback(() => {
    return blocks.map(getRawText).join('\n');
  }, [blocks]);

  return { blocks, updateBlock, getFullContent };
};
