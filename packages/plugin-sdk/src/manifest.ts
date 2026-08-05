/**
 * Manifest v3 — the contract between a plugin and the Lokus host.
 * Mirrors src/core/plugin-v3/contract.js in the app.
 */

export const API_VERSION = 3 as const;

export type Capability =
  | 'commands'
  | 'ui'
  | 'editor'
  | 'notes.read'
  | 'notes.write'
  | 'storage'
  | 'network'
  | 'overlay';

export interface CommandContribution {
  id: string;
  title: string;
  icon?: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  position?: 'left' | 'right' | 'bottom';
  content:
    | { type: 'declarative'; spec: Record<string, unknown> }
    | { type: 'webview'; src: string };
}

export interface StatusBarContribution {
  id: string;
  position?: 'left' | 'right';
  text?: string;
  tooltip?: string;
  command?: string;
}

export interface ToolbarContribution {
  id: string;
  icon: string;
  tooltip: string;
  command: string;
}

export interface SlashCommandContribution {
  name: string;
  description?: string;
  insert: string;
}

export interface OverlayContribution {
  id: string;
  title: string;
  src: string;
  width?: number;
  height?: number;
  clickThrough?: boolean;
}

export interface Contributes {
  commands?: CommandContribution[];
  panels?: PanelContribution[];
  statusBar?: StatusBarContribution[];
  toolbar?: ToolbarContribution[];
  slashCommands?: SlashCommandContribution[];
  overlays?: OverlayContribution[];
}

/**
 * Activation events control when the plugin's worker boots:
 * 'startup' | 'command:<id>' | 'view:<name>' | 'file:<ext>'
 */
export type ActivationEvent = string;

export interface PluginManifestV3 {
  apiVersion: typeof API_VERSION;
  /** 2-64 chars: letters, digits, hyphens. Becomes the install folder name. */
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main?: string;
  /** Closed vocabulary — unknown values are rejected at install. */
  capabilities?: Capability[];
  activation?: ActivationEvent[];
  contributes?: Contributes;
}
