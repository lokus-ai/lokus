import { invoke } from '@tauri-apps/api/core';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';

class AuthManager {
  constructor() {
    this.listeners = new Set();
    this.user = null;
    this.isAuthenticated = false;
    this.authBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001' 
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
  }

  async checkAuthStatus() {
    try {
      const isAuth = await invoke('is_authenticated');
      this.isAuthenticated = isAuth;
      
      if (isAuth) {
        const userProfile = await invoke('get_user_profile');
        this.user = userProfile;
      }
      
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.isAuthenticated = false;
      this.user = null;
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
      const { token, refresh_token, expires_in, user_id } = params;
      
      if (!token) {
        throw new Error('No access token received');
      }

      // Calculate expiration time
      const expiresAt = expires_in ? 
        Math.floor(Date.now() / 1000) + parseInt(expires_in) : 
        null;

      // Store the token
      await invoke('store_auth_token', {
        token: {
          access_token: token,
          refresh_token: refresh_token || null,
          expires_at: expiresAt,
          user_id: user_id || null
        }
      });

      // Fetch and store user profile
      await this.fetchAndStoreUserProfile(token);
      
      // Update auth state
      this.isAuthenticated = true;
      this.notifyListeners();
      
      console.log('Authentication successful');
    } catch (error) {
      console.error('Auth callback failed:', error);
      this.notifyListeners();
    }
  }

  async fetchAndStoreUserProfile(token) {
    try {
      // This would be an API call to your backend to get user profile
      // For now, we'll create a mock profile
      const userProfile = {
        id: 'user_' + Date.now(),
        email: 'user@example.com',
        name: 'Lokus User',
        avatar_url: null
      };

      await invoke('store_user_profile', { profile: userProfile });
      this.user = userProfile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  }

  async signIn() {
    try {
      const authUrl = `${this.authBaseUrl}/login`;
      await invoke('open_auth_url', { authUrl });
    } catch (error) {
      console.error('Failed to open auth URL:', error);
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
          await this.refreshToken(tokenData.refresh_token);
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

  async refreshToken(refreshToken) {
    try {
      // This would be an API call to your backend to refresh the token
      // For now, we'll just log it
      console.log('Token refresh not implemented yet');
      
      // In a real implementation:
      // const response = await fetch(`${this.authBaseUrl}/api/auth/refresh`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ refresh_token: refreshToken })
      // });
      // const data = await response.json();
      // await this.handleAuthCallback(data);
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