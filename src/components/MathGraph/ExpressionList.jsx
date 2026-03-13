/**
 * ExpressionList.jsx
 *
 * Left sidebar for the math graph editor.  Shows all expressions with their
 * LaTeX preview, an inline text editor, color swatch, visibility toggle, and
 * delete button.  Below the expression list, variable sliders are displayed.
 *
 * Design decisions
 * ────────────────
 * - KaTeX renders the LaTeX preview server-side into an HTML string and we
 *   inject it via dangerouslySetInnerHTML.  The latex comes from the user's
 *   own graph file (not remote), so XSS risk is minimal; we also set
 *   throwOnError:false so bad LaTeX just shows a parse error inline rather
 *   than blowing up the component.
 * - Each expression row is a controlled input. The parent holds the source
 *   of truth; we call onUpdateExpression on every keystroke so the board
 *   re-renders live.
 * - Slider inputs are uncontrolled during drag (for perf) then commit the
 *   final value on mouseup / touchend via a separate handler.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { DEFAULT_COLORS } from '../../core/mathgraph/schema.js';
import expressionEngine from '../../core/mathgraph/ExpressionEngine.js';

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

/**
 * A tiny floating color picker containing the DEFAULT_COLORS palette.
 */
function ColorPicker({ currentColor, onSelect, onClose }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 p-2 rounded-lg shadow-xl flex flex-wrap gap-1"
      style={{
        background: 'rgb(var(--panel))',
        border: '1px solid rgb(var(--border))',
        width: 128,
        top: '100%',
        left: 0,
      }}
    >
      {DEFAULT_COLORS.map((color) => (
        <button
          key={color}
          title={color}
          onClick={() => {
            onSelect(color);
            onClose();
          }}
          className="rounded-full focus:outline-none focus:ring-2"
          style={{
            width: 20,
            height: 20,
            background: color,
            border: currentColor === color
              ? '2px solid rgb(var(--text))'
              : '2px solid transparent',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Renders the KaTeX preview string.  Returns null when latex is empty.
 */
function LatexPreview({ latex }) {
  const html = useMemo(() => {
    if (!latex || !latex.trim()) return null;
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        strict: false,
      });
    } catch {
      return null;
    }
  }, [latex]);

  if (!html) return null;

  return (
    <div
      className="overflow-x-auto text-sm leading-tight"
      style={{ color: 'rgb(var(--text))' }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// ExpressionRow
// ---------------------------------------------------------------------------

function ExpressionRow({
  expression,
  isActive,
  onActivate,
  onUpdate,
  onDelete,
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus when this row becomes the active one
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const validation = useMemo(() => {
    if (!expression.latex || !expression.latex.trim()) {
      return { valid: true, error: null }; // empty is fine — don't nag
    }
    return expressionEngine.validate(expression.latex);
  }, [expression.latex]);

  const handleLatexChange = useCallback(
    (e) => {
      onUpdate(expression.id, { latex: e.target.value });
    },
    [expression.id, onUpdate]
  );

  const handleVisibilityToggle = useCallback(
    (e) => {
      e.stopPropagation();
      onUpdate(expression.id, { visible: !expression.visible });
    },
    [expression.id, expression.visible, onUpdate]
  );

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      onDelete(expression.id);
    },
    [expression.id, onDelete]
  );

  const handleColorSelect = useCallback(
    (color) => {
      onUpdate(expression.id, { color });
    },
    [expression.id, onUpdate]
  );

  return (
    <div
      className="relative flex items-stretch group"
      style={{
        borderLeft: `4px solid ${expression.color}`,
        background: isActive
          ? 'rgb(var(--accent) / 0.08)'
          : 'transparent',
        borderBottom: '1px solid rgb(var(--border))',
      }}
      onClick={onActivate}
    >
      {/* Color swatch — click to open picker */}
      <div className="relative flex-shrink-0 flex items-center pl-2 pr-1">
        <button
          title="Change color"
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker((v) => !v);
          }}
          className="rounded-full focus:outline-none focus:ring-2"
          style={{
            width: 14,
            height: 14,
            background: expression.color,
            border: '1.5px solid rgb(var(--border))',
            flexShrink: 0,
          }}
        />
        {showColorPicker && (
          <ColorPicker
            currentColor={expression.color}
            onSelect={handleColorSelect}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </div>

      {/* Main content: preview + input */}
      <div className="flex-1 min-w-0 py-1.5 pr-1">
        {/* LaTeX preview — shown when the row is not active / input is not focused */}
        <div
          className="min-h-[20px] px-1"
          style={{ opacity: expression.visible ? 1 : 0.4 }}
        >
          <LatexPreview latex={expression.latex} />
        </div>

        {/* Editable input */}
        <input
          ref={inputRef}
          type="text"
          value={expression.latex}
          onChange={handleLatexChange}
          onClick={(e) => e.stopPropagation()}
          placeholder="y = sin(x)"
          spellCheck={false}
          className="w-full mt-0.5 px-1 py-0.5 text-xs rounded"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            background: 'rgb(var(--panel))',
            color: 'rgb(var(--text))',
            border: validation.valid
              ? '1px solid rgb(var(--border))'
              : '1px solid #e74c3c',
            outline: 'none',
          }}
        />

        {/* Inline validation error */}
        {!validation.valid && validation.error && (
          <p
            className="mt-0.5 px-1 text-xs truncate"
            style={{ color: '#e74c3c' }}
            title={validation.error}
          >
            {validation.error}
          </p>
        )}
      </div>

      {/* Action buttons: visibility + delete */}
      <div
        className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          title={expression.visible ? 'Hide' : 'Show'}
          onClick={handleVisibilityToggle}
          className="p-0.5 rounded hover:bg-black/10 focus:outline-none"
          style={{
            fontSize: 14,
            color: expression.visible
              ? 'rgb(var(--text))'
              : 'rgb(var(--text) / 0.4)',
          }}
        >
          {expression.visible ? '👁' : '🙈'}
        </button>
        <button
          title="Delete"
          onClick={handleDelete}
          className="p-0.5 rounded hover:bg-red-500/20 focus:outline-none"
          style={{ fontSize: 12, color: 'rgb(var(--text) / 0.6)' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariableSlider
// ---------------------------------------------------------------------------

function VariableSlider({
  variable,
  animation,
  onUpdate,
  onDelete,
  onToggleAnimation,
  onSetAnimationMode,
  onSetAnimationSpeed,
}) {
  // Keep a local display value during drag so the slider feels instant
  const [localValue, setLocalValue] = useState(variable.value);
  const [showAnimSettings, setShowAnimSettings] = useState(false);

  // Sync if parent resets the value (e.g. undo / file reload / animation tick)
  useEffect(() => {
    setLocalValue(variable.value);
  }, [variable.value]);

  const handleChange = useCallback(
    (e) => {
      const v = parseFloat(e.target.value);
      setLocalValue(v);
      onUpdate(variable.id, { value: v });
    },
    [variable.id, onUpdate]
  );

  const isPlaying = animation?.playing ?? false;
  const animMode = animation?.mode ?? 'oscillate';
  const animSpeed = animation?.speed ?? 1;

  const displayValue = Number.isFinite(localValue)
    ? parseFloat(localValue.toFixed(3))
    : localValue;

  return (
    <div
      className="px-3 py-2 group"
      style={{ borderBottom: '1px solid rgb(var(--border))' }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-mono font-medium"
            style={{ color: 'rgb(var(--text))' }}
          >
            {variable.name}
          </span>
          {/* Play/Pause button */}
          <button
            title={isPlaying ? 'Pause animation' : 'Animate'}
            onClick={() => onToggleAnimation?.(variable.id)}
            className="p-0.5 rounded hover:bg-black/10 focus:outline-none transition-colors"
            style={{
              fontSize: 11,
              color: isPlaying ? 'rgb(var(--accent))' : 'rgb(var(--text) / 0.4)',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          {/* Animation settings toggle */}
          {animation && (
            <button
              title="Animation settings"
              onClick={() => setShowAnimSettings((v) => !v)}
              className="p-0.5 rounded hover:bg-black/10 focus:outline-none"
              style={{ fontSize: 10, color: 'rgb(var(--text) / 0.35)' }}
            >
              ⚙
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: 'rgb(var(--text) / 0.7)', minWidth: 42, textAlign: 'right' }}
          >
            {displayValue}
          </span>
          <button
            title="Remove slider"
            onClick={() => onDelete(variable.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-opacity focus:outline-none"
            style={{ fontSize: 10, color: 'rgb(var(--text) / 0.5)' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Animation settings panel */}
      {showAnimSettings && animation && (
        <div
          className="mb-1.5 p-2 rounded text-xs flex flex-wrap gap-2 items-center"
          style={{
            background: 'rgb(var(--panel))',
            border: '1px solid rgb(var(--border))',
          }}
        >
          {/* Mode selector */}
          <div className="flex items-center gap-1">
            <span style={{ color: 'rgb(var(--text) / 0.5)' }}>Mode:</span>
            {['oscillate', 'loop', 'once'].map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAnimationMode?.(variable.id, mode)}
                className="px-1.5 py-0.5 rounded text-xs focus:outline-none"
                style={{
                  background: animMode === mode ? 'rgb(var(--accent))' : 'transparent',
                  color: animMode === mode ? '#fff' : 'rgb(var(--text) / 0.6)',
                  border: animMode === mode ? 'none' : '1px solid rgb(var(--border))',
                }}
              >
                {mode === 'oscillate' ? '↔' : mode === 'loop' ? '↻' : '→'}
              </button>
            ))}
          </div>
          {/* Speed control */}
          <div className="flex items-center gap-1">
            <span style={{ color: 'rgb(var(--text) / 0.5)' }}>Speed:</span>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={animSpeed}
              onChange={(e) => onSetAnimationSpeed?.(variable.id, parseFloat(e.target.value))}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'rgb(var(--accent))' }}
            />
            <span
              className="font-mono tabular-nums"
              style={{ color: 'rgb(var(--text) / 0.5)', minWidth: 28 }}
            >
              {animSpeed.toFixed(1)}x
            </span>
          </div>
        </div>
      )}

      <input
        type="range"
        min={variable.min}
        max={variable.max}
        step={variable.step}
        value={localValue}
        onChange={handleChange}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: isPlaying ? 'rgb(var(--accent))' : 'rgb(var(--accent))' }}
      />
      <div
        className="flex justify-between text-xs mt-0.5"
        style={{ color: 'rgb(var(--text) / 0.45)' }}
      >
        <span>{variable.min}</span>
        <span>{variable.max}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddSliderDialog — tiny inline form to name a new slider
// ---------------------------------------------------------------------------

function AddSliderDialog({ existingNames, onAdd, onCancel }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid =
    name.trim().length > 0 &&
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim()) &&
    !existingNames.has(name.trim());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid) onAdd(name.trim(), 1);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-3 my-2 flex gap-1 items-center"
    >
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="a"
        spellCheck={false}
        className="flex-1 px-2 py-1 text-xs rounded"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          background: 'rgb(var(--panel))',
          color: 'rgb(var(--text))',
          border: '1px solid rgb(var(--border))',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={!isValid}
        className="px-2 py-1 text-xs rounded font-medium disabled:opacity-40"
        style={{
          background: 'rgb(var(--accent))',
          color: '#fff',
        }}
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-1 text-xs rounded"
        style={{ color: 'rgb(var(--text) / 0.6)' }}
      >
        ✕
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ExpressionList (main export)
// ---------------------------------------------------------------------------

/**
 * ExpressionList
 *
 * Props
 * ─────
 * expressions        {object[]}
 * variables          {object[]}
 * onUpdateExpression (id, changes) => void
 * onDeleteExpression (id) => void
 * onAddExpression    () => void
 * onUpdateVariable   (id, changes) => void
 * onAddVariable      (name, value) => void
 * onDeleteVariable   (id) => void
 */
export default function ExpressionList({
  expressions = [],
  variables = [],
  animations = [],
  onUpdateExpression,
  onDeleteExpression,
  onAddExpression,
  onUpdateVariable,
  onAddVariable,
  onDeleteVariable,
  onToggleAnimation,
  onSetAnimationMode,
  onSetAnimationSpeed,
}) {
  const [activeId, setActiveId] = useState(null);
  const [showAddSlider, setShowAddSlider] = useState(false);

  const existingVariableNames = useMemo(
    () => new Set(variables.map((v) => v.name)),
    [variables]
  );

  const handleActivate = useCallback((id) => {
    setActiveId(id);
  }, []);

  const handleAddSlider = useCallback(
    (name, value) => {
      onAddVariable(name, value);
      setShowAddSlider(false);
    },
    [onAddVariable]
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 280,
        minWidth: 240,
        maxWidth: 320,
        background: 'rgb(var(--panel))',
        borderRight: '1px solid rgb(var(--border))',
        flexShrink: 0,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider flex-shrink-0"
        style={{
          color: 'rgb(var(--text) / 0.5)',
          borderBottom: '1px solid rgb(var(--border))',
        }}
      >
        Expressions
        <span
          className="text-xs normal-case font-normal tracking-normal"
          style={{ color: 'rgb(var(--text) / 0.35)' }}
        >
          {expressions.length}
        </span>
      </div>

      {/* ── Expression rows ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {expressions.length === 0 && (
          <div
            className="px-4 py-6 text-sm text-center"
            style={{ color: 'rgb(var(--text) / 0.4)' }}
          >
            No expressions yet.
            <br />
            Click &ldquo;+ Expression&rdquo; to start.
          </div>
        )}

        {expressions.map((expr) => (
          <ExpressionRow
            key={expr.id}
            expression={expr}
            isActive={activeId === expr.id}
            onActivate={() => handleActivate(expr.id)}
            onUpdate={onUpdateExpression}
            onDelete={onDeleteExpression}
          />
        ))}

        {/* ── Variables / sliders section ──────────────────────────────────── */}
        {variables.length > 0 && (
          <>
            <div
              className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{
                color: 'rgb(var(--text) / 0.5)',
                borderTop: '1px solid rgb(var(--border))',
                borderBottom: '1px solid rgb(var(--border))',
                background: 'rgb(var(--panel))',
              }}
            >
              Sliders
              <span
                className="text-xs normal-case font-normal tracking-normal"
                style={{ color: 'rgb(var(--text) / 0.35)' }}
              >
                {variables.length}
              </span>
            </div>

            {variables.map((v) => (
              <VariableSlider
                key={v.id}
                variable={v}
                animation={animations.find((a) => a.targetVariable === v.id)}
                onUpdate={onUpdateVariable}
                onDelete={onDeleteVariable}
                onToggleAnimation={onToggleAnimation}
                onSetAnimationMode={onSetAnimationMode}
                onSetAnimationSpeed={onSetAnimationSpeed}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Footer: add buttons ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{ borderTop: '1px solid rgb(var(--border))' }}
      >
        {showAddSlider && (
          <AddSliderDialog
            existingNames={existingVariableNames}
            onAdd={handleAddSlider}
            onCancel={() => setShowAddSlider(false)}
          />
        )}

        <div className="flex">
          <button
            onClick={onAddExpression}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors hover:bg-black/5 active:bg-black/10 focus:outline-none"
            style={{ color: 'rgb(var(--accent))' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Expression
          </button>
          <div style={{ width: 1, background: 'rgb(var(--border))' }} />
          <button
            onClick={() => setShowAddSlider((v) => !v)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors hover:bg-black/5 active:bg-black/10 focus:outline-none"
            style={{ color: 'rgb(var(--text) / 0.6)' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Slider
          </button>
        </div>
      </div>
    </div>
  );
}
