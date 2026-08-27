import { describe, expect, it, vi } from 'vitest';

import { TeamRealtimeCoordinator } from './TeamRealtimeCoordinator';

const activeHint = {
  team_id: 'team-1',
  membership_status: 'active',
  permission_epoch: 1,
  team_key_epoch: 1,
};

function createActiveCoordinator({
  spaces,
  getTeamKey = vi.fn().mockResolvedValue(new Uint8Array(32)),
  getSpaceKey = vi.fn().mockResolvedValue(new Uint8Array(32)),
}) {
  const invokeFn = vi.fn().mockResolvedValue([]);
  const controlClient = {
    provisionMissingDevices: vi.fn().mockResolvedValue([]),
    getTeamKey,
    getSpaceKey,
    deleteCachedTeamKeys: vi.fn().mockResolvedValue(),
  };
  const syncClient = {
    pushSpace: vi.fn().mockResolvedValue({ accepted: 1 }),
    pullSpace: vi.fn().mockResolvedValue({ checkpoint: 1 }),
  };
  const loadSpaces = vi.fn().mockResolvedValue(spaces);
  const clearTimeoutFn = vi.fn();
  const coordinator = new TeamRealtimeCoordinator({
    invokeFn,
    controlClient,
    syncClient,
    loadSpaces,
    clearTimeoutFn,
  });
  coordinator.workspacePath = '/workspace';
  return {
    coordinator,
    invokeFn,
    controlClient,
    syncClient,
    loadSpaces,
    clearTimeoutFn,
  };
}

