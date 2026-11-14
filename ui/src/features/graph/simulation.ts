/** @part-of ui.graph */

/** One dot in the simulation. `fx`/`fy` hold it in place while it is being dragged. */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  mass: number;
  /** Drawn radius; dots are never allowed to overlap. */
  r: number;
}

/** The four dials a person can turn in the graph's settings. */
export interface Forces {
  /** How hard every dot pushes every other dot away. */
  repel: number;
  /** The length a link tries to keep. */
  linkDistance: number;
  /** How stiff a link is, 0 to 1. */
  linkStrength: number;
  /** How hard everything is pulled back to the middle. */
  center: number;
}

export const DEFAULT_FORCES: Forces = { repel: 240, linkDistance: 85, linkStrength: 0.4, center: 0.05 };

/** A square of space in the quadtree: either one dot, or four smaller squares and their combined weight. */
interface Cell {
  x0: number;
  y0: number;
  size: number;
  mass: number;
  sx: number;
  sy: number;
  point: number;
  count: number;
  kids: (Cell | null)[] | null;
}

const cell = (x0: number, y0: number, size: number): Cell => ({ x0, y0, size, mass: 0, sx: 0, sy: 0, point: -1, count: 0, kids: null });

/** A far-away square is treated as one heavy dot once it looks smaller than this (Barnes-Hut). */
const THETA2 = 0.81;
const MIN_DISTANCE2 = 36;
const MAX_DEPTH = 22;
const COOLING = 0.0228;
const FRICTION = 0.6;
const STILL = 0.002;

/**
 * A force-directed layout: dots repel each other, links act as springs, and a gentle pull keeps
 * the whole thing near the middle. `alpha` is the heat: forces scale with it and it cools to zero,
 * so the picture settles; dragging a dot raises `alphaTarget` so its neighbours keep reacting.
 */
export class Simulation {
  alpha = 1;
  alphaTarget = 0;
  private readonly linkCount: number[];
  private readonly stack: Cell[] = [];

  constructor(
    readonly bodies: Body[],
    readonly links: [number, number][],
    public forces: Forces,
  ) {
    this.linkCount = bodies.map(() => 0);
    for (const [s, t] of links) {
      this.linkCount[s]++;
      this.linkCount[t]++;
    }
  }

  get moving(): boolean {
    return this.alpha > STILL || this.alphaTarget > 0;
  }

  reheat(alpha = 0.6): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /** Advance one step. Returns whether anything is still moving. */
  tick(): boolean {
    if (!this.moving) return false;
    this.alpha += (this.alphaTarget - this.alpha) * COOLING;
    const alpha = this.alpha;
    this.pullLinks(alpha);
    this.pushApart(alpha);
    this.separate();
    const pull = this.forces.center * alpha;
    for (const b of this.bodies) {
      b.vx -= b.x * pull;
      b.vy -= b.y * pull;
      if (b.fx !== null && b.fy !== null) {
        b.x = b.fx;
        b.y = b.fy;
        b.vx = 0;
        b.vy = 0;
      } else {
        b.vx *= FRICTION;
        b.vy *= FRICTION;
        b.x += b.vx;
        b.y += b.vy;
      }
    }
    return true;
  }

  private pullLinks(alpha: number): void {
    const { linkDistance, linkStrength } = this.forces;
    for (const [s, t] of this.links) {
      const a = this.bodies[s];
      const b = this.bodies[t];
      const dx = b.x + b.vx - a.x - a.vx || (Math.random() - 0.5) * 1e-3;
      const dy = b.y + b.vy - a.y - a.vy || (Math.random() - 0.5) * 1e-3;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // A link into a hub is weaker, so a hub's many links do not crush it into a ball.
      const stiffness = (2 * linkStrength) / Math.min(this.linkCount[s], this.linkCount[t]);
      const k = ((dist - linkDistance) / dist) * alpha * Math.min(1, stiffness);
      // The better-connected end moves less.
      const share = this.linkCount[s] / (this.linkCount[s] + this.linkCount[t]);
      b.vx -= dx * k * share;
      b.vy -= dy * k * share;
      a.vx += dx * k * (1 - share);
      a.vy += dy * k * (1 - share);
    }
  }

