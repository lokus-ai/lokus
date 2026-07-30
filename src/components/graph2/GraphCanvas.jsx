import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { useGraphStore } from '../../core/graph2/graphStore.js';

/**
 * GraphCanvas — THE graph renderer (sidebar panel + full tab, one component).
 *
 * One canvas, no libraries: pan/zoom camera, viewport culling, label LOD,
 * tweened glide to the current file. Data comes from graphStore (the
 * incremental linkIndex) — the sim is persistent, so saves/files nudge the
 * layout instead of exploding it. Phantoms render dimmed + dashed.
 *
 * No WebGL, no workers, no per-save rebuilds.
 */

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const LABEL_ZOOM = 0.9; // below this, only current/hovered labels show

export default function GraphCanvas({ focusPath = null, onFileClick, className = '' }) {
  const version = useGraphStore((s) => s.version);
  const index = useGraphStore((s) => s.index);
  const nodes = useMemo(() => (index ? index.nodes() : []), [index, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const links = useMemo(() => (index ? index.links() : []), [index, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const camRef = useRef({ x: 0, y: 0, k: 1 });
  const tweenRef = useRef(null);
  const rafRef = useRef(null);
  const hoveredRef = useRef(null);
  const dragRef = useRef({ node: null, pan: null, moved: false });
  const focusRef = useRef(focusPath);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  focusRef.current = focusPath;

  // ---- camera helpers -------------------------------------------------------
  const toScreen = (wx, wy) => {
    const cam = camRef.current;
    return [wx * cam.k + cam.x, wy * cam.k + cam.y];
  };
  const toWorld = (sx, sy) => {
    const cam = camRef.current;
    return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k];
  };

  const glideTo = useCallback((wx, wy, targetK, duration = 800) => {
    const cam = camRef.current;
    const { width, height } = dimensions;
    const from = { ...cam };
    const to = {
      x: width / 2 - wx * targetK,
      y: height / 2 - wy * targetK,
      k: targetK,
    };
    const start = performance.now();
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // cubic-out
      camRef.current = {
        x: from.x + (to.x - from.x) * ease,
        y: from.y + (to.y - from.y) * ease,
        k: from.k + (to.k - from.k) * ease,
      };
      scheduleDraw();
      if (t < 1) tweenRef.current = requestAnimationFrame(step);
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [dimensions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- drawing --------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const cam = camRef.current;

    try {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== dimensions.width * dpr) {
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;
        ctx.scale(dpr, dpr);
      }
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const styles = getComputedStyle(document.documentElement);
      const accent = `rgb(${styles.getPropertyValue('--accent')})`;
      const muted = `rgb(${styles.getPropertyValue('--muted')})`;
      const border = `rgb(${styles.getPropertyValue('--border')})`;
      const labelColor = `rgb(${styles.getPropertyValue('--text-secondary')})`;

      const margin = 40;
      const inView = (n) => {
        const [sx, sy] = toScreen(n.x, n.y);
        return sx > -margin && sx < dimensions.width + margin && sy > -margin && sy < dimensions.height + margin;
      };

      // Edges (culled)
      ctx.strokeStyle = border;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (const l of links) {
        const s = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
        const t = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
        if (!s || !t) continue;
        if (!inView(s) && !inView(t)) continue;
        const [x1, y1] = toScreen(s.x, s.y);
        const [x2, y2] = toScreen(t.x, t.y);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Nodes (culled)
      const showAllLabels = cam.k >= LABEL_ZOOM;
      for (const n of nodes) {
        if (!inView(n)) continue;
        const isCurrent = n.id === focusRef.current;
        const isHovered = hoveredRef.current === n.id;
        const [sx, sy] = toScreen(n.x, n.y);
        const degree = n.degree || 0;
        const r = isCurrent ? 6 : Math.min(3 + degree * 0.8, 7) * (isHovered ? 1.25 : 1);

        ctx.beginPath();
        if (n.phantom) ctx.setLineDash([3, 3]);
        ctx.arc(sx, sy, r, 0, 2 * Math.PI);
        ctx.fillStyle = isCurrent ? accent : n.phantom ? border : muted;
        ctx.globalAlpha = n.phantom ? 0.55 : 1;
        ctx.fill();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        if (isCurrent || isHovered) {
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = isCurrent ? 1 : 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        if (isCurrent || isHovered || showAllLabels) {
          ctx.font = `${isCurrent ? '600' : '400'} ${isCurrent ? 12 : 11}px 'Public Sans', sans-serif`;
          ctx.fillStyle = labelColor;
          ctx.textAlign = 'center';
          ctx.fillText(n.title.substring(0, 26), sx, sy + r + 12);
        }
      }
    } catch { }
  }, [dimensions]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // ---- simulation (persistent across data changes) ---------------------------
  useEffect(() => {
    if (dimensions.width === 0) return;

    const prev = new Map(nodesRef.current.map(n => [n.id, n]));
    const degreeOf = new Map();
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      degreeOf.set(s, (degreeOf.get(s) || 0) + 1);
      degreeOf.set(t, (degreeOf.get(t) || 0) + 1);
    }

    const merged = nodes.map(n => {
      const old = prev.get(n.id);
      if (old) return Object.assign(old, { title: n.title, phantom: n.phantom, degree: degreeOf.get(n.id) || 0 });
      // Seed new nodes near a linked neighbor when possible, else near center
      const neighbor = links.find(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === n.id && prev.has(t)) || (t === n.id && prev.has(s));
      });
      let anchor = null;
      if (neighbor) {
        const otherId = (typeof neighbor.source === 'object' ? neighbor.source.id : neighbor.source) === n.id
          ? (typeof neighbor.target === 'object' ? neighbor.target.id : neighbor.target)
          : (typeof neighbor.source === 'object' ? neighbor.source.id : neighbor.source);
        anchor = prev.get(otherId);
      }
      return {
        ...n,
        degree: degreeOf.get(n.id) || 0,
        x: anchor ? anchor.x + (Math.random() - 0.5) * 30 : dimensions.width / 2 + (Math.random() - 0.5) * 80,
        y: anchor ? anchor.y + (Math.random() - 0.5) * 30 : dimensions.height / 2 + (Math.random() - 0.5) * 80,
      };
    });
    const mergedIds = new Set(merged.map(n => n.id));
    const liveLinks = links.filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return mergedIds.has(s) && mergedIds.has(t);
    }).map(l => ({ ...l }));

    nodesRef.current = merged;
    linksRef.current = liveLinks;

    if (simRef.current) simRef.current.stop();
    const sim = forceSimulation(merged)
      .force('link', forceLink(liveLinks).id(d => d.id).distance(50).strength(0.35))
      .force('charge', forceManyBody().strength(-40))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide(11))
      .alpha(prev.size === 0 ? 0.6 : 0.25) // first layout settles fully; updates just nudge
      .alphaDecay(0.05)
      .on('tick', scheduleDraw);

    // First layout: center the world origin on the canvas
    if (prev.size === 0) {
      camRef.current = { x: dimensions.width / 2, y: dimensions.height / 2, k: 1 };
      sim.on('end', () => scheduleDraw());
    }
    simRef.current = sim;

    return () => sim.stop();
  }, [nodes, links, dimensions, scheduleDraw]);

  // ---- size tracking ----------------------------------------------------------
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    };
    measure();
    const t = setTimeout(measure, 100);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, []);

  // ---- glide when focusPath changes -------------------------------------------
  const prevFocusRef = useRef(null);
  useEffect(() => {
    if (!focusPath || prevFocusRef.current === focusPath) return;
    const node = nodesRef.current.find(n => n.id === focusPath);
    if (!node) return; // retry on next data change
    prevFocusRef.current = focusPath;
    glideTo(node.x, node.y, 1.2);
    scheduleDraw();
  }, [focusPath, nodes, glideTo, scheduleDraw]);

  // Redraw on hover/current change
  useEffect(() => {
    scheduleDraw();
  }, [focusPath, scheduleDraw]);

  // ---- interactions -------------------------------------------------------------
  const nodeAt = (sx, sy) => {
    const [wx, wy] = toWorld(sx, sy);
    let best = null;
    let bestD = 14 * 14;
    for (const n of nodesRef.current) {
      const dx = wx - n.x;
      const dy = wy - n.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const n = nodeAt(sx, sy);
    if (n) {
      dragRef.current = { node: n, pan: null, moved: false };
      n.fx = n.x;
      n.fy = n.y;
      simRef.current?.alphaTarget(0.15).restart();
    } else {
      dragRef.current = { node: null, pan: { sx, sy, cam: { ...camRef.current } }, moved: false };
    }
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const drag = dragRef.current;

    if (drag.node) {
      drag.moved = true;
      const [wx, wy] = toWorld(sx, sy);
      drag.node.fx = wx;
      drag.node.fy = wy;
      scheduleDraw();
      return;
    }
    if (drag.pan) {
      drag.moved = true;
      camRef.current = {
        ...camRef.current,
        x: drag.pan.cam.x + (sx - drag.pan.sx),
        y: drag.pan.cam.y + (sy - drag.pan.sy),
      };
      scheduleDraw();
      return;
    }
    const n = nodeAt(sx, sy);
    const id = n?.id || null;
    if (id !== hoveredRef.current) {
      hoveredRef.current = id;
      scheduleDraw();
    }
    canvasRef.current.style.cursor = n ? 'pointer' : 'default';
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    if (drag.node) {
      if (!drag.moved && onFileClick && !drag.node.phantom) {
        onFileClick({ path: drag.node.id, name: drag.node.title });
      }
      drag.node.fx = null;
      drag.node.fy = null;
      simRef.current?.alphaTarget(0);
    }
    dragRef.current = { node: null, pan: null, moved: false };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const cam = camRef.current;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.k * factor));
    // Zoom toward the cursor
    const [wx, wy] = toWorld(sx, sy);
    camRef.current = { k, x: sx - wx * k, y: sy - wy * k };
    scheduleDraw();
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
    simRef.current?.stop();
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (dragRef.current.node) {
            dragRef.current.node.fx = null;
            dragRef.current.node.fy = null;
            simRef.current?.alphaTarget(0);
          }
          dragRef.current = { node: null, pan: null, moved: false };
          if (hoveredRef.current) {
            hoveredRef.current = null;
            scheduleDraw();
          }
        }}
        onWheel={handleWheel}
        className="w-full h-full block"
      />
    </div>
  );
}
