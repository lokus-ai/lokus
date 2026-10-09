import { describe, expect, it } from 'vitest';
import { DEFAULT_SORT_PREFERENCES, normalizeSortPreferences, sortFileTree } from './sorting';

const file = (name, metadata = {}) => ({ name, path: `/w/${name}`, is_directory: false, ...metadata });
const names = (entries) => entries.map((entry) => entry.name);
const sort = (entries, preferences) => sortFileTree(entries, { ...DEFAULT_SORT_PREFERENCES, ...preferences });

describe('Explorer sorting', () => {
  it('sorts names naturally, ignoring case, in both directions', () => {
    const entries = [file('note10.md'), file('Note2.md'), file('apple.md')];
    expect(names(sort(entries))).toEqual(['apple.md', 'Note2.md', 'note10.md']);
    expect(names(sort(entries, { direction: 'desc' }))).toEqual(['note10.md', 'Note2.md', 'apple.md']);
  });

  it.each(['modified', 'created', 'size'])('sorts %s in both directions with name ties and missing values last', (sortBy) => {
    const entries = [
      file('z.md', { [sortBy]: 20 }), file('b.md', { [sortBy]: 10 }),
      file('a.md', { [sortBy]: 10 }), file('zero.md', { [sortBy]: 0 }),
      file('missing.md'), file('null.md', { [sortBy]: null }),
      file('invalid.md', { [sortBy]: NaN }),
    ];
    expect(names(sort(entries, { sortBy }))).toEqual([
      'zero.md', 'a.md', 'b.md', 'z.md', 'invalid.md', 'missing.md', 'null.md',
    ]);
    expect(names(sort(entries, { sortBy, direction: 'desc' }))).toEqual([
      'z.md', 'a.md', 'b.md', 'zero.md', 'invalid.md', 'missing.md', 'null.md',
    ]);
  });

  it('groups extensions case-insensitively and handles dotfiles and extensionless names', () => {
    const entries = ['z.TXT', 'archive.tar.gz', 'b.MD', 'a.md', 'README', '.env'].map((name) => file(name));
    expect(names(sort(entries, { sortBy: 'type' }))).toEqual(['.env', 'README', 'archive.tar.gz', 'a.md', 'b.MD', 'z.TXT']);
    expect(names(sort(entries, { sortBy: 'type', direction: 'desc' }))).toEqual(['z.TXT', 'a.md', 'b.MD', 'archive.tar.gz', '.env', 'README']);
  });

  it('sorts every level without mutating input or changing leaf identity', () => {
    const leaf = file('a.md');
    const entries = [file('z.md'), {
      name: 'folder', path: '/w/folder', is_directory: true,
      children: [file('z.md'), { name: 'nested', path: '/w/folder/nested', is_directory: true, children: [file('b.md'), leaf] }],
    }];
    const before = JSON.stringify(entries);
    const sorted = sort(entries);
    expect(names(sorted)).toEqual(['folder', 'z.md']);
    expect(names(sorted[0].children)).toEqual(['nested', 'z.md']);
    expect(sorted[0].children[0].children[0]).toBe(leaf);
    expect(JSON.stringify(entries)).toBe(before);
  });

  it.each(['asc', 'desc'])('keeps folders first in %s order, and allows mixed sorting', (direction) => {
    const entries = [file('a.md'), { name: 'z-folder', path: '/w/z-folder', is_directory: true, children: [] }];
    expect(names(sort(entries, { direction }))[0]).toBe('z-folder');
    expect(names(sort(entries, { direction, foldersFirst: false }))).toEqual(
      direction === 'asc' ? ['a.md', 'z-folder'] : ['z-folder', 'a.md'],
    );
  });

  it('uses folder timestamps but does not treat directory size as file size', () => {
    const folder = { name: 'folder', path: '/w/folder', is_directory: true, modified: 30, created: 30, size: 0 };
    const entries = [file('note.md', { modified: 20, created: 20, size: 5 }), folder];
    for (const sortBy of ['modified', 'created']) {
      expect(sort(entries, { sortBy, direction: 'desc', foldersFirst: false })[0]).toBe(folder);
    }
    expect(sort(entries, { sortBy: 'size', foldersFirst: false })[1]).toBe(folder);
  });

  it('breaks equivalent names by path deterministically', () => {
    const entries = [file('a.md', { path: '/w/z' }), file('A.md', { path: '/w/a' })];
    expect(sort(entries)[0].path).toBe('/w/a');
    expect(sort([...entries].reverse())[0].path).toBe('/w/a');
  });

  it('validates saved preferences and handles empty folders', () => {
    expect(normalizeSortPreferences(null)).toEqual(DEFAULT_SORT_PREFERENCES);
    expect(normalizeSortPreferences({ sortBy: 'bad', direction: 'bad', foldersFirst: 'false' })).toEqual(DEFAULT_SORT_PREFERENCES);
    expect(sort([])).toEqual([]);
  });
});
