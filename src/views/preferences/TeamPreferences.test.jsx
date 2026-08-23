import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../core/team/TeamControlClient', () => ({
  teamControlClient: {
    initialize: vi.fn(),
    listTeams: vi.fn(),
  },
}));

import { teamControlClient } from '../../core/team/TeamControlClient';
import TeamPreferences from './TeamPreferences';

describe('TeamPreferences authentication gate', () => {
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
});
