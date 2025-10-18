import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Hash } from 'lucide-react';

const TagSuggestionList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.tag, label: item.tag });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '12px',
        fontSize: '13px',
        color: 'var(--muted)',
        minWidth: '200px'
      }}>
        No tags found
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      overflow: 'hidden',
      minWidth: '250px',
      maxWidth: '400px'
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: '600',
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--panel)'
      }}>
        Tag Suggestions
      </div>

      {/* Tag List */}
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {props.items.map((item, index) => (
          <button
            key={item.tag}
            onClick={() => selectItem(index)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              border: 'none',
              backgroundColor: index === selectedIndex ? 'var(--panel)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.15s ease',
              borderLeft: `2px solid ${index === selectedIndex ? 'var(--accent)' : 'transparent'}`
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {/* Hash Icon */}
            <Hash
              size={14}
              style={{
                color: 'var(--muted)',
                flexShrink: 0
              }}
            />

            {/* Tag Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--text)',
                fontWeight: index === selectedIndex ? '500' : '400',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.tag}
              </div>

              {/* Count Badge */}
              {item.count > 0 && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  marginTop: '2px'
                }}>
                  Used in {item.count} note{item.count > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Relevance Indicator (for search results) */}
            {item.relevance && (
              <div style={{
                fontSize: '11px',
                color: 'var(--muted)',
                backgroundColor: 'var(--border)',
                padding: '2px 6px',
                borderRadius: '10px'
              }}>
                {item.count}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Footer Hint */}
      <div style={{
        padding: '6px 12px',
        fontSize: '10px',
        color: 'var(--muted)',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--panel)',
        display: 'flex',
        gap: '12px'
      }}>
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Cancel</span>
      </div>
    </div>
  );
});

TagSuggestionList.displayName = 'TagSuggestionList';

export default TagSuggestionList;
