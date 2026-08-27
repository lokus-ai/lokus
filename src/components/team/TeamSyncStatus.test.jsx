import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import TeamSyncStatus from './TeamSyncStatus';

describe('TeamSyncStatus', () => {
  it('announces syncing work and queued outbox count', () => {
    render(<TeamSyncStatus syncState="syncing" outboxCount={3} />);

    expect(screen.getByRole('status')).toHaveTextContent('Syncing 3 changes');
    expect(screen.getByRole('status')).toHaveAttribute(
      'data-sync-state',
      'syncing',
    );
  });

  it('shows a compact human last-sync time', () => {
    const now = Date.parse('2026-08-27T05:02:00Z');
    const lastSyncedAt = Date.parse('2026-08-27T05:00:00Z');
    render(
      <TeamSyncStatus
        syncState="synced"
        lastSyncedAt={lastSyncedAt}
        now={now}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Synced 2m ago');
    expect(screen.getByRole('status')).toHaveAttribute(
      'title',
      'Last synced 2026-08-27T05:00:00.000Z',
    );
  });

  it('provides an accessible retry action for offline and error states', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <TeamSyncStatus
        syncState="offline"
        outboxCount={1}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Offline · 1 change queued',
    );
    await user.click(screen.getByRole('button', { name: 'Retry sync' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <TeamSyncStatus
        syncState="error"
        outboxCount={2}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sync failed · 2 changes queued',
    );
    await user.click(screen.getByRole('button', { name: 'Retry sync' }));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('offers dedicated conflict and key-recovery actions', async () => {
    const user = userEvent.setup();
    const onResolveConflict = vi.fn();
    const onRequestKey = vi.fn();
    const { rerender } = render(
      <TeamSyncStatus
        syncState="conflict"
        onResolveConflict={onResolveConflict}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Conflict needs review',
    );
    await user.click(
      screen.getByRole('button', { name: 'Resolve conflict' }),
    );
    expect(onResolveConflict).toHaveBeenCalledTimes(1);

    rerender(
      <TeamSyncStatus
        syncState="key_pending"
        onRequestKey={onRequestKey}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Encryption key required',
    );
    await user.click(screen.getByRole('button', { name: 'Set up key' }));
    expect(onRequestKey).toHaveBeenCalledTimes(1);
  });

  it('keeps pending work visible in idle and synced states', () => {
    const { rerender } = render(
      <TeamSyncStatus syncState="idle" outboxCount={4} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      '4 changes waiting to sync',
    );

    rerender(
      <TeamSyncStatus
        syncState="synced"
        outboxCount={2}
        lastSyncedAt={0}
        now={5_000}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Synced just now · 2 changes queued',
    );
  });
});
