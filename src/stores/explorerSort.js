import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SORT_PREFERENCES, normalizeSortPreferences } from '../features/file-tree/sorting';

export const useExplorerSortStore = create(persist((set) => ({
  sortPreferences: DEFAULT_SORT_PREFERENCES,
  setSortPreferences: (preferences) => set((s) => ({
    sortPreferences: normalizeSortPreferences({ ...s.sortPreferences, ...preferences }),
  })),
}), {
  name: 'lokus:explorer-sort',
  partialize: (state) => ({ sortPreferences: state.sortPreferences }),
  merge: (persisted, current) => ({
    ...current,
    sortPreferences: normalizeSortPreferences(persisted?.sortPreferences),
  }),
}));
