/**
 * Graph Preview Generator
 * Generates SVG thumbnails from .graph files with TTL caching.
 * Follows the same pattern as canvas/preview-generator.js.
 */

import { loadGraphFile } from './GraphFileManager.js';
import expressionEngine from './ExpressionEngine.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PREVIEW_WIDTH = 400;
const PREVIEW_HEIGHT = 300;
const SAMPLE_COUNT = 200;

/** @type {Map<string, {svg: string, timestamp: number}>} */
const previewCache = new Map();

/**
 * Generate SVG preview from a .graph file.
 * @param {string} graphPath - Relative path to the .graph file
 * @returns {Promise<string>} SVG data URL
 */
export async function generateGraphPreview(graphPath) {
  try {
    if (!graphPath || typeof graphPath !== 'string') {
      throw new Error('Invalid graph path');
    }

    // Resolve path if it's just a name
    let resolvedPath = graphPath;
    if (!graphPath.startsWith('/') && !graphPath.includes('/')) {
      const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
      const variants = [graphPath];
      if (!graphPath.endsWith('.graph')) variants.push(`${graphPath}.graph`);
      const matched = fileIndex.find(f => {
        const name = f.name || f.path.split('/').pop();
        return variants.includes(name);
      });
      if (matched) resolvedPath = matched.path;
    }

    // Check cache
    const cached = getCachedPreview(resolvedPath);
    if (cached) return cached;

    // Load graph data
    const graphData = await loadGraphFile(resolvedPath);
    if (!graphData) throw new Error('Failed to load graph');

    const expressions = (graphData.expressions || []).filter(e => e.visible !== false);
    if (expressions.length === 0) {
      return cacheSvg(resolvedPath, createEmptySvg(graphData.metadata?.title));
    }

    // Build variable scope
    const scope = {};
    for (const v of graphData.variables || []) {
      scope[v.name] = v.value;
    }

    // Get viewport
    const vp = graphData.viewport || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

    // Render curves
    const svg = renderGraphSvg(expressions, scope, vp, graphData.metadata?.title);
    return cacheSvg(resolvedPath, svg);
  } catch (error) {
    console.warn('[GraphPreview] Error:', error);
    return svgToDataUrl(createErrorSvg());
  }
}

// --- Cache API (same interface as canvas preview-generator) ---

export function getCachedPreview(path) {
  const entry = previewCache.get(path);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    previewCache.delete(path);
    return null;
  }
  return entry.svg;
}

export function invalidateGraphCache(path) {
  return previewCache.delete(path);
}

export function clearAllGraphCache() {
  const count = previewCache.size;
  previewCache.clear();
  return count;
}

// --- Internal rendering ---

function renderGraphSvg(expressions, scope, viewport, title) {
  const { xMin, xMax, yMin, yMax } = viewport;
  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // Map math coords to SVG coords
  const toSvgX = (x) => ((x - xMin) / xRange) * PREVIEW_WIDTH;
  const toSvgY = (y) => ((yMax - y) / yRange) * PREVIEW_HEIGHT; // flip Y

  // Build grid lines
  const gridLines = [];
  const gridColor = 'rgba(255,255,255,0.06)';
  const axisColor = 'rgba(255,255,255,0.2)';

  // Grid
  const gridStep = niceStep(xRange / 8);
  const gridStartX = Math.ceil(xMin / gridStep) * gridStep;
  for (let gx = gridStartX; gx <= xMax; gx += gridStep) {
    const sx = toSvgX(gx);
    const color = Math.abs(gx) < gridStep * 0.01 ? axisColor : gridColor;
    const width = Math.abs(gx) < gridStep * 0.01 ? 1.5 : 0.5;
    gridLines.push(`<line x1="${sx}" y1="0" x2="${sx}" y2="${PREVIEW_HEIGHT}" stroke="${color}" stroke-width="${width}" />`);
  }
  const gridStartY = Math.ceil(yMin / gridStep) * gridStep;
  for (let gy = gridStartY; gy <= yMax; gy += gridStep) {
    const sy = toSvgY(gy);
    const color = Math.abs(gy) < gridStep * 0.01 ? axisColor : gridColor;
    const width = Math.abs(gy) < gridStep * 0.01 ? 1.5 : 0.5;
    gridLines.push(`<line x1="0" y1="${sy}" x2="${PREVIEW_WIDTH}" y2="${sy}" stroke="${color}" stroke-width="${width}" />`);
  }

  // Render each expression as an SVG path
  const paths = [];
  for (const expr of expressions) {
    const compiled = expressionEngine.compile(expr.latex);
    if (!compiled || compiled.error || !compiled.fn) continue;

    const plotFn = expressionEngine.createPlotFunction(compiled, scope);
    if (!plotFn) continue;

    const color = expr.color || '#c0392b';
    const pathData = sampleExpression(compiled.type, plotFn, xMin, xMax, yMin, yMax);
    if (pathData) {
      paths.push(`<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`);
    }
  }

  // Title
  const titleText = title ? escapeXml(title) : '';
  const titleSvg = titleText
    ? `<text x="8" y="18" font-size="11" fill="rgba(255,255,255,0.5)" font-family="system-ui, -apple-system, sans-serif">${titleText}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  ${gridLines.join('\n  ')}
  ${paths.join('\n  ')}
  ${titleSvg}
</svg>`;
}

