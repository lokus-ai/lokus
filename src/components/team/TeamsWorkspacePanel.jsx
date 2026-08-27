import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  KeyRound,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import { teamControlClient } from '../../core/team/TeamControlClient';
import { getFilename, joinPath } from '../../utils/pathUtils';

export default function TeamsWorkspacePanel({
  workspacePath,
  onFileOpen,
}) {
  const { isAuthenticated, isGuest, user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [notes, setNotes] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!workspacePath || !isAuthenticated || isGuest || !user?.id) {
      setTeams([]);
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await teamControlClient.initialize(user.id);
      const [nextTeams, relativePaths] = await Promise.all([
        teamControlClient.listTeams(user.id),
        invoke('get_team_note_paths', { workspacePath }),
      ]);
      const nextNotes = (await Promise.all((relativePaths ?? []).map(async (relativePath) => {
        const path = joinPath(workspacePath, relativePath);
        try {
          const identity = await invoke('get_note_identity', {
            workspacePath,
            path,
          });
          return {
            noteId: identity.note_id,
            spaceId: identity.scope_id,
            relativePath,
            path,
          };
        } catch {
          return null;
        }
      }))).filter(Boolean);

      setTeams(nextTeams);
      setNotes(nextNotes);
      setExpanded((current) => {
        if (Object.keys(current).length) return current;
        const firstTeam = nextTeams[0];
        const firstSpace = firstTeam?.spaces?.[0];
        return {
          ...(firstTeam ? { [`team:${firstTeam.id}`]: true } : {}),
          ...(firstSpace ? { [`space:${firstSpace.id}`]: true } : {}),
        };
      });
    } catch (loadError) {
      setError(loadError?.message || String(loadError));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest, user?.id, workspacePath]);

  useEffect(() => {
    refresh();
    const handleRefresh = (event) => {
      if (!event?.detail?.workspacePath || event.detail.workspacePath === workspacePath) {
        refresh();
      }
    };
    window.addEventListener('lokus:note-foundation-ready', handleRefresh);
    window.addEventListener('lokus:team-note-promoted', handleRefresh);
    window.addEventListener('lokus:team-note-applied', handleRefresh);
    return () => {
      window.removeEventListener('lokus:note-foundation-ready', handleRefresh);
      window.removeEventListener('lokus:team-note-promoted', handleRefresh);
      window.removeEventListener('lokus:team-note-applied', handleRefresh);
    };
  }, [refresh, workspacePath]);

  const notesBySpace = useMemo(() => {
    const grouped = new Map();
    for (const note of notes) {
      if (!grouped.has(note.spaceId)) grouped.set(note.spaceId, []);
      grouped.get(note.spaceId).push(note);
    }
    for (const entries of grouped.values()) {
      entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    }
    return grouped;
  }, [notes]);

  const openSettings = () => invoke('open_preferences_window', {
    workspacePath,
    section: 'Teams',
  });

  if (!isAuthenticated || isGuest || !user?.id) {
    return (
      <PanelMessage
        icon={Users}
        title="Sign in to use Teams"
        body="Team spaces use your account to authorize encrypted notes and member access."
        actionLabel="Open account settings"
        onAction={() => invoke('open_preferences_window', {
          workspacePath,
          section: 'Account',
        })}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 px-5 text-sm text-app-muted" role="status">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading team spaces…
      </div>
    );
  }

  if (error) {
    return (
      <PanelMessage
        icon={Users}
        title="Teams could not be loaded"
        body={error}
        actionLabel="Try again"
        onAction={refresh}
      />
    );
  }

  if (!teams.length) {
    return (
      <PanelMessage
        icon={Users}
        title="Create your first team"
        body="Invite people, choose the spaces they can access, and keep shared notes as ordinary local files."
        actionLabel="Set up Teams"
        onAction={openSettings}
      />
    );
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-app-border bg-app-panel">
      <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-app-border px-3">
        <Users className="h-4 w-4 text-app-muted" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-app-text">
          Teams
        </h2>
        <button
          type="button"
          className="obsidian-button icon-only small"
          title="Refresh teams"
          aria-label="Refresh teams"
          onClick={refresh}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="obsidian-button icon-only small"
          title="Team settings"
          aria-label="Open team settings"
          onClick={openSettings}
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {teams.map((team) => {
          const teamKey = `team:${team.id}`;
          const teamOpen = expanded[teamKey] !== false;
          return (
            <section key={team.id} className="mb-2">
              <TreeButton
                expanded={teamOpen}
                label={team.name || team.id}
                meta={team.membership?.role}
                onClick={() => setExpanded((current) => ({
                  ...current,
                  [teamKey]: !teamOpen,
                }))}
              />
              {teamOpen && (
                <div className="ml-2 border-l border-app-border pl-1">
                  {(team.spaces ?? []).map((space) => {
                    const spaceKey = `space:${space.id}`;
                    const spaceOpen = expanded[spaceKey] !== false;
                    const spaceNotes = notesBySpace.get(space.id) ?? [];
                    return (
                      <div key={space.id}>
                        <TreeButton
                          expanded={spaceOpen}
                          label={space.name || (space.key_pending ? 'Encrypted space' : space.id)}
                          meta={space.key_pending
                            ? 'Key pending'
                            : space.can_write ? 'Can edit' : 'View only'}
                          icon={space.key_pending ? KeyRound : Users}
                          onClick={() => setExpanded((current) => ({
                            ...current,
                            [spaceKey]: !spaceOpen,
                          }))}
                        />
                        {spaceOpen && (
                          <div className="ml-4 border-l border-app-border/70 py-0.5 pl-1">
                            {spaceNotes.length ? spaceNotes.map((note) => (
                              <button
                                key={note.noteId}
                                type="button"
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-app-text hover:bg-app-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
                                title={note.relativePath}
                                onClick={() => onFileOpen?.({
                                  path: note.path,
                                  name: getFilename(note.path),
                                  is_directory: false,
                                })}
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0 text-app-muted" aria-hidden="true" />
                                <span className="truncate">{note.relativePath}</span>
                              </button>
                            )) : (
                              <p className="px-2 py-2 text-[11px] leading-4 text-app-muted">
                                No local team notes in this space.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!(team.spaces ?? []).length && (
                    <p className="px-3 py-2 text-[11px] leading-4 text-app-muted">
                      No readable spaces yet.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-app-border px-3 py-2 text-[10px] leading-4 text-app-muted">
        Shared notes stay local and sync as encrypted revisions.
      </div>
    </aside>
  );
}

function TreeButton({
  expanded,
  label,
  meta,
  icon: Icon,
  onClick,
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left hover:bg-app-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
      aria-expanded={expanded}
      onClick={onClick}
    >
      {expanded
        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-app-muted" aria-hidden="true" />
        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-app-muted" aria-hidden="true" />}
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-app-muted" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-app-text">
        {label}
      </span>
      {meta && (
        <span className="shrink-0 rounded bg-app-bg px-1.5 py-0.5 text-[9px] capitalize text-app-muted">
          {meta}
        </span>
      )}
    </button>
  );
}

function PanelMessage({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}) {
  return (
    <aside className="flex h-full flex-col items-center justify-center border-r border-app-border bg-app-panel px-5 text-center">
      <span className="mb-3 rounded-full bg-app-bg p-3 text-app-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-sm font-semibold text-app-text">{title}</h2>
      <p className="mt-1 max-w-56 text-xs leading-5 text-app-muted">{body}</p>
      <button
        type="button"
        className="mt-4 rounded-md bg-app-accent px-3 py-2 text-xs font-medium text-app-accent-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </aside>
  );
}
