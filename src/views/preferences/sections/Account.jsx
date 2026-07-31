/**
 * Account — sign in / sign up / reset, and the signed-in dashboard.
 *
 * Signed-out is a form page: a single column of labelled fields under a title
 * that names what you're about to do. Signed-in is a settings page: who you
 * are, what your plan includes, and the two ways out. They deliberately do not
 * share a layout.
 *
 * Props:
 *   isLoading             {boolean}   auth state still resolving
 *   isGuest               {boolean}   using Lokus without an account
 *   isAuthenticated       {boolean}   signed in
 *   user                  {object}    { name, email, avatar_url } — may be null
 *
 *   authMode              {'signin'|'signup'|'reset'}
 *   setAuthMode           (mode)      switch form mode
 *   authEmail             {string}
 *   setAuthEmail          (value)
 *   authPassword          {string}
 *   setAuthPassword       (value)
 *   authConfirmPassword   {string}
 *   setAuthConfirmPassword (value)
 *   authError             {string}    '' when there is nothing to show
 *   setAuthError          (value)
 *   authMessage           {string}    '' when there is nothing to show
 *   setAuthMessage        (value)
 *   authLoading           {boolean}   a sign-in request is in flight
 *   setAuthLoading        (value)
 *   isSigningOut          {boolean}
 *   setIsSigningOut       (value)
 *
 *   signInWithGoogle      ()          from useAuth()
 *   signInWithApple       ()          from useAuth()
 *   signInWithEmail       (email, password)
 *   signUpWithEmail       (email, password)
 *   resetPassword         (email)
 *   signOut               ()          also clears guest mode
 *   deleteAccount         ()
 */
import * as P from "../primitives.jsx";

const TITLES = {
  signin: "Sign in",
  signup: "Create your account",
  reset: "Reset your password",
};

const LEDES = {
  signin: "Your notes stay on this machine. Signing in adds an encrypted copy you can pull down anywhere else.",
  signup: "One account, every device you write on. Nothing leaves this machine unencrypted.",
  reset: "Give us the email on the account and we'll send a link to set a new password.",
};

const SUBMIT = {
  signin: "Sign in",
  signup: "Create account",
  reset: "Send reset link",
};

function GoogleMark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/** Errors and confirmations share one live region so nothing is announced twice. */
function AuthStatus({ error, message }) {
  return (
    <div role="status" aria-live="polite">
      {error && <P.Note tone="danger">{error}</P.Note>}
      {message && <P.Note tone="success">{message}</P.Note>}
    </div>
  );
}

