import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Info,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { readFile } from '@tauri-apps/plugin-fs';
import { imageDataToDataURL } from '../../utils/mimeTypes.js';
import './ImageViewer.css';

const ImageViewer = ({ file, allImages = [], onNavigate, onInsert, workspace }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState(true);

  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const hideControlsTimer = useRef(null);

  // Find current index in allImages
  const currentIndex = allImages.findIndex(img => img.file_path === file.file_path);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allImages.length - 1;

  // Load image
  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      setError(null);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });

      try {
        // Read the file as binary data
        const imageData = await readFile(file.file_path);

        // Convert to data URL
        const dataUrl = imageDataToDataURL(imageData, file.file_path);

        setImageSrc(dataUrl);
        setLoading(false);
      } catch (err) {
        setError('Failed to load image: ' + err.message);
        setLoading(false);
      }
    };

    if (file) {
      loadImage();
    }
  }, [file]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere with text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
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
        case '0':
          handleResetZoom();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
        case 'i':
        case 'I':
          setShowInfo(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrevious, hasNext, zoom]);

  const handlePrevious = useCallback(() => {
    if (hasPrevious && onNavigate) {
      onNavigate(allImages[currentIndex - 1]);
    }
  }, [currentIndex, allImages, hasPrevious, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(allImages[currentIndex + 1]);
    }
  }, [currentIndex, allImages, hasNext, onNavigate]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFitToScreen = () => {
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;

      const imgRatio = img.naturalWidth / img.naturalHeight;
      const containerRatio = container.clientWidth / container.clientHeight;

      if (imgRatio > containerRatio) {
        // Image is wider
        setZoom(container.clientWidth / img.naturalWidth);
      } else {
        // Image is taller
        setZoom(container.clientHeight / img.naturalHeight);
      }

      setPan({ x: 0, y: 0 });
    }
  };

  const handleInsert = () => {
    if (onInsert) {
      onInsert(file);
    }
  };

  // Mouse drag to pan
  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.25, Math.min(5, prev + delta)));
    }
  };

  // Auto-hide controls on mouse movement
  const handleMouseMoveContainer = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (!file) {
    return (
      <div className="image-viewer">
        <div className="viewer-error">
          <Info size={48} />
          <p>No image selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="image-viewer" onMouseMove={handleMouseMoveContainer}>
      {/* Top-right controls */}
      <div className={`controls-top-right ${showControls ? 'visible' : ''}`}>
        <button onClick={() => setShowInfo(!showInfo)} title="Info (I)" aria-label="Toggle image information">
          <Info size={18} />
        </button>
        {onInsert && (
          <button onClick={handleInsert} className="insert-btn" title="Insert into Note" aria-label="Insert image into note">
            <FileText size={16} />
          </button>
        )}
      </div>

      {/* Bottom-right zoom controls */}
      <div className={`controls-bottom-right ${showControls ? 'visible' : ''}`}>
        <button onClick={handleZoomOut} disabled={zoom <= 0.25} title="Zoom Out (-)" aria-label="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} disabled={zoom >= 5} title="Zoom In (+)" aria-label="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button onClick={handleRotate} title="Rotate (R)" aria-label="Rotate image">
          <RotateCw size={16} />
        </button>
      </div>

      {/* Navigation arrows */}
      {allImages.length > 1 && hasPrevious && (
        <button
          className={`nav-arrow nav-left ${showControls ? 'visible' : ''}`}
          onClick={handlePrevious}
          title="Previous (←)"
          aria-label="Previous image"
        >
          <ChevronLeft size={32} />
        </button>
      )}
      {allImages.length > 1 && hasNext && (
        <button
          className={`nav-arrow nav-right ${showControls ? 'visible' : ''}`}
          onClick={handleNext}
          title="Next (→)"
          aria-label="Next image"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Image Counter */}
      {allImages.length > 1 && (
        <div className={`image-counter ${showControls ? 'visible' : ''}`}>
          {currentIndex + 1} / {allImages.length}
        </div>
      )}

      {/* Image Container */}
      <div
        ref={containerRef}
        className="viewer-container"
        onWheel={handleWheel}
      >
        {loading && (
          <div className="viewer-loading">
            <div className="spinner"></div>
            <p>Loading image...</p>
          </div>
        )}

        {error && (
          <div className="viewer-error">
            <Info size={48} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && imageSrc && (
          <div
            className={`image-wrapper ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt={file.metadata?.file_name}
              onError={(e) => {
                setError('Failed to load image file');
                setLoading(false);
              }}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Info Panel */}
      {showInfo && file.metadata && (
        <div className="info-panel">
          <h4>Image Information</h4>
          <dl>
            <dt>File Name:</dt>
            <dd>{file.metadata.file_name}</dd>

            <dt>Size:</dt>
            <dd>{formatFileSize(file.metadata.file_size)}</dd>

            {file.metadata.dimensions && (
              <>
                <dt>Dimensions:</dt>
                <dd>{file.metadata.dimensions.width} × {file.metadata.dimensions.height} px</dd>
              </>
            )}

            <dt>Type:</dt>
            <dd>{file.metadata.mime_type}</dd>

            <dt>Modified:</dt>
            <dd>{formatDate(file.metadata.modified_at)}</dd>

            <dt>Path:</dt>
            <dd className="path">{file.file_path}</dd>
          </dl>
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
