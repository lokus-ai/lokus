/** @part-of ui.graph */
import { useEffect, useMemo, useRef, useState } from "react";

import { type GraphData, type Note, runCore } from "../../bridge/core";
import { Icon } from "../../shell/Icon";
import { type Controller, type Model, mountGraph } from "./canvas";
import { DEFAULT_FORCES, type Forces } from "./simulation";

interface Props {
  active: string | null;
  version: number;
  onOpen(path: string): void;
}

/** How the graph is set up on this device. */
interface Settings {
  /** Show only notes within `depth` links of the open note. */
  local: boolean;
  depth: number;
  /** Show notes that link to nothing and are linked from nothing. */
  orphans: boolean;
  forces: Forces;
}

const KEY = "lokus.graph";
const DEFAULTS: Settings = { local: false, depth: 2, orphans: true, forces: DEFAULT_FORCES };
const PREVIEW_WIDTH = 320;

function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>;
    return { ...DEFAULTS, ...saved, forces: { ...DEFAULT_FORCES, ...saved.forces } };
  } catch {
    return DEFAULTS;
  }
}

/** The part of the whole graph the settings ask for, with links renumbered to match. */
function narrow(data: GraphData, settings: Settings, root: string | null): Model {
  const keep = new Set<number>();
  const start = root ? data.nodes.findIndex((n) => n.path === root) : -1;
  if (start >= 0) {
    const near: number[][] = data.nodes.map(() => []);
    for (const [s, t] of data.edges) {
      near[s].push(t);
      near[t].push(s);
    }
    let edge = [start];
    keep.add(start);
    for (let step = 0; step < settings.depth; step++) {
      edge = edge.flatMap((i) => near[i]).filter((i) => !keep.has(i) && keep.add(i));
    }
  } else {
    data.nodes.forEach((n, i) => (settings.orphans || n.degree > 0) && keep.add(i));
  }
  const index = new Map([...keep].map((old, i) => [old, i]));
  return {
    nodes: [...keep].map((i) => data.nodes[i]),
    edges: data.edges.filter(([s, t]) => index.has(s) && index.has(t)).map(([s, t]) => [index.get(s)!, index.get(t)!]),
  };
}

