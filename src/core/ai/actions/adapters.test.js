import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock the wrapped sources (we adapt them at runtime, never edit them). ---
const emitMock = vi.fn(async () => {});
vi.mock('@tauri-apps/api/event', () => ({ emit: (...a) => emitMock(...a) }));

vi.mock('../../shortcuts/registry.js', () => ({
  ACTIONS: [
    { id: 'save-file', name: 'Save File', event: 'lokus:save-file' },
    { id: 'format-bold', name: 'Bold', event: 'lokus:format-bold' },
    { id: 'insert-table', name: 'Insert Table', event: 'lokus:insert-table' },
  ],
}));

const executeNoteToolMock = vi.fn(async () => ({ content: [{ type: 'text', text: 'result text' }] }));
vi.mock('../../../mcp-server/tools/notes.js', () => ({
  notesTools: [
    {
      name: 'create_note',
      description: 'Create a new note',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path' },
          content: { type: 'string', description: 'Body' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list_notes',
      description: 'List notes',
      inputSchema: {
        type: 'object',
        properties: { sortBy: { type: 'string', enum: ['name', 'modified'], description: 'Sort' } },
      },
    },
  ],
  executeNoteTool: (...a) => executeNoteToolMock(...a),
}));

import ActionRegistry from '../ActionRegistry.js';
import { registerBuiltinActions } from './builtin-actions.js';
import { registerVaultActions } from './vault-actions.js';

describe('builtin-actions adapter', () => {
  let registry;
  beforeEach(() => {
    registry = new ActionRegistry();
    emitMock.mockClear();
  });

  it('wraps every ACTION as a free, network-free system action', () => {
    const ids = registerBuiltinActions(registry);
    expect(ids).toEqual(['save-file', 'format-bold', 'insert-table']);
    for (const a of registry.getAll()) {
      expect(a.category).toBe('system');
      expect(a.creditCost).toBe('free');
      expect(a.requiresNetwork).toBe(false);
    }
  });

  it('marks format-/insert- actions as editor + slash surfaces', () => {
    registerBuiltinActions(registry);
    expect(registry.get('save-file').surfaces).toEqual(['palette']);
    expect(registry.get('save-file').requiresEditor).toBe(false);
    expect(registry.get('format-bold').surfaces).toEqual(['palette', 'slash']);
    expect(registry.get('format-bold').requiresEditor).toBe(true);
    expect(registry.get('insert-table').requiresEditor).toBe(true);
  });

  it('handler re-emits the original Tauri event', async () => {
    registerBuiltinActions(registry);
    const result = await registry.execute('save-file', {}, {});
    expect(emitMock).toHaveBeenCalledWith('lokus:save-file');
    expect(result).toEqual({ type: 'text', content: 'Executed: Save File' });
  });

  it('is idempotent across re-runs (skips already-registered ids)', () => {
    registerBuiltinActions(registry);
    const second = registerBuiltinActions(registry);
    expect(second).toEqual([]);
    expect(registry.count).toBe(3);
  });
});

describe('vault-actions adapter', () => {
  let registry;
  beforeEach(() => {
    registry = new ActionRegistry();
    executeNoteToolMock.mockClear();
  });

  it('wraps notes tools as vault.* free agent/palette actions', () => {
    const ids = registerVaultActions('/ws', registry);
    expect(ids).toEqual(['vault.create_note', 'vault.list_notes']);
    const create = registry.get('vault.create_note');
    expect(create.title).toBe('create note');
    expect(create.category).toBe('vault');
    expect(create.creditCost).toBe('free');
    expect(create.surfaces).toEqual(['agent', 'palette']);
  });

  it('converts MCP inputSchema to registry params (required + enum)', () => {
    registerVaultActions('/ws', registry);
    const create = registry.get('vault.create_note');
    expect(create.params.path).toMatchObject({ type: 'string', required: true });
    expect(create.params.content).toMatchObject({ type: 'string', required: true });
    const list = registry.get('vault.list_notes');
    expect(list.params.sortBy).toMatchObject({ required: false, enum: ['name', 'modified'] });
  });

  it('toToolSchema round-trips the converted params', () => {
    registerVaultActions('/ws', registry);
    const tool = registry.toToolSchema().find((t) => t.name === 'vault_create_note');
    expect(tool.input_schema.required.sort()).toEqual(['content', 'path']);
  });

  it('handler delegates to executeNoteTool with ctx.workspacePath override', async () => {
    registerVaultActions('/default-ws', registry);
    const result = await registry.execute('vault.create_note', { path: 'a.md', content: 'x' }, { workspacePath: '/override-ws' });
    expect(executeNoteToolMock).toHaveBeenCalledWith('create_note', { path: 'a.md', content: 'x' }, '/override-ws', null);
    expect(result).toEqual({ type: 'text', content: 'result text' });
  });

  it('falls back to the default workspace when ctx has none', async () => {
    registerVaultActions('/default-ws', registry);
    await registry.execute('vault.list_notes', {}, {});
    expect(executeNoteToolMock).toHaveBeenCalledWith('list_notes', {}, '/default-ws', null);
  });

  it('is idempotent across re-runs', () => {
    registerVaultActions('/ws', registry);
    expect(registerVaultActions('/ws2', registry)).toEqual([]);
    expect(registry.count).toBe(2);
  });
});
