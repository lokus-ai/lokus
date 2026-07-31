import { describe, it, expect } from 'vitest';
import { matchesQuery, getColorGroupMatch, countMatches } from './colorGroups.js';

const node = (over = {}) => ({
  id: 'projects/alpha/notes.md',
  title: 'notes',
  folder: 'projects/alpha',
  tags: ['research', 'active'],
  type: 'file',
  ...over,
});

describe('colorGroups query matching', () => {
  it('matches a folder exactly and as a prefix', () => {
    expect(matchesQuery('folder:projects/alpha', node())).toBe(true);
    expect(matchesQuery('folder:projects', node())).toBe(true);
    expect(matchesQuery('folder:proj', node())).toBe(false); // partial segment is not a folder
  });

  it('tolerates surrounding slashes in a folder query', () => {
    expect(matchesQuery('folder:/projects/', node())).toBe(true);
  });

  it('matches a nested folder by its trailing segment', () => {
    expect(matchesQuery('folder:alpha', node())).toBe(true);
  });

  it('matches tags exactly, not by substring', () => {
    expect(matchesQuery('tag:research', node())).toBe(true);
    expect(matchesQuery('tag:#research', node())).toBe(true);
    expect(matchesQuery('tag:resea', node())).toBe(false);
  });

  it('matches node type', () => {
    expect(matchesQuery('type:file', node())).toBe(true);
    expect(matchesQuery('type:phantom', node())).toBe(false);
    expect(matchesQuery('type:phantom', node({ type: 'phantom' }))).toBe(true);
  });

  it('falls back to substring on title and path', () => {
    expect(matchesQuery('note', node())).toBe(true);
    expect(matchesQuery('alpha', node())).toBe(true);
    expect(matchesQuery('zzz', node())).toBe(false);
  });

  it('negates with a leading dash', () => {
    expect(matchesQuery('-tag:research', node())).toBe(false);
    expect(matchesQuery('-tag:missing', node())).toBe(true);
    expect(matchesQuery('-type:phantom', node())).toBe(true);
  });

  it('treats empty and whitespace queries as no match', () => {
    expect(matchesQuery('', node())).toBe(false);
    expect(matchesQuery('   ', node())).toBe(false);
    expect(matchesQuery('-', node())).toBe(false);
    expect(matchesQuery('folder:', node())).toBe(false);
    expect(matchesQuery('tag:', node())).toBe(false);
  });

  it('is case insensitive', () => {
    expect(matchesQuery('FOLDER:Projects', node())).toBe(false); // prefix itself is literal
    expect(matchesQuery('folder:PROJECTS', node())).toBe(true);
    expect(matchesQuery('tag:RESEARCH', node())).toBe(true);
    expect(matchesQuery('NOTES', node())).toBe(true);
  });

  it('handles nodes with no folder or tags', () => {
    const bare = { id: 'root.md', title: 'root', folder: '', tags: [], type: 'file' };
    expect(matchesQuery('folder:anything', bare)).toBe(false);
    expect(matchesQuery('tag:anything', bare)).toBe(false);
    expect(matchesQuery('root', bare)).toBe(true);
  });
});

describe('getColorGroupMatch', () => {
  it('returns the first matching group, honouring priority order', () => {
    const groups = [
      { query: 'tag:active', color: '#111111' },
      { query: 'folder:projects', color: '#222222' },
    ];
    expect(getColorGroupMatch(groups, node())).toBe('#111111');
    expect(getColorGroupMatch([...groups].reverse(), node())).toBe('#222222');
  });

  it('skips groups missing a query or color', () => {
    const groups = [{ query: '', color: '#111111' }, { query: 'notes' }, { query: 'notes', color: '#333333' }];
    expect(getColorGroupMatch(groups, node())).toBe('#333333');
  });

  it('returns null with no groups or no match', () => {
    expect(getColorGroupMatch([], node())).toBeNull();
    expect(getColorGroupMatch(null, node())).toBeNull();
    expect(getColorGroupMatch([{ query: 'zzz', color: '#000000' }], node())).toBeNull();
  });
});

describe('countMatches', () => {
  it('counts matching nodes', () => {
    const nodes = [node(), node({ id: 'other.md', title: 'other', folder: '', tags: [] })];
    expect(countMatches('folder:projects', nodes)).toBe(1);
    expect(countMatches('type:file', nodes)).toBe(2);
    expect(countMatches('zzz', nodes)).toBe(0);
  });

  it('is safe with bad input', () => {
    expect(countMatches('x', null)).toBe(0);
    expect(countMatches('', [node()])).toBe(0);
  });
});
