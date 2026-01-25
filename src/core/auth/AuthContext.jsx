import React, { createContext, useContext, useEffect, useState } from 'react';
import authManager from './AuthManager';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    isLoading: true
  });

  useEffect(() => {

    // Subscribe to auth state changes
    const unsubscribe = authManager.onAuthStateChange((newState) => {
      setAuthState(prev => {
        const newAuthState = {
          ...prev,
          isAuthenticated: newState.isAuthenticated,
          user: newState.user,
          isLoading: false
        };
        return newAuthState;
      });
    });

    // Initial state check
    authManager.checkAuthStatus().then(() => {
      setAuthState(prev => {
        const newAuthState = {
          ...prev,
          isAuthenticated: authManager.isLoggedIn,
          user: authManager.currentUser,
          isLoading: false
        };
        return newAuthState;
      });
    });

    return unsubscribe;
  }, []);

  // Legacy sign in (Google OAuth)
  const signIn = async () => {
    try {
      await authManager.signIn();
    } catch (error) {
      throw error;
    }
  };

  // Sign in with email and password
  const signInWithEmail = async (email, password) => {
    try {
      return await authManager.signInWithEmail(email, password);
    } catch (error) {
      throw error;
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email, password) => {
    try {
      return await authManager.signUpWithEmail(email, password);
    } catch (error) {
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      return await authManager.signInWithGoogle();
    } catch (error) {
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await authManager.signOut();
    } catch (error) {
      throw error;
    }
  };

  // Get access token
  const getAccessToken = async () => {
    return await authManager.getAccessToken();
  };

  // Authenticated fetch helper
  const authenticatedFetch = async (url, options) => {
    return await authManager.authenticatedFetch(url, options);
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      return await authManager.resetPassword(email);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    ...authState,
    signIn,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    getAccessToken,
    authenticatedFetch,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
