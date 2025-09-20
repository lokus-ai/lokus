import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GripVertical, GripHorizontal } from 'lucide-react';

const PaneResizer = ({ orientation = 'vertical', onResize, initialSize = 50 }) => {
  const resizerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);
  const [currentSize, setCurrentSize] = useState(initialSize);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    
    const rect = resizerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (orientation === 'vertical') {
      setStartPos(e.clientX - rect.left);
    } else {
      setStartPos(e.clientY - rect.top);
    }

    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
  }, [orientation]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !resizerRef.current) return;

    const parentElement = resizerRef.current.parentElement;
    if (!parentElement) return;

    const parentRect = parentElement.getBoundingClientRect();
    let newSize;

    if (orientation === 'vertical') {
      const totalWidth = parentRect.width;
      const mouseX = e.clientX - parentRect.left;
      newSize = Math.max(10, Math.min(90, (mouseX / totalWidth) * 100));
    } else {
      const totalHeight = parentRect.height;
      const mouseY = e.clientY - parentRect.top;
      newSize = Math.max(10, Math.min(90, (mouseY / totalHeight) * 100));
    }

    setCurrentSize(newSize);
    onResize(newSize);
  }, [isDragging, orientation, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Restore default cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  // Handle double-click to reset to 50/50
  const handleDoubleClick = useCallback(() => {
    setCurrentSize(50);
    onResize(50);
  }, [onResize]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!resizerRef.current) return;

    let delta = 0;
    const step = e.shiftKey ? 10 : 5; // Larger steps with Shift

    switch (e.key) {
      case 'ArrowLeft':
        if (orientation === 'vertical') delta = -step;
        break;
      case 'ArrowRight':
        if (orientation === 'vertical') delta = step;
        break;
      case 'ArrowUp':
        if (orientation === 'horizontal') delta = -step;
        break;
      case 'ArrowDown':
        if (orientation === 'horizontal') delta = step;
        break;
      case 'Home':
        setCurrentSize(25);
        onResize(25);
        return;
      case 'End':
        setCurrentSize(75);
        onResize(75);
        return;
      case 'Enter':
      case ' ':
        setCurrentSize(50);
        onResize(50);
        return;
      default:
        return;
    }

    if (delta !== 0) {
      e.preventDefault();
      const newSize = Math.max(10, Math.min(90, currentSize + delta));
      setCurrentSize(newSize);
      onResize(newSize);
    }
  }, [orientation, currentSize, onResize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  const resizerStyle = {
    position: 'relative',
    backgroundColor: isDragging ? 'var(--app-accent)' : 'var(--app-border)',
    cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
    transition: isDragging ? 'none' : 'background-color 0.2s ease',
    zIndex: 10,
    ...(orientation === 'vertical' 
      ? {
          width: '4px',
          height: '100%',
          minWidth: '4px',
          maxWidth: '4px',
        }
      : {
          height: '4px',
          width: '100%',
          minHeight: '4px',
          maxHeight: '4px',
        }
    )
  };

  const gripStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: isDragging ? 'white' : 'var(--app-muted)',
    opacity: isDragging ? 1 : 0.6,
    transition: 'opacity 0.2s ease',
    pointerEvents: 'none',
  };

  return (
    <div
      ref={resizerRef}
      style={resizerStyle}
      className={`pane-resizer ${orientation} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation={orientation}
      aria-label={`Resize ${orientation === 'vertical' ? 'horizontally' : 'vertically'}`}
      aria-valuenow={Math.round(currentSize)}
      aria-valuemin={10}
      aria-valuemax={90}
      title={`Double-click to reset • Arrow keys to adjust • Shift+Arrow for larger steps`}
    >
      {/* Visual grip indicator */}
      <div style={gripStyle}>
        {orientation === 'vertical' ? (
          <GripVertical size={12} />
        ) : (
          <GripHorizontal size={12} />
        )}
      </div>
      
      {/* Hover area for easier interaction */}
      <div
        style={{
          position: 'absolute',
          top: orientation === 'vertical' ? '0' : '-2px',
          left: orientation === 'vertical' ? '-2px' : '0',
          right: orientation === 'vertical' ? '-2px' : '0',
          bottom: orientation === 'vertical' ? '0' : '-2px',
          ...(orientation === 'vertical' 
            ? { width: '8px', height: '100%' }
            : { width: '100%', height: '8px' }
          )
        }}
      />
    </div>
  );
};

export default PaneResizer;