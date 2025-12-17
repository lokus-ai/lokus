import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useGmailAuth, useGmailQueue } from '../hooks/useGmail.js';
import gmailService from '../services/gmail.js';

const GmailContext = createContext(null);

/**
 * Gmail Context Provider
 * 
 * Provides global Gmail state management including authentication status,
 * current profile data, queue status, and centralized event handling.
 * 
 * This context acts as the single source of truth for Gmail state across
 * the entire application.
 */
export function GmailProvider({ children }) {
  // Core authentication state from useGmailAuth hook
  const gmailAuth = useGmailAuth();
  
  // Queue monitoring from useGmailQueue hook
  const gmailQueue = useGmailQueue();

  // Additional global state
  const [globalState, setGlobalState] = useState({
    isOnline: navigator.onLine,
    lastSync: null,
    syncInProgress: false,
    notifications: [],
    settings: {
      autoRefresh: true,
      refreshInterval: 300000, // 5 minutes
      enableNotifications: true,
      enableOfflineMode: true
    }
  });

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setGlobalState(prev => ({ ...prev, isOnline: true }));
      
      // Trigger queue processing when coming back online
      if (gmailAuth.isAuthenticated) {
        gmailQueue.processQueue().catch(() => {});
      }
    };

    const handleOffline = () => {
      setGlobalState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [gmailAuth.isAuthenticated, gmailQueue]);

  // Gmail-specific event listeners
  useEffect(() => {
    const listeners = [];

    const setupEventListeners = async () => {
      try {
        // Listen for Gmail sync events
        const syncListener = await listen('gmail-sync-status', (event) => {
          const { status, timestamp, error } = event.payload;
          
          setGlobalState(prev => ({
            ...prev,
            syncInProgress: status === 'in-progress',
            lastSync: status === 'completed' ? timestamp : prev.lastSync
          }));

          if (error) {
            addNotification({
              type: 'error',
              message: `Gmail sync failed: ${error}`,
              timestamp: Date.now()
            });
          }
        });
        listeners.push(syncListener);

        // Listen for new email notifications
        const emailListener = await listen('gmail-new-email', (event) => {
          const { email } = event.payload;
          
          if (globalState.settings.enableNotifications) {
            addNotification({
              type: 'info',
              message: `New email from ${email.from}: ${email.subject}`,
              timestamp: Date.now(),
              data: email
            });
          }
        });
        listeners.push(emailListener);

        // Listen for Gmail API rate limit warnings
        const rateLimitListener = await listen('gmail-rate-limit', (event) => {
          const { remaining, resetTime } = event.payload;
          
          if (remaining < 10) {
            addNotification({
              type: 'warning',
              message: `Gmail API rate limit approaching. ${remaining} requests remaining.`,
              timestamp: Date.now()
            });
          }
        });
        listeners.push(rateLimitListener);

        // Listen for authentication token refresh
        const tokenRefreshListener = await listen('gmail-token-refreshed', () => {
          gmailAuth.refreshAuth();
        });
        listeners.push(tokenRefreshListener);

      } catch { }
    };

    if (gmailAuth.isAuthenticated) {
      setupEventListeners();
    }

    return () => {
      listeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [gmailAuth.isAuthenticated, globalState.settings.enableNotifications]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!gmailAuth.isAuthenticated || !globalState.settings.autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      if (globalState.isOnline && !globalState.syncInProgress) {
        // Trigger background sync
        triggerBackgroundSync();
      }
    }, globalState.settings.refreshInterval);

    return () => clearInterval(interval);
  }, [
    gmailAuth.isAuthenticated,
    globalState.settings.autoRefresh,
    globalState.settings.refreshInterval,
    globalState.isOnline,
    globalState.syncInProgress
  ]);

  // Notification management
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = { ...notification, id };
    
    setGlobalState(prev => ({
      ...prev,
      notifications: [...prev.notifications, newNotification]
    }));

    // Auto-remove non-error notifications after 5 seconds
    if (notification.type !== 'error') {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setGlobalState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId)
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setGlobalState(prev => ({
      ...prev,
      notifications: []
    }));
  }, []);

  // Settings management
  const updateSettings = useCallback((newSettings) => {
    setGlobalState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  // Background sync operation
  const triggerBackgroundSync = useCallback(async () => {
    if (!gmailAuth.isAuthenticated || globalState.syncInProgress) {
      return;
    }

    try {
      setGlobalState(prev => ({ ...prev, syncInProgress: true }));
      
      // This would trigger a background sync operation
      // The actual implementation would depend on the backend capabilities
      
      // Process any queued operations
      await gmailQueue.processQueue();
      
      setGlobalState(prev => ({
        ...prev,
        syncInProgress: false,
        lastSync: Date.now()
      }));
      
    } catch (error) {
      setGlobalState(prev => ({ ...prev, syncInProgress: false }));
      
      addNotification({
        type: 'error',
        message: `Background sync failed: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }, [gmailAuth.isAuthenticated, globalState.syncInProgress, gmailQueue, addNotification]);

  // Gmail status summary
  const getGmailStatus = useCallback(() => {
    return {
      isAuthenticated: gmailAuth.isAuthenticated,
      isOnline: globalState.isOnline,
      syncInProgress: globalState.syncInProgress,
      lastSync: globalState.lastSync,
      pendingOperations: gmailQueue.stats.pending,
      failedOperations: gmailQueue.stats.failed,
      hasErrors: gmailQueue.stats.failed > 0 || gmailAuth.error || gmailQueue.error,
      connectionStatus: gmailAuth.isAuthenticated 
        ? (globalState.isOnline ? 'connected' : 'offline')
        : 'disconnected'
    };
  }, [
    gmailAuth.isAuthenticated,
    gmailAuth.error,
    globalState.isOnline,
    globalState.syncInProgress,
    globalState.lastSync,
    gmailQueue.stats.pending,
    gmailQueue.stats.failed,
    gmailQueue.error
  ]);

  // Force refresh all Gmail data
  const refreshAllData = useCallback(async () => {
    if (!gmailAuth.isAuthenticated) {
      throw new Error('Not authenticated with Gmail');
    }

    try {
      setGlobalState(prev => ({ ...prev, syncInProgress: true }));
      
      // Refresh auth status and profile
      await gmailAuth.refreshAuth();
      
      // Refresh queue stats
      await gmailQueue.refreshStats();
      
      // Trigger background sync
      await triggerBackgroundSync();
      
    } catch (error) {
      throw error;
    } finally {
      setGlobalState(prev => ({ ...prev, syncInProgress: false }));
    }
  }, [gmailAuth, gmailQueue, triggerBackgroundSync]);

  // Context value
  const contextValue = {
    // Authentication
    auth: {
      ...gmailAuth,
      isAuthenticating: gmailAuth.isLoading
    },
    
    // Queue management
    queue: gmailQueue,
    
    // Global state
    isOnline: globalState.isOnline,
    lastSync: globalState.lastSync,
    syncInProgress: globalState.syncInProgress,
    settings: globalState.settings,
    
    // Notifications
    notifications: globalState.notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    
    // Settings
    updateSettings,
    
    // Operations
    triggerBackgroundSync,
    refreshAllData,
    getGmailStatus,
    
    // Service access
    service: gmailService
  };

  return (
    <GmailContext.Provider value={contextValue}>
      {children}
    </GmailContext.Provider>
  );
}

/**
 * Hook to access Gmail context
 * 
 * @returns {Object} Gmail context value
 * @throws {Error} If used outside of GmailProvider
 */
export function useGmail() {
  const context = useContext(GmailContext);
  
  if (!context) {
    throw new Error('useGmail must be used within a GmailProvider');
  }
  
  return context;
}

/**
 * Hook for Gmail authentication state only
 * 
 * @returns {Object} Gmail authentication state and methods
 */
export function useGmailAuthContext() {
  const { auth } = useGmail();
  return auth;
}

/**
 * Hook for Gmail queue management only
 * 
 * @returns {Object} Gmail queue state and methods
 */
export function useGmailQueueContext() {
  const { queue } = useGmail();
  return queue;
}

/**
 * Hook for Gmail connection status
 * 
 * @returns {Object} Connection and sync status
 */
export function useGmailStatus() {
  const context = useGmail();
  
  return {
    status: context.getGmailStatus(),
    isOnline: context.isOnline,
    syncInProgress: context.syncInProgress,
    lastSync: context.lastSync,
    refresh: context.refreshAllData
  };
}

/**
 * Hook for Gmail notifications
 * 
 * @returns {Object} Notifications state and management methods
 */
export function useGmailNotifications() {
  const context = useGmail();
  
  return {
    notifications: context.notifications,
    addNotification: context.addNotification,
    removeNotification: context.removeNotification,
    clearAll: context.clearAllNotifications
  };
}

/**
 * Hook for Gmail settings
 * 
 * @returns {Object} Settings state and update method
 */
export function useGmailSettings() {
  const context = useGmail();
  
  return {
    settings: context.settings,
    updateSettings: context.updateSettings
  };
}

export default GmailContext;