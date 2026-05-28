/**
 * vault-actions - adapter that WRAPS the MCP notes tools
 * (`src/mcp-server/tools/notes.js`) into ActionRegistry entries.
 *
 * This module does NOT modify notes.js. Each MCP tool becomes a `vault.<name>`
 * action whose handler delegates to `executeNoteTool`, exposed to the agent and
 * palette surfaces. The MCP `inputSchema` is converted to the registry's param
 * shape so `toToolSchema()` round-trips correctly.
 *
 * See LOKUS_AI_PRD.md §3.4 (Pattern C).
 */

import { notesTools, executeNoteTool } from '../../../mcp-server/tools/notes.js';
import { actionRegistry } from '../ActionRegistry.js';

/**
 * Convert an MCP JSON Schema (`{type, properties, required}`) into the
 * ActionRegistry param map (`{ [name]: { type, description, required, enum?, items? } }`).
 * @param {Object} schema - tool.inputSchema
 * @returns {Object}
 */
function mcpSchemaToParams(schema) {
  const params = {};
  const required = new Set(schema?.required ?? []);
  for (const [key, value] of Object.entries(schema?.properties ?? {})) {
    params[key] = {
      type: value.type,
      description: value.description ?? '',
      required: required.has(key),
      ...(value.enum ? { enum: value.enum } : {}),
      ...(value.items ? { items: value.items } : {}),
    };
  }
  return params;
}

/**
 * Register all MCP notes tools as `vault.*` actions.
 * Idempotent per id (skips ids already present), so it is safe to call again on
 * a workspace switch with a different `workspacePath`.
 * @param {string} workspacePath - default workspace; ctx.workspacePath overrides at call time
 * @param {Object} [registry=actionRegistry]
 * @returns {string[]} ids registered on this call
 */
export function registerVaultActions(workspacePath, registry = actionRegistry) {
  const registered = [];
  for (const tool of notesTools) {
    const id = `vault.${tool.name}`;
    if (registry.exists(id)) continue;

    registry.register({
      id,
      title: tool.name.replace(/_/g, ' '),
      description: tool.description,
      category: 'vault',
      params: mcpSchemaToParams(tool.inputSchema),
      surfaces: ['agent', 'palette'],
      requiresEditor: false,
      requiresNetwork: false,
      creditCost: 'free',
      pluginId: null,
      handler: async (params, ctx = {}) => {
        const result = await executeNoteTool(
          tool.name,
          params,
          ctx.workspacePath ?? workspacePath,
          null,
        );
        // MCP tools return { content: [{ type:'text', text }] }; surface the text.
        return { type: 'text', content: result?.content?.[0]?.text ?? '' };
      },
    });
    registered.push(id);
  }
  return registered;
}

export default registerVaultActions;
