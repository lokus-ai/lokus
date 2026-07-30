import { describe, it, expect, vi } from 'vitest';
import { createLinkIndex, scanWikiLinks } from './linkIndex.js';

const W = '/ws';

describe('scanWikiLinks', () => {
  it('extracts plain links', () => {
    expect(scanWikiLinks('see [[Note One]] and [[Note Two]]')).toEqual(['Note One', 'Note Two']);
  });
  it('strips aliases and headings', () => {
    expect(scanWikiLinks('[[Note|display text]] [[Other#Section]]')).toEqual(['Note', 'Other']);
  });
  it('ignores unclosed brackets and newlines inside', () => {
    expect(scanWikiLinks('[[never closed\n[[Real]]')).toEqual(['Real']);
  });
  it('handles empty content and non-links', () => {
    expect(scanWikiLinks('')).toEqual([]);
    expect(scanWikiLinks(null)).toEqual([]);
    expect(scanWikiLinks('just [single] brackets')).toEqual([]);
  });
});

describe('linkIndex', () => {
  function seed() {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/a.md`, `${W}/b.md`, `${W}/dir/c.md`]);
    return idx;
  }

  it('resolves by basename, shortest path first', () => {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/deep/nested/dup.md`, `${W}/dup.md`]);
    expect(idx.resolve('dup')).toBe(`${W}/dup.md`);
  });

  it('builds forward and inverse maps from content', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, 'links to [[b]] and [[dir/c]]');
    expect(idx.forwardlinks(`${W}/a.md`).sort()).toEqual([`${W}/b.md`, `${W}/dir/c.md`]);
    expect(idx.backlinks(`${W}/b.md`)).toEqual([`${W}/a.md`]);
    expect(idx.backlinks(`${W}/dir/c.md`)).toEqual([`${W}/a.md`]);
  });

  it('tracks phantoms for unresolved targets and materializes them later', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, 'points at [[future-note]]');
    expect(idx.stats().phantoms).toBe(1);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual(['phantom:future-note']);

    idx.addFile(`${W}/future-note.md`);
    expect(idx.stats().phantoms).toBe(0);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/future-note.md`]);
    expect(idx.backlinks(`${W}/future-note.md`)).toEqual([`${W}/a.md`]);
  });

  it('updateContent re-parses only that file and replaces its edges', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md', '[[b]]'`.slice(0, -1)); // keep it simple
    idx.updateContent(`${W}/a.md`, '[[b]]');
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/b.md`]);
    idx.updateContent(`${W}/a.md`, '[[dir/c]] now');
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/dir/c.md`]);
    expect(idx.backlinks(`${W}/b.md`)).toEqual([]);
  });

  it('removeFile drops outgoing edges and phantomizes incoming ones', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[b]]');
    idx.indexContent(`${W}/b.md`, '[[dir/c]]');
    idx.removeFile(`${W}/b.md`);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual(['phantom:b']);
    expect(idx.backlinks(`${W}/dir/c.md`)).toEqual([`${W}/b.md`].filter(() => false)); // b is gone entirely
    expect(idx.forwardlinks(`${W}/b.md`)).toEqual([]);
  });

  it('renameFile carries edges to the new path', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[b]]');
    idx.indexContent(`${W}/b.md`, '[[dir/c]]');
    idx.renameFile(`${W}/b.md`, `${W}/b-renamed.md`);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual(['phantom:b']);
    expect(idx.forwardlinks(`${W}/b-renamed.md`)).toEqual([`${W}/dir/c.md`]);
  });

  it('ignores self-links and duplicate targets', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[a]] [[b]] [[b|alias]]');
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/b.md`]);
  });

  it('orphans are files with no edges in either direction', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[b]]');
    expect(idx.orphans().sort()).toEqual([`${W}/dir/c.md`].concat([]));
    expect(idx.orphans()).toContain(`${W}/dir/c.md`);
    expect(idx.orphans()).not.toContain(`${W}/a.md`);
    expect(idx.orphans()).not.toContain(`${W}/b.md`);
  });

  it('notifies subscribers on every mutation, once per op', () => {
    const idx = seed();
    const fn = vi.fn();
    const unsub = idx.subscribe(fn);
    idx.updateContent(`${W}/a.md`, '[[b]]');
    expect(fn).toHaveBeenCalledTimes(1);
    idx.removeFile(`${W}/b.md`);
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    idx.addFile(`${W}/x.md`);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('nodes() includes real files and phantoms with flags', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[ghost]]');
    const nodes = idx.nodes();
    expect(nodes.find(n => n.id === `${W}/a.md`).phantom).toBe(false);
    expect(nodes.find(n => n.id === 'phantom:ghost').phantom).toBe(true);
  });

  it('stats() counts files, edges, phantoms', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[b]] [[nope]]');
    expect(idx.stats()).toEqual({ files: 3, links: 2, phantoms: 1 });
  });
});
