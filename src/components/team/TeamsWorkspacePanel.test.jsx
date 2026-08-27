import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  initialize: vi.fn(),
  listTeams: vi.fn(),
  openFile: vi.fn(),
  auth: {
    isAuthenticated: true,
    isGuest: false,
    user: { id: 'user-1' },
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

vi.mock('../../core/auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../core/team/TeamControlClient', () => ({
  teamControlClient: {
    initialize: mocks.initialize,
    listTeams: mocks.listTeams,
  },
}));

import TeamsWorkspacePanel from './TeamsWorkspacePanel';

describe('TeamsWorkspacePanel', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.initialize.mockReset();
    mocks.listTeams.mockReset();
    mocks.openFile.mockReset();
    Object.assign(mocks.auth, {
      isAuthenticated: true,
      isGuest: false,
      user: { id: 'user-1' },
    });
    mocks.listTeams.mockResolvedValue([
      {
        id: 'team-1',
        name: 'Product',
        membership: { role: 'owner', status: 'active' },
        spaces: [
          {
            id: 'space-1',
            name: 'General',
            can_write: true,
            key_pending: false,
          },
        ],
      },
    ]);
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'get_team_note_paths') return ['Shared/Plan.md'];
      if (command === 'get_note_identity') {
        return {
          note_id: 'note-1',
          scope_kind: 'team',
          scope_id: 'space-1',
        };
      }
      return null;
    });
  });

  it('shows named teams and opens a local team note', async () => {
    render(
      <TeamsWorkspacePanel
        workspacePath="/workspace"
        onFileOpen={mocks.openFile}
      />,
    );

    expect(await screen.findByText('Product')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Shared/Plan.md'));

    expect(mocks.openFile).toHaveBeenCalledWith({
      path: '/workspace/Shared/Plan.md',
      name: 'Plan.md',
      is_directory: false,
    });
  });

  it('offers setup when the account has no teams', async () => {
    mocks.listTeams.mockResolvedValue([]);
    mocks.invoke.mockResolvedValue([]);
    render(
      <TeamsWorkspacePanel
        workspacePath="/workspace"
        onFileOpen={mocks.openFile}
      />,
    );

    expect(await screen.findByText('Create your first team')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set up Teams' }));
    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith('open_preferences_window', {
        workspacePath: '/workspace',
        section: 'Teams',
      });
    });
  });
});
