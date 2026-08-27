import { teamControlClient } from './TeamControlClient';
import { teamRealtimeCoordinator } from './TeamRealtimeCoordinator';
import { teamSyncClient } from './TeamSyncClient';

let lifecycleGeneration = 0;

export async function initializeTeamFoundation(
  userId,
  enabled,
  {
    workspacePath = null,
    controlClient = teamControlClient,
    syncClient = teamSyncClient,
    realtimeCoordinator = teamRealtimeCoordinator,
  } = {},
) {
  const generation = ++lifecycleGeneration;
  if (!enabled || !userId || !workspacePath) {
    await realtimeCoordinator.stop();
    return null;
  }
  const identity = await controlClient.initialize(userId);
  if (generation !== lifecycleGeneration) return null;
  syncClient.setDeviceId(identity.deviceId);
  await syncClient.initializeSequence(workspacePath);
  if (generation !== lifecycleGeneration) return null;
  await realtimeCoordinator.start(workspacePath, userId);
  if (generation !== lifecycleGeneration) return null;
  return identity;
}

export async function stopTeamFoundation({
  realtimeCoordinator = teamRealtimeCoordinator,
} = {}) {
  lifecycleGeneration += 1;
  await realtimeCoordinator.stop();
}
