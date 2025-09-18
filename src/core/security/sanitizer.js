/**
 * HTML Sanitization Utilities
 * Provides secure HTML sanitization using DOMPurify
 */

import DOMPurify from 'dompurify';

/**
 * Default DOMPurify configuration for general HTML sanitization
 */
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    // Text formatting
    'b', 'i', 'em', 'strong', 'u', 's', 'del', 'mark', 'sup', 'sub',
    // Structure
    'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li',
    // Links (will be validated separately)
    'a',
    // Code
    'code', 'pre',
    // Tables
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    // Blockquotes
    'blockquote'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'class', 'id', 'data-*'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'iframe', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  KEEP_CONTENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
  SANITIZE_DOM: true,
  FORCE_BODY: false,
  USE_PROFILES: false
};

/**
 * Strict configuration for user input sanitization
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'br'],
  ALLOWED_ATTR: [],
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'iframe', 'form', 'input', 'a'],
  FORBID_ATTR: ['href', 'src', 'onclick', 'onerror', 'onload', 'style'],
  SANITIZE_DOM: true
};

/**
 * Configuration for math content (KaTeX output)
 */
const MATH_CONFIG = {
  ALLOWED_TAGS: [
    // HTML tags used by KaTeX
    'span', 'div', 
    // MathML tags used by KaTeX
    'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac', 
    'munder', 'mover', 'munderover', 'annotation', 'mspace', 'mpadded',
    'menclose', 'mtable', 'mtr', 'mtd', 'mlabeledtr', 'maligngroup', 'malignmark'
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'data-*', 'aria-hidden', 'xmlns', 'display', 'encoding',
    'height', 'width', 'top', 'margin-right', 'margin-left', 'vertical-align'
  ],
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
  SANITIZE_DOM: true,
  // Allow KaTeX-specific styling
  ALLOW_DATA_ATTR: true
};

/**
 * Sanitize HTML content with default security settings
 * @param {string} html - HTML string to sanitize
 * @param {Object} config - Optional DOMPurify configuration override
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHtml(html, config = DEFAULT_CONFIG) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    return DOMPurify.sanitize(html, config);
  } catch (error) {
    return '';
  }
}

/**
 * Sanitize user input with strict security settings
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeUserInput(input) {
  return sanitizeHtml(input, STRICT_CONFIG);
}

/**
 * Sanitize math content (for KaTeX rendered HTML)
 * @param {string} mathHtml - Math HTML to sanitize  
 * @returns {string} Sanitized math HTML
 */
export function sanitizeMathHtml(mathHtml) {
  if (!mathHtml || typeof mathHtml !== 'string') {
    return '';
  }

  // KaTeX generates trusted HTML, so we use minimal sanitization
  // Only remove dangerous script-like content but preserve all formatting
  try {
    const result = DOMPurify.sanitize(mathHtml, {
      ALLOWED_TAGS: false, // Allow all tags
      ALLOWED_ATTR: false, // Allow all attributes  
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'link', 'base'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup'],
      ALLOW_UNKNOWN_PROTOCOLS: false,
      WHOLE_DOCUMENT: false,
      RETURN_DOM_FRAGMENT: false,
      SANITIZE_DOM: false, // Don't sanitize DOM structure
      KEEP_CONTENT: true,   // Keep content even if tags are removed
      ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'annotation'], // Explicitly allow MathML
      ADD_ATTR: ['xmlns', 'display', 'encoding', 'aria-hidden'] // Allow MathML attributes
    });
    
    // Debug log
    return result;
  } catch (error) {
    return mathHtml; // Return unsanitized if sanitization fails
  }
}

/**
 * Sanitize search result highlights
 * @param {string} text - Text with search highlights
 * @returns {string} Sanitized highlighted text
 */
export function sanitizeSearchHighlight(text) {
  const highlightConfig = {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'iframe'],
    SANITIZE_DOM: true
  };
  
  return sanitizeHtml(text, highlightConfig);
}

/**
 * Remove all HTML tags and return plain text
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const stripped = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
    return stripped;
  } catch (error) {
    return html;
  }
}

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate and sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Remove any HTML tags first
  const cleanUrl = stripHtml(url).trim();

  // Check for common XSS payloads
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+=/i,
    /<script/i,
    /&lt;script/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cleanUrl)) {
      return null;
    }
  }

  // Validate URL format
  try {
    const urlObj = new URL(cleanUrl);
    
    // Only allow safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return null;
    }

    return urlObj.href;
  } catch (error) {
    // If URL parsing fails, check if it's a relative URL
    if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./') || cleanUrl.startsWith('../')) {
      // For relative URLs, ensure they don't contain dangerous characters
      if (!/[<>"'`]/.test(cleanUrl)) {
        return cleanUrl;
      }
    }
    return null;
  }
}

/**
 * Check if a string contains potentially malicious content
 * @param {string} input - Input to check
 * @returns {boolean} True if content appears safe
 */
export function isSafeContent(input) {
  if (!input || typeof input !== 'string') {
    return true;
  }

  const dangerousPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /data:.*base64/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Create a safe text node (alternative to innerHTML)
 * @param {string} text - Text content
 * @returns {Text} Safe text node
 */
export function createSafeTextNode(text) {
  return document.createTextNode(text || '');
}

/**
 * Safely set text content of an element
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
export function safeSetTextContent(element, text) {
  if (!element) return;
  element.textContent = text || '';
}

/**
 * Safely set HTML content with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content to set
 * @param {Object} config - DOMPurify configuration
 */
export function safeSetInnerHTML(element, html, config = DEFAULT_CONFIG) {
  if (!element) return;
  const sanitized = sanitizeHtml(html, config);
  element.innerHTML = sanitized;
}