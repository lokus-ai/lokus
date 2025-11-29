/**
 * Application Information Utility
 *
 * Provides access to app version and metadata
 */

import { invoke } from '@tauri-apps/api/core';
import { getName, getVersion, getTauriVersion } from '@tauri-apps/api/app';

let cachedAppInfo = null;

/**
 * Get application version from multiple sources
 * @returns {Promise<string>} Application version
 */
export async function getAppVersion() {
  try {
    // Try Tauri API first
    const version = await getVersion();
    return version;
  } catch (error) {
    // Fallback to package.json version in development
    if (import.meta.env.DEV) {
      return '1.3.5-dev';
    }
    return '1.3.5';
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

    cachedAppInfo = {
      name,
      version,
      tauriVersion,
      environment: import.meta.env.MODE,
      isDev: import.meta.env.DEV
    };

    return cachedAppInfo;
  } catch (error) {
    // Fallback information
    return {
      name: 'Lokus',
      version: '1.3.5',
      tauriVersion: 'unknown',
      environment: import.meta.env.MODE || 'production',
      isDev: import.meta.env.DEV || false
    };
  }
}

/**
 * Clear cached app info (useful for testing)
 */
export function clearAppInfoCache() {
  cachedAppInfo = null;
}
