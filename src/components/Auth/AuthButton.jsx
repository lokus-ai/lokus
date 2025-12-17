import React, { useState } from 'react';
import { User, LogIn, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';

export default function AuthButton() {
  const { isAuthenticated, user, signIn, signOut, isLoading } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Debug logging

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      // You could show a toast notification here
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      setShowDropdown(false);
    } catch { } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <div className="w-4 h-4 border-2 border-app-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-app-accent text-white rounded-md hover:bg-app-accent/90 transition-colors"
        title="Sign in to sync and collaborate"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Sign In</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-2 py-1.5 text-sm bg-app-panel hover:bg-app-panel/80 border border-app-border rounded-md transition-colors"
        title={user?.name || user?.email || 'Account'}
      >
        {user?.avatar_url ? (
          <img 
            src={user.avatar_url} 
            alt="Profile" 
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-app-accent rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        <span className="hidden sm:inline max-w-24 truncate">
          {user?.name || user?.email || 'User'}
        </span>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-app-panel border border-app-border rounded-md shadow-lg z-20">
            <div className="p-3 border-b border-app-border">
              <div className="font-medium text-app-text text-sm">
                {user?.name || 'User'}
              </div>
              <div className="text-xs text-app-muted">
                {user?.email || 'No email'}
              </div>
            </div>
            
            <div className="py-1">
              <button 
                className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-bg flex items-center gap-2"
                onClick={() => {
                  setShowDropdown(false);
                  // TODO: Open account settings
                }}
              >
                <Settings className="w-4 h-4" />
                Account Settings
              </button>
              
              <button 
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-app-bg flex items-center gap-2 disabled:opacity-50"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut className="w-4 h-4" />
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}