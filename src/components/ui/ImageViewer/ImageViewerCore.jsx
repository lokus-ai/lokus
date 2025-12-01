import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Info,
  X
} from 'lucide-react';
import { useImageViewer } from "../../../hooks/useImageViewer";
import { formatFileSize, formatDate } from "../../../utils/imageUtils";

/**
 * Core image viewer component - reusable for tabs, modals, and embedded views
 * @param {Object} props
 * @param {string} props.imagePath - Path to the current image
 * @param {Array} props.allImageFiles - Array of all image files for navigation
 * @param {Function} props.onImageChange - Callback when image changes
 * @param {Function} props.onClose - Optional close callback (for modal mode)
 * @param {boolean} props.showCloseButton - Show close button (for modal mode)
 * @param {string} props.containerClass - Additional container classes
 */
export function ImageViewerCore({
  imagePath,
  allImageFiles,
  onImageChange,
  onClose,
  showCloseButton = false,
  containerClass = ''
}) {
  const {
    imageData,
    imageInfo,
    loading,
    error,
    zoom,
    position,
    isDragging,
    dimensions,
    imageRef,
    zoomIn,
    zoomOut,
    resetZoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    goToNext,
    goToPrev,
  } = useImageViewer(imagePath, allImageFiles, onImageChange);

  const [showInfo, setShowInfo] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        goToPrev();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowInfo(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, zoomIn, zoomOut, resetZoom, onClose]);

  // Prevent context menu on image
  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    const imgElement = imageRef.current;
    if (imgElement) {
      imgElement.addEventListener('contextmenu', preventContextMenu);
      return () => imgElement.removeEventListener('contextmenu', preventContextMenu);
    }
  }, [imageRef]);

  const canNavigate = allImageFiles && allImageFiles.length > 1;

  return (
    <div
      className={`relative w-full h-full bg-app-bg flex overflow-hidden ${containerClass}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Main image area with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image display area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
        >
          {loading && (
            <div className="text-app-muted text-lg">
              Loading...
            </div>
          )}

          {error && (
            <div className="text-app-text text-center">
              <div className="text-xl mb-2">Failed to load image</div>
              <div className="text-sm text-app-muted">{error.toString()}</div>
            </div>
          )}

          {imageData && !loading && (
            <motion.img
              ref={imageRef}
              key={imagePath}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              src={imageData}
              alt={imageInfo?.name || 'Image'}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
              draggable={false}
            />
          )}

          {/* Close button - show on hover (modal mode only) */}
          {showCloseButton && onClose && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: isHovering ? 1 : 0, y: isHovering ? 0 : -10 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-colors"
              title="Close (Esc)"
              style={{ pointerEvents: isHovering ? 'auto' : 'none' }}
            >
              <X size={18} />
            </motion.button>
          )}

          {/* Info button - show on hover */}
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: isHovering ? 1 : 0, y: isHovering ? 0 : -10 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowInfo(!showInfo)}
            className={`absolute top-4 right-4 z-10 p-2 rounded-lg ${
              showInfo
                ? 'bg-purple-500/30 text-purple-400'
                : 'bg-black/50 hover:bg-black/70'
            } text-white backdrop-blur-sm transition-colors`}
            title="Info (I)"
            style={{ pointerEvents: isHovering ? 'auto' : 'none' }}
          >
            <Info size={18} />
          </motion.button>

          {/* Navigation arrows - show on hover */}
          {canNavigate && !loading && (
            <>
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: isHovering ? 1 : 0, x: isHovering ? 0 : -10 }}
                transition={{ duration: 0.2 }}
                onClick={goToPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-colors shadow-lg"
                title="Previous (Shift + ←)"
                style={{ pointerEvents: isHovering ? 'auto' : 'none' }}
              >
                <ChevronLeft size={24} />
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: isHovering ? 1 : 0, x: isHovering ? 0 : 10 }}
                transition={{ duration: 0.2 }}
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-colors shadow-lg"
                title="Next (Shift + →)"
                style={{ pointerEvents: isHovering ? 'auto' : 'none' }}
              >
                <ChevronRight size={24} />
              </motion.button>
            </>
          )}

          {/* Zoom controls - show on hover */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovering ? 1 : 0, y: isHovering ? 0 : 10 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2"
            style={{ pointerEvents: isHovering ? 'auto' : 'none' }}
          >
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 shadow-lg">
              <button
                onClick={zoomOut}
                disabled={zoom <= 0.25}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Zoom Out (-)"
              >
                <ZoomOut size={18} />
              </button>

              <div className="text-white text-sm font-medium min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </div>

              <button
                onClick={zoomIn}
                disabled={zoom >= 5}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Zoom In (+)"
              >
                <ZoomIn size={18} />
              </button>

              <div className="w-px h-6 bg-white/20 mx-1" />

              <button
                onClick={resetZoom}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Reset Zoom (0)"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Info sidebar */}
        {showInfo && imageInfo && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="border-l border-app-border bg-app-panel p-6 overflow-y-auto"
          >
            <div className="text-app-text space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Image Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-app-muted uppercase tracking-wider mb-1">
                    File Name
                  </div>
                  <div className="text-sm break-all">{imageInfo.name}</div>
                </div>

                {dimensions && (
                  <div>
                    <div className="text-xs text-app-muted uppercase tracking-wider mb-1">
                      Dimensions
                    </div>
                    <div className="text-sm">
                      {dimensions.width} × {dimensions.height} pixels
                    </div>
                  </div>
                )}

                {imageInfo.size && (
                  <div>
                    <div className="text-xs text-app-muted uppercase tracking-wider mb-1">
                      File Size
                    </div>
                    <div className="text-sm">{formatFileSize(imageInfo.size)}</div>
                  </div>
                )}

                {imageInfo.modified && (
                  <div>
                    <div className="text-xs text-app-muted uppercase tracking-wider mb-1">
                      Modified
                    </div>
                    <div className="text-sm">{formatDate(imageInfo.modified)}</div>
                  </div>
                )}

                {imageInfo.created && (
                  <div>
                    <div className="text-xs text-app-muted uppercase tracking-wider mb-1">
                      Created
                    </div>
                    <div className="text-sm">{formatDate(imageInfo.created)}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-app-muted uppercase tracking-wider mb-1">
                    Path
                  </div>
                  <div className="text-xs break-all text-app-muted">{imageInfo.path}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
