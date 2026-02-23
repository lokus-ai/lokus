import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../src/core/security/sanitizer';

describe('PluginHover XSS Protection', () => {
  it('sanitizeHtml strips script tags', () => {
    const malicious = '<p><script>alert("xss")</script>Hello</p>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('sanitizeHtml strips event handlers', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain('onerror');
  });

  it('sanitizeHtml allows safe structural HTML', () => {
    const safe = '<p>Hello</p><br><b>bold</b>';
    const result = sanitizeHtml(safe);
    expect(result).toContain('<p>');
    expect(result).toContain('<br>');
    expect(result).toContain('<b>');
  });

  it('sanitizeHtml handles newline-to-br replacement safely', () => {
    const input = '<img src=x onerror=alert(1)>Hello\nWorld'.replace(/\n/g, '<br>');
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).toContain('<br>');
  });
});
