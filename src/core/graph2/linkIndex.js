/**
 * linkIndex — the single source of truth for the workspace's file/link graph.
 *
 * Obsidian-model metadata cache: built once, then INCREMENTAL forever.
 * A save re-parses one file. A file op touches one path. Nothing ever
 * rescans the vault, and backlinks are an O(1) inverse-map lookup.
 *
 * Pure data module — no DOM, no Tauri, no React. Fully unit-testable.
 *
 * Data:
 *   files: Map<path, { title, mtime }>
 *   forward: Map<path, Set<path>>   outgoing links (resolved + phantom targets)
 *   inverse: Map<path, Set<path>>   incoming links (backlinks)
 *   names: Map<basenameLower → Set<path>>  for O(1) [[link]] resolution
 *   phantoms: Set<basenameLower>  referenced but not (yet) existing
 */

const MD_RE = /\.md$/i;

function basenameOf(path) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function titleOf(path) {
  return basenameOf(path).replace(MD_RE, '');
}

function keyOf(name) {
  return name.trim().toLowerCase().replace(MD_RE, '');
}

/**
 * Single-pass scanner for [[wikilinks]] in markdown text.
 * Allocation-light: no regex per file, walks the string once.
 * Returns raw targets with aliases stripped ("Note|alias" → "Note").
 */
export function scanWikiLinks(content) {
  const targets = [];
  if (!content) return targets;
  let i = 0;
  const n = content.length;
  while (i < n - 1) {
    if (content[i] === '[' && content[i + 1] === '[') {
      let j = i + 2;
      let target = '';
      let closed = false;
      while (j < n - 1) {
        if (content[j] === ']' && content[j + 1] === ']') { closed = true; break; }
        if (content[j] === '\n') break; // unclosed — bail
        target += content[j];
        j++;
      }
      if (closed) {
        const raw = target.split('|')[0].split('#')[0].trim();
        if (raw) {
          // Rich snippet for the backlinks UI: 50 chars around the match.
          const before = content.slice(Math.max(0, i - 50), i).trim();
          const match = content.slice(i, j + 2);
          const after = content.slice(j + 2, Math.min(n, j + 2 + 50)).trim();
          targets.push({ target: raw, context: { before, match, after, full: before + match + after } });
        }
        i = j + 2;
        continue;
      }
      i = j;
    }
    i++;
  }
  return targets;
}

