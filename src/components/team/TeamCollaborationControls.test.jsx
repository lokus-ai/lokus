import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  reconnect: vi.fn(),
  on: vi.fn(),
  listeners: {},
  pushSpace: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

vi.mock('../../contexts/RemoteConfigContext', () => ({
  useFeatureFlags: () => ({ enable_team_notes_foundation: true }),
}));

vi.mock('../../core/auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isGuest: false,
    user: {
      id: 'user-1',
      email: 'person@example.test',
      user_metadata: { name: 'Person One' },
    },
  }),
}));

vi.mock('../../stores/editorGroups', () => ({
  useEditorGroupStore: (selector) => selector({
    focusedGroupId: 'group-1',
    layout: {
      id: 'group-1',
      type: 'group',
      activeTab: '/workspace/Plan.md',
    },
  }),
}));

vi.mock('../../core/team/TeamPresenceClient', () => ({
  TEAM_PRESENCE_MODES: {
    VIEWING: 'viewing',
    EDITING: 'editing',
  },
  teamPresenceClient: {
    join: mocks.join,
    leave: mocks.leave,
    reconnect: mocks.reconnect,
    on: mocks.on,
  },
}));

vi.mock('../../core/team/TeamSyncClient', () => ({
  teamSyncClient: {
    pushSpace: mocks.pushSpace,
  },
}));

import TeamCollaborationControls from './TeamCollaborationControls';
import { teamCollaboration } from '../../stores/teamCollaboration';

describe('TeamCollaborationControls', () => {
  beforeEach(() => {
    teamCollaboration.resetAll();
    mocks.invoke.mockReset();
    mocks.join.mockReset().mockResolvedValue({ topic: 'team-note:space-1:note-1' });
    mocks.leave.mockReset().mockResolvedValue(undefined);
    mocks.reconnect.mockReset().mockResolvedValue(undefined);
    mocks.pushSpace.mockReset().mockResolvedValue(undefined);
    mocks.listeners = {};
    mocks.on.mockReset().mockImplementation((event, listener) => {
      mocks.listeners[event] = listener;
      return () => {
        delete mocks.listeners[event];
      };
    });
    mocks.invoke.mockResolvedValue({
      note_id: 'note-1',
      scope_kind: 'team',
      scope_id: 'space-1',
    });
  });

  it('joins presence for the active team note and opens sharing', async () => {
    const onShare = vi.fn();
    window.addEventListener('lokus:share-team-note', onShare);
    render(<TeamCollaborationControls workspacePath="/workspace" />);

    expect(await screen.findByText('Team sync idle')).toBeInTheDocument();
    expect(mocks.join).toHaveBeenCalledWith({
      spaceId: 'space-1',
      noteId: 'note-1',
      identity: expect.objectContaining({
        id: 'user-1',
        displayName: 'Person One',
        mode: 'editing',
      }),
    });

    act(() => {
      mocks.listeners.collaborators?.([
        {
          id: 'user-2',
          name: 'Alex Kim',
          avatarUrl: null,
          mode: 'viewing',
          isSelf: false,
        },
      ]);
    });
    expect(screen.getByLabelText('Alex Kim, viewing')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: 'Open team sharing settings for this note',
    }));
    expect(onShare).toHaveBeenCalled();
    window.removeEventListener('lokus:share-team-note', onShare);
  });

  it('keeps team sync visible when presence cannot connect', async () => {
    mocks.join.mockRejectedValue(new Error('channel unavailable'));
    render(<TeamCollaborationControls workspacePath="/workspace" />);

    await waitFor(() => {
      expect(screen.getByText('Team sync idle')).toBeInTheDocument();
    });
  });
});
