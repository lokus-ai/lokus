import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/team/TeamControlClient', () => ({
  teamControlClient: {
    initialize: vi.fn(),
    listTeams: vi.fn(),
    listTeamMembers: vi.fn(),
    listPendingInvites: vi.fn(),
    createTeam: vi.fn(),
    createInvite: vi.fn(),
    buildInviteUrl: vi.fn(),
    revokeInvite: vi.fn(),
    acceptInvite: vi.fn(),
    provisionMissingDevices: vi.fn(),
    removeMember: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { teamControlClient } from '../../core/team/TeamControlClient';
import TeamPreferences from './TeamPreferences';

const TEAM = {
  id: 'team-atlas',
  name: 'Atlas Editors',
  current_permission_epoch: 3,
  current_key_epoch: 2,
  membership: {
    role: 'owner',
    status: 'active',
  },
  spaces: [
    {
      id: 'space-roadmap',
      name: 'Product Roadmap',
      can_write: true,
      current_key_epoch: 4,
    },
    {
      id: 'space-research',
      name: 'Research Archive',
      can_write: false,
      current_key_epoch: 2,
    },
  ],
};

const MEMBERS = [
  {
    user_id: 'user-owner',
    display_name: 'Maya Chen',
    email: 'maya@example.com',
    role: 'owner',
    status: 'active',
  },
  {
    user_id: 'user-without-profile',
    role: 'member',
    status: 'key_pending',
  },
];

const PENDING_INVITE = {
  id: 'invite-pending',
  email: 'sam@example.com',
  role: 'member',
  expires_at: '2030-01-02T00:00:00.000Z',
};

function renderPreferences() {
  return render(
    <TeamPreferences
      userId="user-owner"
      isAuthenticated
      isGuest={false}
    />,
  );
}

describe('TeamPreferences', () => {
  beforeEach(() => {
    Object.values(teamControlClient).forEach((mock) => mock.mockReset());
    teamControlClient.initialize.mockResolvedValue(undefined);
    teamControlClient.listTeams.mockResolvedValue([]);
    teamControlClient.listTeamMembers.mockResolvedValue([]);
    teamControlClient.listPendingInvites.mockResolvedValue([]);
    teamControlClient.createTeam.mockResolvedValue({ team_id: 'team-new' });
    teamControlClient.createInvite.mockResolvedValue({
      inviteId: 'invite-created',
      token: 'secret-token',
    });
    teamControlClient.buildInviteUrl.mockReturnValue(
      'lokus://team-invite/invite-created?token=secret-token',
    );
    teamControlClient.revokeInvite.mockResolvedValue(undefined);
    teamControlClient.acceptInvite.mockResolvedValue(undefined);
    teamControlClient.provisionMissingDevices.mockResolvedValue([]);
    teamControlClient.removeMember.mockResolvedValue(undefined);
  });

  it('never calls team RPCs for a guest session', () => {
    render(
      <TeamPreferences
        userId="guest"
        isAuthenticated
        isGuest
      />,
    );

    expect(screen.getByText(/sign in to create or join teams/i)).toBeInTheDocument();
    expect(teamControlClient.initialize).not.toHaveBeenCalled();
  });

  it('shows named spaces, human member identities, key state, and pending invites', async () => {
    teamControlClient.listTeams.mockResolvedValue([TEAM]);
    teamControlClient.listTeamMembers.mockResolvedValue(MEMBERS);
    teamControlClient.listPendingInvites.mockResolvedValue([PENDING_INVITE]);

    renderPreferences();

    expect(await screen.findByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText('maya@example.com')).toBeInTheDocument();
    expect(screen.getByText('user-without-profile')).toBeInTheDocument();
    expect(screen.getByText('Waiting for encryption keys')).toBeInTheDocument();
    expect(screen.getAllByText('Product Roadmap').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Research Archive').length).toBeGreaterThan(0);
    expect(screen.getByText('Can edit')).toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByText(/ordinary local files/i)).toBeInTheDocument();
  });

  it('creates a scoped admin invite and copies one link without exposing its token', async () => {
    const user = userEvent.setup();
    teamControlClient.listTeams.mockResolvedValue([TEAM]);
    teamControlClient.listTeamMembers.mockResolvedValue(MEMBERS);
    teamControlClient.listPendingInvites.mockResolvedValue([]);

    renderPreferences();

    await screen.findByText('Maya Chen');
    await user.type(screen.getByLabelText('Email address'), 'alex@example.com');
    await user.selectOptions(screen.getByLabelText('Team role'), 'admin');
    await user.selectOptions(screen.getByLabelText('Product Roadmap access'), 'reader');
    await user.selectOptions(screen.getByLabelText('Research Archive access'), 'editor');
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    await waitFor(() => {
      expect(teamControlClient.createInvite).toHaveBeenCalledWith({
        teamId: 'team-atlas',
        email: 'alex@example.com',
        role: 'admin',
        grants: [
          { space_id: 'space-roadmap', role: 'reader' },
          { space_id: 'space-research', role: 'editor' },
        ],
      });
    });
    expect(teamControlClient.buildInviteUrl).toHaveBeenCalledWith(
      'invite-created',
      'secret-token',
    );
    expect(await screen.findByText('Invite link ready')).toBeInTheDocument();
    expect(screen.queryByText('secret-token')).not.toBeInTheDocument();

    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(
      'lokus://team-invite/invite-created?token=secret-token',
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('revokes a pending invite from the team', async () => {
    const user = userEvent.setup();
    teamControlClient.listTeams.mockResolvedValue([TEAM]);
    teamControlClient.listTeamMembers.mockResolvedValue(MEMBERS);
    teamControlClient.listPendingInvites.mockResolvedValue([PENDING_INVITE]);

    renderPreferences();

    await user.click(await screen.findByRole('button', {
      name: 'Revoke invite for sam@example.com',
    }));

    expect(teamControlClient.revokeInvite).toHaveBeenCalledWith('invite-pending');
    await waitFor(() => {
      expect(screen.queryByText('sam@example.com')).not.toBeInTheDocument();
    });
  });

  it('surfaces a team loading error and supports retry', async () => {
    const user = userEvent.setup();
    teamControlClient.listTeams
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce([]);

    renderPreferences();

    expect(await screen.findByText('Teams could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('network unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/No teams yet/i)).toBeInTheDocument();
    expect(teamControlClient.listTeams).toHaveBeenCalledTimes(2);
  });
});
