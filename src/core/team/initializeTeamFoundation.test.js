import { describe, expect, it, vi } from 'vitest';

import {
  initializeTeamFoundation,
  stopTeamFoundation,
} from './initializeTeamFoundation';

describe('initializeTeamFoundation', () => {
  it('registers the current device and gives sync its server device id', async () => {
    const controlClient = {
      initialize: vi.fn().mockResolvedValue({ deviceId: 'device-1' }),
    };
    const syncClient = {
      setDeviceId: vi.fn(),
      initializeSequence: vi.fn(),
    };
    const realtimeCoordinator = { start: vi.fn(), stop: vi.fn() };

    const result = await initializeTeamFoundation('user-1', true, {
      workspacePath: '/workspace',
      controlClient,
      syncClient,
      realtimeCoordinator,
    });

    expect(result).toEqual({ deviceId: 'device-1' });
    expect(controlClient.initialize).toHaveBeenCalledWith('user-1');
    expect(syncClient.setDeviceId).toHaveBeenCalledWith('device-1');
    expect(syncClient.initializeSequence).toHaveBeenCalledWith('/workspace');
    expect(realtimeCoordinator.start).toHaveBeenCalledWith('/workspace', 'user-1');
  });

  it('does nothing while the rollout flag is disabled', async () => {
    const controlClient = { initialize: vi.fn() };
    const syncClient = { setDeviceId: vi.fn() };
    const realtimeCoordinator = { start: vi.fn(), stop: vi.fn() };

    expect(await initializeTeamFoundation('user-1', false, {
      controlClient,
      syncClient,
      realtimeCoordinator,
    })).toBeNull();
    expect(controlClient.initialize).not.toHaveBeenCalled();
    expect(realtimeCoordinator.stop).toHaveBeenCalled();
  });

  it('cannot restart stale sync after workspace cleanup', async () => {
    let releaseIdentity;
    const identity = new Promise((resolve) => {
      releaseIdentity = resolve;
    });
    const controlClient = { initialize: vi.fn(() => identity) };
    const syncClient = {
      setDeviceId: vi.fn(),
      initializeSequence: vi.fn(),
    };
    const realtimeCoordinator = { start: vi.fn(), stop: vi.fn() };
    const starting = initializeTeamFoundation('user-1', true, {
      workspacePath: '/old-workspace',
      controlClient,
      syncClient,
      realtimeCoordinator,
    });

    await stopTeamFoundation({ realtimeCoordinator });
    releaseIdentity({ deviceId: 'old-device' });
    await starting;

    expect(syncClient.setDeviceId).not.toHaveBeenCalled();
    expect(realtimeCoordinator.start).not.toHaveBeenCalled();
  });
});
