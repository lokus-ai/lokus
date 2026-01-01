import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { readConfig } from '../core/config/store.js';
import { getAppVersion } from '../utils/appInfo.js';

// Update endpoints
const STABLE_ENDPOINT = 'https://config.lokusmd.com/api/updates/latest.json';
const BETA_ENDPOINT = 'https://config.lokusmd.com/api/updates/beta.json';

// Simple semver comparison (handles x.y.z and x.y.z-beta.n formats)
function compareVersions(v1, v2) {
  // Parse version strings
  const parse = (v) => {
    const [main, pre] = v.replace(/^v/, '').split('-');
    const parts = main.split('.').map(Number);
    const prerelease = pre ? pre.split('.') : null;
    return { parts, prerelease };
  };

  const a = parse(v1);
  const b = parse(v2);

  // Compare main version parts
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

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isBetaUpdate, setIsBetaUpdate] = useState(false);

  const checkForUpdate = async () => {
    try {
      setError(null);

      // Read beta preference from config
      const config = await readConfig();
      const useBeta = config?.updates?.betaChannel || false;

      // First, try the standard Tauri updater (for stable updates)
      const update = await check();

      if (update?.available) {
        setUpdateInfo(update);
        setUpdateAvailable(true);
        setIsBetaUpdate(false);
        setShowModal(true);
        return update;
      }

      // If beta updates are enabled and no stable update found, check beta endpoint
      if (useBeta) {
        try {
          const response = await fetch(BETA_ENDPOINT);
          if (response.ok) {
            const betaManifest = await response.json();
            const currentVersion = await getAppVersion();

            // Check if beta version is newer than current
            if (betaManifest.version && compareVersions(betaManifest.version, currentVersion) > 0) {
              // Create a pseudo-update object for UI
              setUpdateInfo({
                version: betaManifest.version,
                body: betaManifest.notes,
                available: true,
                _betaManifest: betaManifest // Store for potential manual download
              });
              setUpdateAvailable(true);
              setIsBetaUpdate(true);
              setShowModal(true);
              return { available: true, version: betaManifest.version };
            }
          }
        } catch (betaErr) {
          // Beta endpoint might not exist yet, that's fine
          console.debug('Beta endpoint not available:', betaErr.message);
        }
      }

      return update;
    } catch (err) {
      // Suppress "Could not fetch" errors - this is expected if latest.json doesn't exist yet
      // (e.g., first release with updater enabled, or old releases without updater artifacts)
      if (err.message && err.message.includes('Could not fetch')) {
        // Silent - no update server available
      } else {
        setError(err.message);
      }
      return null;
    }
  };

  const downloadAndInstall = async () => {
    if (!updateInfo) return;

    try {
      setDownloading(true);
      setError(null);

      await updateInfo.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress(0);
            break;
          case 'Progress':
            if (event.data.contentLength) {
              const progress = (event.data.chunkLength / event.data.contentLength) * 100;
              setDownloadProgress(Math.round(progress));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      await relaunch();
    } catch (err) {
      setError(err.message);
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

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {downloading ? 'Downloading Update...' : 'Update Available'}
          </h2>
          {isBetaUpdate && !downloading && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
              BETA
            </span>
          )}
        </div>

        {error ? (
          <div className="mb-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <div className="mb-4">
            {downloading ? (
              <div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {downloadProgress}% complete
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Version {updateInfo?.version} is now available
                </p>
                {isBetaUpdate && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                    This is a beta release and may contain bugs.
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Would you like to download and install it now?
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          {!downloading && (
            <>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Later
              </button>
              <button
                onClick={downloadAndInstall}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
              >
                Update Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
