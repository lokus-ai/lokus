import { describe, it, expect } from 'vitest';

describe('Plugin Sandbox', () => {
  it('should shadow window in sandboxed function', () => {
    const fn = new Function(
      'module', 'exports', 'require',
      'window', 'document', 'globalThis', 'self',
      'fetch', 'XMLHttpRequest', 'eval', 'Function',
      'setTimeout', 'setInterval', 'importScripts',
      'return { hasWindow: typeof window !== "undefined", hasDocument: typeof document !== "undefined", hasFetch: typeof fetch !== "undefined" }'
    );
    const result = fn(
      {exports:{}}, {}, () => ({}),
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined
    );
    expect(result.hasWindow).toBe(false);
    expect(result.hasDocument).toBe(false);
    expect(result.hasFetch).toBe(false);
  });

  it('should still allow whitelisted require calls', () => {
    const mockSDK = { version: '1.0' };
    const require = (id) => {
      if (id === 'lokus-plugin-sdk') return mockSDK;
      return {};
    };
    const fn = new Function(
      'module', 'exports', 'require',
      'window', 'document', 'globalThis', 'self',
      'fetch', 'XMLHttpRequest', 'eval', 'Function',
      'setTimeout', 'setInterval', 'importScripts',
      'var sdk = require("lokus-plugin-sdk"); module.exports = sdk;'
    );
    const mod = { exports: {} };
    fn(mod, mod.exports, require,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined
    );
    expect(mod.exports.version).toBe('1.0');
  });
});
