import React, { useCallback, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, LocateFixed } from 'lucide-react';
import { getGraphEngine } from '../../core/graph2/graphEngine.js';
import { useGraphConfig } from '../../core/graph2/graphConfig.js';

/**
 * GraphFrame — a camera + a canvas over the ONE shared engine.
 *
 * A frame owns nothing but its viewport: pan/zoom/tween, culling, drawing.
 * It never builds a simulation — `graphEngine` owns the layout, so the sidebar
 * preview and the full tab are literally the same graph seen through two
 * cameras. Positions come from `engine.nodes()`, adjacency from
 * `engine.neighbors(id)`, and dragging goes back through `engine.pin/unpin`.
 *
 *   engine tick ──► scheduleDraw ──► one rAF ──► draw(camera)
 *
 * Everything visual is driven by `useGraphConfig`; nothing here writes config
 * or focus back — the host owns both.
 */

const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;

/** Constant screen-space padding around a node's drawn rim (fixes the old
 *  world-space hit box that inflated when zoomed in and vanished zoomed out). */
export const HIT_PAD = 6;

const MIN_NODE_PX = 1.6;      // never let a node shrink to nothing
const MAX_NODE_PX = 46;       // …or swallow the screen at max zoom
const CULL_PAD = 56;
const HOVER_FADE_MS = 150;
const GLIDE_MS = 620;
const DIM_NODE = 0.8;         // how hard non-neighbours fade on hover
const DIM_EDGE = 0.86;
const SEARCH_DIM = 0.22;      // engine sets node.dim on search non-matches

// ---- geometry (pure, exported: the renderer and hit testing share it) ------

/** A node's drawn radius in SCREEN pixels at zoom `k`. */
export function screenRadius(node, k) {
  const r = (node?.radius ?? 4) * k;
  return r < MIN_NODE_PX ? MIN_NODE_PX : r > MAX_NODE_PX ? MAX_NODE_PX : r;
}

/** Clickable radius in SCREEN pixels — exactly what you see, plus a fixed pad. */
export function pickRadius(node, k) {
  return screenRadius(node, k) + HIT_PAD;
}

/** Topmost node under a screen point, or null. Zoom-invariant by construction. */
export function pickNode(nodes, sx, sy, cam) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const dx = n.x * cam.k + cam.x - sx;
    const dy = n.y * cam.k + cam.y - sy;
    const d2 = dx * dx + dy * dy;
    const r = pickRadius(n, cam.k);
    if (d2 <= r * r && d2 < bestD) { bestD = d2; best = n; }
  }
  return best;
}

// ---- palette ---------------------------------------------------------------

/** Reused in place — the draw loop must not allocate. */
const PALETTE = {
  accent: '#a78bfa', muted: '#7e7e86', border: '#35353a', label: '#8b8b93',
  link: '#35353a', linkHot: '#a78bfa', bg: '#212124', bgAlt: '#a78bfa',
  file: '#6ec98f', phantom: '#7e7e86', tag: '#c4a7e7', attachment: '#f6c177',
};

/** engine `node.cssVar` → palette slot. Unknown vars fall through to node.type. */
const VAR_SLOT = {
  '--graph-node-document': 'file',
  '--graph-node-placeholder': 'phantom',
  '--graph-node-tag': 'tag',
  '--graph-node-folder': 'attachment',
};

/** Refresh PALETTE from the live theme. Exported for tests: it pins the exact
 *  variable names the renderer reads against what globals.css defines. */
export function readPalette() {
  let style = null;
  try {
    style = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
  } catch { /* no DOM styles — the defaults above stand in */ }

  const raw = (name) => {
    try { return (style?.getPropertyValue(name) || '').trim(); } catch { return ''; }
  };
  // Two live conventions in globals.css: `--accent` & friends hold space-separated
  // rgb channels and need wrapping; every `--graph-*` var is already a hex string.
  const chan = (name, fb) => { const v = raw(name); return v ? `rgb(${v})` : fb; };
  const hex = (name, fb) => raw(name) || fb;

  PALETTE.accent = chan('--accent', '#a78bfa');
  PALETTE.muted = chan('--muted', '#7e7e86');
  PALETTE.border = chan('--border', '#35353a');
  PALETTE.label = chan('--text-secondary', '#8b8b93');

  PALETTE.link = hex('--graph-link', PALETTE.border);
  PALETTE.linkHot = hex('--graph-link-hover', PALETTE.accent);
  PALETTE.bg = hex('--graph-bg-primary', '#212124');
  PALETTE.bgAlt = hex('--graph-bg-secondary', PALETTE.accent);

  PALETTE.file = hex('--graph-node-document', PALETTE.accent);
  PALETTE.phantom = hex('--graph-node-placeholder', PALETTE.border);
  PALETTE.tag = hex('--graph-node-tag', PALETTE.label);
  PALETTE.attachment = hex('--graph-node-folder', PALETTE.muted);
}

