/**
 * Lokus Plugin SDK v3 — types and helpers for building Lokus plugins.
 *
 * v3 plugins run in a dedicated Worker and receive a capability-gated
 * `LokusAPI` in `activate`. The SDK major version matches the manifest
 * `apiVersion` it speaks: SDK 3.x ↔ apiVersion 3.
 */
import pkg from '../package.json';

export const SDK_VERSION: string = pkg.version;

export * from './api.js';
export * from './manifest.js';
export * from './plugin.js';
export * from './templates/index.js';
export * from './testing/index.js';
