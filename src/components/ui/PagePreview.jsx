import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * PagePreview Component
 * Displays a preview of a wiki-linked note on hover
 *
 * Phase 1: Basic Implementation
 * - Shows note title
 * - Displays placeholder content
 * - Includes close button
 * - Supports theming
 * - Smart positioning (avoids going off-screen)
 */
const PagePreview = ({ target, position, onClose }) => {
  const previewRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (!previewRef.current || !position) return;

    const preview = previewRef.current;
    const rect = preview.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;
    const offset = 10; // Offset from cursor
    const padding = 16; // Padding from viewport edges

    // Check if preview goes beyond right edge
    if (x + rect.width + padding > viewportWidth) {
      x = viewportWidth - rect.width - padding;
    }

    // Check if preview goes beyond left edge
    if (x < padding) {
      x = padding;
    }

    // Check if preview goes beyond bottom edge
    if (y + rect.height + padding > viewportHeight) {
      // Position above cursor instead
      y = position.y - rect.height - offset;

      // If still goes beyond top edge, align to top with padding
      if (y < padding) {
        y = padding;
      }
    }

    // Check if preview goes beyond top edge
    if (y < padding) {
      y = padding;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  if (!target) return null;

  const { x, y } = adjustedPosition || position || { x: 0, y: 0 };

  return (
    <div
      ref={previewRef}
      className="page-preview"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 9999,
      }}
    >
      <div className="page-preview-header">
        <h3 className="page-preview-title">{target}</h3>
        <button
          className="page-preview-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>
      <div className="page-preview-content">
        <p className="page-preview-placeholder">
          Preview of <strong>{target}</strong>
        </p>
        <p className="page-preview-info">
          Hover over wiki links to see note previews.
        </p>
      </div>
    </div>
  );
};

export default PagePreview;