/** Fill for a node: an explicit scheme colour, else its themed type colour. */
export function nodeColor(n) {
  if (n.color) return n.color;                       // scheme set an explicit color
  return PALETTE[VAR_SLOT[n.cssVar] || n.type] || PALETTE.file;
}

function truncate(s, max) {
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

const clampK = (k) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k));

// ---- background ------------------------------------------------------------

/** Painted in screen space and anchored to the viewport, so patterns never
 *  swim, shimmer or re-space themselves under pan/zoom. */
function drawBackground(ctx, w, h, cfg) {
  const type = cfg.backgroundType || 'none';
  if (type === 'none') return;
  const primary = cfg.backgroundColor || PALETTE.bg;
  const secondary = cfg.backgroundSecondary || PALETTE.bgAlt;
  const opacity = Math.max(0, Math.min(1, cfg.backgroundOpacity ?? 0.1));
  if (opacity === 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  if (type === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, primary);
    g.addColorStop(1, secondary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (type === 'radial') {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, secondary);
    g.addColorStop(1, primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, h);
  }

  if (type === 'dots' || type === 'grid') {
    let spacing = Math.max(6, cfg.backgroundDotSpacing ?? 30);
    while ((w / spacing) * (h / spacing) > 20000) spacing *= 2;   // never death-loop on tiny spacing
    ctx.globalAlpha = Math.min(1, opacity * 4);                   // marks need punch over the wash

    if (type === 'dots') {
      const r = Math.max(0.5, (cfg.backgroundDotSize ?? 2) / 2);
      ctx.fillStyle = secondary;
      ctx.beginPath();
      for (let y = spacing / 2; y < h; y += spacing) {
        for (let x = spacing / 2; x < w; x += spacing) {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    } else {
      ctx.strokeStyle = secondary;
      ctx.lineWidth = Math.max(0.5, (cfg.backgroundDotSize ?? 2) / 2);
      ctx.beginPath();
      for (let x = spacing / 2; x < w; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = spacing / 2; y < h; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---- component -------------------------------------------------------------

export default function GraphFrame({
  className = '',
  variant = 'full',
  focusPath = null,
  onOpenFile,
}) {
  const config = useGraphConfig((s) => s.config);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const cfgRef = useRef(config);
  cfgRef.current = config;
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const focusRef = useRef(focusPath);
  focusRef.current = focusPath;
  const openRef = useRef(onOpenFile);
  openRef.current = onOpenFile;

  const sizeRef = useRef({ w: 0, h: 0 });
  const camRef = useRef({ x: 0, y: 0, k: 1 });
  const rafRef = useRef(0);
  const tweenRef = useRef(null);
  const hoverRef = useRef({ id: null, t: 0, last: 0 });
  const dragRef = useRef({ id: null, pan: null, moved: false });
  const fitRef = useRef({ stage: 0, touched: false });
  const pendingFocusRef = useRef(null);

  // ---- scheduling ---------------------------------------------------------
  const drawRef = useRef(() => {});
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;                       // coalesce: one draw per frame
    const run = () => { rafRef.current = 0; drawRef.current(); };
    rafRef.current = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(run)
      : setTimeout(run, 16);
  }, []);

  // ---- camera -------------------------------------------------------------
  const glideTo = useCallback((wx, wy, k, duration = GLIDE_MS) => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const cam = camRef.current;
    tweenRef.current = {
      fromX: cam.x, fromY: cam.y, fromK: cam.k,
      toX: w / 2 - wx * k, toY: h / 2 - wy * k, toK: k,
      start: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      dur: Math.max(1, duration),
    };
    scheduleDraw();
  }, [scheduleDraw]);

  const fitToView = useCallback((animate = false) => {
    const nodes = getGraphEngine().nodes();
    const { w, h } = sizeRef.current;
    if (!nodes.length || !w || !h) return false;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      const r = n.radius ?? 4;
      if (n.x - r < minX) minX = n.x - r;
      if (n.x + r > maxX) maxX = n.x + r;
      if (n.y - r < minY) minY = n.y - r;
      if (n.y + r > maxY) maxY = n.y + r;
    }
    if (!Number.isFinite(minX)) return false;

    const pad = variantRef.current === 'preview' ? 26 : 56;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const k = clampK(Math.min((w - pad * 2) / bw, (h - pad * 2) / bh));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    if (animate) glideTo(cx, cy, k, 420);
    else { camRef.current = { k, x: w / 2 - cx * k, y: h / 2 - cy * k }; scheduleDraw(); }
    return true;
  }, [glideTo, scheduleDraw]);

  const zoomBy = useCallback((factor) => {
    const { w, h } = sizeRef.current;
    const cam = camRef.current;
    const k = clampK(cam.k * factor);
    const wx = (w / 2 - cam.x) / cam.k;
    const wy = (h / 2 - cam.y) / cam.k;
    camRef.current = { k, x: w / 2 - wx * k, y: h / 2 - wy * k };
    fitRef.current.touched = true;
    tweenRef.current = null;
    scheduleDraw();
  }, [scheduleDraw]);

  const resetView = useCallback(() => {
    const { w, h } = sizeRef.current;
    camRef.current = { x: w / 2, y: h / 2, k: 1 };
    tweenRef.current = null;
    fitRef.current.touched = true;
    scheduleDraw();
  }, [scheduleDraw]);

  /** Glide to the focused node, retrying on later ticks if it isn't there yet. */
  const tryFocusGlide = useCallback(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    const n = getGraphEngine().node(id);
    if (!n || !Number.isFinite(n.x)) return;
    pendingFocusRef.current = null;
    fitRef.current.touched = true;
    glideTo(n.x, n.y, Math.max(camRef.current.k, 0.9));
  }, [glideTo]);

  // ---- draw ---------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const { w, h } = sizeRef.current;
    if (!canvas || w <= 0 || h <= 0) return;        // hidden / unsized frames cost nothing

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      ctxRef.current = ctx;
    }
    if (!ctx) return;

    // Backing store follows CSS size AND devicePixelRatio, every frame — a
    // monitor change or a height-only resize can no longer desync the scale.
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // absolute, never cumulative
    ctx.clearRect(0, 0, w, h);

    const cfg = cfgRef.current || {};
    const preview = variantRef.current === 'preview';
    const engine = getGraphEngine();
    const nodes = engine.nodes();
    const links = engine.links();
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    readPalette();
    drawBackground(ctx, w, h, cfg);

    // --- animation state ---------------------------------------------------
    let more = false;

    const tw = tweenRef.current;
    if (tw) {
      const t = Math.min(1, (now - tw.start) / tw.dur);
      const e = 1 - Math.pow(1 - t, 3);
      camRef.current = {
        x: tw.fromX + (tw.toX - tw.fromX) * e,
        y: tw.fromY + (tw.toY - tw.fromY) * e,
        k: tw.fromK + (tw.toK - tw.fromK) * e,
      };
      if (t >= 1) tweenRef.current = null; else more = true;
    }

    const hov = hoverRef.current;
    const dt = hov.last ? Math.min(64, now - hov.last) : 16;
    hov.last = now;
    const hoverTarget = hov.id ? 1 : 0;
    if (hov.t !== hoverTarget) {
      const step = dt / HOVER_FADE_MS;
      hov.t = hov.t < hoverTarget ? Math.min(hoverTarget, hov.t + step) : Math.max(hoverTarget, hov.t - step);
      more = true;
    }

    // First frame with content: frame the graph, then re-frame once the sim
    // settles — unless a glide already owns the camera, or the user has panned.
    const fit = fitRef.current;
    if (nodes.length && fit.stage < 2) {
      if (tweenRef.current) fit.stage = 2;
      else if (fit.stage === 0) { if (fitToView(false)) fit.stage = 1; }
      else if (!fit.touched && !engine.isRunning()) { fitToView(false); fit.stage = 2; }
    }

    const cam = camRef.current;
    const k = cam.k;
    const camX = cam.x;
    const camY = cam.y;

    const hoverId = hov.id;
    const hoverT = hov.t;
    const hoverOn = hoverT > 0.001 && !!hoverId;
    const neighborhood = hoverOn && (cfg.highlightNeighbors ?? true) ? engine.neighbors(hoverId) : null;
    const dimNodes = neighborhood ? DIM_NODE * hoverT : 0;
    const dimEdges = neighborhood ? DIM_EDGE * hoverT : 0;
    const lit = (id) => !neighborhood || id === hoverId || neighborhood.has(id);

    const lineMul = cfg.lineSizeMultiplier ?? 1;
    const focusId = focusRef.current;

    // --- edges -------------------------------------------------------------
    // No per-link scan: d3 hydrates source/target into node refs, and anything
    // still a string resolves through the engine's O(1) byId map.
    const endpoint = (v) => (typeof v === 'object' ? v : engine.node(v));

    const outcode = (sx, sy) =>
      (sx < -CULL_PAD ? 1 : 0) | (sx > w + CULL_PAD ? 2 : 0) |
      (sy < -CULL_PAD ? 4 : 0) | (sy > h + CULL_PAD ? 8 : 0);

    const showArrow = cfg.showArrow ?? true;
    const headLen = 7 * lineMul;
    const headHalf = 3.2 * lineMul;

    // Two batched passes: the dim/base bundle, then the hovered bundle on top.
    for (let pass = 0; pass < (hoverOn ? 2 : 1); pass++) {
      const hot = pass === 1;
      ctx.strokeStyle = hot ? PALETTE.linkHot : PALETTE.link;
      ctx.lineWidth = (hot ? 1.7 : 0.9) * lineMul;
      ctx.globalAlpha = hot ? 0.55 + 0.45 * hoverT : 0.7;
      ctx.beginPath();

      let heads = false;
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const s = endpoint(l.source);
        const t = endpoint(l.target);
        if (!s || !t) continue;

        const touchesHover = hoverOn && (s.id === hoverId || t.id === hoverId);
        if (hot !== touchesHover) continue;

        const x1 = s.x * k + camX;
        const y1 = s.y * k + camY;
        const x2 = t.x * k + camX;
        const y2 = t.y * k + camY;
        if (outcode(x1, y1) & outcode(x2, y2)) continue;   // trivially off-screen

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        if (showArrow) heads = true;
      }
      if (!hot && dimEdges > 0) ctx.globalAlpha = 0.7 * (1 - dimEdges);
      ctx.stroke();

      if (showArrow && heads) {
        ctx.fillStyle = hot ? PALETTE.linkHot : PALETTE.link;
        ctx.beginPath();
        for (let i = 0; i < links.length; i++) {
          const l = links[i];
          const s = endpoint(l.source);
          const t = endpoint(l.target);
          if (!s || !t) continue;
          const touchesHover = hoverOn && (s.id === hoverId || t.id === hoverId);
          if (hot !== touchesHover) continue;

          const x1 = s.x * k + camX;
          const y1 = s.y * k + camY;
          const x2 = t.x * k + camX;
          const y2 = t.y * k + camY;
          if (outcode(x1, y1) & outcode(x2, y2)) continue;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const rim = screenRadius(t, k) + 1.5;
          if (len < rim + headLen + 2) continue;          // too short to read
          const ux = dx / len;
          const uy = dy / len;
          const tipX = x2 - ux * rim;
          const tipY = y2 - uy * rim;
          const baseX = tipX - ux * headLen;
          const baseY = tipY - uy * headLen;
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(baseX - uy * headHalf, baseY + ux * headHalf);
          ctx.lineTo(baseX + uy * headHalf, baseY - ux * headHalf);
        }
        ctx.fill();
      }
    }

    // --- nodes -------------------------------------------------------------
    const paintNode = (n) => {
      if (!n) return;
      const sx = n.x * k + camX;
      const sy = n.y * k + camY;
      if (outcode(sx, sy)) return;

      const isHover = n.id === hoverId;
      const isFocus = n.id === focusId;
      let a = n.phantom ? 0.62 : 1;
      if (n.dim) a *= SEARCH_DIM;
      if (dimNodes > 0 && !lit(n.id)) a *= 1 - dimNodes;

      const r = screenRadius(n, k) * (isHover ? 1 + 0.28 * hoverT : 1);

      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor(n);
      ctx.fill();

      if (n.phantom) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = PALETTE.border;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isFocus || isHover) {
        ctx.strokeStyle = PALETTE.accent;
        ctx.lineWidth = isFocus ? 2 : 1.5;
        ctx.globalAlpha = isFocus ? 1 : 0.35 + 0.65 * hoverT;
        ctx.beginPath();
        ctx.arc(sx, sy, r + (isFocus ? 3 : 2.5), 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    ctx.globalAlpha = 1;
    for (let i = 0; i < nodes.length; i++) paintNode(nodes[i]);
    // The focused + hovered nodes ride on top of the pack (O(1) lookups).
    if (focusId) paintNode(engine.node(focusId));
    if (hoverId && hoverId !== focusId) paintNode(engine.node(hoverId));
    ctx.globalAlpha = 1;

    // --- labels ------------------------------------------------------------
    // `textFadeMultiplier` shifts the zoom at which labels appear; the focused
    // and hovered nodes are always named regardless.
    const fade = Math.max(0.15, cfg.textFadeMultiplier ?? 1);
    const threshold = (preview ? 1.25 : 0.9) / fade;
    const labelAlpha = Math.max(0, Math.min(1, (k - threshold) / (threshold * 0.35 + 0.001)));
    const fontSize = preview ? 10 : 12;
    const maxChars = preview ? 18 : 28;

    if (labelAlpha > 0.01) {
      ctx.font = `400 ${fontSize}px 'Public Sans', ui-sans-serif, sans-serif`;
      ctx.fillStyle = PALETTE.label;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.id === focusId || n.id === hoverId) continue;   // drawn bold below
        const sx = n.x * k + camX;
        const sy = n.y * k + camY;
        if (outcode(sx, sy)) continue;
        let a = labelAlpha * (n.phantom ? 0.7 : 1);
        if (n.dim) a *= SEARCH_DIM;
        if (dimNodes > 0 && !lit(n.id)) a *= 1 - dimNodes;
        if (a < 0.03) continue;
        ctx.globalAlpha = a;
        ctx.fillText(truncate(n.title, maxChars), sx, sy + screenRadius(n, k) + 4);
      }
      ctx.globalAlpha = 1;
    }

    // Focused + hovered labels: always on, always legible, whatever the zoom.
    ctx.font = `600 ${fontSize + 1}px 'Public Sans', ui-sans-serif, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const paintLabel = (n) => {
      if (!n) return;
      const sx = n.x * k + camX;
      const sy = n.y * k + camY;
      if (outcode(sx, sy)) return;
      const r = screenRadius(n, k) * (n.id === hoverId ? 1 + 0.28 * hoverT : 1);
      ctx.fillStyle = n.id === focusId ? PALETTE.accent : PALETTE.label;
      ctx.fillText(truncate(n.title, maxChars + 6), sx, sy + r + 6);
    };
    if (focusId) paintLabel(engine.node(focusId));
    if (hoverId && hoverId !== focusId) paintLabel(engine.node(hoverId));

    if (more) scheduleDraw();
  }, [fitToView, scheduleDraw]);

  drawRef.current = draw;

  // ---- engine subscription -------------------------------------------------
  useEffect(() => {
    const engine = getGraphEngine();
    const off = engine.subscribe(() => {
      if (pendingFocusRef.current) tryFocusGlide();
      scheduleDraw();
    });
    scheduleDraw();
    return off;
  }, [scheduleDraw, tryFocusGlide]);

  // ---- size ----------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w === sizeRef.current.w && h === sizeRef.current.h) return;
      sizeRef.current = { w, h };
      if (w > 0 && h > 0) {
        if (fitRef.current.stage === 0) tryFocusGlide();
        scheduleDraw();
      }
    };

    measure();
    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(measure);
      if (typeof ro?.observe === 'function') ro.observe(el); else ro = null;
    }

    // Dragging the window to a different-DPR monitor must re-scale the canvas.
    let mq = null;
    const onDpr = () => scheduleDraw();
    try {
      const dpr = window.devicePixelRatio || 1;
      mq = window.matchMedia?.(`(resolution: ${dpr}dppx)`);
      mq?.addEventListener?.('change', onDpr);
    } catch { /* matchMedia is optional */ }

    return () => {
      ro?.disconnect();
      mq?.removeEventListener?.('change', onDpr);
    };
  }, [scheduleDraw, tryFocusGlide]);

  // ---- config / focus ------------------------------------------------------
  useEffect(() => { scheduleDraw(); }, [config, scheduleDraw]);

  useEffect(() => {
    if (!focusPath || !(config.followFocus ?? true)) return;
    pendingFocusRef.current = focusPath;   // survives until the node exists
    tryFocusGlide();
    scheduleDraw();
  }, [focusPath, config.followFocus, tryFocusGlide, scheduleDraw]);

  // ---- interaction ---------------------------------------------------------
  const localPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const [sx, sy] = localPoint(e);
    const n = pickNode(getGraphEngine().nodes(), sx, sy, camRef.current);
    tweenRef.current = null;
    fitRef.current.touched = true;
    if (n) {
      dragRef.current = { id: n.id, pan: null, moved: false };
      getGraphEngine().pin(n.id, n.x, n.y);
    } else {
      dragRef.current = { id: null, pan: { sx, sy, cam: { ...camRef.current } }, moved: false };
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [sx, sy] = localPoint(e);
    const drag = dragRef.current;
    const cam = camRef.current;

    if (drag.id) {
      drag.moved = true;
      getGraphEngine().pin(drag.id, (sx - cam.x) / cam.k, (sy - cam.y) / cam.k);
      canvas.style.cursor = 'grabbing';
      scheduleDraw();
      return;
    }
    if (drag.pan) {
      drag.moved = true;
      camRef.current = { k: cam.k, x: drag.pan.cam.x + (sx - drag.pan.sx), y: drag.pan.cam.y + (sy - drag.pan.sy) };
      canvas.style.cursor = 'grabbing';
      scheduleDraw();
      return;
    }

    const n = pickNode(getGraphEngine().nodes(), sx, sy, cam);
    const id = n ? n.id : null;
    if (id !== hoverRef.current.id) {
      hoverRef.current.id = id;
      scheduleDraw();
    }
    canvas.style.cursor = n ? 'pointer' : 'grab';
  };

  const endDrag = (click) => {
    const drag = dragRef.current;
    if (drag.id) {
      const engine = getGraphEngine();
      const n = engine.node(drag.id);
      if (click && !drag.moved && n && !n.phantom && openRef.current) {
        openRef.current({ path: n.path || n.id, name: n.title });
      }
      engine.unpin(drag.id);
    }
    dragRef.current = { id: null, pan: null, moved: false };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    endDrag(true);
  };

  const handlePointerLeave = () => {
    endDrag(false);
    if (hoverRef.current.id) {
      hoverRef.current.id = null;
      scheduleDraw();
    }
  };

  // Wheel must be a non-passive native listener — React's synthetic wheel is passive.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camRef.current;
      const scale = e.ctrlKey ? 0.01 : 0.0022;         // pinch vs wheel
      const k = clampK(cam.k * Math.exp(-e.deltaY * scale));
      const wx = (sx - cam.x) / cam.k;
      const wy = (sy - cam.y) / cam.k;
      camRef.current = { k, x: sx - wx * k, y: sy - wy * k };
      tweenRef.current = null;
      fitRef.current.touched = true;
      scheduleDraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [scheduleDraw]);

  useEffect(() => () => {
    if (rafRef.current) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current);
      clearTimeout(rafRef.current);
    }
    rafRef.current = 0;
  }, []);

  const btn = 'w-7 h-7 grid place-items-center rounded-md border border-app-border ' +
    'bg-app-panel/85 text-app-muted hover:text-app-text hover:border-app-border/80 transition-colors';

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerLeave}
        onPointerLeave={handlePointerLeave}
      />

      {variant === 'full' && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5" data-testid="graph-frame-toolbar">
          <button type="button" className={btn} title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
            <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button type="button" className={btn} title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
            <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button type="button" className={btn} title="Fit to view" aria-label="Fit to view" onClick={() => { fitRef.current.touched = true; fitToView(true); }}>
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button type="button" className={btn} title="Reset view" aria-label="Reset view" onClick={resetView}>
            <LocateFixed className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}
