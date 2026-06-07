import React from 'react';
import { TextSelection } from 'prosemirror-state';
import AICmdK from './AICmdK.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import AIWritePreviewBar from './AIWritePreviewBar.jsx';
import { getTransform, runTransform } from './transforms.js';
import { previewWriteBuffer, hasPendingPreview } from './DiffPreview.js';
import '../styles/ai-surfaces.css';

/**
 * AISurfaces — the single React mount point for the editor AI surfaces.
 *
 * Mounted ONCE by Editor.jsx with the live ProseMirror view. It owns the
 * window-event wiring so the rest of the editor (slash /ai, context menu, Cmd-K
 * palette) stays decoupled — they just dispatch events:
 *
 *   'lokus:open-ai-cmdk'  detail:{ view?, query? }   → open the Cmd-K AI panel
 *   'lokus:ai-transform'  detail:{ view?, transformId } → run a selection transform
 *
 * Keeping all the React state here means Editor.jsx needs only a one-line mount,
 * which keeps the blast radius on that large shared file minimal.
 *
 * @param {object} props
 * @param {import('prosemirror-view').EditorView} [props.view] - the live editor view
 */
export default function AISurfaces({ view }) {
  const [cmdkOpen, setCmdkOpen] = React.useState(false);
  const [cmdkQuery, setCmdkQuery] = React.useState('');
  const [transform, setTransform] = React.useState(null); // { id, from, to, busy, result, error }
  const abortRef = React.useRef(null);

  // The view passed in props is the most current; some events also carry one.
  const resolveView = React.useCallback((evView) => evView ?? view, [view]);

  // --- Cmd-K open via slash /ai, context menu "Ask AI", or palette ----------
  React.useEffect(() => {
    const onOpen = (e) => {
      setCmdkQuery(e.detail?.query ?? '');
      setCmdkOpen(true);
    };
    window.addEventListener('lokus:open-ai-cmdk', onOpen);
    return () => window.removeEventListener('lokus:open-ai-cmdk', onOpen);
  }, []);

  // --- Selection transform via context menu "AI Transform" ------------------
  const runSelectionTransform = React.useCallback(async (evView, transformId) => {
    const v = resolveView(evView);
    const t = getTransform(transformId);
    if (!v?.state || !t) return;
    const { from, to } = v.state.selection;
    if (from === to) return; // nothing selected
    const text = v.state.doc.textBetween(from, to, '\n');

    // tone/translate need an argument; prompt minimally via window.prompt to stay
    // dependency-free (the toolbar offers a nicer inline input).
    let arg;
    if (t.needsArg) {
      arg = typeof window !== 'undefined' && window.prompt ? window.prompt(t.argLabel) : undefined;
      if (arg == null) return; // cancelled
    }

    const ac = new AbortController();
    abortRef.current = ac;
    setTransform({ id: transformId, from, to, busy: true, error: null });
    try {
      const result = await runTransform(transformId, text, { arg, signal: ac.signal });
      if (ac.signal.aborted) return;
      v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, from, to)));
      previewWriteBuffer(v, [{ type: 'replace', from, to, text: result }], {
        meta: { surface: 'selection', transform: transformId },
      });
      setTransform({ id: transformId, busy: false, staged: true });
    } catch (err) {
      if (!ac.signal.aborted) setTransform({ id: transformId, busy: false, error: err?.message ?? 'Transform failed' });
    } finally {
      abortRef.current = null;
    }
  }, [resolveView]);

  React.useEffect(() => {
    const onTransform = (e) => runSelectionTransform(e.detail?.view, e.detail?.transformId);
    window.addEventListener('lokus:ai-transform', onTransform);
    return () => window.removeEventListener('lokus:ai-transform', onTransform);
  }, [runSelectionTransform]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <>
      <AICmdK open={cmdkOpen} onOpenChange={setCmdkOpen} view={view} initialQuery={cmdkQuery} />

      {/* Transform preview bar — shown bottom-center while a transform is staged. */}
      {transform && (transform.staged || transform.busy || transform.error) && view && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55]">
          {transform.error ? (
            <div className="px-3 py-2 rounded-md border border-app-border bg-app-panel text-xs text-app-danger shadow-lg">
              {transform.error}
            </div>
          ) : (
            <AIWritePreviewBar
              view={view}
              streaming={!!transform.busy}
              label={`AI: ${getTransform(transform.id)?.label ?? 'edit'}`}
              onResolved={() => setTransform(null)}
            />
          )}
        </div>
      )}
    </>
  );
}
