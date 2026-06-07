import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Control the data engine so the panel test stays a pure UI test.
const mockResurface = vi.fn();
const realMerge = vi.fn((cands, self, limit) => cands.slice(0, limit)); // simple stand-in

vi.mock('./ResurfacingProvider.js', () => {
  class FakeProvider {
    constructor(workspacePath) {
      this.workspacePath = workspacePath;
    }
    resurface(...args) {
      return mockResurface(...args);
    }
  }
  FakeProvider.merge = (...args) => realMerge(...args);
  return { default: FakeProvider, DEFAULT_LIMIT: 5 };
});

import AmbientNotesPanel from './AmbientNotesPanel.jsx';

const note = (name, extra = {}) => ({
  id: name.toLowerCase(),
  name,
  path: `${name}.md`,
  direction: 'outgoing',
  connections: 3,
  ...extra,
});

beforeEach(() => {
  mockResurface.mockReset();
  realMerge.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AmbientNotesPanel — Layer A rendering', () => {
  it('renders the header and a card per related note', async () => {
    mockResurface.mockResolvedValue([note('Beta'), note('Gamma'), note('Delta')]);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" />);

    expect(screen.getByText(/connected notes/i)).toBeInTheDocument();
    await screen.findByText('Beta');
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('passes the active note name and limit through to resurface', async () => {
    mockResurface.mockResolvedValue([]);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" limit={4} />);
    await waitFor(() =>
      expect(mockResurface).toHaveBeenCalledWith('Alpha', { limit: 4 }),
    );
  });

  it('derives the note name from notePath when noteName is absent', async () => {
    mockResurface.mockResolvedValue([]);
    render(<AmbientNotesPanel workspacePath="/ws" notePath="/ws/sub/My Note.md" />);
    await waitFor(() =>
      expect(mockResurface).toHaveBeenCalledWith('My Note', expect.anything()),
    );
  });

  it('shows the wiki-link empty state when there are no related notes', async () => {
    mockResurface.mockResolvedValue([]);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Lonely" />);
    expect(await screen.findByTestId('ambient-empty')).toHaveTextContent(/wiki-links/i);
  });

  it('shows the "open a note" prompt when no note is active', () => {
    render(<AmbientNotesPanel workspacePath="/ws" />);
    expect(screen.getByTestId('ambient-empty')).toHaveTextContent(/open a note/i);
    expect(mockResurface).not.toHaveBeenCalled();
  });

  it('shows the error state when resurface rejects', async () => {
    mockResurface.mockRejectedValue(new Error('boom'));
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" />);
    expect(await screen.findByTestId('ambient-error')).toBeInTheDocument();
  });

  it('renders connection counts with correct pluralization', async () => {
    mockResurface.mockResolvedValue([note('Beta', { connections: 1 }), note('Gamma', { connections: 5 })]);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" />);
    await screen.findByText('Beta');
    expect(screen.getByText('1 link')).toBeInTheDocument();
    expect(screen.getByText('5 links')).toBeInTheDocument();
  });
});

describe('AmbientNotesPanel — navigation', () => {
  it('dispatches lokus:navigate:note on card click', async () => {
    mockResurface.mockResolvedValue([note('Beta')]);
    const spy = vi.fn();
    window.addEventListener('lokus:navigate:note', spy);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" />);

    fireEvent.click(await screen.findByText('Beta'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toMatchObject({ name: 'Beta', path: 'Beta.md' });
    window.removeEventListener('lokus:navigate:note', spy);
  });

  it('calls onNavigate override instead of dispatching when provided', async () => {
    mockResurface.mockResolvedValue([note('Beta')]);
    const onNavigate = vi.fn();
    const dispatchSpy = vi.fn();
    window.addEventListener('lokus:navigate:note', dispatchSpy);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByText('Beta'));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Beta' }));
    expect(dispatchSpy).not.toHaveBeenCalled();
    window.removeEventListener('lokus:navigate:note', dispatchSpy);
  });
});

describe('AmbientNotesPanel — Layer B seam', () => {
  it('merges semantic notes pushed via lokus:semantic-notes-updated', async () => {
    mockResurface.mockResolvedValue([note('Beta')]);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" />);
    await screen.findByText('Beta');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('lokus:semantic-notes-updated', {
          detail: { notes: [note('Zeta', { source: 'semantic' })] },
        }),
      );
    });

    expect(realMerge).toHaveBeenCalled();
    await screen.findByText('Zeta');
  });

  it('ignores empty semantic updates', async () => {
    mockResurface.mockResolvedValue([note('Beta')]);
    render(<AmbientNotesPanel workspacePath="/ws" noteName="Alpha" />);
    await screen.findByText('Beta');
    realMerge.mockClear();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('lokus:semantic-notes-updated', { detail: { notes: [] } }),
      );
    });
    expect(realMerge).not.toHaveBeenCalled();
  });
});
