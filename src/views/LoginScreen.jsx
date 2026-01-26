import { useState } from "react";
import { useAuth } from "../core/auth/AuthContext.jsx";
import LokusLogo from "../components/LokusLogo.jsx";

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, isLoading } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await signUpWithEmail(email, password);
      if (result?.user?.identities?.length === 0) {
        setError('An account with this email already exists');
      } else {
        setMessage('Check your email for a confirmation link');
        setMode('signin');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await signInWithGoogle();
      // The OAuth flow will redirect, so we don't need to do anything here
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await resetPassword(email);
      setMessage('Check your email for a password reset link');
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-app-bg text-app-text select-none">
        <div className="flex flex-col items-center gap-2 animate-pulse">
          <div className="text-4xl font-bold tracking-tight text-app-accent">Lokus</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text select-none">
      <div className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <LokusLogo className="w-16 h-16" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-center mb-2">
          {mode === 'signin' && 'Welcome back'}
          {mode === 'signup' && 'Create an account'}
          {mode === 'reset' && 'Reset password'}
        </h1>
        <p className="text-app-muted text-center mb-8">
          {mode === 'signin' && 'Sign in to continue to Lokus'}
          {mode === 'signup' && 'Get started with Lokus'}
          {mode === 'reset' && 'Enter your email to reset your password'}
        </p>

        {/* Error/Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
            {message}
          </div>
        )}

        {/* Google Sign In */}
        {mode !== 'reset' && (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-app-border bg-app-panel hover:bg-app-bg-secondary transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-app-border"></div>
              <span className="text-app-muted text-sm">or</span>
              <div className="flex-1 h-px bg-app-border"></div>
            </div>
          </>
        )}

        {/* Email Form */}
        <form onSubmit={mode === 'signin' ? handleEmailSignIn : mode === 'signup' ? handleEmailSignUp : handleResetPassword}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-app-border bg-app-panel focus:outline-none focus:ring-2 focus:ring-app-accent/50 focus:border-app-accent"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-app-border bg-app-panel focus:outline-none focus:ring-2 focus:ring-app-accent/50 focus:border-app-accent"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-app-border bg-app-panel focus:outline-none focus:ring-2 focus:ring-app-accent/50 focus:border-app-accent"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg bg-app-accent text-white font-medium hover:bg-app-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading...</span>
                </span>
              ) : (
                <>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'reset' && 'Send Reset Link'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Mode Switching */}
        <div className="mt-6 text-center text-sm">
          {mode === 'signin' && (
            <>
              <button
                onClick={() => setMode('reset')}
                className="text-app-muted hover:text-app-text transition-colors"
              >
                Forgot password?
              </button>
              <div className="mt-4">
                <span className="text-app-muted">Don't have an account? </span>
                <button
                  onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                  className="text-app-accent hover:underline"
                >
                  Sign up
                </button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div>
              <span className="text-app-muted">Already have an account? </span>
              <button
                onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                className="text-app-accent hover:underline"
              >
                Sign in
              </button>
            </div>
          )}
          {mode === 'reset' && (
            <button
              onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
              className="text-app-accent hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
