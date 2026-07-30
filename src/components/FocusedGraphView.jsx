import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Network } from 'lucide-react';

/**
 * FocusedGraphView — the right sidebar's Local Graph panel.
 *
 * Shows the current file at the center with its outgoing [[wikiLinks]] around
 * it. ProseMirror-native: subscribes to the EditorView via a light doc-identity
 * poll (500ms), so link edits appear as you type. fileIndex comes from the
 * live file-tree store, so newly created files resolve without a reload.
 *
 * Token-styled only (accent center, muted satellites, border edges). No
 * gradients, no shadows — Vellum chrome.
 */

// Normalize a raw wikiLink target ("Note Name|alias" or "folder/Note.md")
// to a fileIndex path by exact match, then by basename.
function resolveTarget(rawTarget, fileIndex) {
  if (!rawTarget) return null;
  const base = rawTarget.split('|')[0].trim();
  if (!base) return null;
  const exact = fileIndex.find(f => f.path === base);
  if (exact) return exact;
  const want = (base.endsWith('.md') ? base : `${base}.md`).toLowerCase();
  return fileIndex.find(f => f.path.toLowerCase().endsWith(`/${want}`)) || null;
}

export default function FocusedGraphView({ currentFile, editor, fileIndex = [], onFileClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const lastDocRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [connections, setConnections] = useState([]);
  const dragStateRef = useRef({ isDragging: false, node: null, positions: {} });

  // Extract outgoing WikiLinks from the ProseMirror document.
  // EditorViews have no event emitter, so poll doc identity — a new doc
  // object means a transaction happened. 500ms keeps typing lag-free.
  useEffect(() => {
    if (!editor || !currentFile) {
      setConnections([]);
      return;
    }
    lastDocRef.current = null;

    const extractConnections = () => {
      const links = new Set();
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'wikiLink') {
          const resolved = resolveTarget(node.attrs.href || node.attrs.target, fileIndex);
          if (resolved && resolved.path !== currentFile) {
            links.add(resolved.path);
          }
        }
      });
      setConnections(Array.from(links).slice(0, 12));
    };

    extractConnections();
    const interval = setInterval(() => {
      if (editor.state.doc !== lastDocRef.current) {
        lastDocRef.current = editor.state.doc;
        extractConnections();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [editor, currentFile, fileIndex]);

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

  // Update dimensions
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
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);

  // Draw graph
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0 || dimensions.width === 0) return;

    try {
      const ctx = canvas.getContext('2d', { alpha: false });
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== dimensions.width * dpr) {
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;
        ctx.scale(dpr, dpr);
      }

      ctx.fillStyle = '#00000000';
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const styles = getComputedStyle(document.documentElement);
      const accentColor = `rgb(${styles.getPropertyValue('--accent')})`;
      const mutedColor = `rgb(${styles.getPropertyValue('--muted')})`;
      const borderColor = `rgb(${styles.getPropertyValue('--border')})`;
      const textColor = `rgb(${styles.getPropertyValue('--text-secondary')})`;

      // Edges
      const centerNode = nodes[0];
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      nodes.slice(1).forEach(node => {
        ctx.moveTo(centerNode.x, centerNode.y);
        ctx.lineTo(node.x, node.y);
      });
      ctx.stroke();

      // Nodes
      nodes.forEach(node => {
        const isCenter = node.type === 'current';
        const isHovered = hoveredNode === node.id;
        const radius = isCenter ? 8 : 5;

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

      // Labels (only center + hovered to stay quiet)
      nodes.forEach(node => {
        const isCenter = node.type === 'current';
        const isHovered = hoveredNode === node.id;
        if (!isCenter && !isHovered) return;
        ctx.font = `${isCenter ? '500' : '400'} 11px 'Public Sans', sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + 18);
      });
    } catch { }
  }, [nodes, dimensions, hoveredNode]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = nodes.find(node => {
      const radius = Math.max(node.type === 'current' ? 8 : 5, 10); // generous hit area
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        dragStateRef.current.positions[dragStateRef.current.node.id] = { x, y };
        dragStateRef.current.node.x = x;
        dragStateRef.current.node.y = y;
        drawGraph();
      });
    } else {
      const foundNode = nodes.find(node => {
        const radius = Math.max(node.type === 'current' ? 8 : 5, 10);
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

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const header = (
    <div className="h-[38px] px-3 border-b border-app-border flex items-center justify-between flex-none">
      <h3 className="text-[13px] font-semibold flex items-center gap-2 text-app-text">
        <Network className="w-4 h-4" strokeWidth={1.5} />
        Local Graph
      </h3>
      {connections.length > 0 && (
        <span className="text-xs text-app-muted">
          {connections.length} {connections.length === 1 ? 'link' : 'links'}
        </span>
      )}
    </div>
  );

  if (!currentFile) {
    return (
      <div className="flex flex-col h-full bg-app-panel">
        {header}
        <div className="flex-1 flex items-center justify-center text-app-muted">
          <div className="text-center">
            <Network className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Open a file to see its graph</p>
          </div>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="flex flex-col h-full bg-app-panel">
        {header}
        <div className="flex-1 flex items-center justify-center text-app-muted">
          <div className="text-center">
            <p className="text-xs">No outgoing links</p>
            <p className="text-[11px] mt-1 opacity-70">Type [[ to link one note to another</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app-panel">
      {header}
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
