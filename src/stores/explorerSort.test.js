import { beforeEach, describe, expect, it } from 'vitest';
import { useExplorerSortStore } from './explorerSort';
import { DEFAULT_SORT_PREFERENCES } from '../features/file-tree/sorting';
import { createJSONStorage } from 'zustand/middleware';

beforeEach(() => {
  // The shared test setup replaces localStorage after modules are imported.
  useExplorerSortStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) });
  useExplorerSortStore.setState({ sortPreferences: DEFAULT_SORT_PREFERENCES });
  localStorage.clear();
});

describe('Explorer sort preferences', () => {
  it('persists criteria, direction, and folders-first across hydration', async () => {
    const preferences = { sortBy: 'size', direction: 'desc', foldersFirst: false };
    useExplorerSortStore.getState().setSortPreferences(preferences);
    const stored = localStorage.getItem('lokus:explorer-sort');
    expect(JSON.parse(stored).state).toEqual({ sortPreferences: preferences });
    useExplorerSortStore.setState({ sortPreferences: DEFAULT_SORT_PREFERENCES });
    localStorage.setItem('lokus:explorer-sort', stored);
    await useExplorerSortStore.persist.rehydrate();
    expect(useExplorerSortStore.getState().sortPreferences).toEqual(preferences);
  });

  it('updates one preference without resetting the others', () => {
    useExplorerSortStore.getState().setSortPreferences({ sortBy: 'modified', direction: 'desc' });
    useExplorerSortStore.getState().setSortPreferences({ foldersFirst: false });
    expect(useExplorerSortStore.getState().sortPreferences).toEqual({ sortBy: 'modified', direction: 'desc', foldersFirst: false });
  });

  it('ignores invalid persisted values and leaves actions available', async () => {
    localStorage.setItem('lokus:explorer-sort', JSON.stringify({
      state: { sortPreferences: { sortBy: 'invalid', direction: 'sideways', foldersFirst: 'yes' } }, version: 0,
    }));
    await useExplorerSortStore.persist.rehydrate();
    expect(useExplorerSortStore.getState().sortPreferences).toEqual(DEFAULT_SORT_PREFERENCES);
    expect(typeof useExplorerSortStore.getState().setSortPreferences).toBe('function');
  });

  it('keeps defaults when stored JSON is corrupt', async () => {
    localStorage.setItem('lokus:explorer-sort', '{bad');
    await useExplorerSortStore.persist.rehydrate();
    expect(useExplorerSortStore.getState().sortPreferences).toEqual(DEFAULT_SORT_PREFERENCES);
  });
});
