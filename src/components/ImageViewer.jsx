import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Info
} from 'lucide-react';
import { useImageViewer } from '../hooks/useImageViewer';
import { formatFileSize, formatDate } from '../utils/imageUtils';
import { invoke } from '@tauri-apps/api/core';

/**
 * Modern, macOS Photos-style image viewer component
 */
export function ImageViewer({ imagePath, allImageFiles, onClose }) {
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
    fitToScreen,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    goToNext,
    goToPrev,
  } = useImageViewer(imagePath, allImageFiles);

  const [showInfo, setShowInfo] = React.useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === '=' || e.key === '+') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      } else if (e.key === 'i' || e.key === 'I') {
        setShowInfo(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNext, goToPrev, zoomIn, zoomOut, resetZoom]);

  // Prevent context menu on image
  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    const imgElement = imageRef.current;
    if (imgElement) {
      imgElement.addEventListener('contextmenu', preventContextMenu);
      return () => imgElement.removeEventListener('contextmenu', preventContextMenu);
    }
  }, [imageRef]);

  const handleDownload = async () => {
    if (!imageInfo) return;
    try {
      await invoke('reveal_in_finder', { path: imageInfo.path });
    } catch (err) {
      console.error('Failed to reveal file:', err);
    }
  };

  const handleOpenExternal = async () => {
    if (!imageInfo) return;
    try {
      const { open } = await import('@tauri-apps/plugin-opener');
      await open(imageInfo.path);
    } catch (err) {
      console.error('Failed to open externally:', err);
    }
  };

  const canNavigate = allImageFiles && allImageFiles.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </motion.button>

            {imageInfo && (
              <div className="text-white">
                <div className="font-medium">{imageInfo.name}</div>
                <div className="text-xs text-white/60">
                  {dimensions && `${dimensions.width} × ${dimensions.height}`}
                  {imageInfo.size && ` • ${formatFileSize(imageInfo.size)}`}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-lg ${
                showInfo ? 'bg-purple-500/30' : 'bg-white/10'
              } hover:bg-white/20 text-white transition-colors`}
              title="Info (I)"
            >
              <Info size={18} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDownload}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Reveal in Finder"
            >
              <Download size={18} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenExternal}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Open in external app"
            >
              <ExternalLink size={18} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main image area */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
      >
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white text-lg"
            >
              Loading...
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-white text-center"
            >
              <div className="text-xl mb-2">Failed to load image</div>
              <div className="text-sm text-white/60">{error.toString()}</div>
            </motion.div>
          )}

          {imageData && !loading && (
            <motion.img
              ref={imageRef}
              key={imagePath}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
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
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {canNavigate && !loading && (
        <>
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
            title="Previous (←)"
          >
            <ChevronLeft size={24} />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1, x: 5 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
            title="Next (→)"
          >
            <ChevronRight size={24} />
          </motion.button>
        </>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-2 shadow-2xl border border-white/10"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={zoomOut}
            disabled={zoom <= 0.25}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom Out (-)"
          >
            <ZoomOut size={18} />
          </motion.button>

          <div className="text-white text-sm font-medium min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={zoomIn}
            disabled={zoom >= 5}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom In (+)"
          >
            <ZoomIn size={18} />
          </motion.button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetZoom}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            title="Reset Zoom (0)"
          >
            <Maximize2 size={18} />
          </motion.button>
        </motion.div>
      </div>

      {/* Info panel */}
      <AnimatePresence>
        {showInfo && imageInfo && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-black/90 backdrop-blur-md border-l border-white/10 p-6 overflow-y-auto"
          >
            <div className="text-white space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Image Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                    File Name
                  </div>
                  <div className="text-sm break-all">{imageInfo.name}</div>
                </div>

                {dimensions && (
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                      Dimensions
                    </div>
                    <div className="text-sm">
                      {dimensions.width} × {dimensions.height} pixels
                    </div>
                  </div>
                )}

                {imageInfo.size && (
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                      File Size
                    </div>
                    <div className="text-sm">{formatFileSize(imageInfo.size)}</div>
                  </div>
                )}

                {imageInfo.modified && (
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                      Modified
                    </div>
                    <div className="text-sm">{formatDate(imageInfo.modified)}</div>
                  </div>
                )}

                {imageInfo.created && (
                  <div>
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                      Created
                    </div>
                    <div className="text-sm">{formatDate(imageInfo.created)}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                    Path
                  </div>
                  <div className="text-xs break-all text-white/70">{imageInfo.path}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
