/**
 * builtin-actions - adapter that WRAPS the existing shortcut catalog
 * (`src/core/shortcuts/registry.js` ACTIONS) into ActionRegistry entries.
 *
 * This module does NOT modify `registry.js`. Each built-in action becomes a
 * free, network-free registry entry whose handler simply re-emits the existing
 * Tauri event, so every current listener keeps working unchanged.
 *
 * See LOKUS_AI_PRD.md §3.4 (Pattern A).
 */

import { emit } from '@tauri-apps/api/event';
import { ACTIONS } from '../../shortcuts/registry.js';
import { actionRegistry } from '../ActionRegistry.js';

/**
 * Register all built-in shortcut actions into the given registry.
 * Idempotent per id: ids already present are skipped (so a re-run after a
 * workspace switch does not throw).
 * @param {Object} [registry=actionRegistry]
 * @returns {string[]} ids registered on this call
 */
export function registerBuiltinActions(registry = actionRegistry) {
  const registered = [];
  for (const action of ACTIONS) {
    if (registry.exists(action.id)) continue;

    // Formatting / insertion shortcuts also make sense from the slash menu and
    // require an active editor; everything else is palette-only and editor-free.
    const isEditorAction =
      action.id.startsWith('format-') || action.id.startsWith('insert-');

    registry.register({
      id: action.id,
      title: action.name,
      description: `Executes "${action.name}" in Lokus`,
      category: 'system',
      surfaces: isEditorAction ? ['palette', 'slash'] : ['palette'],
      params: {},
      requiresEditor: isEditorAction,
      requiresNetwork: false,
      creditCost: 'free',
      pluginId: null,
      handler: async () => {
        await emit(action.event);
        return { type: 'text', content: `Executed: ${action.name}` };
      },
    });
    registered.push(action.id);
  }
  return registered;
}

export default registerBuiltinActions;
