import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the graph index so Layer A is exercised without a filesystem.
const mockGetRelatedNotes = vi.fn();
const mockLoad = vi.fn().mockResolvedValue(undefined);
vi.mock('../../mcp-server/utils/graphIndex.js', () => ({
  getGraphIndex: vi.fn(() => ({
    load: mockLoad,
    getRelatedNotes: mockGetRelatedNotes,
  })),
}));

import ResurfacingProvider, { DEFAULT_LIMIT } from './ResurfacingProvider.js';

const rel = (name, { direction = 'outgoing', connections = 1, id } = {}) => ({
  id: id ?? name.toLowerCase(),
  name,
  path: `${name}.md`,
  depth: 1,
  direction,
  connections,
});

beforeEach(() => {
  mockGetRelatedNotes.mockReset();
  mockLoad.mockClear();
  mockLoad.mockResolvedValue(undefined);
});

describe('ResurfacingProvider — Layer A (graph)', () => {
  it('surfaceGraphNeighbors returns graph-tagged neighbors with normalized scores', async () => {
    mockGetRelatedNotes.mockReturnValue({
      found: true,
      related: [rel('Beta', { connections: 4 }), rel('Gamma', { connections: 2 })],
    });
    const p = new ResurfacingProvider('/ws');
    const out = await p.surfaceGraphNeighbors('Alpha');

    expect(mockLoad).toHaveBeenCalled();
    expect(out).toHaveLength(2);
    expect(out.every((n) => n.source === 'graph')).toBe(true);
    // Connection count is normalized to [0,1] within the set (max=4 → 1.0).
    expect(out[0].score).toBe(1);
    expect(out[1].score).toBe(0.5);
  });

  it('asks the graph for 1-hop neighbors in both directions', async () => {
    mockGetRelatedNotes.mockReturnValue({ found: true, related: [rel('Beta')] });
    const p = new ResurfacingProvider('/ws');
    await p.surfaceGraphNeighbors('Alpha', 5);

    const [name, opts] = mockGetRelatedNotes.mock.calls[0];
    expect(name).toBe('Alpha');
    expect(opts.depth).toBe(1);
    expect(opts.direction).toBe('both');
  });

  it('limits results to the requested count', async () => {
    mockGetRelatedNotes.mockReturnValue({
      found: true,
      related: Array.from({ length: 12 }, (_, i) =>
        rel(`N${i}`, { connections: 12 - i }),
      ),
    });
    const p = new ResurfacingProvider('/ws');
    const out = await p.surfaceGraphNeighbors('Alpha', 3);
    expect(out).toHaveLength(3);
    expect(out[0].name).toBe('N0'); // highest connections first
  });

  it('returns [] when the note is not found in the graph', async () => {
    mockGetRelatedNotes.mockReturnValue({ found: false, related: [] });
    const p = new ResurfacingProvider('/ws');
    expect(await p.surfaceGraphNeighbors('Orphan')).toEqual([]);
  });

  it('degrades to [] (never throws) when the graph index fails to load', async () => {
    mockLoad.mockRejectedValue(new Error('no fs in renderer'));
    const p = new ResurfacingProvider('/ws');
    await expect(p.surfaceGraphNeighbors('Alpha')).resolves.toEqual([]);
  });

  it('returns [] for an empty note name or missing workspace', async () => {
    expect(await new ResurfacingProvider('/ws').surfaceGraphNeighbors('')).toEqual([]);
    expect(await new ResurfacingProvider(null).surfaceGraphNeighbors('Alpha')).toEqual([]);
  });

  it('DEFAULT_LIMIT is 5 (PRD: 3–5 cards)', () => {
    expect(DEFAULT_LIMIT).toBe(5);
  });
});

