/** @part-of ui.graph */
import { useEffect, useRef, useState } from "react";

import { type GraphData, runCore } from "../../bridge/core";

interface Props {
  active: string | null;
  version: number;
  onOpen(path: string): void;
}

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** How many other dots each dot is pushed away from per tick; keeps big vaults smooth. */
const SAMPLES = 48;

function layout(data: GraphData): Dot[] {
  const spread = 40 * Math.sqrt(data.nodes.length + 1);
  return data.nodes.map((node, i) => {
    const angle = i * 2.399963; // golden angle: an even spiral to start from
    const radius = spread * Math.sqrt((i + 0.5) / data.nodes.length);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0, r: 3 + Math.sqrt(node.degree) * 1.3 };
  });
}

function step(dots: Dot[], edges: [number, number][], heat: number): void {
  const n = dots.length;
  for (let i = 0; i < n; i++) {
    const a = dots[i];
    const count = Math.min(SAMPLES, n - 1);
    const scale = (n - 1) / Math.max(1, count);
    for (let k = 0; k < count; k++) {
      const j = count === n - 1 ? (k >= i ? k + 1 : k) : Math.floor(Math.random() * n);
      if (j === i) continue;
      const b = dots[j];
      const dx = a.x - b.x || 0.01;
      const dy = a.y - b.y || 0.01;
      const d2 = dx * dx + dy * dy + 25;
      const push = (900 * scale * heat) / d2;
      a.vx += dx * push * 0.02;
      a.vy += dy * push * 0.02;
    }
    a.vx -= a.x * 0.0025 * heat;
    a.vy -= a.y * 0.0025 * heat;
  }
  for (const [s, t] of edges) {
    const a = dots[s];
    const b = dots[t];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const pull = ((dist - 70) / dist) * 0.02 * heat;
    a.vx += dx * pull;
    a.vy += dy * pull;
    b.vx -= dx * pull;
    b.vy -= dy * pull;
  }
  for (const d of dots) {
    d.vx *= 0.82;
    d.vy *= 0.82;
    d.x += Math.max(-30, Math.min(30, d.vx));
    d.y += Math.max(-30, Math.min(30, d.vy));
  }
}

/** Every note as a dot, every link as a line. Drag to pan, scroll to zoom, click to open. */
export default function GraphView({ active, version, onOpen }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<GraphData | null>(null);

  useEffect(() => {
    let current = true;
    void runCore<GraphData>("graph.data").then((d) => current && setData(d));
    return () => {
      current = false;
    };
  }, [version]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !data) return;
    const ctx = el.getContext("2d")!;
    const dots = layout(data);
    const near: number[][] = data.nodes.map(() => []);
    for (const [s, t] of data.edges) {
      near[s].push(t);
      near[t].push(s);
    }
    const view = { x: 0, y: 0, k: Math.min(1, 14 / Math.sqrt(data.nodes.length + 1)) };
    let heat = 1;
    let hover = -1;
    let frame = 0;
    let drag: { x: number; y: number; moved: boolean } | null = null;

    const css = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();
    const toWorld = (px: number, py: number) => {
      const rect = el.getBoundingClientRect();
      return { x: (px - rect.left - rect.width / 2 - view.x) / view.k, y: (py - rect.top - rect.height / 2 - view.y) / view.k };
    };
    const at = (px: number, py: number) => {
      const p = toWorld(px, py);
      let best = -1;
      let bestD = Infinity;
      dots.forEach((d, i) => {
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        if (dist < d.r + 6 / view.k && dist < bestD) {
          best = i;
          bestD = dist;
        }
      });
      return best;
    };

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = el.getBoundingClientRect();
      if (el.width !== Math.round(width * ratio) || el.height !== Math.round(height * ratio)) {
        el.width = Math.round(width * ratio);
        el.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2 + view.x, height / 2 + view.y);
      ctx.scale(view.k, view.k);
      const lit = hover >= 0 ? new Set([hover, ...near[hover]]) : null;

      ctx.lineWidth = 1 / view.k;
      ctx.strokeStyle = css("--fg-3");
      ctx.globalAlpha = lit ? 0.08 : 0.28;
      ctx.beginPath();
      for (const [s, t] of data.edges) {
        ctx.moveTo(dots[s].x, dots[s].y);
        ctx.lineTo(dots[t].x, dots[t].y);
      }
      ctx.stroke();
      if (lit) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = css("--accent");
        ctx.beginPath();
        for (const t of near[hover]) {
          ctx.moveTo(dots[hover].x, dots[hover].y);
          ctx.lineTo(dots[t].x, dots[t].y);
        }
        ctx.stroke();
      }

      const accent = css("--accent");
      const plain = css("--fg-2");
      const text = css("--fg");
      dots.forEach((d, i) => {
        const isActive = data.nodes[i].path === active;
        ctx.globalAlpha = lit && !lit.has(i) ? 0.2 : 1;
        ctx.fillStyle = isActive || i === hover ? accent : plain;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.font = `${12 / view.k}px ${css("--font-ui")}`;
      ctx.textAlign = "center";
      ctx.fillStyle = text;
      dots.forEach((d, i) => {
        const node = data.nodes[i];
        const show = lit ? lit.has(i) : view.k > 0.9 || node.path === active || (node.degree >= 4 && view.k > 0.45);
        if (!show) return;
        ctx.globalAlpha = lit && i !== hover ? 0.75 : 1;
        ctx.fillText(node.title, d.x, d.y + d.r + 14 / view.k);
      });
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (heat > 0.02) {
        step(dots, data.edges, heat);
        heat *= 0.985;
      }
      draw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        view.x += dx;
        view.y += dy;
        drag.x = e.clientX;
        drag.y = e.clientY;
        return;
      }
      hover = at(e.clientX, e.clientY);
      el.style.cursor = hover >= 0 ? "pointer" : "grab";
    };
    const up = (e: PointerEvent) => {
      const clicked = drag && !drag.moved ? at(e.clientX, e.clientY) : -1;
      drag = null;
      if (clicked >= 0) onOpen(data.nodes[clicked].path);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const before = toWorld(e.clientX, e.clientY);
      view.k = Math.max(0.05, Math.min(4, view.k * Math.exp(-e.deltaY * 0.0015)));
      const after = toWorld(e.clientX, e.clientY);
      view.x += (after.x - before.x) * view.k;
      view.y += (after.y - before.y) * view.k;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [data, active, onOpen]);

  return (
    <div className="graph">
      <canvas ref={canvas} />
      {data && (
        <p className="graph-count">
          {data.nodes.length} notes · {data.edges.length} links
        </p>
      )}
    </div>
  );
}
