const KINDS = new Set(['create', 'modify', 'remove', 'rename', 'other']);

export function normalizeWatcherPayload(payload = {}) {
  const paths = uniquePaths(payload.paths);
  const changes = Array.isArray(payload.changes)
    ? payload.changes
      .map((change) => ({
        kind: KINDS.has(change?.kind) ? change.kind : 'other',
        paths: uniquePaths(change?.paths),
      }))
      .filter((change) => change.paths.length > 0)
    : [];
  return {
    sequence: Number.isSafeInteger(payload.sequence) ? payload.sequence : 0,
    changes: changes.length > 0
      ? changes
      : (paths.length > 0 ? [{ kind: 'other', paths }] : []),
    paths,
  };
}

function uniquePaths(paths) {
  if (!Array.isArray(paths)) return [];
  return [...new Set(paths.filter((path) => typeof path === 'string' && path.length > 0))];
}
