/**
 * MathGraphEditor.jsx
 *
 * Top-level orchestrator for the Lokus mathematical graphing editor.
 * This is the component mounted by EditorGroup when a .graph file is opened.
 *
 * Responsibilities
 * ────────────────
 * - Load / save .graph files via GraphFileManager
 * - Own the full graphData state object
 * - Dispatch targeted updates to sub-objects (expressions, variables, viewport, settings)
 * - Auto-save with a 2-second debounce on any change
 * - Render the toolbar, ExpressionList sidebar, and MathGraphBoard canvas
 *
 * State topology
 * ──────────────
 *   graphData  (single useState)
 *     ├── metadata  → title
 *     ├── viewport  → xMin / xMax / yMin / yMax
 *     ├── settings  → showGrid / showAxes / degreeMode / colors
 *     ├── expressions[]
 *     └── variables[]
 *
 * The board and sidebar are driven purely by derived slices of graphData.
 * No shared context or external store is needed.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { loadGraphFile, saveGraphFile } from '../../core/mathgraph/GraphFileManager.js';
import {
  createDefaultGraph,
  createExpression,
  createVariable,
  createAnimation,
  DEFAULT_COLORS,
} from '../../core/mathgraph/schema.js';
import expressionEngine from '../../core/mathgraph/ExpressionEngine.js';
import ExpressionList from './ExpressionList.jsx';
import MathGraphBoard from './MathGraphBoard.jsx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_SAVE_DELAY_MS = 2000;

const DEFAULT_VIEWPORT = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick the next color from the DEFAULT_COLORS palette based on how many
 * expressions already exist.
 *
 * @param {object[]} expressions
 * @returns {string}
 */
function nextColor(expressions) {
  return DEFAULT_COLORS[expressions.length % DEFAULT_COLORS.length];
}


// ---------------------------------------------------------------------------
// Toolbar sub-component
// ---------------------------------------------------------------------------

