import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/team/TeamSyncClient', () => ({
  teamSyncClient: {
    getConflict: vi.fn(),
    resolveConflict: vi.fn(),
    resolveRecovery: vi.fn(),
  },
}));

import { teamSyncClient } from '../core/team/TeamSyncClient';
import TeamConflictModal from './TeamConflictModal';

describe('TeamConflictModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamSyncClient.getConflict.mockResolvedValue([
      { kind: 'base', content: 'base' },
      { kind: 'local', content: 'local edit' },
      { kind: 'remote', content: 'team edit' },
    ]);
    teamSyncClient.resolveConflict.mockResolvedValue({ queued_for_sync: true });
    teamSyncClient.resolveRecovery.mockResolvedValue({ queued_for_sync: false });
  });

  it('lets the user inspect both branches and save a resolution', async () => {
    const onClose = vi.fn();
    render(
      <TeamConflictModal
        isOpen
        workspacePath="/workspace"
        noteId="note-1"
        onClose={onClose}
      />,
    );

    await screen.findByText('Your version');
    fireEvent.click(screen.getByRole('button', { name: 'Use team version' }));
    expect(screen.getByRole('textbox')).toHaveValue('team edit');
    fireEvent.click(screen.getByRole('button', { name: 'Save resolution' }));

    await waitFor(() => {
      expect(teamSyncClient.resolveConflict).toHaveBeenCalledWith(
        '/workspace',
        'note-1',
        'team edit',
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces rejected offline work and can keep it as a local copy', async () => {
    teamSyncClient.getConflict.mockResolvedValue([
      { kind: 'rejected', content: 'offline text' },
    ]);
    render(
      <TeamConflictModal
        isOpen
        workspacePath="/workspace"
        noteId="note-2"
        onClose={vi.fn()}
      />,
    );

    await screen.findByText('Rejected offline edit');
    fireEvent.click(screen.getByRole('button', { name: 'Apply recovered version' }));

    await waitFor(() => {
      expect(teamSyncClient.resolveRecovery).toHaveBeenCalledWith(
        '/workspace',
        'note-2',
        'rejected',
        'offline text',
      );
    });
  });
});
