import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useCalendarAuth, useCalendars, useUpcomingEvents } from '../hooks/useCalendar.js';
import calendarService from '../services/calendar.js';

const CalendarContext = createContext(null);

/**
 * Calendar Context Provider
 *
 * Provides global calendar state management including authentication status,
 * connected accounts, calendars, events, and sync status.
 *
 * This context acts as the single source of truth for calendar state across
 * the entire application.
 */
export function CalendarProvider({ children }) {
  // Core authentication state
  const auth = useCalendarAuth();

  // Calendars state
  const calendarsHook = useCalendars();

  // Upcoming events (next 7 days)
  const upcomingEventsHook = useUpcomingEvents(7);

  // Global state for sync and settings
  const [globalState, setGlobalState] = useState({
    isOnline: navigator.onLine,
    lastSync: null,
    syncInProgress: false,
    settings: {
      autoSync: true,
      syncInterval: 300000, // 5 minutes
      defaultCalendarId: null,
      showWeekNumbers: false,
      firstDayOfWeek: 0, // Sunday
      defaultView: 'month'
    }
  });

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setGlobalState(prev => ({ ...prev, isOnline: true }));

      // Trigger sync when coming back online
      if (auth.isAuthenticated) {
        triggerSync().catch(() => {});
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
  }, [auth.isAuthenticated]);

  // Calendar event listeners
  useEffect(() => {
    const listeners = [];

    const setupEventListeners = async () => {
      try {
        // Listen for auth success
        const authListener = await calendarService.listeners.onAuthSuccess(async (event) => {
          // Refresh calendars after successful auth
          await calendarsHook.loadCalendars(true);
          await upcomingEventsHook.refreshEvents();
        });
        listeners.push(authListener);

        // Listen for sync complete
        const syncListener = await calendarService.listeners.onSyncComplete((event) => {
          setGlobalState(prev => ({
            ...prev,
            syncInProgress: false,
            lastSync: new Date().toISOString()
          }));
        });
        listeners.push(syncListener);

        // Listen for disconnect
        const disconnectListener = await calendarService.listeners.onDisconnected(() => {
          // Clear calendars and events on disconnect
          calendarsHook.loadCalendars();
        });
        listeners.push(disconnectListener);

        // Listen for CalDAV connected
        const caldavListener = await calendarService.listeners.onCaldavConnected(async () => {
          console.log('[CalendarContext] CalDAV connected, refreshing data');
          await calendarsHook.loadCalendars(true);
          await upcomingEventsHook.refreshEvents();
        });
        listeners.push(caldavListener);

      } catch (err) {
        console.error('CalendarContext: Failed to set up event listeners', err);
      }
    };

    // Always set up listeners - we need to catch caldav-connected even when not yet authenticated
    setupEventListeners();

    return () => {
      listeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, []); // Empty deps - set up once on mount

  // Load calendars when authenticated, then load events
  useEffect(() => {
    const loadData = async () => {
      if (auth.isAuthenticated && !auth.isLoading) {
        await calendarsHook.loadCalendars();
        // Refresh upcoming events after calendars are loaded
        await upcomingEventsHook.refreshEvents();
      }
    };
    loadData();
  }, [auth.isAuthenticated, auth.isLoading]);

  // Auto-sync functionality
  useEffect(() => {
    if (!auth.isAuthenticated || !globalState.settings.autoSync) {
      return;
    }

    const interval = setInterval(() => {
      if (globalState.isOnline && !globalState.syncInProgress) {
        triggerSync().catch(() => {});
      }
    }, globalState.settings.syncInterval);

    return () => clearInterval(interval);
  }, [
    auth.isAuthenticated,
    globalState.settings.autoSync,
    globalState.settings.syncInterval,
    globalState.isOnline,
    globalState.syncInProgress
  ]);

  // Sync operation
  const triggerSync = useCallback(async () => {
    if (!auth.isAuthenticated || globalState.syncInProgress) {
      return;
    }

    try {
      setGlobalState(prev => ({ ...prev, syncInProgress: true }));

      await calendarService.sync.syncCalendars();
      await calendarsHook.refreshCalendars();
      await upcomingEventsHook.refreshEvents();

      setGlobalState(prev => ({
        ...prev,
        syncInProgress: false,
        lastSync: new Date().toISOString()
      }));

    } catch (error) {
      setGlobalState(prev => ({ ...prev, syncInProgress: false }));
      throw error;
    }
  }, [auth.isAuthenticated, globalState.syncInProgress, calendarsHook, upcomingEventsHook]);

  // Settings management
  const updateSettings = useCallback((newSettings) => {
    setGlobalState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  // Get default/primary calendar for creating events
  const getDefaultCalendar = useCallback(() => {
    if (globalState.settings.defaultCalendarId) {
      return calendarsHook.calendars.find(c => c.id === globalState.settings.defaultCalendarId);
    }
    return calendarsHook.getPrimaryCalendar();
  }, [globalState.settings.defaultCalendarId, calendarsHook.calendars, calendarsHook.getPrimaryCalendar]);

  // Get writable calendars (for creating events)
  const getWritableCalendars = useCallback(() => {
    return calendarsHook.calendars.filter(c => c.is_writable);
  }, [calendarsHook.calendars]);

  // Calendar status summary
  const getCalendarStatus = useCallback(() => {
    return {
      isAuthenticated: auth.isAuthenticated,
      isOnline: globalState.isOnline,
      syncInProgress: globalState.syncInProgress,
      lastSync: globalState.lastSync,
      calendarsCount: calendarsHook.calendars.length,
      upcomingEventsCount: upcomingEventsHook.events.length,
      hasErrors: auth.error || calendarsHook.error || upcomingEventsHook.error,
      connectionStatus: auth.isAuthenticated
        ? (globalState.isOnline ? 'connected' : 'offline')
        : 'disconnected'
    };
  }, [
    auth.isAuthenticated,
    auth.error,
    globalState.isOnline,
    globalState.syncInProgress,
    globalState.lastSync,
    calendarsHook.calendars.length,
    calendarsHook.error,
    upcomingEventsHook.events.length,
    upcomingEventsHook.error
  ]);

  // Today's events
  const todayEvents = useMemo(() => {
    return upcomingEventsHook.todayEvents;
  }, [upcomingEventsHook.todayEvents]);

  // Context value
  const contextValue = {
    // Authentication
    isAuthenticated: auth.isAuthenticated,
    account: auth.account,
    authLoading: auth.isLoading,
    authError: auth.error,
    providers: auth.providers,  // { google: boolean, caldav: boolean }
    connectGoogle: auth.connectGoogle,
    disconnect: auth.disconnect,

    // Calendars
    calendars: calendarsHook.calendars,
    calendarsLoading: calendarsHook.isLoading,
    calendarsError: calendarsHook.error,
    refreshCalendars: calendarsHook.refreshCalendars,
    updateCalendarVisibility: calendarsHook.updateVisibility,
    getVisibleCalendars: calendarsHook.getVisibleCalendars,
    getPrimaryCalendar: calendarsHook.getPrimaryCalendar,
    getDefaultCalendar,
    getWritableCalendars,

    // Upcoming Events
    upcomingEvents: upcomingEventsHook.events,
    upcomingEventsLoading: upcomingEventsHook.isLoading,
    upcomingEventsError: upcomingEventsHook.error,
    eventsByDate: upcomingEventsHook.eventsByDate,
    todayEvents,
    refreshUpcomingEvents: upcomingEventsHook.refreshEvents,

    // Global state
    isOnline: globalState.isOnline,
    lastSync: globalState.lastSync,
    syncInProgress: globalState.syncInProgress,
    settings: globalState.settings,

    // Operations
    triggerSync,
    updateSettings,
    getCalendarStatus,

    // Service access for advanced usage
    service: calendarService
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
}

/**
 * Hook to access Calendar context
 *
 * @returns {Object} Calendar context value
 * @throws {Error} If used outside of CalendarProvider
 */
export function useCalendarContext() {
  const context = useContext(CalendarContext);

  if (!context) {
    throw new Error('useCalendarContext must be used within a CalendarProvider');
  }

  return context;
}

/**
 * Hook for Calendar authentication state only
 *
 * @returns {Object} Calendar authentication state and methods
 */
export function useCalendarAuthContext() {
  const context = useCalendarContext();

  return {
    isAuthenticated: context.isAuthenticated,
    account: context.account,
    isLoading: context.authLoading,
    error: context.authError,
    connectGoogle: context.connectGoogle,
    disconnect: context.disconnect
  };
}

/**
 * Hook for Calendar connection status
 *
 * @returns {Object} Connection and sync status
 */
export function useCalendarStatus() {
  const context = useCalendarContext();

  return {
    status: context.getCalendarStatus(),
    isOnline: context.isOnline,
    syncInProgress: context.syncInProgress,
    lastSync: context.lastSync,
    sync: context.triggerSync
  };
}

/**
 * Hook for Calendar settings
 *
 * @returns {Object} Settings state and update method
 */
export function useCalendarSettings() {
  const context = useCalendarContext();

  return {
    settings: context.settings,
    updateSettings: context.updateSettings
  };
}

/**
 * Hook for today's events
 *
 * @returns {Object} Today's events and refresh method
 */
export function useTodayEvents() {
  const context = useCalendarContext();

  return {
    events: context.todayEvents,
    isLoading: context.upcomingEventsLoading,
    error: context.upcomingEventsError,
    refresh: context.refreshUpcomingEvents
  };
}

/**
 * Hook for upcoming events
 *
 * @returns {Object} Upcoming events grouped by date
 */
export function useUpcomingEventsContext() {
  const context = useCalendarContext();

  return {
    events: context.upcomingEvents,
    eventsByDate: context.eventsByDate,
    isLoading: context.upcomingEventsLoading,
    error: context.upcomingEventsError,
    refresh: context.refreshUpcomingEvents
  };
}

export default CalendarContext;
