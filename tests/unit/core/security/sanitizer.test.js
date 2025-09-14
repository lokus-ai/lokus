import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeHtml,
  sanitizeUserInput,
  sanitizeMathHtml,
  sanitizeSearchHighlight,
  createSafeTextNode,
  safeSetInnerHTML,
  safeSetTextContent
} from '../../../../src/core/security/sanitizer.js';

// Mock DOM environment
const mockDocument = {
  createElement: (tag) => ({
    tagName: tag,
    textContent: '',
    innerHTML: '',
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    hasAttribute: () => false,
    cloneNode: () => mockDocument.createElement(tag)
  }),
  createTextNode: (text) => ({
    nodeType: 3,
    textContent: text,
    nodeValue: text
  })
};

// Mock DOMPurify
const mockDOMPurify = {
  sanitize: (html, config) => {
    // Simple mock that removes script tags and dangerous attributes
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  },
  isSupported: true
};

// Mock globalThis/window for browser environment
global.DOMPurify = mockDOMPurify;
global.document = mockDocument;

describe('Security Sanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const maliciousHtml = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(maliciousHtml);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("xss")');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should remove dangerous attributes', () => {
      const maliciousHtml = '<div onclick="alert(\'xss\')" onmouseover="steal()">Safe content</div>';
      const result = sanitizeHtml(maliciousHtml);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('Safe content');
    });

    it('should remove javascript: protocols', () => {
      const maliciousHtml = '<a href="javascript:alert(\'xss\')">Click me</a>';
      const result = sanitizeHtml(maliciousHtml);
      expect(result).not.toContain('javascript:');
    });

    it('should handle null and undefined inputs', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeHtml(123)).toBe('');
      expect(sanitizeHtml({})).toBe('');
      expect(sanitizeHtml([])).toBe('');
    });

    it('should preserve safe HTML', () => {
      const safeHtml = '<p><strong>Bold text</strong> and <em>italic text</em></p>';
      const result = sanitizeHtml(safeHtml);
      expect(result).toBe(safeHtml);
    });
  });

  describe('sanitizeUserInput', () => {
    it('should trim whitespace', () => {
      expect(sanitizeUserInput('  hello world  ')).toBe('hello world');
    });

    it('should remove control characters', () => {
      const input = 'hello\x00\x01\x02world';
      const result = sanitizeUserInput(input);
      expect(result).toBe('helloworld');
    });

    it('should limit length', () => {
      const longInput = 'a'.repeat(2000);
      const result = sanitizeUserInput(longInput);
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeUserInput(null)).toBe('');
      expect(sanitizeUserInput(undefined)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeUserInput(123)).toBe('123');
      expect(sanitizeUserInput({})).toBe('[object Object]');
    });
  });

  describe('sanitizeMathHtml', () => {
    it('should allow math-specific elements', () => {
      const mathHtml = '<span class="katex"><span class="katex-mathml">x^2</span></span>';
      const result = sanitizeMathHtml(mathHtml);
      expect(result).toContain('katex');
      expect(result).toContain('x^2');
    });

    it('should remove script tags from math content', () => {
      const maliciousMath = '<span class="katex">x^2<script>alert("xss")</script></span>';
      const result = sanitizeMathHtml(maliciousMath);
      expect(result).not.toContain('<script>');
      expect(result).toContain('x^2');
    });

    it('should handle invalid math HTML', () => {
      expect(sanitizeMathHtml(null)).toBe('');
      expect(sanitizeMathHtml('')).toBe('');
    });
  });

  describe('sanitizeSearchHighlight', () => {
    it('should allow mark tags for highlighting', () => {
      const highlighted = 'Hello <mark>world</mark>';
      const result = sanitizeSearchHighlight(highlighted);
      expect(result).toContain('<mark>');
      expect(result).toContain('world');
    });

    it('should remove dangerous content from highlighted text', () => {
      const malicious = 'Hello <mark onclick="alert(\'xss\')">world</mark>';
      const result = sanitizeSearchHighlight(malicious);
      expect(result).not.toContain('onclick');
      expect(result).toContain('<mark>');
    });

    it('should handle empty inputs', () => {
      expect(sanitizeSearchHighlight('')).toBe('');
      expect(sanitizeSearchHighlight(null)).toBe('');
    });
  });

  describe('DOM manipulation functions', () => {
    let mockElement;

    beforeEach(() => {
      mockElement = {
        textContent: '',
        innerHTML: '',
        appendChild: vi.fn(),
        removeChild: vi.fn()
      };
    });

    describe('createSafeTextNode', () => {
      it('should create a text node with sanitized content', () => {
        const result = createSafeTextNode('Hello world');
        expect(result.textContent).toBe('Hello world');
      });

      it('should sanitize the text content', () => {
        const result = createSafeTextNode('<script>alert("xss")</script>');
        expect(result.textContent).not.toContain('<script>');
      });
    });

    describe('safeSetTextContent', () => {
      it('should set text content safely', () => {
        safeSetTextContent(mockElement, 'Hello world');
        expect(mockElement.textContent).toBe('Hello world');
      });

      it('should sanitize malicious content', () => {
        safeSetTextContent(mockElement, '<script>alert("xss")</script>');
        expect(mockElement.textContent).not.toContain('<script>');
      });

      it('should handle null element', () => {
        expect(() => safeSetTextContent(null, 'test')).not.toThrow();
      });
    });

    describe('safeSetInnerHTML', () => {
      it('should set innerHTML with sanitized content', () => {
        safeSetInnerHTML(mockElement, '<p>Hello world</p>');
        expect(mockElement.innerHTML).toBe('<p>Hello world</p>');
      });

      it('should remove dangerous content', () => {
        safeSetInnerHTML(mockElement, '<p>Hello</p><script>alert("xss")</script>');
        expect(mockElement.innerHTML).not.toContain('<script>');
        expect(mockElement.innerHTML).toContain('<p>Hello</p>');
      });

      it('should handle null element', () => {
        expect(() => safeSetInnerHTML(null, '<p>test</p>')).not.toThrow();
      });
    });
  });
});