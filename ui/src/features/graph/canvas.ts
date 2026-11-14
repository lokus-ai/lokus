/** @part-of ui.graph */
import { type Body, type Forces, Simulation } from "./simulation";

export interface GraphNode {
  path: string;
  title: string;
  degree: number;
}

/** What is drawn: some notes and the links between them (source index, target index). */
export interface Model {
  nodes: GraphNode[];
  edges: [number, number][];
}

export interface Handlers {
  /** A dot was clicked (or the background, which gives null). */
  onSelect(index: number | null): void;
  /** A dot was double-clicked, or clicked with Cmd or Ctrl held. */
  onOpen(index: number): void;
}

export interface Controller {
  setForces(forces: Forces): void;
  setActive(path: string | null): void;
  /** Dim every dot whose index is not in the set; null shows everything. */
  setMatches(matches: Set<number> | null): void;
  /** Mark a dot as selected; `glide` also brings it to the middle. */
  select(index: number | null, glide?: boolean): void;
  /** Space on the right covered by the preview, so centring avoids it. */
  setInset(right: number): void;
  zoomBy(factor: number): void;
  fit(): void;
  destroy(): void;
}

/** Where each note sat last time, so reopening the graph or editing a note does not reshuffle it. */
const remembered = new Map<string, { x: number; y: number }>();

const HIT_PAD = 6;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;
const GLIDE_MS = 420;
const FADE_MS = 140;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const radius = (degree: number) => 3.5 + Math.sqrt(degree) * 1.5;
const shorten = (s: string) => (s.length > 34 ? `${s.slice(0, 33)}…` : s);

function place(model: Model): { bodies: Body[]; fresh: number } {
  let fresh = 0;
  const bodies = model.nodes.map((node, i): Body => {
    const was = remembered.get(node.path);
    if (!was) fresh++;
    // New dots start on an even spiral; the simulation takes it from there.
    const r = 12 * Math.sqrt(i + 0.5);
    const a = i * 2.399963;
    return { x: was?.x ?? Math.cos(a) * r, y: was?.y ?? Math.sin(a) * r, vx: 0, vy: 0, fx: null, fy: null, mass: 1 + Math.sqrt(node.degree) * 0.4, r: radius(node.degree) };
  });
  return { bodies, fresh };
}

/**
 * Draws a model on a canvas and makes it respond: drag a dot and its neighbours follow, drag the
 * background to pan, scroll or pinch to zoom, hover to light up a dot's links, click to select.
 * It only redraws while something is moving.
 */