/**
 * Sample an expression and return an SVG path data string.
 */
function sampleExpression(type, plotFn, xMin, xMax, yMin, yMax) {
  const toSvgX = (x) => ((x - xMin) / (xMax - xMin)) * PREVIEW_WIDTH;
  const toSvgY = (y) => ((yMax - y) / (yMax - yMin)) * PREVIEW_HEIGHT;

  if (type === 'explicit') {
    // y = f(x) or x = f(y)
    if (plotFn.xOfY) {
      // x = f(y) — sample over y range
      return sampleParametric(
        (t) => { try { return plotFn(t); } catch { return NaN; } },
        (t) => t,
        yMin, yMax, xMin, xMax, yMin, yMax, toSvgX, toSvgY
      );
    }
    // y = f(x)
    return sampleFunctionGraph(plotFn, xMin, xMax, yMin, yMax, toSvgX, toSvgY);
  }

  if (type === 'implicit') {
    // F(x,y) = 0 — sample as contour (simplified: just evaluate on a grid)
    return sampleImplicit(plotFn, xMin, xMax, yMin, yMax, toSvgX, toSvgY);
  }

  if (type === 'parametric') {
    return sampleParametric(
      plotFn.x, plotFn.y, 0, 2 * Math.PI,
      xMin, xMax, yMin, yMax, toSvgX, toSvgY
    );
  }

  if (type === 'polar') {
    return sampleParametric(
      (t) => { try { const r = plotFn(t); return r * Math.cos(t); } catch { return NaN; } },
      (t) => { try { const r = plotFn(t); return r * Math.sin(t); } catch { return NaN; } },
      0, 2 * Math.PI,
      xMin, xMax, yMin, yMax, toSvgX, toSvgY
    );
  }

  if (type === 'surface3d') {
    // z = f(x, y) — render as y = f(x, 0) cross-section (same as 2D board)
    if (typeof plotFn === 'function') {
      const fn2d = (x) => { try { return plotFn(x, 0); } catch { return NaN; } };
      return sampleFunctionGraph(fn2d, xMin, xMax, yMin, yMax, toSvgX, toSvgY);
    }
    return null;
  }

  if (type === 'point') {
    // Render as a small circle
    const px = typeof plotFn.x === 'function' ? plotFn.x() : plotFn.x;
    const py = typeof plotFn.y === 'function' ? plotFn.y() : plotFn.y;
    if (isFinite(px) && isFinite(py)) {
      const sx = toSvgX(px);
      const sy = toSvgY(py);
      // Return a small circle path
      return `M ${sx - 3} ${sy} a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`;
    }
    return null;
  }

  return null;
}

function sampleFunctionGraph(fn, xMin, xMax, yMin, yMax, toSvgX, toSvgY) {
  const segments = [];
  let currentSegment = [];

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const x = xMin + (i / SAMPLE_COUNT) * (xMax - xMin);
    let y;
    try { y = fn(x); } catch { y = NaN; }

    if (isFinite(y) && y >= yMin - (yMax - yMin) && y <= yMax + (yMax - yMin)) {
      const sx = toSvgX(x);
      const sy = toSvgY(y);
      currentSegment.push(`${sx.toFixed(1)} ${sy.toFixed(1)}`);
    } else {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    }
  }

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  if (segments.length === 0) return null;

  return segments
    .map(seg => `M ${seg[0]} L ${seg.slice(1).join(' L ')}`)
    .join(' ');
}

