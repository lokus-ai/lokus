import React, { useRef, useEffect, useState, useCallback } from 'react';
import './GraphMinimap.css';

/**
 * GraphMinimap - Miniature navigation overview of the graph
 * 
 * Features:
 * - Performance-optimized mini-renderer
 * - Click to jump to specific areas
 * - Visual viewport indicator
 * - Smooth panning and navigation
 * - Responsive design matching Obsidian aesthetics
 */
export function GraphMinimap({ 
  graphData = null,
  viewportBounds = null,
  onViewportChange = null,
  width = 200,
  height = 150,
  className = '',
  isVisible = true 
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Graph bounds for scaling
  const [graphBounds, setGraphBounds] = useState({
    minX: -100, maxX: 100,
    minY: -100, maxY: 100
  });

  // Calculate graph bounds from data
  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    graphData.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    });

    // Add padding
    const paddingX = (maxX - minX) * 0.1;
    const paddingY = (maxY - minY) * 0.1;

    setGraphBounds({
      minX: minX - paddingX,
      maxX: maxX + paddingX,
      minY: minY - paddingY,
      maxY: maxY + paddingY
    });
  }, [graphData]);

  // Transform graph coordinates to canvas coordinates
  const graphToCanvas = useCallback((x, y) => {
    const scaleX = width / (graphBounds.maxX - graphBounds.minX);
    const scaleY = height / (graphBounds.maxY - graphBounds.minY);
    
    return {
      x: (x - graphBounds.minX) * scaleX,
      y: (y - graphBounds.minY) * scaleY
    };
  }, [width, height, graphBounds]);

  // Transform canvas coordinates to graph coordinates
  const canvasToGraph = useCallback((x, y) => {
    const scaleX = (graphBounds.maxX - graphBounds.minX) / width;
    const scaleY = (graphBounds.maxY - graphBounds.minY) / height;
    
    return {
      x: x * scaleX + graphBounds.minX,
      y: y * scaleY + graphBounds.minY
    };
  }, [width, height, graphBounds]);

  // Render the minimap
  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size with device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    ctx.fillStyle = 'rgba(42, 42, 42, 0.8)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw edges first (behind nodes)
    if (graphData.edges) {
      ctx.strokeStyle = 'rgba(136, 136, 136, 0.3)';
      ctx.lineWidth = 0.5;
      
      graphData.edges.forEach(edge => {
        const sourceNode = graphData.nodes.find(n => n.id === edge.source);
        const targetNode = graphData.nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode && 
            sourceNode.x !== undefined && sourceNode.y !== undefined &&
            targetNode.x !== undefined && targetNode.y !== undefined) {
          
          const sourcePos = graphToCanvas(sourceNode.x, sourceNode.y);
          const targetPos = graphToCanvas(targetNode.x, targetNode.y);
          
          ctx.beginPath();
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.stroke();
        }
      });
    }
    
    // Draw nodes
    if (graphData.nodes) {
      graphData.nodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;
        
        const pos = graphToCanvas(node.x, node.y);
        const nodeSize = Math.max(1, Math.min(3, (node.size || 5) * 0.3));
        
        // Node color based on type
        let nodeColor = 'rgba(124, 58, 237, 0.8)'; // Default purple
        if (node.type === 'file') nodeColor = 'rgba(59, 130, 246, 0.8)'; // Blue
        if (node.type === 'folder') nodeColor = 'rgba(16, 185, 129, 0.8)'; // Green
        if (node.type === 'tag') nodeColor = 'rgba(245, 158, 11, 0.8)'; // Amber
        
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Add subtle glow for visibility
        if (isHovered) {
          ctx.shadowColor = nodeColor;
          ctx.shadowBlur = 2;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    }
    
    // Draw viewport indicator
    if (viewportBounds) {
      const topLeft = graphToCanvas(viewportBounds.minX, viewportBounds.minY);
      const bottomRight = graphToCanvas(viewportBounds.maxX, viewportBounds.maxY);
      
      const viewportWidth = bottomRight.x - topLeft.x;
      const viewportHeight = bottomRight.y - topLeft.y;
      
      // Viewport background
      ctx.fillStyle = 'rgba(124, 58, 237, 0.1)';
      ctx.fillRect(topLeft.x, topLeft.y, viewportWidth, viewportHeight);
      
      // Viewport border
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(topLeft.x, topLeft.y, viewportWidth, viewportHeight);
      ctx.setLineDash([]);
    }
    
  }, [graphData, viewportBounds, width, height, graphBounds, graphToCanvas, isHovered]);

  // Render when data changes
  useEffect(() => {
    renderMinimap();
  }, [renderMinimap]);

  // Handle mouse down
  const handleMouseDown = useCallback((event) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setIsDragging(true);
    setDragStart({ x, y });
    
    // Immediately jump to clicked position
    const graphPos = canvasToGraph(x, y);
    if (onViewportChange) {
      onViewportChange(graphPos);
    }
  }, [canvasToGraph, onViewportChange]);

  // Handle mouse move
  const handleMouseMove = useCallback((event) => {
    if (!isDragging) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const graphPos = canvasToGraph(x, y);
    if (onViewportChange) {
      onViewportChange(graphPos);
    }
  }, [isDragging, canvasToGraph, onViewportChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
  }, []);

  // Handle mouse enter/leave for hover effects
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsDragging(false);
  }, []);

  // Set up global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isVisible || !graphData) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={`graph-minimap ${className} ${isHovered ? 'hovered' : ''} ${isDragging ? 'dragging' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="minimap-header">
        <div className="minimap-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12,2 2,7 12,12 22,7" />
            <polyline points="2,17 12,22 22,17" />
            <polyline points="2,12 12,17 22,12" />
          </svg>
          <span>Overview</span>
        </div>
        <div className="minimap-stats">
          <span className="node-count">
            {graphData.nodes ? graphData.nodes.length : 0}
          </span>
        </div>
      </div>
      
      <div className="minimap-canvas-container">
        <canvas
          ref={canvasRef}
          className="minimap-canvas"
          style={{ width: `${width}px`, height: `${height}px` }}
          onMouseDown={handleMouseDown}
        />
        
        {/* Interaction overlay */}
        <div className="minimap-overlay">
          {isDragging && (
            <div className="drag-indicator">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" />
                <polyline points="2,17 12,22 22,17" />
                <polyline points="2,12 12,17 22,12" />
              </svg>
            </div>
          )}
        </div>
      </div>
      
      <div className="minimap-footer">
        <div className="minimap-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'rgba(59, 130, 246, 0.8)' }}></div>
            <span>Files</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'rgba(16, 185, 129, 0.8)' }}></div>
            <span>Folders</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'rgba(245, 158, 11, 0.8)' }}></div>
            <span>Tags</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GraphMinimap;