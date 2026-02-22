import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MCP Server Auth Token', () => {
  const testDir = join(tmpdir(), 'lokus-auth-test-' + Date.now());
  const tokenPath = join(testDir, 'mcp-token');

  beforeAll(() => { mkdirSync(testDir, { recursive: true }); });
  afterAll(() => { rmSync(testDir, { recursive: true, force: true }); });

  it('generateSessionToken creates a 64-char hex token file', async () => {
    const { generateSessionToken } = await import('../../src/mcp-server/auth.js');
    const token = generateSessionToken(tokenPath);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(tokenPath)).toBe(true);
    expect(readFileSync(tokenPath, 'utf-8').trim()).toBe(token);
  });

  it('validateBearerToken accepts valid token', async () => {
    const { generateSessionToken, validateBearerToken } = await import('../../src/mcp-server/auth.js');
    const token = generateSessionToken(tokenPath);
    expect(validateBearerToken(`Bearer ${token}`, tokenPath)).toBe(true);
  });

  it('validateBearerToken rejects invalid token', async () => {
    const { generateSessionToken, validateBearerToken } = await import('../../src/mcp-server/auth.js');
    generateSessionToken(tokenPath);
    expect(validateBearerToken('Bearer wrong-token', tokenPath)).toBe(false);
    expect(validateBearerToken('', tokenPath)).toBe(false);
    expect(validateBearerToken('Basic abc123', tokenPath)).toBe(false);
  });
});
