/**
 * ActionRegistry - LLM-callable tool layer for Lokus actions.
 *
 * A structural superset of `src/plugins/registry/CommandRegistry.js` (same
 * `EventEmitter` + `Map` design). `CommandRegistry` stays the UI command palette;
 * `ActionRegistry` is the layer the AI calls. They coexist - this file does not
 * modify CommandRegistry or any other registry.
 *
 * Over CommandRegistry, an action also carries a `params` JSON Schema and a
 * `surfaces` array, `execute()` takes a typed ActionContext, and the registry
 * projects to `toToolSchema()` (Anthropic/OpenAI), `toMcpManifest()` (MCP
 * tools/list), `bySurface()`, `byCategory()` and `freeActions()`.
 *
 * See LOKUS_AI_PRD.md §3.
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

/**
 * Sanitize an action id into a provider-safe tool name.
 * Anthropic/OpenAI tool names must match ^[a-zA-Z0-9_-]+$ and many SDKs reject
 * dots, so we collapse `.` and `-` to `_` (e.g. `vault.search` -> `vault_search`).
 * @param {string} id
 * @returns {string}
 */
function toToolName(id) {
  return id.replace(/[.-]/g, '_');
}

/**
 * Build a JSON Schema `properties`/`required` pair from an action's params map.
 * @param {Object} params - { [name]: { type, description?, enum?, default?, required?, items? } }
 * @param {boolean} includeDefault - whether to emit `default` (MCP tools/list omits it)
 * @returns {{ properties: Object, required: string[] }}
 */
function paramsToSchema(params, includeDefault) {
  const properties = {};
  const required = [];
  for (const [key, spec] of Object.entries(params ?? {})) {
    properties[key] = {
      type: spec.type,
      description: spec.description ?? '',
      ...(spec.enum ? { enum: spec.enum } : {}),
      ...(includeDefault && spec.default !== undefined ? { default: spec.default } : {}),
      ...(spec.items ? { items: spec.items } : {}),
    };
    if (spec.required) required.push(key);
  }
  return { properties, required };
}

class ActionRegistry extends EventEmitter {
  constructor() {
    super();
    this._actions = new Map();
  }

  /**
   * Register an LLM-callable action.
   * @param {Object} action
   * @param {string} action.id - Unique action identifier (e.g. `vault.search`)
   * @param {string} action.title - Human title (used in palette / surfaces)
   * @param {Function} action.handler - async (params, context) => ActionResult
   * @param {string} [action.description] - Doubles as the LLM tool description
   * @param {string} [action.category] - 'vault'|'editor'|'search'|'ai'|'system'|'plugin'
   * @param {string|null} [action.icon] - Lucide icon name
   * @param {Object} [action.params] - JSON-Schema-ish param map (see paramsToSchema)
   * @param {string[]} [action.surfaces] - 'slash'|'palette'|'selection'|'agent'|'ambient'
   * @param {boolean} [action.requiresEditor]
   * @param {boolean} [action.requiresSelection]
   * @param {boolean} [action.requiresNetwork]
   * @param {string} [action.creditCost] - 'free'|'low'|'medium'|'high'
   * @param {string|null} [action.pluginId]
   * @returns {{ dispose: Function }} Disposable to unregister.
   */
  register(action) {
    const { id, title, handler } = action;
    if (!id || !title || typeof handler !== 'function') {
      throw new Error('ActionRegistry.register: id, title, handler required');
    }
    if (this._actions.has(id)) {
      throw new Error(`Action "${id}" already registered`);
    }

    const entry = {
      id,
      title,
      description: action.description ?? '',
      category: action.category ?? 'plugin',
      icon: action.icon ?? null,
      params: action.params ?? {},
      surfaces: action.surfaces ?? ['palette'],
      requiresEditor: action.requiresEditor ?? false,
      requiresSelection: action.requiresSelection ?? false,
      requiresNetwork: action.requiresNetwork ?? true,
      creditCost: action.creditCost ?? 'medium',
      pluginId: action.pluginId ?? null,
      handler,
    };

    this._actions.set(id, entry);
    this.emit('action-registered', entry);

    return { dispose: () => this.unregister(id) };
  }

  /**
   * Unregister an action by id.
   * @param {string} id
   */
  unregister(id) {
    const entry = this._actions.get(id);
    if (entry) {
      this._actions.delete(id);
      this.emit('action-unregistered', entry);
    }
  }

  /** @param {string} id @returns {Object|null} */
  get(id) {
    return this._actions.get(id) ?? null;
  }

