import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageViewerCore } from "./ImageViewerCore";

/**
 * Full-screen modal wrapper for image viewing
 * Used when clicking embedded images in markdown
 */
export function ImageViewerModal({ isOpen, imagePath, allImageFiles, onClose }) {
  if (!isOpen || !imagePath) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md"
        onClick={(e) => {
          // Close if clicking the backdrop
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <ImageViewerCore
          imagePath={imagePath}
          allImageFiles={allImageFiles}
          onClose={onClose}
          showCloseButton={true}
        />
      </motion.div>
    </AnimatePresence>
  );
}
