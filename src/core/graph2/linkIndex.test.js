import { describe, it, expect, vi } from 'vitest';
import { createLinkIndex, scanWikiLinks, scanMarkdown } from './linkIndex.js';

const W = '/ws';
const tagsIn = (md) => scanMarkdown(md).tags;

describe('scanWikiLinks', () => {
  it('extracts plain links', () => {
    expect(scanWikiLinks('see [[Note One]] and [[Note Two]]').map(l => l.target)).toEqual(['Note One', 'Note Two']);
  });
  it('strips aliases and headings', () => {
    expect(scanWikiLinks('[[Note|display text]] [[Other#Section]]').map(l => l.target)).toEqual(['Note', 'Other']);
  });
  it('ignores unclosed brackets and newlines inside', () => {
    expect(scanWikiLinks('[[never closed\n[[Real]]').map(l => l.target)).toEqual(['Real']);
  });
  it('handles empty content and non-links', () => {
    expect(scanWikiLinks('')).toEqual([]);
    expect(scanWikiLinks(null)).toEqual([]);
    expect(scanWikiLinks('just [single] brackets')).toEqual([]);
  });
  it('flags the ![[embed]] form', () => {
    const links = scanWikiLinks('![[image.png]] and [[Note]]');
    expect(links.map(l => [l.target, l.embed])).toEqual([['image.png', true], ['Note', false]]);
  });
});

describe('scanMarkdown tags', () => {
  it('extracts plain, nested and punctuated tags', () => {
    expect(tagsIn('#alpha and #project/beta plus #with-dash and #with_under and #v2')).toEqual([
      'alpha', 'project/beta', 'with-dash', 'with_under', 'v2',
    ]);
  });
  it('lowercases and dedupes', () => {
    expect(tagsIn('#Foo #foo #FOO')).toEqual(['foo']);
  });
  it('trims wrapping slashes and drops separator-only garbage', () => {
    expect(tagsIn('#foo/ #--- #/bar/')).toEqual(['foo', 'bar']);
  });
  it('does NOT match markdown headings', () => {
    expect(tagsIn('# Heading\n## Sub heading\n### Deep\n#\t tabbed')).toEqual([]);
  });
  it('does NOT match inside a fenced code block', () => {
    const md = ['#before', '```js', 'const x = "#nope";', '#alsonope', '```', '#after'].join('\n');
    expect(tagsIn(md)).toEqual(['before', 'after']);
  });
  it('does NOT match inside a tilde fence', () => {
    expect(tagsIn(['~~~', '#nope', '~~~', '#yes'].join('\n'))).toEqual(['yes']);
  });
  it('does NOT match inside an inline code span', () => {
    expect(tagsIn('use `#nope` but #yes and ``#alsonope`` done')).toEqual(['yes']);
  });
  it('recovers from an unbalanced backtick at the next line', () => {
    expect(tagsIn('stray ` tick #nope\n#yes')).toEqual(['yes']);
  });
  it('does NOT match a URL fragment', () => {
    expect(tagsIn('see example.com#frag or https://x.com/page#section or a#b')).toEqual([]);
  });
  it('does NOT match inside a wikilink target', () => {
    expect(tagsIn('[[Other#Section]] [[a|#b]]')).toEqual([]);
  });
  it('matches at start of content, after punctuation and at end of line', () => {
    expect(tagsIn('#first (#paren) [#bracket] last #end')).toEqual(['first', 'paren', 'bracket', 'end']);
  });
  it('scans links and tags in the same pass', () => {
    const { links, tags } = scanMarkdown('#topic see [[Note]] then #other');
    expect(links.map(l => l.target)).toEqual(['Note']);
    expect(tags).toEqual(['topic', 'other']);
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
    expect(idx.backlinks(`${W}/b.md`).map(b => b.source)).toEqual([`${W}/a.md`]);
    expect(idx.backlinks(`${W}/dir/c.md`).map(b => b.source)).toEqual([`${W}/a.md`]);
    expect(idx.backlinks(`${W}/b.md`)[0].context.match).toBe('[[b]]');
  });

  it('tracks phantoms for unresolved targets and materializes them later', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, 'points at [[future-note]]');
    expect(idx.stats().phantoms).toBe(1);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual(['phantom:future-note']);

    idx.addFile(`${W}/future-note.md`);
    expect(idx.stats().phantoms).toBe(0);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/future-note.md`]);
    expect(idx.backlinks(`${W}/future-note.md`).map(b => b.source)).toEqual([`${W}/a.md`]);
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
    expect(idx.backlinks(`${W}/dir/c.md`)).toEqual([]); // b is gone entirely
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

  it('stats() counts files, edges, phantoms, tags and attachments', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[b]] [[nope]]');
    expect(idx.stats()).toEqual({ files: 3, links: 2, phantoms: 1, tags: 0, attachments: 0 });
  });
});

describe('linkIndex node shape', () => {
  function seed() {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/a.md`, `${W}/b.md`, `${W}/dir/c.md`]);
    return idx;
  }

  it('exposes id, title, type, phantom, folder, tags and mtime', () => {
    const idx = seed();
    idx.indexContent(`${W}/dir/c.md`, '#alpha content', 4242);
    const n = idx.nodes().find(x => x.id === `${W}/dir/c.md`);
    expect(Object.keys(n).sort()).toEqual(['folder', 'id', 'mtime', 'phantom', 'tags', 'title', 'type'].sort());
    expect(n).toMatchObject({
      id: `${W}/dir/c.md`,
      title: 'c',
      type: 'file',
      phantom: false,
      folder: `${W}/dir`,
      tags: ['alpha'],
      mtime: 4242,
    });
  });

  it('derives folder from the path, empty at the root', () => {
    const idx = createLinkIndex();
    idx.setFiles(['root.md', `${W}/a.md`, `${W}/x/y/deep.md`]);
    const folder = (id) => idx.nodes().find(n => n.id === id).folder;
    expect(folder('root.md')).toBe('');
    expect(folder(`${W}/a.md`)).toBe(W);
    expect(folder(`${W}/x/y/deep.md`)).toBe(`${W}/x/y`);
  });

  it('gives phantoms type "phantom" with an empty folder and no tags', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[ghost]]');
    const g = idx.nodes().find(n => n.id === 'phantom:ghost');
    expect(g).toMatchObject({ type: 'phantom', phantom: true, folder: '', mtime: 0 });
    expect(g.tags).toEqual([]);
  });

  it('surfaces mtime from updateContent and addFile', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, 'body', 999);
    expect(idx.nodes().find(n => n.id === `${W}/a.md`).mtime).toBe(999);
    idx.addFile(`${W}/new.md`);
    expect(idx.nodes().find(n => n.id === `${W}/new.md`).mtime).toBeGreaterThan(0);
  });

  it('renameFile refreshes the title', () => {
    const idx = seed();
    idx.renameFile(`${W}/b.md`, `${W}/b-renamed.md`);
    expect(idx.nodes().find(n => n.id === `${W}/b-renamed.md`).title).toBe('b-renamed');
  });

  it('links() yields plain { source, target } id pairs', () => {
    const idx = seed();
    idx.indexContent(`${W}/a.md`, '[[b]]');
    idx.bootDone();
    expect(idx.links()).toEqual([{ source: `${W}/a.md`, target: `${W}/b.md` }]);
  });
});

