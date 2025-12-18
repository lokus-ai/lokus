/**
 * TreeViewRegistry - Singleton registry for all plugin tree view providers
 * Manages tree provider registration and integration with TreeView component
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

/**
 * Registry for managing plugin tree view providers
 */
class TreeViewRegistry extends EventEmitter {
  constructor() {
    super();
    this.providers = new Map();
  }

  /**
   * Register a tree view provider
   * @param {Object} registration - Tree view registration
   * @param {string} registration.viewId - Unique identifier for the tree view
   * @param {Object} registration.provider - Tree data provider implementation
   * @param {string} [registration.title] - Display title for the tree view
   * @param {string} [registration.pluginId] - Plugin that registered this tree view
   * @returns {Object} Disposable to unregister the provider
   */
  register(registration) {
    if (!registration.viewId) {
      throw new Error('Tree view must have a viewId');
    }

    if (!registration.provider) {
      throw new Error('Tree view must have a provider');
    }

    if (this.providers.has(registration.viewId)) {
      throw new Error(`Tree view '${registration.viewId}' already registered`);
    }

    const fullRegistration = {
      viewId: registration.viewId,
      provider: registration.provider,
      title: registration.title || registration.viewId,
      pluginId: registration.pluginId || null
    };

    this.providers.set(registration.viewId, fullRegistration);
    this.emit('tree-provider-registered', fullRegistration);

    return {
      dispose: () => this.unregister(registration.viewId)
    };
  }

  /**
   * Unregister a tree view provider
   * @param {string} viewId - Tree view ID to unregister
   */
  unregister(viewId) {
    const registration = this.providers.get(viewId);
    if (registration) {
      this.providers.delete(viewId);
      this.emit('tree-provider-unregistered', registration);
    }
  }

  /**
   * Get all registered tree view providers
   * @returns {Array} Array of all tree view registrations
   */
  getAll() {
    return Array.from(this.providers.values());
  }

  /**
   * Get tree view registrations for a specific plugin
   * @param {string} pluginId - Plugin ID to filter by
   * @returns {Array} Array of tree view registrations for the plugin
   */
  getByPlugin(pluginId) {
    return this.getAll().filter(reg => reg.pluginId === pluginId);
  }

  /**
   * Check if a tree view provider exists
   * @param {string} viewId - Tree view ID to check
   * @returns {boolean} True if provider exists
   */
  exists(viewId) {
    return this.providers.has(viewId);
  }

  /**
   * Get a specific tree view provider
   * @param {string} viewId - Tree view ID
   * @returns {Object|null} Tree view registration or null if not found
   */
  get(viewId) {
    return this.providers.get(viewId) || null;
  }

  /**
   * Clear all tree view providers for a specific plugin
   * @param {string} pluginId - Plugin ID to clear providers for
   */
  clearPlugin(pluginId) {
    const providersToRemove = [];
    for (const [viewId, registration] of this.providers) {
      if (registration.pluginId === pluginId) {
        providersToRemove.push(viewId);
      }
    }
    providersToRemove.forEach(viewId => this.unregister(viewId));
  }

  /**
   * Clear all tree view providers
   */
  clear() {
    this.providers.clear();
    this.emit('tree-providers-cleared');
  }

  /**
   * Get provider count
   * @returns {number} Number of registered providers
   */
  get count() {
    return this.providers.size;
  }
}

// Export singleton instance
export const treeViewRegistry = new TreeViewRegistry();

// Export class for testing
export default TreeViewRegistry;
