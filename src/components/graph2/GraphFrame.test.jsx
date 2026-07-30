import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React from 'react';

// Spy the real d3-force so we can prove a frame never builds a simulation.
vi.mock('d3-force', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, forceSimulation: vi.fn(actual.forceSimulation) };
});

// graphConfig persists to disk through Tauri; the store defaults are all we need.
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => '{}'),
  writeTextFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn(async (...p) => p.join('/')) }));

import { forceSimulation } from 'd3-force';
import { getGraphEngine, resetGraphEngine } from '../../core/graph2/graphEngine.js';
import { useGraphConfig, getDefaultConfig } from '../../core/graph2/graphConfig.js';
import GraphFrame, {
  pickNode, pickRadius, screenRadius, HIT_PAD, readPalette, nodeColor,
} from './GraphFrame.jsx';

/** Minimal stand-in for linkIndex — exactly the surface graphEngine.attach uses. */
function fakeIndex(nodes, links) {
  return {
    nodes: () => nodes,
    links: () => links,
    subscribe: () => () => {},
  };
}

/** Recording 2D context — jsdom has none without the `canvas` package. */
function makeCtx() {
  const calls = [];
  const state = {
    calls, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
  };
  const gradient = { addColorStop() {} };
  return new Proxy(state, {
    get(t, k) {
      if (typeof k === 'symbol' || k in t) return t[k];
      return (...args) => {
        calls.push([k, ...args]);
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return gradient;
        if (k === 'measureText') return { width: String(args[0] || '').length * 6 };
        return undefined;
      };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const SIZE = { width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0 };

let ctxStub;
let spies = [];

beforeEach(() => {
  ctxStub = makeCtx();
  // Restore only what we install — test-setup's global mocks (ResizeObserver,
  // matchMedia, …) must survive between tests in this file.
  spies = [
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctxStub),
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ ...SIZE })),
  ];
  useGraphConfig.setState({ config: getDefaultConfig(), workspacePath: null, loaded: false });
  resetGraphEngine();
});

afterEach(() => {
  resetGraphEngine();
  for (const s of spies) s.mockRestore();
  spies = [];
});

const flush = async (ms = 60) => {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};

function seedEngine() {
  const engine = getGraphEngine();
  engine.setConfig(getDefaultConfig());
  engine.attach(fakeIndex(
    [
      { id: '/w/a.md', title: 'Alpha' },
      { id: '/w/b.md', title: 'Beta' },
      { id: 'Ghost', title: 'Ghost', phantom: true, type: 'phantom' },
    ],
    [
      { source: '/w/a.md', target: '/w/b.md' },
      { source: '/w/a.md', target: 'Ghost' },
    ],
  ));
  return engine;
}

describe('GraphFrame', () => {
  it('mounts and draws against an engine that has nodes', async () => {
    const engine = seedEngine();
    expect(engine.nodes()).toHaveLength(3);

    let view;
    await act(async () => {
      view = render(<GraphFrame className="h-full" variant="full" focusPath="/w/a.md" onOpenFile={() => {}} />);
    });
    await flush();

    expect(view.container.querySelector('canvas')).toBeTruthy();
    const ops = ctxStub.calls.map((c) => c[0]);
    expect(ops).toContain('clearRect');
    expect(ops).toContain('arc');      // nodes
    expect(ops).toContain('stroke');   // edges
    expect(ops).toContain('fillText'); // labels
  });

  it('never creates a simulation — the engine owns layout', async () => {
    seedEngine();
    forceSimulation.mockClear();

    await act(async () => {
      render(<GraphFrame variant="full" focusPath="/w/a.md" onOpenFile={() => {}} />);
    });
    await flush();

    expect(forceSimulation).not.toHaveBeenCalled();
  });

  it('never drives engine focus — the host owns that', async () => {
    const engine = seedEngine();
    const setFocus = vi.spyOn(engine, 'setFocus');

    await act(async () => {
      render(<GraphFrame variant="full" focusPath="/w/b.md" onOpenFile={() => {}} />);
    });
    await flush();

    expect(setFocus).not.toHaveBeenCalled();
  });

  it('renders the toolbar only for variant="full"', async () => {
    seedEngine();
    let full; let preview;
    await act(async () => { full = render(<GraphFrame variant="full" />); });
    expect(full.queryByTestId('graph-frame-toolbar')).toBeTruthy();
    full.unmount();

    await act(async () => { preview = render(<GraphFrame variant="preview" />); });
    expect(preview.queryByTestId('graph-frame-toolbar')).toBeNull();
  });

  it('paints screen-space backgrounds without touching the camera', async () => {
    seedEngine();
    useGraphConfig.setState({
      config: { ...getDefaultConfig(), backgroundType: 'dots', backgroundOpacity: 0.4, backgroundDotSpacing: 40 },
    });

    await act(async () => { render(<GraphFrame variant="full" />); });
    await flush();

    const ops = ctxStub.calls.map((c) => c[0]);
    expect(ops).toContain('fillRect');       // the wash
    const dots = ctxStub.calls.filter((c) => c[0] === 'arc');
    expect(dots.length).toBeGreaterThan(50); // 800x600 at 40px spacing
  });

  it('hovers the node under the pointer, in screen space', async () => {
    const engine = seedEngine();
    let view;
    await act(async () => {
      view = render(<GraphFrame variant="full" onOpenFile={() => {}} />);
    });
    await flush();

    const canvas = view.container.querySelector('canvas');
    // Reset view pins the camera at { x: 400, y: 300, k: 1 } — screen = world + centre.
    await act(async () => { view.getByLabelText('Reset view').click(); });

    const a = engine.node('/w/a.md');
    await act(async () => {
      fireEvent.pointerMove(canvas, { clientX: a.x + 400, clientY: a.y + 300 });
    });
    expect(canvas.style.cursor).toBe('pointer');

    await act(async () => {
      fireEvent.pointerMove(canvas, { clientX: a.x + 400 + 400, clientY: a.y + 300 + 250 });
    });
    expect(canvas.style.cursor).toBe('grab');
  });

  it('does not draw when the frame has no size', async () => {
    seedEngine();
    HTMLElement.prototype.getBoundingClientRect.mockImplementation(() => ({
      ...SIZE, width: 0, height: 0, right: 0, bottom: 0,
    }));

    await act(async () => { render(<GraphFrame variant="preview" />); });
    await flush();

    expect(ctxStub.calls).toHaveLength(0);
  });
});