/** The start of a note as plain reading text: no properties block, no repeat of its own title. */
function excerpt(text: string, title: string): string {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimStart();
  const lines = body.split(/\r?\n/);
  if (lines[0]?.replace(/^#\s+/, "").trim() === title) lines.shift();
  const out = lines.join("\n").trim();
  return out.length > 900 ? `${out.slice(0, 900).trimEnd()}…` : out;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <label className="graph-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange(on: boolean): void }) {
  return (
    <div className="graph-toggle">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={() => onChange(!on)} />
    </div>
  );
}

/**
 * Every note as a dot and every link as a line, laid out by a live force simulation.
 * Drag a dot and its neighbours follow; click one to read it at the side; double-click or
 * Cmd-click to open it.
 */
export default function GraphView({ active, version, onOpen }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const graph = useRef<Controller | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [settings, setSettings] = useState(readSettings);
  const [panel, setPanel] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void runCore<GraphData>("graph.data").then((d) => current && setData(d));
    return () => {
      current = false;
    };
  }, [version]);

  const change = (patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  const root = settings.local ? active : null;
  const model = useMemo(() => (data ? narrow(data, settings, root) : null), [data, settings.local, settings.depth, settings.orphans, root]);
  const indexOf = useMemo(() => new Map(model?.nodes.map((n, i) => [n.path, i])), [model]);

  // The latest values, for the canvas's callbacks, which outlive a render.
  const latest = useRef({ model, onOpen, forces: settings.forces, active });
  latest.current = { model, onOpen, forces: settings.forces, active };

  useEffect(() => {
    if (!canvas.current || !model) return;
    const controller = mountGraph(canvas.current, model, latest.current.forces, latest.current.active, {
      onSelect: (i) => setSelected(i === null ? null : (latest.current.model?.nodes[i].path ?? null)),
      onOpen: (i) => {
        const node = latest.current.model?.nodes[i];
        if (node) latest.current.onOpen(node.path);
      },
    });
    graph.current = controller;
    return () => {
      controller.destroy();
      graph.current = null;
    };
  }, [model]);

  useEffect(() => graph.current?.setForces(settings.forces), [settings.forces]);
  useEffect(() => graph.current?.setActive(active), [active, model]);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !model) return null;
    return model.nodes.flatMap((n, i) => (n.title.toLowerCase().includes(q) || n.path.toLowerCase().includes(q) ? [i] : []));
  }, [query, model]);
  useEffect(() => graph.current?.setMatches(found ? new Set(found) : null), [found]);

  const index = selected ? indexOf.get(selected) : undefined;
  useEffect(() => {
    graph.current?.setInset(index === undefined ? 0 : PREVIEW_WIDTH);
    graph.current?.select(index ?? null);
  }, [index, model]);
  const show = (path: string) => {
    const i = indexOf.get(path);
    if (i === undefined) return;
    setSelected(path);
    graph.current?.setInset(PREVIEW_WIDTH);
    graph.current?.select(i, true);
  };

  useEffect(() => {
    setText(null);
    if (!selected) return;
    let current = true;
    void runCore<Note>("note.read", { path: selected })
      .then((note) => current && setText(note.text))
      .catch(() => current && setText(""));
    return () => {
      current = false;
    };
  }, [selected, version]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (panel) setPanel(false);
      else if (selected) setSelected(null);
      else if (query) setQuery("");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel, selected, query]);

  const node = index === undefined ? null : model!.nodes[index];
  const linksTo = node ? model!.edges.filter(([s]) => s === index).map(([, t]) => model!.nodes[t]) : [];
  const linkedFrom = node ? model!.edges.filter(([, t]) => t === index).map(([s]) => model!.nodes[s]) : [];
  const body = node && text !== null ? excerpt(text, node.title) : null;
  const folder = node?.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : null;

  return (
    <div className="graph">
      <canvas ref={canvas} />
      {model && model.nodes.length === 0 && (
        <div className="graph-empty">
          <p>{settings.local ? "The open note has no links yet" : "No notes to show"}</p>
          <span>{settings.local ? "Link it to another note with [[ and it will appear here." : "Notes appear here as dots, joined by their links."}</span>
        </div>
      )}

      <div className="graph-bar">
        <label className="graph-search">
          <Icon name="search" size={14} />
          <input
            placeholder="Find a note in the graph"
            value={query}
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && found?.length) show(model!.nodes[found[0]].path);
            }}
          />
          {found && <span className="graph-found">{found.length}</span>}
        </label>
        <button className={`graph-button${panel ? " on" : ""}`} title="Graph settings" onClick={() => setPanel((p) => !p)}>
          <Icon name="sliders" />
        </button>
      </div>

      {panel && (
        <div className="graph-settings">
          <Toggle
            label="Only around the open note"
            hint={active ? undefined : "Open a note to use this"}
            on={settings.local}
            onChange={(local) => change({ local })}
          />
          {settings.local && (
            <div className="graph-toggle">
              <span>Links away</span>
              <div className="segmented">
                {[1, 2, 3].map((d) => (
                  <button key={d} className={settings.depth === d ? "active" : ""} onClick={() => change({ depth: d })}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!settings.local && <Toggle label="Notes with no links" on={settings.orphans} onChange={(orphans) => change({ orphans })} />}
          <hr />
          <Slider label="Push apart" min={40} max={500} step={10} value={settings.forces.repel} onChange={(repel) => change({ forces: { ...settings.forces, repel } })} />
          <Slider label="Link length" min={20} max={220} step={5} value={settings.forces.linkDistance} onChange={(linkDistance) => change({ forces: { ...settings.forces, linkDistance } })} />
          <Slider label="Link pull" min={0.05} max={1} step={0.05} value={settings.forces.linkStrength} onChange={(linkStrength) => change({ forces: { ...settings.forces, linkStrength } })} />
          <Slider label="Pull to the middle" min={0} max={0.3} step={0.01} value={settings.forces.center} onChange={(center) => change({ forces: { ...settings.forces, center } })} />
          <button className="link" onClick={() => change({ forces: DEFAULT_FORCES })}>
            Reset the forces
          </button>
        </div>
      )}

      <div className="graph-zoom" style={{ right: node ? PREVIEW_WIDTH + 28 : 16 }}>
        {active && indexOf.has(active) && (
          <button title="Go to the open note" onClick={() => show(active)}>
            <Icon name="locate" />
          </button>
        )}
        <button title="Zoom in" onClick={() => graph.current?.zoomBy(1.3)}>
          <Icon name="plus" />
        </button>
        <button title="Zoom out" onClick={() => graph.current?.zoomBy(1 / 1.3)}>
          <Icon name="minus" />
        </button>
        <button title="Fit everything" onClick={() => graph.current?.fit()}>
          <Icon name="fit" />
        </button>
      </div>

      {node && (
        <aside className="graph-preview" style={{ width: PREVIEW_WIDTH }}>
          <header>
            <div>
              <h2>{node.title}</h2>
              {folder && <small>{folder}</small>}
            </div>
            <button className="panel-close" title="Close (Esc)" onClick={() => setSelected(null)}>
              <Icon name="close" size={14} />
            </button>
          </header>
          <div className="graph-preview-scroll">
            {body === null ? null : body ? <p className="graph-excerpt">{body}</p> : <p className="graph-excerpt muted">This note is empty.</p>}
            {[
              { title: "Links to", list: linksTo },
              { title: "Linked from", list: linkedFrom },
            ].map(
              ({ title, list }) =>
                list.length > 0 && (
                  <section key={title}>
                    <h3>
                      {title} <span>{list.length}</span>
                    </h3>
                    {list.map((n, i) => (
                      <button key={`${n.path}${i}`} className="graph-link" onClick={() => show(n.path)}>
                        <Icon name="note" size={14} />
                        <span className="tree-name">{n.title}</span>
                      </button>
                    ))}
                  </section>
                ),
            )}
          </div>
          <footer>
            <button className="primary" onClick={() => onOpen(node.path)}>
              Open note
            </button>
            <span>or double-click its dot</span>
          </footer>
        </aside>
      )}

      {model && model.nodes.length > 0 && (
        <p className="graph-count">
          {model.nodes.length} notes, {model.edges.length} links
        </p>
      )}
    </div>
  );
}
