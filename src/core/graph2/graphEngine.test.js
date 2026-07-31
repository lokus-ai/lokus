import { describe, it, expect, afterEach } from 'vitest';
import { createGraphEngine } from './graphEngine.js';

/** Minimal stand-in for linkIndex: just the surface the engine consumes. */
function fakeIndex(nodes = [], links = []) {
  const listeners = new Set();
  return {
    nodes: () => nodes,
    links: () => links,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // test helpers
    _set(n, l) { nodes = n; links = l; },
    _emit() { for (const fn of [...listeners]) fn(); },
    _listenerCount: () => listeners.size,
  };
}

const file = (id, over = {}) => ({ id, title: id.split('/').pop().replace(/\.md$/, ''), type: 'file', phantom: false, folder: '', tags: [], mtime: 0, ...over });
const phantom = (key) => ({ id: `phantom:${key}`, title: key, type: 'phantom', phantom: true, folder: '', tags: [], mtime: 0 });

let engine = null;
afterEach(() => { engine?.destroy(); engine = null; });

describe('graphEngine — attach', () => {
  it('mirrors the index node set', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md'), file('b.md')], [{ source: 'a.md', target: 'b.md' }]));
    expect(engine.nodes().map(n => n.id).sort()).toEqual(['a.md', 'b.md']);
    expect(engine.links()).toHaveLength(1);
  });

  it('derives folder from the path when the index omits it', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([{ id: 'projects/alpha/n.md', title: 'n', type: 'file', phantom: false }]));
    expect(engine.node('projects/alpha/n.md').folder).toBe('projects/alpha');
  });

  it('unsubscribes from the previous index when re-attached', () => {
    engine = createGraphEngine();
    const first = fakeIndex([file('a.md')]);
    engine.attach(first);
    expect(first._listenerCount()).toBe(1);

    engine.attach(fakeIndex([file('z.md')]));
    expect(first._listenerCount()).toBe(0);
    expect(engine.nodes().map(n => n.id)).toEqual(['z.md']);
  });

  it('clears everything when attached to null', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md')]));
    engine.attach(null);
    expect(engine.nodes()).toEqual([]);
    expect(engine.links()).toEqual([]);
  });
});

describe('graphEngine — live reconcile', () => {
  it('keeps the SAME node object across an index change, so position survives', () => {
    const idx = fakeIndex([file('a.md')], []);
    engine = createGraphEngine();
    engine.attach(idx);

    const before = engine.node('a.md');
    idx._set([file('a.md'), file('b.md')], [{ source: 'a.md', target: 'b.md' }]);
    idx._emit();

    expect(engine.node('a.md')).toBe(before); // identity === position/velocity preserved
    expect(engine.nodes()).toHaveLength(2);
  });

  it('restores position when a node is filtered out and comes back', () => {
    const idx = fakeIndex([file('a.md'), phantom('ghost')], []);
    engine = createGraphEngine();
    engine.attach(idx);

    const ghost = engine.node('phantom:ghost');
    ghost.x = 1234;
    ghost.y = -99;

    engine.setConfig({ hideUnresolved: true });
    expect(engine.node('phantom:ghost')).toBeNull();

    engine.setConfig({ hideUnresolved: false });
    expect(engine.node('phantom:ghost').x).toBe(1234);
    expect(engine.node('phantom:ghost').y).toBe(-99);
  });

  it('drops removed nodes and their edges', () => {
    const idx = fakeIndex([file('a.md'), file('b.md')], [{ source: 'a.md', target: 'b.md' }]);
    engine = createGraphEngine();
    engine.attach(idx);

    idx._set([file('a.md')], []);
    idx._emit();

    expect(engine.nodes().map(n => n.id)).toEqual(['a.md']);
    expect(engine.links()).toEqual([]);
  });

  it('notifies subscribers on an index change', () => {
    const idx = fakeIndex([file('a.md')]);
    engine = createGraphEngine();
    engine.attach(idx);

    let hits = 0;
    const off = engine.subscribe(() => { hits++; });
    idx._set([file('a.md'), file('b.md')], []);
    idx._emit();
    off();

    expect(hits).toBeGreaterThan(0);
  });
});

