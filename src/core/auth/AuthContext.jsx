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
    console.log('🔄 AuthProvider: Setting up auth state subscription...');
    
    // Subscribe to auth state changes
    const unsubscribe = authManager.onAuthStateChange((newState) => {
      console.log('🔄 AuthProvider: Received auth state change:', newState);
      setAuthState(prev => {
        const newAuthState = {
          ...prev,
          isAuthenticated: newState.isAuthenticated,
          user: newState.user,
          isLoading: false
        };
        console.log('🔄 AuthProvider: Setting new auth state:', newAuthState);
        return newAuthState;
      });
    });

    // Initial state check
    console.log('🔄 AuthProvider: Performing initial auth status check...');
    authManager.checkAuthStatus().then(() => {
      console.log('🔄 AuthProvider: Initial check complete. AuthManager state:', {
        isLoggedIn: authManager.isLoggedIn,
        currentUser: authManager.currentUser
      });
      setAuthState(prev => {
        const newAuthState = {
          ...prev,
          isAuthenticated: authManager.isLoggedIn,
          user: authManager.currentUser,
          isLoading: false
        };
        console.log('🔄 AuthProvider: Setting initial auth state:', newAuthState);
        return newAuthState;
      });
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await authManager.signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authManager.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  const getAccessToken = async () => {
    return await authManager.getAccessToken();
  };

  const authenticatedFetch = async (url, options) => {
    return await authManager.authenticatedFetch(url, options);
  };

  const value = {
    ...authState,
    signIn,
    signOut,
    getAccessToken,
    authenticatedFetch
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;