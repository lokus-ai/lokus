import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { logger } from '../utils/logger.js';

/**
 * Calendar Service Module
 *
 * Provides a clean wrapper around Calendar Tauri commands with error handling,
 * logging, and consistent API interface.
 */

// Calendar authentication operations
export const calendarAuth = {
  /**
   * Initiate Google Calendar OAuth authentication flow
   * @returns {Promise<string>} - Auth URL to open in browser
   */
  async initiateGoogleAuth() {
    try {
      const authUrl = await invoke('google_calendar_auth_start');
      return authUrl;
    } catch (error) {
      logger.error('Calendar', 'Failed to initiate Google auth:', error);
      throw new Error(`Calendar authentication initiation failed: ${error}`);
    }
  },

  /**
   * Complete Google Calendar OAuth authentication with authorization code
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} state - State parameter for CSRF protection
   * @returns {Promise<Object>} - Account information
   */
  async completeGoogleAuth(code, state) {
    try {
      const account = await invoke('google_calendar_auth_complete', { code, state });
      return account;
    } catch (error) {
      logger.error('Calendar', 'Failed to complete Google auth:', error);
      throw new Error(`Calendar authentication completion failed: ${error}`);
    }
  },

  /**
   * Check for OAuth callback and complete auth if available
   * @returns {Promise<Object|null>} - Account info if auth completed, null otherwise
   */
  async checkAuthCallback() {
    try {
      const result = await invoke('google_calendar_check_auth_callback');
      return result;
    } catch (error) {
      logger.error('Calendar', 'Failed to check auth callback:', error);
      throw error;
    }
  },

  /**
   * Check if Google Calendar is authenticated
   * @returns {Promise<boolean>} - Authentication status
   */
  async isGoogleAuthenticated() {
    try {
      console.log('[calendarService] Checking Google auth status...');
      const isAuth = await invoke('google_calendar_auth_status');
      console.log('[calendarService] isGoogleAuthenticated:', isAuth);
      return isAuth;
    } catch (error) {
      console.error('[calendarService] isGoogleAuthenticated error:', error);
      logger.error('Calendar', 'Failed to check Google auth status:', error);
      return false;
    }
  },

  /**
   * Get the connected Google Calendar account
   * @returns {Promise<Object|null>} - Account info or null if not connected
   */
  async getGoogleAccount() {
    try {
      const account = await invoke('google_calendar_get_account');
      return account;
    } catch (error) {
      logger.error('Calendar', 'Failed to get Google account:', error);
      return null;
    }
  },

  /**
   * Disconnect a calendar provider
   * @param {string} provider - Provider name ('google' or 'caldav')
   * @returns {Promise<void>}
   */
  async disconnect(provider) {
    try {
      await invoke('calendar_disconnect', { provider });
    } catch (error) {
      logger.error('Calendar', `Failed to disconnect ${provider}:`, error);
      throw new Error(`Calendar disconnect failed: ${error}`);
    }
  }
};

// Calendar operations
export const calendars = {
  /**
   * Get all calendars from connected accounts
   * @returns {Promise<Array>} - Array of calendar objects
   */
  async getCalendars() {
    try {
      const calendarList = await invoke('get_calendars');
      return calendarList;
    } catch (error) {
      logger.error('Calendar', 'Failed to get calendars:', error);
      throw new Error(`Failed to fetch calendars: ${error}`);
    }
  },

  /**
   * Get cached calendars (no API call)
   * @returns {Promise<Array>} - Array of cached calendar objects
   */
  async getCachedCalendars() {
    try {
      const calendarList = await invoke('get_cached_calendars');
      return calendarList;
    } catch (error) {
      logger.error('Calendar', 'Failed to get cached calendars:', error);
      return [];
    }
  },

  /**
   * Update calendar visibility
   * @param {string} calendarId - Calendar ID
   * @param {boolean} visible - Visibility state
   * @returns {Promise<void>}
   */
  async updateVisibility(calendarId, visible) {
    try {
      await invoke('update_calendar_visibility', { calendarId, visible });
    } catch (error) {
      logger.error('Calendar', 'Failed to update calendar visibility:', error);
      throw new Error(`Failed to update calendar visibility: ${error}`);
    }
  }
};

