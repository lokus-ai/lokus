import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, AlignHorizontalJustifyStart, AlignVerticalJustifyStart, Maximize } from 'lucide-react';

/**
 * Fullscreen viewer modal for Mermaid diagrams
 * Supports smart auto-fit, zoom, and pan functionality
 */
export function MermaidViewerModal({ isOpen, svgContent, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [autoFitZoom, setAutoFitZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const svgWrapperRef = useRef(null);

  // Calculate smart auto-fit zoom when modal opens
  useLayoutEffect(() => {
    if (!isOpen || !svgContent || !containerRef.current) return;

    // Wait for SVG to render
    setTimeout(() => {
      const svgElement = containerRef.current?.querySelector('svg');
      if (!svgElement) return;

      // Get SVG dimensions
      const bbox = svgElement.getBBox();
      const svgWidth = bbox.width;
      const svgHeight = bbox.height;

      // Get viewport dimensions (90% to leave margins)
      const viewportWidth = window.innerWidth * 0.9;
      const viewportHeight = window.innerHeight * 0.9;

      // Calculate scale to fit
      const scaleX = viewportWidth / svgWidth;
      const scaleY = viewportHeight / svgHeight;

      // Use the smaller scale to ensure it fits both dimensions
      // Cap at 2x to avoid making small diagrams too large
      const optimalZoom = Math.min(scaleX, scaleY, 2);

      // Set auto-fit zoom (minimum 0.5x for very large diagrams)
      const finalZoom = Math.max(optimalZoom, 0.5);

      setAutoFitZoom(finalZoom);
      setZoom(finalZoom);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);

      if (import.meta.env.DEV) {
      }
    }, 50);
  }, [isOpen, svgContent]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(autoFitZoom);
    setPosition({ x: 0, y: 0 });
  }, [autoFitZoom]);

  // Fit controls
  const fitWidth = useCallback(() => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const bbox = svgElement.getBBox();
    const viewportWidth = window.innerWidth * 0.9;
    const scaleX = viewportWidth / bbox.width;

    setZoom(Math.max(scaleX, 0.25));
    setPosition({ x: 0, y: 0 });
  }, []);

  const fitHeight = useCallback(() => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const bbox = svgElement.getBBox();
    const viewportHeight = window.innerHeight * 0.9;
    const scaleY = viewportHeight / bbox.height;

    setZoom(Math.max(scaleY, 0.25));
    setPosition({ x: 0, y: 0 });
  }, []);

  const fitScreen = useCallback(() => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const bbox = svgElement.getBBox();
    const viewportWidth = window.innerWidth * 0.9;
    const viewportHeight = window.innerHeight * 0.9;

    const scaleX = viewportWidth / bbox.width;
    const scaleY = viewportHeight / bbox.height;
    const scale = Math.min(scaleX, scaleY);

    setZoom(Math.max(scale, 0.25));
    setPosition({ x: 0, y: 0 });
  }, []);

  // Pan controls
  const handleMouseDown = useCallback((e) => {
    // Always allow panning in modal (even at 1x zoom for large diagrams)
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.25, Math.min(prev + delta, 5)));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
      }}
      onClick={onClose}
    >
      {/* Control bar - Top Right */}
      <div
        className="absolute top-4 right-4 flex gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={zoomOut}
          className="p-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <button
          onClick={resetZoom}
          className="p-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Reset to auto-fit"
        >
          <Maximize2 className="w-5 h-5" />
        </button>

        <button
          onClick={zoomIn}
          className="p-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div style={{ width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

        <button
          onClick={onClose}
          className="p-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fit controls - Top Left (below zoom indicator) */}
      <div
        className="absolute top-20 left-4 flex flex-col gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={fitWidth}
          className="p-2 rounded-lg flex items-center gap-2 text-sm"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            minWidth: '120px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Fit to width"
        >
          <AlignHorizontalJustifyStart className="w-4 h-4" />
          <span>Fit Width</span>
        </button>

        <button
          onClick={fitHeight}
          className="p-2 rounded-lg flex items-center gap-2 text-sm"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            minWidth: '120px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Fit to height"
        >
          <AlignVerticalJustifyStart className="w-4 h-4" />
          <span>Fit Height</span>
        </button>

        <button
          onClick={fitScreen}
          className="p-2 rounded-lg flex items-center gap-2 text-sm"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            minWidth: '120px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Fit to screen"
        >
          <Maximize className="w-4 h-4" />
          <span>Fit Screen</span>
        </button>
      </div>

      {/* Zoom indicator */}
      <div
        className="absolute top-4 left-4 px-3 py-2 rounded-lg text-sm font-medium"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'white',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {Math.round(zoom * 100)}%
      </div>

      {/* Diagram container */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          ref={svgWrapperRef}
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Instructions */}
      <div
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        Drag to pan • Scroll to zoom • ESC to close
      </div>
    </div>
  );
}
