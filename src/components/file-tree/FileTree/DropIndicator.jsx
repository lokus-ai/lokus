import React from 'react';

/**
 * DropIndicator - Visual line showing where file will be inserted
 *
 * Displays a horizontal accent-colored line when dragging files:
 * - "before" position: Line above target element
 * - "after" position: Line below target element
 * - "inside" position: No line (folder highlight used instead)
 *
 * @param {Object} position - Drop position object { position, targetPath, targetEntry }
 * @param {string} targetPath - Path of target element
 * @param {React.RefObject} fileTreeRef - Reference to file tree container
 */
export default function DropIndicator({ position, targetPath, fileTreeRef }) {
  if (!position || !targetPath) return null;

  // Don't show line for "inside" drops (folder highlight is used instead)
  if (position.position === 'inside') return null;

  // Find the target element in the DOM
  const targetElement = fileTreeRef.current?.querySelector(`[data-path="${targetPath}"]`);
  if (!targetElement) return null;

  const rect = targetElement.getBoundingClientRect();
  const containerRect = fileTreeRef.current?.getBoundingClientRect();
  if (!containerRect) return null;

  // Calculate line position relative to container
  let style = {
    position: 'absolute',
    left: '0',
    right: '0',
    height: '2px',
    backgroundColor: 'rgb(var(--accent))',
    pointerEvents: 'none',
    zIndex: 100,
    boxShadow: '0 0 4px rgba(var(--accent-rgb), 0.5)',
    transition: 'top 100ms ease-out',
  };

  if (position.position === 'before') {
    style.top = `${rect.top - containerRect.top}px`;
  } else if (position.position === 'after') {
    style.top = `${rect.bottom - containerRect.top}px`;
  }

  return <div style={style} className="drop-indicator" />;
}
