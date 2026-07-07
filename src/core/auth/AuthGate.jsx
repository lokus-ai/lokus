import { useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";

// Loading spinner shown while auth state is resolving.
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-app-bg text-app-text select-none">
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <div className="text-4xl font-bold tracking-tight text-app-accent">Lokus</div>
    </div>
  </div>
);

/**
 * Guest/local is the default. The app opens straight into a usable workspace with
 * no auth wall; sign-in is an optional in-app action (Preferences → Account).
 *
 * In the main window, if there's no signed-in session and we're not already a
 * guest, we enter guest mode automatically so a first-run user lands in the app
 * immediately. The Preferences window never auto-guests, so a guest can sign in
 * there (signing in clears guest mode).
 */
export const AuthGate = ({ children, isPrefsWindow }) => {
  const { isAuthenticated, isLoading, isGuest, continueAsGuest } = useAuth();

  useEffect(() => {
    if (!isPrefsWindow && !isLoading && !isAuthenticated && !isGuest) {
      continueAsGuest();
    }
  }, [isPrefsWindow, isLoading, isAuthenticated, isGuest, continueAsGuest]);

  if (isLoading) {
    return <LoadingFallback />;
  }

  return children;
};

export default AuthGate;
