import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { logger } from '../utils/logger.js';
import { isMobile } from '../platform/index.js';

/**
 * Calendar Service Module
 *
 * Provides a clean wrapper around Calendar Tauri commands with error handling,
 * logging, and consistent API interface.
 *
 * Note: Calendar commands are desktop-only (#[cfg(desktop)] in Rust).
 * On mobile, these functions return sensible defaults.
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
    // Calendar commands are desktop-only
    if (isMobile()) {
      return false;
    }
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
   * Get deduplicated events from all visible calendars
   * Returns events with also_in info for duplicates and read-only status
   * @param {Date|string} start - Start date/time
   * @param {Date|string} end - End date/time
   * @returns {Promise<Array>} - Array of deduplicated event objects
   */
  async getAllEventsDeduplicated(start, end) {
    try {
      const startStr = start instanceof Date ? start.toISOString() : start;
      const endStr = end instanceof Date ? end.toISOString() : end;

      console.log('[calendarService] getAllEventsDeduplicated invoking backend:', startStr, 'to', endStr);
      const eventList = await invoke('get_all_events_deduplicated', {
        start: startStr,
        end: endStr
      });
      console.log('[calendarService] getAllEventsDeduplicated result:', eventList.length, 'events');
      return eventList;
    } catch (error) {
      console.error('[calendarService] getAllEventsDeduplicated error:', error);
      logger.error('Calendar', 'Failed to get deduplicated events:', error);
      // Fallback to regular getAllEvents
      const fallback = await this.getAllEvents(start, end);
      return fallback.map(event => ({
        event,
        also_in: [],
        is_read_only: false,
        fingerprint: ''
      }));
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
   * @param {string} [etag] - Optional ETag for CalDAV concurrency
   * @returns {Promise<Object>} - Updated event
   */
  async updateEvent(calendarId, eventId, updates, etag = null) {
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
        },
        etag
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
   * @param {string} [etag] - Optional ETag for CalDAV concurrency
   * @returns {Promise<void>}
   */
  async deleteEvent(calendarId, eventId, etag = null) {
    try {
      await invoke('delete_event', { calendarId, eventId, etag });
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
  },

  /**
   * Perform a full bidirectional sync with deduplication
   * @returns {Promise<Object>} - Full sync result
   */
  async fullSync() {
    try {
      const result = await invoke('sync_calendars_full');
      return result;
    } catch (error) {
      logger.error('Calendar', 'Failed to perform full sync:', error);
      throw new Error(`Failed to perform full sync: ${error}`);
    }
  },

  /**
   * Get sync configuration
   * @returns {Promise<Object>} - Sync config
   */
  async getConfig() {
    try {
      const config = await invoke('get_sync_config');
      return config;
    } catch (error) {
      logger.error('Calendar', 'Failed to get sync config:', error);
      return {
        enabled: true,
        deduplication_enabled: true,
        conflict_resolution: 'last_modified_wins',
        sync_pairs: [],
        auto_sync_interval_minutes: 15
      };
    }
  },

  /**
   * Set sync configuration
   * @param {Object} config - Sync config to save
   * @returns {Promise<void>}
   */
  async setConfig(config) {
    try {
      await invoke('set_sync_config', { config });
    } catch (error) {
      logger.error('Calendar', 'Failed to set sync config:', error);
      throw new Error(`Failed to set sync config: ${error}`);
    }
  },

  /**
   * Get sync state
   * @returns {Promise<Object>} - Sync state
   */
  async getState() {
    try {
      const state = await invoke('get_sync_state');
      return state;
    } catch (error) {
      logger.error('Calendar', 'Failed to get sync state:', error);
      return {
        last_full_sync: null,
        last_incremental_sync: null,
        sync_in_progress: false,
        pending_changes: 0,
        last_error: null
      };
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
  },

  /**
   * Listen for CalDAV connected events
   * @param {Function} callback - Callback function
   * @returns {Promise<Function>} - Unsubscribe function
   */
  async onCaldavConnected(callback) {
    return await listen('caldav-connected', callback);
  }
};

// iCal subscription operations
export const ical = {
  /**
   * Add an iCal subscription from URL
   * @param {string} url - iCal/webcal URL
   * @param {string} [name] - Optional display name
   * @param {string} [color] - Optional color (hex)
   * @returns {Promise<Object>} - Subscription object
   */
  async addSubscription(url, name = null, color = null) {
    try {
      const subscription = await invoke('ical_add_subscription', { url, name, color });
      return subscription;
    } catch (error) {
      logger.error('iCal', 'Failed to add subscription:', error);
      throw new Error(`Failed to add iCal subscription: ${error}`);
    }
  },

  /**
   * Import iCal from local file
   * @param {string} path - File path
   * @param {string} [name] - Optional display name
   * @param {string} [color] - Optional color (hex)
   * @returns {Promise<Object>} - Subscription object
   */
  async importFile(path, name = null, color = null) {
    try {
      const subscription = await invoke('ical_import_file', { path, name, color });
      return subscription;
    } catch (error) {
      logger.error('iCal', 'Failed to import file:', error);
      throw new Error(`Failed to import iCal file: ${error}`);
    }
  },

  /**
   * Remove an iCal subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<void>}
   */
  async removeSubscription(subscriptionId) {
    try {
      await invoke('ical_remove_subscription', { subscriptionId });
    } catch (error) {
      logger.error('iCal', 'Failed to remove subscription:', error);
      throw new Error(`Failed to remove iCal subscription: ${error}`);
    }
  },

  /**
   * Get all iCal subscriptions
   * @returns {Promise<Array>} - Array of subscription objects
   */
  async getSubscriptions() {
    try {
      const subscriptions = await invoke('ical_get_subscriptions');
      return subscriptions;
    } catch (error) {
      logger.error('iCal', 'Failed to get subscriptions:', error);
      return [];
    }
  },

  /**
   * Sync a single iCal subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} - Updated subscription
   */
  async syncSubscription(subscriptionId) {
    try {
      const subscription = await invoke('ical_sync_subscription', { subscriptionId });
      return subscription;
    } catch (error) {
      logger.error('iCal', 'Failed to sync subscription:', error);
      throw new Error(`Failed to sync iCal subscription: ${error}`);
    }
  },

  /**
   * Sync all iCal subscriptions
   * @returns {Promise<Array>} - Updated subscriptions
   */
  async syncAll() {
    try {
      const subscriptions = await invoke('ical_sync_all');
      return subscriptions;
    } catch (error) {
      logger.error('iCal', 'Failed to sync all subscriptions:', error);
      throw new Error(`Failed to sync iCal subscriptions: ${error}`);
    }
  },

  /**
   * Update iCal subscription settings
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} updates - Updates (name, color, enabled, sync_interval_minutes)
   * @returns {Promise<Object>} - Updated subscription
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      const subscription = await invoke('ical_update_subscription', {
        subscriptionId,
        ...updates
      });
      return subscription;
    } catch (error) {
      logger.error('iCal', 'Failed to update subscription:', error);
      throw new Error(`Failed to update iCal subscription: ${error}`);
    }
  },

  /**
   * Get events from an iCal subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Array>} - Array of events
   */
  async getEvents(subscriptionId) {
    try {
      const events = await invoke('ical_get_events', { subscriptionId });
      return events;
    } catch (error) {
      logger.error('iCal', 'Failed to get events:', error);
      return [];
    }
  }
};

// CalDAV operations (iCloud/Apple Calendar)
export const caldav = {
  /**
   * Connect to a CalDAV server (e.g., iCloud)
   * @param {string} serverUrl - CalDAV server URL
   * @param {string} username - Username (e.g., Apple ID email)
   * @param {string} password - App-specific password
   * @param {string} [displayName] - Optional display name
   * @returns {Promise<Object>} - Account object with discovered calendars
   */
  async connect(serverUrl, username, password, displayName = null) {
    try {
      const account = await invoke('caldav_connect', { serverUrl, username, password, displayName });
      return account;
    } catch (error) {
      logger.error('CalDAV', 'Failed to connect:', error);
      throw new Error(`Failed to connect to CalDAV: ${error}`);
    }
  },

  /**
   * Check if CalDAV is connected
   * @returns {Promise<boolean>}
   */
  async isConnected() {
    try {
      return await invoke('caldav_is_connected');
    } catch (error) {
      logger.error('CalDAV', 'Failed to check connection:', error);
      return false;
    }
  },

  /**
   * Get connected CalDAV account
   * @returns {Promise<Object|null>}
   */
  async getAccount() {
    try {
      return await invoke('caldav_get_account');
    } catch (error) {
      logger.error('CalDAV', 'Failed to get account:', error);
      return null;
    }
  },

  /**
   * Disconnect CalDAV account
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      await invoke('caldav_disconnect');
    } catch (error) {
      logger.error('CalDAV', 'Failed to disconnect:', error);
      throw new Error(`Failed to disconnect CalDAV: ${error}`);
    }
  },

  /**
   * Refresh calendars from CalDAV server
   * @returns {Promise<Array>} - Array of calendars
   */
  async refreshCalendars() {
    try {
      return await invoke('caldav_refresh_calendars');
    } catch (error) {
      logger.error('CalDAV', 'Failed to refresh calendars:', error);
      throw new Error(`Failed to refresh CalDAV calendars: ${error}`);
    }
  },

  /**
   * Get events from a CalDAV calendar
   * @param {string} calendarUrl - Calendar URL
   * @param {Date|string} start - Start date
   * @param {Date|string} end - End date
   * @returns {Promise<Array>} - Array of events
   */
  async getEvents(calendarUrl, start, end) {
    try {
      const startStr = start instanceof Date ? start.toISOString() : start;
      const endStr = end instanceof Date ? end.toISOString() : end;
      return await invoke('caldav_get_events', { calendarUrl, start: startStr, end: endStr });
    } catch (error) {
      logger.error('CalDAV', 'Failed to get events:', error);
      throw new Error(`Failed to get CalDAV events: ${error}`);
    }
  },

  /**
   * Create an event on CalDAV calendar
   * @param {string} calendarUrl - Calendar URL
   * @param {Object} event - Event data
   * @returns {Promise<Object>} - Created event
   */
  async createEvent(calendarUrl, event) {
    try {
      return await invoke('caldav_create_event', {
        calendarUrl,
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
    } catch (error) {
      logger.error('CalDAV', 'Failed to create event:', error);
      throw new Error(`Failed to create CalDAV event: ${error}`);
    }
  },

  /**
   * Update an event on CalDAV calendar
   * @param {string} calendarUrl - Calendar URL
   * @param {string} eventId - Event ID
   * @param {Object} updates - Event updates
   * @param {string} [etag] - Optional ETag for concurrency
   * @returns {Promise<Object>} - Updated event
   */
  async updateEvent(calendarUrl, eventId, updates, etag = null) {
    try {
      return await invoke('caldav_update_event', {
        calendarUrl,
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
        },
        etag
      });
    } catch (error) {
      logger.error('CalDAV', 'Failed to update event:', error);
      throw new Error(`Failed to update CalDAV event: ${error}`);
    }
  },

  /**
   * Delete an event from CalDAV calendar
   * @param {string} calendarUrl - Calendar URL
   * @param {string} eventId - Event ID
   * @param {string} [etag] - Optional ETag for concurrency
   * @returns {Promise<void>}
   */
  async deleteEvent(calendarUrl, eventId, etag = null) {
    try {
      await invoke('caldav_delete_event', { calendarUrl, eventId, etag });
    } catch (error) {
      logger.error('CalDAV', 'Failed to delete event:', error);
      throw new Error(`Failed to delete CalDAV event: ${error}`);
    }
  }
};

// Combined calendar service object
export const calendarService = {
  auth: calendarAuth,
  calendars,
  events,
  sync,
  ical,
  caldav,
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
