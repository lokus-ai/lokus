import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Eye,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../core/auth/AuthContext';
import { teamControlClient } from '../core/team/TeamControlClient';
import { teamSyncClient } from '../core/team/TeamSyncClient';

export default function TeamShareModal({
  isOpen,
  workspacePath,
  path,
  onClose,
}) {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [selection, setSelection] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const destinationRef = useRef(null);
  const previousFocusRef = useRef(null);

  const choices = useMemo(
    () => teams.flatMap((team) => (team.spaces ?? [])
      .filter(isWritableDestination)
      .map((space) => ({
        value: `${team.id}:${space.id}`,
        team,
        space,
      }))),
    [teams],
  );
  const readableSpaceCount = useMemo(
    () => teams.reduce((count, team) => count + (team.spaces?.length ?? 0), 0),
    [teams],
  );
  const pendingWritableSpaceCount = useMemo(
    () => teams.reduce(
      (count, team) => count + (team.spaces ?? []).filter(
        (space) => space.can_write === true && space.key_pending === true,
      ).length,
      0,
    ),
    [teams],
  );
  const selectedChoice = useMemo(
    () => choices.find(({ value }) => value === selection) ?? null,
    [choices, selection],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setActionError('');

    if (!user?.id) {
      setTeams([]);
      setSelection('');
      setLoadError('Sign in to see the team spaces available to you.');
      setLoading(false);
      return undefined;
    }

    teamControlClient.initialize(user.id)
      .then(() => teamControlClient.listTeams(user.id))
      .then((values) => {
        if (cancelled) return;
        const active = values.filter((team) => {
          const status = team.membership?.status ?? team.status;
          return !status || ['active', 'key_pending'].includes(status);
        });
        const writableValues = active.flatMap((team) => (team.spaces ?? [])
          .filter(isWritableDestination)
          .map((space) => `${team.id}:${space.id}`));
        setTeams(active);
        setSelection((current) => (
          writableValues.includes(current) ? current : writableValues[0] ?? ''
        ));
      })
      .catch((error) => {
        if (cancelled) return;
        setTeams([]);
        setSelection('');
        setLoadError(error?.message || String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadKey, user?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      const previous = previousFocusRef.current;
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !loading && choices.length) destinationRef.current?.focus();
  }, [choices.length, isOpen, loading]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !sharing) {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, sharing]);

  if (!isOpen) return null;

  const share = async () => {
    const choice = selectedChoice;
    if (!choice || !path) return;
    setSharing(true);
    setActionError('');
    try {
      const identity = await invoke('get_note_identity', {
        workspacePath,
        path,
      });
      if (identity.scope_kind === 'team') {
        const currentTeam = teams.find((team) => (
          team.spaces?.some(({ id }) => id === identity.scope_id)
        ));
        if (!currentTeam || currentTeam.id !== choice.team.id) {
          throw new Error('cross-team moves are not supported');
        }
        if (identity.scope_id !== choice.space.id) {
          await teamSyncClient.moveNoteToSpace({
            workspacePath,
            path,
            teamId: choice.team.id,
            targetSpaceId: choice.space.id,
            permissionEpoch: choice.team.current_permission_epoch,
            keyEpoch: choice.space.current_key_epoch,
          });
        }
      } else {
        await teamSyncClient.shareNote({
          workspacePath,
          path,
          teamId: choice.team.id,
          spaceId: choice.space.id,
          permissionEpoch: choice.team.current_permission_epoch,
          keyEpoch: choice.space.current_key_epoch,
        });
      }
      toast.success(`Shared with ${choice.team.name || choice.team.id} · ${choice.space.name || choice.space.id}`);
      onClose?.();
    } catch (error) {
      const message = error?.message || String(error);
      setActionError(message);
      toast.error(`Could not share note: ${message}`);
    } finally {
      setSharing(false);
    }
  };

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter((element) => !element.hasAttribute('hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const noteName = path?.split(/[/\\]/).pop() || 'Current note';

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close share dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => !sharing && onClose?.()}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-share-title"
        aria-describedby="team-share-description"
        onKeyDown={trapFocus}
        className="relative flex max-h-[88vh] w-[min(520px,94vw)] flex-col overflow-hidden rounded-xl border border-app-border bg-app-bg shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-app-border bg-app-panel px-5 py-4">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="team-share-title" className="font-semibold text-app-text">Share note with a team</h2>
            <p className="mt-0.5 truncate text-xs text-app-muted">{noteName}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close"
            disabled={sharing}
            onClick={onClose}
            className="rounded-md p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          <div id="team-share-description" className="mb-5 flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <span className="mt-0.5 rounded-full bg-blue-500/10 p-1.5 text-blue-500">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-app-text">Local-first, end-to-end encrypted</p>
              <p className="mt-1 text-xs leading-5 text-app-muted">
                The note stays in your local workspace. Lokus shares encrypted revisions with the selected team space.
              </p>
            </div>
          </div>

          {loading ? (
            <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-2 text-sm text-app-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading spaces…
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/5 p-4">
              <p className="text-sm font-medium text-red-500">Team spaces could not be loaded</p>
              <p className="mt-1 text-xs leading-5 text-app-muted">{loadError}</p>
              {user?.id && (
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-3 inline-flex items-center rounded-md border border-app-border bg-app-panel px-3 py-2 text-sm font-medium text-app-text hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              )}
            </div>
          ) : choices.length ? (
            <div>
              <label htmlFor="team-share-destination" className="mb-1.5 block text-xs font-medium text-app-muted">
                Destination
              </label>
              <select
                ref={destinationRef}
                id="team-share-destination"
                value={selection}
                disabled={sharing}
                onChange={(event) => {
                  setSelection(event.target.value);
                  setActionError('');
                }}
                className="w-full rounded-md border border-app-border bg-app-panel px-3 py-2.5 text-sm text-app-text outline-none transition-colors focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:opacity-50"
              >
                {teams.map((team) => {
                  const writableSpaces = (team.spaces ?? []).filter(isWritableDestination);
                  if (!writableSpaces.length) return null;
                  return (
                    <optgroup key={team.id} label={team.name || team.id}>
                      {writableSpaces.map((space) => (
                        <option key={space.id} value={`${team.id}:${space.id}`}>
                          {space.name || space.id} · Editor access
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>

              {selectedChoice && (
                <div className="mt-3 rounded-lg border border-app-border bg-app-panel/60 p-3">
                  <div className="flex items-start gap-3">
                    <span className="rounded-md bg-blue-500/10 p-2 text-blue-500">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-app-text">
                        {selectedChoice.space.name || selectedChoice.space.id}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-app-muted">
                        {selectedChoice.team.name || selectedChoice.team.id}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-500">
                      Can edit
                    </span>
                  </div>
                  <p className="mt-3 border-t border-app-border/60 pt-3 text-xs leading-5 text-app-muted">
                    Team members with access to this space can decrypt the note. Editors can update it.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-app-border bg-app-panel/50 p-4">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-app-bg text-app-muted">
                <Eye className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-app-text">
                {pendingWritableSpaceCount
                  ? 'Encryption keys are still being prepared'
                  : readableSpaceCount ? 'No writable team spaces' : 'No team spaces available'}
              </p>
              <p className="mt-1 text-xs leading-5 text-app-muted">
                {pendingWritableSpaceCount
                  ? `You have Editor access to ${pendingWritableSpaceCount} space${pendingWritableSpaceCount === 1 ? '' : 's'}, but this device is still waiting for encryption keys. Ask a team admin to provision them.`
                  : readableSpaceCount
                  ? `You can view ${readableSpaceCount} team space${readableSpaceCount === 1 ? '' : 's'}, but sharing requires Editor access. Ask a team admin to update your space access.`
                  : teams.length
                    ? 'Your active teams do not have a readable note space yet. Ask a team admin for access.'
                    : 'Create or join a team in Settings → Teams, then ask for Editor access to a note space.'}
              </p>
            </div>
          )}

          {actionError && (
            <p role="alert" className="mt-3 rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-500">
              Could not share this note: {actionError}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-app-border bg-app-panel/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sharing}
            className="rounded-md px-3 py-2 text-sm text-app-muted transition-colors hover:bg-app-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={share}
            disabled={!selection || loading || sharing}
            className="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sharing && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {sharing ? 'Sharing securely…' : 'Share note'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function isWritableDestination(space) {
  return space.can_write === true && space.key_pending !== true;
}
