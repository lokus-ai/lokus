import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Lightbulb } from 'lucide-react';

const PluginCompletionList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
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
        minWidth: '300px'
      }}>
        No completions available
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
      minWidth: '300px',
      maxWidth: '450px'
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
        Plugin Completions
      </div>

      {/* Completion List */}
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {props.items.map((item, index) => {
          const label = typeof item.label === 'string' ? item.label : item.label?.label || '';
          const detail = typeof item.label === 'object' ? item.label?.detail : item.detail;
          const description = item.documentation?.value || item.detail;

          return (
            <button
              key={`${item._providerId}-${index}`}
              onClick={() => selectItem(index)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: index === selectedIndex ? 'var(--panel)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                transition: 'background-color 0.15s ease',
                borderLeft: `2px solid ${index === selectedIndex ? 'var(--accent)' : 'transparent'}`
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {/* Icon */}
              <Lightbulb
                size={14}
                style={{
                  color: 'var(--muted)',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              />

              {/* Completion Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Label */}
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text)',
                  fontWeight: index === selectedIndex ? '500' : '400',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono, monospace)'
                }}>
                  {label}
                  {detail && (
                    <span style={{
                      marginLeft: '6px',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      fontWeight: '400'
                    }}>
                      {detail}
                    </span>
                  )}
                </div>

                {/* Description */}
                {description && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--muted)',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {description}
                  </div>
                )}
              </div>

              {/* Kind Badge */}
              {item.kind && (
                <div style={{
                  fontSize: '10px',
                  color: 'var(--muted)',
                  backgroundColor: 'var(--border)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flexShrink: 0
                }}>
                  {getKindLabel(item.kind)}
                </div>
              )}
            </button>
          );
        })}
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

// Helper to convert CompletionItemKind enum to readable label
function getKindLabel(kind) {
  const kinds = {
    1: 'text',
    2: 'method',
    3: 'function',
    4: 'constructor',
    5: 'field',
    6: 'variable',
    7: 'class',
    8: 'interface',
    9: 'module',
    10: 'property',
    11: 'unit',
    12: 'value',
    13: 'enum',
    14: 'keyword',
    15: 'snippet',
    16: 'color',
    17: 'file',
    18: 'reference',
    19: 'folder',
    20: 'enum-member',
    21: 'constant',
    22: 'struct',
    23: 'event',
    24: 'operator',
    25: 'type'
  };
  return kinds[kind] || 'item';
}

PluginCompletionList.displayName = 'PluginCompletionList';

export default PluginCompletionList;
