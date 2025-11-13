/**
 * Input Validation Utilities
 * Provides comprehensive input validation for user data
 */

import validator from 'validator';

/**
 * Validate file path to prevent directory traversal attacks
 * @param {string} filePath - File path to validate
 * @param {string} basePath - Base directory path (optional)
 * @returns {boolean} True if path is safe
 */
export function isValidFilePath(filePath, basePath = '') {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // Check for directory traversal patterns
  const dangerousPatterns = [
    /\.\.\//g,     // Block ../
    /\.\.\\/g,     // Block ..\ (FIXED: was /\.\.\\g/)
    /~\//g,        // Block ~/
    /\/\/+/g,      // Block multiple slashes
    /[<>"|?*]/g    // Block invalid filename chars
  ];

  // Check for dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  // Check for null bytes
  if (filePath.includes('\0')) {
    return false;
  }

  // If basePath is provided, ensure the resolved path stays within it
  if (basePath) {
    try {
      const path = require('path');
      const resolved = path.resolve(basePath, filePath);
      const normalizedBase = path.resolve(basePath);
      
      if (!resolved.startsWith(normalizedBase)) {
        return false;
      }
    } catch (error) {
      // Path module not available in browser
    }
  }

  return true;
}

/**
 * Validate workspace path
 * @param {string} workspacePath - Workspace path to validate
 * @returns {boolean} True if workspace path is valid
 */
export function isValidWorkspacePath(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string') {
    return false;
  }

  // Check minimum and maximum length
  if (workspacePath.length < 1 || workspacePath.length > 4096) {
    return false;
  }

  // Validate as file path
  return isValidFilePath(workspacePath);
}

/**
 * Validate file name
 * @param {string} fileName - File name to validate
 * @returns {boolean} True if file name is valid
 */
export function isValidFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  // Check length
  if (fileName.length < 1 || fileName.length > 255) {
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\\/\0]/;
  if (invalidChars.test(fileName)) {
    return false;
  }

  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reservedNames.test(fileName)) {
    return false;
  }

  // Check for files that start or end with spaces/dots
  if (fileName.startsWith(' ') || fileName.endsWith(' ') || 
      fileName.startsWith('.') || fileName.endsWith('.')) {
    return false;
  }

  return true;
}

/**
 * Validate file extension
 * @param {string} extension - File extension to validate
 * @param {Array<string>} allowedExtensions - Array of allowed extensions
 * @returns {boolean} True if extension is allowed
 */
export function isValidFileExtension(extension, allowedExtensions = []) {
  if (!extension || typeof extension !== 'string') {
    return false;
  }

  const normalizedExt = extension.toLowerCase().replace(/^\./, '');
  
  // Default allowed extensions for Lokus
  const defaultAllowed = ['md', 'txt', 'json', 'canvas', 'html', 'css', 'js', 'jsx'];
  const allowed = allowedExtensions.length > 0 ? allowedExtensions : defaultAllowed;
  
  return allowed.includes(normalizedExt);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    // Use validator.js for URL validation
    if (!validator.isURL(url, {
      protocols: ['http', 'https', 'ftp'],
      require_protocol: true,
      allow_underscores: true,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false
    })) {
      return false;
    }

    // Additional security checks
    const urlObj = new URL(url);
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.includes(urlObj.protocol)) {
      return false;
    }

    // Block local/private IP addresses in production
    const hostname = urlObj.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') || hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      // Allow in development mode
      if (process.env.NODE_ENV !== 'development') {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  return validator.isEmail(email, {
    allow_display_name: false,
    require_display_name: false,
    allow_utf8_local_part: true,
    require_tld: true,
    ignore_max_length: false
  });
}

/**
 * Validate canvas data structure
 * @param {Object} canvasData - Canvas data to validate
 * @returns {boolean} True if canvas data is valid
 */
