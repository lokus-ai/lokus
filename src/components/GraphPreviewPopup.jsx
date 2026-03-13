import React, { useRef, useEffect, useState } from 'react';
import { X, LineChart, Loader2, AlertCircle, FileQuestion } from 'lucide-react';

/**
 * GraphPreviewPopup Component
 * Displays a preview of a .graph file on hover.
 * Follows the same pattern as CanvasPreviewPopup.
 */
const GraphPreviewPopup = ({ graphName, graphPath, position, thumbnailUrl, loading, error, onClose }) => {
  const previewRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (!previewRef.current || !position) return;

    const preview = previewRef.current;
    const rect = preview.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;
    const offset = 10;
    const padding = 16;

    if (x + rect.width + padding > viewportWidth) {
      x = viewportWidth - rect.width - padding;
    }
    if (x < padding) x = padding;

    if (y + rect.height + padding > viewportHeight) {
      y = position.y - rect.height - offset;
      if (y < padding) y = padding;
    }
    if (y < padding) y = padding;

    setAdjustedPosition({ x, y });
  }, [position, loading, thumbnailUrl]);

  if (!graphName) return null;

  const { x, y } = adjustedPosition || position || { x: 0, y: 0 };

  return (
    <div
      ref={previewRef}
      className="graph-preview"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 9999,
        minWidth: 200,
        maxWidth: 420,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        background: 'rgb(var(--panel))',
        border: '1px solid rgb(var(--border))',
      }}
      onMouseLeave={onClose}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgb(var(--border) / 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <LineChart size={16} style={{ color: 'rgb(var(--accent))', flexShrink: 0 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'rgb(var(--text))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {graphName}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close preview"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'rgb(var(--text) / 0.5)',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: 4 }}>
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: 8,
          }}>
            <Loader2 size={24} style={{ color: 'rgb(var(--text) / 0.3)', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'rgb(var(--text) / 0.4)' }}>Loading preview...</span>
          </div>
        )}

        {!loading && !error && thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={`Preview of ${graphName}`}
            style={{
              display: 'block',
              maxWidth: '400px',
              maxHeight: '300px',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
        )}

        {!loading && error && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: 8,
          }}>
            <AlertCircle size={24} style={{ color: '#ff6b6b' }} />
            <span style={{ fontSize: 12, color: 'rgb(var(--text) / 0.4)' }}>Preview unavailable</span>
          </div>
        )}

        {!loading && !error && !thumbnailUrl && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: 8,
          }}>
            <FileQuestion size={24} style={{ color: 'rgb(var(--text) / 0.3)' }} />
            <span style={{ fontSize: 12, color: 'rgb(var(--text) / 0.4)' }}>Graph not found</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphPreviewPopup;
