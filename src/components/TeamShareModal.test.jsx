import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../core/team/TeamControlClient', () => ({
  teamControlClient: {
    initialize: vi.fn(),
    listTeams: vi.fn(),
  },
}));

vi.mock('../core/team/TeamSyncClient', () => ({
  teamSyncClient: {
    shareNote: vi.fn(),
    moveNoteToSpace: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { teamControlClient } from '../core/team/TeamControlClient';
import { teamSyncClient } from '../core/team/TeamSyncClient';
import TeamShareModal from './TeamShareModal';

const DESIGN_TEAM = {
  id: 'team-design',
  name: 'Design Guild',
  current_permission_epoch: 6,
  membership: {
    role: 'member',
    status: 'active',
  },
  spaces: [
    {
      id: 'space-ideas',
      name: 'Ideas Library',
      can_write: false,
      current_key_epoch: 3,
    },
    {
      id: 'space-launch',
      name: 'Launch Plan',
      can_write: true,
      current_key_epoch: 7,
    },
    {
      id: 'space-editorial',
      name: 'Editorial Calendar',
      can_write: true,
      current_key_epoch: 8,
    },
  ],
};

function renderModal(onClose = vi.fn()) {
  render(
    <TeamShareModal
      isOpen
      workspacePath="/workspace"
      path="notes/launch.md"
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('TeamShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamControlClient.initialize.mockResolvedValue(undefined);
    teamControlClient.listTeams.mockResolvedValue([DESIGN_TEAM]);
    teamSyncClient.shareNote.mockResolvedValue(undefined);
    teamSyncClient.moveNoteToSpace.mockResolvedValue(undefined);
    invoke.mockResolvedValue({ scope_kind: 'personal', scope_id: 'personal' });
  });

  it('lists only named writable destinations and supports keyboard dismissal', async () => {
    const onClose = renderModal();

    const destination = await screen.findByLabelText('Destination');
    expect(screen.getByRole('option', {
      name: 'Launch Plan · Editor access',
    })).toBeInTheDocument();
    expect(screen.getByRole('option', {
      name: 'Editorial Calendar · Editor access',
    })).toBeInTheDocument();
    expect(screen.queryByRole('option', {
      name: /Ideas Library/i,
    })).not.toBeInTheDocument();
    expect(screen.getByText('Design Guild')).toBeInTheDocument();
    expect(screen.getByText(/note stays in your local workspace/i)).toBeInTheDocument();
    await waitFor(() => expect(destination).toHaveFocus());

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explains when all readable spaces are view-only', async () => {
    teamControlClient.listTeams.mockResolvedValue([{
      ...DESIGN_TEAM,
      spaces: [DESIGN_TEAM.spaces[0]],
    }]);

    renderModal();

    expect(await screen.findByText('No writable team spaces')).toBeInTheDocument();
    expect(screen.getByText(/sharing requires Editor access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Destination')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share note' })).toBeDisabled();
  });

  it('waits for encryption keys before offering an otherwise writable space', async () => {
    teamControlClient.listTeams.mockResolvedValue([{
      ...DESIGN_TEAM,
      membership: {
        role: 'member',
        status: 'key_pending',
      },
      spaces: [{
        id: 'space-pending',
        name: null,
        can_write: true,
        key_pending: true,
        current_key_epoch: 9,
      }],
    }]);

    renderModal();

    expect(await screen.findByText('Encryption keys are still being prepared')).toBeInTheDocument();
    expect(screen.getByText(/still waiting for encryption keys/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Destination')).not.toBeInTheDocument();
  });

  it('shares a local note with the selected team and space', async () => {
    const user = userEvent.setup();
    const onClose = renderModal();

    await user.click(await screen.findByRole('button', { name: 'Share note' }));

    await waitFor(() => {
      expect(teamSyncClient.shareNote).toHaveBeenCalledWith({
        workspacePath: '/workspace',
        path: 'notes/launch.md',
        teamId: 'team-design',
        spaceId: 'space-launch',
        permissionEpoch: 6,
        keyEpoch: 7,
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps same-team moves and sends them to the chosen writable space', async () => {
    const user = userEvent.setup();
    invoke.mockResolvedValue({
      scope_kind: 'team',
      scope_id: 'space-launch',
    });
    renderModal();

    await user.selectOptions(
      await screen.findByLabelText('Destination'),
      'team-design:space-editorial',
    );
    await user.click(screen.getByRole('button', { name: 'Share note' }));

    await waitFor(() => {
      expect(teamSyncClient.moveNoteToSpace).toHaveBeenCalledWith({
        workspacePath: '/workspace',
        path: 'notes/launch.md',
        teamId: 'team-design',
        targetSpaceId: 'space-editorial',
        permissionEpoch: 6,
        keyEpoch: 8,
      });
    });
    expect(teamSyncClient.shareNote).not.toHaveBeenCalled();
  });

  it('shows load failures and retries without closing the dialog', async () => {
    const user = userEvent.setup();
    teamControlClient.listTeams
      .mockRejectedValueOnce(new Error('service unavailable'))
      .mockResolvedValueOnce([DESIGN_TEAM]);
    renderModal();

    expect(await screen.findByText('Team spaces could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Destination')).toBeInTheDocument();
    expect(teamControlClient.listTeams).toHaveBeenCalledTimes(2);
  });
});
