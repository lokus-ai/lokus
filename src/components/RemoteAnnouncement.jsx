import React, { useEffect } from 'react';
import { useRemoteConfig } from '../hooks/useRemoteConfig';
import { useToast } from '../hooks/use-toast';
import { ToastAction } from './ui/toast';

export const RemoteAnnouncement = () => {
    const { config, loading } = useRemoteConfig();
    const { toast } = useToast();

    useEffect(() => {
        if (loading || !config?.announcement) return;

        const { id, title, message, action_label, action_url, start_date, end_date } = config.announcement;

        // 1. Check Date Range (Seasonality)
        const now = new Date();
        if (start_date && new Date(start_date) > now) {
            return;
        }
        if (end_date && new Date(end_date) < now) {
            return;
        }

        // 2. Check if dismissed (Frequency: Once)
        const dismissedIds = JSON.parse(localStorage.getItem('lokus_dismissed_announcements') || '[]');
        if (dismissedIds.includes(id)) {
            return;
        }

        // 3. Show Toast
        toast({
            title: title,
            description: message,
            action: action_label && action_url ? (
                <ToastAction altText={action_label} onClick={(e) => {
                    e.preventDefault(); // Prevent default toast behavior if any

                    const openLink = async () => {
                        try {
                            // Ask for confirmation
                            if (window.__TAURI__) {
                                const { confirm } = await import('@tauri-apps/plugin-dialog');
                                const confirmed = await confirm('Do you want to open this link in your external browser?', { title: 'Open Link', kind: 'info' });
                                if (!confirmed) return;

                                const { open } = await import('@tauri-apps/plugin-shell');
                                await open(action_url);
                            } else {
                                // Fallback for web/dev
                                if (window.confirm('Open external link?')) {
                                    window.open(action_url, '_blank', 'noopener,noreferrer');
                                }
                            }
                        } catch (err) {
                            // Ultimate fallback
                            window.open(action_url, '_blank');
                        }
                    };

                    openLink();
                }}>
                    {action_label}
                </ToastAction>
            ) : undefined,
            onOpenChange: (open) => {
                // When toast is dismissed (closed), save ID to localStorage
                if (!open) {
                    const currentDismissed = JSON.parse(localStorage.getItem('lokus_dismissed_announcements') || '[]');
                    if (!currentDismissed.includes(id)) {
                        localStorage.setItem('lokus_dismissed_announcements', JSON.stringify([...currentDismissed, id]));
                    }
                }
            },
            duration: 10000, // Show for 10 seconds
        });

    }, [config, loading, toast]);

    return null; // This component doesn't render anything itself, it just triggers the toast
};
