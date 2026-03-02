/**
 * Canvas Preview Generator
 * Generates SVG thumbnails from Excalidraw canvas files with TTL caching
 *
 * Features:
 * - Parses Excalidraw JSON format from .excalidraw files
 * - Converts elements to SVG (rectangle, ellipse, diamond, text, arrow, line, freedraw)
 * - 5-minute TTL cache for performance
 * - Returns SVG as base64 data URL
 */

import { canvasManager } from './manager.js';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PREVIEW_WIDTH = 400;
const MAX_PREVIEW_HEIGHT = 300;

/** @type {Map<string, {svg: string, timestamp: number}>} */
const previewCache = new Map();

/**
 * Generate SVG preview from canvas file
 * @param {string} canvasPath - Absolute path to the .excalidraw file
 * @returns {Promise<string>} SVG data URL
 */
export async function generatePreview(canvasPath) {
  try {
    if (!canvasPath || typeof canvasPath !== 'string') {
      throw new Error('Invalid canvas path');
    }

    // Resolve path if it's just a name (no slashes)
    let resolvedPath = canvasPath;
    if (!canvasPath.startsWith('/') && !canvasPath.includes('/')) {
      const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
      const variants = [canvasPath];
      if (!canvasPath.endsWith('.excalidraw')) variants.push(`${canvasPath}.excalidraw`);
      if (!canvasPath.endsWith('.canvas')) variants.push(`${canvasPath}.canvas`);

      const matched = fileIndex.find(f => {
        const name = f.name || f.path.split('/').pop();
        return variants.includes(name);
      });
      if (matched) resolvedPath = matched.path;
    }

    // Check cache
    const cached = getCachedPreview(resolvedPath);
    if (cached) return cached;

    // Load canvas data
    const data = await canvasManager.loadCanvas(resolvedPath);
    if (!data || typeof data !== 'object') throw new Error('Invalid canvas data');

    const elements = (data.elements || []).filter(el => !el.isDeleted);

    if (elements.length === 0) {
      return cacheSvg(resolvedPath, createEmptySvg());
    }

    const bounds = calculateBounds(elements);
    const svg = renderSvg(elements, bounds);
    return cacheSvg(resolvedPath, svg);
  } catch (error) {
    return svgToDataUrl(createErrorSvg());
  }
}

// --- Cache API ---

export function getCachedPreview(canvasPath) {
  const entry = previewCache.get(canvasPath);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    previewCache.delete(canvasPath);
    return null;
  }
  return entry.svg;
}

export function invalidateCache(canvasPath) {
  return previewCache.delete(canvasPath);
}

export function clearOldCache() {
  const now = Date.now();
  let removed = 0;
  for (const [path, entry] of previewCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      previewCache.delete(path);
      removed++;
    }
  }
  return removed;
}

export function clearAllCache() {
  const count = previewCache.size;
  previewCache.clear();
  return count;
}

export function getCacheStats() {
  const now = Date.now();
  let valid = 0, expired = 0;
  for (const entry of previewCache.values()) {
    if (now - entry.timestamp > CACHE_TTL_MS) expired++;
    else valid++;
  }
  return { totalEntries: previewCache.size, validEntries: valid, expiredEntries: expired, cacheTtlMs: CACHE_TTL_MS };
}

// --- Internal ---