describe('ResurfacingProvider.resurface — scorer merge seam', () => {
  it('with only the graph scorer, resurface == graph neighbors', async () => {
    mockGetRelatedNotes.mockReturnValue({
      found: true,
      related: [rel('Beta', { connections: 3 }), rel('Gamma', { connections: 1 })],
    });
    const p = new ResurfacingProvider('/ws');
    const out = await p.resurface('Alpha', { limit: 5 });
    expect(out.map((n) => n.name)).toEqual(['Beta', 'Gamma']);
  });

  it('never surfaces the current note itself', async () => {
    mockGetRelatedNotes.mockReturnValue({
      found: true,
      related: [rel('Alpha', { connections: 9 }), rel('Beta', { connections: 1 })],
    });
    const p = new ResurfacingProvider('/ws');
    const out = await p.resurface('Alpha', { limit: 5 });
    expect(out.map((n) => n.name)).toEqual(['Beta']);
  });

  it('merges a second (Layer B) scorer: dedupes by id, unions sources, re-ranks by score', async () => {
    mockGetRelatedNotes.mockReturnValue({
      found: true,
      related: [rel('Beta', { connections: 1, id: 'beta' })], // graph score normalizes to 1.0
    });
    const semantic = {
      name: 'semantic',
      score: async () => [
        { id: 'beta', name: 'Beta', path: 'Beta.md', source: 'semantic', score: 0.4 },
        { id: 'zeta', name: 'Zeta', path: 'Zeta.md', source: 'semantic', score: 0.9 },
      ],
    };
    const p = new ResurfacingProvider('/ws', { scorers: [semantic] });
    const out = await p.resurface('Alpha', { limit: 5 });

    const beta = out.find((n) => n.id === 'beta');
    expect(beta.sources.sort()).toEqual(['graph', 'semantic']);
    expect(beta.score).toBe(1); // higher of the two kept
    // Beta(1.0) ranks above Zeta(0.9).
    expect(out.map((n) => n.name)).toEqual(['Beta', 'Zeta']);
  });

  it('a throwing scorer contributes nothing; Layer A still stands alone (Ollama-unavailable case)', async () => {
    mockGetRelatedNotes.mockReturnValue({
      found: true,
      related: [rel('Beta', { connections: 2 })],
    });
    const broken = {
      name: 'semantic',
      score: async () => {
        throw new Error('OLLAMA_UNAVAILABLE');
      },
    };
    const p = new ResurfacingProvider('/ws', { scorers: [broken] });
    const out = await p.resurface('Alpha', { limit: 5 });
    expect(out.map((n) => n.name)).toEqual(['Beta']);
  });

  it('addScorer is additive and idempotent by name', () => {
    const p = new ResurfacingProvider('/ws');
    const s = { name: 'semantic', score: async () => [] };
    p.addScorer(s);
    p.addScorer(s); // duplicate name ignored
    p.addScorer({ name: 'bad' }); // no score fn → ignored
    expect(p.scorers.map((x) => x.name)).toEqual(['graph', 'semantic']);
  });

  it('resurface([] for empty note name)', async () => {
    const p = new ResurfacingProvider('/ws');
    expect(await p.resurface('')).toEqual([]);
  });
});

describe('ResurfacingProvider.merge', () => {
  it('sorts by score desc, stable on ties, slices to limit', () => {
    const out = ResurfacingProvider.merge(
      [
        { id: 'a', name: 'A', source: 'graph', score: 0.5 },
        { id: 'b', name: 'B', source: 'graph', score: 0.9 },
        { id: 'c', name: 'C', source: 'graph', score: 0.5 },
      ],
      'Self',
      2,
    );
    expect(out.map((n) => n.name)).toEqual(['B', 'A']); // A before C (stable on tie)
  });

  it('drops blank/self candidates and strips internal bookkeeping', () => {
    const out = ResurfacingProvider.merge(
      [null, { name: 'Self', source: 'graph', score: 1 }, { id: 'x', name: 'X', source: 'graph', score: 0.2 }],
      'Self',
      5,
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('X');
    expect(out[0]._order).toBeUndefined();
  });
});
