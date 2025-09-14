/**
 * Security Module
 * Central export point for all security utilities
 */

// Sanitization utilities
export {
  sanitizeHtml,
  sanitizeUserInput,
  sanitizeMathHtml,
  sanitizeSearchHighlight,
  stripHtml,
  sanitizeUrl,
  isSafeContent,
  createSafeTextNode,
  safeSetTextContent,
  safeSetInnerHTML
} from './sanitizer.js';

// Validation utilities
export {
  isValidFilePath,
  isValidWorkspacePath,
  isValidFileName,
  isValidFileExtension,
  isValidUrl,
  isValidEmail,
  isValidCanvasData,
  isValidMarkdown,
  isValidSearchQuery,
  isValidFileSize,
  isRateLimited
} from './validator.js';

/**
 * Security configuration
 */
export const SECURITY_CONFIG = {
  // File size limits
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_CANVAS_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_MARKDOWN_SIZE: 1024 * 1024,    // 1MB
  
  // String length limits
  MAX_FILENAME_LENGTH: 255,
  MAX_FILEPATH_LENGTH: 4096,
  MAX_SEARCH_QUERY_LENGTH: 500,
  MAX_TEXT_NODE_LENGTH: 10000,
  
  // Rate limiting
  DEFAULT_RATE_LIMIT: 100,
  DEFAULT_RATE_WINDOW: 60000, // 1 minute
  
  // Allowed file extensions
  ALLOWED_FILE_EXTENSIONS: [
    'md', 'txt', 'json', 'canvas', 'html', 'css', 'js', 'jsx'
  ],
  
  // Security headers
  SECURITY_HEADERS: {
    'Content-Security-Policy': 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https:; " +
      "media-src 'self' data:; " +
      "object-src 'none'; " +
      "frame-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'none';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  }
};

/**
 * Initialize security measures
 */
export function initializeSecurity() {
  // Set up Content Security Policy violation reporting
  if (typeof window !== 'undefined') {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.warn('CSP Violation:', {
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        sourceFile: event.sourceFile
      });
      
      // In production, you might want to report this to an error tracking service
      if (process.env.NODE_ENV === 'production') {
        // reportCSPViolation(event);
      }
    });

    // Set up global error handler for security-related errors
    window.addEventListener('error', (event) => {
      if (event.error && event.error.name === 'SecurityError') {
        console.error('Security Error:', event.error);
        // Handle security errors appropriately
      }
    });
  }
}

/**
 * Security audit helper - checks for common security issues
 * @param {Object} options - Audit options
 * @returns {Object} Audit results
 */
export function performSecurityAudit(options = {}) {
  const issues = [];
  const warnings = [];
  
  // Check if running in secure context
  if (typeof window !== 'undefined') {
    if (!window.isSecureContext && location.protocol !== 'http:' && location.hostname !== 'localhost') {
      issues.push('Application is not running in a secure context (HTTPS)');
    }
    
    // Check for dangerous globals
    const dangerousGlobals = ['eval', '__dirname', '__filename', 'process', 'global'];
    dangerousGlobals.forEach(global => {
      if (window[global] && typeof window[global] !== 'undefined') {
        warnings.push(`Dangerous global '${global}' is available`);
      }
    });
    
    // Check Content Security Policy
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!metaCSP) {
      warnings.push('No Content Security Policy meta tag found');
    }
    
    // Check for mixed content
    if (location.protocol === 'https:') {
      const insecureElements = document.querySelectorAll('[src^="http:"], [href^="http:"]');
      if (insecureElements.length > 0) {
        warnings.push(`Found ${insecureElements.length} elements with insecure (HTTP) URLs`);
      }
    }
  }
  
  return {
    timestamp: new Date().toISOString(),
    issues: issues,
    warnings: warnings,
    passed: issues.length === 0,
    score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5))
  };
}

/**
 * Create secure execution context for user code
 * @param {string} code - Code to execute safely
 * @param {Object} context - Allowed context variables
 * @returns {any} Result of safe execution
 */
export function safeExecute(code, context = {}) {
  // This is a placeholder for safe code execution
  // In a real implementation, you would use a proper sandbox
  throw new Error('Safe code execution not implemented - use a proper sandbox');
}

/**
 * Generate a nonce for inline scripts/styles
 * @returns {string} Base64 encoded nonce
 */
export function generateNonce() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array));
  }
  
  // Fallback for environments without crypto API
  return btoa(Math.random().toString()).substring(0, 16);
}