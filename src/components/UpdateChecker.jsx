import { useState, useEffect, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { showEnhancedToast } from './ui/enhanced-toast';
import { readConfig } from '../core/config/store.js';
import { getAppVersion } from '../utils/appInfo.js';

// Disable update checks for Mac App Store builds (Apple Guideline 2.4.5)
const UPDATES_DISABLED = import.meta.env.VITE_DISABLE_UPDATE_CHECKER === 'true';

// Update endpoints
const BETA_ENDPOINT = 'https://config.lokusmd.com/api/updates/beta.json';

const SNOOZE_STORAGE_KEY = 'lokus_update_snoozed';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Simple semver comparison (handles x.y.z and x.y.z-beta.n formats)
// Returns: positive if v1 > v2, negative if v1 < v2, 0 if equal
function compareVersions(v1, v2) {
  const parse = (v) => {
    const [main, pre] = v.replace(/^v/, '').split('-');
    const parts = main.split('.').map(Number);
    const prerelease = pre ? pre.split('.') : null;
    return { parts, prerelease };
  };

  const a = parse(v1);
  const b = parse(v2);

  // Compare main version parts (x.y.z)
  for (let i = 0; i < 3; i++) {
    const diff = (a.parts[i] || 0) - (b.parts[i] || 0);
    if (diff !== 0) return diff;
  }

  // If main versions are equal, compare prereleases
  // No prerelease > prerelease (1.0.0 > 1.0.0-beta.1)
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && !b.prerelease) return 0;

  // Both have prereleases, compare them
  const preA = a.prerelease.join('.');
  const preB = b.prerelease.join('.');
  return preA.localeCompare(preB, undefined, { numeric: true });
}

// Track if we've already shown the update notification this session
let hasShownUpdateThisSession = false;

// For testing: reset the session flag
export function _resetSessionFlag() {
  hasShownUpdateThisSession = false;
}
// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.__resetUpdateChecker = _resetSessionFlag;
}

/**
 * Check if update notification is snoozed for a specific version
 */
