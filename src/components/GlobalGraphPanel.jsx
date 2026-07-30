import React, { useEffect, useRef, useState, useCallback } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { Network } from 'lucide-react';

/**
 * GlobalGraphPanel — the whole workspace graph living in the right sidebar.
 *
 * Data comes from the shared GraphDatabase (graphProcessorRef) — the same
 * source the full-pane graph uses — so every file and every [[link]] is here,
 * live: database events (node/connection add/remove, fileLinksUpdated) rebuild
 * the simulation within ~300ms of a save or file creation.
 *
 * The current file is the accent node; everything else whispers. Labels show
 * for the current file and hovered node only. Drag to rearrange, click a node
 * to open it. Token-styled, no gradients.
 */

function extractGraph(db, currentFile) {
  const nodes = [];
  const links = [];
  if (!db?.nodes) return { nodes, links };

  for (const [id, node] of db.nodes) {
    if (!id.endsWith('.md')) continue;
    nodes.push({
      id,
      // The DB normalizes ids WITHOUT the leading slash — the node.path field
      // keeps the real path; click-to-open needs it.
      path: node.path && node.path.startsWith('/') ? node.path : `/${id}`,
      title: node.title || id.split('/').pop().replace(/\.md$/, ''),
      current: id === currentFile,
    });
  }
  const fileIds = new Set(nodes.map(n => n.id));
  for (const [source, targets] of db.outgoingEdges || []) {
    if (!fileIds.has(source)) continue;
    for (const [target] of targets || []) {
      if (fileIds.has(target) && source !== target) {
        links.push({ source, target });
      }
    }
  }
  return { nodes, links };
}

