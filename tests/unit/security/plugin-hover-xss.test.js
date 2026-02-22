import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../src/core/security/sanitizer';

describe('PluginHover XSS Protection', () => {
  it('sanitizeHtml strips script tags', () => {
    const malicious = '<script>alert("xss")</script>Hello';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('sanitizeHtml strips event handlers', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain('onerror');
  });

  it('sanitizeHtml allows safe HTML', () => {
    const safe = 'Hello <b>world</b><br>line 2';
    const result = sanitizeHtml(safe);
    expect(result).toContain('<b>world</b>');
    expect(result).toContain('<br>');
  });

  it('sanitizeHtml handles newline-to-br replacement safely', () => {
    const input = '<img src=x onerror=alert(1)>Hello\nWorld'.replace(/\n/g, '<br>');
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).toContain('<br>');
  });
});