function SettingsDropdown({ settings, onUpdate, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  const toggle = (key) => onUpdate({ [key]: !settings[key] });

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{
        background: 'rgb(var(--panel))',
        border: '1px solid rgb(var(--border))',
      }}
    >
      {[
        { key: 'showGrid', label: 'Show Grid' },
        { key: 'showAxes', label: 'Show Axes' },
        { key: 'showLabels', label: 'Show Labels' },
        { key: 'degreeMode', label: 'Degree Mode' },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => toggle(key)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-black/5 focus:outline-none"
          style={{ color: 'rgb(var(--text))' }}
        >
          <span>{label}</span>
          <span style={{ color: settings[key] ? 'rgb(var(--accent))' : 'rgb(var(--text) / 0.3)' }}>
            {settings[key] ? '✓' : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

function Toolbar({
  title,
  is3D,
  settings,
  onTitleChange,
  onToggle3D,
  onSettingsUpdate,
  onZoomIn,
  onZoomOut,
  onResetView,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [showSettings, setShowSettings] = useState(false);

  // Sync external title updates (e.g. initial load)
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    const trimmed = localTitle.trim() || 'Untitled Graph';
    setLocalTitle(trimmed);
    onTitleChange(trimmed);
  }, [localTitle, onTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') commitTitle();
      if (e.key === 'Escape') {
        setLocalTitle(title);
        setEditingTitle(false);
      }
    },
    [commitTitle, title]
  );

  return (
    <div
      className="flex items-center gap-2 px-3 flex-shrink-0"
      style={{
        height: 40,
        background: 'rgb(var(--panel))',
        borderBottom: '1px solid rgb(var(--border))',
      }}
    >
      {/* Title */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            className="px-1 py-0.5 text-sm font-medium rounded w-full max-w-xs"
            style={{
              background: 'rgb(var(--panel))',
              color: 'rgb(var(--text))',
              border: '1px solid rgb(var(--accent))',
              outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="text-sm font-medium truncate hover:opacity-70 transition-opacity focus:outline-none text-left"
            style={{ color: 'rgb(var(--text))' }}
            title="Click to rename"
          >
            {localTitle || 'Untitled Graph'}
          </button>
        )}
      </div>

      {/* 2D / 3D toggle */}
      <div
        className="flex rounded overflow-hidden text-xs font-medium"
        style={{ border: '1px solid rgb(var(--border))' }}
      >
        {['2D', '3D'].map((mode) => {
          const active = mode === '3D' ? is3D : !is3D;
          return (
            <button
              key={mode}
              onClick={() => onToggle3D(mode === '3D')}
              className="px-2.5 py-1 transition-colors focus:outline-none"
              style={{
                background: active ? 'rgb(var(--accent))' : 'transparent',
                color: active ? '#fff' : 'rgb(var(--text) / 0.7)',
              }}
            >
              {mode}
            </button>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div
        className="flex rounded overflow-hidden text-xs"
        style={{ border: '1px solid rgb(var(--border))' }}
      >
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="px-2 py-1 hover:bg-black/5 transition-colors focus:outline-none"
          style={{ color: 'rgb(var(--text))' }}
        >
          +
        </button>
        <div style={{ width: 1, background: 'rgb(var(--border))' }} />
        <button
          onClick={onResetView}
          title="Reset view"
          className="px-2 py-1 hover:bg-black/5 transition-colors focus:outline-none text-xs"
          style={{ color: 'rgb(var(--text))' }}
        >
          ⌂
        </button>
        <div style={{ width: 1, background: 'rgb(var(--border))' }} />
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="px-2 py-1 hover:bg-black/5 transition-colors focus:outline-none"
          style={{ color: 'rgb(var(--text))' }}
        >
          −
        </button>
      </div>

      {/* Settings */}
      <div className="relative">
        <button
          onClick={() => setShowSettings((v) => !v)}
          title="Graph settings"
          className="px-2 py-1 rounded text-sm hover:bg-black/5 transition-colors focus:outline-none"
          style={{ color: 'rgb(var(--text) / 0.7)' }}
        >
          ⚙
        </button>
        {showSettings && (
          <SettingsDropdown
            settings={settings}
            onUpdate={onSettingsUpdate}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveIndicator
// ---------------------------------------------------------------------------

function SaveIndicator({ state }) {
  if (state === 'saved') {
    return (
      <span
        className="text-xs px-2"
        style={{ color: 'rgb(var(--text) / 0.4)' }}
      >
        Saved
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span
        className="text-xs px-2"
        style={{ color: 'rgb(var(--text) / 0.4)' }}
      >
        Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="text-xs px-2" style={{ color: '#e74c3c' }}>
        Save failed
      </span>
    );
  }
  // 'dirty' — pending save
  return (
    <span
      className="text-xs px-2"
      style={{ color: 'rgb(var(--text) / 0.35)' }}
    >
      •
    </span>
  );
}

// ---------------------------------------------------------------------------
// MathGraphEditor
// ---------------------------------------------------------------------------

/**
 * MathGraphEditor
 *
 * Props
 * ─────
 * graphPath   {string}   — absolute path to the .graph file
 * onSave      {Function} — called after each successful save (marks tab clean)
 * onChange    {Function} — called on any change (marks tab dirty)
 */
export default function MathGraphEditor({ graphPath, onSave, onChange }) {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveState, setSaveState] = useState('saved'); // 'saved'|'dirty'|'saving'|'error'
  const [is3D, setIs3D] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Debounce timer ref
  const autoSaveTimer = useRef(null);

  // ── File load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!graphPath) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    loadGraphFile(graphPath)
      .then((data) => {
        if (!cancelled) {
          setGraphData(data);
          setLoading(false);
          setSaveState('saved');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[MathGraphEditor] Load failed:', err);
          setLoadError(err?.message ?? String(err));
          setGraphData(createDefaultGraph());
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [graphPath]);

  // ── Auto-save ─────────────────────────────────────────────────────────────

  // Track latest dirty data in a ref so unmount can flush it
  const pendingDataRef = useRef(null);

  const scheduleAutoSave = useCallback(
    (data) => {
      pendingDataRef.current = data;

      clearTimeout(autoSaveTimer.current);
      // Defer state updates to avoid "setState during render" when called
      // from inside a setGraphData updater function
      queueMicrotask(() => {
        setSaveState('dirty');
        onChange?.();
      });
      autoSaveTimer.current = setTimeout(async () => {
        if (!graphPath) return;
        pendingDataRef.current = null;
        setSaveState('saving');
        try {
          await saveGraphFile(graphPath, data);
          setSaveState('saved');
          onSave?.();
        } catch (err) {
          console.error('[MathGraphEditor] Auto-save failed:', err);
          setSaveState('error');
        }
      }, AUTO_SAVE_DELAY_MS);
    },
    [graphPath, onSave, onChange]
  );

  // On unmount: flush any pending save immediately instead of discarding it
  useEffect(() => {
    return () => {
      clearTimeout(autoSaveTimer.current);
      if (pendingDataRef.current && graphPath) {
        saveGraphFile(graphPath, pendingDataRef.current).catch((err) =>
          console.error('[MathGraphEditor] Flush save on unmount failed:', err)
        );
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphPath]);

  // ── Mutation helpers ──────────────────────────────────────────────────────

  /** Update any top-level slice of graphData immutably. */
  const updateGraph = useCallback(
    (updater) => {
      setGraphData((prev) => {
        if (!prev) return prev;
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        scheduleAutoSave(next);
        return next;
      });
    },
    [scheduleAutoSave]
  );

  // ── Expression operations ─────────────────────────────────────────────────

  const handleUpdateExpression = useCallback(
    (id, changes) => {
      updateGraph((prev) => {
        const expressions = prev.expressions.map((e) =>
          e.id === id ? { ...e, ...changes } : e
        );

        // If latex changed, auto-detect type (but NOT parameters — that's debounced)
        if ('latex' in changes && changes.latex) {
          const detectedType = expressionEngine.detectType(changes.latex);
          const updatedExpressions = expressions.map((e) =>
            e.id === id ? { ...e, type: detectedType } : e
          );
          return { ...prev, expressions: updatedExpressions };
        }

        return { ...prev, expressions };
      });
    },
    [updateGraph]
  );

  // ── Debounced parameter detection ──────────────────────────────────────
  // Wait 1s after the last expression change before creating/removing
  // auto-created variable sliders.  This prevents transient symbols like
  // "s" and "si" from becoming sliders while the user types "sin(x)".

  const paramTimerRef = useRef(null);

  useEffect(() => {
    if (!graphData) return;

    clearTimeout(paramTimerRef.current);
    paramTimerRef.current = setTimeout(() => {
      setGraphData((prev) => {
        if (!prev) return prev;

        // Collect parameters from all *valid* expressions
        const allParams = new Set();
        for (const expr of prev.expressions) {
          if (!expr.latex?.trim()) continue;
          const compiled = expressionEngine.compile(expr.latex);
          if (compiled.error) continue;
          const params = expressionEngine.getParameters(expr.latex);
          params.forEach((p) => allParams.add(p));
        }

        const existingNames = new Set(prev.variables.map((v) => v.name));
        const missing = [...allParams].filter((p) => !existingNames.has(p));

        // Remove auto-created vars no longer referenced by any expression
        const toRemove = prev.variables.filter(
          (v) => v.autoCreated && !allParams.has(v.name)
        );

        if (missing.length === 0 && toRemove.length === 0) return prev;

        const removeIds = new Set(toRemove.map((v) => v.id));
        const kept = prev.variables.filter((v) => !removeIds.has(v.id));
        const newVars = missing.map((name) => ({
          ...createVariable(name),
          autoCreated: true,
        }));

        const next = { ...prev, variables: [...kept, ...newVars] };
        scheduleAutoSave(next);
        return next;
      });
    }, 1000);

    return () => clearTimeout(paramTimerRef.current);
    // Only re-run when expressions change (not when variables change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData?.expressions]);

  const handleDeleteExpression = useCallback(
    (id) => {
      updateGraph((prev) => ({
        ...prev,
        expressions: prev.expressions.filter((e) => e.id !== id),
      }));
    },
    [updateGraph]
  );

  const handleAddExpression = useCallback(() => {
    updateGraph((prev) => {
      const color = nextColor(prev.expressions);
      const expr = createExpression('explicit', '', color);
      return { ...prev, expressions: [...prev.expressions, expr] };
    });
  }, [updateGraph]);

  // ── Variable operations ───────────────────────────────────────────────────

  const handleUpdateVariable = useCallback(
    (id, changes) => {
      updateGraph((prev) => ({
        ...prev,
        variables: prev.variables.map((v) =>
          v.id === id ? { ...v, ...changes } : v
        ),
      }));
    },
    [updateGraph]
  );

  const handleAddVariable = useCallback(
    (name, value) => {
      updateGraph((prev) => {
        // Prevent duplicates
        if (prev.variables.some((v) => v.name === name)) return prev;
        const variable = createVariable(name, value);
        return { ...prev, variables: [...prev.variables, variable] };
      });
    },
    [updateGraph]
  );

  const handleDeleteVariable = useCallback(
    (id) => {
      updateGraph((prev) => ({
        ...prev,
        variables: prev.variables.filter((v) => v.id !== id),
      }));
    },
    [updateGraph]
  );

  // ── Viewport operations ───────────────────────────────────────────────────

  const handleViewportChange = useCallback(
    (vp) => {
      // Sanity check: reject absurd viewport values to prevent save pollution
      const { xMin, xMax, yMin, yMax } = vp;
      if (
        !isFinite(xMin) || !isFinite(xMax) || !isFinite(yMin) || !isFinite(yMax) ||
        Math.abs(xMax - xMin) > 1e6 || Math.abs(yMax - yMin) > 1e6 ||
        Math.abs(xMax - xMin) < 1e-10
      ) {
        return;
      }
      updateGraph((prev) => ({
        ...prev,
        viewport: { ...prev.viewport, ...vp },
      }));
    },
    [updateGraph]
  );

  const handleZoomIn = useCallback(() => {
    setGraphData((prev) => {
      if (!prev) return prev;
      const { xMin, xMax, yMin, yMax } = prev.viewport;
      const cx = (xMin + xMax) / 2;
      const cy = (yMin + yMax) / 2;
      const hw = (xMax - xMin) / 2 * 0.7;
      const hh = (yMax - yMin) / 2 * 0.7;
      const next = {
        ...prev,
        viewport: { ...prev.viewport, xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh },
      };
      scheduleAutoSave(next);
      return next;
    });
  }, [scheduleAutoSave]);

  const handleZoomOut = useCallback(() => {
    setGraphData((prev) => {
      if (!prev) return prev;
      const { xMin, xMax, yMin, yMax } = prev.viewport;
      const cx = (xMin + xMax) / 2;
      const cy = (yMin + yMax) / 2;
      const hw = (xMax - xMin) / 2 * (1 / 0.7);
      const hh = (yMax - yMin) / 2 * (1 / 0.7);
      const next = {
        ...prev,
        viewport: { ...prev.viewport, xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh },
      };
      scheduleAutoSave(next);
      return next;
    });
  }, [scheduleAutoSave]);

  const handleResetView = useCallback(() => {
    updateGraph((prev) => ({
      ...prev,
      viewport: { ...prev.viewport, ...DEFAULT_VIEWPORT },
    }));
  }, [updateGraph]);

  // ── Settings ──────────────────────────────────────────────────────────────

  const handleSettingsUpdate = useCallback(
    (changes) => {
      updateGraph((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...changes },
      }));
    },
    [updateGraph]
  );

  // ── Title ─────────────────────────────────────────────────────────────────

  const handleTitleChange = useCallback(
    (title) => {
      updateGraph((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, title },
      }));
    },
    [updateGraph]
  );

  // ── Animation system ────────────────────────────────────────────────────

  const animFrameRef = useRef(null);
  const lastTickRef = useRef(null);

  // Build a lookup of playing animations for the rAF loop
  const playingAnimations = graphData?.animations?.filter((a) => a.playing) ?? [];

  useEffect(() => {
    if (playingAnimations.length === 0) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTickRef.current = null;
      return;
    }

    const tick = (timestamp) => {
      if (!lastTickRef.current) lastTickRef.current = timestamp;
      const dt = (timestamp - lastTickRef.current) / 1000; // seconds
      lastTickRef.current = timestamp;

      setGraphData((prev) => {
        if (!prev) return prev;
        const anims = prev.animations?.filter((a) => a.playing) ?? [];
        if (anims.length === 0) return prev;

        let variables = [...prev.variables];
        let changed = false;

        for (const anim of anims) {
          const varIdx = variables.findIndex((v) => v.id === anim.targetVariable);
          if (varIdx === -1) continue;

          const v = variables[varIdx];
          const speed = (anim.speed ?? 1) * (v.max - v.min) * 0.1; // traverse 10% of range per second at speed=1
          let next = v.value + speed * dt;

          if (anim.mode === 'oscillate') {
            // Bounce between min and max
            if (next > v.max) {
              next = v.max - (next - v.max);
              // Reverse direction by negating speed — use sign flag on anim
              // For simplicity: wrap using modular bounce
              const range = v.max - v.min;
              const pos = ((next - v.min) % (2 * range) + 2 * range) % (2 * range);
              next = pos <= range ? v.min + pos : v.max - (pos - range);
            }
            if (next < v.min) next = v.min;
          } else if (anim.mode === 'loop') {
            // Wrap around
            if (next > v.max) next = v.min + (next - v.max) % (v.max - v.min);
            if (next < v.min) next = v.min;
          } else if (anim.mode === 'once') {
            if (next >= v.max) {
              next = v.max;
              // Stop this animation
            }
          }

          if (next !== v.value) {
            variables = variables.map((vv, i) =>
              i === varIdx ? { ...vv, value: next } : vv
            );
            changed = true;
          }
        }

        if (!changed) return prev;
        return { ...prev, variables };
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTickRef.current = null;
    };
    // Re-subscribe when animation list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingAnimations.map((a) => a.id + a.playing).join(',')]);

  // Animation handlers
  const handleToggleAnimation = useCallback(
    (variableId) => {
      updateGraph((prev) => {
        const existing = prev.animations?.find((a) => a.targetVariable === variableId);
        if (existing) {
          // Toggle playing state
          return {
            ...prev,
            animations: prev.animations.map((a) =>
              a.id === existing.id ? { ...a, playing: !a.playing } : a
            ),
          };
        }
        // Create new animation for this variable
        const anim = createAnimation(variableId, 'oscillate', 1.0);
        anim.playing = true;
        return {
          ...prev,
          animations: [...(prev.animations || []), anim],
        };
      });
    },
    [updateGraph]
  );

  const handleSetAnimationMode = useCallback(
    (variableId, mode) => {
      updateGraph((prev) => ({
        ...prev,
        animations: (prev.animations || []).map((a) =>
          a.targetVariable === variableId ? { ...a, mode } : a
        ),
      }));
    },
    [updateGraph]
  );

  const handleSetAnimationSpeed = useCallback(
    (variableId, speed) => {
      updateGraph((prev) => ({
        ...prev,
        animations: (prev.animations || []).map((a) =>
          a.targetVariable === variableId ? { ...a, speed } : a
        ),
      }));
    },
    [updateGraph]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: 'rgb(var(--text) / 0.5)', background: 'rgb(var(--panel))' }}
      >
        <span className="text-sm">Loading graph…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center h-full flex-col gap-2"
        style={{ color: 'rgb(var(--text))', background: 'rgb(var(--panel))' }}
      >
        <span style={{ fontSize: 32 }}>⚠</span>
        <p className="text-sm font-medium">Failed to load graph</p>
        <p className="text-xs" style={{ color: 'rgb(var(--text) / 0.5)' }}>
          {loadError}
        </p>
      </div>
    );
  }

  if (!graphData) return null;

  const rawVp = {
    xMin: graphData.viewport?.xMin ?? DEFAULT_VIEWPORT.xMin,
    xMax: graphData.viewport?.xMax ?? DEFAULT_VIEWPORT.xMax,
    yMin: graphData.viewport?.yMin ?? DEFAULT_VIEWPORT.yMin,
    yMax: graphData.viewport?.yMax ?? DEFAULT_VIEWPORT.yMax,
  };
  // Clamp blown-out viewports (e.g. from function eval range leak) back to defaults
  const isAbsurd =
    !isFinite(rawVp.xMin) || !isFinite(rawVp.xMax) || !isFinite(rawVp.yMin) || !isFinite(rawVp.yMax) ||
    Math.abs(rawVp.xMax - rawVp.xMin) > 500 || Math.abs(rawVp.yMax - rawVp.yMin) > 500;
  const viewport = isAbsurd ? { ...DEFAULT_VIEWPORT } : rawVp;

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'rgb(var(--panel))' }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center">
        {/* Sidebar toggle button */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Hide expressions' : 'Show expressions'}
          className="flex items-center justify-center flex-shrink-0 transition-colors hover:bg-black/5"
          style={{
            width: 40,
            height: 40,
            color: 'rgb(var(--text) / 0.6)',
            borderBottom: '1px solid rgb(var(--border))',
            background: 'rgb(var(--panel))',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            {sidebarOpen ? (
              <polyline points="15 8 12 12 15 16" />
            ) : (
              <polyline points="12 8 15 12 12 16" />
            )}
          </svg>
        </button>
        <div className="flex-1">
          <Toolbar
            title={graphData.metadata?.title ?? 'Untitled Graph'}
            is3D={is3D}
            settings={graphData.settings}
            onTitleChange={handleTitleChange}
            onToggle3D={setIs3D}
            onSettingsUpdate={handleSettingsUpdate}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={handleResetView}
          />
        </div>
        <div
          className="flex items-center pr-2 flex-shrink-0"
          style={{
            height: 40,
            borderBottom: '1px solid rgb(var(--border))',
            background: 'rgb(var(--panel))',
          }}
        >
          <SaveIndicator state={saveState} />
        </div>
      </div>

      {/* ── Main area: sidebar + board ────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Expression list sidebar — collapsible */}
        {sidebarOpen && (
          <ExpressionList
            expressions={graphData.expressions}
            variables={graphData.variables}
            animations={graphData.animations || []}
            onUpdateExpression={handleUpdateExpression}
            onDeleteExpression={handleDeleteExpression}
            onAddExpression={handleAddExpression}
            onUpdateVariable={handleUpdateVariable}
            onAddVariable={handleAddVariable}
            onDeleteVariable={handleDeleteVariable}
            onToggleAnimation={handleToggleAnimation}
            onSetAnimationMode={handleSetAnimationMode}
            onSetAnimationSpeed={handleSetAnimationSpeed}
          />
        )}

        {/* JSXGraph board */}
        <div className="flex-1 min-w-0 min-h-0 relative">
          <MathGraphBoard
            expressions={graphData.expressions}
            variables={graphData.variables}
            annotations={graphData.annotations || []}
            viewport={viewport}
            settings={graphData.settings}
            onViewportChange={handleViewportChange}
            is3D={is3D}
          />
        </div>
      </div>
    </div>
  );
}
