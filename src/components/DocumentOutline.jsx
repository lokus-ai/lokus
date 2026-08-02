import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { setTextSelection } from '../editor/commands/index.js';
import { editorAPI } from '../plugins/api/EditorAPI.js';

/**
 * Document Outline
 *
 * Performance:
 * - Extracts headings from ProseMirror document state (not HTML parsing)
 * - Memoized computation, debounced updates (500ms)
 *
 * Rendering: compact rows styled via .outline-* classes in globals.css
 * (all colors as rgb(var(--token)) — a bare var(--token) silently produces
 * an invalid color with this app's RGB-triplet tokens). The heading the
 * cursor sits in is highlighted as the current section.
 *
 * Receives a raw ProseMirror EditorView as the `editor` prop.
 */
export default function DocumentOutline({ editor }) {
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const updateTimeoutRef = useRef(null);

  // Extract headings from ProseMirror document
  const extractHeadings = useCallback((doc) => {
    if (!doc) return [];

    const headingsList = [];

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

  // Update headings + active section with debounce
  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const doc = editor.state.doc;
      const newHeadings = extractHeadings(doc);

      setHeadings(prevHeadings => {
        if (prevHeadings.length !== newHeadings.length) {
          return newHeadings;
        }
        const hasChanges = newHeadings.some((h, i) =>
          !prevHeadings[i] ||
          prevHeadings[i].text !== h.text ||
          prevHeadings[i].level !== h.level
        );
        return hasChanges ? newHeadings : prevHeadings;
      });

      // Current section = last heading at or above the cursor
      const cursor = editor.state.selection?.from;
      if (typeof cursor === 'number') {
        let current = null;
        for (const h of newHeadings) {
          if (h.pos <= cursor) current = h.id;
          else break;
        }
        setActiveId(current);
      }
    };

    const handleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(updateHeadings, 500);
    };

    updateHeadings();

    // Editor.jsx's dispatchTransaction already calls editorAPI.notifyUpdate()
    // on every user edit, so we listen for that instead of running a
    // MutationObserver over the whole ProseMirror subtree.
    const off = editorAPI.on('editor-update', handleUpdate);

    return () => {
      off();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [editor, extractHeadings]);

  // Jump to heading. setTextSelection dispatches scrollIntoView on the
  // editor's own scroll container — window.scrollTo can't reach it.
  const scrollToHeading = useCallback((pos, id) => {
    if (!editor) return;
    setTextSelection(editor, pos + 1);
    setActiveId(id);
  }, [editor]);

  const headingItems = useMemo(() => {
    // Normalize indentation to the shallowest level present so a doc whose
    // headings start at h2 doesn't render pre-indented.
    const minLevel = Math.min(...headings.map(h => h.level));
    return headings.map((heading) => (
      <div
        key={heading.id}
        className={`outline-item outline-level-${heading.level}${heading.id === activeId ? ' outline-item-active' : ''}`}
        style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 10}px` }}
        onClick={() => scrollToHeading(heading.pos, heading.id)}
        title={heading.text}
      >
        <span className="outline-item-text">{heading.text}</span>
      </div>
    ));
  }, [headings, activeId, scrollToHeading]);

  if (!editor) {
    return <div className="outline-empty">No editor available</div>;
  }

  if (headings.length === 0) {
    return <div className="outline-empty">No headings in document</div>;
  }

  return (
    <div className="outline-panel">
      <div className="outline-header">Outline</div>
      <div className="outline-list">
        {headingItems}
      </div>
    </div>
  );
}
