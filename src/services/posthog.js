/**
 * PostHog Analytics Service for Lokus
 *
 * A focused, privacy-respecting analytics service using PostHog.
 *
 * PRIVACY GUARANTEES:
 * - No PII (Personally Identifiable Information) is collected
 * - No note content, file names, or paths are tracked
 * - User can opt-out at any time via preferences
 * - All data is anonymized and aggregated
 * - GDPR and CCPA compliant
 *
 * TRACKING PHILOSOPHY:
 * - Session-level metrics for understanding usage patterns
 * - Milestone tracking for user journey insights (rate-limited, once per milestone)
 * - Feature activation tracking (once per feature ever)
 * - Error tracking for reliability monitoring
 * - Performance tracking for optimization
 *
 * @module services/posthog
 */

import posthog from 'posthog-js';
import { getDeviceId, trackSession, getDaysSinceFirstSeen, getSessionCount } from '../lib/deviceId.js';
import { getPlatform } from '../platform/index.js';

class PostHogService {
  constructor() {
    this.enabled = false;
    this.initialized = false;
    this.isDevelopment = import.meta.env.DEV;
    this.posthogKey = import.meta.env.VITE_POSTHOG_KEY || '';
    this.posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

    // App metadata
    this.appVersion = null;
    this.platform = null;

    // Initialize from localStorage
    this.loadPreferences();
  }

  // ===========================================
  // INITIALIZATION & PREFERENCES
  // ===========================================

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
   * Load app version and platform metadata
   * @private
   */
  async loadAppMetadata() {
    try {
      // Try to get app version from Tauri
      const { getVersion } = await import('@tauri-apps/api/app');
      this.appVersion = await getVersion();
    } catch {
      this.appVersion = 'unknown';
    }

    // Get platform using the existing utility
    this.platform = getPlatform();
  }

