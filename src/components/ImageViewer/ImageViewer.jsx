import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  Info,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Copy,
  FileText
} from 'lucide-react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
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

  const imageRef = useRef(null);
  const containerRef = useRef(null);

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
        const src = convertFileSrc(file.file_path);
        setImageSrc(src);
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError('Failed to load image');
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

  const handleOpenExternal = async () => {
    try {
      await openShell(file.file_path);
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const handleRevealInFinder = async () => {
    try {
      await invoke('reveal_in_finder', { path: file.file_path });
    } catch (error) {
      console.error('Error revealing file:', error);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.file_path);
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
    <div className="image-viewer">
      {/* Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <h3 className="image-title">{file.metadata?.file_name || 'Image'}</h3>
          {file.metadata?.dimensions && (
            <span className="image-dimensions">
              {file.metadata.dimensions.width} × {file.metadata.dimensions.height}
            </span>
          )}
        </div>

        <div className="toolbar-center">
          {/* Navigation */}
          {allImages.length > 1 && (
            <div className="nav-controls">
              <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                title="Previous Image (←)"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="image-counter">
                {currentIndex + 1} / {allImages.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                title="Next Image (→)"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-right">
          {/* Zoom controls */}
          <div className="zoom-controls">
            <button onClick={handleZoomOut} disabled={zoom <= 0.25} title="Zoom Out (-)">
              <ZoomOut size={18} />
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= 5} title="Zoom In (+)">
              <ZoomIn size={18} />
            </button>
            <button onClick={handleResetZoom} title="Reset Zoom (0)">
              Reset
            </button>
            <button onClick={handleFitToScreen} title="Fit to Screen">
              <Maximize2 size={18} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="action-buttons">
            <button onClick={handleRotate} title="Rotate (R)">
              <RotateCw size={18} />
            </button>
            <button onClick={() => setShowInfo(!showInfo)} title="Info (I)">
              <Info size={18} />
            </button>
            {onInsert && (
              <button onClick={handleInsert} className="insert-btn" title="Insert into Note">
                <FileText size={18} />
                Insert
              </button>
            )}
            <button onClick={handleCopyPath} title="Copy Path">
              <Copy size={18} />
            </button>
            <button onClick={handleRevealInFinder} title="Show in Finder">
              <Download size={18} />
            </button>
            <button onClick={handleOpenExternal} title="Open in Default App">
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      </div>

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
