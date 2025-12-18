/**
 * Canvas Preview Generator
 * Generates SVG thumbnails from TLDraw canvas files with TTL caching
 *
 * Features:
 * - Parses TLDraw snapshot format from .canvas files
 * - Converts shapes to SVG elements (text, geo, arrow, image)
 * - 5-minute TTL cache for performance
 * - Handles edge cases: empty canvases, parse errors, large canvases
 * - Returns SVG as base64 data URL
 */

import { canvasManager } from './manager.js';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PREVIEW_WIDTH = 400;
const MAX_PREVIEW_HEIGHT = 300;
const DEFAULT_CANVAS_WIDTH = 1000;
const DEFAULT_CANVAS_HEIGHT = 800;

/**
 * Preview cache entry structure
 * @typedef {Object} CacheEntry
 * @property {string} svg - SVG data URL
 * @property {number} timestamp - Creation timestamp in milliseconds
 * @property {string} canvasPath - Path to the canvas file
 */

/**
 * Cache storage: Map<canvasPath, CacheEntry>
 */
const previewCache = new Map();

/**
 * Generate SVG preview from canvas file
 *
 * @param {string} canvasPath - Absolute path to the .canvas file
 * @returns {Promise<string>} SVG data URL (data:image/svg+xml;base64,...)
 * @throws {Error} If canvas cannot be loaded or generated
 */
export async function generatePreview(canvasPath) {
  try {
    // Validate input
    if (!canvasPath || typeof canvasPath !== 'string') {
      throw new Error('Invalid canvas path');
    }

    // Resolve path if it's not absolute (just a canvas name)
    let resolvedPath = canvasPath;
    if (!canvasPath.startsWith('/') && !canvasPath.includes('/')) {
      // Try to find the canvas in the file index
      const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
      const canvasFileName = canvasPath.endsWith('.canvas') ? canvasPath : `${canvasPath}.canvas`;

      const matchedFile = fileIndex.find(file => {
        const fileName = file.name || file.path.split('/').pop();
        return fileName === canvasFileName || fileName === canvasPath;
      });

      if (matchedFile) {
        resolvedPath = matchedFile.path;
      }
    }

    // Check cache first (use resolved path for caching)
    const cached = getCachedPreview(resolvedPath);
    if (cached) {
      return cached;
    }

    // Load canvas data using canvas manager
    const tldrawSnapshot = await canvasManager.loadCanvas(resolvedPath);

    // Validate snapshot structure
    if (!tldrawSnapshot || typeof tldrawSnapshot !== 'object') {
      throw new Error('Invalid canvas data structure');
    }

    // Parse shapes from snapshot
    const shapes = extractShapes(tldrawSnapshot);

    // Handle empty canvas
    if (shapes.length === 0) {
      const emptySvg = createEmptyCanvasSvg();
      return cacheSvg(canvasPath, emptySvg);
    }

    // Calculate canvas bounds
    const bounds = calculateBounds(shapes);

    // Generate SVG from shapes
    const svg = generateSvgFromShapes(shapes, bounds);

    // Cache and return
    return cacheSvg(canvasPath, svg);

  } catch (error) {

    // Return error placeholder SVG
    const errorSvg = createErrorSvg(error.message);
    return svgToDataUrl(errorSvg);
  }
}

/**
 * Get cached preview if available and not expired
 *
 * @param {string} canvasPath - Absolute path to the .canvas file
 * @returns {string|null} Cached SVG data URL or null
 */
export function getCachedPreview(canvasPath) {
  const entry = previewCache.get(canvasPath);

  if (!entry) {
    return null;
  }

  // Check if cache entry has expired
  const now = Date.now();
  const age = now - entry.timestamp;

  if (age > CACHE_TTL_MS) {
    // Expired - remove from cache
    previewCache.delete(canvasPath);
    return null;
  }

  return entry.svg;
}

/**
 * Invalidate cache for specific canvas
 *
 * @param {string} canvasPath - Absolute path to the .canvas file
 * @returns {boolean} True if cache entry was removed, false if not found
 */
export function invalidateCache(canvasPath) {
  return previewCache.delete(canvasPath);
}

/**
 * Clear all expired cache entries
 * Should be called periodically for memory management
 *
 * @returns {number} Number of entries removed
 */
export function clearOldCache() {
  const now = Date.now();
  let removedCount = 0;

  for (const [path, entry] of previewCache.entries()) {
    const age = now - entry.timestamp;

    if (age > CACHE_TTL_MS) {
      previewCache.delete(path);
      removedCount++;
    }
  }

  return removedCount;
}