function keyPendingError(scope) {
  return Object.assign(
    new Error(`${scope} key epoch 1 is awaiting provisioning`),
    { code: 'TEAM_KEY_PENDING' },
  );
}

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

  it('skips a key-pending space while reconciling healthy spaces', async () => {
    const pendingSpace = {
      id: 'space-pending',
      team_id: 'team-1',
      current_key_epoch: 1,
    };
    const healthySpace = {
      id: 'space-healthy',
      team_id: 'team-1',
      current_key_epoch: 2,
    };
    const getSpaceKey = vi.fn()
      .mockRejectedValueOnce(keyPendingError('space'))
      .mockResolvedValueOnce(new Uint8Array(32));
    const {
      coordinator,
      invokeFn,
      syncClient,
      clearTimeoutFn,
    } = createActiveCoordinator({
      spaces: [pendingSpace, healthySpace],
      getSpaceKey,
    });
    coordinator.spaces.set(pendingSpace.id, pendingSpace);
    coordinator.queuedPushes.set(pendingSpace.id, 123);
    const pendingEvents = [];
    const handleKeyPending = (event) => pendingEvents.push(event.detail);
    window.addEventListener('lokus:team-key-pending', handleKeyPending);

    try {
      await coordinator.handleMembershipHint(activeHint);
    } finally {
      window.removeEventListener('lokus:team-key-pending', handleKeyPending);
    }

    expect(getSpaceKey).toHaveBeenNthCalledWith(1, 'space-pending', 1);
    expect(getSpaceKey).toHaveBeenNthCalledWith(2, 'space-healthy', 2);
    expect(invokeFn).toHaveBeenNthCalledWith(1, 'apply_team_membership_hint', {
      workspacePath: '/workspace',
      teamId: 'team-1',
      membershipStatus: 'active',
      permissionEpoch: 1,
    });
    expect(invokeFn).toHaveBeenNthCalledWith(2, 'refresh_team_note_scope', {
      workspacePath: '/workspace',
      teamId: 'team-1',
      spaceId: 'space-healthy',
      permissionEpoch: 1,
      keyEpoch: 2,
    });
    expect(invokeFn).toHaveBeenCalledTimes(2);
    expect(syncClient.pushSpace).toHaveBeenCalledOnce();
    expect(syncClient.pushSpace).toHaveBeenCalledWith('/workspace', 'space-healthy');
    expect(syncClient.pullSpace).toHaveBeenCalledOnce();
    expect(syncClient.pullSpace).toHaveBeenCalledWith(
      '/workspace',
      'team-1',
      'space-healthy',
    );
    expect(coordinator.spaces.has('space-pending')).toBe(false);
    expect(coordinator.spaces.get('space-healthy')).toBe(healthySpace);
    expect(clearTimeoutFn).toHaveBeenCalledWith(123);
    expect(coordinator.queuedPushes.has('space-pending')).toBe(false);
    expect(pendingEvents).toEqual([{
      workspacePath: '/workspace',
      teamId: 'team-1',
      spaceId: 'space-pending',
    }]);
  });

  it('surfaces non-provisioning space key errors', async () => {
    const spaceError = new Error('secure store unavailable');
    const {
      coordinator,
      invokeFn,
      syncClient,
    } = createActiveCoordinator({
      spaces: [{
        id: 'space-1',
        team_id: 'team-1',
        current_key_epoch: 1,
      }],
      getSpaceKey: vi.fn().mockRejectedValue(spaceError),
    });

    await expect(coordinator.handleMembershipHint(activeHint)).rejects.toBe(spaceError);

    expect(invokeFn).not.toHaveBeenCalled();
    expect(syncClient.pushSpace).not.toHaveBeenCalled();
    expect(syncClient.pullSpace).not.toHaveBeenCalled();
    expect(coordinator.spaces.size).toBe(0);
  });

  it('marks the whole membership key-pending when the team key is unavailable', async () => {
    const {
      coordinator,
      invokeFn,
      syncClient,
      loadSpaces,
    } = createActiveCoordinator({
      spaces: [],
      getTeamKey: vi.fn().mockRejectedValue(keyPendingError('team')),
    });
    const pendingEvents = [];
    const handleKeyPending = (event) => pendingEvents.push(event.detail);
    window.addEventListener('lokus:team-key-pending', handleKeyPending);

    try {
      await coordinator.handleMembershipHint(activeHint);
    } finally {
      window.removeEventListener('lokus:team-key-pending', handleKeyPending);
    }

    expect(invokeFn).toHaveBeenCalledOnce();
    expect(invokeFn).toHaveBeenCalledWith('apply_team_membership_hint', {
      workspacePath: '/workspace',
      teamId: 'team-1',
      membershipStatus: 'key_pending',
      permissionEpoch: 1,
    });
    expect(loadSpaces).not.toHaveBeenCalled();
    expect(syncClient.pushSpace).not.toHaveBeenCalled();
    expect(syncClient.pullSpace).not.toHaveBeenCalled();
    expect(pendingEvents).toEqual([{
      workspacePath: '/workspace',
      teamId: 'team-1',
    }]);
  });

  it('stops reconciliation when the lifecycle token becomes stale', async () => {
    let rejectSpaceKey;
    let signalKeyRequested;
    const keyRequested = new Promise((resolve) => {
      signalKeyRequested = resolve;
    });
    const spaceKey = new Promise((_, reject) => {
      rejectSpaceKey = reject;
    });
    const {
      coordinator,
      invokeFn,
      syncClient,
    } = createActiveCoordinator({
      spaces: [{
        id: 'space-1',
        team_id: 'team-1',
        current_key_epoch: 1,
      }],
      getSpaceKey: vi.fn(() => {
        signalKeyRequested();
        return spaceKey;
      }),
    });
    const pendingEvents = [];
    const handleKeyPending = (event) => pendingEvents.push(event.detail);
    window.addEventListener('lokus:team-key-pending', handleKeyPending);

    try {
      const reconciliation = coordinator.handleMembershipHint(activeHint);
      await keyRequested;
      coordinator.lifecycleToken += 1;
      rejectSpaceKey(keyPendingError('space'));
      await reconciliation;
    } finally {
      window.removeEventListener('lokus:team-key-pending', handleKeyPending);
    }

    expect(invokeFn).not.toHaveBeenCalled();
    expect(syncClient.pushSpace).not.toHaveBeenCalled();
    expect(syncClient.pullSpace).not.toHaveBeenCalled();
    expect(coordinator.spaces.size).toBe(0);
    expect(pendingEvents).toEqual([]);
  });
});
