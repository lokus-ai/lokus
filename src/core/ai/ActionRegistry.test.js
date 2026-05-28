import { describe, it, expect, beforeEach, vi } from 'vitest';
import ActionRegistry, { actionRegistry } from './ActionRegistry.js';

/** Minimal valid action factory. */
function makeAction(overrides = {}) {
  return {
    id: 'test.action',
    title: 'Test Action',
    description: 'A test action',
    handler: vi.fn(async () => ({ type: 'text', content: 'ok' })),
    ...overrides,
  };
}

describe('ActionRegistry', () => {
  let registry;
  beforeEach(() => {
    registry = new ActionRegistry();
  });

  describe('register / unregister', () => {
    it('registers an action and exposes it via get/exists/getAll', () => {
      const disposable = registry.register(makeAction());
      expect(registry.exists('test.action')).toBe(true);
      expect(registry.get('test.action').title).toBe('Test Action');
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.count).toBe(1);
      expect(typeof disposable.dispose).toBe('function');
    });

    it('applies defaults for optional fields', () => {
      registry.register(makeAction());
      const entry = registry.get('test.action');
      expect(entry.category).toBe('plugin');
      expect(entry.surfaces).toEqual(['palette']);
      expect(entry.creditCost).toBe('medium');
      expect(entry.requiresNetwork).toBe(true);
      expect(entry.params).toEqual({});
      expect(entry.pluginId).toBeNull();
    });

    it('throws when id, title or handler is missing', () => {
      expect(() => registry.register({ title: 'x', handler: () => {} })).toThrow();
      expect(() => registry.register({ id: 'x', handler: () => {} })).toThrow();
      expect(() => registry.register({ id: 'x', title: 'x' })).toThrow();
    });

    it('throws on duplicate id', () => {
      registry.register(makeAction());
      expect(() => registry.register(makeAction())).toThrow(/already registered/);
    });

    it('disposable.dispose() unregisters', () => {
      const d = registry.register(makeAction());
      d.dispose();
      expect(registry.exists('test.action')).toBe(false);
    });

    it('emits action-registered and action-unregistered', () => {
      const onReg = vi.fn();
      const onUnreg = vi.fn();
      registry.on('action-registered', onReg);
      registry.on('action-unregistered', onUnreg);
      registry.register(makeAction());
      registry.unregister('test.action');
      expect(onReg).toHaveBeenCalledOnce();
      expect(onUnreg).toHaveBeenCalledOnce();
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      registry.register(makeAction({ id: 'a.one', surfaces: ['palette', 'agent'], category: 'vault', creditCost: 'free' }));
      registry.register(makeAction({ id: 'a.two', surfaces: ['slash'], category: 'editor', creditCost: 'medium' }));
      registry.register(makeAction({ id: 'a.three', surfaces: ['agent'], category: 'vault', creditCost: 'free' }));
    });

    it('getAll returns the unified tool list', () => {
      expect(registry.getAll().map((a) => a.id).sort()).toEqual(['a.one', 'a.three', 'a.two']);
    });
    it('bySurface filters by surface', () => {
      expect(registry.bySurface('agent').map((a) => a.id).sort()).toEqual(['a.one', 'a.three']);
      expect(registry.bySurface('slash').map((a) => a.id)).toEqual(['a.two']);
    });
    it('byCategory filters by category', () => {
      expect(registry.byCategory('vault')).toHaveLength(2);
      expect(registry.byCategory('editor')).toHaveLength(1);
    });
    it('freeActions returns free-cost actions', () => {
      expect(registry.freeActions().map((a) => a.id).sort()).toEqual(['a.one', 'a.three']);
    });
    it('clearPlugin removes only that plugin\'s actions', () => {
      registry.register(makeAction({ id: 'p.x', pluginId: 'plug-1' }));
      registry.register(makeAction({ id: 'p.y', pluginId: 'plug-1' }));
      registry.clearPlugin('plug-1');
      expect(registry.exists('p.x')).toBe(false);
      expect(registry.exists('p.y')).toBe(false);
      expect(registry.getAll()).toHaveLength(3);
    });
  });

  describe('execute', () => {
    it('calls the handler with params and context, returns the result', async () => {
      const handler = vi.fn(async (params) => ({ type: 'text', content: params.q }));
      registry.register(makeAction({ handler }));
      const result = await registry.execute('test.action', { q: 'hi' }, {});
      expect(handler).toHaveBeenCalledWith({ q: 'hi' }, {});
      expect(result).toEqual({ type: 'text', content: 'hi' });
    });

    it('throws and emits action-error for unknown id', async () => {
      const onErr = vi.fn();
      registry.on('action-error', onErr);
      await expect(registry.execute('nope', {}, {})).rejects.toThrow(/not found/);
      expect(onErr).toHaveBeenCalledOnce();
    });

    it('emits action-executed with duration on success', async () => {
      const onExec = vi.fn();
      registry.on('action-executed', onExec);
      registry.register(makeAction());
      await registry.execute('test.action', {}, {});
      expect(onExec).toHaveBeenCalledOnce();
      expect(onExec.mock.calls[0][0]).toMatchObject({ id: 'test.action' });
      expect(typeof onExec.mock.calls[0][0].durationMs).toBe('number');
    });

    it('enforces requiresEditor', async () => {
      registry.register(makeAction({ requiresEditor: true }));
      await expect(registry.execute('test.action', {}, {})).rejects.toThrow(/requires an active editor/);
      const ctx = { editorAPI: { editorInstance: { state: {} } } };
      await expect(registry.execute('test.action', {}, ctx)).resolves.toBeDefined();
    });

    it('enforces requiresSelection', async () => {
      registry.register(makeAction({ requiresSelection: true }));
      const emptySel = { editorAPI: { editorInstance: { state: { selection: { empty: true } } } } };
      await expect(registry.execute('test.action', {}, emptySel)).rejects.toThrow(/requires a selection/);
      const liveSel = { editorAPI: { editorInstance: { state: { selection: { empty: false } } } } };
      await expect(registry.execute('test.action', {}, liveSel)).resolves.toBeDefined();
    });

    it('propagates and emits handler errors', async () => {
      const onErr = vi.fn();
      registry.on('action-error', onErr);
      registry.register(makeAction({ handler: async () => { throw new Error('boom'); } }));
      await expect(registry.execute('test.action', {}, {})).rejects.toThrow('boom');
      expect(onErr).toHaveBeenCalledOnce();
    });
  });

  describe('toToolSchema', () => {
    beforeEach(() => {
      registry.register(makeAction({
        id: 'note.create',
        description: 'Create a note',
        surfaces: ['agent', 'palette'],
        category: 'vault',
        params: {
          path: { type: 'string', description: 'Note path', required: true },
          content: { type: 'string', description: 'Body', required: true },
          tags: { type: 'array', description: 'Tags', items: { type: 'string' }, default: [] },
          mode: { type: 'string', enum: ['a', 'b'], description: 'Mode' },
        },
      }));
    });

    it('emits valid Anthropic JSON Schema (name, description, input_schema)', () => {
      const [tool] = registry.toToolSchema();
      expect(tool.name).toBe('note_create'); // dots sanitized to underscores
      expect(tool.description).toBe('Create a note');
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties.path).toEqual({ type: 'string', description: 'Note path' });
      expect(tool.input_schema.properties.tags).toMatchObject({ type: 'array', items: { type: 'string' }, default: [] });
      expect(tool.input_schema.properties.mode).toMatchObject({ enum: ['a', 'b'] });
      expect(tool.input_schema.required.sort()).toEqual(['content', 'path']);
    });

    it('omits required[] when no params are required', () => {
      registry.register(makeAction({ id: 'no.req', params: { x: { type: 'string', description: 'x' } } }));
      const tool = registry.toToolSchema().find((t) => t.name === 'no_req');
      expect(tool.input_schema.required).toBeUndefined();
    });

    it('emits OpenAI function shape when provider=openai', () => {
      const [tool] = registry.toToolSchema({ provider: 'openai' });
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBe('note_create');
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.required.sort()).toEqual(['content', 'path']);
    });

    it('filters by surface and category', () => {
      registry.register(makeAction({ id: 'other.tool', surfaces: ['slash'], category: 'editor' }));
      expect(registry.toToolSchema({ surface: 'agent' }).map((t) => t.name)).toEqual(['note_create']);
      expect(registry.toToolSchema({ category: 'editor' }).map((t) => t.name)).toEqual(['other_tool']);
    });
  });

  describe('toMcpManifest', () => {
    it('keeps the dotted id and attaches _lokus metadata', () => {
      registry.register(makeAction({
        id: 'vault.search',
        description: 'Search vault',
        surfaces: ['agent'],
        category: 'vault',
        creditCost: 'free',
        icon: 'Search',
        params: { query: { type: 'string', description: 'q', required: true } },
      }));
      const { tools } = registry.toMcpManifest();
      const tool = tools.find((t) => t.name === 'vault.search');
      expect(tool.name).toBe('vault.search'); // NOT sanitized for MCP
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toEqual(['query']);
      expect(tool._lokus).toMatchObject({ surfaces: ['agent'], category: 'vault', creditCost: 'free', icon: 'Search' });
      // MCP manifest must not carry `default` per spec.
      expect(JSON.stringify(tool.inputSchema)).not.toContain('default');
    });

    it('filters by surface', () => {
      registry.register(makeAction({ id: 'a.x', surfaces: ['agent'] }));
      registry.register(makeAction({ id: 'a.y', surfaces: ['palette'] }));
      expect(registry.toMcpManifest({ surface: 'agent' }).tools.map((t) => t.name)).toEqual(['a.x']);
    });
  });

  it('exports a shared singleton', () => {
    expect(actionRegistry).toBeInstanceOf(ActionRegistry);
  });
});
