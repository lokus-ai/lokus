/**
 * Type definitions for test-plugin-v3
 */

export interface TestPluginV3Config {
  enabled: boolean;
  options: TestPluginV3Options;
}

export interface TestPluginV3Options {
  // Define your plugin options here
  autoActivate?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface TestPluginV3State {
  // Define your plugin state here
  isActive: boolean;
  lastUpdate: Date;
}

export interface TestPluginV3Events {
  // Define your plugin events here
  activated: void;
  deactivated: void;
  error: Error;
}

// Plugin-specific types
export type TestPluginV3Command = {
  id: string;
  title: string;
  description?: string;
  keybinding?: string;
};

export type TestPluginV3MenuItem = {
  id: string;
  label: string;
  command: string;
  group?: string;
  when?: string;
};

// Re-export common types from SDK
export type { PluginContext, Logger, Command, MenuItem } from '@lokus/plugin-sdk';