// Event operations
export const events = {
  /**
   * Get events from a calendar within a time range
   * @param {string} calendarId - Calendar ID
   * @param {Date|string} start - Start date/time
   * @param {Date|string} end - End date/time
   * @param {number} maxResults - Maximum number of results
   * @returns {Promise<Array>} - Array of event objects
   */
  async getEvents(calendarId, start, end, maxResults = null) {
    try {
      const startStr = start instanceof Date ? start.toISOString() : start;
      const endStr = end instanceof Date ? end.toISOString() : end;

      const eventList = await invoke('get_events', {
        calendarId,
        start: startStr,
        end: endStr,
        maxResults
      });
      return eventList;
    } catch (error) {
      logger.error('Calendar', 'Failed to get events:', error);
      throw new Error(`Failed to fetch events: ${error}`);
    }
  },

  /**
   * Get events from all visible calendars
   * @param {Date|string} start - Start date/time
   * @param {Date|string} end - End date/time
   * @returns {Promise<Array>} - Array of event objects from all calendars
   */
  async getAllEvents(start, end) {
    try {
      const startStr = start instanceof Date ? start.toISOString() : start;
      const endStr = end instanceof Date ? end.toISOString() : end;

      console.log('[calendarService] getAllEvents invoking backend:', startStr, 'to', endStr);
      const eventList = await invoke('get_all_events', {
        start: startStr,
        end: endStr
      });
      console.log('[calendarService] getAllEvents result:', eventList.length, 'events');
      return eventList;
    } catch (error) {
      console.error('[calendarService] getAllEvents error:', error);
      logger.error('Calendar', 'Failed to get all events:', error);
      throw new Error(`Failed to fetch all events: ${error}`);
    }
  },

  /**
   * Create a new event
   * @param {string} calendarId - Calendar ID
   * @param {Object} event - Event data
   * @returns {Promise<Object>} - Created event
   */
  async createEvent(calendarId, event) {
    try {
      const createdEvent = await invoke('create_event', {
        calendarId,
        event: {
          title: event.title,
          description: event.description || null,
          start: event.start instanceof Date ? event.start.toISOString() : event.start,
          end: event.end instanceof Date ? event.end.toISOString() : event.end,
          all_day: event.allDay || false,
          location: event.location || null,
          attendees: event.attendees || null,
          recurrence_rule: event.recurrenceRule || null
        }
      });
      return createdEvent;
    } catch (error) {
      logger.error('Calendar', 'Failed to create event:', error);
      throw new Error(`Failed to create event: ${error}`);
    }
  },

  /**
   * Update an existing event
   * @param {string} calendarId - Calendar ID
   * @param {string} eventId - Event ID
   * @param {Object} updates - Event updates
   * @returns {Promise<Object>} - Updated event
   */
  async updateEvent(calendarId, eventId, updates) {
    try {
      const updatedEvent = await invoke('update_event', {
        calendarId,
        eventId,
        updates: {
          title: updates.title,
          description: updates.description,
          start: updates.start instanceof Date ? updates.start.toISOString() : updates.start,
          end: updates.end instanceof Date ? updates.end.toISOString() : updates.end,
          all_day: updates.allDay,
          location: updates.location,
          attendees: updates.attendees,
          recurrence_rule: updates.recurrenceRule,
          status: updates.status
        }
      });
      return updatedEvent;
    } catch (error) {
      logger.error('Calendar', 'Failed to update event:', error);
      throw new Error(`Failed to update event: ${error}`);
    }
  },

  /**
   * Delete an event
   * @param {string} calendarId - Calendar ID
   * @param {string} eventId - Event ID
   * @returns {Promise<void>}
   */
  async deleteEvent(calendarId, eventId) {
    try {
      await invoke('delete_event', { calendarId, eventId });
    } catch (error) {
      logger.error('Calendar', 'Failed to delete event:', error);
      throw new Error(`Failed to delete event: ${error}`);
    }
  }
};

// Sync operations
export const sync = {
  /**
   * Get sync status
   * @returns {Promise<Object>} - Sync status
   */
  async getStatus() {
    try {
      const status = await invoke('get_sync_status');
      return status;
    } catch (error) {
      logger.error('Calendar', 'Failed to get sync status:', error);
      return { is_syncing: false, last_sync: null, pending_changes: 0, error: error.message };
    }
  },

  /**
   * Manually trigger a sync
   * @returns {Promise<Object>} - Sync result
   */
  async syncCalendars() {
    try {
      const result = await invoke('sync_calendars');
      return result;
    } catch (error) {
      logger.error('Calendar', 'Failed to sync calendars:', error);
      throw new Error(`Failed to sync calendars: ${error}`);
    }
  }
};

// Event listeners
export const calendarEvents = {
  /**
   * Listen for calendar auth success events
   * @param {Function} callback - Callback function
   * @returns {Promise<Function>} - Unsubscribe function
   */
  async onAuthSuccess(callback) {
    return await listen('calendar-auth-success', callback);
  },

  /**
   * Listen for calendar disconnect events
   * @param {Function} callback - Callback function
   * @returns {Promise<Function>} - Unsubscribe function
   */
  async onDisconnected(callback) {
    return await listen('calendar-disconnected', callback);
  },

  /**
   * Listen for sync complete events
   * @param {Function} callback - Callback function
   * @returns {Promise<Function>} - Unsubscribe function
   */
  async onSyncComplete(callback) {
    return await listen('calendar-sync-complete', callback);
  }
};

// Combined calendar service object
export const calendarService = {
  auth: calendarAuth,
  calendars,
  events,
  sync,
  listeners: calendarEvents
};

// Default export
export default calendarService;

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id - Event ID
 * @property {string} calendar_id - Calendar ID
 * @property {string} provider - Provider name ('google' or 'caldav')
 * @property {string} title - Event title
 * @property {string} description - Event description
 * @property {string} start - Start date/time (ISO string)
 * @property {string} end - End date/time (ISO string)
 * @property {boolean} all_day - Whether it's an all-day event
 * @property {string} location - Event location
 * @property {Array} attendees - Array of attendee objects
 * @property {string} recurrence_rule - RRULE string
 * @property {string} status - Event status ('confirmed', 'tentative', 'cancelled')
 * @property {string} html_link - Link to event in calendar provider
 */

/**
 * @typedef {Object} Calendar
 * @property {string} id - Calendar ID
 * @property {string} provider - Provider name
 * @property {string} name - Calendar name
 * @property {string} color - Calendar color (hex)
 * @property {boolean} is_primary - Whether it's the primary calendar
 * @property {boolean} is_writable - Whether events can be created
 * @property {boolean} visible - Whether to show events from this calendar
 */

/**
 * @typedef {Object} CalendarAccount
 * @property {string} id - Account ID
 * @property {string} provider - Provider name
 * @property {string} email - Account email
 * @property {boolean} is_connected - Connection status
 * @property {string} connected_at - Connection timestamp
 */