export default function Account({
  isLoading,
  isGuest,
  isAuthenticated,
  user,
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authConfirmPassword,
  setAuthConfirmPassword,
  authError,
  setAuthError,
  authMessage,
  setAuthMessage,
  authLoading,
  setAuthLoading,
  isSigningOut,
  setIsSigningOut,
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  signOut,
  deleteAccount,
}) {
  const emailId = P.useFieldId("auth-email");
  const passwordId = P.useFieldId("auth-password");
  const confirmId = P.useFieldId("auth-confirm");

  const switchMode = (mode) => {
    setAuthMode(mode);
    setAuthError("");
    setAuthMessage("");
  };

  const handleOAuth = async (provider) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      if (provider === "google") await signInWithGoogle();
      else await signInWithApple();
    } catch (err) {
      setAuthError(
        err.message ||
          `${provider === "google" ? "Google" : "Apple"} didn't finish signing you in. Try again, or use your email below.`
      );
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim()) {
      setAuthError("Enter the email address for your account.");
      return;
    }
    if (authMode !== "reset" && !authPassword) {
      setAuthError("Enter your password to continue.");
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === "signin") {
        await signInWithEmail(authEmail, authPassword);
      } else if (authMode === "signup") {
        if (authPassword !== authConfirmPassword) {
          setAuthError("Those two passwords don't match. Retype them and try again.");
          setAuthLoading(false);
          return;
        }
        if (authPassword.length < 6) {
          setAuthError("Use at least 6 characters for your password.");
          setAuthLoading(false);
          return;
        }
        const result = await signUpWithEmail(authEmail, authPassword);
        if (result?.user?.identities?.length === 0) {
          setAuthError("That email already has an account. Sign in instead, or reset the password.");
        } else {
          setAuthMessage("Confirmation link sent. Open it from your inbox to finish setting up.");
          setAuthMode("signin");
        }
      } else {
        await resetPassword(authEmail);
        setAuthMessage("Reset link sent. Open it from your inbox to choose a new password.");
      }
    } catch (err) {
      setAuthError(err.message || "That didn't go through. Check your email and password, then try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch {
      /* leave the button as it was; AuthContext keeps the session */
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
      )
    ) {
      try {
        await deleteAccount();
      } catch (err) {
        console.error("Failed to delete account:", err);
      }
    }
  };

  /* ---------------------------------------------------------- resolving --- */

  if (isLoading) {
    return (
      <P.Page title="Account">
        <P.Empty>Checking your account…</P.Empty>
      </P.Page>
    );
  }

  /* -------------------------------------------------------------- guest --- */

  if (isGuest) {
    return (
      <P.Page
        title="Account"
        lede="You're writing as a guest. Everything you've made lives on this machine and nowhere else."
      >
        <P.Group label="Sync">
          <P.Empty>
            Sign in to keep an encrypted copy of this workspace and open it on any other machine you write on.
          </P.Empty>
          <div className="pt-3">
            <P.Button
              tone="primary"
              onClick={async () => {
                try {
                  await signOut(); // clears guest mode → reveals the sign-in form
                } catch {
                  /* staying in guest mode is a safe fallback */
                }
              }}
            >
              Sign in
            </P.Button>
          </div>
        </P.Group>
      </P.Page>
    );
  }

  /* --------------------------------------------------------- signed out --- */

  if (!isAuthenticated) {
    return (
      <P.Page title={TITLES[authMode]} lede={LEDES[authMode]}>
        <section>
          <AuthStatus error={authError} message={authMessage} />

          {authMode !== "reset" && (
            <>
              <div className="flex flex-col gap-2 mt-1">
                <P.Button onClick={() => handleOAuth("google")} disabled={authLoading} className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <GoogleMark />
                    Continue with Google
                  </span>
                </P.Button>
                <P.Button onClick={() => handleOAuth("apple")} disabled={authLoading} className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <AppleMark />
                    Continue with Apple
                  </span>
                </P.Button>
              </div>

              <div className="flex items-center gap-3 my-5" aria-hidden="true">
                <span className="h-px flex-1 bg-app-border" />
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-app-muted">or</span>
                <span className="h-px flex-1 bg-app-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <P.Row label="Email" htmlFor={emailId} stacked>
              <P.TextField
                id={emailId}
                type="email"
                value={authEmail}
                onChange={setAuthEmail}
                placeholder="you@example.com"
                className="w-full"
              />
            </P.Row>

            {authMode !== "reset" && (
              <P.Row label="Password" htmlFor={passwordId} stacked>
                <P.TextField
                  id={passwordId}
                  type="password"
                  value={authPassword}
                  onChange={setAuthPassword}
                  placeholder="At least 6 characters"
                  className="w-full"
                />
              </P.Row>
            )}

            {authMode === "signup" && (
              <P.Row label="Confirm password" htmlFor={confirmId} stacked>
                <P.TextField
                  id={confirmId}
                  type="password"
                  value={authConfirmPassword}
                  onChange={setAuthConfirmPassword}
                  placeholder="Type it once more"
                  className="w-full"
                />
              </P.Row>
            )}

            <div className="pt-4">
              <P.Button type="submit" tone="primary" disabled={authLoading} className="w-full">
                {authLoading ? "Working…" : SUBMIT[authMode]}
              </P.Button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3 mt-3">
            {authMode === "signin" && (
              <>
                <P.Button tone="ghost" onClick={() => switchMode("reset")}>
                  Forgot your password?
                </P.Button>
                <P.Button tone="ghost" onClick={() => switchMode("signup")}>
                  Create an account
                </P.Button>
              </>
            )}
            {authMode === "signup" && (
              <P.Button tone="ghost" onClick={() => switchMode("signin")}>
                I already have an account
              </P.Button>
            )}
            {authMode === "reset" && (
              <P.Button tone="ghost" onClick={() => switchMode("signin")}>
                Back to sign in
              </P.Button>
            )}
          </div>
        </section>
      </P.Page>
    );
  }

  /* ---------------------------------------------------------- signed in --- */

  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <P.Page title="Account">
      <section className="flex items-center gap-3.5">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="w-11 h-11 rounded-full border border-app-border flex-none object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="w-11 h-11 rounded-full border border-app-border flex-none
                       flex items-center justify-center font-mono text-[15px] text-app-muted"
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[15px] leading-tight text-app-text truncate">{user?.name || "Signed in"}</p>
          <p className="font-mono text-[12px] text-app-muted mt-1 truncate">
            {user?.email || "No email on this account"}
          </p>
        </div>
      </section>

      <P.Group label="Your plan">
        <P.Row label="End-to-end encrypted sync">
          <span className="text-[12.5px] text-app-success">Included</span>
        </P.Row>
        <P.Row label="Sync across devices">
          <span className="text-[12.5px] text-app-success">Included</span>
        </P.Row>
        <P.Row label="Cloud backup">
          <span className="text-[12.5px] text-app-success">Included</span>
        </P.Row>
      </P.Group>

      <P.Group label="Session">
        <P.ActionRow
          tone="danger"
          label={isSigningOut ? "Signing out…" : "Sign out"}
          hint="Your notes stay on this machine. Sign back in whenever you want them syncing again."
          onClick={handleSignOut}
          disabled={isSigningOut}
        />
        <P.ActionRow
          tone="danger"
          label="Delete account"
          hint="Removes the account and every synced copy. Local files stay put. This can't be undone."
          onClick={handleDeleteAccount}
        />
      </P.Group>
    </P.Page>
  );
}
