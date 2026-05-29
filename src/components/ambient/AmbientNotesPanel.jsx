/**
 * AmbientNotesPanel — the "Connected notes" resurfacing surface (PRD §5.3).
 *
 * As the user opens / writes a note, this panel hands back 3–5 related notes from the
 * wiki-link graph (Layer A: zero LLM, zero network, $0, offline). Clicking a card
 * dispatches `lokus:navigate:note` so the host can open it. When local semantic
 * resurfacing ships (Layer B), this same panel merges those results via the
 * `lokus:semantic-notes-updated` event — no structural change needed here.
 *
 * Self-contained and integrator-mountable: the wave-3 integrator mounts it in
 * Workspace.jsx and feeds it `workspacePath` + the active note's `noteName` (or
 * `notePath`). It owns its own data fetch via ResurfacingProvider and never throws —
 * a missing graph index degrades to a friendly empty state.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link2, ArrowRight, ArrowLeft, Loader2, Network } from 'lucide-react';
import ResurfacingProvider, { DEFAULT_LIMIT } from './ResurfacingProvider.js';

/** Strip a path/extension down to a display note name (matches graph normalization input). */
function toNoteName(noteName, notePath) {
  if (noteName) return noteName;
  if (!notePath) return '';
  return notePath.split(/[\\/]/).pop()?.replace(/\.md$/i, '') ?? '';
}

/**
 * @param {Object} props
 * @param {string} props.workspacePath  absolute workspace path (e.g. window.__WORKSPACE_PATH__)
 * @param {string} [props.noteName]     active note display name (preferred)
 * @param {string} [props.notePath]     active note path (used to derive a name if noteName absent)
 * @param {number} [props.limit=5]      max cards (PRD: 3–5)
 * @param {(note: Object) => void} [props.onNavigate]  override the default navigate behavior
 * @param {string} [props.className]
 */
export default function AmbientNotesPanel({
  workspacePath,
  noteName,
  notePath,
  limit = DEFAULT_LIMIT,
  onNavigate,
  className = '',
}) {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const providerRef = useRef(null);

  const activeName = toNoteName(noteName, notePath);

  // One provider per workspace; recreate only when the workspace changes.
  useEffect(() => {
    providerRef.current = workspacePath ? new ResurfacingProvider(workspacePath) : null;
  }, [workspacePath]);

  // Fetch Layer-A graph neighbors whenever the active note (or workspace) changes.
  useEffect(() => {
    let cancelled = false;
    const provider = providerRef.current;

    if (!provider || !activeName) {
      setNotes([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    provider
      .resurface(activeName, { limit })
      .then((related) => {
        if (cancelled) return;
        setNotes(related);
        setStatus('ready');
      })
      .catch(() => {
        // resurface() already swallows scorer failures; this is a final safety net.
        if (cancelled) return;
        setNotes([]);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [workspacePath, activeName, limit]);

  // Layer B seam: merge semantic results pushed by the (future) embedding pipeline.
  // Until that ships, no event fires and this is inert.
  useEffect(() => {
    const onSemantic = (e) => {
      const incoming = e?.detail?.notes;
      if (!Array.isArray(incoming) || !incoming.length) return;
      setNotes((prev) =>
        ResurfacingProvider.merge([...prev, ...incoming], activeName, limit),
      );
      setStatus('ready');
    };
    window.addEventListener('lokus:semantic-notes-updated', onSemantic);
    return () => window.removeEventListener('lokus:semantic-notes-updated', onSemantic);
  }, [activeName, limit]);

  const handleOpen = useCallback(
    (note) => {
      if (onNavigate) {
        onNavigate(note);
        return;
      }
      window.dispatchEvent(
        new CustomEvent('lokus:navigate:note', {
          detail: { id: note.id, name: note.name, path: note.path },
        }),
      );
    },
    [onNavigate],
  );

  return (
    <div
      className={`flex flex-col gap-2 p-3 text-sm ${className}`}
      data-testid="ambient-notes-panel"
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-app-muted">
        <Network size={13} />
        <span>Connected notes</span>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 py-2 text-app-muted" data-testid="ambient-loading">
          <Loader2 size={14} className="animate-spin" />
          <span>Finding related notes…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="py-2 text-app-muted" data-testid="ambient-error">
          Couldn&apos;t load the note graph.
        </div>
      )}

      {(status === 'ready' || status === 'idle') && notes.length === 0 && (
        <div className="py-2 text-app-muted" data-testid="ambient-empty">
          {activeName
            ? 'No connected notes yet. Link this note with [[wiki-links]] to see related notes here.'
            : 'Open a note to see its connections.'}
        </div>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="ambient-list">
          {notes.map((note) => (
            <li key={note.id || note.name}>
              <button
                type="button"
                onClick={() => handleOpen(note)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-app-hover focus:bg-app-hover focus:outline-none"
                title={note.path || note.name}
              >
                <DirectionIcon direction={note.direction} />
                <span className="flex-1 truncate text-app-text group-hover:text-app-accent">
                  {note.name}
                </span>
                {typeof note.connections === 'number' && (
                  <span className="shrink-0 text-xs text-app-muted">
                    {note.connections} {note.connections === 1 ? 'link' : 'links'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Small leading glyph showing how the neighbor connects (incoming ← / outgoing →). */
function DirectionIcon({ direction }) {
  const common = 'shrink-0 text-app-muted';
  if (direction === 'outgoing') {
    return <ArrowRight size={14} className={common} aria-label="links out to" />;
  }
  if (direction === 'incoming') {
    return <ArrowLeft size={14} className={common} aria-label="links in from" />;
  }
  // Semantic / unknown-direction neighbor (Layer B) — generic link glyph.
  return <Link2 size={14} className={common} aria-label="related" />;
}