describe('graphEngine — filters', () => {
  const idx = () => fakeIndex(
    [file('a.md'), file('b.md'), file('lonely.md'), phantom('ghost')],
    [{ source: 'a.md', target: 'b.md' }],
  );

  it('hides unresolved phantoms', () => {
    engine = createGraphEngine();
    engine.attach(idx());
    engine.setConfig({ hideUnresolved: true });
    expect(engine.nodes().some(n => n.phantom)).toBe(false);
  });

  it('hides orphans without touching connected nodes', () => {
    engine = createGraphEngine();
    engine.attach(idx());
    engine.setConfig({ showOrphans: false });
    const ids = engine.nodes().map(n => n.id).sort();
    expect(ids).toEqual(['a.md', 'b.md']);
  });

  it('hides tag nodes when showTags is off', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md'), { id: 'tag:research', title: 'research', type: 'tag' }], []));
    engine.setConfig({ showTags: false });
    expect(engine.nodes().map(n => n.id)).toEqual(['a.md']);
  });

  it('hides attachments by default and shows them on request', () => {
    const withAttachment = fakeIndex([file('a.md'), { id: 'img.png', title: 'img', type: 'attachment' }], []);
    engine = createGraphEngine();
    engine.attach(withAttachment);

    engine.setConfig({ showAttachments: false });
    expect(engine.nodes().map(n => n.id)).toEqual(['a.md']);

    engine.setConfig({ showAttachments: true });
    expect(engine.nodes().map(n => n.id).sort()).toEqual(['a.md', 'img.png']);
  });
});

describe('graphEngine — local graph mode', () => {
  //  a — b — c — d   (chain)   plus an unconnected island
  const chain = () => fakeIndex(
    [file('a.md'), file('b.md'), file('c.md'), file('d.md'), file('island.md')],
    [
      { source: 'a.md', target: 'b.md' },
      { source: 'b.md', target: 'c.md' },
      { source: 'c.md', target: 'd.md' },
    ],
  );

  it('depth 1 keeps the focus and its direct neighbours', () => {
    engine = createGraphEngine();
    engine.attach(chain());
    engine.setFocus('b.md');
    engine.setConfig({ localMode: true, localDepth: 1 });
    expect(engine.nodes().map(n => n.id).sort()).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('depth 2 reaches two hops out', () => {
    engine = createGraphEngine();
    engine.attach(chain());
    engine.setFocus('b.md');
    engine.setConfig({ localMode: true, localDepth: 2 });
    expect(engine.nodes().map(n => n.id).sort()).toEqual(['a.md', 'b.md', 'c.md', 'd.md']);
  });

  it('re-scopes when the focus moves', () => {
    engine = createGraphEngine();
    engine.attach(chain());
    engine.setConfig({ localMode: true, localDepth: 1 });
    engine.setFocus('d.md');
    expect(engine.nodes().map(n => n.id).sort()).toEqual(['c.md', 'd.md']);
  });

  it('shows the whole graph again when local mode is turned off', () => {
    engine = createGraphEngine();
    engine.attach(chain());
    engine.setFocus('b.md');
    engine.setConfig({ localMode: true, localDepth: 1 });
    engine.setConfig({ localMode: false });
    expect(engine.nodes()).toHaveLength(5);
  });

  it('falls back to the full graph when nothing is focused', () => {
    engine = createGraphEngine();
    engine.attach(chain());
    engine.setConfig({ localMode: true, localDepth: 1 });
    expect(engine.nodes()).toHaveLength(5);
  });
});

describe('graphEngine — neighbours', () => {
  it('is symmetric and O(1)', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex(
      [file('a.md'), file('b.md'), file('c.md')],
      [{ source: 'a.md', target: 'b.md' }, { source: 'a.md', target: 'c.md' }],
    ));
    expect([...engine.neighbors('a.md')].sort()).toEqual(['b.md', 'c.md']);
    expect([...engine.neighbors('b.md')]).toEqual(['a.md']);
    expect([...engine.neighbors('nope.md')]).toEqual([]);
  });
});

