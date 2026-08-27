import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CloudOff,
  GitMerge,
  KeyRound,
  LoaderCircle,
} from 'lucide-react';

const STATUS_CONFIG = {
  idle: {
    Icon: Circle,
    color: 'text-app-muted',
  },
  syncing: {
    Icon: LoaderCircle,
    color: 'text-app-info',
    iconClassName: 'animate-spin motion-reduce:animate-none',
  },
  synced: {
    Icon: CheckCircle2,
    color: 'text-app-success',
  },
  offline: {
    Icon: CloudOff,
    color: 'text-app-warning',
  },
  error: {
    Icon: AlertTriangle,
    color: 'text-app-danger',
    assertive: true,
  },
  conflict: {
    Icon: GitMerge,
    color: 'text-app-warning',
    assertive: true,
  },
  key_pending: {
    Icon: KeyRound,
    color: 'text-app-warning',
  },
};

export default function TeamSyncStatus({
  syncState = 'idle',
  outboxCount = 0,
  lastSyncedAt = null,
  onRetry,
  onResolveConflict,
  onRequestKey,
  now = Date.now(),
  className = '',
}) {
  const state = STATUS_CONFIG[syncState] ? syncState : 'idle';
  const config = STATUS_CONFIG[state];
  const count = Number.isInteger(outboxCount) && outboxCount > 0
    ? outboxCount
    : 0;
  const lastSync = normalizeTimestamp(lastSyncedAt);
  const label = statusLabel(state, count, lastSync, normalizeTimestamp(now));
  const action = statusAction(
    state,
    onRetry,
    onResolveConflict,
    onRequestKey,
  );
  const Icon = config.Icon;

  return (
    <div
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border border-app-border bg-app-panel/80 px-2 py-1 text-xs text-app-text ${className}`.trim()}
      role={config.assertive ? 'alert' : 'status'}
      aria-live={config.assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-sync-state={state}
      title={
        lastSync === null
          ? undefined
          : `Last synced ${new Date(lastSync).toISOString()}`
      }
    >
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${config.color} ${
          config.iconClassName ?? ''
        }`.trim()}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap">{label}</span>
      {action && (
        <button
          type="button"
          className="ml-0.5 rounded bg-transparent px-1.5 py-0.5 text-xs font-medium text-app-accent shadow-none hover:bg-app-accent/10 hover:text-app-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/60"
          onClick={action.handler}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function statusLabel(state, outboxCount, lastSyncedAt, now) {
  const pending = `${outboxCount} ${
    outboxCount === 1 ? 'change' : 'changes'
  }`;

  switch (state) {
    case 'syncing':
      return outboxCount > 0 ? `Syncing ${pending}` : 'Syncing changes';
    case 'synced': {
      const synced = lastSyncedAt === null
        ? 'Synced'
        : `Synced ${relativeTime(lastSyncedAt, now)}`;
      return outboxCount > 0 ? `${synced} · ${pending} queued` : synced;
    }
    case 'offline':
      return outboxCount > 0
        ? `Offline · ${pending} queued`
        : 'Offline · changes stay local';
    case 'error':
      return outboxCount > 0
        ? `Sync failed · ${pending} queued`
        : 'Sync failed';
    case 'conflict':
      return 'Conflict needs review';
    case 'key_pending':
      return 'Encryption key required';
    case 'idle':
    default:
      return outboxCount > 0 ? `${pending} waiting to sync` : 'Team sync idle';
  }
}

function statusAction(state, onRetry, onResolveConflict, onRequestKey) {
  if ((state === 'error' || state === 'offline') && onRetry) {
    return { label: 'Retry sync', handler: onRetry };
  }
  if (state === 'conflict' && onResolveConflict) {
    return { label: 'Resolve conflict', handler: onResolveConflict };
  }
  if (state === 'key_pending' && onRequestKey) {
    return { label: 'Set up key', handler: onRequestKey };
  }
  return null;
}

function relativeTime(timestamp, now) {
  const elapsed = Math.max(0, (now ?? Date.now()) - timestamp);
  if (elapsed < 15_000) return 'just now';
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1_000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined) return null;
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === 'string'
      ? Date.parse(value)
      : value;
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
}