export function createLinkIndex() {
  const files = new Map();
  const forward = new Map();
  const inverse = new Map();
  const names = new Map();
  const phantoms = new Set();

  const listeners = new Set();
  // Referentially stable snapshots — recomputed once per mutation so views
  // can memo on version without O(N) rebuilds per render.
  let cachedNodes = [];
  let cachedLinks = [];
  let cachedStats = null;
  const notify = () => {
    cachedNodes = null;
    cachedLinks = null;
    cachedStats = null;
    for (const fn of listeners) fn();
  };

  function addName(path) {
    const key = keyOf(titleOf(path));
    let set = names.get(key);
    if (!set) { set = new Set(); names.set(key, set); }
    set.add(path);
  }

  function removeName(path) {
    const key = keyOf(titleOf(path));
    const set = names.get(key);
    if (set) {
      set.delete(path);
      if (set.size === 0) names.delete(key);
    }
  }

  /** Resolve a raw [[target]] to a real path, or null (→ phantom).
      Handles both [[basename]] and [[dir/basename]] (path-suffix) forms. */
  function resolve(rawTarget) {
    const clean = rawTarget.trim();
    const baseKey = keyOf(basenameOf(clean));
    const set = names.get(baseKey);
    if (!set || set.size === 0) return null;

    if (clean.includes('/')) {
      // Path-suffix form: keep only candidates ending with the given subpath.
      const suffix = keyOf(clean) + '.md';
      const matches = [...set].filter(p => p.toLowerCase().endsWith('/' + suffix));
      if (matches.length > 0) {
        return matches.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
      }
      return null; // explicit path that doesn't exist — phantom, not a guess
    }

    // Deterministic: shortest path wins (closest to root), then lexical.
    return [...set].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  }

  function addEdge(source, target, context = '') {
    let f = forward.get(source);
    if (!f) { f = new Map(); forward.set(source, f); }
    f.set(target, context);
    let inv = inverse.get(target);
    if (!inv) { inv = new Map(); inverse.set(target, inv); }
    inv.set(source, context);
  }

  function clearEdgesFrom(source) {
    const outs = forward.get(source);
    if (!outs) return;
    for (const target of outs.keys()) {
      const inv = inverse.get(target);
      if (inv) {
        inv.delete(source);
        if (inv.size === 0) inverse.delete(target);
      }
    }
    forward.delete(source);
  }

  /** Register/update a file's outgoing links from raw scan targets. */
  function setLinks(source, rawTargets) {
    clearEdgesFrom(source);
    phantoms.delete(keyOf(titleOf(source))); // a file that exists is never phantom
    const seen = new Set();
    for (const { target: raw, context } of rawTargets) {
      const key = keyOf(raw);
      if (key === keyOf(titleOf(source))) continue; // self-link
      if (seen.has(key)) continue;
      seen.add(key);
      const resolved = resolve(raw);
      if (resolved) {
        addEdge(source, resolved, context);
      } else {
        phantoms.add(key);
        addEdge(source, `phantom:${key}`, context);
      }
    }
  }

  /** A phantom target materialized: rewrite phantom edges to the real path. */
  function materialize(path) {
    const key = keyOf(titleOf(path));
    const phantomId = `phantom:${key}`;
    const ins = inverse.get(phantomId);
    if (!ins) return;
    phantoms.delete(key);
    for (const [source, context] of [...ins]) {
      const outs = forward.get(source);
      if (outs && outs.delete(phantomId)) addEdge(source, path, context);
    }
    inverse.delete(phantomId);
  }

  return {
    // --- bulk boot ---------------------------------------------------------
    /** Seed the file list (structure-only; no contents). */
    setFiles(paths) {
      files.clear();
      names.clear();
      for (const p of paths) {
        files.set(p, { title: titleOf(p), mtime: 0 });
        addName(p);
      }
      // Re-resolve: existing edges may now point at real files
      for (const key of [...phantoms]) {
        const hit = names.get(key);
        if (hit && hit.size > 0) materialize([...hit][0]);
      }
      notify();
    },

    /** Seed one file's parsed content (used by the boot bulk pass). */
    indexContent(path, content, mtime = 0) {
      if (!files.has(path)) {
        files.set(path, { title: titleOf(path), mtime });
        addName(path);
        materialize(path);
      } else {
        files.get(path).mtime = mtime;
      }
      setLinks(path, scanWikiLinks(content));
    },
    bootDone() { notify(); },

    // --- incremental -------------------------------------------------------
    /** The file was saved: re-parse just this file. */
    updateContent(path, content, mtime = Date.now()) {
      const existed = files.has(path);
      if (!existed) {
        files.set(path, { title: titleOf(path), mtime });
        addName(path);
      } else {
        files.get(path).mtime = mtime;
      }
      setLinks(path, scanWikiLinks(content));
      if (!existed) materialize(path);
      notify();
    },

    addFile(path) {
      if (files.has(path)) return;
      files.set(path, { title: titleOf(path), mtime: Date.now() });
      addName(path);
      materialize(path);
      notify();
    },

    removeFile(path) {
      if (!files.delete(path)) return;
      removeName(path);
      clearEdgesFrom(path);           // outgoing
      const ins = inverse.get(path);  // incoming → become phantoms
      if (ins) {
        const key = keyOf(titleOf(path));
        for (const [source, context] of [...ins]) {
          const outs = forward.get(source);
          if (outs && outs.delete(path)) {
            phantoms.add(key);
            addEdge(source, `phantom:${key}`, context);
          }
        }
        inverse.delete(path);
      }
      notify();
    },

    renameFile(oldPath, newPath) {
      if (!files.has(oldPath)) { this.addFile(newPath); return; }
      const meta = files.get(oldPath);
      const outs = forward.get(oldPath) ? [...forward.get(oldPath)] : null;
      this.removeFile(oldPath);
      files.set(newPath, { ...meta });
      addName(newPath);
      if (outs) for (const [t, context] of outs) addEdge(newPath, t, context);
      materialize(newPath);
      notify();
    },

    // --- queries ------------------------------------------------------------
    /** O(1) backlinks for a path: [{ source, context }]. */
    backlinks(path) {
      const inv = inverse.get(path);
      if (!inv) return [];
      return [...inv].map(([source, context]) => ({ source, context }));
    },
    forwardlinks(path) {
      return [...(forward.get(path)?.keys() || [])];
    },
    /** All graph nodes: real files + phantom placeholders (cached snapshot). */
    nodes() {
      if (!cachedNodes) {
        const real = [...files.keys()].map(p => ({ id: p, title: files.get(p).title, phantom: false }));
        const ghosts = [...phantoms].map(k => ({ id: `phantom:${k}`, title: k, phantom: true }));
        cachedNodes = real.concat(ghosts);
      }
      return cachedNodes;
    },
    links() {
      if (!cachedLinks) {
        cachedLinks = [];
        for (const [source, targets] of forward) {
          for (const target of targets) cachedLinks.push({ source, target });
        }
      }
      return cachedLinks;
    },
    orphans() {
      return [...files.keys()].filter(p => !forward.get(p)?.size && !inverse.get(p)?.size);
    },
    stats() {
      if (!cachedStats) {
        let edgeCount = 0;
        for (const [, set] of forward) edgeCount += set.size;
        cachedStats = { files: files.size, links: edgeCount, phantoms: phantoms.size };
      }
      return cachedStats;
    },

    resolve,
    scan: scanWikiLinks,

    // --- subscription ---------------------------------------------------------
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
