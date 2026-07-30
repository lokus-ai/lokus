import { describe, it, expect } from 'vitest';
import { GraphIndexCore } from './graphIndex.core.js';

/**
 * In-memory IO adapter: drives the pure core from a `{ relativePath: content }`
 * map, so we can exercise index-building and queries with zero filesystem.
 */
function memoryAdapter(files) {
  const entries = Object.entries(files).map(([relativePath, content]) => ({
    path: relativePath,
    relativePath,
    name: relativePath.replace(/\.md$/i, '').split('/').pop(),
    content,
  }));
  const byPath = new Map(entries.map((e) => [e.path, e.content]));
  let saved = null;
  return {
    _saved: () => saved,
    async listMarkdownFiles() {
      return entries.map(({ path, relativePath, name }) => ({ path, relativePath, name }));
    },
    async readFile(p) {
      return byPath.get(p) ?? '';
    },
    async loadCache() {
      return null;
    },
    async saveCache(data) {
      saved = data;
    },
  };
}

describe('GraphIndexCore', () => {
  it('builds nodes and directed edges from wiki links', async () => {
    const adapter = memoryAdapter({
      'Alpha.md': 'Links to [[Beta]] and [[Gamma]].',
      'Beta.md': 'Back to [[Alpha]].',
      'Gamma.md': 'Lonely-ish, points at [[Beta]].',
    });
    const gi = new GraphIndexCore('/ws', adapter);
    await gi.load();

    expect(gi.graph.stats.nodeCount).toBe(3);
    expect(gi.graph.nodes.alpha.outgoingLinks).toEqual(['beta', 'gamma']);
    expect(gi.graph.nodes.beta.incomingLinks).toContain('alpha');
    expect(gi.graph.nodes.beta.incomingLinks).toContain('gamma');
  });

  it('getRelatedNotes returns connected notes sorted by depth then connections', async () => {
    const adapter = memoryAdapter({
      'Alpha.md': '[[Beta]] [[Gamma]]',
      'Beta.md': 'leaf',
      'Gamma.md': 'leaf',
      // Extra inbound link so Gamma (2 connections) out-ranks Beta (1) at depth 1.
      'Delta.md': '[[Gamma]]',
    });
    const gi = new GraphIndexCore('/ws', adapter);
    await gi.load();

    const { found, related } = gi.getRelatedNotes('Alpha', { depth: 1, direction: 'outgoing' });
    expect(found).toBe(true);
    expect(related.map((r) => r.id)).toEqual(['gamma', 'beta']);
  });

  it('ignores self-links and unresolved targets, and finds paths', async () => {
    const adapter = memoryAdapter({
      'Alpha.md': '[[Alpha]] [[Beta]] [[DoesNotExist]]',
      'Beta.md': '[[Gamma]]',
      'Gamma.md': 'leaf',
    });
    const gi = new GraphIndexCore('/ws', adapter);
    await gi.load();

    expect(gi.graph.nodes.alpha.outgoingLinks).not.toContain('alpha');
    // DoesNotExist has no node, so it is not in incomingLinks anywhere.
    expect(gi.graph.nodes.doesnotexist).toBeUndefined();

    const p = gi.findPath('Alpha', 'Gamma');
    expect(p.found).toBe(true);
    expect(p.distance).toBe(2);
  });

  it('persists the built graph through the adapter cache', async () => {
    const adapter = memoryAdapter({ 'Alpha.md': '[[Beta]]', 'Beta.md': 'x' });
    const gi = new GraphIndexCore('/ws', adapter);
    await gi.load();
    expect(adapter._saved()).toMatchObject({ version: '1.0' });
    expect(adapter._saved().graph.stats.nodeCount).toBe(2);
  });
});
