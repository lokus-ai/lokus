/**
 * Platform Feature Flags
 * 
 * Centralized feature flag management for platform-specific capabilities
 */

import { getPlatform, hasCapability } from '../../platform/index.js';
import { isFeatureEnabled } from '../../config/platforms/index.js';

// Feature flag definitions
export const FEATURES = {
  // Shell/OS Integration
  SHELL_INTEGRATION: 'shellIntegration',
  CONTEXT_MENUS: 'contextMenus',
  FILE_ASSOCIATIONS: 'fileAssociations',
  JUMP_LIST: 'jumpList',
  
  // UI/UX Features
  DARK_MODE_SYNC: 'darkModeSync',
  NATIVE_DIALOGS: 'nativeDialogs',
  SNAP_LAYOUTS: 'snapLayouts',
  ACRYLIC_EFFECT: 'acrylicEffect',
  VIBRANCY_EFFECT: 'vibrancyEffect',
  
  // Platform-specific
  WINDOWS_HELLO: 'windowsHello',
  TOUCH_ID: 'touchId',
  TOUCH_BAR: 'touchBar',
  QUICK_LOOK: 'quickLook',
  SPOTLIGHT: 'spotlight',
  
  // Notifications
  NATIVE_NOTIFICATIONS: 'nativeNotifications',
  BADGE_SUPPORT: 'badgeSupport',
  ACTION_CENTER: 'actionCenter',
  
  // Performance
  HARDWARE_ACCELERATION: 'hardwareAcceleration',
  GPU_RASTERIZATION: 'gpuRasterization',
  METAL_ACCELERATION: 'metalAcceleration',
  
  // Cloud/Sync
  ICLOUD_SYNC: 'icloudSync',
  ONEDRIVE_SYNC: 'onedriveSync',
  
  // Continuity
  HANDOFF: 'handoff',
  UNIVERSAL_CLIPBOARD: 'universalClipboard',
  
  // Experimental
  EXPERIMENTAL_FEATURES: 'experimentalFeatures'
};

// Feature flag status cache
const featureCache = new Map();

/**
 * Check if a feature is available on the current platform
 * @param {string} feature - Feature flag from FEATURES object
 * @returns {boolean} Whether the feature is available
 */
export function isFeatureAvailable(feature) {
  // Check cache first
  if (featureCache.has(feature)) {
    return featureCache.get(feature);
  }
  
  // Check platform capability first (hardware/OS support)
  const hasCapabilitySupport = hasCapability(feature);
  
  // Then check if it's enabled in configuration
  const isEnabled = isFeatureEnabled(feature);
  
  // Feature is available if both capability exists and it's enabled
  const available = hasCapabilitySupport && isEnabled;
  
  // Cache the result
  featureCache.set(feature, available);
  
  return available;
}

/**
 * Get all available features for the current platform
 * @returns {Object} Object with feature names as keys and availability as values
 */
export function getAvailableFeatures() {
  const available = {};
  
  for (const [key, feature] of Object.entries(FEATURES)) {
    available[key] = isFeatureAvailable(feature);
  }
  
  return available;
}

/**
 * Check multiple features at once
 * @param {string[]} features - Array of feature flags
 * @returns {boolean} True if ALL features are available
 */
export function areFeaturesAvailable(...features) {
  return features.every(feature => isFeatureAvailable(feature));
}

/**
 * Check if any of the features are available
 * @param {string[]} features - Array of feature flags
 * @returns {boolean} True if ANY feature is available
 */
export function isAnyFeatureAvailable(...features) {
  return features.some(feature => isFeatureAvailable(feature));
}

/**
 * Get platform-specific feature recommendations
 * @returns {Object} Recommended features for the platform
 */
export function getRecommendedFeatures() {
  const platform = getPlatform();
  
  const recommendations = {
    windows: [
      FEATURES.SHELL_INTEGRATION,
      FEATURES.CONTEXT_MENUS,
      FEATURES.JUMP_LIST,
      FEATURES.DARK_MODE_SYNC,
      FEATURES.SNAP_LAYOUTS,
      FEATURES.NATIVE_NOTIFICATIONS,
      FEATURES.ACTION_CENTER
    ],
    macos: [
      FEATURES.QUICK_LOOK,
      FEATURES.SPOTLIGHT,
      FEATURES.TOUCH_BAR,
      FEATURES.DARK_MODE_SYNC,
      FEATURES.VIBRANCY_EFFECT,
      FEATURES.NATIVE_NOTIFICATIONS,
      FEATURES.HANDOFF,
      FEATURES.UNIVERSAL_CLIPBOARD
    ],
    linux: [
      FEATURES.CONTEXT_MENUS,
      FEATURES.NATIVE_DIALOGS,
      FEATURES.HARDWARE_ACCELERATION
    ]
  };
  
  const platformRecommendations = recommendations[platform] || [];
  
  return platformRecommendations.reduce((acc, feature) => {
    acc[feature] = isFeatureAvailable(feature);
    return acc;
  }, {});
}

