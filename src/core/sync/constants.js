// Sync V2 — shared constants

export const MAX_CONCURRENT = 10;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
export const MAX_WORKSPACE_SIZE = 1024 * 1024 * 1024; // 1GB total

export const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const SAVE_DEBOUNCE_MS = 3000; // 3 seconds

export const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
export const TRASH_MAX_AGE_DAYS = 30;

export const LOCK_HEARTBEAT_MS = 5000; // 5 seconds
export const LOCK_STALE_MS = 15000; // 15 seconds

export const MANIFEST_VERSION = 2;
