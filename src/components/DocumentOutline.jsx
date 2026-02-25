import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { setTextSelection } from '../editor/commands/index.js';

/**
 * Efficient Document Outline Component
 *
 * Performance optimizations:
 * - Extracts headings from ProseMirror document state (not HTML parsing)
 * - Memoized computation
 * - Debounced updates (500ms)
 * - Shallow rendering
 *
 * Receives a raw ProseMirror EditorView as the `editor` prop.
 */
export default function DocumentOutline({ editor }) {
  const [headings, setHeadings] = useState([]);
  const updateTimeoutRef = useRef(null);

  // Extract headings from ProseMirror document
  const extractHeadings = useCallback((doc) => {
    if (!doc) return [];

    const headingsList = [];

    // Traverse ProseMirror document nodes
    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level;
        const text = node.textContent;

        if (text.trim()) {
          headingsList.push({
            level,
            text: text.trim(),
            pos, // Position in document for scrolling
            id: `heading-${pos}` // Unique ID
          });
        }
      }
    });

    return headingsList;
  }, []);

  // Update headings with debounce (only after user stops typing)
  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const doc = editor.state.doc;
      const newHeadings = extractHeadings(doc);

      // Only update if headings actually changed (shallow comparison)
      setHeadings(prevHeadings => {
        if (prevHeadings.length !== newHeadings.length) {
          return newHeadings;
        }

        // Check if any heading changed
        const hasChanges = newHeadings.some((h, i) =>
          !prevHeadings[i] ||
          prevHeadings[i].text !== h.text ||
          prevHeadings[i].level !== h.level
        );

        return hasChanges ? newHeadings : prevHeadings;
      });
    };

    // Debounced update handler
    const handleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        updateHeadings();
      }, 500);
    };

    // Initial extraction
    updateHeadings();

    // Observe DOM mutations to detect editor content changes
    // (PM EditorView does not have a TipTap-style .on('update') API)
    const observer = new MutationObserver(handleUpdate);
    if (editor.dom) {
      observer.observe(editor.dom, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      observer.disconnect();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [editor, extractHeadings]);

  // Scroll to heading when clicked
  const scrollToHeading = useCallback((pos) => {
    if (!editor) return;

    // Focus editor and set cursor position via PM command helper
    setTextSelection(editor, pos);

    // Scroll into view
    const coords = editor.coordsAtPos(pos);

    if (coords) {
      window.scrollTo({
        top: coords.top - 100, // Offset for better visibility
        behavior: 'smooth'
      });
    }
  }, [editor]);

  // Memoized heading items
  const headingItems = useMemo(() => {
    return headings.map((heading) => (
      <div
        key={heading.id}
        className="outline-item"
        style={{
          cursor: 'pointer',
          padding: '4px 8px',
          paddingLeft: `${(heading.level - 1) * 12 + 8}px`,
          fontSize: heading.level === 1 ? '14px' : '13px',
          fontWeight: heading.level === 1 ? '600' : '400',
          color: 'var(--text)',
          opacity: heading.level === 1 ? 1 : 0.8,
          borderLeft: `2px solid ${heading.level === 1 ? 'var(--accent)' : 'transparent'}`,
          transition: 'all 0.15s ease'
        }}
        onClick={() => scrollToHeading(heading.pos)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--panel)';
          e.currentTarget.style.borderLeftColor = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderLeftColor = heading.level === 1 ? 'var(--accent)' : 'transparent';
        }}
      >
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={heading.text}
        >
          {heading.text}
        </div>
      </div>
    ));
  }, [headings, scrollToHeading]);

  if (!editor) {
    return (
      <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '13px' }}>
        No editor available
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '13px' }}>
        No headings in document
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        fontSize: '13px'
      }}
    >
      <div
        style={{
          padding: '12px 8px 8px 8px',
          fontWeight: '600',
          fontSize: '12px',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          letterSpacing: '0.5px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        Outline
      </div>
      <div style={{ padding: '8px 0' }}>
        {headingItems}
      </div>
    </div>
  );
}
