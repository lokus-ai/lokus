import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTabMetaStore, getTabMeta, selectGroupDirtyPaths, selectAllDirtyPaths } from './tabMeta';

describe('tabMeta store', () => {
  beforeEach(() => {
    useTabMetaStore.getState().clearAll();
  });

  it('setDirty is transition-only: an unchanged value keeps the state reference and does not notify', () => {
    const listener = vi.fn();
    const unsub = useTabMetaStore.subscribe(listener);

    useTabMetaStore.getState().setDirty('g1', '/a.md', true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTabMeta('g1', '/a.md')?.dirty).toBe(true);
    const ref = useTabMetaStore.getState();

    // Second setDirty(true) when already true: no-op.
    useTabMetaStore.getState().setDirty('g1', '/a.md', true);
    expect(useTabMetaStore.getState()).toBe(ref);
    expect(listener).toHaveBeenCalledTimes(1);

    // A real transition notifies again.
    useTabMetaStore.getState().setDirty('g1', '/a.md', false);
    expect(useTabMetaStore.getState()).not.toBe(ref);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getTabMeta('g1', '/a.md')?.dirty).toBe(false);
    unsub();
  });

  it('setDirty(false) on an unknown tab is a no-op (tabs default to clean)', () => {
    const listener = vi.fn();
    const unsub = useTabMetaStore.subscribe(listener);
    useTabMetaStore.getState().setDirty('g1', '/ghost.md', false);
    expect(listener).not.toHaveBeenCalled();
    expect(getTabMeta('g1', '/ghost.md')).toBeNull();
    unsub();
  });

  it('setSaved / setTitle / touch populate a single entry', () => {
    const s = useTabMetaStore.getState();
    s.setSaved('g1', '/a.md', 'raw content');
    s.setTitle('g1', '/a.md', 'My Title');
    s.touch('g1', '/a.md');
    const meta = getTabMeta('g1', '/a.md');
    expect(meta.savedContent).toBe('raw content');
    expect(meta.title).toBe('My Title');
    expect(typeof meta.lastAccessed).toBe('number');
  });

  it('renameKey re-keys metadata in every group (mirrors renameTabModel)', () => {
    const s = useTabMetaStore.getState();
    s.setDirty('g1', '/a.md', true);
    s.setTitle('g1', '/a.md', 'A');
    s.setDirty('g2', '/a.md', true);
    s.setDirty('g1', '/other.md', true);

    s.renameKey('/a.md', '/b.md');

    expect(getTabMeta('g1', '/a.md')).toBeNull();
    expect(getTabMeta('g2', '/a.md')).toBeNull();
    expect(getTabMeta('g1', '/b.md')?.title).toBe('A');
    expect(getTabMeta('g1', '/b.md')?.dirty).toBe(true);
    expect(getTabMeta('g2', '/b.md')?.dirty).toBe(true);
    // Unrelated paths are untouched.
    expect(getTabMeta('g1', '/other.md')?.dirty).toBe(true);
  });

  it('clearGroup drops only that group\'s entries', () => {
    const s = useTabMetaStore.getState();
    s.setDirty('g1', '/a.md', true);
    s.setDirty('g2', '/b.md', true);

    s.clearGroup('g1');

    expect(getTabMeta('g1', '/a.md')).toBeNull();
    expect(getTabMeta('g2', '/b.md')?.dirty).toBe(true);
  });

  it('clearAll drops every entry', () => {
    const s = useTabMetaStore.getState();
    s.setDirty('g1', '/a.md', true);
    s.setDirty('g2', '/b.md', true);

    s.clearAll();

    expect(Object.keys(useTabMetaStore.getState().tabs)).toHaveLength(0);
  });

  it('remove drops a single entry and no-ops for unknown keys', () => {
    const s = useTabMetaStore.getState();
    s.setDirty('g1', '/a.md', true);
    s.setDirty('g1', '/b.md', true);

    s.remove('g1', '/a.md');

    expect(getTabMeta('g1', '/a.md')).toBeNull();
    expect(getTabMeta('g1', '/b.md')?.dirty).toBe(true);

    const listener = vi.fn();
    const unsub = useTabMetaStore.subscribe(listener);
    s.remove('g1', '/ghost.md');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('dirty-path selectors return paths only, scoped per group', () => {
    const s = useTabMetaStore.getState();
    s.setDirty('g1', '/a.md', true);
    s.setDirty('g1', '/b.md', true);
    s.setDirty('g2', '/a.md', true);
    s.setTitle('g2', '/clean.md', 'not dirty');

    const state = useTabMetaStore.getState();
    expect(selectGroupDirtyPaths('g1')(state).sort()).toEqual(['/a.md', '/b.md']);
    expect(selectGroupDirtyPaths('g2')(state)).toEqual(['/a.md']);
    expect(selectGroupDirtyPaths(null)(state)).toEqual([]);
    expect(selectAllDirtyPaths(state)).toHaveLength(3);
  });
});
