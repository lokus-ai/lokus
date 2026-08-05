import { z } from 'zod';

export const API_VERSION = 3;

export const PLUGIN_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,63}$/;

export const CAPABILITIES = {
  commands: 'Register and run commands',
  ui: 'Show panels, notifications and status-bar items',
  editor: 'Insert content into the editor',
  'notes.read': 'Read notes in your vault',
  'notes.write': 'Create or modify notes in your vault',
  storage: 'Store its own private data',
  network: 'Access the internet',
  overlay: 'Show an always-on-top overlay window',
};
export const CAPABILITY_IDS = Object.keys(CAPABILITIES);

const id = z.string().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/);
const relPath = z.string().min(1).max(256).regex(/^[a-zA-Z0-9._][a-zA-Z0-9._/-]*$/).refine(
  (p) => !p.includes('..'),
  { message: 'path must not contain ".."' }
);

const CommandSpec = z.object({
  id,
  title: z.string().min(1).max(120),
  icon: z.string().max(64).optional(),
});

const PanelSpec = z.object({
  id,
  title: z.string().min(1).max(120),
  position: z.enum(['left', 'right', 'bottom']).default('right'),
  content: z.union([
    z.object({ type: z.literal('declarative'), spec: z.record(z.any()) }),
    z.object({ type: z.literal('webview'), src: relPath }),
  ]),
});

const StatusItemSpec = z.object({
  id,
  position: z.enum(['left', 'right']).default('right'),
  text: z.string().max(200).default(''),
  tooltip: z.string().max(200).optional(),
  command: z.string().max(80).optional(),
});

const ToolbarItemSpec = z.object({
  id,
  icon: z.string().max(64),
  tooltip: z.string().max(120),
  command: z.string().min(1).max(80),
});

const SlashCommandSpec = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  description: z.string().max(200).optional(),
  insert: z.string().max(10000),
});

const OverlaySpec = z.object({
  id,
  title: z.string().min(1).max(120),
  src: relPath,
  width: z.number().int().min(60).max(2000).default(320),
  height: z.number().int().min(60).max(2000).default(240),
  clickThrough: z.boolean().default(false),
});

const ContributesSchema = z.object({
  commands: z.array(CommandSpec).max(50).default([]),
  panels: z.array(PanelSpec).max(10).default([]),
  statusBar: z.array(StatusItemSpec).max(10).default([]),
  toolbar: z.array(ToolbarItemSpec).max(20).default([]),
  slashCommands: z.array(SlashCommandSpec).max(50).default([]),
  overlays: z.array(OverlaySpec).max(5).default([]),
}).default({});

export const ManifestV3Schema = z.object({
  apiVersion: z.literal(API_VERSION, {
    errorMap: () => ({ message: `apiVersion must be ${API_VERSION} (legacy plugins are not supported)` }),
  }),
  id: z.string().regex(PLUGIN_ID_RE, 'id must be 2-64 chars: letters, digits, hyphens'),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  description: z.string().max(2000).optional(),
  author: z.string().max(200).optional(),
  main: z.string().default('index.js'),
  capabilities: z.array(z.enum(CAPABILITY_IDS)).max(CAPABILITY_IDS.length).default([]),
  activation: z.array(z.string().min(1).max(80)).min(1).default(['startup']),
  contributes: ContributesSchema,
});

export function validateManifest(raw) {
  const parsed = ManifestV3Schema.safeParse(raw);
  if (parsed.success) return { valid: true, manifest: parsed.data, errors: [] };
  const errors = parsed.error.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`);
  return { valid: false, manifest: null, errors };
}

export function parseActivation(event) {
  if (event === 'startup') return { kind: 'startup' };
  const idx = event.indexOf(':');
  if (idx <= 0) return null;
  const kind = event.slice(0, idx);
  const value = event.slice(idx + 1);
  if (!value) return null;
  if (kind === 'command' || kind === 'view' || kind === 'file') return { kind, value };
  return null;
}

export function isV3Manifest(raw) {
  return !!raw && raw.apiVersion === API_VERSION;
}