  /**
   * Initialize PostHog analytics
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Don't initialize if user has opted out
    if (!this.enabled) {
      return;
    }

    // Check if PostHog key is configured
    if (!this.posthogKey) {
      console.log('[PostHog] No API key configured, skipping initialization');
      return;
    }

    try {
      // Get device ID for anonymous tracking
      const deviceId = getDeviceId();

      // Load app metadata
      await this.loadAppMetadata();

      // Initialize PostHog
      posthog.init(this.posthogKey, {
        api_host: this.posthogHost,
        autocapture: false, // We track manually for privacy
        capture_pageview: false, // Desktop app, no page views
        persistence: 'localStorage',
        // PRIVACY: Always disable session recording - this is a note-taking app
        // Users write private thoughts, journals, work notes - never record their screen
        disable_session_recording: true,
        loaded: (posthogInstance) => {
          // Set device ID as distinct_id for anonymous users
          posthogInstance.identify(deviceId);
        }
      });

      this.initialized = true;

      // Set signup date on first session
      this.setSignupDate();

      // Track session start
      const sessionData = trackSession();
      this.capture('session_started', {
        session_number: sessionData.sessionNumber,
        days_since_last_session: sessionData.daysSinceLastSession,
        days_since_first_seen: getDaysSinceFirstSeen(),
        total_sessions: getSessionCount()
      });

    } catch (err) {
      console.error('[PostHog] Failed to initialize:', err);
    }
  }

  /**
   * Identify an authenticated user
   * @param {string} userId - User ID
   * @param {Object} traits - User traits/properties
   */
  identify(userId, traits = {}) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      posthog.identify(userId, traits);
    } catch (err) {
      console.error('[PostHog] Error identifying user:', err);
    }
  }

  /**
   * Reset analytics on logout
   * Clears user identification and starts fresh
   */
  reset() {
    if (!this.initialized) {
      return;
    }

    try {
      posthog.reset();
      // Re-identify with device ID for anonymous tracking
      const deviceId = getDeviceId();
      posthog.identify(deviceId);
    } catch (err) {
      console.error('[PostHog] Error resetting:', err);
    }
  }

  /**
   * Enable analytics tracking
   * @returns {Promise<void>}
   */
  async enable() {
    this.enabled = true;
    this.savePreferences();

    if (this.initialized) {
      posthog.opt_in_capturing();
    } else {
      await this.initialize();
    }
  }

  /**
   * Disable analytics tracking
   */
  disable() {
    this.enabled = false;
    this.savePreferences();

    if (this.initialized) {
      posthog.opt_out_capturing();
    }
  }

  /**
   * Check if analytics is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled && this.initialized;
  }

  /**
   * Check if a feature flag is enabled
   * @param {string} flagName - Name of the feature flag
   * @returns {boolean} Whether the feature is enabled
   */
  isFeatureEnabled(flagName) {
    if (!this.initialized) {
      return false;
    }

    try {
      return posthog.isFeatureEnabled(flagName) ?? false;
    } catch (err) {
      console.error('[PostHog] Error checking feature flag:', err);
      return false;
    }
  }

  // ===========================================
  // CORE CAPTURE METHOD
  // ===========================================

  /**
   * Capture an analytics event
   * @param {string} event - Event name
   * @param {Object} properties - Event properties
   */
  capture(event, properties = {}) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const enrichedProperties = {
        ...properties,
        app_version: this.appVersion,
        platform: this.platform
      };

      posthog.capture(event, enrichedProperties);
    } catch (err) {
      console.error('[PostHog] Error capturing event:', err);
    }
  }

  // ===========================================
  // SESSION TRACKING
  // ===========================================

  /**
   * Track session end
   * @param {Object} stats - Session statistics
   * @param {number} stats.durationMinutes - Session duration in minutes
   * @param {number} stats.notesCreated - Number of notes created
   * @param {number} stats.notesEdited - Number of notes edited
   * @param {number} stats.linksCreated - Number of links created
   */
  trackSessionEnd(stats = {}) {
    this.capture('session_ended', {
      duration_minutes: stats.durationMinutes || 0,
      notes_created: stats.notesCreated || 0,
      notes_edited: stats.notesEdited || 0,
      links_created: stats.linksCreated || 0
    });
  }

  // ===========================================
  // MILESTONE TRACKING
  // ===========================================

  /**
   * Track user milestone (rate limited - each milestone only once ever)
   * Milestones: first_note, first_link, 5_notes, 10_notes, 25_notes,
   *            first_daily_note, first_template, first_export
   * @param {string} milestone - Milestone name
   */
  trackMilestone(milestone) {
    const storageKey = `lokus_milestone_${milestone}`;
    if (localStorage.getItem(storageKey)) {
      return; // Already tracked this milestone
    }
    localStorage.setItem(storageKey, new Date().toISOString());

    this.capture('milestone_reached', {
      milestone,
      days_since_signup: this.getDaysSinceSignup()
    });
  }

  /**
   * Get days since signup
   * @private
   * @returns {number} Days since signup
   */
  getDaysSinceSignup() {
    const signupDate = localStorage.getItem('lokus_signup_date');
    if (!signupDate) return 0;
    const days = Math.floor((Date.now() - new Date(signupDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  }

  /**
   * Set signup date (call once on first session)
   */
  setSignupDate() {
    if (!localStorage.getItem('lokus_signup_date')) {
      localStorage.setItem('lokus_signup_date', new Date().toISOString());
    }
  }

  // ===========================================
  // FEATURE ACTIVATION TRACKING
  // ===========================================

  /**
   * Track feature activation (once per feature ever)
   * Features: graph, canvas, database, daily_notes, templates, git_sync, plugins
   * @param {string} feature - Feature name
   */
  trackFeatureActivation(feature) {
    const storageKey = `lokus_feature_${feature}`;
    if (localStorage.getItem(storageKey)) {
      return; // Already tracked this feature activation
    }
    localStorage.setItem(storageKey, new Date().toISOString());

    this.capture('feature_activated', {
      feature,
      days_since_signup: this.getDaysSinceSignup()
    });

    // Update user's features_activated property
    this.updateFeaturesActivated(feature);
  }

  /**
   * Update features_activated user property
   * @private
   * @param {string} newFeature - Feature to add
   */
  updateFeaturesActivated(newFeature) {
    const features = JSON.parse(localStorage.getItem('lokus_features_activated') || '[]');
    if (!features.includes(newFeature)) {
      features.push(newFeature);
      localStorage.setItem('lokus_features_activated', JSON.stringify(features));
      this.setUserProperties({ features_activated: features });
    }
  }

  // ===========================================
  // ERROR TRACKING
  // ===========================================

  /**
   * Track error encountered
   * @param {string} errorType - Type of error
   * @param {string} screen - Screen where error occurred
   * @param {boolean} recoverable - Whether user can recover
   */
  trackError(errorType, screen = 'unknown', recoverable = true) {
    this.capture('error_encountered', {
      error_type: errorType,
      screen,
      recoverable
    });
  }

  // ===========================================
  // EXPORT TRACKING
  // ===========================================

  /**
   * Track successful export
   * @param {string} format - Export format (pdf, docx, md, html)
   */
  trackExport(format) {
    this.capture('export_completed', { format });
    this.trackMilestone('first_export');
  }

  // ===========================================
  // PERFORMANCE TRACKING
  // ===========================================

  /**
   * Track app startup time
   * @param {number} durationMs - Startup duration in milliseconds
   * @param {boolean} coldStart - Whether this was a cold start
   */
  trackAppStartup(durationMs, coldStart = true) {
    this.capture('app_startup', {
      duration_ms: Math.round(durationMs),
      cold_start: coldStart
    });
  }

  // ===========================================
  // USER PROPERTIES
  // ===========================================

  /**
   * Update user properties
   * @param {Object} properties - Properties to set
   */
  setUserProperties(properties) {
    if (!this.isEnabled()) return;

    try {
      posthog.setPersonProperties(properties);
    } catch (err) {
      console.error('[PostHog] Error setting user properties:', err);
    }
  }

  /**
   * Update workspace statistics (call periodically or on significant changes)
   * @param {Object} stats - Workspace statistics
   * @param {number} stats.totalNotes - Total number of notes
   * @param {number} stats.totalLinks - Total number of links
   */
  updateWorkspaceStats(stats) {
    const isPowerUser = (stats.totalNotes || 0) >= 25 && (stats.totalLinks || 0) >= 10;

    this.setUserProperties({
      total_notes: stats.totalNotes || 0,
      total_links: stats.totalLinks || 0,
      days_since_signup: this.getDaysSinceSignup(),
      is_power_user: isPowerUser,
      last_active_date: new Date().toISOString().split('T')[0]
    });
  }
}

// Create singleton instance
const posthogService = new PostHogService();

export default posthogService;
