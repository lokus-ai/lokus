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
const CanvasPreviewPopup = ({ canvasName, canvasPath, position, onClose }) => {
  const previewRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [previewState, setPreviewState] = useState('loading'); // loading, success, error, empty, missing
  const [svgContent, setSvgContent] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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
  }, [position, previewState]); // Re-run when state changes (content height may change)

  // Fetch canvas preview
  useEffect(() => {
    if (!canvasPath) {
      setPreviewState('missing');
      return;
    }

    const fetchCanvasPreview = async () => {
      try {
        setPreviewState('loading');

        // TODO: Replace with actual canvas preview generator when available
        // For now, simulate loading and show placeholder
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if canvas file exists
        // const exists = await window.__TAURI__.fs.exists(canvasPath);
        // if (!exists) {
        //   setPreviewState('missing');
        //   return;
        // }

        // Load canvas data and generate preview
        // const canvasData = await window.__TAURI__.fs.readTextFile(canvasPath);
        // const preview = await generateCanvasPreview(canvasData);

        // Simulate different states for development
        const random = Math.random();
        if (random < 0.2) {
          setPreviewState('empty');
        } else if (random < 0.3) {
          setPreviewState('error');
          setErrorMessage('Failed to generate preview');
        } else {
          // Generate placeholder SVG for now
          const placeholderSvg = `
            <svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="300" fill="#f5f5f5"/>
              <text x="200" y="150" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">
                Canvas Preview
              </text>
              <text x="200" y="180" font-family="Arial" font-size="14" fill="#999" text-anchor="middle">
                ${canvasName}
              </text>
            </svg>
          `.trim();
          setSvgContent(placeholderSvg);
          setPreviewState('success');
        }
      } catch (error) {
        console.error('Error loading canvas preview:', error);
        setPreviewState('error');
        setErrorMessage(error.message || 'Failed to load preview');
      }
    };

    fetchCanvasPreview();
  }, [canvasPath, canvasName]);

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
        {previewState === 'loading' && (
          <div className="canvas-preview-state">
            <Loader2 size={32} className="canvas-preview-spinner" />
            <p className="canvas-preview-state-text">Loading preview...</p>
          </div>
        )}

        {previewState === 'success' && svgContent && (
          <div
            className="canvas-preview-svg"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}

        {previewState === 'error' && (
          <div className="canvas-preview-state">
            <AlertCircle size={32} className="canvas-preview-error-icon" />
            <p className="canvas-preview-state-text">Preview unavailable</p>
            {errorMessage && (
              <p className="canvas-preview-error-message">{errorMessage}</p>
            )}
          </div>
        )}

        {previewState === 'empty' && (
          <div className="canvas-preview-state">
            <FileImage size={32} className="canvas-preview-empty-icon" />
            <p className="canvas-preview-state-text">Empty Canvas</p>
            <p className="canvas-preview-info">
              This canvas has no content yet.
            </p>
          </div>
        )}

        {previewState === 'missing' && (
          <div className="canvas-preview-state">
            <FileQuestion size={32} className="canvas-preview-missing-icon" />
            <p className="canvas-preview-state-text">Canvas not found</p>
            <p className="canvas-preview-info">
              The canvas file could not be located.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasPreviewPopup;