describe('linkIndex tags', () => {
  function seed() {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/a.md`, `${W}/b.md`, `${W}/dir/c.md`]);
    return idx;
  }

  it('stores per-file tags and an aggregated set', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '#research #ml/nlp');
    idx.updateContent(`${W}/b.md`, '#research only');
    expect(idx.tagsOf(`${W}/a.md`)).toEqual(['research', 'ml/nlp']);
    expect(idx.tagsOf(`${W}/b.md`)).toEqual(['research']);
    expect(idx.allTags()).toEqual(['ml/nlp', 'research']);
    expect(idx.tagsOf(`${W}/dir/c.md`)).toEqual([]);
  });

  it('emits one tag node per distinct tag with a file→tag edge', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '#research');
    idx.updateContent(`${W}/b.md`, '#research');
    const tagNodes = idx.nodes().filter(n => n.type === 'tag');
    expect(tagNodes).toHaveLength(1);
    expect(tagNodes[0]).toMatchObject({ id: 'tag:research', title: '#research', type: 'tag', folder: '' });
    expect(tagNodes[0].tags).toEqual(['research']);
    expect(idx.links()).toContainEqual({ source: `${W}/a.md`, target: 'tag:research' });
    expect(idx.links()).toContainEqual({ source: `${W}/b.md`, target: 'tag:research' });
  });

  it('keeps tag edges out of backlinks() and forwardlinks()', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '#research [[b]]');
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/b.md`]);
    expect(idx.backlinks(`${W}/b.md`).map(b => b.source)).toEqual([`${W}/a.md`]);
    expect(idx.backlinks('tag:research')).toEqual([]);
  });

  it('drops tags when the content or the file goes away', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '#research');
    idx.updateContent(`${W}/b.md`, '#research #solo');
    expect(idx.allTags()).toEqual(['research', 'solo']);

    idx.updateContent(`${W}/b.md`, 'no tags here');
    expect(idx.allTags()).toEqual(['research']);

    idx.removeFile(`${W}/a.md`);
    expect(idx.allTags()).toEqual([]);
    expect(idx.nodes().some(n => n.type === 'tag')).toBe(false);
  });

  it('carries tags across a rename', () => {
    const idx = seed();
    idx.updateContent(`${W}/b.md`, '#keep');
    idx.renameFile(`${W}/b.md`, `${W}/b2.md`);
    expect(idx.tagsOf(`${W}/b2.md`)).toEqual(['keep']);
    expect(idx.allTags()).toEqual(['keep']);
    expect(idx.links()).toContainEqual({ source: `${W}/b2.md`, target: 'tag:keep' });
  });

  it('counts tags and tag edges in stats()', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '#research [[b]]');
    expect(idx.stats()).toMatchObject({ files: 3, links: 2, phantoms: 0, tags: 1, attachments: 0 });
  });
});

