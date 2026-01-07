import { useState, useEffect, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { showEnhancedToast } from './ui/enhanced-toast';

const SNOOZE_STORAGE_KEY = 'lokus_update_snoozed';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const downloadToastId = useRef(null);

  const checkForUpdate = async () => {
    try {
      const update = await check();

      if (update?.available) {
        // Check if this version is snoozed
        if (isUpdateSnoozed(update.version)) {
          console.log(`[UpdateChecker] Update v${update.version} is snoozed, skipping notification`);
          return update;
        }

        setUpdateInfo(update);
        showUpdateAvailableToast(update);
      }

      return update;
    } catch (err) {
      // Suppress "Could not fetch" errors - this is expected if latest.json doesn't exist yet
      if (err.message && !err.message.includes('Could not fetch')) {
        toast.error('Update Check Failed', {
          description: err.message,
        });
      }
      return null;
    }
  };

  const showUpdateAvailableToast = (update) => {
    showEnhancedToast({
      id: 'update-available',
      title: `Update Available: v${update.version}`,
      message: 'A new version of Lokus is ready to install',
      variant: 'update',
      expandedContent: update.body || 'This update includes bug fixes and improvements.',
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
    if (!updateData) return;

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

      await updateData.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            toast.loading('Downloading update...', {
              id: 'update-download',
              description: '0% complete',
            });
            break;
          case 'Progress':
            if (event.data.contentLength) {
              const progress = Math.round((event.data.chunkLength / event.data.contentLength) * 100);
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
      toast.error('Update Failed', {
        id: 'update-download',
        description: err.message,
      });
      setDownloading(false);
    }
  };

  useEffect(() => {
    const handleCheckUpdate = () => {
      checkForUpdate();
    };

    window.addEventListener('check-for-update', handleCheckUpdate);
    return () => window.removeEventListener('check-for-update', handleCheckUpdate);
  }, []);

  // This component no longer renders a modal - it uses toasts instead
  return null;
}
