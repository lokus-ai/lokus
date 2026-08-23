import { useEffect, useMemo, useState } from 'react';
import { GitMerge, Loader2, X } from 'lucide-react';
import { teamSyncClient } from '../core/team/TeamSyncClient';

export default function TeamConflictModal({
  isOpen,
  workspacePath,
  noteId,
  onClose,
}) {
  const [snapshots, setSnapshots] = useState([]);
  const [resolution, setResolution] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const byKind = useMemo(
    () => Object.fromEntries(snapshots.map((snapshot) => [snapshot.kind, snapshot])),
    [snapshots],
  );
  const recoverySnapshot = byKind.rejected ?? byKind.external ?? null;

  useEffect(() => {
    if (!isOpen || !noteId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    teamSyncClient.getConflict(workspacePath, noteId)
      .then((values) => {
        if (cancelled) return;
        setSnapshots(values);
        setResolution(
          values.find(({ kind }) => kind === 'local')?.content
            ?? values.find(({ kind }) => ['rejected', 'external'].includes(kind))?.content
            ?? values.find(({ kind }) => kind === 'remote')?.content
            ?? '',
        );
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError?.message || String(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, noteId, workspacePath]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, saving]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (recoverySnapshot) {
        await teamSyncClient.resolveRecovery(
          workspacePath,
          noteId,
          recoverySnapshot.kind,
          resolution,
        );
      } else {
        await teamSyncClient.resolveConflict(
          workspacePath,
          noteId,
          resolution,
        );
      }
      onClose?.();
    } catch (saveError) {
      setError(saveError?.message || String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close conflict dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => !saving && onClose?.()}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-conflict-title"
        className="relative flex max-h-[88vh] w-[min(900px,96vw)] flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 px-5 py-4">
          <div className="rounded-lg bg-amber-500/12 p-2 text-amber-500">
            <GitMerge className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="team-conflict-title" className="text-base font-semibold text-[var(--text-primary)]">
              {recoverySnapshot ? 'Recover local work' : 'Resolve sync conflict'}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {recoverySnapshot
                ? 'A local change could not be applied automatically. Its complete text is preserved here.'
                : 'Your edit and the team edit started from the same saved version.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-52 items-center justify-center text-[var(--text-secondary)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading saved versions…
            </div>
          ) : (
            <>
              {!recoverySnapshot && (
                <div className="mb-3 text-center">
                  <span className="inline-flex rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    Common base
                  </span>
                </div>
              )}
              <div className={`relative grid gap-3 ${recoverySnapshot ? '' : 'md:grid-cols-2'}`}>
                {recoverySnapshot ? (
                  <BranchCard
                    title={recoverySnapshot.kind === 'rejected' ? 'Rejected offline edit' : 'External edit'}
                    content={recoverySnapshot.content}
                    tone="blue"
                    actionLabel="Use recovered version"
                    onUse={() => setResolution(recoverySnapshot.content)}
                  />
                ) : (
                  <>
                    <BranchCard
                      title="Your version"
                      content={byKind.local?.content ?? ''}
                      tone="blue"
                      actionLabel="Use your version"
                      onUse={() => setResolution(byKind.local?.content ?? '')}
                    />
                    <BranchCard
                      title="Team version"
                      content={byKind.remote?.content ?? ''}
                      tone="violet"
                      actionLabel="Use team version"
                      onUse={() => setResolution(byKind.remote?.content ?? '')}
                    />
                  </>
                )}
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                  Resolution
                </span>
                <textarea
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  spellCheck={false}
                  className="min-h-56 w-full resize-y rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-3 font-mono text-sm leading-6 text-[var(--text-primary)] outline-none transition-colors focus:border-blue-500"
                />
              </label>
              {!recoverySnapshot && byKind.base && (
                <details className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/45 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--text-secondary)]">
                    View common base
                  </summary>
                  <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-[var(--text-tertiary)]">
                    {byKind.base.content}
                  </pre>
                </details>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-500">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            Decide later
          </button>
          <button
            type="button"
            disabled={loading || saving || !snapshots.length}
            onClick={handleSave}
            className="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {recoverySnapshot ? 'Apply recovered version' : 'Save resolution'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function BranchCard({ title, content, tone, actionLabel, onUse }) {
  const border = tone === 'blue' ? 'border-blue-500/35' : 'border-violet-500/35';
  const dot = tone === 'blue' ? 'bg-blue-500' : 'bg-violet-500';
  return (
    <article className={`overflow-hidden rounded-lg border ${border} bg-[var(--bg-secondary)]`}>
      <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {title}
        </span>
        <button
          type="button"
          onClick={onUse}
          className="rounded-md px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          {actionLabel}
        </button>
      </div>
      <pre className="max-h-44 min-h-32 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-[var(--text-secondary)]">
        {content}
      </pre>
    </article>
  );
}
