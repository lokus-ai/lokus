import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import calendarService from '../services/calendar.js';

/**
 * Calendar Authentication Hook
 *
 * Manages calendar authentication state, login/logout operations
 * and provides authentication status monitoring.
 */
export function useCalendarAuth() {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    account: null,
    isLoading: true,
    error: null
  });

  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const isAuth = await calendarService.auth.isGoogleAuthenticated();

      if (isAuth) {
        const account = await calendarService.auth.getGoogleAccount();
        setAuthState({
          isAuthenticated: true,
          account,
          isLoading: false,
          error: null
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          account: null,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        account: null,
        isLoading: false,
        error: error.message
      });
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Listen for auth events
  useEffect(() => {
    let unsubscribeSuccess = null;
    let unsubscribeDisconnect = null;

    const setupListeners = async () => {
      try {
        unsubscribeSuccess = await calendarService.listeners.onAuthSuccess(() => {
          checkAuthStatus();
        });

        unsubscribeDisconnect = await calendarService.listeners.onDisconnected(() => {
          setAuthState({
            isAuthenticated: false,
            account: null,
            isLoading: false,
            error: null
          });
        });
      } catch (err) {
        console.error('useCalendarAuth: Failed to set up listeners', err);
      }
    };

    setupListeners();

    return () => {
      if (unsubscribeSuccess) unsubscribeSuccess();
      if (unsubscribeDisconnect) unsubscribeDisconnect();
    };
  }, [checkAuthStatus]);

  const connectGoogle = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const authUrl = await calendarService.auth.initiateGoogleAuth();

      // Open auth URL in default browser
      await open(authUrl);

      // Start polling for callback
      const pollInterval = setInterval(async () => {
        try {
          const account = await calendarService.auth.checkAuthCallback();
          if (account) {
            clearInterval(pollInterval);
            setAuthState({
              isAuthenticated: true,
              account,
              isLoading: false,
              error: null
            });
          }
        } catch (err) {
          clearInterval(pollInterval);
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
            error: err.message
          }));
        }
      }, 1000); // Poll every second

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setAuthState(prev => {
          if (prev.isLoading) {
            return { ...prev, isLoading: false, error: 'Authentication timed out' };
          }
          return prev;
        });
      }, 300000);

      return authUrl;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const completeAuth = useCallback(async (code, state) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const account = await calendarService.auth.completeGoogleAuth(code, state);

      setAuthState({
        isAuthenticated: true,
        account,
        isLoading: false,
        error: null
      });

      return account;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async (provider = 'google') => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      await calendarService.auth.disconnect(provider);

      setAuthState({
        isAuthenticated: false,
        account: null,
        isLoading: false,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  return {
    ...authState,
    connectGoogle,
    completeAuth,
    disconnect,
    refreshAuth: checkAuthStatus
  };
}

/**
 * Calendars Hook
 *
 * Manages calendar list and visibility settings.
 */
export function useCalendars() {
  const [calendarState, setCalendarState] = useState({
    calendars: [],
    isLoading: false,
    error: null
  });

  const loadCalendars = useCallback(async (forceRefresh = false) => {
    try {
      setCalendarState(prev => ({ ...prev, isLoading: true, error: null }));

      let calendarList;
      if (forceRefresh) {
        calendarList = await calendarService.calendars.getCalendars();
      } else {
        // Try cached first, then fetch if empty
        calendarList = await calendarService.calendars.getCachedCalendars();
        if (calendarList.length === 0) {
          calendarList = await calendarService.calendars.getCalendars();
        }
      }

      setCalendarState({
        calendars: calendarList,
        isLoading: false,
        error: null
      });

      return calendarList;
    } catch (error) {
      setCalendarState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const updateVisibility = useCallback(async (calendarId, visible) => {
    try {
      await calendarService.calendars.updateVisibility(calendarId, visible);

      // Update local state
      setCalendarState(prev => ({
        ...prev,
        calendars: prev.calendars.map(cal =>
          cal.id === calendarId ? { ...cal, visible } : cal
        )
      }));
    } catch (error) {
      throw error;
    }
  }, []);

  const getVisibleCalendars = useCallback(() => {
    return calendarState.calendars.filter(cal => cal.visible);
  }, [calendarState.calendars]);

  const getPrimaryCalendar = useCallback(() => {
    return calendarState.calendars.find(cal => cal.is_primary);
  }, [calendarState.calendars]);

  return {
    ...calendarState,
    loadCalendars,
    refreshCalendars: () => loadCalendars(true),
    updateVisibility,
    getVisibleCalendars,
    getPrimaryCalendar
  };
}

/**
 * Calendar Events Hook
 *
 * Manages event fetching, creating, updating, and deleting.
 */
export function useCalendarEvents(initialDateRange = null) {
  const [eventState, setEventState] = useState({
    events: [],
    isLoading: false,
    error: null
  });

  const [dateRange, setDateRange] = useState(initialDateRange || getDefaultDateRange());

  const loadEvents = useCallback(async (start, end) => {
    try {
      setEventState(prev => ({ ...prev, isLoading: true, error: null }));

      const events = await calendarService.events.getAllEvents(start, end);

      setEventState({
        events,
        isLoading: false,
        error: null
      });

      return events;
    } catch (error) {
      setEventState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const loadEventsForCalendar = useCallback(async (calendarId, start, end, maxResults = null) => {
    try {
      return await calendarService.events.getEvents(calendarId, start, end, maxResults);
    } catch (error) {
      throw error;
    }
  }, []);

  const createEvent = useCallback(async (calendarId, event) => {
    try {
      const newEvent = await calendarService.events.createEvent(calendarId, event);

      // Add to local state
      setEventState(prev => ({
        ...prev,
        events: [...prev.events, newEvent].sort((a, b) =>
          new Date(a.start) - new Date(b.start)
        )
      }));

      return newEvent;
    } catch (error) {
      throw error;
    }
  }, []);

  const updateEvent = useCallback(async (calendarId, eventId, updates) => {
    try {
      const updatedEvent = await calendarService.events.updateEvent(calendarId, eventId, updates);

      // Update local state
      setEventState(prev => ({
        ...prev,
        events: prev.events.map(evt =>
          evt.id === eventId ? updatedEvent : evt
        ).sort((a, b) => new Date(a.start) - new Date(b.start))
      }));

      return updatedEvent;
    } catch (error) {
      throw error;
    }
  }, []);

  const deleteEvent = useCallback(async (calendarId, eventId) => {
    try {
      await calendarService.events.deleteEvent(calendarId, eventId);

      // Remove from local state
      setEventState(prev => ({
        ...prev,
        events: prev.events.filter(evt => evt.id !== eventId)
      }));
    } catch (error) {
      throw error;
    }
  }, []);

  const refreshEvents = useCallback(() => {
    if (dateRange) {
      return loadEvents(dateRange.start, dateRange.end);
    }
  }, [dateRange, loadEvents]);

  // Load events when date range changes
  useEffect(() => {
    if (dateRange) {
      loadEvents(dateRange.start, dateRange.end);
    }
  }, [dateRange, loadEvents]);

  // Listen for sync events
  useEffect(() => {
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        unsubscribe = await calendarService.listeners.onSyncComplete(() => {
          refreshEvents();
        });
      } catch (err) {
        console.error('useCalendarEvents: Failed to set up sync listener', err);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [refreshEvents]);

  return {
    ...eventState,
    dateRange,
    setDateRange,
    loadEvents,
    loadEventsForCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents
  };
}

/**
 * Combined Calendar Hook
 *
 * Provides all calendar functionality in one hook.
 */
export function useCalendar() {
  const auth = useCalendarAuth();
  const calendars = useCalendars();
  const events = useCalendarEvents();

  // Load calendars when authenticated
  useEffect(() => {
    if (auth.isAuthenticated && !calendars.isLoading) {
      calendars.loadCalendars();
    }
  }, [auth.isAuthenticated]);

  const sync = useCallback(async () => {
    try {
      const result = await calendarService.sync.syncCalendars();
      await calendars.refreshCalendars();
      await events.refreshEvents();
      return result;
    } catch (error) {
      throw error;
    }
  }, [calendars.refreshCalendars, events.refreshEvents]);

  return {
    // Auth
    isAuthenticated: auth.isAuthenticated,
    account: auth.account,
    authLoading: auth.isLoading,
    authError: auth.error,
    connectGoogle: auth.connectGoogle,
    disconnect: auth.disconnect,

    // Calendars
    calendars: calendars.calendars,
    calendarsLoading: calendars.isLoading,
    calendarsError: calendars.error,
    loadCalendars: calendars.loadCalendars,
    refreshCalendars: calendars.refreshCalendars,
    updateCalendarVisibility: calendars.updateVisibility,
    getVisibleCalendars: calendars.getVisibleCalendars,
    getPrimaryCalendar: calendars.getPrimaryCalendar,

    // Events
    events: events.events,
    eventsLoading: events.isLoading,
    eventsError: events.error,
    dateRange: events.dateRange,
    setDateRange: events.setDateRange,
    loadEvents: events.loadEvents,
    createEvent: events.createEvent,
    updateEvent: events.updateEvent,
    deleteEvent: events.deleteEvent,
    refreshEvents: events.refreshEvents,

    // Sync
    sync
  };
}

/**
 * Upcoming Events Hook
 *
 * Specifically for fetching upcoming events (next 7 days).
 */
export function useUpcomingEvents(days = 7) {
  const [state, setState] = useState({
    events: [],
    isLoading: false,
    error: null
  });

  const loadUpcomingEvents = useCallback(async () => {
    try {
      console.log('[useUpcomingEvents] Loading upcoming events...');
      // Check if authenticated first
      const isAuth = await calendarService.auth.isGoogleAuthenticated();
      console.log('[useUpcomingEvents] isAuthenticated:', isAuth);
      if (!isAuth) {
        setState({ events: [], isLoading: false, error: null });
        return [];
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const now = new Date();
      const end = new Date();
      end.setDate(end.getDate() + days);

      console.log('[useUpcomingEvents] Fetching events from', now.toISOString(), 'to', end.toISOString());
      const events = await calendarService.events.getAllEvents(now, end);
      console.log('[useUpcomingEvents] Got events:', events.length, events);

      setState({
        events,
        isLoading: false,
        error: null
      });

      return events;
    } catch (error) {
      console.error('[useUpcomingEvents] Failed to load upcoming events:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      return [];
    }
  }, [days]);

  useEffect(() => {
    loadUpcomingEvents();
  }, [loadUpcomingEvents]);

  // Listen for sync events
  useEffect(() => {
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        unsubscribe = await calendarService.listeners.onSyncComplete(() => {
          loadUpcomingEvents();
        });
      } catch (err) {
        console.error('useUpcomingEvents: Failed to set up sync listener', err);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadUpcomingEvents]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = {};
    state.events.forEach(event => {
      const dateKey = new Date(event.start).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [state.events]);

  // Get today's events
  const todayEvents = useMemo(() => {
    const today = new Date().toDateString();
    return state.events.filter(event =>
      new Date(event.start).toDateString() === today
    );
  }, [state.events]);

  return {
    ...state,
    eventsByDate,
    todayEvents,
    refreshEvents: loadUpcomingEvents
  };
}

// Helper function to get default date range (current month)
function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

// Default export
export default useCalendar;
