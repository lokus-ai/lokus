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
 *   files: Map<path, { title, mtime, tags, attachment }>
 *   forward: Map<path, Map<targetId, context>>   outgoing links
 *   inverse: Map<targetId, Map<path, context>>   incoming links (backlinks)
 *   names: Map<basenameLower → Set<path>>  for O(1) [[link]] resolution
 *   phantoms: Set<key>       note targets referenced but not (yet) existing
 *   attachments: Set<key>    non-md targets referenced but not in the index
 *   tagCounts: Map<tag, refcount>   aggregate of every #tag in the vault
 *
 * Node ids are one of: a real path, `phantom:<key>`, `attachment:<key>`,
 * or `tag:<name>`. `node.phantom === true` means "nothing on disk backs this
 * node" — true for phantoms, missing attachments AND tag nodes; read
 * `node.type` to tell them apart.
 */

const MD_RE = /\.md$/i;

/** Extension that marks a non-note target: 1–6 chars with at least one letter.
    Keeps `[[Version 1.2]]` and `[[Report v2.1]]` from looking like files. */
const ATTACH_EXT_RE = /\.(?=[a-z0-9]{1,6}$)[a-z0-9]*[a-z][a-z0-9]*$/i;

/** ASCII chars legal inside a #tag. Non-ASCII goes through UNI_TAG_RE. */
const TAG_CHAR = new Uint8Array(128);
for (const ch of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/') {
  TAG_CHAR[ch.charCodeAt(0)] = 1;
}
const UNI_TAG_RE = /[\p{L}\p{N}\p{M}]/u;
const TAG_HAS_WORD_RE = /[^\-_/]/;

/** Shared so every tag-less node points at the same array instead of a new []. */
const EMPTY_TAGS = Object.freeze([]);

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

/** Directory portion of a path — '' at the root, never a trailing slash. */
function folderOf(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** Does this target name point at something that isn't a markdown note? */
function isAttachmentName(name) {
  const m = ATTACH_EXT_RE.exec(basenameOf(name.trim()));
  if (!m) return false;
  const ext = m[0].slice(1).toLowerCase();
  return ext !== 'md' && ext !== 'mdx';
}

function isTagChar(content, i) {
  const code = content.charCodeAt(i);
  if (code < 128) return TAG_CHAR[code] === 1;
  return UNI_TAG_RE.test(content[i]);
}

/** A tag may only start at a word boundary: not mid-word, mid-path or after a
    '.' — that's what keeps `example.com#frag` and `### Heading` out. */
function isTagBoundary(prev) {
  if (prev === '.' || prev === '#') return false;
  const code = prev.charCodeAt(0);
  if (code >= 128) return false;
  return TAG_CHAR[code] !== 1;
}

/** Lowercase, strip wrapping slashes, reject separator-only garbage. */
function normalizeTag(raw) {
  let a = 0;
  let b = raw.length;
  while (a < b && raw[a] === '/') a++;
  while (b > a && raw[b - 1] === '/') b--;
  if (a >= b) return '';
  const s = raw.slice(a, b).toLowerCase();
  return TAG_HAS_WORD_RE.test(s) ? s : '';
}

/**
 * Single-pass markdown scanner: [[wikilinks]] and #tags in ONE character walk.
 * Allocation-light — no regex over the file body, no second pass for tags.
 *
 * Links come back with aliases stripped ("Note|alias" → "Note") plus an
 * `embed` flag for the `![[...]]` form. Tags are lowercased and deduped, and
 * are skipped inside fenced code blocks, inline code spans, headings and URLs.
 */
export function scanMarkdown(content) {
  const links = [];
  const tags = [];
  if (!content) return { links, tags };

  const n = content.length;
  let i = 0;
  let lead = true;       // nothing but whitespace so far on this line
  let inFence = false;   // inside a ``` / ~~~ block
  let fenceChar = '';
  let codeRun = 0;       // backtick run that opened the current code span
  let seenTags = null;   // lazily allocated — most files have no tags

  while (i < n) {
    const c = content[i];
    const atLead = lead;
    lead = lead && (c === ' ' || c === '\t');

    if (c === '\n') {
      lead = true;
      codeRun = 0;       // an inline code span never survives a line break
      i++;
      continue;
    }

    // ---- code fences and inline code spans ---------------------------------
    if (c === '`' || c === '~') {
      let k = i;
      while (k < n && content[k] === c) k++;
      const run = k - i;
      if (atLead && run >= 3) {
        if (!inFence) { inFence = true; fenceChar = c; }
        else if (c === fenceChar) { inFence = false; fenceChar = ''; }
      } else if (c === '`' && !inFence) {
        if (codeRun === 0) codeRun = run;
        else if (codeRun === run) codeRun = 0;
      }
      i = k;
      continue;
    }

    // ---- [[wikilinks]] -----------------------------------------------------
    if (c === '[' && i + 1 < n && content[i + 1] === '[') {
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
          links.push({
            target: raw,
            embed: i > 0 && content[i - 1] === '!',
            context: { before, match, after, full: before + match + after },
          });
        }
        i = j + 2;
        continue;
      }
      i = j + 1;
      continue;
    }

    // ---- #tags -------------------------------------------------------------
    if (c === '#' && !inFence && codeRun === 0 && (i === 0 || isTagBoundary(content[i - 1]))) {
      let k = i + 1;
      while (k < n && isTagChar(content, k)) k++;
      if (k > i + 1) {
        // `# Heading` never gets here: whitespace ends the body at k === i + 1.
        const name = normalizeTag(content.slice(i + 1, k));
        if (name) {
          if (!seenTags) seenTags = new Set();
          if (!seenTags.has(name)) { seenTags.add(name); tags.push(name); }
        }
        i = k;
        continue;
      }
    }

    i++;
  }
  return { links, tags };
}

