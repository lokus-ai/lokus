import { describe, it, expect, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => '{}'),
  writeTextFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn(async (...p) => p.join('/')) }));

const { getDefaultConfig, validateConfig } = await import('./graphConfig.js');

describe('graphConfig defaults', () => {
  it('ships every key the sidebar and engine read', () => {
    const c = getDefaultConfig();
    for (const key of [
      'search', 'showTags', 'showAttachments', 'hideUnresolved', 'showOrphans',
      'localMode', 'localDepth', 'showArrow', 'highlightNeighbors', 'followFocus',
      'textFadeMultiplier', 'nodeSizeMultiplier', 'lineSizeMultiplier',
      'centerStrength', 'repelStrength', 'linkStrength', 'linkDistance',
      'colorScheme', 'colorGroups', 'backgroundType',
    ]) {
      expect(c, `missing default: ${key}`).toHaveProperty(key);
    }
  });

  it('returns a fresh object each call so callers cannot mutate the defaults', () => {
    const a = getDefaultConfig();
    a.search = 'mutated';
    a.colorGroups.push({ query: 'x', color: '#000000' });
    const b = getDefaultConfig();
    expect(b.search).toBe('');
    expect(b.colorGroups).toEqual([]);
  });
});

describe('validateConfig', () => {
  it('fills defaults for anything absent', () => {
    expect(validateConfig({})).toEqual(getDefaultConfig());
    expect(validateConfig()).toEqual(getDefaultConfig());
  });

  it('keeps valid values', () => {
    const out = validateConfig({ search: 'notes', showOrphans: false, linkDistance: 120, colorScheme: 'folder' });
    expect(out.search).toBe('notes');
    expect(out.showOrphans).toBe(false);
    expect(out.linkDistance).toBe(120);
    expect(out.colorScheme).toBe('folder');
  });

  it('clamps numbers into range instead of rejecting them', () => {
    expect(validateConfig({ linkDistance: 99999 }).linkDistance).toBe(300);
    expect(validateConfig({ linkDistance: -5 }).linkDistance).toBe(20);
    expect(validateConfig({ repelStrength: 0 }).repelStrength).toBe(10);
    expect(validateConfig({ localDepth: 42 }).localDepth).toBe(5);
  });

  it('ignores wrong-typed values and falls back to the default', () => {
    const d = getDefaultConfig();
    expect(validateConfig({ showOrphans: 'yes' }).showOrphans).toBe(d.showOrphans);
    expect(validateConfig({ linkDistance: 'far' }).linkDistance).toBe(d.linkDistance);
    expect(validateConfig({ linkDistance: NaN }).linkDistance).toBe(d.linkDistance);
    expect(validateConfig({ search: 42 }).search).toBe(d.search);
  });

  it('drops unknown keys so a stale config file cannot inject junk', () => {
    expect(validateConfig({ evil: true, __proto__: { polluted: true } })).not.toHaveProperty('evil');
  });

  it('falls back on an unrecognised colorScheme or backgroundType', () => {
    expect(validateConfig({ colorScheme: 'nonsense' }).colorScheme).toBe('type');
    expect(validateConfig({ backgroundType: 'nonsense' }).backgroundType).toBe('none');
  });

  it('keeps well-formed color groups and repairs bad colors', () => {
    const out = validateConfig({
      colorGroups: [
        { query: 'tag:a', color: '#ff0000' },
        { query: 'tag:b', color: 'not-a-color' },
        { query: 'tag:c' },
        { color: '#00ff00' },
        'garbage',
      ],
    });
    expect(out.colorGroups).toEqual([
      { query: 'tag:a', color: '#ff0000' },
      { query: 'tag:b', color: '#6366f1' },
    ]);
  });

  it('ignores a non-array colorGroups', () => {
    expect(validateConfig({ colorGroups: 'nope' }).colorGroups).toEqual([]);
  });
});