function sampleParametric(xFn, yFn, tMin, tMax, xMin, xMax, yMin, yMax, toSvgX, toSvgY) {
  const segments = [];
  let currentSegment = [];

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = tMin + (i / SAMPLE_COUNT) * (tMax - tMin);
    let x, y;
    try { x = xFn(t); y = yFn(t); } catch { x = NaN; y = NaN; }

    if (isFinite(x) && isFinite(y)) {
      const sx = toSvgX(x);
      const sy = toSvgY(y);
      currentSegment.push(`${sx.toFixed(1)} ${sy.toFixed(1)}`);
    } else {
      if (currentSegment.length >= 2) segments.push(currentSegment);
      currentSegment = [];
    }
  }

  if (currentSegment.length >= 2) segments.push(currentSegment);
  if (segments.length === 0) return null;

  return segments
    .map(seg => `M ${seg[0]} L ${seg.slice(1).join(' L ')}`)
    .join(' ');
}

function sampleImplicit(fn, xMin, xMax, yMin, yMax, toSvgX, toSvgY) {
  // Marching-squares-lite: find zero crossings on a grid
  const gridSize = 60;
  const dx = (xMax - xMin) / gridSize;
  const dy = (yMax - yMin) / gridSize;
  const segments = [];

  // Evaluate the function on the grid
  const grid = [];
  for (let i = 0; i <= gridSize; i++) {
    grid[i] = [];
    const y = yMin + i * dy;
    for (let j = 0; j <= gridSize; j++) {
      const x = xMin + j * dx;
      try { grid[i][j] = fn(x, y); } catch { grid[i][j] = NaN; }
    }
  }

  // Find zero crossings between adjacent cells
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const v00 = grid[i][j];
      const v10 = grid[i][j + 1];
      const v01 = grid[i + 1][j];
      const v11 = grid[i + 1][j + 1];

      if (!isFinite(v00) || !isFinite(v10) || !isFinite(v01) || !isFinite(v11)) continue;

      const x0 = xMin + j * dx;
      const y0 = yMin + i * dy;

      // Check edges for sign changes
      const edges = [];

      if (v00 * v10 < 0) {
        const t = v00 / (v00 - v10);
        edges.push([x0 + t * dx, y0]);
      }
      if (v10 * v11 < 0) {
        const t = v10 / (v10 - v11);
        edges.push([x0 + dx, y0 + t * dy]);
      }
      if (v01 * v11 < 0) {
        const t = v01 / (v01 - v11);
        edges.push([x0 + t * dx, y0 + dy]);
      }
      if (v00 * v01 < 0) {
        const t = v00 / (v00 - v01);
        edges.push([x0, y0 + t * dy]);
      }

      if (edges.length >= 2) {
        const sx1 = toSvgX(edges[0][0]).toFixed(1);
        const sy1 = toSvgY(edges[0][1]).toFixed(1);
        const sx2 = toSvgX(edges[1][0]).toFixed(1);
        const sy2 = toSvgY(edges[1][1]).toFixed(1);
        segments.push(`M ${sx1} ${sy1} L ${sx2} ${sy2}`);
      }
    }
  }

  return segments.length > 0 ? segments.join(' ') : null;
}

/**
 * Compute a "nice" grid step for the given range.
 */
function niceStep(rough) {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  if (frac <= 1.5) return pow;
  if (frac <= 3.5) return pow * 2;
  if (frac <= 7.5) return pow * 5;
  return pow * 10;
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createEmptySvg(title) {
  const label = title ? escapeXml(title) : 'Empty Graph';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <text x="50%" y="50%" font-size="14" fill="#666" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${label}</text>
</svg>`;
}

function createErrorSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <text x="50%" y="50%" font-size="14" fill="#ff6b6b" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">Preview Error</text>
</svg>`;
}

function svgToDataUrl(svg) {
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

function cacheSvg(path, svg) {
  const dataUrl = svgToDataUrl(svg);
  previewCache.set(path, { svg: dataUrl, timestamp: Date.now() });
  return dataUrl;
}