export function isValidCanvasData(canvasData) {
  if (!canvasData || typeof canvasData !== 'object') {
    return false;
  }

  try {
    // Check for required properties
    const requiredProps = ['nodes', 'edges'];
    for (const prop of requiredProps) {
      if (!Array.isArray(canvasData[prop])) {
        return false;
      }
    }

    // Validate nodes
    for (const node of canvasData.nodes) {
      if (!isValidCanvasNode(node)) {
        return false;
      }
    }

    // Validate edges
    for (const edge of canvasData.edges) {
      if (!isValidCanvasEdge(edge)) {
        return false;
      }
    }

    // Check data size (prevent DoS)
    const dataSize = JSON.stringify(canvasData).length;
    if (dataSize > 10 * 1024 * 1024) { // 10MB limit
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate canvas node
 * @param {Object} node - Canvas node to validate
 * @returns {boolean} True if node is valid
 */
function isValidCanvasNode(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }

  // Required properties
  const requiredProps = ['id', 'x', 'y', 'width', 'height', 'type'];
  for (const prop of requiredProps) {
    if (!(prop in node)) {
      return false;
    }
  }

  // Validate types
  if (typeof node.id !== 'string' || node.id.length > 100) {
    return false;
  }

  if (!Number.isFinite(node.x) || !Number.isFinite(node.y) ||
      !Number.isFinite(node.width) || !Number.isFinite(node.height)) {
    return false;
  }

  // Check reasonable bounds
  if (Math.abs(node.x) > 100000 || Math.abs(node.y) > 100000 ||
      node.width > 10000 || node.height > 10000 ||
      node.width < 0 || node.height < 0) {
    return false;
  }

  // Validate node type
  const validTypes = ['text', 'file', 'group', 'image', 'link'];
  if (!validTypes.includes(node.type)) {
    console.error(`[Canvas Validator] Invalid node type: "${node.type}". Valid types: ${validTypes.join(', ')}`);
    return false;
  }

  // Validate text content if present
  if (node.text && typeof node.text === 'string' && node.text.length > 10000) {
    return false;
  }

  return true;
}

/**
 * Validate canvas edge
 * @param {Object} edge - Canvas edge to validate
 * @returns {boolean} True if edge is valid
 */
function isValidCanvasEdge(edge) {
  if (!edge || typeof edge !== 'object') {
    return false;
  }

  // Required properties
  const requiredProps = ['id', 'fromNode', 'toNode'];
  for (const prop of requiredProps) {
    if (!(prop in edge)) {
      return false;
    }
  }

  // Validate types
  if (typeof edge.id !== 'string' || edge.id.length > 100 ||
      typeof edge.fromNode !== 'string' || edge.fromNode.length > 100 ||
      typeof edge.toNode !== 'string' || edge.toNode.length > 100) {
    return false;
  }

  return true;
}

/**
 * Validate markdown content
 * @param {string} markdown - Markdown content to validate
 * @returns {boolean} True if markdown is valid
 */
export function isValidMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return true; // Empty is valid
  }

  // Check length
  if (markdown.length > 1024 * 1024) { // 1MB limit
    return false;
  }

  // Check for potential XSS in markdown
  const dangerousPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(markdown)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate search query
 * @param {string} query - Search query to validate
 * @returns {boolean} True if query is valid
 */
export function isValidSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }

  // Check length
  if (query.length < 1 || query.length > 500) {
    return false;
  }

  // Check for regex injection patterns
  const dangerousPatterns = [
    /\(\?\=/,  // Positive lookahead
    /\(\?\!/,  // Negative lookahead
    /\(\?\</,  // Positive lookbehind
    /\(\?<!/,  // Negative lookbehind
    /\(\?\#/,  // Comment
    /\(\?\>/,  // Atomic group
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize and validate file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} True if size is valid
 */
export function isValidFileSize(size, maxSize = 100 * 1024 * 1024) { // 100MB default
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return false;
  }

  return size >= 0 && size <= maxSize;
}

/**
 * Rate limiting helper
 * @param {string} key - Unique key for rate limiting
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if request is allowed
 */
export function isRateLimited(key, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const windowKey = `${key}_${Math.floor(now / windowMs)}`;
  
  // Get current count from sessionStorage (browser-safe)
  let count = 0;
  try {
    count = parseInt(sessionStorage.getItem(windowKey) || '0', 10);
  } catch (error) {
    // sessionStorage not available, allow request
    return false;
  }

  if (count >= maxRequests) {
    return true; // Rate limited
  }

  // Increment count
  try {
    sessionStorage.setItem(windowKey, String(count + 1));
  } catch (error) {
    // sessionStorage full or not available, allow request
  }

  return false; // Not rate limited
}