import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { acceptPreview, rejectPreview } from './DiffPreview.js';

/**
 * AIWritePreviewBar — the confirm bar shown while an AI write is staged via the
 * DiffPreview primitive (PRD §9.1: diff-preview → confirm → undo).
 *
 * Presentational: the parent owns visibility (it knows when a preview is
 * pending) and passes the live ProseMirror view. Accept commits the staged
 * content; Reject undoes it via prosemirror-history. Both delegate to the
 * DiffPreview primitive (which also writes the audit line).
 *
 * @param {object} props
 * @param {import('prosemirror-view').EditorView} props.view
 * @param {boolean} [props.streaming] - true while the model is still producing
 * @param {string} [props.label] - context label, e.g. "Rewrite"
 * @param {() => void} [props.onResolved] - called after accept/reject
 */
export default function AIWritePreviewBar({ view, streaming = false, label = 'AI edit', onResolved }) {
  const handleAccept = React.useCallback(() => {
    if (view) acceptPreview(view);
    onResolved?.('accepted');
  }, [view, onResolved]);

  const handleReject = React.useCallback(() => {
    if (view) rejectPreview(view);
    onResolved?.('rejected');
  }, [view, onResolved]);

  return (
    <div
      className="lokus-ai-preview-bar flex items-center gap-2 px-3 py-2 rounded-md border border-app-border bg-app-panel shadow-lg"
      role="group"
      aria-label="AI edit preview"
    >
      <span className="text-xs text-app-muted mr-1 flex items-center gap-1">
        {streaming && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {label}
      </span>
      <button
        type="button"
        onClick={handleAccept}
        disabled={streaming}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-app-accent/15 text-app-text hover:bg-app-accent/25 disabled:opacity-50"
      >
        <Check className="h-3 w-3" aria-hidden="true" />
        Accept
        <kbd className="ml-1 text-[10px] text-app-muted">⏎</kbd>
      </button>
      <button
        type="button"
        onClick={handleReject}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-app-danger/15 text-app-muted hover:text-app-text"
      >
        <X className="h-3 w-3" aria-hidden="true" />
        Reject
        <kbd className="ml-1 text-[10px] text-app-muted">esc</kbd>
      </button>
    </div>
  );
}