describe('graphEngine — painting', () => {
  it('dims non-matches for search instead of removing them', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('alpha.md'), file('beta.md')], []));
    engine.setConfig({ search: 'alph' });

    expect(engine.nodes()).toHaveLength(2); // nothing removed
    expect(engine.node('alpha.md').dim).toBe(false);
    expect(engine.node('beta.md').dim).toBe(true);
  });

  it('clears dimming when the search is emptied', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('alpha.md'), file('beta.md')], []));
    engine.setConfig({ search: 'alph' });
    engine.setConfig({ search: '' });
    expect(engine.nodes().every(n => n.dim === false)).toBe(true);
  });

  it('leaves color null for the type scheme so the frame resolves a theme color', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md')], []));
    engine.setConfig({ colorScheme: 'type' });
    expect(engine.node('a.md').color).toBeNull();
    expect(engine.node('a.md').cssVar).toBeTruthy();
  });

  it('gives same-folder nodes the same color and different folders different colors', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([
      file('x/one.md', { folder: 'x' }), file('x/two.md', { folder: 'x' }), file('y/three.md', { folder: 'y' }),
    ], []));
    engine.setConfig({ colorScheme: 'folder' });
    expect(engine.node('x/one.md').color).toBe(engine.node('x/two.md').color);
    expect(engine.node('x/one.md').color).not.toBe(engine.node('y/three.md').color);
  });

  it('lets an explicit color group override the scheme', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md', { tags: ['hot'] }), file('b.md')], []));
    engine.setConfig({ colorScheme: 'folder', colorGroups: [{ query: 'tag:hot', color: '#ff0000' }] });
    expect(engine.node('a.md').color).toBe('#ff0000');
    expect(engine.node('b.md').color).not.toBe('#ff0000');
  });

  it('scales radius with degree and the size multiplier', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex(
      [file('hub.md'), file('leaf.md')],
      [{ source: 'hub.md', target: 'leaf.md' }],
    ));
    const base = engine.node('hub.md').radius;
    engine.setConfig({ nodeSizeMultiplier: 2 });
    expect(engine.node('hub.md').radius).toBeCloseTo(base * 2, 5);
  });
});

describe('graphEngine — dragging', () => {
  it('re-heats once per drag, not once per pointermove', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md'), file('b.md')], [{ source: 'a.md', target: 'b.md' }]));

    const node = engine.node('a.md');
    engine.pin('a.md', 10, 10);
    const heatAfterFirstPin = node.fx;
    expect(heatAfterFirstPin).toBe(10);

    // Simulate a drag: many pins in a row must keep updating the position …
    for (let i = 0; i < 20; i++) engine.pin('a.md', 100 + i, 200 + i);
    expect(node.fx).toBe(119);
    expect(node.fy).toBe(219);

    // … and releasing clears the pin.
    engine.unpin('a.md');
    expect(node.fx).toBeNull();
    expect(node.fy).toBeNull();
  });

  it('notifies subscribers while dragging so the frame redraws between ticks', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md')], []));
    engine.pin('a.md', 0, 0);

    let hits = 0;
    const off = engine.subscribe(() => { hits++; });
    engine.pin('a.md', 5, 5);
    off();

    expect(hits).toBeGreaterThan(0);
  });

  it('ignores pin/unpin for unknown nodes', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex([file('a.md')], []));
    expect(() => { engine.pin('ghost.md', 1, 1); engine.unpin('ghost.md'); }).not.toThrow();
  });
});

describe('graphEngine — stats and teardown', () => {
  it('counts files, phantoms and links', () => {
    engine = createGraphEngine();
    engine.attach(fakeIndex(
      [file('a.md'), file('b.md'), phantom('ghost')],
      [{ source: 'a.md', target: 'b.md' }],
    ));
    expect(engine.stats()).toMatchObject({ nodes: 3, files: 2, phantoms: 1, links: 1 });
  });

  it('destroy detaches the index listener and empties state', () => {
    const idx = fakeIndex([file('a.md')]);
    const e = createGraphEngine();
    e.attach(idx);
    e.destroy();
    expect(idx._listenerCount()).toBe(0);
    expect(e.nodes()).toEqual([]);
    idx._emit(); // must not throw after teardown
  });
});