export default function GlobalGraphPanel({ currentFile, graphProcessorRef, onFileClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const rafRef = useRef(null);
  const dragRef = useRef({ node: null, moved: false });
  const hoveredRef = useRef(null);
  const currentFileRef = useRef(currentFile);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stats, setStats] = useState({ files: 0, links: 0 });

  currentFileRef.current = currentFile;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const nodes = nodesRef.current;
    const links = linksRef.current;

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
      const label = `rgb(${styles.getPropertyValue('--text-secondary')})`;

      // Edges
      ctx.strokeStyle = border;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (const l of links) {
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Nodes
      for (const n of nodes) {
        const isCurrent = n.id === currentFileRef.current;
        const isHovered = hoveredRef.current === n.id;
        ctx.beginPath();
        ctx.arc(n.x, n.y, isCurrent ? 6 : isHovered ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = isCurrent ? accent : muted;
        ctx.fill();
        if (isCurrent || isHovered) {
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = isCurrent ? 1 : 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Labels: current + hovered only
      ctx.textAlign = 'center';
      for (const n of nodes) {
        const isCurrent = n.id === currentFileRef.current;
        const isHovered = hoveredRef.current === n.id;
        if (!isCurrent && !isHovered) continue;
        ctx.font = `${isCurrent ? '600' : '400'} 11px 'Public Sans', sans-serif`;
        ctx.fillStyle = label;
        ctx.fillText(n.title.substring(0, 24), n.x, n.y + 16);
      }
    } catch { }
  }, [dimensions]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Build/rebuild the simulation from the database. Existing nodes keep their
  // positions so the graph doesn't explode on every update.
  const rebuild = useCallback(() => {
    const db = graphProcessorRef?.current?.getGraphDatabase?.();
    if (!db || dimensions.width === 0) return;

    const { nodes: freshNodes, links: freshLinks } = extractGraph(db, currentFileRef.current);
    const prev = new Map(nodesRef.current.map(n => [n.id, n]));

    const merged = freshNodes.map(n => {
      const old = prev.get(n.id);
      return old ? Object.assign(old, { title: n.title }) : {
        ...n,
        x: dimensions.width / 2 + (Math.random() - 0.5) * 60,
        y: dimensions.height / 2 + (Math.random() - 0.5) * 60,
      };
    });
    const mergedIds = new Set(merged.map(n => n.id));
    const links = freshLinks
      .filter(l => mergedIds.has(l.source) && mergedIds.has(l.target))
      .map(l => ({ ...l }));

    nodesRef.current = merged;
    linksRef.current = links;
    setStats({ files: merged.length, links: links.length });

    if (simRef.current) simRef.current.stop();
    const sim = forceSimulation(merged)
      .force('link', forceLink(links).id(d => d.id).distance(46).strength(0.4))
      .force('charge', forceManyBody().strength(-38))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', forceCollide(10))
      .alpha(0.5)
      .alphaDecay(0.05)
      .on('tick', scheduleDraw);
    simRef.current = sim;
  }, [dimensions, graphProcessorRef, scheduleDraw]);

  // Size tracking
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

  // Initial build + subscribe to database events (live updates)
  useEffect(() => {
    rebuild();
    const db = graphProcessorRef?.current?.getGraphDatabase?.();
    if (!db) return;

    let timer = null;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(rebuild, 300);
    };
    const events = ['nodeAdded', 'nodeUpdated', 'nodeRemoved', 'connectionAdded', 'connectionRemoved', 'fileLinksUpdated'];
    events.forEach(e => db.on(e, bump));

    // Self-heal: if the workspace scan never populated the database (e.g. it
    // was skipped because store graphData already existed), kick it once here.
    // Node events fire during the scan and rebuild the panel incrementally.
    const processor = graphProcessorRef?.current;
    const rescanTimer = setTimeout(() => {
      if (db.nodes?.size === 0 && processor && !processor.__sidebarScanning) {
        processor.__sidebarScanning = true;
        processor.buildGraphFromWorkspace({
          includeNonMarkdown: false,
          maxDepth: 10,
          excludePatterns: ['.git', 'node_modules', '.lokus', '.DS_Store'],
        }).catch(() => {}).finally(() => {
          processor.__sidebarScanning = false;
          rebuild();
        });
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(rescanTimer);
      events.forEach(e => db.off(e, bump));
      simRef.current?.stop();
    };
  }, [rebuild, graphProcessorRef]);

  // Redraw when the current file changes (highlight moves, no sim restart)
  useEffect(() => {
    scheduleDraw();
  }, [currentFile, scheduleDraw]);

  // --- interactions ---------------------------------------------------------
  const nodeAt = (x, y) => {
    let best = null;
    let bestD = 12 * 12;
    for (const n of nodesRef.current) {
      const dx = x - n.x;
      const dy = y - n.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (n) {
      dragRef.current = { node: n, moved: false };
      n.fx = n.x;
      n.fy = n.y;
      simRef.current?.alphaTarget(0.2).restart();
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragRef.current.node) {
      dragRef.current.moved = true;
      dragRef.current.node.fx = x;
      dragRef.current.node.fy = y;
      scheduleDraw();
    } else {
      const n = nodeAt(x, y);
      const id = n?.id || null;
      if (id !== hoveredRef.current) {
        hoveredRef.current = id;
        scheduleDraw();
      }
      canvasRef.current.style.cursor = n ? 'pointer' : 'default';
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    if (drag.node) {
      if (!drag.moved && onFileClick) {
        onFileClick({ path: drag.node.path || drag.node.id, name: drag.node.title });
      }
      drag.node.fx = null;
      drag.node.fy = null;
      dragRef.current = { node: null, moved: false };
      simRef.current?.alphaTarget(0);
    }
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    simRef.current?.stop();
  }, []);

  const empty = stats.files === 0;

  return (
    <div className="flex flex-col h-full bg-app-panel">
      <div className="h-[38px] px-3 border-b border-app-border flex items-center justify-between flex-none">
        <h3 className="text-[13px] font-semibold flex items-center gap-2 text-app-text">
          <Network className="w-4 h-4" strokeWidth={1.5} />
          Graph
        </h3>
        {!empty && (
          <span className="text-xs text-app-muted">
            {stats.files} {stats.files === 1 ? 'file' : 'files'} · {stats.links} {stats.links === 1 ? 'link' : 'links'}
          </span>
        )}
      </div>

      {empty ? (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          <div className="text-center">
            <Network className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No files yet</p>
            <p className="text-[11px] mt-1 opacity-70">Create notes and link them with [[</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (dragRef.current.node) {
                dragRef.current.node.fx = null;
                dragRef.current.node.fy = null;
                dragRef.current = { node: null, moved: false };
                simRef.current?.alphaTarget(0);
              }
              if (hoveredRef.current) {
                hoveredRef.current = null;
                scheduleDraw();
              }
            }}
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
