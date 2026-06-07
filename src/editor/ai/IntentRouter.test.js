import { describe, it, expect, afterEach } from 'vitest';
import { setProvider } from './aiClient.js';
import {
  route,
  tier0,
  tier1,
  tier2,
  fuzzyScore,
  KEYWORD_TABLE,
  TIER0_THRESHOLD,
} from './IntentRouter.js';

/** Minimal actionRegistry stand-in. */
function makeRegistry(actions = []) {
  return {
    getAll: () => actions,
    bySurface: (s) => actions.filter((a) => a.surfaces?.includes(s)),
    toToolSchema: () => actions.map((a) => ({ name: a.id.replace(/[.-]/g, '_'), description: a.description ?? '', input_schema: { type: 'object', properties: {} } })),
    exists: (id) => actions.some((a) => a.id === id),
  };
}

function providerYielding(frames) {
  return {
    async *complete() {
      for (const f of frames) yield f;
    },
  };
}

const ACTIONS = [
  { id: 'format-bold', title: 'Toggle Bold', description: 'Make text bold', surfaces: ['palette', 'slash'] },
  { id: 'insert-table', title: 'Insert Table', description: 'Insert a table', surfaces: ['palette', 'slash'] },
  { id: 'open-graph', title: 'Open Graph View', description: 'Show the graph', surfaces: ['palette'] },
];

describe('IntentRouter', () => {
  afterEach(() => setProvider(null));

  describe('fuzzyScore', () => {
    it('scores exact / prefix / substring / token overlap', () => {
      expect(fuzzyScore('toggle bold', 'Toggle Bold')).toBe(1);
      expect(fuzzyScore('toggle', 'Toggle Bold')).toBeGreaterThanOrEqual(0.9);
      expect(fuzzyScore('bold', 'Toggle Bold')).toBeGreaterThanOrEqual(0.5);
      expect(fuzzyScore('xyz', 'Toggle Bold')).toBe(0);
      expect(fuzzyScore('', 'Toggle Bold')).toBe(0);
    });
  });

  describe('tier0 (local fuzzy)', () => {
    it('returns the best match above threshold', () => {
      const r = tier0('toggle bold', makeRegistry(ACTIONS));
      expect(r).toMatchObject({ actionId: 'format-bold' });
      expect(r.score).toBeGreaterThanOrEqual(TIER0_THRESHOLD);
    });
    it('declines a weak match', () => {
      expect(tier0('quantum physics treatise', makeRegistry(ACTIONS))).toBeNull();
    });
  });

  describe('tier1 (keyword table)', () => {
    it('maps summarize → ai.summarize', () => {
      expect(tier1('summarize this note')).toMatchObject({ type: 'action', actionId: 'ai.summarize' });
    });
    it('maps rewrite → editor.rewrite', () => {
      expect(tier1('rewrite this formally')).toMatchObject({ type: 'action', actionId: 'editor.rewrite' });
    });
    it('maps a question word → ask', () => {
      expect(tier1('what is the capital of France')).toMatchObject({ type: 'ask' });
    });
    it('maps find/search → agent', () => {
      expect(tier1('find my notes on pricing')).toMatchObject({ type: 'agent' });
    });
    it('returns null when no keyword leads', () => {
      expect(tier1('zzz qqq')).toBeNull();
    });
    it('exposes the keyword table + threshold constants', () => {
      expect(Array.isArray(KEYWORD_TABLE)).toBe(true);
      expect(TIER0_THRESHOLD).toBeGreaterThan(0);
    });
  });

  describe('tier2 (model resolve)', () => {
    it('returns a tool_use for a single tool call', async () => {
      setProvider(providerYielding([
        { type: 'tool_use', id: 't1', name: 'insert_table', input: { rows: 3 } },
        { type: 'done' },
      ]));
      const r = await tier2('make me a 3-row table', makeRegistry(ACTIONS));
      expect(r).toMatchObject({ type: 'tool_use', actionId: 'insert_table', params: { rows: 3 } });
    });

    it('returns a plan for multiple tool calls', async () => {
      setProvider(providerYielding([
        { type: 'tool_use', id: 'a', name: 'format_bold', input: {} },
        { type: 'tool_use', id: 'b', name: 'insert_table', input: {} },
        { type: 'done' },
      ]));
      const r = await tier2('bold then add a table', makeRegistry(ACTIONS));
      expect(r.type).toBe('plan');
      expect(r.steps).toHaveLength(2);
    });

    it('returns open_ended when the model answers without a tool', async () => {
      setProvider(providerYielding([
        { type: 'text_delta', text: 'I am not sure.' },
        { type: 'done' },
      ]));
      const r = await tier2('ponder existence', makeRegistry(ACTIONS));
      expect(r).toMatchObject({ type: 'open_ended' });
    });

    it('falls back to open_ended on provider error', async () => {
      setProvider(providerYielding([{ type: 'error', code: 'X', message: 'boom' }]));
      const r = await tier2('anything', makeRegistry(ACTIONS));
      expect(r).toMatchObject({ type: 'open_ended', query: 'anything' });
    });
  });

  describe('route (full pipeline)', () => {
    it('Tier 0 wins for a direct title match (no provider)', async () => {
      setProvider(null);
      const r = await route('toggle bold', { registry: makeRegistry(ACTIONS) });
      expect(r).toMatchObject({ tier: 0, type: 'action', actionId: 'format-bold' });
    });

    it('Tier 1 handles a keyword instruction without the model', async () => {
      setProvider(null);
      const r = await route('summarize the selection', { registry: makeRegistry(ACTIONS), useModel: false });
      expect(r).toMatchObject({ tier: 1, type: 'action', actionId: 'ai.summarize' });
    });

    it('Tier 2 resolves an ambiguous instruction via the model', async () => {
      // Avoid Tier-0 title hits and Tier-1 keyword words (no question/find/etc).
      setProvider(providerYielding([
        { type: 'tool_use', id: 't1', name: 'open_graph', input: {} },
        { type: 'done' },
      ]));
      const r = await route('visualize my note relationships', { registry: makeRegistry(ACTIONS) });
      expect(r).toMatchObject({ tier: 2, type: 'tool_use', actionId: 'open_graph' });
    });

    it('returns none for an empty query or missing registry', async () => {
      expect(await route('', { registry: makeRegistry(ACTIONS) })).toMatchObject({ type: 'none' });
      expect(await route('hi', {})).toMatchObject({ type: 'none' });
    });

    it('useModel:false stays fully local (no Tier 2)', async () => {
      setProvider(null);
      const r = await route('quantum physics treatise', { registry: makeRegistry(ACTIONS), useModel: false });
      expect(r).toMatchObject({ tier: -1, type: 'none' });
    });
  });
});
