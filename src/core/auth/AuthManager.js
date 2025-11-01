import { invoke } from '@tauri-apps/api/core';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { listen } from '@tauri-apps/api/event';

class AuthManager {
  constructor() {
    this.listeners = new Set();
    this.user = null;
    this.isAuthenticated = false;
    // Always use production backend (lokusmd.com)
    this.authBaseUrl = import.meta.env.VITE_AUTH_BASE_URL || 'https://lokusmd.com';

    // Throttling for auth checks to prevent excessive calls
    this.checkInProgress = false;
    this.lastCheckTime = 0;
    this.CHECK_THROTTLE = 1000; // Minimum 1 second between checks

    // Token refresh lock to prevent concurrent refresh attempts
    this.refreshInProgress = false;
    this.refreshPromise = null;

    this.initialize();
  }

  async initialize() {
    // Check if user is already authenticated
    await this.checkAuthStatus();
    
    // Listen for deep links using the plugin
    try {
      await onOpenUrl((urls) => {
        for (const url of urls) {
          if (url.startsWith('lokus://auth-callback')) {
            this.handleDeepLinkCallback(url);
          }
        }
      });
    } catch (error) {
      console.error('Failed to register deep link listener:', error);
    }

    // Listen for localhost auth completion events
    try {
      await listen('auth-success', (event) => {
        this.checkAuthStatus(); // Refresh auth state
      });
      
      await listen('auth-error', (event) => {
        console.error('❌ Authentication failed:', event.payload);
        this.notifyListeners(); // Update UI to show error state
      });
    } catch (error) {
      console.error('Failed to register auth event listeners:', error);
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
      const isAuth = await invoke('is_authenticated');
      this.isAuthenticated = isAuth;

      if (isAuth) {
        const userProfile = await invoke('get_user_profile');
        this.user = userProfile;
      } else {
        this.user = null;
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.isAuthenticated = false;
      this.user = null;
      this.notifyListeners();
    } finally {
      this.checkInProgress = false;
    }
  }

  handleDeepLinkCallback(url) {
    try {
      const urlObj = new URL(url);
      const params = {};
      
      // Extract query parameters
      for (const [key, value] of urlObj.searchParams) {
        params[key] = value;
      }
      
      this.handleAuthCallback(params);
    } catch (error) {
      console.error('Failed to parse deep link URL:', error);
    }
  }

  async handleAuthCallback(params) {
    try {
      const { code, state, error } = params;
      
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Handle OAuth callback with PKCE
      await invoke('handle_oauth_callback', { code, state });
      
      // Update auth state
      this.isAuthenticated = true;
      await this.checkAuthStatus(); // Refresh user profile
      
    } catch (error) {
      console.error('Auth callback failed:', error);
      this.notifyListeners();
    }
  }


  async signIn() {
    try {
      // Initiate OAuth flow with PKCE
      const authUrl = await invoke('initiate_oauth_flow');
      await invoke('open_auth_url', { authUrl });
    } catch (error) {
      console.error('❌ Failed to initiate OAuth flow:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      await invoke('logout');
      this.isAuthenticated = false;
      this.user = null;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  }

  async getAccessToken() {
    try {
      // If a refresh is in progress, wait for it to complete
      if (this.refreshInProgress && this.refreshPromise) {
        await this.refreshPromise;
        // After refresh completes, get the new token
        const tokenData = await invoke('get_auth_token');
        return tokenData?.access_token || null;
      }

      const tokenData = await invoke('get_auth_token');
      if (!tokenData) return null;

      // Check if token is expired
      if (tokenData.expires_at && tokenData.expires_at < Math.floor(Date.now() / 1000)) {
        // Token is expired, try to refresh
        if (tokenData.refresh_token) {
          await this.refreshToken();
          // Get the new token
          const newTokenData = await invoke('get_auth_token');
          return newTokenData?.access_token || null;
        } else {
          // No refresh token, user needs to sign in again
          await this.signOut();
          return null;
        }
      }

      return tokenData.access_token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  async refreshToken() {
    // If already refreshing, return the existing promise
    if (this.refreshInProgress && this.refreshPromise) {
      return this.refreshPromise;
    }

    // Mark refresh as in progress and create the promise
    this.refreshInProgress = true;
    this.refreshPromise = (async () => {
      try {
        console.log('[Auth] Refreshing token...');
        await invoke('refresh_auth_token');
        await this.checkAuthStatus(); // Refresh auth state
        console.log('[Auth] Token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // If refresh fails, sign out the user
        await this.signOut();
        throw error;
      } finally {
        // Clear the lock
        this.refreshInProgress = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // API call helper with automatic auth headers
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

  // Event system for auth state changes
  onAuthStateChange(callback) {
    this.listeners.add(callback);
    
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
      } catch (error) {
        console.error('Error in auth state listener:', error);
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
}

// Create singleton instance
const authManager = new AuthManager();

export default authManager;