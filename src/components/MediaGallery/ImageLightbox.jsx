import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, ExternalLink, Download } from 'lucide-react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
import './ImageLightbox.css';

const ImageLightbox = ({
  file,
  allFiles = [],
  onClose,
  onInsert,
  workspace
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Find current index in allFiles
  const currentIndex = allFiles.findIndex(f => f.id === file.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allFiles.length - 1;

  // Load image
  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use thumbnail if available, otherwise use full image
        const path = file.thumbnail_path || file.file_path;
        const src = convertFileSrc(path);
        setImageSrc(src);
        setLoading(false);
      } catch (err) {
        setError('Failed to load image');
        setLoading(false);
      }
    };

    loadImage();
  }, [file]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious) handlePrevious();
          break;
        case 'ArrowRight':
          if (hasNext) handleNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrevious, hasNext, zoom, rotation]);

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      const prevFile = allFiles[currentIndex - 1];
      // Trigger navigation by finding next image file
      const prevImage = allFiles.slice(0, currentIndex).reverse().find(f => f.media_type === 'Image');
      if (prevImage) {
        onClose(); // Close current
        // Parent will handle opening new lightbox
      }
    }
  }, [currentIndex, allFiles, hasPrevious, onClose]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextImage = allFiles.slice(currentIndex + 1).find(f => f.media_type === 'Image');
      if (nextImage) {
        onClose(); // Close current
        // Parent will handle opening new lightbox
      }
    }
  }, [currentIndex, allFiles, hasNext, onClose]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleOpenExternal = async () => {
    try {
      await openShell(file.file_path);
    } catch (error) {
      // Error opening file in external app
    }
  };

  const handleDownload = async () => {
    try {
      // Reveal in file manager
      await invoke('reveal_in_finder', { path: file.file_path });
    } catch (error) {
      // Error revealing file in finder
    }
  };

  const handleInsert = () => {
    if (onInsert) {
      onInsert(file);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="image-lightbox-overlay" onClick={onClose}>
      <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lightbox-header">
          <div className="lightbox-info">
            <h3>{file.metadata.file_name}</h3>
            <div className="lightbox-meta">
              {file.metadata.dimensions && (
                <span>{file.metadata.dimensions.width} × {file.metadata.dimensions.height}</span>
              )}
              <span>{formatFileSize(file.metadata.file_size)}</span>
            </div>
          </div>
          <button className="lightbox-close" onClick={onClose} title="Close (Esc)">
            <X />
          </button>
        </div>

        {/* Image Container */}
        <div className="lightbox-image-container">
          {loading && (
            <div className="lightbox-loading">
              <div className="spinner"></div>
              <p>Loading image...</p>
            </div>
          )}

          {error && (
            <div className="lightbox-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && imageSrc && (
            <img
              src={imageSrc}
              alt={file.metadata.file_name}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease'
              }}
            />
          )}

          {/* Navigation Arrows */}
          {hasPrevious && (
            <button
              className="lightbox-nav lightbox-nav-prev"
              onClick={handlePrevious}
              title="Previous (←)"
            >
              <ChevronLeft />
            </button>
          )}

          {hasNext && (
            <button
              className="lightbox-nav lightbox-nav-next"
              onClick={handleNext}
              title="Next (→)"
            >
              <ChevronRight />
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="lightbox-controls">
          <div className="lightbox-zoom-controls">
            <button onClick={handleZoomOut} disabled={zoom <= 0.25} title="Zoom Out (-)">
              <ZoomOut />
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= 5} title="Zoom In (+)">
              <ZoomIn />
            </button>
            <button onClick={handleRotate} title="Rotate (R)">
              <RotateCw />
            </button>
          </div>

          <div className="lightbox-actions">
            {onInsert && (
              <button className="lightbox-btn primary" onClick={handleInsert}>
                Insert into Note
              </button>
            )}
            <button className="lightbox-btn" onClick={handleOpenExternal} title="Open in Default App">
              <ExternalLink className="w-4 h-4" />
              Open External
            </button>
            <button className="lightbox-btn" onClick={handleDownload} title="Show in Finder">
              <Download className="w-4 h-4" />
              Show in Finder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageLightbox;
