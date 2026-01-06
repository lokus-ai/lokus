import { useState, useEffect, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { readConfig } from '../core/config/store.js';
import { getAppVersion } from '../utils/appInfo.js';
import { X, Download, RefreshCw } from 'lucide-react';

// Update endpoints
const STABLE_ENDPOINT = 'https://config.lokusmd.com/api/updates/latest.json';
const BETA_ENDPOINT = 'https://config.lokusmd.com/api/updates/beta.json';

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

export default function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [isBetaUpdate, setIsBetaUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = async () => {
    // Don't show again if already shown this session or dismissed
    if (hasShownUpdateThisSession || dismissed) {
      return null;
    }

    try {
      setError(null);

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
          setUpdateInfo(update);
          setIsBetaUpdate(update.version.includes('beta') || update.version.includes('alpha'));
          setShowToast(true);
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
              // For beta, we still use Tauri updater but from beta endpoint
              // Re-check with the standard updater since we can't easily switch endpoints
              setUpdateInfo({
                version: betaManifest.version,
                body: betaManifest.notes,
                available: true,
                _isBetaManifest: true
              });
              setIsBetaUpdate(true);
              setShowToast(true);
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

  const downloadAndInstall = async () => {
    if (!updateInfo || !updateInfo.downloadAndInstall) {
      setError('Update not available for automatic installation');
      return;
    }

    try {
      setDownloading(true);
      setError(null);
      setDownloadProgress(0);
      setDownloadedBytes(0);

      await updateInfo.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setTotalBytes(event.data.contentLength || 0);
            setDownloadProgress(0);
            break;
          case 'Progress':
            setDownloadedBytes(prev => {
              const newTotal = prev + (event.data.chunkLength || 0);
              if (totalBytes > 0) {
                setDownloadProgress(Math.round((newTotal / totalBytes) * 100));
              }
              return newTotal;
            });
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      // Small delay before relaunch for user to see 100%
      setTimeout(() => {
        relaunch();
      }, 500);
    } catch (err) {
      setError(err.message || 'Download failed');
      setDownloading(false);
    }
  };

  const handleDismiss = () => {
    setShowToast(false);
    setDismissed(true);
  };

  useEffect(() => {
    const handleCheckUpdate = () => {
      checkForUpdate();
    };

    window.addEventListener('check-for-update', handleCheckUpdate);
    return () => window.removeEventListener('check-for-update', handleCheckUpdate);
  }, [dismissed]);

  if (!showToast) return null;

  // Toast notification in bottom-right corner
  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-app-panel border border-app-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-app-accent" />
            <span className="font-medium text-sm">Update Available</span>
            {isBetaUpdate && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
                BETA
              </span>
            )}
          </div>
          {!downloading && (
            <button
              onClick={handleDismiss}
              className="text-app-muted hover:text-app-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : downloading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-app-muted">
                <span>Downloading...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full bg-app-border rounded-full h-1.5">
                <div
                  className="bg-app-accent h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              {downloadProgress === 100 && (
                <p className="text-xs text-app-muted flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Installing and restarting...
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-app-text">
                Version <span className="font-semibold">{updateInfo?.version}</span> is ready
              </p>
              {isBetaUpdate && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Beta releases may contain bugs.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-3 py-1.5 text-sm text-app-muted hover:text-app-text hover:bg-app-hover rounded transition-colors"
                >
                  Later
                </button>
                <button
                  onClick={downloadAndInstall}
                  className="flex-1 px-3 py-1.5 text-sm bg-app-accent text-app-accent-fg rounded hover:opacity-90 transition-opacity"
                >
                  Update
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
