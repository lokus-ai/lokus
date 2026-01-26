/**
 * Application Information Utility
 *
 * Provides access to app version and metadata
 */

import { getName, getVersion, getTauriVersion } from '@tauri-apps/api/app';
// Import version from package.json at build time (Vite handles this)
import pkg from '../../package.json';

let cachedAppInfo = null;

/**
 * Get application version from multiple sources
 * @returns {Promise<string>} Application version
 */
export async function getAppVersion() {
  try {
    // Try Tauri API first - this reads from tauri.conf.json
    const version = await getVersion();
    return version;
  } catch (error) {
    // Fallback to package.json version (imported at build time)
    return pkg.version;
  }
}

/**
 * Get complete app information
 * @returns {Promise<Object>} App information object
 */
export async function getAppInfo() {
  if (cachedAppInfo) {
    return cachedAppInfo;
  }

  try {
    const [name, version, tauriVersion] = await Promise.all([
      getName(),
      getVersion(),
      getTauriVersion()
    ]);

    const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';
    const mode = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.MODE : process.env.NODE_ENV || 'production';

    cachedAppInfo = {
      name,
      version,
      tauriVersion,
      environment: mode,
      isDev: isDev
    };

    return cachedAppInfo;
  } catch (error) {
    // Fallback information using package.json version
    const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';
    const mode = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.MODE : process.env.NODE_ENV || 'production';
    return {
      name: 'Lokus',
      version: pkg.version,
      tauriVersion: 'unknown',
      environment: mode,
      isDev: isDev
    };
  }
}

/**
 * Clear cached app info (useful for testing)
 */
export function clearAppInfoCache() {
  cachedAppInfo = null;
}
