import { invoke } from '@tauri-apps/api/core';
// Temporarily comment out deep-link plugin until npm install is fixed
// import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
const onOpenUrl = (callback) => {
  console.warn('Deep-link plugin not available - using stub');
  return () => {}; // Return empty cleanup function
};
import { listen } from '@tauri-apps/api/event';

class AuthManager {
  constructor() {
    this.listeners = new Set();
    this.user = null;
    this.isAuthenticated = false;
    this.authBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://lokus-web.vercel.app';
    
    this.initialize();
  }

  async initialize() {
    // Check if user is already authenticated
    await this.checkAuthStatus();
    
    // Listen for deep links using the plugin
    try {
      await onOpenUrl((urls) => {
        console.log('Deep link received:', urls);
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
        console.log('✅ Authentication successful!');
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
    try {
      console.log('🔍 Checking auth status...');
      const isAuth = await invoke('is_authenticated');
      console.log('🔍 Is authenticated:', isAuth);
      this.isAuthenticated = isAuth;
      
      if (isAuth) {
        const userProfile = await invoke('get_user_profile');
        console.log('👤 User profile:', userProfile);
        this.user = userProfile;
      } else {
        this.user = null;
      }
      
      console.log('📢 Notifying listeners - Auth state:', { isAuthenticated: this.isAuthenticated, user: this.user });
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.isAuthenticated = false;
      this.user = null;
      this.notifyListeners();
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
      
      console.log('Auth callback params:', params);
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
      
      console.log('Authentication successful');
    } catch (error) {
      console.error('Auth callback failed:', error);
      this.notifyListeners();
    }
  }


  async signIn() {
    try {
      console.log('🔐 Starting OAuth sign in flow...');
      // Initiate OAuth flow with PKCE
      const authUrl = await invoke('initiate_oauth_flow');
      console.log('🔗 Generated auth URL:', authUrl);
      await invoke('open_auth_url', { authUrl });
      console.log('🌐 Opened auth URL in browser');
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
    try {
      await invoke('refresh_auth_token');
      await this.checkAuthStatus(); // Refresh auth state
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // If refresh fails, sign out the user
      await this.signOut();
    }
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