/**
 * MathGraphBoard.jsx
 *
 * React wrapper around JSXGraph.  Manages the full lifecycle of a JSXGraph
 * board: creation, expression rendering, viewport synchronisation, and
 * teardown.  The component is intentionally a "dumb" renderer — it accepts
 * pure data props and drives the board imperatively via JSXGraph's API.
 *
 * Notable implementation details
 * ──────────────────────────────
 * - useId()        → stable, Strict-Mode-safe board ID (colons replaced
 *                    because JSXGraph uses the ID as a CSS selector internally)
 * - Strict Mode    → freeBoard() before every initBoard() to avoid double-init
 * - Expressions    → kept in a Map<id, element> ref so diffs are O(changed)
 *                    rather than O(total) — no full teardown on every keystroke
 * - Viewport sync  → parent changes are applied via setBoundingBox(); board
 *                    pan/zoom events fire back through onViewportChange
 * - ResizeObserver → keeps the board pixel-perfect when the pane is resized
 */

import React, {
  useState,
  useEffect,
  useRef,
  useId,
  useCallback,
} from 'react';
import JXG from 'jsxgraph';
import 'jsxgraph/distrib/jsxgraph.css';
import expressionEngine from '../../core/mathgraph/ExpressionEngine.js';
import './MathGraphBoard.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Line-style → JSXGraph dash value. */
const DASH_MAP = { solid: 0, dotted: 1, dashed: 2 };

/**
 * Number of samples JSXGraph uses when plotting function graphs.
 * Higher = smoother curves, higher CPU cost.
 */
const PLOT_POINTS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat `{ varName: value }` scope from the variables array so that
 * ExpressionEngine can substitute slider/parameter values when creating plot
 * functions.
 *
 * @param {Array<{name: string, value: number}>} variables
 * @returns {Record<string, number>}
 */
function buildScope(variables) {
  const scope = {};
  for (const v of variables) {
    scope[v.name] = v.value;
  }
  return scope;
}

/**
 * Read the app's CSS custom-property theme and return concrete color strings
 * that JSXGraph can use for board, axis, and grid styling.
 *
 * CSS vars are in "R G B" space-separated format (e.g. `--panel: 32 30 41`).
 *
 * @param {HTMLElement} el - Element to read computed style from
 * @returns {{ background: string, axis: string, grid: string }}
 */
function getThemeColors(el) {
  const style = getComputedStyle(el);
  const panel = style.getPropertyValue('--panel').trim();
  const text = style.getPropertyValue('--text').trim();
  const border = style.getPropertyValue('--border').trim();
  return {
    background: panel ? `rgb(${panel})` : '#ffffff',
    axis: text ? `rgb(${text} / 0.55)` : '#333333',
    grid: border ? `rgb(${border} / 0.5)` : '#e0e0e0',
  };
}

/**
 * Convert a JSXGraph bounding-box array `[xMin, yMax, xMax, yMin]` to our
 * viewport object `{ xMin, xMax, yMin, yMax }`.
 *
 * @param {number[]} bb
 * @returns {{ xMin: number, xMax: number, yMin: number, yMax: number }}
 */
function bbToViewport(bb) {
  return { xMin: bb[0], yMax: bb[1], xMax: bb[2], yMin: bb[3] };
}

/**
 * Create (or update) a single JSXGraph element for one expression object.
 * Returns the created element, or null if the expression cannot be plotted.
 *
 * @param {object} board         - Live JSXGraph board instance
 * @param {object} expr          - Expression object from the .graph schema
 * @param {Record<string, number>} scope - Current slider/variable values
 * @returns {object|null}        - JSXGraph element or null
 */
