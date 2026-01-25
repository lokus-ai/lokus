import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { open } from '@tauri-apps/plugin-shell';
import supabase from './supabase.js';

class AuthManager {
  constructor() {
    this.listeners = new Set();
    this.user = null;
    this.session = null;
    this.isAuthenticated = false;
    this.isInitialized = false;

    // Throttling for auth checks to prevent excessive calls
    this.checkInProgress = false;
    this.lastCheckTime = 0;
    this.CHECK_THROTTLE = 1000; // Minimum 1 second between checks

    this.initialize();
  }

  async initialize() {
    // Set up Supabase auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthManager] Auth state changed:', event, session?.user?.email);

      this.session = session;
      this.user = session?.user || null;
      this.isAuthenticated = !!session;

      if (!this.isInitialized) {
        this.isInitialized = true;
      }

      this.notifyListeners();
    });

    // Get initial session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[AuthManager] Error getting session:', error);
    }

    this.session = session;
    this.user = session?.user || null;
    this.isAuthenticated = !!session;
    this.isInitialized = true;
    this.notifyListeners();

    // Listen for deep links (OAuth callback)
    try {
      await onOpenUrl((urls) => {
        for (const url of urls) {
          if (url.includes('auth-callback') || url.includes('access_token') || url.includes('code=')) {
            this.handleDeepLinkCallback(url);
          }
        }
      });
    } catch (err) {
      console.warn('[AuthManager] Deep link listener setup failed:', err);
    }
  }

  async checkAuthStatus() {
    const now = Date.now();

    // Throttle auth checks to prevent excessive calls
    if (this.checkInProgress || (now - this.lastCheckTime) < this.CHECK_THROTTLE) {
      return this.isAuthenticated;
    }

    this.checkInProgress = true;
    this.lastCheckTime = now;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthManager] Session check error:', error);
        this.isAuthenticated = false;
        this.user = null;
        this.session = null;
      } else {
        this.session = session;
        this.user = session?.user || null;
        this.isAuthenticated = !!session;
      }

      this.notifyListeners();
    } catch (error) {
      console.error('[AuthManager] checkAuthStatus error:', error);
      this.isAuthenticated = false;
      this.user = null;
      this.session = null;
      this.notifyListeners();
    } finally {
      this.checkInProgress = false;
    }

    return this.isAuthenticated;
  }

  async handleDeepLinkCallback(url) {
    try {
      console.log('[AuthManager] Handling deep link callback:', url);

      // Parse the URL to extract tokens or code
      const urlObj = new URL(url.replace('lokus://', 'https://lokus.app/'));

      // Check for hash fragment (implicit flow) or query params (PKCE flow)
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const queryParams = urlObj.searchParams;

      // Try to get access_token from hash (implicit flow)
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken) {
        // Set the session from tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('[AuthManager] Error setting session from tokens:', error);
          throw error;
        }

        console.log('[AuthManager] Session set from deep link tokens');
        return;
      }

      // Try to get code from query params (PKCE flow)
      const code = queryParams.get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('[AuthManager] Error exchanging code for session:', error);
          throw error;
        }

        console.log('[AuthManager] Session set from PKCE code exchange');
        return;
      }

      // Check for error
      const error = hashParams.get('error') || queryParams.get('error');
      if (error) {
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
        console.error('[AuthManager] OAuth error:', error, errorDescription);
        throw new Error(errorDescription || error);
      }

    } catch (error) {
      console.error('[AuthManager] handleDeepLinkCallback error:', error);
      this.notifyListeners();
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[AuthManager] signInWithEmail error:', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[AuthManager] signUpWithEmail error:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    try {
      // Use 127.0.0.1 callback for more reliable OAuth flow
      // (Safari blocks redirects to "localhost" from external HTTPS sites)
      // The OAuth server on port 9080 will handle the callback
      const redirectUrl = 'http://127.0.0.1:9080/auth-callback';

      // Get the OAuth URL from Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We'll open it manually in system browser
        },
      });

      if (error) {
        throw error;
      }

      // Open the auth URL in the system browser
      if (data?.url) {
        console.log('[AuthManager] Opening OAuth URL in browser');
        await open(data.url);

        // Start polling for the callback file
        this.pollForAuthCallback();
      }

      return data;
    } catch (error) {
      console.error('[AuthManager] signInWithGoogle error:', error);
      throw error;
    }
  }

  /**
   * Poll for the Supabase auth callback file
   * The OAuth server writes the code to ~/.lokus/temp/supabase_auth_callback.json
   */
  async pollForAuthCallback() {
    const maxAttempts = 60; // 60 seconds timeout
    const pollInterval = 1000; // 1 second

    console.log('[AuthManager] Starting auth callback polling...');

    // Import dependencies once
    const { readTextFile, remove } = await import('@tauri-apps/plugin-fs');
    const { homeDir, join } = await import('@tauri-apps/api/path');

    const home = await homeDir();
    const callbackPath = await join(home, '.lokus', 'temp', 'supabase_auth_callback.json');
    console.log('[AuthManager] Polling for callback file at:', callbackPath);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Check if we're already authenticated (deep link might have worked)
        if (this.isAuthenticated) {
          console.log('[AuthManager] Already authenticated, stopping poll');
          return;
        }

        try {
          const content = await readTextFile(callbackPath);
          const data = JSON.parse(content);

          if (data.code) {
            console.log('[AuthManager] Found auth callback code, exchanging for session...');

            // Exchange code for session
            const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(data.code);

            if (error) {
              console.error('[AuthManager] Code exchange error:', error);
            } else {
              console.log('[AuthManager] Successfully exchanged code for session!', sessionData?.user?.email);
            }

            // Delete the callback file
            try {
              await remove(callbackPath);
            } catch (e) {
              // Ignore deletion errors
            }

            return;
          }
        } catch (e) {
          // File doesn't exist yet, continue polling (don't log every attempt)
          if (i === 0 || i % 10 === 0) {
            console.log(`[AuthManager] Waiting for auth callback... (${i}s)`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('[AuthManager] Poll error:', error);
      }
    }

    console.log('[AuthManager] Auth callback polling timed out');
  }

  /**
   * Sign in (legacy method - defaults to Google OAuth)
   */
  async signIn() {
    return this.signInWithGoogle();
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      this.isAuthenticated = false;
      this.user = null;
      this.session = null;
      this.notifyListeners();
    } catch (error) {
      console.error('[AuthManager] signOut error:', error);
      throw error;
    }
  }

  /**
   * Get the current access token
   */
  async getAccessToken() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        return null;
      }

      return session.access_token;
    } catch (error) {
      console.error('[AuthManager] getAccessToken error:', error);
      return null;
    }
  }

  /**
   * Refresh the session token
   */
  async refreshToken() {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('[AuthManager] refreshToken error:', error);
        // If refresh fails, sign out
        await this.signOut();
        throw error;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper method for making authenticated API requests
   */
  async authenticatedFetch(url, options = {}) {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Reset password - sends a password reset email
   */
  async resetPassword(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'lokus://auth-callback',
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[AuthManager] resetPassword error:', error);
      throw error;
    }
  }

  // Event system for auth state changes
  onAuthStateChange(callback) {
    this.listeners.add(callback);

    // Immediately call with current state if initialized
    if (this.isInitialized) {
      callback({
        isAuthenticated: this.isAuthenticated,
        user: this.user
      });
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          isAuthenticated: this.isAuthenticated,
          user: this.user
        });
      } catch (err) {
        console.error('[AuthManager] Listener error:', err);
      }
    });
  }

  // Getters
  get isLoggedIn() {
    return this.isAuthenticated;
  }

  get currentUser() {
    return this.user;
  }

  get currentSession() {
    return this.session;
  }
}

// Create singleton instance
const authManager = new AuthManager();

export default authManager;