/**
 * Clear all cache entries (for testing or memory management)
 *
 * @returns {number} Number of entries cleared
 */
export function clearAllCache() {
  const count = previewCache.size;
  previewCache.clear();
  return count;
}

/**
 * Get cache statistics
 *
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const entry of previewCache.values()) {
    const age = now - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  }

  return {
    totalEntries: previewCache.size,
    validEntries,
    expiredEntries,
    cacheTtlMs: CACHE_TTL_MS
  };
}

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================

/**
 * Extract shape records from TLDraw snapshot
 * @private
 */
function extractShapes(tldrawSnapshot) {
  // Handle format with records array (TLDraw export format)
  if (tldrawSnapshot.records && Array.isArray(tldrawSnapshot.records)) {
    return tldrawSnapshot.records.filter(record =>
      record.typeName === 'shape' && record.type
    );
  }

  // Handle format with document.store (Lokus canvas format)
  if (tldrawSnapshot.document?.store) {
    const store = tldrawSnapshot.document.store;
    return Object.values(store).filter(record =>
      record.typeName === 'shape' && record.type
    );
  }

  // Handle format with just store (alternative format)
  if (tldrawSnapshot.store) {
    const store = tldrawSnapshot.store;
    return Object.values(store).filter(record =>
      record.typeName === 'shape' && record.type
    );
  }

  return [];
}

/**
 * Calculate bounding box for all shapes
 * @private
 */
