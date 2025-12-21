/**
 * Privacy-First Analytics Service for Lokus
 *
 * This service provides a privacy-respecting analytics wrapper for Umami.
 *
 * PRIVACY GUARANTEES:
 * - No PII (Personally Identifiable Information) is collected
 * - No note content, file names, or paths are tracked
 * - User can opt-out at any time via preferences
 * - All data is anonymized and aggregated
 * - 90-day data retention with auto-deletion
 * - GDPR and CCPA compliant
 *
 * @module services/analytics
 */

import { invoke } from '@tauri-apps/api/core';
import { writeTextFile, BaseDirectory, exists, mkdir } from '@tauri-apps/plugin-fs';

// File logger for production debugging
const logToFile = async (message, data = {}) => {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message} ${JSON.stringify(data)}\n`;
    // Use AppData directory (Application Support on macOS) which we know exists
    await writeTextFile('analytics.log', logLine, { baseDir: BaseDirectory.AppData, append: true });
  } catch (e) {
    // Fallback to console if file logging fails
    console.log('[Analytics-FileLog-Error]', e.message, message, data);
  }
};

class AnalyticsService {
  constructor() {
    this.enabled = false;
    this.initialized = false;
    this.isDevelopment = import.meta.env.DEV;
    this.websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID || '';
    this.apiEndpoint = import.meta.env.VITE_UMAMI_API_ENDPOINT || 'https://analytics.lokusmd.com';

    // Session-based rate limiting - track what's been sent this session
    this.sessionEvents = new Set();

    // Performance metrics cache
    this.performanceMetrics = {
      startupTime: null,
      searchDurations: [],
      saveDurations: [],
      renderDurations: []
    };

    // Initialize from localStorage
    this.loadPreferences();
  }

  /**
   * Load analytics preferences from localStorage
   * @private
   */
  loadPreferences() {
    try {
      const prefs = localStorage.getItem('lokus-analytics-preferences');
      if (prefs) {
        const { enabled } = JSON.parse(prefs);
        this.enabled = enabled !== false; // Default to enabled
      } else {
        // First time - default to enabled
        this.enabled = true;
        this.savePreferences();
      }
    } catch (error) {
      this.enabled = true; // Default to enabled on error
    }
  }

  /**
   * Save analytics preferences to localStorage
   * @private
   */
  savePreferences() {
    try {
      localStorage.setItem('lokus-analytics-preferences', JSON.stringify({
        enabled: this.enabled,
        lastUpdated: new Date().toISOString()
      }));
    } catch { }
  }

  /**
   * Initialize analytics
   * @returns {Promise<void>}
   */
  async initialize() {
    const initData = {
      initialized: this.initialized,
      enabled: this.enabled,
      websiteId: this.websiteId,
      isDev: this.isDevelopment
    };
    console.log('[Analytics] Initializing...', initData);
    await logToFile('Initializing analytics', initData);

    if (this.initialized) {
      console.log('[Analytics] Already initialized, skipping');
      await logToFile('Already initialized, skipping');
      return;
    }

    // TEMPORARY: Allow development mode for testing dev-analytics
    if (this.isDevelopment) {
      console.log('[Analytics] Development mode - continuing initialization');
      await logToFile('Development mode - continuing initialization');
      // Don't return - continue initialization
    }

    // Don't initialize if user has opted out
    if (!this.enabled) {
      console.log('[Analytics] User opted out, skipping');
      await logToFile('User opted out, skipping');
      return;
    }

    // Check if website ID is configured
    if (!this.websiteId) {
      console.log('[Analytics] No website ID configured, skipping');
      await logToFile('No website ID configured, skipping');
      return;
    }

    try {
      // No need to load script - we use direct API calls
      console.log('[Analytics] Using direct API mode');
      await logToFile('Using direct API mode', { endpoint: this.apiEndpoint });

      this.initialized = true;
      console.log('[Analytics] Initialized successfully!');
      await logToFile('Initialized successfully!');
      // Note: app_startup is tracked from App.jsx with actual timing data
    } catch (err) {
      console.error('[Analytics] Failed to initialize:', err);
      await logToFile('Failed to initialize', { error: err.message });
    }
  }

  /**
   * Send event directly to Umami API (no script loading needed)
   * @private
   * @param {string} eventName - Event name
   * @param {Object} eventData - Event data
   * @returns {Promise<void>}
   */
  async sendToUmamiAPI(eventName, eventData = {}) {
    try {
      const payload = {
        type: 'event',
        payload: {
          hostname: 'lokus.app',
          language: navigator.language || 'en-US',
          referrer: '',
          screen: `${window.screen.width}x${window.screen.height}`,
          title: 'Lokus',
          url: '/',
          website: this.websiteId,
          name: eventName,
          data: eventData
        }
      };

      const response = await fetch(`${this.apiEndpoint}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Umami API error: ${response.status}`);
      }

      await logToFile('Sent to Umami API successfully', { eventName, status: response.status });
    } catch (err) {
      await logToFile('Umami API error', { eventName, error: err.message });
      throw err;
    }
  }

  /**
   * Enable analytics tracking
   * @returns {Promise<void>}
   */
  async enable() {
    this.enabled = true;
    this.savePreferences();

    if (!this.initialized) {
      await this.initialize();
    }

  }

  /**
   * Disable analytics tracking
   */
  disable() {
    this.enabled = false;
    this.savePreferences();
  }

  /**
   * Check if analytics is enabled
   * @returns {boolean}
   */
  isEnabled() {
    // TEMPORARY: Allow development mode for testing
    return this.enabled && this.initialized;
  }

  /**
   * Track a custom event
   * @param {string} eventName - Name of the event
   * @param {Object} [eventData] - Additional event data (must not contain PII)
   */
  trackEvent(eventName, eventData = {}) {
    const eventInfo = {
      isEnabled: this.isEnabled(),
      initialized: this.initialized
    };
    console.log('[Analytics] trackEvent called:', eventName, eventData, eventInfo);
    logToFile('trackEvent called', { eventName, eventData, ...eventInfo });

    if (!this.isEnabled()) {
      console.log('[Analytics] Not enabled, skipping event');
      logToFile('Not enabled, skipping event', { eventName });
      return;
    }

    try {
      // Sanitize event data to ensure no PII
      const sanitizedData = this.sanitizeEventData(eventData);

      // Send event directly to Umami API
      console.log('[Analytics] Sending to Umami API:', eventName, sanitizedData);
      logToFile('Sending to Umami API', { eventName, sanitizedData });
      this.sendToUmamiAPI(eventName, sanitizedData).catch(err => {
        console.error('[Analytics] Umami API error:', err);
      });
    } catch (err) {
      console.error('[Analytics] Error tracking event:', err);
      logToFile('Error tracking event', { eventName, error: err.message });
    }
  }

  /**
   * Sanitize event data to remove any potential PII
   * @private
   * @param {Object} data - Event data
   * @returns {Object} Sanitized data
   */
  sanitizeEventData(data) {
    const sanitized = {};
    const allowedKeys = [
      'feature', 'action', 'category', 'label', 'value',
      'duration', 'count', 'status', 'type', 'version',
      'platform', 'os', 'error_type', 'component'
    ];

    for (const [key, value] of Object.entries(data)) {
      // Only allow whitelisted keys
      if (allowedKeys.includes(key)) {
        // Ensure value is not sensitive
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  // ===========================================
  // SESSION-BASED RATE LIMITING
  // ===========================================

  /**
   * Track an event only once per session (rate limiting)
   * @param {string} eventName - Event name
   * @param {Object} eventData - Event data
   */
  trackOncePerSession(eventName, eventData = {}) {
    if (this.sessionEvents.has(eventName)) {
      return; // Already tracked this session
    }
    this.sessionEvents.add(eventName);
    this.trackEvent(eventName, eventData);
  }

  /**
   * Track feature usage (rate limited to once per session per feature)
   * @param {string} featureName - Feature name (canvas, graph, templates, search, daily_notes)
   */
  trackFeatureUsed(featureName) {
    const eventKey = `feature_${featureName}`;
    if (this.sessionEvents.has(eventKey)) {
      return; // Already tracked this feature this session
    }
    this.sessionEvents.add(eventKey);
    this.trackEvent('feature_used', {
      feature: featureName
    });
  }

  // ===========================================
  // FEATURE USAGE TRACKING
  // ===========================================

  /**
   * Track note creation
   * @param {string} noteType - Type of note (daily, template, blank, etc.)
   */
  trackNoteCreation(noteType = 'blank') {
    this.trackEvent('note_created', {
      feature: 'notes',
      action: 'create',
      type: noteType
    });
  }

  /**
   * Track note opening
   */
  trackNoteOpen() {
    this.trackEvent('note_opened', {
      feature: 'notes',
      action: 'open'
    });
  }

  /**
   * Track template usage
   * @param {string} templateCategory - Category of template used
   */
  trackTemplateUsage(templateCategory = 'unknown') {
    this.trackEvent('template_used', {
      feature: 'templates',
      action: 'apply',
      category: templateCategory
    });
  }

  /**
   * Track search usage
   * @param {string} searchType - Type of search (quick, advanced, quantum)
   */
  trackSearch(searchType = 'quick') {
    this.trackEvent('search_performed', {
      feature: 'search',
      action: 'query',
      type: searchType
    });
  }

  /**
   * Track graph viewing
   * @param {string} graphType - Type of graph (2d, 3d)
   */
  trackGraphView(graphType = '2d') {
    this.trackEvent('graph_viewed', {
      feature: 'graph',
      action: 'view',
      type: graphType
    });
  }

  /**
   * Track database view usage
   * @param {string} viewType - Type of view (table, kanban, calendar, etc.)
   */
  trackDatabaseView(viewType = 'table') {
    this.trackEvent('database_viewed', {
      feature: 'database',
      action: 'view',
      type: viewType
    });
  }

  /**
   * Track theme change
   * @param {string} theme - Theme name (light, dark, etc.)
   */
  trackThemeChange(theme) {
    this.trackEvent('theme_changed', {
      feature: 'preferences',
      action: 'change_theme',
      type: theme
    });
  }

  /**
   * Track daily note access
   */
  trackDailyNote() {
    this.trackEvent('daily_note_accessed', {
      feature: 'daily_notes',
      action: 'open'
    });
  }

  /**
   * Track plugin activation
   * @param {string} pluginId - Plugin identifier (hashed or generic)
   */
  trackPluginActivation(pluginId) {
    this.trackEvent('plugin_activated', {
      feature: 'plugins',
      action: 'activate',
      label: pluginId
    });
  }

  /**
   * Track canvas usage
   */
  trackCanvasUsage() {
    this.trackEvent('canvas_used', {
      feature: 'canvas',
      action: 'open'
    });
  }

  // ===========================================
  // PERFORMANCE TRACKING
  // ===========================================

  /**
   * Track app startup time
   * @param {number} duration - Startup duration in milliseconds
   */
  trackStartupTime(duration) {
    this.performanceMetrics.startupTime = duration;
    // Consolidate into single app_startup event with duration
    this.trackOncePerSession('app_startup', {
      feature: 'performance',
      action: 'startup',
      duration: Math.round(duration)
    });
  }

  /**
   * Track note save performance
   * @param {number} duration - Save duration in milliseconds
   */
  trackNoteSavePerformance(duration) {
    this.performanceMetrics.saveDurations.push(duration);

    // Only send every 10 saves to reduce noise
    if (this.performanceMetrics.saveDurations.length >= 10) {
      const avg = this.performanceMetrics.saveDurations.reduce((a, b) => a + b, 0) /
                  this.performanceMetrics.saveDurations.length;

      this.trackEvent('note_save_performance', {
        feature: 'performance',
        action: 'save',
        duration: Math.round(avg)
      });

      this.performanceMetrics.saveDurations = [];
    }
  }

  /**
   * Track search performance
   * @param {number} duration - Search duration in milliseconds
   */
  trackSearchPerformance(duration) {
    this.performanceMetrics.searchDurations.push(duration);

    // Only send every 5 searches
    if (this.performanceMetrics.searchDurations.length >= 5) {
      const avg = this.performanceMetrics.searchDurations.reduce((a, b) => a + b, 0) /
                  this.performanceMetrics.searchDurations.length;

      this.trackEvent('search_performance', {
        feature: 'performance',
        action: 'search',
        duration: Math.round(avg)
      });

      this.performanceMetrics.searchDurations = [];
    }
  }

  /**
   * Track graph rendering performance
   * @param {number} duration - Rendering duration in milliseconds
   * @param {string} graphType - Type of graph (2d, 3d)
   */
  trackGraphRenderPerformance(duration, graphType = '2d') {
    this.trackEvent('graph_render_performance', {
      feature: 'performance',
      action: 'graph_render',
      type: graphType,
      duration: Math.round(duration)
    });
  }

  // ===========================================
  // ERROR TRACKING
  // ===========================================

  /**
   * Track error event
   * @param {string} errorType - Type of error
   * @param {string} component - Component where error occurred
   */
  trackError(errorType, component = 'unknown') {
    this.trackEvent('error_occurred', {
      feature: 'errors',
      action: 'error',
      error_type: errorType,
      component: component
    });
  }

  /**
   * Track Git sync failure
   * @param {string} errorType - Type of sync error
   */
  trackGitSyncError(errorType = 'unknown') {
    this.trackError('git_sync_failed', 'git');
  }

  /**
   * Track file access error
   * @param {string} errorType - Type of file error
   */
  trackFileAccessError(errorType = 'unknown') {
    this.trackError('file_access_failed', 'filesystem');
  }

  /**
   * Track export failure
   * @param {string} exportType - Type of export (pdf, docx, etc.)
   */
  trackExportError(exportType = 'unknown') {
    this.trackError('export_failed', 'export');
  }

  // ===========================================
  // PLATFORM DATA (Aggregated)
  // ===========================================

  /**
   * Get app version
   * @private
   * @returns {Promise<string>}
   */
  async getAppVersion() {
    try {
      const { version } = await invoke('plugin:app|version');
      return version;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get platform information (aggregated, no device-specific data)
   * @private
   * @returns {Promise<string>}
   */
  async getPlatform() {
    try {
      const { platform } = await invoke('plugin:os|platform');
      // Return only OS type, not version or device details
      return platform; // e.g., 'windows', 'macos', 'linux'
    } catch {
      return 'unknown';
    }
  }
}

// Create singleton instance
const analytics = new AnalyticsService();

export default analytics;
