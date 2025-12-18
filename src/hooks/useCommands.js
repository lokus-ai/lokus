/**
 * useCommands - React hook for accessing plugin commands
 * Provides real-time updates when commands are registered/unregistered
 */

import { useState, useEffect, useCallback } from 'react';
import { commandRegistry } from '../plugins/registry/CommandRegistry.js';

/**
 * Hook to get all commands visible in the command palette
 * Automatically updates when commands are registered or unregistered
 * @returns {Array} Array of commands that should show in palette
 */
export function useCommands() {
  const [commands, setCommands] = useState([]);

  useEffect(() => {
    const updateCommands = () => {
      setCommands(commandRegistry.getPaletteCommands());
    };

    // Initial load
    updateCommands();

    // Listen for changes
    commandRegistry.on('command-registered', updateCommands);
    commandRegistry.on('command-unregistered', updateCommands);
    commandRegistry.on('commands-cleared', updateCommands);

    return () => {
      commandRegistry.off('command-registered', updateCommands);
      commandRegistry.off('command-unregistered', updateCommands);
      commandRegistry.off('commands-cleared', updateCommands);
    };
  }, []);

  return commands;
}

/**
 * Hook to execute commands
 * Returns a function that executes a command by ID
 * @returns {Function} Command execution function
 */
export function useCommandExecute() {
  return useCallback(async (commandId, ...args) => {
    return commandRegistry.execute(commandId, ...args);
  }, []);
}

/**
 * Hook to get all commands (not just palette commands)
 * @returns {Array} All registered commands
 */
export function useAllCommands() {
  const [commands, setCommands] = useState([]);

  useEffect(() => {
    const updateCommands = () => {
      setCommands(commandRegistry.getAll());
    };

    updateCommands();

    commandRegistry.on('command-registered', updateCommands);
    commandRegistry.on('command-unregistered', updateCommands);
    commandRegistry.on('commands-cleared', updateCommands);

    return () => {
      commandRegistry.off('command-registered', updateCommands);
      commandRegistry.off('command-unregistered', updateCommands);
      commandRegistry.off('commands-cleared', updateCommands);
    };
  }, []);

  return commands;
}

/**
 * Hook to get commands by category
 * @param {string} category - Category to filter by
 * @returns {Array} Commands in the specified category
 */
export function useCommandsByCategory(category) {
  const [commands, setCommands] = useState([]);

  useEffect(() => {
    const updateCommands = () => {
      setCommands(commandRegistry.getByCategory(category));
    };

    updateCommands();

    commandRegistry.on('command-registered', updateCommands);
    commandRegistry.on('command-unregistered', updateCommands);
    commandRegistry.on('commands-cleared', updateCommands);

    return () => {
      commandRegistry.off('command-registered', updateCommands);
      commandRegistry.off('command-unregistered', updateCommands);
      commandRegistry.off('commands-cleared', updateCommands);
    };
  }, [category]);

  return commands;
}

/**
 * Hook to check if a command exists
 * @param {string} commandId - Command ID to check
 * @returns {boolean} True if command exists
 */
export function useCommandExists(commandId) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const updateExists = () => {
      setExists(commandRegistry.exists(commandId));
    };

    updateExists();

    commandRegistry.on('command-registered', updateExists);
    commandRegistry.on('command-unregistered', updateExists);
    commandRegistry.on('commands-cleared', updateExists);

    return () => {
      commandRegistry.off('command-registered', updateExists);
      commandRegistry.off('command-unregistered', updateExists);
      commandRegistry.off('commands-cleared', updateExists);
    };
  }, [commandId]);

  return exists;
}
