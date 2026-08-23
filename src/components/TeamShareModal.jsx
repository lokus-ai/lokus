import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Users, X } from 'lucide-react';
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
  const choices = useMemo(
    () => teams.flatMap((team) => team.spaces.map((space, index) => ({
      value: `${team.id}:${space.id}`,
      team,
      space,
      label: `${team.name} · ${index === 0 ? 'General' : `Space ${index + 1}`}`,
    }))),
    [teams],
  );

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    teamControlClient.initialize(user.id)
      .then(() => teamControlClient.listTeams(user.id))
      .then((values) => {
        if (cancelled) return;
        const active = values.filter(({ membership }) => membership.status === 'active');
        setTeams(active);
        setSelection((current) => current || active.flatMap(({ id, spaces }) => (
          spaces.map((space) => `${id}:${space.id}`)
        ))[0] || '');
      })
      .catch((error) => toast.error(`Could not load team spaces: ${error?.message || error}`))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const share = async () => {
    const choice = choices.find(({ value }) => value === selection);
    if (!choice || !path) return;
    setSharing(true);
    try {
      const identity = await invoke('get_note_identity', {
        workspacePath,
        path,
      });
      if (identity.scope_kind === 'team') {
        const currentTeam = teams.find((team) => (
          team.spaces.some(({ id }) => id === identity.scope_id)
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
      toast.success('Team sync enabled for this note');
      onClose?.();
    } catch (error) {
      toast.error(`Could not share note: ${error?.message || error}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close share dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => !sharing && onClose?.()}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-share-title"
        className="relative w-[min(480px,94vw)] overflow-hidden rounded-xl border border-app-border bg-app-bg shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-app-border bg-app-panel px-5 py-4">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="team-share-title" className="font-semibold text-app-text">Share with a team</h2>
            <p className="mt-0.5 truncate text-xs text-app-muted">{path?.split(/[/\\]/).pop()}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1.5 text-app-muted hover:bg-app-hover">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-app-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading spaces…
            </div>
          ) : choices.length ? (
            <select
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              className="w-full rounded-md border border-app-border bg-app-panel px-3 py-2 text-sm text-app-text outline-none focus:border-blue-500"
            >
              {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-app-muted">Create or join a team in Settings → Teams first.</p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-app-border bg-app-panel/60 px-5 py-4">
          <button type="button" onClick={onClose} disabled={sharing} className="rounded-md px-3 py-2 text-sm text-app-muted hover:bg-app-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={share}
            disabled={!selection || loading || sharing}
            className="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {sharing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Share note
          </button>
        </footer>
      </section>
    </div>
  );
}
