import { useSyncExternalStore, useMemo } from 'react';
import { host, contributions } from '../../core/plugin-v3/index.js';

export function usePluginSnapshot() {
  return useSyncExternalStore(
    (cb) => host.subscribe(cb),
    () => host.getSnapshot(),
    () => host.getSnapshot()
  );
}

let contributionVersion = 0;

export function useContributionsVersion() {
  return useSyncExternalStore(
    (cb) => contributions.subscribe(() => { contributionVersion += 1; cb(); }),
    () => contributionVersion,
    () => contributionVersion
  );
}

export function useContributed(kind) {
  const version = useContributionsVersion();
  return useMemo(() => contributions[kind](), [version, kind]);
}

export function usePluginRecord(pluginId) {
  const snap = usePluginSnapshot();
  return snap.plugins.find((p) => p.id === pluginId) || null;
}
