/**
 * PostHog React Hooks for Lokus
 * Focused hooks for meaningful analytics
 */

import { useCallback, useEffect, useRef } from 'react';
import posthog from '../services/posthog.js';

/**
 * Hook to access the PostHog service instance
 * @returns {PostHogService} The posthog service singleton
 */
export function usePostHog() {
  return posthog;
}

/**
 * Hook to check a feature flag
 * @param {string} flagName - Name of the feature flag
 * @param {boolean} defaultValue - Default value
 * @returns {boolean}
 */
export function useFeatureFlag(flagName, defaultValue = false) {
  return posthog.isFeatureEnabled(flagName) ?? defaultValue;
}

/**
 * Hook to track feature activation (once ever per feature)
 * @param {string} feature - Feature name
 */
export function useTrackFeatureActivation(feature) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      posthog.trackFeatureActivation(feature);
    }
  }, [feature]);
}

/**
 * Hook to track milestones
 * @returns {(milestone: string) => void}
 */
export function useTrackMilestone() {
  return useCallback((milestone) => {
    posthog.trackMilestone(milestone);
  }, []);
}

/**
 * Hook to track errors
 * @returns {(errorType: string, screen?: string, recoverable?: boolean) => void}
 */
export function useTrackError() {
  return useCallback((errorType, screen = 'unknown', recoverable = true) => {
    posthog.trackError(errorType, screen, recoverable);
  }, []);
}

/**
 * Hook to update workspace stats (debounced)
 * Call this when workspace data changes significantly
 * @returns {(stats: {totalNotes: number, totalLinks: number}) => void}
 */
export function useUpdateWorkspaceStats() {
  const timeoutRef = useRef(null);

  return useCallback((stats) => {
    // Debounce to avoid too many updates
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      posthog.updateWorkspaceStats(stats);
    }, 5000); // Wait 5 seconds of inactivity before updating
  }, []);
}

/**
 * Hook to track session end on unmount
 * @param {() => Object} getSessionStats - Function that returns session stats
 */
export function useTrackSessionEnd(getSessionStats) {
  useEffect(() => {
    return () => {
      const stats = getSessionStats?.() || {};
      posthog.trackSessionEnd(stats);
    };
  }, [getSessionStats]);
}
