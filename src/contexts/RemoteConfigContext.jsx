import React, { createContext, useContext, useState, useEffect } from 'react';

// Default configuration values (fallback if offline or fetch fails)
const DEFAULT_CONFIG = {
    // Legacy flags
    enable_new_features: false,
    welcome_message_variant: 'default',
    promo_banner_active: false,

    // Announcements
    announcements: [],

    // External links (can be updated without app release)
    links: {
        documentation: 'https://docs.lokus.dev',
        releases: 'https://github.com/lokus-app/lokus/releases',
        issues: 'https://github.com/lokus-app/lokus/issues',
        website: 'https://lokus.io',
        github: 'https://github.com/lokus-ai/lokus',
        donate: 'https://opencollective.com/lokus',
        discord: null,
    },

    // Feature flags (server can override)
    feature_flags: {
        enable_ai_assistant: true,
        enable_sync: true,
        enable_plugins: true,
        enable_canvas: true,
        beta_features: false,
    },

    // Service status for maintenance mode
    service_status: {
        sync: { status: 'operational', message: null },
        registry: { status: 'operational', message: null },
        maintenance: {
            active: false,
            message: '',
            end_time: null,
        },
    },

    // What's New changelog
    whats_new: {
        version: null,
        highlights: [],
        full_changelog_url: null,
    },

    // Tips system
    tips: {
        enabled: false,
        items: [],
    },

    // Theme overrides (server can override accent colors, etc.)
    theme_overrides: {
        accent: null,        // RGB space-separated, e.g., "124 58 237"
        accent_fg: null,
        bg: null,
        panel: null,
        border: null,
        text: null,
        muted: null,
        danger: null,
        success: null,
        warning: null,
        info: null,
    },

    // UI visibility (hide/show UI elements remotely)
    ui_visibility: {
        sidebar_kanban: true,
        sidebar_plugins: true,
        sidebar_bases: true,
        sidebar_graph: true,
        sidebar_daily_notes: true,
        sidebar_explorer: true,
        toolbar_split_view: true,
        toolbar_new_file: true,
        toolbar_new_folder: true,
        toolbar_new_canvas: true,
        menu_ai_assistant: true,
        menu_share: true,
        editor_mode_switcher: true,
    },

    // UI strings (server-controllable text labels)
    ui_strings: {
        commands: {
            new_file: 'New File',
            new_folder: 'New Folder',
            new_canvas: 'New Canvas',
            save_file: 'Save',
            delete_file: 'Delete',
        },
        placeholders: {
            search: 'Search...',
            find_in_file: 'Find in file...',
            file_name: 'Untitled',
        },
        messages: {
            workspace_error: 'This workspace is no longer accessible.',
            save_success: 'Saved successfully',
            delete_confirm: 'Are you sure you want to delete this?',
        },
        labels: {
            recent: 'Recently Opened',
            daily_notes: 'Daily Notes',
            graph_view: 'Graph View',
        },
    },

    // Layout defaults (initial layout configuration)
    layout_defaults: {
        left_sidebar_width: 280,
        right_sidebar_width: 280,
        left_sidebar_visible: true,
        right_sidebar_visible: false,
        default_view: 'editor',
    },
};

// URL to your remote JSON file
const REMOTE_CONFIG_URL = 'https://config.lokusmd.com/config.json';

// Deep merge helper for nested config objects
const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
};

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

            // Deep merge remote data with defaults to ensure all keys exist
            setConfig(deepMerge(DEFAULT_CONFIG, remoteData));
            setError(null);
        } catch (err) {
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

// Custom hook for easy access to remote config
export const useRemoteConfig = () => {
    const context = useContext(RemoteConfigContext);
    if (!context) {
        throw new Error('useRemoteConfig must be used within a RemoteConfigProvider');
    }
    return context;
};

// Convenience hooks for specific config sections
export const useRemoteLinks = () => {
    const { config } = useRemoteConfig();
    return config.links;
};

export const useFeatureFlags = () => {
    const { config } = useRemoteConfig();
    return config.feature_flags;
};

export const useServiceStatus = () => {
    const { config } = useRemoteConfig();
    return config.service_status;
};

export const useWhatsNew = () => {
    const { config } = useRemoteConfig();
    return config.whats_new;
};

export const useTips = () => {
    const { config } = useRemoteConfig();
    return config.tips;
};

// Theme overrides hook
export const useThemeOverrides = () => {
    const { config } = useRemoteConfig();
    return config.theme_overrides;
};

// UI visibility hook
export const useUIVisibility = () => {
    const { config } = useRemoteConfig();
    return config.ui_visibility;
};

// UI strings hook with getter function
export const useUIStrings = () => {
    const { config } = useRemoteConfig();
    const strings = config.ui_strings;

    // Helper to get nested string value with fallback
    const getString = (path, params = {}) => {
        const keys = path.split('.');
        let value = strings;

        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) break;
        }

        if (typeof value !== 'string') {
            return path; // Return path as fallback
        }

        // Interpolate params like {name} -> actual value
        return Object.entries(params).reduce(
            (str, [key, val]) => str.replace(new RegExp(`\\{${key}\\}`, 'g'), val),
            value
        );
    };

    return { strings, getString };
};

// Layout defaults hook
export const useLayoutDefaults = () => {
    const { config } = useRemoteConfig();
    return config.layout_defaults;
};
