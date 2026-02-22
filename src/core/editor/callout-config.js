export const DEFAULT_CALLOUT_CONFIG = {
    note: {
        icon: "ℹ️",
        collapsed: false,
        bg: "var(--info)",
    },
    warning: {
        icon: "⚠️",
        collapsed: false,
        bg: "var(--warning)",
    },
    tip: {
        icon: "💡",
        collapsed: false,
        bg: "var(--success)",
    }
};
const STORAGE_KEY = "editor.callouts";

export function getCalloutConfig() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_CALLOUT_CONFIG;
    } catch {
        return DEFAULT_CALLOUT_CONFIG;
    }
}

export function saveCalloutConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
