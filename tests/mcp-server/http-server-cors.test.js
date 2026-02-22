import { describe, it, expect } from 'vitest';

describe('MCP Server CORS', () => {
  it('should reject unknown origins', () => {
    const ALLOWED_ORIGINS = [
      'http://localhost',
      'http://127.0.0.1',
      'tauri://localhost',
      'https://tauri.localhost'
    ];

    function isOriginAllowed(origin) {
      if (!origin) return false;
      return ALLOWED_ORIGINS.some(ao =>
        origin === ao || origin.startsWith(ao + ':')
      );
    }

    expect(isOriginAllowed('http://evil.com')).toBe(false);
    expect(isOriginAllowed('http://localhost')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3456')).toBe(true);
    expect(isOriginAllowed('tauri://localhost')).toBe(true);
    expect(isOriginAllowed('https://tauri.localhost')).toBe(true);
    expect(isOriginAllowed('https://evil.localhost')).toBe(false);
    expect(isOriginAllowed('')).toBe(false);
  });
});