describe('linkIndex attachments', () => {
  function seed() {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/a.md`, `${W}/b.md`, `${W}/dir/c.md`]);
    return idx;
  }

  it('classifies unresolved non-md targets as attachments, not phantoms', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, 'see ![[diagram.png]] and [[spec.pdf]]');
    expect(idx.forwardlinks(`${W}/a.md`).sort()).toEqual(['attachment:diagram.png', 'attachment:spec.pdf']);
    const png = idx.nodes().find(n => n.id === 'attachment:diagram.png');
    expect(png).toMatchObject({ title: 'diagram.png', type: 'attachment', phantom: true, folder: '', mtime: 0 });
    expect(idx.stats()).toMatchObject({ phantoms: 0, attachments: 2 });
  });

  it('resolves an attachment that exists in the index to its real path', () => {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/a.md`, `${W}/assets/logo.png`]);
    idx.updateContent(`${W}/a.md`, '![[logo.png]] and ![[assets/logo.png]]');
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/assets/logo.png`]);
    expect(idx.nodes().find(n => n.id === `${W}/assets/logo.png`)).toMatchObject({
      type: 'attachment', phantom: false, folder: `${W}/assets`, title: 'logo.png',
    });
    expect(idx.stats()).toMatchObject({ files: 1, attachments: 1 });
    expect(idx.backlinks(`${W}/assets/logo.png`).map(b => b.source)).toEqual([`${W}/a.md`]);
  });

  it('materializes an attachment placeholder when the file appears', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '![[logo.png]]');
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual(['attachment:logo.png']);
    idx.addFile(`${W}/logo.png`);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual([`${W}/logo.png`]);
    expect(idx.nodes().some(n => n.id === 'attachment:logo.png')).toBe(false);
    expect(idx.stats()).toMatchObject({ files: 3, attachments: 1 });
  });

  it('removing an attachment file leaves an attachment placeholder, not a phantom', () => {
    const idx = createLinkIndex();
    idx.setFiles([`${W}/a.md`, `${W}/logo.png`]);
    idx.updateContent(`${W}/a.md`, '![[logo.png]]');
    idx.removeFile(`${W}/logo.png`);
    expect(idx.forwardlinks(`${W}/a.md`)).toEqual(['attachment:logo.png']);
    expect(idx.stats()).toMatchObject({ phantoms: 0, attachments: 1 });
  });

  it('does not mistake a dotted note title for an attachment', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '[[Version 1.2]] [[notes.md]]');
    expect(idx.forwardlinks(`${W}/a.md`).sort()).toEqual(['phantom:notes', 'phantom:version 1.2']);
    expect(idx.stats()).toMatchObject({ phantoms: 2, attachments: 0 });
  });

  it('releases a placeholder once the last referrer drops it', () => {
    const idx = seed();
    idx.updateContent(`${W}/a.md`, '[[ghost]] ![[img.png]]');
    expect(idx.stats()).toMatchObject({ phantoms: 1, attachments: 1 });
    idx.updateContent(`${W}/a.md`, 'nothing left');
    expect(idx.stats()).toMatchObject({ phantoms: 0, attachments: 0 });
    expect(idx.nodes().filter(n => n.phantom)).toEqual([]);
  });
});
