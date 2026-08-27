import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PresenceBar from './PresenceBar';

describe('PresenceBar', () => {
  it('shows three accessible collaborator avatars and a named overflow count', () => {
    render(
      <PresenceBar
        collaborators={[
          {
            id: 'ada',
            name: 'Ada Lovelace',
            mode: 'editing',
            isSelf: true,
          },
          {
            id: 'grace',
            name: 'Grace Hopper',
            mode: 'viewing',
            avatarUrl: 'https://example.com/grace.png',
          },
          {
            id: 'unknown',
            name: '',
            mode: 'viewing',
          },
          {
            id: 'linus',
            name: 'Linus Torvalds',
            mode: 'editing',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('group', { name: '4 collaborators present' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Ada Lovelace (you), editing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Grace Hopper, viewing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Teammate, viewing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: '1 more collaborator: Linus Torvalds',
      }),
    ).toHaveTextContent('+1');
    expect(
      screen.queryByRole('img', { name: 'Linus Torvalds, editing' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('TE')).toBeInTheDocument();
  });

  it('uses fallback initials when an avatar URL is unsafe', () => {
    const { container } = render(
      <PresenceBar
        collaborators={[{
          id: 'grace',
          name: 'Grace Hopper',
          avatarUrl: 'javascript:alert(1)',
          mode: 'viewing',
        }]}
      />,
    );

    expect(screen.getByText('GH')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('group', { name: '1 collaborator present' }),
    ).toBeInTheDocument();
  });

  it('renders nothing when nobody is present', () => {
    const { container } = render(<PresenceBar collaborators={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