  private pushApart(alpha: number): void {
    const bodies = this.bodies;
    if (bodies.length < 2) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of bodies) {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x > maxX) maxX = b.x;
      if (b.y > maxY) maxY = b.y;
    }
    const root = cell(minX, minY, Math.max(maxX - minX, maxY - minY, 1) * 1.0001);
    for (let i = 0; i < bodies.length; i++) this.insert(root, i, 0);

    const strength = this.forces.repel * alpha;
    // Beyond this range dots ignore each other, so unlinked notes rest near the rest instead of flying off.
    const reach = this.forces.linkDistance * 5;
    const reach2 = reach * reach;
    const stack = this.stack;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      stack.length = 0;
      stack.push(root);
      while (stack.length) {
        const c = stack.pop()!;
        let mass = c.mass;
        let cx = c.sx;
        let cy = c.sy;
        if (c.kids === null) {
          if (c.point === i && c.count === 1) continue;
          if (c.point === i) {
            mass -= b.mass;
            cx -= b.x * b.mass;
            cy -= b.y * b.mass;
          }
        }
        let dx = cx / mass - b.x;
        let dy = cy / mass - b.y;
        let d2 = dx * dx + dy * dy;
        if (c.kids !== null && c.size * c.size >= THETA2 * d2) {
          for (const kid of c.kids) if (kid) stack.push(kid);
          continue;
        }
        if (d2 > reach2) continue;
        if (d2 < 1e-6) {
          dx = (Math.random() - 0.5) * 2;
          dy = (Math.random() - 0.5) * 2;
          d2 = dx * dx + dy * dy;
        }
        if (d2 < MIN_DISTANCE2) d2 = Math.sqrt(MIN_DISTANCE2 * d2);
        const push = (strength * mass) / d2;
        b.vx -= dx * push;
        b.vy -= dy * push;
      }
    }
  }

  /** Whatever the dials say, two dots never sit on top of each other: overlapping pairs are nudged apart. */
  private separate(): void {
    const bodies = this.bodies;
    let reach = 0;
    for (const b of bodies) reach = Math.max(reach, b.r);
    const gap = 6;
    const size = reach * 2 + gap;
    const grid = new Map<number, number[]>();
    const key = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;
    for (let i = 0; i < bodies.length; i++) {
      const k = key(Math.floor(bodies[i].x / size), Math.floor(bodies[i].y / size));
      const bucket = grid.get(k);
      if (bucket) bucket.push(i);
      else grid.set(k, [i]);
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      const cx = Math.floor(a.x / size);
      const cy = Math.floor(a.y / size);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const j of grid.get(key(gx, gy)) ?? []) {
            if (j <= i) continue;
            const b = bodies[j];
            const dx = b.x - a.x || (Math.random() - 0.5) * 0.1;
            const dy = b.y - a.y || (Math.random() - 0.5) * 0.1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const want = a.r + b.r + gap;
            if (dist >= want) continue;
            const push = ((want - dist) / dist) * 0.35;
            a.vx -= dx * push;
            a.vy -= dy * push;
            b.vx += dx * push;
            b.vy += dy * push;
          }
        }
      }
    }
  }

  private insert(c: Cell, i: number, depth: number): void {
    const b = this.bodies[i];
    c.mass += b.mass;
    c.sx += b.x * b.mass;
    c.sy += b.y * b.mass;
    if (c.kids === null) {
      if (c.count === 0) {
        c.point = i;
        c.count = 1;
        return;
      }
      // Dots sitting on the same spot stay together in one square instead of splitting forever.
      if (depth >= MAX_DEPTH) {
        c.count++;
        return;
      }
      const first = c.point;
      c.kids = [null, null, null, null];
      c.point = -1;
      this.insert(this.child(c, this.bodies[first]), first, depth + 1);
    }
    this.insert(this.child(c, b), i, depth + 1);
  }

  private child(c: Cell, b: Body): Cell {
    const half = c.size / 2;
    const right = b.x >= c.x0 + half ? 1 : 0;
    const lower = b.y >= c.y0 + half ? 1 : 0;
    const kids = c.kids!;
    return (kids[lower * 2 + right] ??= cell(c.x0 + right * half, c.y0 + lower * half, half));
  }
}
