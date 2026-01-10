/**
 * Haptic Feedback Utility
 * 
 * Provides haptic feedback on supported mobile devices (iOS/Android).
 * Gracefully no-ops on desktop or unsupported environments.
 * 
 * @module utils/haptics
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
 */

/**
 * Vibration patterns for different feedback types (in milliseconds)
 * @constant {Object.<string, number|number[]>}
 */
const HAPTIC_PATTERNS = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 50, 25],
  error: [50, 50, 50],
};

/**
 * Valid haptic feedback types
 * @typedef {'light'|'medium'|'heavy'|'success'|'warning'|'error'} HapticType
 */

/**
 * Checks if the Vibration API is available in the current environment.
 * Safe for SSR (Server-Side Rendering) contexts.
 * 
 * @returns {boolean} True if vibration is supported
 */
const isVibrationSupported = () => {
  // SSR safety: navigator doesn't exist on server
  if (typeof navigator === 'undefined') return false;
  
  // Check if vibrate method exists
  return 'vibrate' in navigator && typeof navigator.vibrate === 'function';
};

/**
 * Triggers haptic feedback on supported mobile devices.
 * 
 * @param {HapticType} [type='light'] - The type of haptic feedback
 * @returns {boolean} True if vibration was triggered, false otherwise
 * 
 * @example
 * // Light tap feedback
 * triggerHaptic('light');
 * 
 * @example
 * // Success feedback with pattern
 * triggerHaptic('success');
 * 
 * @example
 * // Usage in React component
 * <button onClick={() => {
 *   triggerHaptic('medium');
 *   handleSubmit();
 * }}>
 *   Submit
 * </button>
 */
export const triggerHaptic = (type = 'light') => {
  // Early return if vibration not supported (SSR/desktop safety)
  if (!isVibrationSupported()) return false;

  // Get pattern, fallback to 'light' for invalid types
  const pattern = HAPTIC_PATTERNS[type] ?? HAPTIC_PATTERNS.light;

  try {
    // Trigger vibration and return result
    return navigator.vibrate(pattern);
  } catch {
    // Graceful no-op: some browsers may throw despite feature detection
    return false;
  }
};

/**
 * Cancels any ongoing vibration.
 * Useful for cleanup or interrupting long patterns.
 * 
 * @returns {boolean} True if cancellation was attempted
 */
export const cancelHaptic = () => {
  if (!isVibrationSupported()) return false;

  try {
    // Passing 0 or empty array cancels vibration
    return navigator.vibrate(0);
  } catch {
    return false;
  }
};

/**
 * List of available haptic feedback types
 * @constant {HapticType[]}
 */
export const HAPTIC_TYPES = Object.keys(HAPTIC_PATTERNS);

export default triggerHaptic;
