/**
 * Type definitions for {{pluginName}}
 */

export interface {{pluginNamePascalCase}}Config {
  enabled: boolean;
  options: {{pluginNamePascalCase}}Options;
}

export interface {{pluginNamePascalCase}}Options {
  // Define your plugin options here
  autoActivate?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface {{pluginNamePascalCase}}State {
  // Define your plugin state here
  isActive: boolean;
  lastUpdate: Date;
}

export interface {{pluginNamePascalCase}}Events {
  // Define your plugin events here
  activated: void;
  deactivated: void;
  error: Error;
}

// Plugin-specific types
export type {{pluginNamePascalCase}}Command = {
  id: string;
  title: string;
  description?: string;
  keybinding?: string;
};

export type {{pluginNamePascalCase}}MenuItem = {
  id: string;
  label: string;
  command: string;
  group?: string;
  when?: string;
};

// Re-export common types from SDK
export type { PluginContext, Logger, Command, MenuItem } from '@lokus/plugin-sdk';