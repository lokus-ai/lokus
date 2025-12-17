import React, { useRef, useEffect, useState } from 'react';
import { X, FileImage, Loader2, AlertCircle, FileQuestion } from 'lucide-react';

/**
 * CanvasPreviewPopup Component
 * Displays a preview of a canvas file on hover
 *
 * Features:
 * - Shows canvas name in header
 * - Displays SVG thumbnail (400x300 max dimensions)
 * - Smart positioning (avoids going off-screen)
 * - Multiple states: loading, success, error, empty, missing
 * - Auto-hide on mouseleave
 * - Themed styling using CSS variables
 */
const CanvasPreviewPopup = ({ canvasName, canvasPath, position, thumbnailUrl, loading, error, onClose }) => {
  const previewRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Smart positioning logic - adjust if goes off-screen
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
  }, [position, loading, thumbnailUrl]); // Re-run when state changes (content height may change)

  // Auto-hide on mouseleave
  const handleMouseLeave = () => {
    onClose();
  };

  if (!canvasName) return null;

  const { x, y } = adjustedPosition || position || { x: 0, y: 0 };

  return (
    <div
      ref={previewRef}
      className="canvas-preview"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 9999,
      }}
      onMouseLeave={handleMouseLeave}
    >
      <div className="canvas-preview-header">
        <div className="canvas-preview-title-container">
          <FileImage size={16} className="canvas-preview-icon" />
          <h3 className="canvas-preview-title">{canvasName}</h3>
        </div>
        <button
          className="canvas-preview-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>
      <div className="canvas-preview-content">
        {loading && (
          <div className="canvas-preview-state">
            <Loader2 size={32} className="canvas-preview-spinner" />
            <p className="canvas-preview-state-text">Loading preview...</p>
          </div>
        )}

        {!loading && !error && thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={`Preview of ${canvasName}`}
            className="canvas-preview-image"
            style={{ maxWidth: '400px', maxHeight: '300px', objectFit: 'contain' }}
          />
        )}

        {!loading && error && (
          <div className="canvas-preview-state">
            <AlertCircle size={32} className="canvas-preview-error-icon" />
            <p className="canvas-preview-state-text">Preview unavailable</p>
          </div>
        )}

        {!loading && !error && !thumbnailUrl && !canvasPath && (
          <div className="canvas-preview-state">
            <FileQuestion size={32} className="canvas-preview-missing-icon" />
            <p className="canvas-preview-state-text">Canvas not found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasPreviewPopup;