/**
 * Clear the feature cache (useful when configuration changes)
 */
export function clearFeatureCache() {
  featureCache.clear();
}

/**
 * Feature groups for UI organization
 */
export const FEATURE_GROUPS = {
  'System Integration': [
    FEATURES.SHELL_INTEGRATION,
    FEATURES.CONTEXT_MENUS,
    FEATURES.FILE_ASSOCIATIONS,
    FEATURES.JUMP_LIST,
    FEATURES.QUICK_LOOK,
    FEATURES.SPOTLIGHT
  ],
  'User Interface': [
    FEATURES.DARK_MODE_SYNC,
    FEATURES.NATIVE_DIALOGS,
    FEATURES.SNAP_LAYOUTS,
    FEATURES.ACRYLIC_EFFECT,
    FEATURES.VIBRANCY_EFFECT,
    FEATURES.TOUCH_BAR
  ],
  'Notifications': [
    FEATURES.NATIVE_NOTIFICATIONS,
    FEATURES.BADGE_SUPPORT,
    FEATURES.ACTION_CENTER
  ],
  'Security': [
    FEATURES.WINDOWS_HELLO,
    FEATURES.TOUCH_ID
  ],
  'Performance': [
    FEATURES.HARDWARE_ACCELERATION,
    FEATURES.GPU_RASTERIZATION,
    FEATURES.METAL_ACCELERATION
  ],
  'Cloud & Sync': [
    FEATURES.ICLOUD_SYNC,
    FEATURES.ONEDRIVE_SYNC,
    FEATURES.HANDOFF,
    FEATURES.UNIVERSAL_CLIPBOARD
  ]
};

/**
 * Get human-readable feature names
 */
export const FEATURE_NAMES = {
  [FEATURES.SHELL_INTEGRATION]: 'Shell Integration',
  [FEATURES.CONTEXT_MENUS]: 'Context Menus',
  [FEATURES.FILE_ASSOCIATIONS]: 'File Associations',
  [FEATURES.JUMP_LIST]: 'Jump List (Windows)',
  [FEATURES.DARK_MODE_SYNC]: 'Dark Mode Sync',
  [FEATURES.NATIVE_DIALOGS]: 'Native Dialogs',
  [FEATURES.SNAP_LAYOUTS]: 'Snap Layouts (Windows 11)',
  [FEATURES.ACRYLIC_EFFECT]: 'Acrylic Effect (Windows)',
  [FEATURES.VIBRANCY_EFFECT]: 'Vibrancy Effect (macOS)',
  [FEATURES.WINDOWS_HELLO]: 'Windows Hello',
  [FEATURES.TOUCH_ID]: 'Touch ID (macOS)',
  [FEATURES.TOUCH_BAR]: 'Touch Bar (macOS)',
  [FEATURES.QUICK_LOOK]: 'Quick Look (macOS)',
  [FEATURES.SPOTLIGHT]: 'Spotlight Search (macOS)',
  [FEATURES.NATIVE_NOTIFICATIONS]: 'Native Notifications',
  [FEATURES.BADGE_SUPPORT]: 'Badge Support',
  [FEATURES.ACTION_CENTER]: 'Action Center (Windows)',
  [FEATURES.HARDWARE_ACCELERATION]: 'Hardware Acceleration',
  [FEATURES.GPU_RASTERIZATION]: 'GPU Rasterization',
  [FEATURES.METAL_ACCELERATION]: 'Metal Acceleration (macOS)',
  [FEATURES.ICLOUD_SYNC]: 'iCloud Sync',
  [FEATURES.ONEDRIVE_SYNC]: 'OneDrive Sync',
  [FEATURES.HANDOFF]: 'Handoff (macOS)',
  [FEATURES.UNIVERSAL_CLIPBOARD]: 'Universal Clipboard (macOS)',
  [FEATURES.EXPERIMENTAL_FEATURES]: 'Experimental Features'
};