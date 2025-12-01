import React from 'react';

/**
 * DropZoneOverlay - Shows visual feedback when dragging tabs
 * Displays 4 drop zones (top, bottom, left, right) and center
 * Similar to VSCode's drag-to-split behavior
 */
export default function DropZoneOverlay({ isVisible, onDropZoneHover, onDrop, groupId }) {
  if (!isVisible) return null;

  const dropZones = [
    { id: 'top', position: 'top', style: 'top-0 left-0 right-0 h-1/4' },
    { id: 'bottom', position: 'bottom', style: 'bottom-0 left-0 right-0 h-1/4' },
    { id: 'left', position: 'left', style: 'left-0 top-0 bottom-0 w-1/4' },
    { id: 'right', position: 'right', style: 'right-0 top-0 bottom-0 w-1/4' },
    { id: 'center', position: 'center', style: 'top-1/4 bottom-1/4 left-1/4 right-1/4' },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {dropZones.map((zone) => (
        <div
          key={zone.id}
          className={`absolute ${zone.style} pointer-events-auto`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDropZoneHover && onDropZoneHover({
              groupId,
              position: zone.position,
            });
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop && onDrop({
              groupId,
              position: zone.position,
            });
          }}
        >
          {/* Hover visualization - only show when hovering this specific zone */}
          <div
            className="w-full h-full transition-all duration-150"
            style={{
              backgroundColor: 'transparent',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * DropZoneHighlight - Shows the grey overlay indicating where the split will happen
 */
export function DropZoneHighlight({ dropTarget }) {
  if (!dropTarget) return null;

  const { position } = dropTarget;

  const getHighlightStyle = () => {
    switch (position) {
      case 'top':
        return 'top-0 left-0 right-0 h-1/2';
      case 'bottom':
        return 'bottom-0 left-0 right-0 h-1/2';
      case 'left':
        return 'left-0 top-0 bottom-0 w-1/2';
      case 'right':
        return 'right-0 top-0 bottom-0 w-1/2';
      case 'center':
        return 'inset-0';
      default:
        return '';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      <div
        className={`absolute ${getHighlightStyle()} bg-app-accent/20 border-2 border-app-accent transition-all duration-150`}
        style={{
          backdropFilter: 'blur(2px)',
        }}
      />
    </div>
  );
}
