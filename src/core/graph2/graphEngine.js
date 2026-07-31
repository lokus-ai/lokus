/**
 * graphEngine — ONE engine, N frames.
 *
 * The engine is a long-lived singleton that owns the layout: it holds the
 * simulation, the node objects, and their positions. It is never "compiled
 * once" — an index mutation reconciles the node set IN PLACE (positions and
 * velocities survive) and nudges the simulation, so a new [[link]] slides
 * into place instead of re-exploding the graph.
 *
 * Frames (sidebar preview, full tab, anything else) do NOT own a simulation.
 * They subscribe, read `nodes()`/`links()`, and draw with their own camera.
 * Two frames therefore always agree on layout and cost one sim, not two.
 *
 *   linkIndex ──(version bump)──► engine.reconcile() ──(tick)──► frames redraw
 *   config    ──(setConfig)─────► forces / filters / colors
 *
 * Pure-ish: d3-force only. No DOM, no React, no Tauri.
 */
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
} from 'd3-force';
import { getColorGroupMatch } from './colorGroups.js';

/** Node shape produced by the engine (the contract frames draw against):
 *  { id, title, path, type, phantom, folder, tags, mtime, degree,
 *    x, y, vx, vy, fx, fy, color, radius, dim }
 *  `dim` is set by search highlighting — frames render dimmed, not hidden.
 */

/** Theme variables that already exist in globals.css — do not invent new ones. */
const TYPE_COLORS = {
  file: '--graph-node-document',
  phantom: '--graph-node-placeholder',
  tag: '--graph-node-tag',
  attachment: '--graph-node-folder',
};