function createBoardElement(board, expr, scope) {
  if (!expr.visible) return null;

  const compiled = expressionEngine.compile(expr.latex);
  if (!compiled || compiled.error || !compiled.fn) return null;

  const plotFn = expressionEngine.createPlotFunction(compiled, scope);
  if (!plotFn) return null;

  const dash = DASH_MAP[expr.lineStyle] ?? 0;
  const strokeWidth = expr.lineWidth ?? 2;
  const color = expr.color ?? '#c0392b';

  const commonAttrs = {
    strokeColor: color,
    strokeWidth,
    dash,
    highlight: false,
    fixed: true,
    withLabel: false,
    name: '',
  };

  // Use the board's current bounding box (with padding) for function evaluation
  // instead of a hardcoded [-1000, 1000] which pollutes the viewport on save.
  const bb = board.getBoundingBox(); // [xMin, yMax, xMax, yMin]
  const xPad = (bb[2] - bb[0]) * 2;
  const yPad = (bb[1] - bb[3]) * 2;
  const domainXMin = bb[0] - xPad;
  const domainXMax = bb[2] + xPad;
  const domainYMin = bb[3] - yPad;
  const domainYMax = bb[1] + yPad;

  try {
    const type = compiled.type;

    if (type === 'explicit') {
      if (plotFn.xOfY) {
        // x = f(y) — JSXGraph has no native y-direction functiongraph, so we
        // express it as a parametric curve: t is the y-parameter, x = f(t).
        const xFn = (t) => {
          try { return plotFn(t); } catch { return NaN; }
        };
        const yFn = (t) => t;
        return board.create(
          'curve',
          [xFn, yFn, domainYMin, domainYMax],
          { ...commonAttrs, numberPoints: PLOT_POINTS }
        );
      }
      return board.create('functiongraph', [plotFn], {
        ...commonAttrs,
        numberPoints: PLOT_POINTS,
      });
    }

    if (type === 'implicit') {
      return board.create('implicitcurve', [plotFn], {
        ...commonAttrs,
        resolution: 200,
        numberPoints: PLOT_POINTS,
      });
    }

    if (type === 'parametric') {
      return board.create(
        'curve',
        [plotFn.x, plotFn.y, 0, 2 * Math.PI],
        {
          ...commonAttrs,
          numberPoints: PLOT_POINTS,
        }
      );
    }

    if (type === 'polar') {
      return board.create(
        'curve',
        [plotFn, [0, 0], 0, 2 * Math.PI],
        {
          ...commonAttrs,
          curveType: 'polar',
          numberPoints: PLOT_POINTS,
        }
      );
    }

    if (type === 'point') {
      return board.create('point', [plotFn.x, plotFn.y], {
        strokeColor: color,
        fillColor: color,
        size: 4,
        highlight: false,
        fixed: true,
        name: '',
        withLabel: false,
      });
    }

    if (type === 'constant') {
      // Constant definitions don't render as a curve; skip silently.
      return null;
    }

    if (type === 'surface3d') {
      // In 2D: render z=f(x,y) as y=f(x,0) — cross-section at y=0
      if (typeof plotFn === 'function') {
        const fn2d = (x) => {
          try { return plotFn(x, 0); } catch { return NaN; }
        };
        return board.create('functiongraph', [fn2d], {
          ...commonAttrs,
          numberPoints: PLOT_POINTS,
        });
      }
      return null;
    }

    return null;
  } catch (err) {
    console.warn('[MathGraphBoard] Failed to create board element:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MathGraphBoard
 *
 * Props
 * ─────
 * expressions      {object[]}  — expression objects from the .graph schema
 * variables        {object[]}  — variable/slider objects (name + value)
 * annotations      {object[]}  — annotation objects (labels, arrows)
 * viewport         {{ xMin, xMax, yMin, yMax }}
 * settings         {{ showGrid, showAxes, backgroundColor, gridColor, axisColor }}
 * onViewportChange {Function}  — called with { xMin, xMax, yMin, yMax } on pan/zoom
 * is3D             {boolean}   — whether to render in 3D mode
 */
export default function MathGraphBoard({
  expressions = [],
  variables = [],
  annotations = [],
  viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  settings = {
    showGrid: true,
    showAxes: true,
    backgroundColor: '#ffffff',
    gridColor: '#e0e0e0',
    axisColor: '#333333',
  },
  onViewportChange,
  is3D = false,
}) {
  // Stable ID safe for JSXGraph (no colons, which break CSS selectors)
  const rawId = useId();
  const boardId = rawId.replace(/:/g, '-');

  const containerRef = useRef(null);
  const boardRef = useRef(null);

  // Map from expression id → JSXGraph element.  Lives outside React state so
  // mutations never trigger re-renders.
  const elementsRef = useRef(new Map());

  // Track the last viewport emitted to avoid feedback loops when the board
  // fires a 'boundingbox' event in response to our own setBoundingBox call.
  const lastEmittedViewport = useRef(null);

  // ── Board initialisation ──────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    if (is3D) return; // 3D mode handled by a separate effect

    // React Strict Mode safety: always free a previous board on this ID
    // before creating a new one.
    try {
      JXG.JSXGraph.freeBoard(boardId);
    } catch {
      // board didn't exist — that's fine
    }

    const { xMin, xMax, yMin, yMax } = viewport;
    const theme = getThemeColors(containerRef.current);

    const axisTickStyle = {
      strokeColor: theme.axis,
      label: { strokeColor: theme.axis, cssClass: '', highlightCssClass: '' },
    };

    const board = JXG.JSXGraph.initBoard(boardId, {
      boundingbox: [xMin, yMax, xMax, yMin],
      showCopyright: false,
      showNavigation: false,
      pan: { enabled: true, needShift: false },
      zoom: { enabled: true, wheel: true, needShift: false, pinch: true, min: 0.01, max: 100 },
      grid: settings.showGrid
        ? { strokeColor: theme.grid, strokeOpacity: 0.6 }
        : false,
      keepaspectratio: false,
      axis: settings.showAxes,
      defaultAxes: {
        x: { ...axisTickStyle, ticks: { strokeColor: theme.axis, label: { strokeColor: theme.axis } } },
        y: { ...axisTickStyle, ticks: { strokeColor: theme.axis, label: { strokeColor: theme.axis } } },
      },
    });

    // Apply theme background
    board.containerObj.style.background = theme.background;

    // Viewport change listener — fires when the user pans or zooms.
    // Debounced to avoid flooding React with state updates on every pan frame,
    // which causes visible lag.  The board handles panning natively; React only
    // needs the final viewport for persistence.
    let vpTimer = null;
    board.on('boundingbox', () => {
      if (!onViewportChange) return;
      clearTimeout(vpTimer);
      vpTimer = setTimeout(() => {
        const bb = board.getBoundingBox();
        const vp = bbToViewport(bb);

        const last = lastEmittedViewport.current;
        if (
          last &&
          Math.abs(last.xMin - vp.xMin) < 1e-9 &&
          Math.abs(last.xMax - vp.xMax) < 1e-9 &&
          Math.abs(last.yMin - vp.yMin) < 1e-9 &&
          Math.abs(last.yMax - vp.yMax) < 1e-9
        ) {
          return;
        }

        onViewportChange(vp);
      }, 200);
    });

    boardRef.current = board;
    // Clear any stale element refs from a previous board instance
    elementsRef.current = new Map();

    return () => {
      try {
        JXG.JSXGraph.freeBoard(boardId);
      } catch {
        // already freed
      }
      boardRef.current = null;
      elementsRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally omit viewport/settings/expressions from deps:
    // board init only runs once; subsequent updates go through separate effects.
  }, [boardId, is3D]);

  // ── Settings sync (grid, axes, background) ────────────────────────────────

  useEffect(() => {
    const board = boardRef.current;
    if (!board || is3D || !containerRef.current) return;

    const theme = getThemeColors(containerRef.current);
    board.containerObj.style.background = theme.background;

    if (board.defaultAxes) {
      const tickLabelStyle = { strokeColor: theme.axis };
      const { x: xAxis, y: yAxis } = board.defaultAxes;
      if (xAxis) {
        xAxis.setAttribute({ visible: settings.showAxes, strokeColor: theme.axis });
        if (xAxis.defaultTicks) {
          xAxis.defaultTicks.setAttribute({ strokeColor: theme.axis, label: tickLabelStyle });
        }
      }
      if (yAxis) {
        yAxis.setAttribute({ visible: settings.showAxes, strokeColor: theme.axis });
        if (yAxis.defaultTicks) {
          yAxis.defaultTicks.setAttribute({ strokeColor: theme.axis, label: tickLabelStyle });
        }
      }
    }

    // Update grid visibility
    if (board.grids && board.grids.length > 0) {
      for (const grid of board.grids) {
        grid.setAttribute({ visible: settings.showGrid, strokeColor: theme.grid });
      }
    }

    board.update();
  }, [settings.showAxes, settings.showGrid, is3D]);

  // ── Viewport sync (parent → board) ───────────────────────────────────────

  useEffect(() => {
    const board = boardRef.current;
    if (!board || is3D) return;

    const { xMin, xMax, yMin, yMax } = viewport;
    const bb = [xMin, yMax, xMax, yMin];

    // Record what we're about to set so the 'boundingbox' handler skips it
    lastEmittedViewport.current = { xMin, xMax, yMin, yMax };
    board.setBoundingBox(bb, true);
  }, [viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax, is3D]);

  // ── Expression rendering ──────────────────────────────────────────────────

  useEffect(() => {
    const board = boardRef.current;
    if (!board || is3D) return;

    const scope = buildScope(variables);
    const existingIds = new Set(elementsRef.current.keys());
    const incomingIds = new Set(expressions.map((e) => e.id));

    board.suspendUpdate();

    try {
      // Remove elements that no longer exist or whose expression changed
      for (const [id, el] of elementsRef.current) {
        if (!incomingIds.has(id)) {
          try {
            board.removeObject(el);
          } catch {
            // element may already be gone
          }
          elementsRef.current.delete(id);
        }
      }

      // Add / update elements
      for (const expr of expressions) {
        const existing = elementsRef.current.get(expr.id);

        if (existing) {
          // Update visibility + style in-place when possible
          try {
            existing.setAttribute({
              visible: expr.visible,
              strokeColor: expr.color,
              strokeWidth: expr.lineWidth ?? 2,
              dash: DASH_MAP[expr.lineStyle] ?? 0,
            });
          } catch {
            // Attribute update failed — fall through to recreate
          }
          // For function graphs we need to rebuild whenever the latex changes
          // because JSXGraph doesn't expose a direct "update function" API.
          // We track the latex string to detect this.
          if (existing._lokusLatex !== expr.latex || existing._lokusType !== expr.type) {
            try { board.removeObject(existing); } catch { /* ignore */ }
            elementsRef.current.delete(expr.id);

            const el = createBoardElement(board, expr, scope);
            if (el) {
              el._lokusLatex = expr.latex;
              el._lokusType = expr.type;
              elementsRef.current.set(expr.id, el);
            }
          }
        } else {
          // New expression
          const el = createBoardElement(board, expr, scope);
          if (el) {
            el._lokusLatex = expr.latex;
            el._lokusType = expr.type;
            elementsRef.current.set(expr.id, el);
          }
        }
      }
    } finally {
      board.unsuspendUpdate();
    }
  }, [expressions, variables, is3D]);

  // ── Annotation rendering ──────────────────────────────────────────────────

  const annotationsRef = useRef(new Map());

  useEffect(() => {
    const board = boardRef.current;
    if (!board || is3D) return;

    board.suspendUpdate();
    try {
      // Remove old annotations
      for (const [id, el] of annotationsRef.current) {
        try { board.removeObject(el); } catch { /* ok */ }
      }
      annotationsRef.current = new Map();

      // Create new annotations
      for (const ann of annotations) {
        try {
          if (ann.type === 'label') {
            const el = board.create('text', [
              ann.x ?? 0,
              ann.y ?? 0,
              ann.text || '',
            ], {
              fontSize: 14,
              strokeColor: ann.color || 'rgb(var(--text))',
              fixed: true,
              highlight: false,
              anchorX: 'left',
              anchorY: 'middle',
            });
            annotationsRef.current.set(ann.id, el);
          } else if (ann.type === 'arrow') {
            const el = board.create('arrow', [
              [ann.x ?? 0, ann.y ?? 0],
              [ann.x2 ?? (ann.x ?? 0) + 1, ann.y2 ?? (ann.y ?? 0) + 1],
            ], {
              strokeColor: ann.color || '#333',
              strokeWidth: 2,
              fixed: true,
              highlight: false,
            });
            annotationsRef.current.set(ann.id, el);
          }
        } catch (err) {
          console.warn('[MathGraphBoard] Annotation failed:', err);
        }
      }
    } finally {
      board.unsuspendUpdate();
    }
  }, [annotations, is3D]);

  // ── Resize observer ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      const board = boardRef.current;
      if (!board) return;
      try {
        board.resizeContainer(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight,
          true,
          true
        );
      } catch {
        // board may be mid-teardown
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── 3D board init ──────────────────────────────────────────────────────────

  const board3DRef = useRef(null);
  const view3DRef = useRef(null);
  const elements3DRef = useRef(new Map());
  const boardId3D = boardId + '-3d';
  const [reset3DCounter, setReset3DCounter] = useState(0);

  // Compass SVG element refs — updated imperatively via rAF (no re-renders)
  const compassXRef = useRef(null);
  const compassYRef = useRef(null);
  const compassZRef = useRef(null);
  const compassXLabelRef = useRef(null);
  const compassYLabelRef = useRef(null);
  const compassZLabelRef = useRef(null);
  const compassAnimRef = useRef(null);

  useEffect(() => {
    if (!is3D) return;
    const container = containerRef.current;
    if (!container) return;

    try { JXG.JSXGraph.freeBoard(boardId3D); } catch { /* ok */ }

    const theme3D = getThemeColors(container);

    const board = JXG.JSXGraph.initBoard(boardId3D, {
      boundingbox: [-8, 8, 8, -8],
      axis: false,
      showCopyright: false,
      showNavigation: false,
      pan: { enabled: true, needShift: true },
      zoom: { enabled: false },
      keepaspectratio: false,
    });

    board.containerObj.style.background = theme3D.background;

    const range = 5;

    // View3D: centered in the board, filling most of the space
    // [llx, lly] = lower-left corner, [w, h] = size in 2D board coords
    const view = board.create('view3d', [
      [-6, -6],
      [12, 12],
      [
        [-range, range],
        [-range, range],
        [-range, range],
      ],
    ], {
      projection: 'parallel',
      trackball: { enabled: true },
      xAxis: { strokeColor: theme3D.axis, name: 'x',
        ticks: { strokeColor: theme3D.axis, label: { strokeColor: theme3D.axis } },
        label: { strokeColor: theme3D.axis } },
      yAxis: { strokeColor: theme3D.axis, name: 'y',
        ticks: { strokeColor: theme3D.axis, label: { strokeColor: theme3D.axis } },
        label: { strokeColor: theme3D.axis } },
      zAxis: { strokeColor: theme3D.axis, name: 'z',
        ticks: { strokeColor: theme3D.axis, label: { strokeColor: theme3D.axis } },
        label: { strokeColor: theme3D.axis } },
      xPlaneRear: { visible: false },
      yPlaneRear: { visible: false },
      zPlaneRear: { visible: false },
    });

    board3DRef.current = board;
    view3DRef.current = view;
    elements3DRef.current = new Map();

    return () => {
      try { JXG.JSXGraph.freeBoard(boardId3D); } catch { /* ok */ }
      board3DRef.current = null;
      view3DRef.current = null;
      elements3DRef.current = new Map();
    };
  }, [boardId3D, is3D, reset3DCounter]);

  // ── 3D expression rendering ───────────────────────────────────────────────

  useEffect(() => {
    const board = board3DRef.current;
    const view = view3DRef.current;
    if (!board || !view || !is3D) return;

    const scope = buildScope(variables);

    board.suspendUpdate();
    try {
      // Remove old 3D elements
      for (const [id, el] of elements3DRef.current) {
        try { board.removeObject(el); } catch { /* ok */ }
      }
      elements3DRef.current = new Map();

      // Get axis ranges from the view (centered on origin)
      const bb = view.bbox3D;
      const xRange = bb ? [bb[0][0], bb[0][1]] : [-5, 5];
      const yRange = bb ? [bb[1][0], bb[1][1]] : [-5, 5];

      // Create 3D elements
      for (const expr of expressions) {
        if (!expr.visible) continue;

        const compiled = expressionEngine.compile(expr.latex);
        if (!compiled || compiled.error) continue;

        const plotFn = expressionEngine.createPlotFunction(compiled, scope);
        if (!plotFn) continue;

        try {
          const color = expr.color ?? '#c0392b';
          let el = null;

          if (compiled.type === 'surface3d' && typeof plotFn === 'function') {
            // z = f(x, y) — true 3D surface
            el = view.create('functiongraph3d', [
              (x, y) => {
                try { return plotFn(x, y); } catch { return NaN; }
              },
              xRange, yRange,
            ], {
              strokeWidth: 0.5,
              stepsU: 50, stepsV: 50,
              strokeColor: color,
            });
          } else if (compiled.type === 'explicit' && typeof plotFn === 'function') {
            if (plotFn.xOfY) {
              // x = f(y) → 3D "wall" surface: x = f(y), constant in z
              el = view.create('functiongraph3d', [
                (_x, y) => {
                  try { return plotFn(y); } catch { return NaN; }
                },
                xRange, yRange,
              ], {
                strokeWidth: 0.5,
                stepsU: 2, stepsV: 50,
                strokeColor: color,
              });
            } else {
              // y = f(x) → 3D "curtain" surface: z = f(x), constant in y
              el = view.create('functiongraph3d', [
                (x, _y) => {
                  try { return plotFn(x); } catch { return NaN; }
                },
                xRange, yRange,
              ], {
                strokeWidth: 0.5,
                stepsU: 50, stepsV: 2,
                strokeColor: color,
              });
            }
          } else if (compiled.type === 'implicit' && typeof plotFn === 'function') {
            // F(x,y) = 0 → elevation map z = F(x,y)
            el = view.create('functiongraph3d', [
              (x, y) => {
                try { return plotFn(x, y); } catch { return NaN; }
              },
              xRange, yRange,
            ], {
              strokeWidth: 0.5,
              stepsU: 40, stepsV: 40,
              strokeColor: color,
            });
          }

          if (el) {
            elements3DRef.current.set(expr.id, el);
          }
        } catch (err) {
          console.warn('[MathGraphBoard] 3D element failed:', err);
        }
      }
    } finally {
      board.unsuspendUpdate();
    }
  }, [expressions, variables, is3D, viewport]);

  // ── 3D resize ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!is3D || !containerRef.current) return;

    const observer = new ResizeObserver(() => {
      const board = board3DRef.current;
      if (!board || !containerRef.current) return;
      try {
        board.resizeContainer(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight,
          true,
          true
        );
      } catch { /* board may be mid-teardown */ }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [is3D]);

  // ── 3D wheel zoom ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!is3D) return;
    const container = containerRef.current;
    if (!container) return;

    const handler = (e) => {
      e.preventDefault();
      const board = board3DRef.current;
      if (!board) return;

      const bb = board.getBoundingBox();
      const factor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
      const cx = (bb[0] + bb[2]) / 2;
      const cy = (bb[1] + bb[3]) / 2;
      const hw = ((bb[2] - bb[0]) / 2) * factor;
      const hh = ((bb[1] - bb[3]) / 2) * factor;

      // Clamp to reasonable bounds
      if (hw < 0.5 || hw > 200) return;

      board.setBoundingBox([cx - hw, cy + hh, cx + hw, cy - hh], false);
    };

    container.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', handler, { capture: true });
  }, [is3D]);

  // ── 3D compass animation ──────────────────────────────────────────────

  useEffect(() => {
    if (!is3D) return;

    const animate = () => {
      const view = view3DRef.current;
      if (view?.matrix3D) {
        try {
          const m = view.matrix3D;
          const arm = 22;
          const cx = 35, cy = 35;

          const axes = [
            { line: compassXRef, label: compassXLabelRef, col: 1 },
            { line: compassYRef, label: compassYLabelRef, col: 2 },
            { line: compassZRef, label: compassZLabelRef, col: 3 },
          ];

          for (const { line, label, col } of axes) {
            if (!line.current) continue;
            const u = m[1][col];
            const v = -m[2][col]; // flip for SVG Y-down
            const len = Math.sqrt(u * u + v * v) || 1;
            const nx = (u / len) * arm;
            const ny = (v / len) * arm;
            line.current.setAttribute('x2', String(cx + nx));
            line.current.setAttribute('y2', String(cy + ny));
            if (label.current) {
              label.current.setAttribute('x', String(cx + nx * 1.3));
              label.current.setAttribute('y', String(cy + ny * 1.3));
            }
          }
        } catch {
          // matrix3D might have unexpected shape during re-init
        }
      }
      compassAnimRef.current = requestAnimationFrame(animate);
    };

    compassAnimRef.current = requestAnimationFrame(animate);
    return () => {
      if (compassAnimRef.current) cancelAnimationFrame(compassAnimRef.current);
    };
  }, [is3D]);

  // ── 3D controls ───────────────────────────────────────────────────────

  const handleReset3D = useCallback(() => {
    setReset3DCounter((c) => c + 1);
  }, []);

  const handleZoom3DIn = useCallback(() => {
    const board = board3DRef.current;
    if (!board) return;
    const bb = board.getBoundingBox();
    const factor = 1 / 1.3;
    const cx = (bb[0] + bb[2]) / 2;
    const cy = (bb[1] + bb[3]) / 2;
    const hw = ((bb[2] - bb[0]) / 2) * factor;
    const hh = ((bb[1] - bb[3]) / 2) * factor;
    board.setBoundingBox([cx - hw, cy + hh, cx + hw, cy - hh], false);
  }, []);

  const handleZoom3DOut = useCallback(() => {
    const board = board3DRef.current;
    if (!board) return;
    const bb = board.getBoundingBox();
    const factor = 1.3;
    const cx = (bb[0] + bb[2]) / 2;
    const cy = (bb[1] + bb[3]) / 2;
    const hw = ((bb[2] - bb[0]) / 2) * factor;
    const hh = ((bb[1] - bb[3]) / 2) * factor;
    board.setBoundingBox([cx - hw, cy + hh, cx + hw, cy - hh], false);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="math-graph-board" ref={containerRef}>
      {/* 2D board — visible when not in 3D mode */}
      <div
        id={boardId}
        className="jxgbox"
        style={{
          width: '100%',
          height: '100%',
          background: 'rgb(var(--bg))',
          display: is3D ? 'none' : 'block',
        }}
      />
      {/* 3D board — visible when in 3D mode */}
      <div
        id={boardId3D}
        className="jxgbox"
        style={{
          width: '100%',
          height: '100%',
          background: 'rgb(var(--bg))',
          display: is3D ? 'block' : 'none',
        }}
      />

      {/* ── 3D overlays: compass gizmo + zoom/reset controls ──────────── */}
      {is3D && (
        <>
          {/* XYZ Compass Gizmo */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              width: 70,
              height: 70,
              background: 'rgb(var(--panel) / 0.85)',
              borderRadius: 10,
              border: '1px solid rgb(var(--border) / 0.4)',
              backdropFilter: 'blur(6px)',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="2.5" fill="rgb(var(--text) / 0.3)" />
              {/* X axis — red */}
              <line ref={compassXRef} x1="35" y1="35" x2="57" y2="35"
                stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <text ref={compassXLabelRef} x="60" y="36" fill="#ef4444"
                fontSize="9" fontWeight="600" dominantBaseline="middle" textAnchor="middle">X</text>
              {/* Y axis — green */}
              <line ref={compassYRef} x1="35" y1="35" x2="35" y2="13"
                stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
              <text ref={compassYLabelRef} x="35" y="8" fill="#22c55e"
                fontSize="9" fontWeight="600" dominantBaseline="middle" textAnchor="middle">Y</text>
              {/* Z axis — blue */}
              <line ref={compassZRef} x1="35" y1="35" x2="50" y2="20"
                stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
              <text ref={compassZLabelRef} x="53" y="17" fill="#3b82f6"
                fontSize="9" fontWeight="600" dominantBaseline="middle" textAnchor="middle">Z</text>
            </svg>
          </div>

          {/* 3D Zoom / Reset Controls */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 20,
            }}
          >
            {[
              { label: '+', title: 'Zoom in', onClick: handleZoom3DIn },
              { label: '\u2302', title: 'Reset view', onClick: handleReset3D },
              { label: '\u2212', title: 'Zoom out', onClick: handleZoom3DOut },
            ].map(({ label, title, onClick }) => (
              <button
                key={title}
                onClick={onClick}
                title={title}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgb(var(--panel) / 0.85)',
                  border: '1px solid rgb(var(--border) / 0.4)',
                  borderRadius: 6,
                  color: 'rgb(var(--text))',
                  fontSize: 14,
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
