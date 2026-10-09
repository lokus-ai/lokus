export const DEFAULT_SORT_PREFERENCES = {
  sortBy: 'name',
  direction: 'asc',
  foldersFirst: true,
};

export const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name (A to Z)' },
  { value: 'name:desc', label: 'Name (Z to A)' },
  { value: 'modified:desc', label: 'Date modified (newest first)' },
  { value: 'modified:asc', label: 'Date modified (oldest first)' },
  { value: 'created:desc', label: 'Date created (newest first)' },
  { value: 'created:asc', label: 'Date created (oldest first)' },
  { value: 'size:desc', label: 'Size (largest first)' },
  { value: 'size:asc', label: 'Size (smallest first)' },
  { value: 'type:asc', label: 'Type (A to Z)' },
  { value: 'type:desc', label: 'Type (Z to A)' },
];

export function normalizeSortPreferences(preferences) {
  return {
    sortBy: ['name', 'modified', 'created', 'size', 'type'].includes(preferences?.sortBy)
      ? preferences.sortBy : DEFAULT_SORT_PREFERENCES.sortBy,
    direction: preferences?.direction === 'desc' ? 'desc' : 'asc',
    foldersFirst: typeof preferences?.foldersFirst === 'boolean'
      ? preferences.foldersFirst : DEFAULT_SORT_PREFERENCES.foldersFirst,
  };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareNames(a, b) {
  return collator.compare(a.name, b.name)
    || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function extension(entry) {
  if (entry.is_directory) return '';
  const dot = entry.name.lastIndexOf('.');
  return dot > 0 ? entry.name.slice(dot + 1).toLowerCase() : '';
}

// Timestamps are Unix seconds from read_workspace_files. Unknown metadata
// stays last in either direction; directory sizes are not file sizes.
function metadata(entry, sortBy) {
  if (sortBy === 'size' && entry.is_directory) return null;
  return Number.isFinite(entry[sortBy]) ? entry[sortBy] : null;
}

export function sortFileTree(entries, preferences = DEFAULT_SORT_PREFERENCES) {
  const { sortBy, direction, foldersFirst } = normalizeSortPreferences(preferences);
  const order = direction === 'desc' ? -1 : 1;
  const compare = (a, b) => {
    if (foldersFirst && a.is_directory !== b.is_directory) {
      return a.is_directory ? -1 : 1;
    }
    if (sortBy === 'name') return order * compareNames(a, b);
    if (sortBy === 'type') {
      return order * collator.compare(extension(a), extension(b)) || compareNames(a, b);
    }
    const left = metadata(a, sortBy);
    const right = metadata(b, sortBy);
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    return (left !== null && right !== null ? order * (left - right) : 0)
      || compareNames(a, b);
  };
  const sort = (nodes) => nodes
    .map((entry) => entry.children
      ? { ...entry, children: sort(entry.children) }
      : entry)
    .sort(compare);
  return sort(entries);
}
