import React from 'react';
import { motion } from 'framer-motion';

export default function DropIndicator({ position, visible }) {
  if (!visible || !position) return null;

  const { top, left, width, type } = position;

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0 }}
      transition={{ duration: 0.15 }}
      className="drop-indicator"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: '2px',
        backgroundColor: 'var(--accent-color)',
        pointerEvents: 'none',
        zIndex: 1000,
        boxShadow: '0 0 8px var(--accent-color)',
      }}
    >
      {type === 'folder' && (
        <div
          style={{
            position: 'absolute',
            left: '-4px',
            top: '-4px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-color)',
            boxShadow: '0 0 8px var(--accent-color)',
          }}
        />
      )}
    </motion.div>
  );
}
