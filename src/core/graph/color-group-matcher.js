/**
 * Match a node against a color group query.
 *
 * Query syntax:
 *   "folder:projects/"  — node.metadata.path starts with the folder path (case-insensitive)
 *   "tag:research"      — node.metadata.tags includes the tag (case-insensitive)
 *   "meeting"           — node.title or node.label contains the text (case-insensitive)
 */
export function matchesQuery(query, node) {
  if (!query || !node) return false;

  const q = query.trim();
  if (!q) return false;

  // folder: prefix
  if (q.startsWith('folder:')) {
    const folderPath = q.slice(7).toLowerCase();
    if (!folderPath) return false;
    const nodePath = (node.metadata?.path || node.id || '').toLowerCase();
    return nodePath.startsWith(folderPath) || nodePath.includes('/' + folderPath);
  }

  // tag: prefix
  if (q.startsWith('tag:')) {
    const tagName = q.slice(4).toLowerCase();
    if (!tagName) return false;
    const tags = node.metadata?.tags || [];
    return tags.some(t => t.toLowerCase().includes(tagName));
  }

  // Plain text — match against title, label, or id
  const search = q.toLowerCase();
  const title = (node.title || '').toLowerCase();
  const label = (node.label || '').toLowerCase();
  const id = (node.id || '').toLowerCase();
  return title.includes(search) || label.includes(search) || id.includes(search);
}

/**
 * Find the first matching color group for a node.
 * Returns the group's color string, or null if no match.
 */
export function getColorGroupMatch(colorGroups, node) {
  if (!Array.isArray(colorGroups) || colorGroups.length === 0) return null;

  for (const group of colorGroups) {
    if (group.query && group.color && matchesQuery(group.query, node)) {
      return group.color;
    }
  }
  return null;
}

/**
 * Count how many nodes match a query.
 */
export function countMatches(query, nodes) {
  if (!query || !Array.isArray(nodes)) return 0;
  return nodes.filter(n => matchesQuery(query, n)).length;
}
