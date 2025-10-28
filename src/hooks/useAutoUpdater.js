import { useState, useEffect, useCallback, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const LAST_CHECK_KEY = 'updater_last_check_time';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export const useAutoUpdater = () => {
  const [updateState, setUpdateState] = useState('idle');
  const [version, setVersion] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [error, setError] = useState(null);

  const updateRef = useRef(null);
  const intervalRef = useRef(null);

  // Get last check time from localStorage
  const getLastCheckTime = useCallback(() => {
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    return lastCheck ? parseInt(lastCheck, 10) : 0;
  }, []);

  // Save last check time to localStorage
  const setLastCheckTime = useCallback((time) => {
    localStorage.setItem(LAST_CHECK_KEY, time.toString());
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async (isManual = false) => {
    try {
      setUpdateState('checking');
      setError(null);

      const update = await check();
      const now = Date.now();
      setLastCheckTime(now);

      if (update) {
        setUpdateState('available');
        setVersion(update.version);
        setReleaseNotes(update.body || '');
        updateRef.current = update;

        console.log(
          `Update available: ${update.version}, current version: ${update.currentVersion}`
        );
      } else {
        setUpdateState('idle');
        if (isManual) {
          console.log('No updates available');
        }
      }
    } catch (err) {
      console.error('Error checking for updates:', err);
      // Only show error notification for manual checks
      if (isManual) {
        setError(err.message || 'Failed to check for updates');
        setUpdateState('error');
      } else {
        // For automatic checks, silently fail and stay idle
        setUpdateState('idle');
      }
    }
  }, [setLastCheckTime]);

  // Download update with progress tracking
  const downloadUpdate = useCallback(async () => {
    if (!updateRef.current) {
      setError('No update available to download');
      return;
    }

    try {
      setUpdateState('downloading');
      setDownloadProgress(0);
      setError(null);

      await updateRef.current.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            console.log(`Downloading update ${version}...`);
            setDownloadProgress(0);
            break;
          case 'Progress':
            const progress = Math.round((event.data.chunkLength / event.data.contentLength) * 100);
            setDownloadProgress(progress);
            console.log(`Download progress: ${progress}%`);
            break;
          case 'Finished':
            console.log('Download finished');
            setDownloadProgress(100);
            setUpdateState('ready');
            break;
          default:
            break;
        }
      });
    } catch (err) {
      console.error('Error downloading update:', err);
      setError(err.message || 'Failed to download update');
      setUpdateState('error');
    }
  }, [version]);

  // Install update and restart app
  const installUpdate = useCallback(async () => {
    try {
      setUpdateState('ready');
      console.log('Restarting application to install update...');
      await relaunch();
    } catch (err) {
      console.error('Error installing update:', err);
      setError(err.message || 'Failed to install update');
      setUpdateState('error');
    }
  }, []);

  // Setup periodic checks
  useEffect(() => {
    // Check on mount
    const lastCheck = getLastCheckTime();
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheck;

    // Check immediately if never checked or last check was more than 6 hours ago
    if (timeSinceLastCheck >= CHECK_INTERVAL) {
      checkForUpdates();
    }

    // Setup interval for background polling
    intervalRef.current = setInterval(() => {
      checkForUpdates();
    }, CHECK_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForUpdates, getLastCheckTime]);

  return {
    updateState,
    version,
    downloadProgress,
    releaseNotes,
    error,
    checkForUpdates: () => checkForUpdates(true),
    downloadUpdate,
    installUpdate,
  };
};
