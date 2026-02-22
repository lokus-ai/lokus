import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('MCP Path Traversal Protection', () => {
  const workspace = join(tmpdir(), 'lokus-path-test-' + Date.now());

  beforeAll(() => {
    mkdirSync(join(workspace, 'notes'), { recursive: true });
    writeFileSync(join(workspace, 'notes', 'test.md'), 'hello');
  });

  afterAll(() => { rmSync(workspace, { recursive: true, force: true }); });

  it('allows relative paths within workspace', async () => {
    const { validateNotePath } = await import('../../src/mcp-server/tools/notes.js');
    const result = validateNotePath(workspace, 'notes/test.md');
    expect(result).toBe(join(workspace, 'notes', 'test.md'));
  });

  it('rejects absolute paths outside workspace', async () => {
    const { validateNotePath } = await import('../../src/mcp-server/tools/notes.js');
    expect(() => validateNotePath(workspace, '/etc/passwd')).toThrow('Path escapes workspace');
  });

  it('rejects ../ traversal', async () => {
    const { validateNotePath } = await import('../../src/mcp-server/tools/notes.js');
    expect(() => validateNotePath(workspace, '../../../etc/passwd')).toThrow('Path escapes workspace');
  });

  it('rejects ../ hidden in middle of path', async () => {
    const { validateNotePath } = await import('../../src/mcp-server/tools/notes.js');
    expect(() => validateNotePath(workspace, 'notes/../../etc/passwd')).toThrow('Path escapes workspace');
  });

  it('allows paths with .. that resolve within workspace', async () => {
    const { validateNotePath } = await import('../../src/mcp-server/tools/notes.js');
    const result = validateNotePath(workspace, 'notes/../notes/test.md');
    expect(result).toBe(join(workspace, 'notes', 'test.md'));
  });
});
