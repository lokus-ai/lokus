/**
 * Unit tests for CommandAPI
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import CommandRegistry, { commandRegistry } from '../../../src/plugins/registry/CommandRegistry.js';
import { CommandsAPI } from '../../../src/plugins/api/LokusPluginAPI.js';

describe('CommandRegistry', () => {
  let registry;

  beforeEach(() => {
    // Create a fresh registry for each test
    registry = new CommandRegistry();
  });

  afterEach(() => {
    // Clean up
    registry.clear();
  });

  describe('register()', () => {
    test('should register a command successfully', () => {
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      const disposable = registry.register(command);

      expect(registry.exists('test.command')).toBe(true);
      expect(disposable).toHaveProperty('dispose');
    });

    test('should throw error if command has no id', () => {
      expect(() => {
        registry.register({ title: 'Test', handler: () => {} });
      }).toThrow('Command must have an id');
    });

    test('should throw error if command has no title', () => {
      expect(() => {
        registry.register({ id: 'test', handler: () => {} });
      }).toThrow('Command must have a title');
    });

    test('should throw error if command has no handler', () => {
      expect(() => {
        registry.register({ id: 'test', title: 'Test' });
      }).toThrow('Command must have a handler function');
    });

    test('should throw error if command id already exists', () => {
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      registry.register(command);

      expect(() => {
        registry.register(command);
      }).toThrow('Command test.command already registered');
    });

    test('should set default values for optional properties', () => {
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      registry.register(command);
      const registered = registry.get('test.command');

      expect(registered.category).toBe('Plugin');
      expect(registered.description).toBe('');
      expect(registered.showInPalette).toBe(true);
      expect(registered.requiresEditor).toBe(false);
    });

    test('should emit command-registered event', () => {
      const listener = vi.fn();
      registry.on('command-registered', listener);

      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      registry.register(command);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test.command',
        title: 'Test Command'
      }));
    });
  });

  describe('unregister()', () => {
    test('should unregister a command', () => {
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      registry.register(command);
      expect(registry.exists('test.command')).toBe(true);

      registry.unregister('test.command');
      expect(registry.exists('test.command')).toBe(false);
    });

    test('should emit command-unregistered event', () => {
      const listener = vi.fn();
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      registry.register(command);
      registry.on('command-unregistered', listener);
      registry.unregister('test.command');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should do nothing if command does not exist', () => {
      expect(() => {
        registry.unregister('non.existent');
      }).not.toThrow();
    });

    test('should unregister via Disposable', () => {
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      };

      const disposable = registry.register(command);
      expect(registry.exists('test.command')).toBe(true);

      disposable.dispose();
      expect(registry.exists('test.command')).toBe(false);
    });
  });

  describe('execute()', () => {
    test('should execute a command handler', async () => {
      const handler = vi.fn().mockReturnValue('result');
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler
      };

      registry.register(command);
      const result = await registry.execute('test.command');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    test('should pass arguments to handler', async () => {
      const handler = vi.fn();
      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler
      };

      registry.register(command);
      await registry.execute('test.command', 'arg1', 'arg2');

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should throw error if command not found', async () => {
      await expect(registry.execute('non.existent')).rejects.toThrow('Command non.existent not found');
    });

    test('should emit command-error event on handler error', async () => {
      const listener = vi.fn();
      const error = new Error('Handler failed');
      const handler = vi.fn().mockRejectedValue(error);

      const command = {
        id: 'test.command',
        title: 'Test Command',
        handler
      };

      registry.register(command);
      registry.on('command-error', listener);

      await expect(registry.execute('test.command')).rejects.toThrow('Handler failed');
      expect(listener).toHaveBeenCalledWith({
        commandId: 'test.command',
        error
      });
    });
  });

  describe('getAll()', () => {
    test('should return all registered commands', () => {
      registry.register({ id: 'cmd1', title: 'Command 1', handler: () => {} });
      registry.register({ id: 'cmd2', title: 'Command 2', handler: () => {} });
      registry.register({ id: 'cmd3', title: 'Command 3', handler: () => {} });

      const commands = registry.getAll();
      expect(commands).toHaveLength(3);
      expect(commands.map(c => c.id)).toContain('cmd1');
      expect(commands.map(c => c.id)).toContain('cmd2');
      expect(commands.map(c => c.id)).toContain('cmd3');
    });

    test('should return empty array if no commands', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getByCategory()', () => {
    test('should filter commands by category', () => {
      registry.register({ id: 'cmd1', title: 'Command 1', handler: () => {}, category: 'Edit' });
      registry.register({ id: 'cmd2', title: 'Command 2', handler: () => {}, category: 'View' });
      registry.register({ id: 'cmd3', title: 'Command 3', handler: () => {}, category: 'Edit' });

      const editCommands = registry.getByCategory('Edit');
      expect(editCommands).toHaveLength(2);
      expect(editCommands.every(c => c.category === 'Edit')).toBe(true);
    });

    test('should return empty array if no commands in category', () => {
      registry.register({ id: 'cmd1', title: 'Command 1', handler: () => {}, category: 'Edit' });
      expect(registry.getByCategory('View')).toEqual([]);
    });
  });

  describe('getPaletteCommands()', () => {
    test('should return only commands visible in palette', () => {
      registry.register({ id: 'cmd1', title: 'Command 1', handler: () => {}, showInPalette: true });
      registry.register({ id: 'cmd2', title: 'Command 2', handler: () => {}, showInPalette: false });
      registry.register({ id: 'cmd3', title: 'Command 3', handler: () => {} }); // defaults to true

      const paletteCommands = registry.getPaletteCommands();
      expect(paletteCommands).toHaveLength(2);
      expect(paletteCommands.map(c => c.id)).toContain('cmd1');
      expect(paletteCommands.map(c => c.id)).toContain('cmd3');
      expect(paletteCommands.map(c => c.id)).not.toContain('cmd2');
    });
  });

  describe('exists()', () => {
    test('should return true if command exists', () => {
      registry.register({ id: 'test.command', title: 'Test', handler: () => {} });
      expect(registry.exists('test.command')).toBe(true);
    });

    test('should return false if command does not exist', () => {
      expect(registry.exists('non.existent')).toBe(false);
    });
  });

  describe('clearPlugin()', () => {
    test('should clear all commands for a plugin', () => {
      registry.register({ id: 'plugin1.cmd1', title: 'Cmd 1', handler: () => {}, pluginId: 'plugin1' });
      registry.register({ id: 'plugin1.cmd2', title: 'Cmd 2', handler: () => {}, pluginId: 'plugin1' });
      registry.register({ id: 'plugin2.cmd1', title: 'Cmd 3', handler: () => {}, pluginId: 'plugin2' });

      expect(registry.count).toBe(3);

      registry.clearPlugin('plugin1');

      expect(registry.count).toBe(1);
      expect(registry.exists('plugin1.cmd1')).toBe(false);
      expect(registry.exists('plugin1.cmd2')).toBe(false);
      expect(registry.exists('plugin2.cmd1')).toBe(true);
    });
  });

  describe('clear()', () => {
    test('should clear all commands', () => {
      registry.register({ id: 'cmd1', title: 'Command 1', handler: () => {} });
      registry.register({ id: 'cmd2', title: 'Command 2', handler: () => {} });

      expect(registry.count).toBe(2);

      registry.clear();

      expect(registry.count).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });

    test('should emit commands-cleared event', () => {
      const listener = vi.fn();
      registry.on('commands-cleared', listener);

      registry.clear();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CommandsAPI', () => {
  let commandsAPI;
  let mockCommandManager;

  beforeEach(() => {
    mockCommandManager = {
      registerCommand: vi.fn(),
      unregisterCommand: vi.fn()
    };
    commandsAPI = new CommandsAPI(mockCommandManager);
    commandsAPI.currentPluginId = 'test-plugin';
  });

  afterEach(() => {
    // Clean up any registered commands
    commandsAPI.commands.clear();
  });

  describe('register()', () => {
    test('should register command with id and options', () => {
      const disposable = commandsAPI.register('test.command', {
        title: 'Test Command',
        execute: () => 'result'
      });

      expect(commandsAPI.exists('test.command')).toBe(true);
      expect(disposable).toHaveProperty('dispose');
    });

    test('should register command with object', () => {
      const disposable = commandsAPI.register({
        id: 'test.command',
        title: 'Test Command',
        handler: () => 'result'
      });

      expect(commandsAPI.exists('test.command')).toBe(true);
    });

    test('should map execute to handler', () => {
      commandsAPI.register({
        id: 'test.command',
        title: 'Test Command',
        execute: () => 'result'
      });

      const command = commandsAPI.commands.get('test.command');
      expect(command.handler).toBeDefined();
      expect(command.execute).toBeDefined();
    });
  });

  describe('execute()', () => {
    test('should execute command by id', async () => {
      const handler = vi.fn().mockReturnValue('result');
      commandsAPI.register({
        id: 'test.command',
        title: 'Test Command',
        handler
      });

      const result = await commandsAPI.execute('test.command');

      expect(handler).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    test('should throw error if command not found', async () => {
      await expect(commandsAPI.execute('non.existent')).rejects.toThrow("Command 'non.existent' not found");
    });
  });

  describe('getAll()', () => {
    test('should return all commands', () => {
      commandsAPI.register({ id: 'cmd1', title: 'Command 1', handler: () => {} });
      commandsAPI.register({ id: 'cmd2', title: 'Command 2', handler: () => {} });

      const commands = commandsAPI.getAll();
      expect(commands).toHaveLength(2);
      expect(commands[0]).toHaveProperty('id');
      expect(commands[0]).toHaveProperty('title');
    });
  });

  describe('getByCategory()', () => {
    test('should filter by category', () => {
      commandsAPI.register({ id: 'cmd1', title: 'Command 1', handler: () => {}, category: 'Edit' });
      commandsAPI.register({ id: 'cmd2', title: 'Command 2', handler: () => {}, category: 'View' });

      const editCommands = commandsAPI.getByCategory('Edit');
      expect(editCommands).toHaveLength(1);
      expect(editCommands[0].category).toBe('Edit');
    });
  });

  describe('exists()', () => {
    test('should check command existence', () => {
      commandsAPI.register({ id: 'test.command', title: 'Test', handler: () => {} });

      expect(commandsAPI.exists('test.command')).toBe(true);
      expect(commandsAPI.exists('non.existent')).toBe(false);
    });
  });

  describe('registerWithPalette()', () => {
    test('should register command with showInPalette true', () => {
      commandsAPI.registerWithPalette({
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      });

      const command = commandsAPI.commands.get('test.command');
      expect(command.showInPalette).toBe(true);
    });
  });

  describe('registerTextEditorCommand()', () => {
    test('should register command with requiresEditor true', () => {
      commandsAPI.registerTextEditorCommand({
        id: 'test.command',
        title: 'Test Command',
        handler: () => {}
      });

      const command = commandsAPI.commands.get('test.command');
      expect(command.requiresEditor).toBe(true);
    });
  });

  describe('unregister()', () => {
    test('should unregister command', () => {
      commandsAPI.register({ id: 'test.command', title: 'Test', handler: () => {} });
      expect(commandsAPI.exists('test.command')).toBe(true);

      commandsAPI.unregister('test.command');
      expect(commandsAPI.exists('test.command')).toBe(false);
    });

    test('should unregister via disposable', () => {
      const disposable = commandsAPI.register({ id: 'test.command', title: 'Test', handler: () => {} });
      expect(commandsAPI.exists('test.command')).toBe(true);

      disposable.dispose();
      expect(commandsAPI.exists('test.command')).toBe(false);
    });
  });
});