const isUpdateSnoozed = (version) => {
  try {
    const snoozed = JSON.parse(localStorage.getItem(SNOOZE_STORAGE_KEY) || '{}');
    if (snoozed.version === version && snoozed.until) {
      const snoozedUntil = new Date(snoozed.until);
      if (snoozedUntil > new Date()) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Snooze update notification for a specific version for 24 hours
 */
const snoozeUpdate = (version) => {
  const until = new Date(Date.now() + SNOOZE_DURATION_MS);
  localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify({
    version,
    until: until.toISOString(),
  }));
};

/**
 * Clear snooze (e.g., when a new version is available)
 */
const clearSnooze = () => {
  localStorage.removeItem(SNOOZE_STORAGE_KEY);
};

export default function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const downloadToastId = useRef(null);

  const checkForUpdate = async () => {
    // Skip update checks for App Store builds
    if (UPDATES_DISABLED) {
      console.debug('[UpdateChecker] Update checking disabled for this build');
      return null;
    }

    // Don't show again if already shown this session or dismissed
    if (hasShownUpdateThisSession || dismissed) {
      return null;
    }

    try {
      // Get current version first for comparison
      const currentVersion = await getAppVersion();

      // Read beta preference from config
      const config = await readConfig();
      const useBeta = config?.updates?.betaChannel || false;

      // Try the standard Tauri updater
      const update = await check();

      if (update?.available && update?.version) {
        // Double-check version comparison ourselves
        const comparison = compareVersions(update.version, currentVersion);

        // Only show if remote version is actually newer
        if (comparison > 0) {
          // Check if this version is snoozed
          if (isUpdateSnoozed(update.version)) {
            return update;
          }

          const isBeta = update.version.includes('beta') || update.version.includes('alpha');
          setUpdateInfo(update);
          showUpdateAvailableToast(update, isBeta);
          hasShownUpdateThisSession = true;
          return update;
        }
      }

      // If beta updates are enabled, check beta endpoint
      if (useBeta) {
        try {
          const response = await fetch(BETA_ENDPOINT);
          if (response.ok) {
            const betaManifest = await response.json();

            if (betaManifest.version && compareVersions(betaManifest.version, currentVersion) > 0) {
              // Check if this version is snoozed
              if (isUpdateSnoozed(betaManifest.version)) {
                return { available: true, version: betaManifest.version };
              }

              const betaUpdate = {
                version: betaManifest.version,
                body: betaManifest.notes,
                available: true,
                _isBetaManifest: true
              };
              setUpdateInfo(betaUpdate);
              showUpdateAvailableToast(betaUpdate, true);
              hasShownUpdateThisSession = true;
              return { available: true, version: betaManifest.version };
            }
          }
        } catch (betaErr) {
          console.debug('Beta endpoint not available:', betaErr.message);
        }
      }

      return null;
    } catch (err) {
      // Suppress common errors
      if (err.message && (
        err.message.includes('Could not fetch') ||
        err.message.includes('network') ||
        err.message.includes('Failed to fetch')
      )) {
        // Silent - no update server available or network issue
      } else {
        console.error('Update check failed:', err);
      }
      return null;
    }
  };

  const showUpdateAvailableToast = (update, isBeta = false) => {
    const betaNote = isBeta ? '\n\n⚠️ Beta releases may contain bugs.' : '';

    showEnhancedToast({
      id: 'update-available',
      title: `Update Available: v${update.version}`,
      message: 'A new version of Lokus is ready to install' + (isBeta ? ' (Beta)' : ''),
      variant: 'update',
      expandedContent: (update.body || 'This update includes bug fixes and improvements.') + betaNote,
      persistent: true,
      dismissible: true,
      action: {
        label: 'Update Now',
        onClick: () => downloadAndInstall(update),
      },
      cancel: {
        label: 'Later',
        onClick: () => {
          // Snooze for 24 hours
          snoozeUpdate(update.version);
          toast.dismiss('update-available');
        },
      },
    });
  };

  const downloadAndInstall = async (update) => {
    const updateData = update || updateInfo;
    if (!updateData || !updateData.downloadAndInstall) {
      toast.error('Update not available', {
        description: 'Automatic installation is not available for this update.',
      });
      return;
    }

    try {
      setDownloading(true);
      toast.dismiss('update-available');
      // Clear snooze since user is updating
      clearSnooze();

      // Show downloading toast with progress
      downloadToastId.current = toast.loading('Downloading update...', {
        id: 'update-download',
        description: 'Starting download...',
      });

      let totalBytes = 0;
      let downloadedBytes = 0;

      await updateData.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            toast.loading('Downloading update...', {
              id: 'update-download',
              description: '0% complete',
            });
            break;
          case 'Progress':
            downloadedBytes += event.data.chunkLength || 0;
            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              toast.loading('Downloading update...', {
                id: 'update-download',
                description: `${progress}% complete`,
              });
            }
            break;
          case 'Finished':
            toast.loading('Installing update...', {
              id: 'update-download',
              description: 'Preparing to restart...',
            });
            break;
        }
      });

      toast.success('Update installed!', {
        id: 'update-download',
        description: 'Restarting Lokus...',
      });

      // Small delay to show success message before relaunch
      setTimeout(async () => {
        await relaunch();
      }, 1000);

    } catch (err) {
      console.error('Update failed:', err);
      toast.error('Update Failed', {
        id: 'update-download',
        description: err.message || 'Unknown error',
      });
      setDownloading(false);
    }
  };

  useEffect(() => {
    const handleCheckUpdate = () => {
      checkForUpdate();
    };

    window.addEventListener('check-for-update', handleCheckUpdate);
    return () => {
      window.removeEventListener('check-for-update', handleCheckUpdate);
    };
  }, [dismissed]);

  // This component no longer renders a modal - it uses toasts instead
  return null;
}
