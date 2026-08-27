import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_TEAM_COLLABORATION,
  TEAM_SYNC_STATES,
  selectTeamCollaboration,
  teamCollaboration,
  useTeamCollaborationStore,
} from './teamCollaboration';

describe('teamCollaboration store', () => {
  beforeEach(() => {
    teamCollaboration.resetAll();
  });

  it('returns a stable idle snapshot for unknown space/note pairs', () => {
    expect(teamCollaboration.get('space-a', 'note-a')).toBe(
      EMPTY_TEAM_COLLABORATION,
    );
    expect(
      selectTeamCollaboration(null, null)(
        useTeamCollaborationStore.getState(),
      ),
    ).toBe(EMPTY_TEAM_COLLABORATION);
  });

  it('stores sync metadata and only normalized collaborator display fields', () => {
    teamCollaboration.update('space-a', 'note-a', {
      syncState: 'syncing',
      outboxCount: 3,
      lastSyncedAt: '2026-08-27T05:00:00Z',
      collaborators: [
        {
          id: 'user-2',
          name: 'Grace Hopper',
          mode: 'viewing',
          avatarUrl: 'javascript:alert(1)',
          email: 'grace@example.com',
          inviteToken: 'secret',
        },
        {
          id: 'user-1',
          name: 'Ada Lovelace',
          mode: 'viewing',
          isSelf: true,
          teamKey: 'secret',
        },
        {
          id: 'user-2',
          mode: 'editing',
          presence_ref: 'secret',
        },
      ],
    });

    const record = teamCollaboration.get('space-a', 'note-a');
    expect(record).toEqual({
      syncState: 'syncing',
      outboxCount: 3,
      lastSyncedAt: Date.parse('2026-08-27T05:00:00Z'),
      collaborators: [
        {
          id: 'user-1',
          name: 'Ada Lovelace',
          avatarUrl: null,
          mode: 'viewing',
          isSelf: true,
        },
        {
          id: 'user-2',
          name: 'Grace Hopper',
          avatarUrl: null,
          mode: 'editing',
          isSelf: false,
        },
      ],
    });
    expect(JSON.stringify(record)).not.toMatch(
      /email|invite|teamKey|presence_ref|secret/i,
    );
  });

  it('supports every explicit sync state and preserves other fields on partial updates', () => {
    teamCollaboration.update('space', 'note', { outboxCount: 2 });

    for (const syncState of TEAM_SYNC_STATES) {
      teamCollaboration.update('space', 'note', { syncState });
      expect(teamCollaboration.get('space', 'note')).toMatchObject({
        syncState,
        outboxCount: 2,
      });
    }
  });

  it('isolates note scopes and resets a note, a space, or all spaces', () => {
    teamCollaboration.update('space-a', 'note-1', { syncState: 'offline' });
    teamCollaboration.update('space-a', 'note-2', { syncState: 'conflict' });
    teamCollaboration.update('space-b', 'note-1', { syncState: 'synced' });

    teamCollaboration.resetNote('space-a', 'note-1');
    expect(teamCollaboration.get('space-a', 'note-1')).toBe(
      EMPTY_TEAM_COLLABORATION,
    );
    expect(teamCollaboration.get('space-a', 'note-2').syncState).toBe(
      'conflict',
    );
    expect(teamCollaboration.get('space-b', 'note-1').syncState).toBe(
      'synced',
    );

    teamCollaboration.resetSpace('space-a');
    expect(teamCollaboration.get('space-a', 'note-2')).toBe(
      EMPTY_TEAM_COLLABORATION,
    );
    expect(teamCollaboration.get('space-b', 'note-1').syncState).toBe(
      'synced',
    );

    teamCollaboration.resetAll();
    expect(useTeamCollaborationStore.getState().spaces).toEqual({});
  });

  it('exposes imperative subscriptions and avoids updates for equivalent records', () => {
    const listener = vi.fn();
    const unsubscribe = teamCollaboration.subscribe(
      selectTeamCollaboration('space', 'note'),
      listener,
    );

    teamCollaboration.update('space', 'note', {
      syncState: 'synced',
      collaborators: [{ id: 'user', name: 'A Person' }],
    });
    expect(listener).toHaveBeenCalledTimes(1);

    const spaces = useTeamCollaborationStore.getState().spaces;
    teamCollaboration.update('space', 'note', {
      syncState: 'synced',
      collaborators: [{ id: 'user', name: 'A Person' }],
    });
    expect(useTeamCollaborationStore.getState().spaces).toBe(spaces);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('rejects invalid state, count, timestamp, and scope updates', () => {
    expect(() => teamCollaboration.update('space', 'note', {
      syncState: 'pretending-to-sync',
    })).toThrow(/invalid team sync state/i);
    expect(() => teamCollaboration.update('space', 'note', {
      outboxCount: -1,
    })).toThrow(/non-negative integer/i);
    expect(() => teamCollaboration.update('space', 'note', {
      lastSyncedAt: 'not-a-date',
    })).toThrow(/valid timestamp/i);
    expect(() => teamCollaboration.update('', 'note', {
      syncState: 'idle',
    })).toThrow(/spaceId is required/i);
    expect(useTeamCollaborationStore.getState().spaces).toEqual({});
  });
});
