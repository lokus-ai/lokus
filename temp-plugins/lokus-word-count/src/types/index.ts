/**
 * Type definitions for lokus-word-count
 */

export interface LokusWordCountConfig {
  enabled: boolean;
  options: LokusWordCountOptions;
}

export interface LokusWordCountOptions {
  // Define your plugin options here
  autoActivate?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface LokusWordCountState {
  // Define your plugin state here
  isActive: boolean;
  lastUpdate: Date;
}

export interface LokusWordCountEvents {
  // Define your plugin events here
  activated: void;
  deactivated: void;
  error: Error;
}

// Plugin-specific types
export type LokusWordCountCommand = {
  id: string;
  title: string;
  description?: string;
  keybinding?: string;
};

export type LokusWordCountMenuItem = {
  id: string;
  label: string;
  command: string;
  group?: string;
  when?: string;
};

// Re-export common types from SDK
export type { PluginContext, Logger, Command, MenuItem } from '@lokus/plugin-sdk';