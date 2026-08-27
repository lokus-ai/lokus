import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Users } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import {
  TEAM_PRESENCE_MODES,
  teamPresenceClient,
} from '../../core/team/TeamPresenceClient';
import { teamSyncClient } from '../../core/team/TeamSyncClient';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import { useEditorGroupStore } from '../../stores/editorGroups';
import {
  EMPTY_TEAM_COLLABORATION,
  selectTeamCollaboration,
  teamCollaboration,
  useTeamCollaborationStore,
} from '../../stores/teamCollaboration';
import PresenceBar from './PresenceBar';
import TeamSyncStatus from './TeamSyncStatus';

export default function TeamCollaborationControls({ workspacePath }) {
  const featureFlags = useFeatureFlags();
  const { isAuthenticated, isGuest, user } = useAuth();
  const activePath = useEditorGroupStore(selectFocusedPath);
  const [identity, setIdentity] = useState(null);
  const collaboration = useTeamCollaborationStore(
    identity
      ? selectTeamCollaboration(identity.spaceId, identity.noteId)
      : () => EMPTY_TEAM_COLLABORATION,
  );

  useEffect(() => {
    let cancelled = false;
    const cleanups = [];

    const disconnect = () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
      teamPresenceClient.leave().catch(() => {});
    };

    if (
      !featureFlags.enable_team_notes_foundation
      || !workspacePath
      || !activePath
      || activePath.startsWith('__')
      || !/\.(md|markdown|txt)$/i.test(activePath)
      || !isAuthenticated
      || isGuest
      || !user?.id
    ) {
      setIdentity(null);
      disconnect();
      return disconnect;
    }

    (async () => {
      try {
        const noteIdentity = await invoke('get_note_identity', {
          workspacePath,
          path: activePath,
        });
        if (cancelled || noteIdentity.scope_kind !== 'team') {
          if (!cancelled) setIdentity(null);
          return;
        }

        const nextIdentity = {
          noteId: noteIdentity.note_id,
          spaceId: noteIdentity.scope_id,
          path: activePath,
        };
        setIdentity(nextIdentity);

        cleanups.push(
          teamPresenceClient.on('collaborators', (collaborators) => {
            teamCollaboration.update(nextIdentity.spaceId, nextIdentity.noteId, {
              collaborators,
            });
          }),
          teamPresenceClient.on('error', () => {
            teamCollaboration.update(nextIdentity.spaceId, nextIdentity.noteId, {
              collaborators: [],
            });
          }),
        );

        try {
          await teamPresenceClient.join({
            spaceId: nextIdentity.spaceId,
            noteId: nextIdentity.noteId,
            identity: {
              id: user.id,
              displayName: displayName(user),
              avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
              mode: TEAM_PRESENCE_MODES.EDITING,
            },
          });
        } catch {
          teamCollaboration.update(nextIdentity.spaceId, nextIdentity.noteId, {
            collaborators: [],
          });
        }
      } catch {
        if (!cancelled) setIdentity(null);
      }
    })();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [
    activePath,
    featureFlags.enable_team_notes_foundation,
    isAuthenticated,
    isGuest,
    user,
    workspacePath,
  ]);

  useEffect(() => {
    if (!identity) return undefined;
    const markOffline = () => {
      const current = teamCollaboration.get(identity.spaceId, identity.noteId);
      teamCollaboration.update(identity.spaceId, identity.noteId, {
        syncState: 'offline',
        outboxCount: current.outboxCount,
      });
    };
    const reconnect = () => {
      teamPresenceClient.reconnect().catch(() => {});
      const current = teamCollaboration.get(identity.spaceId, identity.noteId);
      if (current.outboxCount) {
        teamCollaboration.update(identity.spaceId, identity.noteId, {
          syncState: 'syncing',
        });
        teamSyncClient.pushSpace(workspacePath, identity.spaceId).catch(() => {
          teamCollaboration.update(identity.spaceId, identity.noteId, {
            syncState: 'error',
          });
        });
      }
    };
    window.addEventListener('offline', markOffline);
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', reconnect);
    };
  }, [identity, workspacePath]);

  const retry = useCallback(() => {
    if (!identity) return;
    teamCollaboration.update(identity.spaceId, identity.noteId, {
      syncState: 'syncing',
    });
    teamSyncClient.pushSpace(workspacePath, identity.spaceId).catch(() => {
      teamCollaboration.update(identity.spaceId, identity.noteId, {
        syncState: globalThis.navigator?.onLine === false ? 'offline' : 'error',
      });
    });
  }, [identity, workspacePath]);

  if (!identity) return null;

  const openConflict = () => {
    window.dispatchEvent(new CustomEvent('lokus:team-conflict', {
      detail: {
        workspacePath,
        noteId: identity.noteId,
      },
    }));
  };
  const openTeamSettings = () => invoke('open_preferences_window', {
    workspacePath,
    section: 'Teams',
  });
  const openShare = () => {
    window.dispatchEvent(new CustomEvent('lokus:share-team-note', {
      detail: { workspacePath, path: identity.path },
    }));
  };

  return (
    <div
      className="flex items-center gap-1.5"
      data-tauri-drag-region="false"
      style={{ pointerEvents: 'auto' }}
    >
      <PresenceBar collaborators={collaboration.collaborators} />
      <TeamSyncStatus
        syncState={collaboration.syncState}
        outboxCount={collaboration.outboxCount}
        lastSyncedAt={collaboration.lastSyncedAt}
        onRetry={retry}
        onResolveConflict={openConflict}
        onRequestKey={openTeamSettings}
      />
      <button
        type="button"
        className="obsidian-button icon-only small"
        title="Team sharing and space"
        aria-label="Open team sharing settings for this note"
        onClick={openShare}
      >
        <Users className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function selectFocusedPath(state) {
  if (!state.focusedGroupId) return null;
  const visit = (node) => {
    if (node.type === 'group') {
      return node.id === state.focusedGroupId ? node.activeTab : null;
    }
    if (node.type === 'container') {
      for (const child of node.children) {
        const path = visit(child);
        if (path) return path;
      }
    }
    return null;
  };
  return visit(state.layout);
}

function displayName(user) {
  return user.user_metadata?.full_name
    ?? user.user_metadata?.name
    ?? user.email?.split('@')[0]
    ?? 'Teammate';
}
