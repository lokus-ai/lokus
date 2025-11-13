import React from 'react';
import { ImageViewerCore } from './ImageViewerCore';

/**
 * Image viewer component for the tab system
 * Wraps ImageViewerCore for use in editor tabs
 */
export function ImageViewerTab({ imagePath, allImageFiles, onImageChange }) {
  return (
    <ImageViewerCore
      imagePath={imagePath}
      allImageFiles={allImageFiles}
      onImageChange={onImageChange}
      showCloseButton={false}
    />
  );
}
