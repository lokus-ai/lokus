import React from 'react';
import { TextSelection } from 'prosemirror-state';
import { TRANSFORMS, getTransform, runTransform } from './transforms.js';
import { previewWriteBuffer } from './DiffPreview.js';
import AIWritePreviewBar from './AIWritePreviewBar.jsx';

/**
 * SelectionToolbar — the AI selection-transform surface (PRD §7).
 *
 * A floating toolbar shown above a non-empty text selection offering AI
 * transforms (rewrite / simplify / expand / tone / translate / grammar). Picking
 * one runs the transform over the selected text and stages the result through
 * the DiffPreview primitive (replaceSelection) — the user then Accepts/Rejects
 * via the preview bar before it lands. The model is never invoked until a
 * transform is explicitly chosen (no ambient cost).
 *
 * Self-contained and low-blast-radius: the parent renders it when a selection
 * exists and passes the live ProseMirror view + selection screen rect. It reads
 * the selected text from the view itself, so it stays correct as selection
 * changes.
 *
 * @param {object} props
 * @param {import('prosemirror-view').EditorView} props.view
 * @param {{ top: number, left: number }} props.position - screen coords (anchor)
 * @param {() => void} [props.onClose]
 */
export default function SelectionToolbar({ view, position, onClose }) {
  const [busy, setBusy] = React.useState(null); // active transform id while streaming
  const [staged, setStaged] = React.useState(false); // a preview is pending
  const [error, setError] = React.useState(null);
  const [argFor, setArgFor] = React.useState(null); // transform awaiting an arg
  const [argValue, setArgValue] = React.useState('');
  const abortRef = React.useRef(null);

  const selectedText = React.useMemo(() => {
    if (!view?.state) return '';
    const { from, to } = view.state.selection;
    return from === to ? '' : view.state.doc.textBetween(from, to, '\n');
  }, [view, view?.state?.selection]);

  const run = React.useCallback(async (id, arg) => {
    const t = getTransform(id);
    if (!t || !view) return;
    if (t.needsArg && arg == null) {
      setArgFor(id);
      setArgValue('');
      return;
    }
    setArgFor(null);
    setError(null);
    setBusy(id);

    // Capture the current selection range so we can stage a replaceSelection
    // even if focus shifts to the toolbar.
    const { from, to } = view.state.selection;
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const result = await runTransform(id, selectedText, { arg, signal: ac.signal });
      if (ac.signal.aborted) return;
      // Restore the selection, then stage the replacement as a pending preview.
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
      const ok = previewWriteBuffer(
        view,
        [{ type: 'replace', from, to, text: result }],
        { meta: { surface: 'selection', transform: id } },
      );
      if (ok) setStaged(true);
    } catch (err) {
      if (!ac.signal.aborted) setError(err?.message ?? 'Transform failed');
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  }, [view, selectedText]);

  const handleResolved = React.useCallback(() => {
    setStaged(false);
    onClose?.();
  }, [onClose]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const style = {
    position: 'fixed',
    top: Math.max(8, (position?.top ?? 0) - 44),
    left: position?.left ?? 0,
    zIndex: 50,
  };

  if (staged) {
    return (
      <div style={style}>
        <AIWritePreviewBar view={view} streaming={!!busy} label={`AI: ${busy ?? 'edit'}`} onResolved={handleResolved} />
      </div>
    );
  }

  return (
    <div
      style={style}
      className="lokus-ai-selection-toolbar flex flex-col gap-1 p-1 rounded-md border border-app-border bg-app-panel shadow-lg"
      role="toolbar"
      aria-label="AI text transforms"
    >
      {argFor ? (
        <form
          className="flex items-center gap-1 p-1"
          onSubmit={(e) => { e.preventDefault(); run(argFor, argValue); }}
        >
          <input
            autoFocus
            value={argValue}
            onChange={(e) => setArgValue(e.target.value)}
            placeholder={getTransform(argFor)?.argLabel ?? ''}
            className="text-xs px-2 py-1 rounded bg-app-bg border border-app-border text-app-text w-48"
            onKeyDown={(e) => { if (e.key === 'Escape') setArgFor(null); }}
          />
          <button type="submit" className="text-xs px-2 py-1 rounded bg-app-accent/15 hover:bg-app-accent/25">Go</button>
        </form>
      ) : (
        <div className="flex items-center gap-0.5">
          {TRANSFORMS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!!busy}
              onClick={() => run(t.id)}
              title={t.label}
              className="text-xs px-2 py-1 rounded hover:bg-app-accent/15 text-app-text disabled:opacity-50 whitespace-nowrap"
            >
              {busy === t.id ? '…' : t.label}
            </button>
          ))}
        </div>
      )}
      {error && <div className="text-[11px] text-app-danger px-2 pb-1">{error}</div>}
    </div>
  );
}
