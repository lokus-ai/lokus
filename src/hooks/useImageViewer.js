import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Custom hook for image viewer functionality
 * Handles loading, zooming, panning, and navigation
 */
export function useImageViewer(initialImagePath, allImageFiles, onPathChange) {
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [imageData, setImageData] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // Load image data
  useEffect(() => {
    if (!imagePath) return;

    setLoading(true);
    setError(null);

    invoke('read_image_file', { path: imagePath })
      .then((dataUrl) => {
        setImageData(dataUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load image:', err);
        setError(err);
        setLoading(false);
      });
  }, [imagePath]);

  // Extract image info from file
  useEffect(() => {
    if (!imagePath || !allImageFiles) return;

    const file = allImageFiles.find(f => f.path === imagePath);
    if (file) {
      setImageInfo({
        name: file.name,
        path: file.path,
        size: file.size,
        modified: file.modified,
        created: file.created,
      });
    }
  }, [imagePath, allImageFiles]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const fitToScreen = useCallback(() => {
    if (!imageRef.current) return;
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Pan controls
  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return; // Only allow panning when zoomed in
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [zoom, position]);

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

  // Navigation
  const navigateToImage = useCallback((newPath) => {
    setImagePath(newPath);
    resetZoom();
    if (onPathChange) {
      onPathChange(newPath);
    }
  }, [resetZoom, onPathChange]);

  const goToNext = useCallback(() => {
    if (!allImageFiles || allImageFiles.length === 0) return;
    const currentIndex = allImageFiles.findIndex(f => f.path === imagePath);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % allImageFiles.length;
    navigateToImage(allImageFiles[nextIndex].path);
  }, [allImageFiles, imagePath, navigateToImage]);

  const goToPrev = useCallback(() => {
    if (!allImageFiles || allImageFiles.length === 0) return;
    const currentIndex = allImageFiles.findIndex(f => f.path === imagePath);
    if (currentIndex === -1) return;
    const prevIndex = currentIndex === 0 ? allImageFiles.length - 1 : currentIndex - 1;
    navigateToImage(allImageFiles[prevIndex].path);
  }, [allImageFiles, imagePath, navigateToImage]);

  // Get current image dimensions
  const [dimensions, setDimensions] = useState(null);
  useEffect(() => {
    if (!imageData) return;

    const img = new Image();
    img.onload = () => {
      setDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.src = imageData;
  }, [imageData]);

  return {
    imagePath,
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
    navigateToImage,
  };
}