  /** @param {string} id @returns {boolean} */
  exists(id) {
    return this._actions.has(id);
  }

  /** @returns {Object[]} all registered actions */
  getAll() {
    return [...this._actions.values()];
  }

  /** @param {string} surface @returns {Object[]} */
  bySurface(surface) {
    return this.getAll().filter((a) => a.surfaces.includes(surface));
  }

  /** @param {string} category @returns {Object[]} */
  byCategory(category) {
    return this.getAll().filter((a) => a.category === category);
  }

  /** @returns {Object[]} actions that cost no credits (run locally / events) */
  freeActions() {
    return this.getAll().filter((a) => a.creditCost === 'free');
  }

  /**
   * Execute a registered action.
   * @param {string} id
   * @param {Object} params - validated externally; passed to the handler verbatim
   * @param {Object} context - ActionContext (see PRD §3.2); never serialized
   * @returns {Promise<Object>} ActionResult
   */
  async execute(id, params, context = {}) {
    const action = this._actions.get(id);
    if (!action) {
      const error = new Error(`Action "${id}" not found`);
      this.emit('action-error', { id, error });
      throw error;
    }

    if (action.requiresEditor && !context.editorAPI?.editorInstance) {
      throw new Error(`Action "${id}" requires an active editor`);
    }
    if (action.requiresSelection) {
      const selection = context.editorAPI?.editorInstance?.state?.selection;
      if (!selection || selection.empty) {
        throw new Error(`Action "${id}" requires a selection`);
      }
    }

    const started = Date.now();
    try {
      const result = await action.handler(params, context);
      this.emit('action-executed', { id, durationMs: Date.now() - started, result });
      return result;
    } catch (error) {
      this.emit('action-error', { id, error });
      throw error;
    }
  }

  /**
   * Project actions to provider tool-call schemas.
   *
   * Anthropic shape (default): { name, description, input_schema:{type:'object', properties, required?} }
   * OpenAI shape:              { type:'function', function:{ name, description, parameters } }
   *
   * The `input_schema` object matches the board's canonical `Tool.input_schema`
   * contract so engine and proxy stay aligned.
   *
   * @param {Object} [opts]
   * @param {'anthropic'|'openai'} [opts.provider='anthropic']
   * @param {string} [opts.surface] - restrict to a surface
   * @param {string} [opts.category] - restrict to a category
   * @returns {Object[]}
   */
  toToolSchema({ provider = 'anthropic', surface, category } = {}) {
    let actions = this.getAll();
    if (surface) actions = actions.filter((a) => a.surfaces.includes(surface));
    if (category) actions = actions.filter((a) => a.category === category);

    return actions.map((a) => {
      const { properties, required } = paramsToSchema(a.params, true);
      const input_schema = {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
      };
      if (provider === 'openai') {
        return {
          type: 'function',
          function: {
            name: toToolName(a.id),
            description: a.description,
            parameters: input_schema,
          },
        };
      }
      return {
        name: toToolName(a.id),
        description: a.description,
        input_schema,
      };
    });
  }

  /**
   * Project actions to the MCP `tools/list` manifest shape. Unlike toToolSchema,
   * MCP keeps the raw (dotted) id as the tool name and attaches Lokus metadata
   * under `_lokus`.
   * @param {Object} [opts]
   * @param {string} [opts.surface]
   * @returns {{ tools: Object[] }}
   */
  toMcpManifest({ surface } = {}) {
    let actions = this.getAll();
    if (surface) actions = actions.filter((a) => a.surfaces.includes(surface));

    return {
      tools: actions.map((a) => {
        const { properties, required } = paramsToSchema(a.params, false);
        return {
          name: a.id,
          description: a.description,
          inputSchema: {
            type: 'object',
            properties,
            ...(required.length ? { required } : {}),
          },
          _lokus: {
            surfaces: a.surfaces,
            category: a.category,
            creditCost: a.creditCost,
            icon: a.icon,
          },
        };
      }),
    };
  }

  /**
   * Remove every action registered by a given plugin.
   * @param {string} pluginId
   */
  clearPlugin(pluginId) {
    for (const [id, action] of this._actions) {
      if (action.pluginId === pluginId) this.unregister(id);
    }
  }

  /** @returns {number} number of registered actions */
  get count() {
    return this._actions.size;
  }
}

// Singleton used across surfaces (mirrors commandRegistry).
export const actionRegistry = new ActionRegistry();
export default ActionRegistry;