describe('GraphFrame theming', () => {
  // The real values from src/styles/globals.css — plain hex, not rgb triplets.
  const THEME = {
    '--graph-node-document': '#6ec98f',
    '--graph-node-placeholder': '#7e7e86',
    '--graph-node-tag': '#c4a7e7',
    '--graph-node-folder': '#f6c177',
    '--graph-link': '#35353a',
    '--graph-link-hover': '#a78bfa',
    '--graph-bg-primary': '#212124',
    '--graph-bg-secondary': '#a78bfa',
    '--accent': '167 139 250',        // channels, wrapped in rgb() by the frame
    '--muted': '126 126 134',
    '--border': '53 53 58',
    '--text-secondary': '139 139 147',
  };

  const withTheme = (vars) => {
    window.getComputedStyle = () => ({ getPropertyValue: (n) => vars[n] || '' });
    readPalette();
  };

  it('resolves every engine cssVar to its themed hex', () => {
    withTheme(THEME);
    expect(nodeColor({ type: 'file', cssVar: '--graph-node-document' })).toBe('#6ec98f');
    expect(nodeColor({ type: 'phantom', cssVar: '--graph-node-placeholder' })).toBe('#7e7e86');
    expect(nodeColor({ type: 'tag', cssVar: '--graph-node-tag' })).toBe('#c4a7e7');
    expect(nodeColor({ type: 'attachment', cssVar: '--graph-node-folder' })).toBe('#f6c177');
  });

  it('lets an explicit scheme colour win over the type theme', () => {
    withTheme(THEME);
    expect(nodeColor({ type: 'file', cssVar: '--graph-node-document', color: '#ff0000' })).toBe('#ff0000');
  });

  it('never renders an invisible node when the theme is missing', () => {
    withTheme({});
    for (const type of ['file', 'phantom', 'tag', 'attachment']) {
      const c = nodeColor({ type, cssVar: `--graph-node-${type}` });   // unknown var
      expect(c).toBeTruthy();
      expect(c).not.toBe('rgb()');
      expect(c).toMatch(/^#|^rgb\(.+\)$/);
    }
  });
});

describe('GraphFrame hit testing', () => {
  const node = { id: 'a', title: 'A', x: 0, y: 0, radius: 6 };

  it('keeps the click target a constant pad around the drawn rim at every zoom', () => {
    for (const k of [0.2, 0.5, 1, 2, 3, 4]) {
      expect(pickRadius(node, k) - screenRadius(node, k)).toBeCloseTo(HIT_PAD, 6);
    }
  });

  it('hits inside the drawn rim and misses outside it, at every zoom', () => {
    for (const k of [0.2, 0.5, 1, 2, 3, 4]) {
      const cam = { x: 400, y: 300, k };
      const r = screenRadius(node, k);
      // node centre sits at (400, 300) in screen space
      expect(pickNode([node], 400, 300, cam)).toBe(node);
      expect(pickNode([node], 400 + r, 300, cam)).toBe(node);
      expect(pickNode([node], 400 + r + HIT_PAD - 0.5, 300, cam)).toBe(node);
      expect(pickNode([node], 400 + r + HIT_PAD + 1, 300, cam)).toBeNull();
    }
  });

  it('stays clickable when zoomed out and does not balloon when zoomed in', () => {
    // The old renderer hit-tested a fixed 14-unit WORLD radius: 4.2px at k=0.3
    // (unclickable) and 42px at k=3 (grabbing its neighbours).
    expect(pickRadius(node, 0.05)).toBeGreaterThanOrEqual(HIT_PAD);
    expect(pickRadius(node, 3)).toBeLessThan(14 * 3);
  });

  it('picks the nearest node when discs overlap', () => {
    const a = { id: 'a', x: 0, y: 0, radius: 8 };
    const b = { id: 'b', x: 10, y: 0, radius: 8 };
    const cam = { x: 0, y: 0, k: 1 };
    expect(pickNode([a, b], 9, 0, cam)).toBe(b);
    expect(pickNode([a, b], 1, 0, cam)).toBe(a);
    expect(pickNode([a, b], 400, 400, cam)).toBeNull();
  });
});