function folderOf(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** Golden-angle hue walk — stable, well-separated colors for categorical schemes. */
function hueFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

function dateColor(t, min, max) {
  if (!t || max === min) return 'hsl(220 8% 55%)';
  const p = (t - min) / (max - min);          // 0 = oldest, 1 = newest
  return `hsl(${Math.round(210 - p * 180)} 65% 55%)`; // blue → warm
}

export function createGraphEngine() {
  let index = null;
  let unsubIndex = null;
  let config = {};
  let focusPath = null;

  let nodes = [];
  let links = [];
  const byId = new Map();
  const neighbors = new Map();   // id → Set<id>, for O(1) hover highlight
  const positions = new Map();   // id → {x,y,vx,vy} survives filter churn

  let sim = null;
  let running = false;
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) fn(); };

  // Only frames subscribe, so an empty listener set means nothing is drawing
  // the graph right now. Index changes that land in that state are recorded
  // rather than acted on: rebuilding the view model and re-heating the sim on
  // every save cost hundreds of ms of main-thread time for pixels nobody was
  // looking at. `staleIndex` says the node/link set needs rebuilding;
  // `owedHeat` is the largest re-heat we skipped. Both are settled by the next
  // frame to subscribe.
  let staleIndex = false;
  let owedHeat = 0;

  // ---- view model -----------------------------------------------------------

  /** Which nodes/links survive the current filter config. */
  function buildViewModel() {
    if (!index) return { rawNodes: [], rawLinks: [] };

    const all = index.nodes();
    const allLinks = index.links();

    const degree = new Map();
    for (const l of allLinks) {
      degree.set(l.source, (degree.get(l.source) || 0) + 1);
      degree.set(l.target, (degree.get(l.target) || 0) + 1);
    }

    const showTags = config.showTags ?? true;
    const showAttachments = config.showAttachments ?? false;
    const hideUnresolved = config.hideUnresolved ?? false;
    const showOrphans = config.showOrphans ?? true;

    let keep = all.filter((n) => {
      const type = n.type || (n.phantom ? 'phantom' : 'file');
      if (type === 'phantom' && hideUnresolved) return false;
      if (type === 'tag' && !showTags) return false;
      if (type === 'attachment' && !showAttachments) return false;
      if (!showOrphans && !(degree.get(n.id) > 0)) return false;
      return true;
    });

    // Local graph: BFS out from the focused file to `localDepth` hops.
    if (config.localMode && focusPath) {
      const depth = Math.max(1, config.localDepth ?? 1);
      const adj = new Map();
      for (const l of allLinks) {
        if (!adj.has(l.source)) adj.set(l.source, []);
        if (!adj.has(l.target)) adj.set(l.target, []);
        adj.get(l.source).push(l.target);
        adj.get(l.target).push(l.source);
      }
      const reach = new Set([focusPath]);
      let frontier = [focusPath];
      for (let d = 0; d < depth; d++) {
        const next = [];
        for (const id of frontier) {
          for (const nb of adj.get(id) || []) {
            if (!reach.has(nb)) { reach.add(nb); next.push(nb); }
          }
        }
        frontier = next;
      }
      keep = keep.filter((n) => reach.has(n.id));
    }

    const keepIds = new Set(keep.map((n) => n.id));
    const rawLinks = allLinks.filter((l) => keepIds.has(l.source) && keepIds.has(l.target));

    return { rawNodes: keep, rawLinks, degree };
  }

  /** Colors + radii — display-only, recomputed without touching the sim. */
  function paint() {
    const scheme = config.colorScheme || 'type';
    const groups = config.colorGroups || [];
    const sizeMul = config.nodeSizeMultiplier ?? 1;

    let minT = Infinity;
    let maxT = -Infinity;
    if (scheme === 'creation-date' || scheme === 'modification-date') {
      for (const n of nodes) {
        const t = n.mtime || 0;
        if (t) { if (t < minT) minT = t; if (t > maxT) maxT = t; }
      }
    }

    const q = (config.search || '').trim().toLowerCase();

    for (const n of nodes) {
      // Explicit color-group override wins over the scheme.
      const override = getColorGroupMatch(groups, n);
      if (override) {
        n.color = override;
      } else {
        switch (scheme) {
          case 'folder':
            n.color = n.folder ? `hsl(${hueFor(n.folder)} 60% 58%)` : 'hsl(220 8% 55%)';
            break;
          case 'tag': {
            const primary = n.tags?.[0];
            n.color = primary ? `hsl(${hueFor(primary)} 65% 58%)` : 'hsl(220 8% 55%)';
            break;
          }
          case 'creation-date':
          case 'modification-date':
            n.color = dateColor(n.mtime, minT, maxT);
            break;
          case 'type':
          default:
            n.color = null; // frame resolves from CSS var by type
        }
      }
      n.cssVar = TYPE_COLORS[n.type] || TYPE_COLORS.file;
      n.radius = Math.min(3 + n.degree * 0.8, 9) * sizeMul * (n.type === 'phantom' ? 0.8 : 1);
      n.dim = q ? !(n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) : false;
    }
  }

  // ---- reconcile (the live part) ---------------------------------------------

  /** Rebuild the node/link set from the index, PRESERVING positions. */
  function reconcile({ reheat = 0.25 } = {}) {
    const { rawNodes, rawLinks, degree } = buildViewModel();

    // Stash current positions before we rebuild (covers filter churn too).
    for (const n of nodes) positions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });

    const prev = byId;
    const next = [];
    const nextById = new Map();

    for (const raw of rawNodes) {
      let n = prev.get(raw.id);
      if (!n) {
        const saved = positions.get(raw.id);
        n = saved ? { ...saved } : seedNear(raw, rawLinks, prev);
        n.id = raw.id;
      }
      n.title = raw.title;
      n.path = raw.phantom ? null : raw.id;
      n.type = raw.type || (raw.phantom ? 'phantom' : 'file');
      n.phantom = !!raw.phantom;
      n.folder = raw.folder ?? (raw.phantom ? '' : folderOf(raw.id));
      n.tags = raw.tags || [];
      n.mtime = raw.mtime || 0;
      n.degree = degree.get(raw.id) || 0;
      next.push(n);
      nextById.set(n.id, n);
    }

    // d3 mutates link source/target into node refs — always feed it fresh objects.
    const liveLinks = rawLinks
      .filter((l) => nextById.has(l.source) && nextById.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));

    nodes = next;
    links = liveLinks;
    byId.clear();
    for (const [k, v] of nextById) byId.set(k, v);

    neighbors.clear();
    for (const l of liveLinks) {
      if (!neighbors.has(l.source)) neighbors.set(l.source, new Set());
      if (!neighbors.has(l.target)) neighbors.set(l.target, new Set());
      neighbors.get(l.source).add(l.target);
      neighbors.get(l.target).add(l.source);
    }

    paint();
    applyToSim(reheat);
    notify();
  }

  /** New node with no history: drop it next to a linked neighbor, else origin. */
  function seedNear(raw, rawLinks, prev) {
    for (const l of rawLinks) {
      const other = l.source === raw.id ? l.target : l.target === raw.id ? l.source : null;
      if (other && prev.has(other)) {
        const a = prev.get(other);
        return { x: a.x + (Math.random() - 0.5) * 30, y: a.y + (Math.random() - 0.5) * 30, vx: 0, vy: 0 };
      }
    }
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 60;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 };
  }

  // ---- simulation --------------------------------------------------------------

  function applyToSim(reheat) {
    const linkDistance = config.linkDistance ?? 80;
    const linkStrength = config.linkStrength ?? 0.3;
    const repel = config.repelStrength ?? 100;
    const center = config.centerStrength ?? 0.1;

    if (!sim) {
      sim = forceSimulation(nodes)
        .alphaDecay(0.045)
        .velocityDecay(0.35)
        .on('tick', notify)
        .on('end', () => { running = false; notify(); });
    } else {
      sim.nodes(nodes);
    }

    sim
      .force('link', forceLink(links).id((d) => d.id).distance(linkDistance).strength(linkStrength))
      .force('charge', forceManyBody().strength(-repel))
      .force('center', forceCenter(0, 0).strength(center))
      .force('collide', forceCollide((d) => d.radius + 4));

    if (reheat > 0) {
      if (listeners.size === 0) {
        // Nothing is drawing — don't spin d3's timer to animate an invisible
        // layout. Bank the heat; the next frame to subscribe spends it.
        owedHeat = Math.max(owedHeat, reheat);
        sim.stop();
        running = false;
        return;
      }
      running = true;
      sim.alpha(Math.max(sim.alpha(), reheat)).restart();
    }
  }

  /**
   * Bring the node/link set up to date without waking the simulation.
   *
   * Read accessors call this so that skipping work while nothing is drawing
   * stays invisible to callers: `nodes()`/`stats()` never return a stale view
   * just because no frame happens to be mounted. Only the *animation* is
   * deferred — that's the expensive part, and it's the part nobody can see.
   */
  function settle() {
    if (!staleIndex) return;
    staleIndex = false;
    reconcile({ reheat: 0 });
  }

  // ---- public API ---------------------------------------------------------------

  return {
    /** Bind to a linkIndex. Re-binding swaps workspaces cleanly. */
    attach(nextIndex) {
      if (index === nextIndex) return;
      unsubIndex?.();
      index = nextIndex;
      positions.clear();
      byId.clear();
      nodes = [];
      links = [];
      staleIndex = false;
      owedHeat = 0;
      if (!index) { notify(); return; }
      unsubIndex = index.subscribe(() => {
        if (listeners.size === 0) {
          staleIndex = true;
          owedHeat = Math.max(owedHeat, 0.2);
          return;
        }
        reconcile({ reheat: 0.2 });
      });
      reconcile({ reheat: 0.7 }); // first layout settles properly
    },

    /** Merge a config patch. Only does the work the patch actually requires. */
    setConfig(patch) {
      const before = config;
      config = { ...config, ...patch };

      const touched = Object.keys(patch);
      const structural = ['showTags', 'showAttachments', 'hideUnresolved', 'showOrphans', 'localMode', 'localDepth'];
      const physical = ['linkDistance', 'linkStrength', 'repelStrength', 'centerStrength'];

      if (touched.some((k) => structural.includes(k))) {
        reconcile({ reheat: 0.3 });
      } else if (touched.some((k) => physical.includes(k) && patch[k] !== before[k])) {
        applyToSim(0.3);
        notify();
      } else {
        paint();   // colors / sizes / search — no layout work at all
        notify();
      }
    },
    getConfig: () => config,

    /** The focused file drives local-graph mode; frames handle their own camera. */
    setFocus(path) {
      if (focusPath === path) return;
      focusPath = path;
      if (config.localMode) reconcile({ reheat: 0.3 });
      else notify();
    },
    getFocus: () => focusPath,

    nodes: () => { settle(); return nodes; },
    links: () => { settle(); return links; },
    node: (id) => { settle(); return byId.get(id) || null; },
    neighbors: (id) => { settle(); return neighbors.get(id) || EMPTY_SET; },
    isRunning: () => running,

    stats() {
      settle();
      const files = nodes.filter((n) => n.type === 'file').length;
      const phantoms = nodes.filter((n) => n.type === 'phantom').length;
      return { nodes: nodes.length, files, links: links.length, phantoms };
    },

    /** Drag support — frames pin/unpin, the engine owns the heat.
     *  Frames call pin() on every pointermove, so only the *first* pin of a
     *  drag re-heats: alphaTarget holds the sim awake until unpin clears it.
     *  Restarting per move would thrash the timer for no visual gain. */
    pin(id, x, y) {
      const n = byId.get(id);
      if (!n) return;
      const wasPinned = n.fx != null || n.fy != null;
      n.fx = x;
      n.fy = y;
      if (!wasPinned) {
        running = true;
        sim?.alphaTarget(0.15).restart();
      } else {
        notify(); // still redraw the dragged node between ticks
      }
    },
    unpin(id) {
      const n = byId.get(id);
      if (!n || (n.fx == null && n.fy == null)) return;
      n.fx = null;
      n.fy = null;
      sim?.alphaTarget(0);
    },
    reheat(alpha = 0.3) {
      if (!sim) return;
      if (listeners.size === 0) { owedHeat = Math.max(owedHeat, alpha); return; }
      running = true;
      sim.alpha(alpha).restart();
    },

    subscribe(fn) {
      const wasIdle = listeners.size === 0;
      listeners.add(fn);

      // First frame to look at the graph pays for whatever changed while it
      // wasn't watching — once, instead of on every intervening save.
      if (wasIdle) {
        const heat = owedHeat;
        owedHeat = 0;
        if (staleIndex) {
          staleIndex = false;
          reconcile({ reheat: Math.max(heat, 0.2) });
        } else if (heat > 0) {
          // A read already settled the data; all that's left is the layout.
          applyToSim(heat);
        }
      }

      return () => {
        listeners.delete(fn);
        // Last frame went away: park the simulation instead of letting it
        // keep ticking against an audience of nobody.
        if (listeners.size === 0) {
          sim?.stop();
          running = false;
        }
      };
    },

    destroy() {
      unsubIndex?.();
      unsubIndex = null;
      sim?.stop();
      sim = null;
      listeners.clear();
      nodes = [];
      links = [];
      byId.clear();
      neighbors.clear();
      positions.clear();
      index = null;
    },
  };
}

const EMPTY_SET = new Set();

/** App-wide singleton — one engine per running app, re-attached per workspace. */
let singleton = null;
export function getGraphEngine() {
  if (!singleton) singleton = createGraphEngine();
  return singleton;
}
export function resetGraphEngine() {
  singleton?.destroy();
  singleton = null;
}
