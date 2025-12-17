import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Network } from 'lucide-react';

/**
 * Focused Graph View Component - Performance Optimized
 * Uses TipTap's document state instead of parsing HTML
 * Debounces updates to avoid lag during typing
 */
export default function FocusedGraphView({ currentFile, editorRef, fileIndex = [], onFileClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [connections, setConnections] = useState([]);
  const dragStateRef = useRef({ isDragging: false, node: null, positions: {} });

  // Extract WikiLinks from TipTap document (not HTML!)
  useEffect(() => {
    const editor = editorRef?.current?.editor;
    if (!editor || !currentFile) return;

    const extractConnections = () => {
      const links = new Set();

      // Traverse TipTap's document structure directly
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'wikiLink') {
          const target = node.attrs.href || node.attrs.target;
          if (target && target !== currentFile) {
            links.add(target);
          }
        }
      });

      setConnections(Array.from(links).slice(0, 10)); // Limit to 10 for performance
    };

    // Debounced update handler - only updates 300ms after typing stops
    const handleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(extractConnections, 300);
    };

    // Initial extraction
    extractConnections();

    // Subscribe to editor updates
    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [editorRef, currentFile]);

  // Create graph nodes (memoized with stable positions)
  const nodes = useMemo(() => {
    if (!currentFile || dimensions.width === 0) return [];

    try {
      const currentFileObj = fileIndex.find(f => f.path === currentFile);
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;

      const graphNodes = [{
        id: currentFile,
        label: currentFileObj?.title || currentFile.split('/').pop() || 'Current',
        type: 'current',
        x: dragStateRef.current.positions[currentFile]?.x ?? centerX,
        y: dragStateRef.current.positions[currentFile]?.y ?? centerY
      }];

      // Add connected nodes in a circle
      const radius = Math.min(dimensions.width, dimensions.height) / 3.5;
      const angleStep = (2 * Math.PI) / Math.max(connections.length, 1);

      connections.forEach((connPath, index) => {
        const connFile = fileIndex.find(f => f.path === connPath);
        const angle = index * angleStep - Math.PI / 2;
        const defaultX = centerX + radius * Math.cos(angle);
        const defaultY = centerY + radius * Math.sin(angle);

        graphNodes.push({
          id: connPath,
          label: (connFile?.title || connPath.split('/').pop() || 'File').substring(0, 20),
          type: 'connected',
          x: dragStateRef.current.positions[connPath]?.x ?? defaultX,
          y: dragStateRef.current.positions[connPath]?.y ?? defaultY
        });
      });

      return graphNodes;
    } catch (e) {
      return [];
    }
  }, [currentFile, fileIndex, connections, dimensions]);

  // Update dimensions (debounced)
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    updateDimensions();
    const timeoutId = setTimeout(updateDimensions, 100);

    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Draw graph (optimized)
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0 || dimensions.width === 0) return;

    try {
      const ctx = canvas.getContext('2d', { alpha: false });
      const dpr = window.devicePixelRatio || 1;

      // Set canvas size only if changed
      if (canvas.width !== dimensions.width * dpr) {
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;
        ctx.scale(dpr, dpr);
      }

      // Clear
      ctx.fillStyle = '#00000000';
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Get colors
      const styles = getComputedStyle(document.documentElement);
      const accentColor = `rgb(${styles.getPropertyValue('--accent')})`;
      const mutedColor = `rgb(${styles.getPropertyValue('--muted')})`;
      const borderColor = `rgb(${styles.getPropertyValue('--border')})`;

      // Draw edges
      const centerNode = nodes[0];
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      nodes.slice(1).forEach(node => {
        ctx.moveTo(centerNode.x, centerNode.y);
        ctx.lineTo(node.x, node.y);
      });
      ctx.stroke();

      // Draw nodes
      nodes.forEach(node => {
        const isCenter = node.type === 'current';
        const isHovered = hoveredNode === node.id;
        const radius = isCenter ? 10 : 7;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isCenter ? accentColor : mutedColor;
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    } catch { }
  }, [nodes, dimensions, hoveredNode]);

  // Draw on changes
  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Mouse handlers (optimized with RAF)
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = nodes.find(node => {
      const radius = node.type === 'current' ? 10 : 7;
      const dx = x - node.x;
      const dy = y - node.y;
      return dx * dx + dy * dy <= radius * radius;
    });

    if (clickedNode) {
      dragStateRef.current = { isDragging: true, node: clickedNode, positions: { ...dragStateRef.current.positions } };
      e.preventDefault();
    }
  }, [nodes]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragStateRef.current.isDragging && dragStateRef.current.node) {
      // Use RAF for smooth dragging
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        dragStateRef.current.positions[dragStateRef.current.node.id] = { x, y };
        dragStateRef.current.node.x = x;
        dragStateRef.current.node.y = y;
        drawGraph();
      });
    } else {
      // Hover detection
      const foundNode = nodes.find(node => {
        const radius = node.type === 'current' ? 10 : 7;
        const dx = x - node.x;
        const dy = y - node.y;
        return dx * dx + dy * dy <= radius * radius;
      });

      const newHovered = foundNode?.id || null;
      if (newHovered !== hoveredNode) {
        setHoveredNode(newHovered);
      }
      canvasRef.current.style.cursor = foundNode ? 'grab' : 'default';
    }
  }, [nodes, drawGraph, hoveredNode]);

  const handleMouseUp = useCallback((e) => {
    if (!dragStateRef.current.isDragging) return;

    const wasClick = dragStateRef.current.node &&
      dragStateRef.current.node.type === 'connected';

    if (wasClick && onFileClick) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - dragStateRef.current.node.x;
        const dy = y - dragStateRef.current.node.y;

        if (Math.sqrt(dx * dx + dy * dy) < 5) {
          onFileClick({
            path: dragStateRef.current.node.id,
            name: dragStateRef.current.node.label
          });
        }
      }
    }

    dragStateRef.current = { isDragging: false, node: null, positions: { ...dragStateRef.current.positions } };
  }, [onFileClick]);

  // Cleanup RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full text-app-muted">
        <div className="text-center">
          <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No file selected</p>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="flex flex-col h-full bg-app-panel">
        <div className="px-3 py-2 border-b border-app-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Network className="w-4 h-4" />
            Local Graph
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
          <div className="text-center">
            <p>No connections</p>
            <p className="text-xs mt-1">Add WikiLinks to see graph</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app-panel">
      <div className="px-3 py-2 border-b border-app-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Network className="w-4 h-4" />
          Local Graph
        </h3>
        <span className="text-xs text-app-muted">
          {connections.length} {connections.length === 1 ? 'link' : 'links'}
        </span>
      </div>

      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            dragStateRef.current.isDragging = false;
            dragStateRef.current.node = null;
          }}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