export function mountGraph(el: HTMLCanvasElement, model: Model, forces: Forces, activePath: string | null, handlers: Handlers): Controller {
  const ctx = el.getContext("2d")!;
  const { bodies, fresh } = place(model);
  const sim = new Simulation(bodies, model.edges, forces);
  const near: number[][] = model.nodes.map(() => []);
  for (const [s, t] of model.edges) {
    near[s].push(t);
    near[t].push(s);
  }
  const radii = model.nodes.map((n) => radius(n.degree));
  const labels = model.nodes.map((n) => shorten(n.title));

  // A graph seen before only needs a nudge; a new one is settled most of the way before it is shown.
  if (fresh === 0) sim.alpha = 0.05;
  else if (fresh < bodies.length) sim.alpha = 0.3;
  else for (let i = 0; i < 140 && bodies.length < 3000; i++) sim.tick();

  const view = { x: 0, y: 0, k: 1 };
  /** A camera move in progress. `follow` keeps aiming at a dot that is itself still moving. */
  let glide: { from: typeof view; to: typeof view; start: number; follow: number } | null = null;
  let touched = false;
  let inset = 0;
  let active = activePath;
  let selected = -1;
  let hover = -1;
  let matches: Set<number> | null = null;
  /** The dot whose links are lit, and how far the rest has faded (0 to 1). */
  let focus = -1;
  let fade = 0;
  let frame = 0;
  let last = 0;
  let pointer: { x: number; y: number } | null = null;
  let drag: { node: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null = null;

  const size = () => el.getBoundingClientRect();
  const toWorld = (px: number, py: number) => {
    const r = size();
    return { x: (px - r.left - r.width / 2 - view.x) / view.k, y: (py - r.top - r.height / 2 - view.y) / view.k };
  };
  const at = (px: number, py: number): number => {
    const p = toWorld(px, py);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < bodies.length; i++) {
      const d = Math.hypot(bodies[i].x - p.x, bodies[i].y - p.y);
      if (d < Math.max(radii[i], 2 / view.k) + HIT_PAD / view.k && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  };

  const kick = () => {
    if (!frame) frame = requestAnimationFrame(loop);
  };
  const glideTo = (to: typeof view, animate = true, follow = -1) => {
    if (!animate) {
      Object.assign(view, to);
      glide = null;
    } else glide = { from: { ...view }, to, start: performance.now(), follow };
    kick();
  };
  const centredOn = (node: number, k: number) => ({ k, x: -bodies[node].x * k - inset / 2, y: -bodies[node].y * k });
  const fitView = (animate: boolean) => {
    if (bodies.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    bodies.forEach((b, i) => {
      minX = Math.min(minX, b.x - radii[i]);
      minY = Math.min(minY, b.y - radii[i]);
      maxX = Math.max(maxX, b.x + radii[i]);
      maxY = Math.max(maxY, b.y + radii[i]);
    });
    const r = size();
    const w = Math.max(120, r.width - inset - 120);
    const h = Math.max(120, r.height - 140);
    const k = clamp(Math.min(w / Math.max(1, maxX - minX), h / Math.max(1, maxY - minY)), MIN_ZOOM, 1.4);
    glideTo({ k, x: -((minX + maxX) / 2) * k - inset / 2, y: -((minY + maxY) / 2) * k }, animate);
  };

  const draw = () => {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = size();
    if (el.width !== Math.round(width * ratio) || el.height !== Math.round(height * ratio)) {
      el.width = Math.round(width * ratio);
      el.height = Math.round(height * ratio);
    }
    const style = getComputedStyle(el);
    const color = (name: string) => style.getPropertyValue(name).trim();
    const fg = color("--fg");
    const fg2 = color("--fg-2");
    const fg3 = color("--fg-3");
    const accent = color("--accent");
    const bg = color("--bg");
    const k = view.k;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width / 2 + view.x, height / 2 + view.y);
    ctx.scale(k, k);

    const lit = focus >= 0 ? new Set([focus, ...near[focus]]) : null;
    // A dot is faded when the search does not match it or when another dot is lit; a lit dot never is.
    const shown = (i: number) => {
      const searched = matches && !matches.has(i) ? 0.16 : 1;
      if (!lit) return searched;
      return lit.has(i) ? Math.max(searched, fade) : Math.max(0.07, searched * (1 - fade * 0.8));
    };

    // Links: all of them faintly, then the lit dot's own on top.
    ctx.lineWidth = 1 / k;
    ctx.strokeStyle = fg3;
    ctx.globalAlpha = (matches ? 0.12 : 0.34) * (1 - fade * 0.75);
    ctx.beginPath();
    for (const [s, t] of model.edges) {
      ctx.moveTo(bodies[s].x, bodies[s].y);
      ctx.lineTo(bodies[t].x, bodies[t].y);
    }
    ctx.stroke();
    if (lit) {
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4 / k;
      ctx.beginPath();
      for (const t of near[focus]) {
        ctx.moveTo(bodies[focus].x, bodies[focus].y);
        ctx.lineTo(bodies[t].x, bodies[t].y);
      }
      ctx.stroke();
    }
    // Arrowheads show which way a link points, once there is room to see them.
    if (k > 0.75 && model.edges.length < 4000) {
      const head = 5 / k;
      ctx.fillStyle = fg3;
      ctx.globalAlpha = (matches ? 0.14 : 0.5) * (1 - fade * 0.75);
      ctx.beginPath();
      for (const [s, t] of model.edges) {
        const a = bodies[s];
        const b = bodies[t];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < radii[t] + head * 2) continue;
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        const tipX = b.x - ux * (radii[t] + 1 / k);
        const tipY = b.y - uy * (radii[t] + 1 / k);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - ux * head - uy * head * 0.45, tipY - uy * head + ux * head * 0.45);
        ctx.lineTo(tipX - ux * head + uy * head * 0.45, tipY - uy * head - ux * head * 0.45);
      }
      ctx.fill();
    }

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const r = Math.max(radii[i], 1.8 / k);
      const isActive = model.nodes[i].path === active;
      ctx.globalAlpha = shown(i);
      ctx.fillStyle = isActive ? accent : i === hover || i === selected ? fg : model.nodes[i].degree === 0 ? fg3 : fg2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (i === selected) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 / k;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 3.5 / k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Names fade in as you zoom in, well-linked notes first; lit and selected ones always show.
    ctx.font = `${12 / k}px ${color("--font-ui")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3 / k;
    ctx.strokeStyle = bg;
    const left = (-width / 2 - view.x) / k;
    const top = (-height / 2 - view.y) / k;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.x < left - 80 / k || b.x > left + (width + 80) / k || b.y < top - 20 / k || b.y > top + (height + 20) / k) continue;
      const pinned = i === selected || i === hover || model.nodes[i].path === active ? 1 : lit?.has(i) ? fade : 0;
      const byZoom = clamp((k * (1 + Math.sqrt(model.nodes[i].degree) * 0.14) - 0.8) / 0.25, 0, 1);
      const alpha = Math.max(pinned, byZoom) * shown(i);
      if (alpha < 0.03) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i === hover || i === selected ? fg : fg2;
      const y = b.y + Math.max(radii[i], 1.8 / k) + 5 / k;
      ctx.strokeText(labels[i], b.x, y);
      ctx.fillText(labels[i], b.x, y);
    }
    ctx.globalAlpha = 1;
  };

  function loop(now: number): void {
    frame = 0;
    const dt = Math.min(64, last ? now - last : 16);
    last = now;
    let busy = sim.tick();
    if (busy && !drag && pointer) hover = at(pointer.x, pointer.y);
    // The first time a fresh layout comes to rest, frame it, unless the person has already moved.
    if (!busy && !touched && fresh > 0 && !glide) {
      touched = true;
      fitView(true);
    }
    if (glide) {
      if (glide.follow >= 0) glide.to = centredOn(glide.follow, glide.to.k);
      const t = clamp((now - glide.start) / GLIDE_MS, 0, 1);
      const e = 1 - (1 - t) ** 3;
      view.x = glide.from.x + (glide.to.x - glide.from.x) * e;
      view.y = glide.from.y + (glide.to.y - glide.from.y) * e;
      view.k = glide.from.k + (glide.to.k - glide.from.k) * e;
      if (t >= 1) glide = null;
      busy = true;
    }
    const want = hover >= 0 ? hover : selected;
    if (want >= 0) focus = want;
    const target = want >= 0 ? 1 : 0;
    if (fade !== target) {
      fade = target > fade ? Math.min(1, fade + dt / FADE_MS) : Math.max(0, fade - dt / FADE_MS);
      if (fade === 0) focus = -1;
      busy = true;
    }
    draw();
    if (busy) kick();
    else last = 0;
  }

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const node = at(e.clientX, e.clientY);
    const p = toWorld(e.clientX, e.clientY);
    drag = { node, x: e.clientX, y: e.clientY, dx: node >= 0 ? bodies[node].x - p.x : 0, dy: node >= 0 ? bodies[node].y - p.y : 0, moved: false };
    glide = null;
    el.style.cursor = "grabbing";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const move = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
    if (!drag) {
      const next = at(e.clientX, e.clientY);
      if (next !== hover) {
        hover = next;
        kick();
      }
      el.style.cursor = hover >= 0 ? "pointer" : "grab";
      return;
    }
    if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 4) return;
    drag.moved = true;
    if (drag.node >= 0) {
      // Hold the dot under the pointer and keep the simulation warm so the rest reacts.
      const p = toWorld(e.clientX, e.clientY);
      bodies[drag.node].fx = p.x + drag.dx;
      bodies[drag.node].fy = p.y + drag.dy;
      sim.alphaTarget = 0.3;
      sim.reheat(0.3);
      hover = drag.node;
    } else {
      view.x += e.clientX - drag.x;
      view.y += e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      touched = true;
    }
    kick();
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    const was = drag;
    drag = null;
    if (!was) return;
    if (was.node >= 0) {
      bodies[was.node].fx = null;
      bodies[was.node].fy = null;
      sim.alphaTarget = 0;
      // Enough heat left for the dot to spring back and the rest to settle around it.
      if (was.moved) sim.reheat(0.3);
    }
    el.style.cursor = hover >= 0 ? "pointer" : "grab";
    if (!was.moved) {
      if (was.node >= 0 && (e.metaKey || e.ctrlKey)) handlers.onOpen(was.node);
      else handlers.onSelect(was.node >= 0 ? was.node : null);
    }
    kick();
  };
  /** While a drag is on, the window's listener is the one that follows the pointer. */
  const hovering = (e: PointerEvent) => {
    if (!drag) move(e);
  };
  const leave = () => {
    pointer = null;
    if (!drag && hover !== -1) {
      hover = -1;
      kick();
    }
  };
  const doubleClick = (e: MouseEvent) => {
    const node = at(e.clientX, e.clientY);
    if (node >= 0) handlers.onOpen(node);
  };
  const zoomAt = (px: number, py: number, factor: number) => {
    const before = toWorld(px, py);
    view.k = clamp(view.k * factor, MIN_ZOOM, MAX_ZOOM);
    const after = toWorld(px, py);
    view.x += (after.x - before.x) * view.k;
    view.y += (after.y - before.y) * view.k;
    glide = null;
    touched = true;
    kick();
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    // A pinch arrives as a wheel event with Ctrl held, in much smaller steps.
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", hovering);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("dblclick", doubleClick);
  el.addEventListener("wheel", wheel, { passive: false });
  const resized = new ResizeObserver(() => {
    if (!touched) fitView(false);
    kick();
  });
  resized.observe(el);
  // The theme can change under us; the colours are read on every draw, so one redraw is enough.
  const themed = new MutationObserver(kick);
  themed.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", kick);

  fitView(false);
  kick();

  return {
    setForces(next) {
      sim.forces = next;
      sim.reheat(0.5);
      kick();
    },
    setActive(path) {
      active = path;
      kick();
    },
    setMatches(next) {
      matches = next;
      kick();
    },
    select(index, bring = false) {
      selected = index ?? -1;
      if (bring && selected >= 0) {
        touched = true;
        glideTo(centredOn(selected, Math.max(view.k, 0.9)), true, selected);
      }
      kick();
    },
    setInset(right) {
      inset = right;
    },
    zoomBy(factor) {
      const r = size();
      zoomAt(r.left + (r.width - inset) / 2, r.top + r.height / 2, factor);
    },
    fit() {
      touched = true;
      fitView(true);
    },
    destroy() {
      cancelAnimationFrame(frame);
      model.nodes.forEach((n, i) => remembered.set(n.path, { x: bodies[i].x, y: bodies[i].y }));
      resized.disconnect();
      themed.disconnect();
      scheme.removeEventListener("change", kick);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", hovering);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("dblclick", doubleClick);
      el.removeEventListener("wheel", wheel);
    },
  };
}
