/**
 * CommandRegistry - Singleton registry for all plugin commands
 * Manages command registration, execution, and integration with Command Palette
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

/**
 * Registry for managing plugin commands
 */
class CommandRegistry extends EventEmitter {
  constructor() {
    super();
    this.commands = new Map();
  }

  /**
   * Register a command
   * @param {Object} command - Command definition
   * @param {string} command.id - Unique command identifier
   * @param {string} command.title - Display title for command palette
   * @param {Function} command.handler - Command execution handler
   * @param {string} [command.category] - Category for grouping in palette
   * @param {string} [command.description] - Description of what command does
   * @param {string} [command.icon] - Icon name or component
   * @param {boolean} [command.showInPalette=true] - Show in command palette
   * @param {boolean} [command.requiresEditor] - Requires editor to be active
   * @param {string} [command.pluginId] - Plugin that registered this command
   * @returns {Object} Disposable to unregister the command
   */
  register(command) {
    if (!command.id) {
      throw new Error('Command must have an id');
    }

    if (!command.title) {
      throw new Error('Command must have a title');
    }

    if (!command.handler || typeof command.handler !== 'function') {
      throw new Error('Command must have a handler function');
    }

    if (this.commands.has(command.id)) {
      throw new Error(`Command ${command.id} already registered`);
    }

    const fullCommand = {
      id: command.id,
      title: command.title,
      handler: command.handler,
      category: command.category || 'Plugin',
      description: command.description || '',
      icon: command.icon || null,
      showInPalette: command.showInPalette !== false,
      requiresEditor: command.requiresEditor || false,
      pluginId: command.pluginId || null
    };

    this.commands.set(command.id, fullCommand);
    this.emit('command-registered', fullCommand);

    return {
      dispose: () => this.unregister(command.id)
    };
  }

  /**
   * Unregister a command
   * @param {string} id - Command ID to unregister
   */
  unregister(id) {
    const command = this.commands.get(id);
    if (command) {
      this.commands.delete(id);
      this.emit('command-unregistered', command);
    }
  }

  /**
   * Execute a command by ID
   * @param {string} id - Command ID to execute
   * @param {...any} args - Arguments to pass to command handler
   * @returns {Promise<any>} Result of command execution
   */
  async execute(id, ...args) {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command ${id} not found`);
    }

    try {
      return await command.handler(...args);
    } catch (error) {
      this.emit('command-error', { commandId: id, error });
      throw error;
    }
  }

  /**
   * Get all registered commands
   * @returns {Array} Array of all commands
   */
  getAll() {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   * @param {string} category - Category to filter by
   * @returns {Array} Array of commands in category
   */
  getByCategory(category) {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  /**
   * Get commands that should show in palette
   * @returns {Array} Array of palette-visible commands
   */
  getPaletteCommands() {
    return this.getAll().filter(cmd => cmd.showInPalette !== false);
  }

  /**
   * Check if a command exists
   * @param {string} id - Command ID to check
   * @returns {boolean} True if command exists
   */
  exists(id) {
    return this.commands.has(id);
  }

  /**
   * Get a specific command
   * @param {string} id - Command ID
   * @returns {Object|null} Command object or null if not found
   */
  get(id) {
    return this.commands.get(id) || null;
  }

  /**
   * Clear all commands for a specific plugin
   * @param {string} pluginId - Plugin ID to clear commands for
   */
  clearPlugin(pluginId) {
    const commandsToRemove = [];
    for (const [id, command] of this.commands) {
      if (command.pluginId === pluginId) {
        commandsToRemove.push(id);
      }
    }
    commandsToRemove.forEach(id => this.unregister(id));
  }

  /**
   * Clear all commands
   */
  clear() {
    this.commands.clear();
    this.emit('commands-cleared');
  }

  /**
   * Get command count
   * @returns {number} Number of registered commands
   */
  get count() {
    return this.commands.size;
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();

// Export class for testing
export default CommandRegistry;
