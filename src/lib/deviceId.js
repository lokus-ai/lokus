/**
 * Device ID Management for Lokus
 * Provides stable anonymous identifier for analytics before user authentication.
 * Used as PostHog distinct_id for anonymous users.
 */

const DEVICE_ID_KEY = 'lokus_device_id';
const FIRST_SEEN_KEY = 'lokus_first_seen';
const SESSION_COUNT_KEY = 'lokus_session_count';
const LAST_SESSION_KEY = 'lokus_last_session';

/**
 * Get or create a stable device ID
 * @returns {string} UUID for this device
 */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    // Store first seen timestamp
    localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString());
  }
  return id;
}

/**
 * Clear device ID (use on explicit user request only)
 */
export function clearDeviceId() {
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(FIRST_SEEN_KEY);
  localStorage.removeItem(SESSION_COUNT_KEY);
  localStorage.removeItem(LAST_SESSION_KEY);
}

/**
 * Check if device ID exists
 * @returns {boolean}
 */
export function hasDeviceId() {
  return !!localStorage.getItem(DEVICE_ID_KEY);
}

/**
 * Get the first seen date for this device
 * @returns {Date|null}
 */
export function getFirstSeenDate() {
  const firstSeen = localStorage.getItem(FIRST_SEEN_KEY);
  return firstSeen ? new Date(firstSeen) : null;
}

/**
 * Get days since first seen
 * @returns {number}
 */
export function getDaysSinceFirstSeen() {
  const firstSeen = getFirstSeenDate();
  if (!firstSeen) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - firstSeen);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Track a new session and return session metadata
 * @returns {{ sessionNumber: number, daysSinceLastSession: number }}
 */
export function trackSession() {
  const lastSession = localStorage.getItem(LAST_SESSION_KEY);
  const sessionCount = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);

  // Calculate days since last session
  let daysSinceLastSession = 0;
  if (lastSession) {
    const lastDate = new Date(lastSession);
    const now = new Date();
    const diffTime = Math.abs(now - lastDate);
    daysSinceLastSession = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Update session tracking
  const newSessionCount = sessionCount + 1;
  localStorage.setItem(SESSION_COUNT_KEY, newSessionCount.toString());
  localStorage.setItem(LAST_SESSION_KEY, new Date().toISOString());

  return {
    sessionNumber: newSessionCount,
    daysSinceLastSession
  };
}

/**
 * Get current session number without incrementing
 * @returns {number}
 */
export function getSessionCount() {
  return parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
}

/**
 * Get last session date
 * @returns {Date|null}
 */
export function getLastSessionDate() {
  const lastSession = localStorage.getItem(LAST_SESSION_KEY);
  return lastSession ? new Date(lastSession) : null;
}