function calculateBounds(elements) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of elements) {
    const x = el.x || 0;
    const y = el.y || 0;

    if (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') {
      const pts = el.points || [];
      for (const p of pts) {
        minX = Math.min(minX, x + p[0]);
        minY = Math.min(minY, y + p[1]);
        maxX = Math.max(maxX, x + p[0]);
        maxY = Math.max(maxY, y + p[1]);
      }
      // Fallback if no points
      if (pts.length === 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + (el.width || 0));
        maxY = Math.max(maxY, y + (el.height || 0));
      }
    } else {
      const w = el.width || 0;
      const h = el.height || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  }

  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function renderSvg(elements, bounds) {
  const { minX, minY, width, height } = bounds;
  const scale = Math.min(MAX_PREVIEW_WIDTH / width, MAX_PREVIEW_HEIGHT / height, 1);
  const finalW = Math.round(width * scale);
  const finalH = Math.round(height * scale);

  const shapes = elements
    .map(el => elementToSvg(el))
    .filter(Boolean)
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${finalW}" height="${finalH}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <g transform="translate(${-minX}, ${-minY})">
    ${shapes}
  </g>
</svg>`;
}

function elementToSvg(el) {
  const x = el.x || 0;
  const y = el.y || 0;
  const w = el.width || 0;
  const h = el.height || 0;
  const stroke = el.strokeColor || '#e1e1e1';
  const bg = el.backgroundColor || 'transparent';
  const fill = bg === 'transparent' ? 'none' : bg;
  const opacity = (el.opacity != null ? el.opacity : 100) / 100;
  const sw = el.strokeWidth || 2;
  const angle = el.angle || 0;

  const transform = angle ? ` transform="rotate(${(angle * 180) / Math.PI}, ${x + w / 2}, ${y + h / 2})"` : '';

  switch (el.type) {
    case 'rectangle':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${transform} />`;

    case 'ellipse': {
      const cx = x + w / 2, cy = y + h / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${transform} />`;
    }

    case 'diamond': {
      const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${transform} />`;
    }

    case 'text': {
      const fontSize = el.fontSize || 20;
      const textAlign = el.textAlign || 'left';
      const anchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
      const textX = textAlign === 'center' ? x + w / 2 : textAlign === 'right' ? x + w : x;
      const text = el.text || el.originalText || '';
      if (!text) return null;

      const lines = escapeXml(text).split('\n');
      const lineH = fontSize * 1.2;
      const tspans = lines.map((line, i) =>
        `<tspan x="${textX}" dy="${i === 0 ? 0 : lineH}">${line}</tspan>`
      ).join('');

      return `<text x="${textX}" y="${y + fontSize}" font-size="${fontSize}" fill="${stroke}" opacity="${opacity}" font-family="sans-serif" text-anchor="${anchor}"${transform}>${tspans}</text>`;
    }

    case 'arrow':
    case 'line': {
      const pts = el.points || [];
      if (pts.length < 2) return null;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x + p[0]} ${y + p[1]}`).join(' ');
      let svg = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;

      // Arrowhead for arrow type
      if (el.type === 'arrow' && pts.length >= 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const ax = x + last[0], ay = y + last[1];
        const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        const aLen = 10, aAngle = Math.PI / 6;
        const ax1 = ax - aLen * Math.cos(angle - aAngle);
        const ay1 = ay - aLen * Math.sin(angle - aAngle);
        const ax2 = ax - aLen * Math.cos(angle + aAngle);
        const ay2 = ay - aLen * Math.sin(angle + aAngle);
        svg += `\n    <polygon points="${ax},${ay} ${ax1},${ay1} ${ax2},${ay2}" fill="${stroke}" opacity="${opacity}" />`;
      }
      return svg;
    }

    case 'freedraw': {
      const pts = el.points || [];
      if (pts.length < 2) return null;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x + p[0]} ${y + p[1]}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
    }

    case 'image':
      return `<g opacity="${opacity}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(128,128,128,0.2)" stroke="rgba(128,128,128,0.5)" stroke-width="1"${transform} /><text x="${x + w / 2}" y="${y + h / 2 + 6}" font-size="14" text-anchor="middle" fill="#666" font-family="sans-serif">Image</text></g>`;

    case 'frame':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="5,5" opacity="${opacity}"${transform} />`;

    default:
      return null;
  }
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function createEmptySvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${MAX_PREVIEW_WIDTH}" height="${MAX_PREVIEW_HEIGHT}" viewBox="0 0 ${MAX_PREVIEW_WIDTH} ${MAX_PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <text x="50%" y="50%" font-size="16" fill="#666" text-anchor="middle" alignment-baseline="middle" font-family="sans-serif">Empty Canvas</text>
</svg>`;
}

function createErrorSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${MAX_PREVIEW_WIDTH}" height="${MAX_PREVIEW_HEIGHT}" viewBox="0 0 ${MAX_PREVIEW_WIDTH} ${MAX_PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <text x="50%" y="50%" font-size="14" fill="#ff6b6b" text-anchor="middle" alignment-baseline="middle" font-family="sans-serif">Preview Error</text>
</svg>`;
}

function svgToDataUrl(svg) {
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

function cacheSvg(canvasPath, svg) {
  const dataUrl = svgToDataUrl(svg);
  previewCache.set(canvasPath, { svg: dataUrl, timestamp: Date.now() });
  return dataUrl;
}
