/**
 * Color group queries — graph2 node shape.
 *
 * The old matcher read `node.metadata.path` / `node.metadata.tags`; engine
 * nodes are flat ({ id, title, folder, tags, type }), so this is the same
 * query language against the new shape.
 *
 * Syntax:
 *   folder:projects/   — node lives under that folder
 *   tag:research       — node carries that tag
 *   type:phantom       — node is of that type (file|phantom|tag|attachment)
 *   -foo               — negate any of the above
 *   plain text         — substring of title or path
 *
 * First matching group wins (frames pass groups in priority order).
 */

function matchOne(q, node) {
  if (q.startsWith('folder:')) {
    const f = q.slice(7).toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!f) return false;
    const folder = (node.folder || '').toLowerCase();
    return folder === f || folder.startsWith(f + '/') || folder.endsWith('/' + f) || folder.includes('/' + f + '/');
  }

  if (q.startsWith('tag:')) {
    const t = q.slice(4).toLowerCase().replace(/^#/, '');
    if (!t) return false;
    return (node.tags || []).some((x) => String(x).toLowerCase() === t);
  }

  if (q.startsWith('type:')) {
    const t = q.slice(5).toLowerCase();
    return (node.type || 'file').toLowerCase() === t;
  }

  const s = q.toLowerCase();
  return (node.title || '').toLowerCase().includes(s) || (node.id || '').toLowerCase().includes(s);
}

export function matchesQuery(query, node) {
  if (!query || !node) return false;
  const q = query.trim();
  if (!q) return false;
  if (q.startsWith('-')) {
    const inner = q.slice(1).trim();
    return inner ? !matchOne(inner, node) : false;
  }
  return matchOne(q, node);
}

/** First matching group's color, or null. */
export function getColorGroupMatch(groups, node) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  for (const g of groups) {
    if (g?.query && g?.color && matchesQuery(g.query, node)) return g.color;
  }
  return null;
}

/** How many nodes a query matches — drives the live count badge in the sidebar. */
export function countMatches(query, nodes) {
  if (!query || !Array.isArray(nodes)) return 0;
  let n = 0;
  for (const node of nodes) if (matchesQuery(query, node)) n++;
  return n;
}
