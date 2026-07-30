/**
 * Integration: the REAL linkIndex driving the REAL engine.
 *
 * Unit tests on each side use fakes, so this is the only place the actual
 * seam is exercised — node shape, live reconcile on save, tag/attachment
 * classification, and filters all against genuine parsed markdown.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createLinkIndex } from './linkIndex.js';
import { createGraphEngine } from './graphEngine.js';

let engine = null;
afterEach(() => { engine?.destroy(); engine = null; });

function vault(files) {
  const index = createLinkIndex();
  index.setFiles(Object.keys(files));
  for (const [path, content] of Object.entries(files)) index.indexContent(path, content);
  index.bootDone();
  return index;
}

const ids = (e) => e.nodes().map((n) => n.id).sort();

describe('linkIndex → graphEngine', () => {
  it('carries a parsed vault through to engine nodes', () => {
    const index = vault({
      'a.md': 'links to [[b]]',
      'b.md': 'links back to [[a]]',
    });
    engine = createGraphEngine();
    engine.attach(index);

    expect(ids(engine)).toEqual(['a.md', 'b.md']);
    expect(engine.links()).toHaveLength(2);
    expect([...engine.neighbors('a.md')]).toEqual(['b.md']);
  });

  it('exposes folder and title from real paths', () => {
    engine = createGraphEngine();
    engine.attach(vault({ 'projects/alpha/spec.md': 'no links' }));
    const n = engine.node('projects/alpha/spec.md');
    expect(n.folder).toBe('projects/alpha');
    expect(n.title).toBe('spec');
    expect(n.type).toBe('file');
  });

  it('surfaces a phantom for an unresolved wikilink', () => {
    engine = createGraphEngine();
    engine.attach(vault({ 'a.md': 'points at [[nowhere]]' }));
    const ghost = engine.nodes().find((n) => n.type === 'phantom');
    expect(ghost).toBeTruthy();
    engine.setConfig({ hideUnresolved: true });
    expect(engine.nodes().some((n) => n.type === 'phantom')).toBe(false);
  });

  it('LIVE: a save that adds a link updates the engine without losing positions', () => {
    const index = vault({ 'a.md': 'nothing yet', 'b.md': 'also nothing' });
    engine = createGraphEngine();
    engine.attach(index);
    expect(engine.links()).toHaveLength(0);

    const a = engine.node('a.md');
    a.x = 500;
    a.y = -500;

    index.updateContent('a.md', 'now links to [[b]]');

    expect(engine.links()).toHaveLength(1);
    expect(engine.node('a.md')).toBe(a);      // same object …
    expect(engine.node('a.md').x).toBe(500);  // … so the layout did not jump
    expect([...engine.neighbors('b.md')]).toEqual(['a.md']);
  });

  it('LIVE: creating the missing file materialises its phantom', () => {
    const index = vault({ 'a.md': 'points at [[later]]' });
    engine = createGraphEngine();
    engine.attach(index);
    expect(engine.nodes().some((n) => n.type === 'phantom')).toBe(true);

    index.updateContent('later.md', 'I exist now');

    expect(engine.nodes().some((n) => n.type === 'phantom')).toBe(false);
    expect([...engine.neighbors('a.md')]).toEqual(['later.md']);
  });

  it('LIVE: deleting a file turns its backlinks back into a phantom', () => {
    const index = vault({ 'a.md': 'links to [[b]]', 'b.md': 'target' });
    engine = createGraphEngine();
    engine.attach(index);
    expect(engine.nodes().some((n) => n.type === 'phantom')).toBe(false);

    index.removeFile('b.md');

    expect(ids(engine).includes('b.md')).toBe(false);
    expect(engine.nodes().some((n) => n.type === 'phantom')).toBe(true);
  });

  it('classifies tags into tag nodes that filters can hide', () => {
    engine = createGraphEngine();
    engine.attach(vault({ 'a.md': 'tagged #research and #active' }));

    engine.setConfig({ showTags: true });
    const tags = engine.nodes().filter((n) => n.type === 'tag').map((n) => n.id).sort();
    expect(tags).toEqual(['tag:active', 'tag:research']);

    engine.setConfig({ showTags: false });
    expect(engine.nodes().some((n) => n.type === 'tag')).toBe(false);
  });

  it('does not mistake headings or code for tags', () => {
    engine = createGraphEngine();
    engine.attach(vault({ 'a.md': '# Heading\n\n`#notatag`\n\n#real' }));
    engine.setConfig({ showTags: true });
    expect(engine.nodes().filter((n) => n.type === 'tag').map((n) => n.id)).toEqual(['tag:real']);
  });

  it('hides orphans without dropping connected notes', () => {
    engine = createGraphEngine();
    engine.attach(vault({
      'a.md': 'links to [[b]]',
      'b.md': 'target',
      'lonely.md': 'nobody links here and it links nowhere',
    }));
    engine.setConfig({ showOrphans: false, showTags: false });
    expect(ids(engine)).toEqual(['a.md', 'b.md']);
  });

  it('scopes to a local graph around the focused note', () => {
    engine = createGraphEngine();
    engine.attach(vault({
      'a.md': '[[b]]',
      'b.md': '[[c]]',
      'c.md': 'end',
      'far.md': 'unrelated',
    }));
    engine.setFocus('a.md');
    engine.setConfig({ localMode: true, localDepth: 1, showTags: false });
    expect(ids(engine)).toEqual(['a.md', 'b.md']);
  });

  it('colors by real folders', () => {
    engine = createGraphEngine();
    engine.attach(vault({ 'x/one.md': '', 'x/two.md': '', 'y/three.md': '' }));
    engine.setConfig({ colorScheme: 'folder' });
    expect(engine.node('x/one.md').color).toBe(engine.node('x/two.md').color);
    expect(engine.node('x/one.md').color).not.toBe(engine.node('y/three.md').color);
  });

  it('stays consistent across a rename', () => {
    const index = vault({ 'a.md': 'links to [[old]]', 'old.md': 'target' });
    engine = createGraphEngine();
    engine.attach(index);
    expect([...engine.neighbors('a.md')]).toEqual(['old.md']);

    index.renameFile('old.md', 'new.md');

    expect(ids(engine).includes('old.md')).toBe(false);
    // [[old]] now resolves to nothing — a phantom, not a silent dangling edge
    expect(engine.nodes().some((n) => n.type === 'phantom')).toBe(true);
  });

  it('survives an empty vault', () => {
    engine = createGraphEngine();
    engine.attach(vault({}));
    expect(engine.nodes()).toEqual([]);
    expect(engine.links()).toEqual([]);
    expect(engine.stats().files).toBe(0);
  });
});