function calculateBounds(shapes) {
  if (shapes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: DEFAULT_CANVAS_WIDTH,
      maxY: DEFAULT_CANVAS_HEIGHT,
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  shapes.forEach(shape => {
    const x = shape.x || 0;
    const y = shape.y || 0;

    // Handle draw shapes - calculate bounds from segment points
    if (shape.type === 'draw' && shape.props?.segments) {
      for (const segment of shape.props.segments) {
        for (const point of segment.points || []) {
          minX = Math.min(minX, x + point.x);
          minY = Math.min(minY, y + point.y);
          maxX = Math.max(maxX, x + point.x);
          maxY = Math.max(maxY, y + point.y);
        }
      }
    }
    // Handle arrow shapes - calculate bounds from start/end points
    else if (shape.type === 'arrow') {
      const startX = x + (shape.props?.start?.x || 0);
      const startY = y + (shape.props?.start?.y || 0);
      const endX = x + (shape.props?.end?.x || 0);
      const endY = y + (shape.props?.end?.y || 0);

      minX = Math.min(minX, startX, endX);
      minY = Math.min(minY, startY, endY);
      maxX = Math.max(maxX, startX, endX);
      maxY = Math.max(maxY, startY, endY);
    }
    // Handle standard shapes with w/h
    else {
      const width = shape.props?.w || 100;
      const height = shape.props?.h || 50;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
  });

  // Add padding
  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Generate SVG from shapes and bounds
 * @private
 */
function generateSvgFromShapes(shapes, bounds) {
  const { minX, minY, width, height } = bounds;

  // Calculate scale to fit within preview dimensions
  const scaleX = MAX_PREVIEW_WIDTH / width;
  const scaleY = MAX_PREVIEW_HEIGHT / height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

  const viewBoxWidth = width;
  const viewBoxHeight = height;
  const finalWidth = Math.round(width * scale);
  const finalHeight = Math.round(height * scale);

  // Build SVG elements for each shape
  const shapeElements = shapes
    .map(shape => convertShapeToSvg(shape, minX, minY))
    .filter(Boolean) // Remove null elements
    .join('\n    ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${finalWidth}"
     height="${finalHeight}"
     viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <g transform="translate(${-minX}, ${-minY})">
    ${shapeElements}
  </g>
</svg>`;

  return svg;
}

/**
 * Convert TLDraw shape to SVG element
 * @private
 */
function convertShapeToSvg(shape, offsetX = 0, offsetY = 0) {
  const x = shape.x || 0;
  const y = shape.y || 0;
  const color = getColorHex(shape.props?.color || 'black');
  const opacity = shape.opacity || 1;

  switch (shape.type) {
    case 'text':
      return convertTextShape(shape, x, y, color, opacity);

    case 'geo':
      return convertGeoShape(shape, x, y, color, opacity);

    case 'arrow':
      return convertArrowShape(shape, x, y, color, opacity);

    case 'image':
      return convertImageShape(shape, x, y, opacity);

    case 'draw':
      return convertDrawShape(shape, x, y, color, opacity);

    default:
      // Unsupported shape type - render as placeholder rectangle
      const width = shape.props?.w || 100;
      const height = shape.props?.h || 50;
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#ddd" stroke-width="1" stroke-dasharray="5,5" opacity="${opacity}" />`;
  }
}

/**
 * Convert text shape to SVG
 * @private
 */
function convertTextShape(shape, x, y, color, opacity) {
  const width = shape.props?.w || 200;
  const scale = shape.props?.scale || 1;

  // Extract text from richText format or fallback to text property
  let text = '';
  if (shape.props?.richText?.content) {
    // New richText format
    text = shape.props.richText.content
      .map(para => {
        if (para.content) {
          return para.content.map(node => node.text || '').join('');
        }
        return '';
      })
      .join('\n');
  } else {
    // Fallback to old format
    text = shape.props?.text || '';
  }

  if (!text) {
    return null;
  }

  // Calculate font size based on size prop and scale
  const baseFontSize = shape.props?.size === 's' ? 16 : shape.props?.size === 'l' ? 32 : 24;
  const fontSize = baseFontSize * scale;

  // Escape HTML entities in text
  const escapedText = escapeXml(text);

  // Handle text alignment
  const textAlign = shape.props?.textAlign || 'start';
  const anchor = textAlign === 'middle' ? 'middle' : textAlign === 'end' ? 'end' : 'start';
  const textX = textAlign === 'middle' ? x + width / 2 : textAlign === 'end' ? x + width : x;

  // Split into lines
  const lines = escapedText.split('\n');
  const lineHeight = fontSize * 1.2;

  const textElements = lines.map((line, i) =>
    `<tspan x="${textX}" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`
  ).join('\n      ');

  return `<text x="${textX}" y="${y + fontSize}" font-size="${fontSize}" fill="${color}" opacity="${opacity}" font-family="sans-serif" text-anchor="${anchor}">
      ${textElements}
    </text>`;
}

/**
 * Convert geo (geometric) shape to SVG
 * @private
 */
function convertGeoShape(shape, x, y, color, opacity) {
  const width = shape.props?.w || 100;
  const height = shape.props?.h || 100;
  const geo = shape.props?.geo || 'rectangle';
  const fill = shape.props?.fill === 'solid' ? color : 'none';
  const text = shape.props?.text || '';

  let shapeElement = '';

  switch (geo) {
    case 'rectangle':
      shapeElement = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${color}" stroke-width="2" opacity="${opacity}" />`;
      break;

    case 'ellipse':
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = width / 2;
      const ry = height / 2;
      shapeElement = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${color}" stroke-width="2" opacity="${opacity}" />`;
      break;

    case 'triangle':
      const points = `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`;
      shapeElement = `<polygon points="${points}" fill="${fill}" stroke="${color}" stroke-width="2" opacity="${opacity}" />`;
      break;

    case 'diamond':
      const diamondPoints = `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`;
      shapeElement = `<polygon points="${diamondPoints}" fill="${fill}" stroke="${color}" stroke-width="2" opacity="${opacity}" />`;
      break;

    default:
      shapeElement = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${color}" stroke-width="2" opacity="${opacity}" />`;
  }

  // Add text if present
  if (text) {
    const fontSize = 14;
    const textX = x + width / 2;
    const textY = y + height / 2 + fontSize / 3;
    const escapedText = escapeXml(text.substring(0, 20)); // Limit text length
    shapeElement += `\n    <text x="${textX}" y="${textY}" font-size="${fontSize}" fill="${color}" text-anchor="middle" font-family="sans-serif">${escapedText}</text>`;
  }

  return shapeElement;
}

/**
 * Convert arrow shape to SVG
 * @private
 */
function convertArrowShape(shape, x, y, color, opacity) {
  const startX = shape.props?.start?.x || 0;
  const startY = shape.props?.start?.y || 0;
  const endX = shape.props?.end?.x || 100;
  const endY = shape.props?.end?.y || 0;

  // Calculate absolute positions
  const x1 = x + startX;
  const y1 = y + startY;
  const x2 = x + endX;
  const y2 = y + endY;

  // Calculate arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLength = 10;
  const arrowAngle = Math.PI / 6;

  const arrowX1 = x2 - arrowLength * Math.cos(angle - arrowAngle);
  const arrowY1 = y2 - arrowLength * Math.sin(angle - arrowAngle);
  const arrowX2 = x2 - arrowLength * Math.cos(angle + arrowAngle);
  const arrowY2 = y2 - arrowLength * Math.sin(angle + arrowAngle);

  return `<g opacity="${opacity}">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" />
      <polygon points="${x2},${y2} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}" fill="${color}" />
    </g>`;
}

/**
 * Convert image shape to SVG
 * @private
 */
function convertImageShape(shape, x, y, opacity) {
  const width = shape.props?.w || 100;
  const height = shape.props?.h || 100;

  // For preview, just show a placeholder rectangle with image icon
  return `<g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="rgba(128, 128, 128, 0.2)" stroke="rgba(128, 128, 128, 0.5)" stroke-width="1" />
      <text x="${x + width / 2}" y="${y + height / 2}" font-size="24" text-anchor="middle" alignment-baseline="middle">🖼️</text>
    </g>`;
}

/**
 * Convert draw shape to SVG
 * @private
 */
function convertDrawShape(shape, x, y, color, opacity) {
  const segments = shape.props?.segments || [];

  if (segments.length === 0) {
    return null;
  }

  // Convert segments to SVG path data
  let pathData = '';

  for (const segment of segments) {
    const points = segment.points || [];
    if (points.length === 0) continue;

    // Move to first point
    const firstPoint = points[0];
    pathData += `M ${x + firstPoint.x} ${y + firstPoint.y} `;

    // Line to subsequent points
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      pathData += `L ${x + point.x} ${y + point.y} `;
    }
  }

  if (!pathData) {
    return null;
  }

  const strokeWidth = shape.props?.size === 's' ? 1 : shape.props?.size === 'l' ? 3 : 2;

  return `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
}

/**
 * Convert TLDraw color names to hex values
 * TLDraw's "black" color appears as white/light on dark backgrounds,
 * so we map it to a light color for preview visibility
 * @private
 */
function getColorHex(colorName) {
  const colorMap = {
    black: '#e1e1e1',  // Light gray for dark mode visibility
    grey: '#adb5bd',
    'light-gray': '#ced4da',
    white: '#ffffff',
    blue: '#4dabf7',
    'light-blue': '#74c0fc',
    violet: '#9775fa',
    'light-violet': '#b197fc',
    red: '#ff6b6b',
    'light-red': '#ff8787',
    orange: '#fd7e14',
    yellow: '#fcc419',
    green: '#51cf66',
    'light-green': '#8ce99a'
  };

  return colorMap[colorName] || '#e1e1e1';
}

/**
 * Escape XML special characters
 * @private
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Simple text wrapping
 * @private
 */
function wrapText(text, maxChars) {
  if (!text) return [];

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).length > maxChars && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 5); // Limit to 5 lines for preview
}

/**
 * Create empty canvas SVG
 * @private
 */
function createEmptyCanvasSvg() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${MAX_PREVIEW_WIDTH}"
     height="${MAX_PREVIEW_HEIGHT}"
     viewBox="0 0 ${MAX_PREVIEW_WIDTH} ${MAX_PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <text x="50%" y="50%" font-size="16" fill="#666" text-anchor="middle" alignment-baseline="middle" font-family="sans-serif">Empty Canvas</text>
</svg>`;

  return svg;
}

/**
 * Create error placeholder SVG
 * @private
 */
function createErrorSvg(errorMessage) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${MAX_PREVIEW_WIDTH}"
     height="${MAX_PREVIEW_HEIGHT}"
     viewBox="0 0 ${MAX_PREVIEW_WIDTH} ${MAX_PREVIEW_HEIGHT}">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="4" />
  <text x="50%" y="40%" font-size="32" text-anchor="middle" alignment-baseline="middle">⚠️</text>
  <text x="50%" y="60%" font-size="14" fill="#ff6b6b" text-anchor="middle" alignment-baseline="middle" font-family="sans-serif">Preview Error</text>
</svg>`;

  return svg;
}

/**
 * Convert SVG string to base64 data URL
 * @private
 */
function svgToDataUrl(svg) {
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Cache SVG and return data URL
 * @private
 */
function cacheSvg(canvasPath, svg) {
  const dataUrl = svgToDataUrl(svg);

  previewCache.set(canvasPath, {
    svg: dataUrl,
    timestamp: Date.now(),
    canvasPath
  });

  return dataUrl;
}
