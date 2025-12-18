import React, { createContext, useState, useEffect } from 'react';

// Default configuration values (fallback if offline or fetch fails)
const DEFAULT_CONFIG = {
    // Example flags - replace with your actual defaults
    enable_new_features: false,
    welcome_message_variant: 'default',
    promo_banner_active: false,
};

// URL to your remote JSON file
// URL to your remote JSON file
const REMOTE_CONFIG_URL = 'https://config.lokusmd.com/config.json';

export const RemoteConfigContext = createContext({
    config: DEFAULT_CONFIG,
    loading: true,
    error: null,
    refreshConfig: () => { },
});

export const RemoteConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            // Add a timestamp to prevent caching
            const response = await fetch(`${REMOTE_CONFIG_URL}?t=${Date.now()}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.status}`);
            }

            const remoteData = await response.json();

            // Merge remote data with defaults to ensure all keys exist
            setConfig({ ...DEFAULT_CONFIG, ...remoteData });
            setError(null);
        } catch (err) {
            console.warn('Remote Config fetch failed, using defaults:', err);
            setError(err);
            // Keep using default config (already set in initial state)
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return (
        <RemoteConfigContext.Provider value={{ config, loading, error, refreshConfig: fetchConfig }}>
            {children}
        </RemoteConfigContext.Provider>
    );
};
