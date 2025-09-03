import React from 'react';

export const Block = React.forwardRef(({ block, isActive, onInput, onKeyDown }, ref) => {
  const { type, content } = block;

  const renderContent = () => {
    if (isActive) {
      switch (type) {
        case 'h1': return `# ${content}`;
        case 'h2': return `## ${content}`;
        case 'blockquote': return `> ${content}`;
        default: return content;
      }
    }
    return content;
  };

  const handleInput = (e) => {
    onInput(block.id, e.currentTarget.textContent || '');
  };

  const handleKeyDown = (e) => {
    onKeyDown(e, block.id);
  };

  const Tag = type === 'p' ? 'div' : type;
  const className = `outline-none ${type === 'blockquote' ? 'pl-4 border-l-4 border-gray-500 text-gray-500' : ''}`;

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ minHeight: '1em' }}
    >
      {renderContent()}
    </Tag>
  );
});
