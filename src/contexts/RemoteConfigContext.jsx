import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

// The "Simple" default: only Editor + Files + Search + command palette are on,
// plus these lightweight, writing-essential flags. Everything else is "Advanced"
// and hidden until the user opts in (see ADVANCED_FEATURE_FLAGS below).
// Editor, Files, Search and the command palette are not flag-gated — they're always on.
export const ADVANCED_FEATURE_FLAGS = [
    'enable_ai_assistant',
    'enable_sync',
    'enable_plugins',
    'enable_canvas',
    'enable_graph',
    'enable_kanban',
    'enable_bases',
    'enable_calendar',
    'enable_meetings',
    'enable_templates',
    'enable_mcp',
    'enable_terminal',
    'enable_version_history',
];

// localStorage key holding the user's "Advanced features" preference.
// Absent → undecided (a one-time migration decides new-vs-existing user).
const ADVANCED_FEATURES_KEY = 'lokus-advanced-features';

// An "existing user" is someone who has already opened a workspace/vault.
// They keep full access to every panel so an upgrade never hides their features.
// Brand-new installs (no saved workspace) get the Simple default.
export async function detectExistingUser() {
    try {
        const isTauri = typeof window !== 'undefined' && (
            (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
            window.__TAURI_METADATA__ ||
            (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
        );
        if (!isTauri) return false;
        const { invoke } = await import('@tauri-apps/api/core');
        const path = await invoke('get_validated_workspace_path');
        return !!path;
    } catch {
        return false;
    }
}

function readAdvancedPreference() {
    try {
        const v = localStorage.getItem(ADVANCED_FEATURES_KEY);
        if (v === 'true') return true;
        if (v === 'false') return false;
    } catch {}
    return null; // undecided
}

// Default configuration values (fallback if offline or fetch fails)
const DEFAULT_CONFIG = {
    // Announcements
    announcements: [],

    // Server-pushed announcement (enhanced toast)
    announcement: {
        id: null,
        title: null,
        message: null,
        // Type: "info" | "success" | "warning" | "error"
        type: 'info',
        // Variant: "default" | "survey" | "announcement" | "warning" | "update"
        variant: 'default',
        // Expandable content (shown when user clicks "Show more")
        expandedContent: null,
        // Link button: { url, text, external }
        link: null,
        // Behavior
        dismissible: true,
        persistent: false,
        showOnce: true,
        duration: 10000,
        // Date controls
        start_date: null,
        end_date: null,
        expiresAt: null,
        // Action buttons: { label, onClick } - onClick is client-side only
        action: null,
        cancel: null,
    },

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

    // Feature flags (server can override).
    // "Simple" default: core writing flags on; the ~13 advanced flags default off
    // and are surfaced together via the "Advanced features" toggle in Preferences.
    // (ADVANCED_FEATURE_FLAGS above is the source of truth for what's advanced.)
    feature_flags: {
        // Core (Simple) — always on
        enable_daily_notes: true,
        enable_backlinks: true,
        enable_import_export: true,
        // Advanced — off by default, revealed by the "Advanced features" toggle
        enable_ai_assistant: false,
        enable_sync: false,
        enable_plugins: false,
        enable_canvas: false,
        enable_graph: false,
        enable_kanban: false,
        enable_bases: false,
        enable_calendar: false,
        enable_meetings: false,
        enable_templates: false,
        enable_mcp: false,
        enable_terminal: false,
        enable_version_history: false,
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
        toolbar_split_view: true,
        toolbar_new_file: true,
        toolbar_new_folder: true,
        toolbar_new_canvas: true,
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
    featureFlags: DEFAULT_CONFIG.feature_flags,
    advancedFeatures: false,
    setAdvancedFeatures: () => { },
});

export const RemoteConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // "Advanced features" preference. Initialized from localStorage; when undecided
    // we start in Simple mode and a one-time migration upgrades existing users.
    const [advancedFeatures, setAdvancedFeaturesState] = useState(() => readAdvancedPreference() === true);

    useEffect(() => {
        if (readAdvancedPreference() !== null) return; // already decided
        let cancelled = false;
        detectExistingUser().then((isExisting) => {
            if (cancelled) return;
            // Dev builds always get the full cockpit when undecided — the Simple
            // default is a product choice for real users, not for developers.
            const advanced = isExisting || import.meta.env.DEV;
            try { localStorage.setItem(ADVANCED_FEATURES_KEY, advanced ? 'true' : 'false'); } catch {}
            setAdvancedFeaturesState(advanced);
        });
        return () => { cancelled = true; };
    }, []);

    const setAdvancedFeatures = useCallback((val) => {
        const b = !!val;
        try { localStorage.setItem(ADVANCED_FEATURES_KEY, b ? 'true' : 'false'); } catch {}
        setAdvancedFeaturesState(b);
    }, []);

    // Effective flags. The "Advanced features" toggle is client-authoritative over the
    // 13 advanced flags: OFF hides them all (a new user never sees the cockpit, even if a
    // remote config enables them); ON reveals them all. Core flags keep their base value.
    const featureFlags = useMemo(() => {
        const base = config.feature_flags || {};
        const result = { ...base };
        for (const flag of ADVANCED_FEATURE_FLAGS) result[flag] = !!advancedFeatures;
        return result;
    }, [config.feature_flags, advancedFeatures]);

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
        <RemoteConfigContext.Provider value={{ config, loading, error, refreshConfig: fetchConfig, featureFlags, advancedFeatures, setAdvancedFeatures }}>
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
    const { featureFlags } = useRemoteConfig();
    return featureFlags;
};

// Access + toggle the "Advanced features" preference (drives ADVANCED_FEATURE_FLAGS).
export const useAdvancedFeatures = () => {
    const { advancedFeatures, setAdvancedFeatures } = useRemoteConfig();
    return { advancedFeatures, setAdvancedFeatures };
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

// Announcement hook
export const useAnnouncement = () => {
    const { config } = useRemoteConfig();
    return config.announcement;
};