/**
 * Single-pass scanner for [[wikilinks]] in markdown text.
 * Returns raw targets with aliases stripped ("Note|alias" → "Note").
 */
export function scanWikiLinks(content) {
  return scanMarkdown(content).links;
}

export function createLinkIndex() {
  const files = new Map();
  const forward = new Map();
  const inverse = new Map();
  const names = new Map();
  const phantoms = new Set();
  const attachments = new Set();
  const tagCounts = new Map();

  const listeners = new Set();
  // Referentially stable snapshots — recomputed once per mutation so views
  // can memo on version without O(N) rebuilds per render.
  let cachedNodes = null;
  let cachedLinks = null;
  let cachedStats = null;
  const notify = () => {
    cachedNodes = null;
    cachedLinks = null;
    cachedStats = null;
    for (const fn of listeners) fn();
  };

  function newMeta(path, mtime) {
    return { title: titleOf(path), mtime, tags: EMPTY_TAGS, attachment: isAttachmentName(path) };
  }

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

  function retainTag(tag) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  function releaseTag(tag) {
    const c = tagCounts.get(tag);
    if (c === undefined) return;
    if (c <= 1) tagCounts.delete(tag);
    else tagCounts.set(tag, c - 1);
  }

  /** Resolve a raw [[target]] to a real path, or null (→ phantom).
      Handles both [[basename]] and [[dir/basename]] (path-suffix) forms,
      for notes and for attachments alike. */
  function resolve(rawTarget) {
    const clean = rawTarget.trim();
    const baseKey = keyOf(basenameOf(clean));
    const set = names.get(baseKey);
    if (!set || set.size === 0) return null;

    if (clean.includes('/')) {
      // Path-suffix form: keep only candidates ending with the given subpath.
      // Compared with .md stripped so [[dir/c]] and [[dir/img.png]] both work.
      const suffix = '/' + keyOf(clean);
      const matches = [...set].filter(p => p.toLowerCase().replace(MD_RE, '').endsWith(suffix));
      if (matches.length > 0) {
        return matches.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
      }
      return null; // explicit path that doesn't exist — phantom, not a guess
    }

    // Deterministic: shortest path wins (closest to root), then lexical.
    return [...set].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  }

  /** Ghost ids carry their own registry — keep the sets self-healing so an
      edge and its placeholder node can never drift apart. */
  function retainGhost(target) {
    if (target.startsWith('phantom:')) phantoms.add(target.slice(8));
    else if (target.startsWith('attachment:')) attachments.add(target.slice(11));
  }

  function releaseGhost(target) {
    if (target.startsWith('phantom:')) phantoms.delete(target.slice(8));
    else if (target.startsWith('attachment:')) attachments.delete(target.slice(11));
  }

  function addEdge(source, target, context = '') {
    retainGhost(target);
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
        if (inv.size === 0) {
          inverse.delete(target);
          releaseGhost(target); // last referrer gone — drop the placeholder
        }
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
      if (resolved) addEdge(source, resolved, context);
      else if (isAttachmentName(raw)) addEdge(source, `attachment:${key}`, context);
      else addEdge(source, `phantom:${key}`, context);
    }
  }

  /** Register/update a file's #tags, refcounting the vault-wide aggregate. */
  function setTags(path, next) {
    const meta = files.get(path);
    if (!meta) return;
    for (const t of meta.tags) releaseTag(t);
    meta.tags = next && next.length ? next : EMPTY_TAGS;
    for (const t of meta.tags) retainTag(t);
  }

  /** A ghost target materialized: rewrite its edges to the real path. */
  function materialize(path) {
    const key = keyOf(titleOf(path));
    for (const ghostId of [`phantom:${key}`, `attachment:${key}`]) {
      const ins = inverse.get(ghostId);
      if (!ins) continue;
      releaseGhost(ghostId);
      for (const [source, context] of [...ins]) {
        const outs = forward.get(source);
        if (outs && outs.delete(ghostId)) addEdge(source, path, context);
      }
      inverse.delete(ghostId);
    }
  }

  return {
    // --- bulk boot ---------------------------------------------------------
    /** Seed the file list (structure-only; no contents). */
    setFiles(paths) {
      files.clear();
      names.clear();
      tagCounts.clear(); // contents are re-indexed right after
      for (const p of paths) {
        files.set(p, newMeta(p, 0));
        addName(p);
      }
      // Re-resolve: existing edges may now point at real files
      for (const key of [...phantoms, ...attachments]) {
        const hit = names.get(key);
        if (hit && hit.size > 0) materialize([...hit][0]);
      }
      notify();
    },

    /** Seed one file's parsed content (used by the boot bulk pass). */
    indexContent(path, content, mtime = 0) {
      if (!files.has(path)) {
        files.set(path, newMeta(path, mtime));
        addName(path);
        materialize(path);
      } else {
        files.get(path).mtime = mtime;
      }
      const { links, tags } = scanMarkdown(content);
      setLinks(path, links);
      setTags(path, tags);
    },
    bootDone() { notify(); },

    // --- incremental -------------------------------------------------------
    /** The file was saved: re-parse just this file. */
    updateContent(path, content, mtime = Date.now()) {
      const existed = files.has(path);
      if (!existed) {
        files.set(path, newMeta(path, mtime));
        addName(path);
      } else {
        files.get(path).mtime = mtime;
      }
      const { links, tags } = scanMarkdown(content);
      setLinks(path, links);
      setTags(path, tags);
      if (!existed) materialize(path);
      notify();
    },

    addFile(path) {
      if (files.has(path)) return;
      files.set(path, newMeta(path, Date.now()));
      addName(path);
      materialize(path);
      notify();
    },

    removeFile(path) {
      const meta = files.get(path);
      if (!meta) return;
      files.delete(path);
      for (const t of meta.tags) releaseTag(t);
      removeName(path);
      clearEdgesFrom(path);           // outgoing
      const ins = inverse.get(path);  // incoming → become ghosts again
      if (ins) {
        const key = keyOf(titleOf(path));
        const ghostId = meta.attachment ? `attachment:${key}` : `phantom:${key}`;
        for (const [source, context] of [...ins]) {
          const outs = forward.get(source);
          if (outs && outs.delete(path)) addEdge(source, ghostId, context);
        }
        inverse.delete(path);
      }
      notify();
    },

    renameFile(oldPath, newPath) {
      if (!files.has(oldPath)) { this.addFile(newPath); return; }
      const meta = files.get(oldPath);
      const tags = meta.tags;
      const outs = forward.get(oldPath) ? [...forward.get(oldPath)] : null;
      this.removeFile(oldPath); // releases the old tag refs
      files.set(newPath, { ...meta, title: titleOf(newPath), attachment: isAttachmentName(newPath), tags });
      for (const t of tags) retainTag(t);
      addName(newPath);
      if (outs) for (const [t, context] of outs) addEdge(newPath, t, context);
      materialize(newPath);
      notify();
    },

    // --- queries ------------------------------------------------------------
    /** O(1) backlinks for a path: [{ source, context }]. Tag edges are not
        real links and never show up here. */
    backlinks(path) {
      const inv = inverse.get(path);
      if (!inv) return [];
      return [...inv].map(([source, context]) => ({ source, context }));
    },
    forwardlinks(path) {
      return [...(forward.get(path)?.keys() || [])];
    },
    /** A file's own #tags (lowercased, in document order). */
    tagsOf(path) {
      return files.get(path)?.tags || EMPTY_TAGS;
    },
    /** Every distinct tag in the vault, sorted. */
    allTags() {
      return [...tagCounts.keys()].sort();
    },
    /** All graph nodes: files, phantoms, attachments and tags (cached snapshot).
        Shape: { id, title, type, phantom, folder, tags, mtime }. */
    nodes() {
      if (!cachedNodes) {
        const out = [];
        for (const [path, meta] of files) {
          out.push({
            id: path,
            title: meta.title,
            type: meta.attachment ? 'attachment' : 'file',
            phantom: false,
            folder: folderOf(path),
            tags: meta.tags,
            mtime: meta.mtime,
          });
        }
        for (const key of phantoms) {
          out.push({
            id: `phantom:${key}`,
            title: key,
            type: 'phantom',
            phantom: true,
            folder: '',
            tags: EMPTY_TAGS,
            mtime: 0,
          });
        }
        for (const key of attachments) {
          out.push({
            id: `attachment:${key}`,
            title: basenameOf(key),
            type: 'attachment',
            phantom: true, // referenced but not on disk
            folder: '',
            tags: EMPTY_TAGS,
            mtime: 0,
          });
        }
        for (const name of tagCounts.keys()) {
          out.push({
            id: `tag:${name}`,
            title: `#${name}`,
            type: 'tag',
            phantom: true, // no file behind a tag — frames must not "open" it
            folder: '',
            tags: [name],
            mtime: 0,
          });
        }
        cachedNodes = out;
      }
      return cachedNodes;
    },
    /** All graph edges: real links plus file→tag edges (cached snapshot). */
    links() {
      if (!cachedLinks) {
        const out = [];
        for (const [source, targets] of forward) {
          for (const target of targets.keys()) out.push({ source, target });
        }
        for (const [path, meta] of files) {
          for (const t of meta.tags) out.push({ source: path, target: `tag:${t}` });
        }
        cachedLinks = out;
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
        let fileCount = 0;
        let attachmentCount = attachments.size;
        for (const [, meta] of files) {
          if (meta.attachment) attachmentCount++;
          else fileCount++;
          edgeCount += meta.tags.length; // file→tag edges are real graph edges
        }
        cachedStats = {
          files: fileCount,
          links: edgeCount,
          phantoms: phantoms.size,
          tags: tagCounts.size,
          attachments: attachmentCount,
        };
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
