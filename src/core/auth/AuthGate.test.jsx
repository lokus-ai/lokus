import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthGate from './AuthGate.jsx';

// Controllable mock auth state
let mockAuth;
vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}));

const Child = () => <div>WORKSPACE</div>;

describe('AuthGate — guest/local is the default (no auth wall)', () => {
  beforeEach(() => {
    mockAuth = {
      isAuthenticated: false,
      isLoading: false,
      isGuest: false,
      continueAsGuest: vi.fn(),
    };
  });

  it('auto-enters guest mode and renders the app in the main window when nobody is signed in', () => {
    render(<AuthGate isPrefsWindow={false}><Child /></AuthGate>);
    // App content is shown immediately — no LoginScreen gate
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
    // Guest mode is entered automatically
    expect(mockAuth.continueAsGuest).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-enter guest in the Preferences window (so a guest can sign in there)', () => {
    render(<AuthGate isPrefsWindow={true}><Child /></AuthGate>);
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
    expect(mockAuth.continueAsGuest).not.toHaveBeenCalled();
  });

  it('does not re-enter guest when already a guest', () => {
    mockAuth.isGuest = true;
    mockAuth.isAuthenticated = true;
    render(<AuthGate isPrefsWindow={false}><Child /></AuthGate>);
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
    expect(mockAuth.continueAsGuest).not.toHaveBeenCalled();
  });

  it('does not auto-enter guest for a signed-in user', () => {
    mockAuth.isAuthenticated = true;
    render(<AuthGate isPrefsWindow={false}><Child /></AuthGate>);
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
    expect(mockAuth.continueAsGuest).not.toHaveBeenCalled();
  });

  it('shows the loading fallback (not the app) while auth is resolving', () => {
    mockAuth.isLoading = true;
    render(<AuthGate isPrefsWindow={false}><Child /></AuthGate>);
    expect(screen.queryByText('WORKSPACE')).not.toBeInTheDocument();
    expect(screen.getByText('Lokus')).toBeInTheDocument();
    expect(mockAuth.continueAsGuest).not.toHaveBeenCalled();
  });
});
