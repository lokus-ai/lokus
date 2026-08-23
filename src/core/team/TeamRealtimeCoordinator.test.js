import { describe, expect, it, vi } from 'vitest';

import { TeamRealtimeCoordinator } from './TeamRealtimeCoordinator';

describe('TeamRealtimeCoordinator', () => {
  it('uses content-free pokes to pull and applies revocation before deleting keys', async () => {
    const handlers = [];
    const channel = {
      on: vi.fn((_, filter, handler) => {
        handlers.push({ table: filter.table, handler });
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    const supabaseClient = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    };
    const invokeFn = vi.fn().mockResolvedValue([
      { space_id: 'space-1', key_epoch: 1 },
    ]);
    const controlClient = {
      provisionMissingDevices: vi.fn().mockResolvedValue([]),
      getTeamKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
      getSpaceKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
      deleteCachedTeamKeys: vi.fn().mockResolvedValue(),
    };
    const syncClient = {
      pushSpace: vi.fn().mockResolvedValue({ accepted: 1 }),
      pullSpace: vi.fn().mockResolvedValue({ checkpoint: 1 }),
    };
    const queuedTimeouts = [];
    const coordinator = new TeamRealtimeCoordinator({
      supabaseClient,
      invokeFn,
      controlClient,
      syncClient,
      loadMembershipHints: vi.fn().mockResolvedValue([{
        team_id: 'team-1',
        membership_status: 'active',
        permission_epoch: 1,
        team_key_epoch: 1,
      }]),
      loadSpaces: vi.fn().mockResolvedValue([{
        id: 'space-1',
        team_id: 'team-1',
        current_key_epoch: 1,
      }]),
      setIntervalFn: vi.fn(() => 123),
      clearIntervalFn: vi.fn(),
      setTimeoutFn: vi.fn((callback) => {
        queuedTimeouts.push(callback);
        return queuedTimeouts.length;
      }),
      clearTimeoutFn: vi.fn(),
    });

    await coordinator.start('/workspace', 'user-1');

    expect(controlClient.getTeamKey).toHaveBeenCalledWith('team-1', 1);
    expect(controlClient.getSpaceKey).toHaveBeenCalledWith('space-1', 1);
    expect(syncClient.pushSpace).toHaveBeenCalledWith('/workspace', 'space-1');
    expect(syncClient.pullSpace).toHaveBeenCalledWith('/workspace', 'team-1', 'space-1');

    window.dispatchEvent(new CustomEvent('lokus:team-note-queued', {
      detail: { workspacePath: '/workspace', spaceId: 'space-1' },
    }));
    await queuedTimeouts[0]();
    expect(syncClient.pushSpace).toHaveBeenCalledTimes(2);

    const counterHandler = handlers.find(({ table }) => table === 'space_sync_counters').handler;
    await counterHandler({ new: { space_id: 'space-1', last_sequence: 2 } });
    expect(syncClient.pullSpace).toHaveBeenCalledTimes(2);

    const membershipHandler = handlers.find(
      ({ table }) => table === 'team_membership_realtime_hints',
    ).handler;
    await membershipHandler({
      new: {
        team_id: 'team-1',
        membership_status: 'removed',
        permission_epoch: 2,
        team_key_epoch: 2,
      },
    });

    expect(invokeFn).toHaveBeenCalledWith('apply_team_membership_hint', {
      workspacePath: '/workspace',
      teamId: 'team-1',
      membershipStatus: 'removed',
      permissionEpoch: 2,
    });
    expect(controlClient.deleteCachedTeamKeys).toHaveBeenCalledWith(
      'team-1',
      [{ space_id: 'space-1', key_epoch: 1 }],
    );
  });
});
