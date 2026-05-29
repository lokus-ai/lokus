import React from 'react';
import { Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import { actionRegistry } from '../../core/ai/ActionRegistry.js';
import { route } from './IntentRouter.js';
import { streamText, runToolLoop, AIClientError } from './aiClient.js';
import { buildActionContext } from './actionContext.js';
import { previewWriteBuffer } from './DiffPreview.js';
import AIWritePreviewBar from './AIWritePreviewBar.jsx';

/**
 * AICmdK — the PRIMARY Cmd-K natural-language surface (PRD §7 / §6).
 *
 * The user types an instruction; IntentRouter resolves it (Tier 0 local fuzzy →
 * Tier 1 keyword → Tier 2 model). The panel then:
 *   - action  → actionRegistry.execute (writes are staged via DiffPreview)
 *   - ask     → single-shot streamed answer (shown inline)
 *   - agent / open_ended → client-side ReAct loop (runToolLoop), one diff at end
 *
 * Provider/credit errors render inline (e.g. PROVIDER_UNAVAILABLE while the
 * providers stream finishes, or INSUFFICIENT_CREDITS) rather than throwing.
 *
 * Self-contained dialog: the parent toggles `open`. It uses the merged engine's
 * `actionRegistry` singleton and the live editor view (for staging writes).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {import('prosemirror-view').EditorView} [props.view] - for staged writes
 * @param {object} [props.registry] - defaults to the actionRegistry singleton
 * @param {string} [props.initialQuery] - prefilled instruction (from slash/palette)
 */
export default function AICmdK({ open, onOpenChange, view, registry = actionRegistry, initialQuery = '' }) {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle|routing|running|done|error
  const [answer, setAnswer] = React.useState('');
  const [error, setError] = React.useState(null);
  const [staged, setStaged] = React.useState(false);
  const abortRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const reset = React.useCallback(() => {
    setStatus('idle');
    setAnswer('');
    setError(null);
    setStaged(false);
  }, []);

  React.useEffect(() => {
    if (open) {
      reset();
      setQuery(initialQuery ?? '');
      // focus shortly after mount
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
    abortRef.current?.abort();
    return undefined;
  }, [open, reset, initialQuery]);

  const stageWrites = React.useCallback((writeBuffer) => {
    if (!view || !Array.isArray(writeBuffer) || writeBuffer.length === 0) return false;
    // Map action results / write ops into DiffPreview ops.
    const ops = writeBuffer
      .map((w) => {
        if (w.type === 'insert') return { type: 'insert', text: w.content ?? w.text ?? '' };
        if (w.type === 'replace') return { type: 'replace', from: w.targetRange?.from ?? w.from, to: w.targetRange?.to ?? w.to, text: w.content ?? w.text ?? '' };
        if (w.type === 'diff') return { type: 'replaceSelection', text: w.diff?.after ?? w.content ?? '' };
        return null;
      })
      .filter(Boolean);
    const ok = previewWriteBuffer(view, ops, { meta: { surface: 'cmdK' } });
    if (ok) setStaged(true);
    return ok;
  }, [view]);

  const submit = React.useCallback(async () => {
    const q = query.trim();
    if (!q || status === 'routing' || status === 'running') return;
    setError(null);
    setAnswer('');
    setStaged(false);
    setStatus('routing');

    const ac = new AbortController();
    abortRef.current = ac;
    const ctx = buildActionContext({ surface: 'cmdK', signal: ac.signal });

    try {
      const intent = await route(q, { registry });
      if (ac.signal.aborted) return;
      setStatus('running');

      if (intent.type === 'action' || intent.type === 'tool_use') {
        const result = await registry.execute(intent.actionId, intent.params ?? {}, ctx);
        if (result?.type === 'text') setAnswer(result.content ?? '');
        else if (result) stageWrites([result]);
        setStatus('done');
      } else if (intent.type === 'ask') {
        const text = await streamText(intent.query ?? q, { surface: 'cmdK', signal: ac.signal }, (_d, full) => setAnswer(full));
        setAnswer(text);
        setStatus('done');
      } else if (intent.type === 'plan') {
        // Run each planned action; buffer any writes into one diff.
        const writeBuffer = [];
        for (const step of intent.steps) {
          const r = await registry.execute(step.actionId, step.params ?? {}, ctx);
          if (r && (r.type === 'diff' || r.type === 'insert' || r.type === 'replace')) writeBuffer.push(r);
          if (ac.signal.aborted) return;
        }
        if (writeBuffer.length) stageWrites(writeBuffer);
        setStatus('done');
      } else if (intent.type === 'agent' || intent.type === 'open_ended') {
        const tools = registry.toToolSchema({ provider: 'anthropic', surface: 'agent' });
        const res = await runToolLoop({
          query: intent.query ?? q,
          options: { surface: 'agent', tools, signal: ac.signal },
          registry,
          context: ctx,
          ui: { onThought: (_d, full) => setAnswer(full) },
        });
        setAnswer(res.answer || '');
        if (res.writeBuffer?.length) stageWrites(res.writeBuffer);
        setStatus('done');
      } else {
        setError('No matching action.');
        setStatus('error');
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      const code = err instanceof AIClientError ? err.code : null;
      setError(
        code === 'PROVIDER_UNAVAILABLE'
          ? 'AI is still starting up. Try again in a moment.'
          : code === 'INSUFFICIENT_CREDITS'
            ? 'Out of credits.'
            : (err?.message ?? 'Something went wrong.'),
      );
      setStatus('error');
    }
  }, [query, status, registry, stageWrites]);

  if (!open) return null;

  const busy = status === 'routing' || status === 'running';

  return (
    <div
      className="lokus-ai-cmdk-overlay fixed inset-0 z-[60] flex items-start justify-center pt-[18vh] bg-black/30 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div className="lokus-ai-cmdk w-[640px] max-w-[90vw] rounded-lg border border-app-border bg-app-panel shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-app-border">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-app-accent" /> : <Sparkles className="h-4 w-4 text-app-accent" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
              if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); }
            }}
            placeholder="Ask AI or type an instruction…"
            className="flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-app-muted"
          />
          <kbd className="text-[10px] text-app-muted flex items-center gap-0.5"><CornerDownLeft className="h-3 w-3" />run</kbd>
        </div>

        {(answer || error) && (
          <div className="px-4 py-3 max-h-[40vh] overflow-y-auto text-sm whitespace-pre-wrap">
            {error
              ? <span className="text-app-danger">{error}</span>
              : <span className="text-app-text">{answer}</span>}
          </div>
        )}

        {staged && view && (
          <div className="px-3 py-2 border-t border-app-border">
            <AIWritePreviewBar view={view} label="AI edit" onResolved={() => { setStaged(false); onOpenChange(false); }} />
          </div>
        )}

        {!answer && !error && !staged && (
          <div className="px-4 py-3 text-xs text-app-muted">
            Try “summarize this note”, “rewrite formally”, or “what did I write about pricing?”
          </div>
        )}
      </div>
    </div>
  );
}
