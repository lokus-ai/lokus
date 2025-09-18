/**
 * Lokus Plugin API - Export for plugins to import
 * This file acts as the '@lokus/plugin-api' package that plugins import
 */

import LokusPluginAPI from './LokusPluginAPI.js';

// Export the main Plugin API class as the default
export default LokusPluginAPI;

// Named exports for specific components
export {
  LokusPluginAPI as PluginAPI,
  EditorAPI,
  UIAPI,
  FilesystemAPI,
  CommandsAPI,
  NetworkAPI,
  ClipboardAPI,
  NotificationsAPI,
  DataAPI
} from './LokusPluginAPI.js';

// This is what plugins import when they do:
// import { PluginAPI } from '@lokus/plugin-api';