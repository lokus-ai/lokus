import { useEffect } from 'react';
import { useRemoteConfig } from '../hooks/useRemoteConfig';
import { showEnhancedToast, toast } from './ui/enhanced-toast';

const DISMISSED_STORAGE_KEY = 'lokus_dismissed_announcements';

/**
 * Get dismissed announcement IDs from localStorage
 */
const getDismissedIds = () => {
    try {
        return JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
};

/**
 * Save dismissed announcement ID to localStorage
 */
const saveDismissedId = (id) => {
    const currentDismissed = getDismissedIds();
    if (!currentDismissed.includes(id)) {
        localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...currentDismissed, id]));
    }
};

/**
 * Check if announcement is within valid date range
 */
const isWithinDateRange = (startDate, endDate, expiresAt) => {
    const now = new Date();

    if (startDate && new Date(startDate) > now) {
        return false;
    }
    if (endDate && new Date(endDate) < now) {
        return false;
    }
    if (expiresAt && new Date(expiresAt) < now) {
        return false;
    }
    return true;
};

export const RemoteAnnouncement = () => {
    const { config, loading } = useRemoteConfig();

    useEffect(() => {
        if (loading || !config?.announcement) return;

        const {
            // Core fields
            id,
            title,
            message,
            // Enhanced fields
            type = 'info',
            variant = 'default',
            expandedContent,
            link,
            // Behavior
            dismissible = true,
            persistent = false,
            showOnce = true,
            duration = 10000,
            // Date controls
            start_date,
            end_date,
            expiresAt,
            // Legacy fields (backwards compatible)
            action_label,
            action_url,
            // Actions
            action,
            cancel,
        } = config.announcement;

        // 1. Check Date Range (Seasonality)
        if (!isWithinDateRange(start_date, end_date, expiresAt)) {
            return;
        }

        // 2. Check if dismissed (showOnce)
        if (showOnce) {
            const dismissedIds = getDismissedIds();
            if (dismissedIds.includes(id)) {
                return;
            }
        }

        // 3. Build link object from legacy or new format
        const linkObj = link || (action_label && action_url ? {
            url: action_url,
            text: action_label,
            external: true,
        } : null);

        // 4. Handle dismissal callback
        const handleDismiss = () => {
            if (id) {
                saveDismissedId(id);
            }
        };

        // 5. Show the toast
        showEnhancedToast({
            id,
            title,
            message,
            type,
            variant,
            expandedContent,
            link: linkObj,
            dismissible,
            persistent,
            duration: persistent ? Infinity : duration,
            action,
            cancel,
            onDismiss: handleDismiss,
            onAutoClose: handleDismiss,
        });

    }, [config, loading]);

    return null; // This component doesn't render anything itself
};
