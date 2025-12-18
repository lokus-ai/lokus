/**
 * Plugin Lifecycle Integration Tests
 *
 * Tests the complete plugin lifecycle from initialization to cleanup.
 * Verifies that plugins can register components, execute operations,
 * and properly clean up their resources.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LokusPluginAPI } from '../../src/plugins/api/LokusPluginAPI.js';
import terminalManager from '../../src/plugins/managers/TerminalManager.js';
import outputChannelManager from '../../src/plugins/managers/OutputChannelManager.js';

describe('Plugin Lifecycle Integration', () => {
  let api;
  let pluginId;
  let disposables;

  beforeEach(() => {
    pluginId = 'test-plugin';
    disposables = [];

    // Create API instance with real managers
    api = new LokusPluginAPI({
      terminal: terminalManager,
      outputChannel: outputChannelManager
    });

    // Set plugin context
    api.setPluginContext(pluginId, {
      id: pluginId,
      manifest: {
        name: 'Test Plugin',
        version: '1.0.0',
        permissions: ['terminal', 'ui']
      }
    });
  });

  afterEach(async () => {
    // Clean up all disposables
    for (const disposable of disposables) {
      if (disposable && typeof disposable.dispose === 'function') {
        disposable.dispose();
      }
    }

    // Clean up plugin resources
    await api.cleanup(pluginId);

    // Clean up managers
    terminalManager.cleanupPlugin(pluginId);
    outputChannelManager.cleanupPlugin(pluginId);
  });

  describe('Command Registration and Execution', () => {
    it('should register and execute commands successfully', async () => {
      const executionSpy = vi.fn().mockResolvedValue('command executed');

      // Register command
      const disposable = api.commands.register({
        id: 'test.command',
        title: 'Test Command',
        description: 'A test command',
        execute: executionSpy
      });
      disposables.push(disposable);

      // Verify command is registered
      expect(api.commands.exists('test.command')).toBe(true);

      // Execute command
      const result = await api.commands.execute('test.command', 'arg1', 'arg2');

      // Verify execution
      expect(executionSpy).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('command executed');
    });

    it('should register multiple commands and execute them independently', async () => {
      const command1Spy = vi.fn().mockResolvedValue('result1');
      const command2Spy = vi.fn().mockResolvedValue('result2');

      // Register multiple commands
      const disposable = api.commands.register([
        { id: 'test.command1', title: 'Command 1', execute: command1Spy },
        { id: 'test.command2', title: 'Command 2', execute: command2Spy }
      ]);
      disposables.push(disposable);

      // Execute both commands
      const result1 = await api.commands.execute('test.command1');
      const result2 = await api.commands.execute('test.command2');

      // Verify independent execution
      expect(command1Spy).toHaveBeenCalledTimes(1);
      expect(command2Spy).toHaveBeenCalledTimes(1);
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    it('should throw error when executing non-existent command', async () => {
      await expect(
        api.commands.execute('non.existent.command')
      ).rejects.toThrow('Command \'non.existent.command\' not found');
    });

    it('should get all registered commands', () => {
      // Register commands
      const disposable = api.commands.register([
        { id: 'test.cmd1', title: 'Command 1', category: 'test', execute: () => {} },
        { id: 'test.cmd2', title: 'Command 2', category: 'test', execute: () => {} }
      ]);
      disposables.push(disposable);

      const commands = api.commands.getAll();

      expect(commands).toHaveLength(2);
      expect(commands.map(c => c.id)).toContain('test.cmd1');
      expect(commands.map(c => c.id)).toContain('test.cmd2');
    });

    it('should filter commands by category', () => {
      // Register commands in different categories
      const disposable = api.commands.register([
        { id: 'edit.cmd', title: 'Edit Command', category: 'edit', execute: () => {} },
        { id: 'view.cmd', title: 'View Command', category: 'view', execute: () => {} }
      ]);
      disposables.push(disposable);

      const editCommands = api.commands.getByCategory('edit');

      expect(editCommands).toHaveLength(1);
      expect(editCommands[0].id).toBe('edit.cmd');
    });
  });

  describe('Status Bar Integration', () => {
    it('should create and update status bar items', () => {
      // Register status bar item
      const statusItem = api.ui.registerStatusBarItem({
        id: 'test.status',
        text: 'Initial Text',
        tooltip: 'Test Status Item',
        alignment: 2,
        priority: 100
      });

      expect(statusItem).toBeDefined();
      expect(statusItem.id).toBe('test.status');
      expect(statusItem.text).toBe('Initial Text');

      // Update text
      statusItem.text = 'Updated Text';
      expect(statusItem.text).toBe('Updated Text');

      // Hide and show
      statusItem.hide();
      statusItem.show();

      // Cleanup
      statusItem.dispose();
    });

    it('should clean up status bar items on plugin cleanup', async () => {
      // Create multiple status items
      const item1 = api.ui.registerStatusBarItem({
        id: 'test.status1',
        text: 'Item 1'
      });

      const item2 = api.ui.registerStatusBarItem({
        id: 'test.status2',
        text: 'Item 2'
      });

      expect(api.ui.statusItems.size).toBe(2);

      // Cleanup plugin
      await api.cleanup(pluginId);

      // Verify items are cleaned up
      expect(api.ui.statusItems.size).toBe(0);
    });
  });

  describe('Terminal Integration', () => {
    it('should create terminal and send text', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Test Terminal',
        cwd: '/test/path'
      });

      expect(terminal).toBeDefined();
      expect(terminal.name).toBe('Test Terminal');
      expect(terminal.pluginId).toBe(pluginId);

      // Send text to terminal
      expect(() => {
        terminal.sendText('echo hello');
      }).not.toThrow();

      // Verify terminal is tracked by manager
      const activeTerminal = terminalManager.getActiveTerminal();
      expect(activeTerminal).toBeDefined();
      expect(activeTerminal.id).toBe(terminal.id);
    });

    it('should manage terminal visibility', () => {
      const terminal = api.terminal.createTerminal({
        name: 'Test Terminal'
      });

      // Show terminal
      terminal.show();
      const state1 = terminalManager.getTerminal(terminal.id);
      expect(state1.visible).toBe(true);

      // Hide terminal
      terminal.hide();
      const state2 = terminalManager.getTerminal(terminal.id);
      expect(state2.visible).toBe(false);
    });

    it('should clean up terminals on plugin cleanup', async () => {
      // Create multiple terminals
      const terminal1 = api.terminal.createTerminal({ name: 'Terminal 1' });
      const terminal2 = api.terminal.createTerminal({ name: 'Terminal 2' });

      const terminalsBefore = api.terminal.getTerminals();
      const pluginTerminalsBefore = terminalsBefore.filter(t => t.pluginId === pluginId);
      expect(pluginTerminalsBefore.length).toBeGreaterThanOrEqual(2);

      // Cleanup plugin
      await api.cleanup(pluginId);

      // Verify terminals are cleaned up
      const terminalsAfter = api.terminal.getTerminals();
      const pluginTerminalsAfter = terminalsAfter.filter(t => t.pluginId === pluginId);
      expect(pluginTerminalsAfter).toHaveLength(0);
    });
  });

  describe('Output Channel Integration', () => {
    it('should create and write to output channel', () => {
      const channel = api.ui.createOutputChannel('Test Channel');

      expect(channel).toBeDefined();
      expect(channel.name).toBe('Test Channel');

      // Write content
      channel.appendLine('Line 1');
      channel.append('Partial ');
      channel.append('Line');

      // Verify content
      expect(channel._lines).toEqual(['Line 1', 'Partial Line']);
    });

    it('should clear and replace output channel content', () => {
      const channel = api.ui.createOutputChannel('Test Channel');

      channel.appendLine('Line 1');
      channel.appendLine('Line 2');
      expect(channel._lines).toHaveLength(2);

      // Clear
      channel.clear();
      expect(channel._lines).toHaveLength(0);

      // Replace
      channel.appendLine('Old content');
      channel.replace('New content');
      expect(channel._lines).toEqual(['New content']);
    });

    it('should show and hide output channel', () => {
      const channel = api.ui.createOutputChannel('Test Channel');

      // Should not throw
      expect(() => {
        channel.show();
        channel.hide();
      }).not.toThrow();
    });

    it('should dispose output channel', () => {
      const channel = api.ui.createOutputChannel('Test Channel');

      // Dispose should not throw
      expect(() => {
        channel.dispose();
      }).not.toThrow();
    });
  });

  describe('Tree Data Provider Integration', () => {
    it('should register and unregister tree data provider', () => {
      const provider = {
        getChildren: vi.fn().mockResolvedValue([]),
        getTreeItem: vi.fn().mockResolvedValue({ label: 'Test' })
      };

      const disposable = api.ui.registerTreeDataProvider('test-tree', provider, {
        title: 'Test Tree View'
      });

      expect(api.ui.treeProviders.has('test-tree')).toBe(true);

      // Unregister
      disposable.dispose();
      expect(api.ui.treeProviders.has('test-tree')).toBe(false);
    });

    it('should clean up tree providers on plugin cleanup', async () => {
      const provider1 = {
        getChildren: vi.fn().mockResolvedValue([]),
        getTreeItem: vi.fn().mockResolvedValue({ label: 'Test 1' })
      };

      const provider2 = {
        getChildren: vi.fn().mockResolvedValue([]),
        getTreeItem: vi.fn().mockResolvedValue({ label: 'Test 2' })
      };

      api.ui.registerTreeDataProvider('test-tree-1', provider1);
      api.ui.registerTreeDataProvider('test-tree-2', provider2);

      expect(api.ui.treeProviders.size).toBe(2);

      // Cleanup
      await api.cleanup(pluginId);

      // Tree providers should be cleaned up
      expect(api.ui.treeProviders.size).toBe(0);
    });
  });

  describe('Webview Integration', () => {
    it('should register webview panel', () => {
      const panel = api.ui.registerWebviewPanel({
        id: 'test-webview',
        title: 'Test Webview',
        html: '<html><body><h1>Test</h1></body></html>'
      });

      expect(panel).toBeDefined();
      expect(panel.id).toBe('test-webview');
      expect(panel.title).toBe('Test Webview');
      expect(api.ui.webviews.has('test-webview')).toBe(true);
    });

    it('should post and receive messages in webview', () => {
      const panel = api.ui.registerWebviewPanel({
        id: 'test-webview',
        title: 'Test',
        html: '<div>Test</div>'
      });

      const messageHandler = vi.fn();
      panel.onDidReceiveMessage(messageHandler);

      // Simulate message from webview
      panel._handleMessage({ type: 'test', data: 'hello' });

      expect(messageHandler).toHaveBeenCalledWith({ type: 'test', data: 'hello' });
    });

    it('should dispose webview panel', () => {
      const panel = api.ui.registerWebviewPanel({
        id: 'test-webview',
        title: 'Test',
        html: '<div>Test</div>'
      });

      expect(api.ui.webviews.has('test-webview')).toBe(true);

      panel.dispose();

      expect(api.ui.webviews.has('test-webview')).toBe(false);
    });
  });

  describe('Complete Plugin Lifecycle', () => {
    it('should handle full plugin lifecycle with multiple components', async () => {
      const commandSpy = vi.fn().mockResolvedValue('done');

      // Register command
      const cmdDisposable = api.commands.register({
        id: 'test.lifecycle',
        title: 'Lifecycle Test',
        execute: commandSpy
      });
      disposables.push(cmdDisposable);

      // Create status bar item
      const statusItem = api.ui.registerStatusBarItem({
        id: 'test.lifecycle.status',
        text: 'Test Status'
      });

      // Create terminal
      const terminal = api.terminal.createTerminal({
        name: 'Lifecycle Terminal'
      });

      // Create output channel
      const channel = api.ui.createOutputChannel('Lifecycle Channel');
      channel.appendLine('Test output');

      // Register tree provider
      const treeDisposable = api.ui.registerTreeDataProvider('lifecycle-tree', {
        getChildren: vi.fn().mockResolvedValue([]),
        getTreeItem: vi.fn().mockResolvedValue({ label: 'Node' })
      });

      // Register webview
      const webview = api.ui.registerWebviewPanel({
        id: 'lifecycle-webview',
        title: 'Lifecycle Webview',
        html: '<div>Content</div>'
      });

      // Verify all components are registered
      expect(api.commands.exists('test.lifecycle')).toBe(true);
      expect(api.ui.statusItems.has('test.lifecycle.status')).toBe(true);
      expect(terminalManager.getTerminal(terminal.id)).toBeDefined();
      expect(channel._lines).toEqual(['Test output']);
      expect(api.ui.treeProviders.has('lifecycle-tree')).toBe(true);
      expect(api.ui.webviews.has('lifecycle-webview')).toBe(true);

      // Execute command
      await api.commands.execute('test.lifecycle');
      expect(commandSpy).toHaveBeenCalled();

      // Clean up plugin
      await api.cleanup(pluginId);

      // Verify everything is cleaned up
      expect(api.commands.exists('test.lifecycle')).toBe(false);
      expect(api.ui.statusItems.size).toBe(0);
      expect(api.ui.treeProviders.size).toBe(0);
      expect(api.ui.webviews.size).toBe(0);

      const terminalsAfterCleanup = terminalManager.getTerminals();
      const pluginTerminals = terminalsAfterCleanup.filter(t => t.pluginId === pluginId);
      expect(pluginTerminals).toHaveLength(0);
    });

    it('should handle errors gracefully during cleanup', async () => {
      // Create components
      api.commands.register({
        id: 'test.error',
        title: 'Error Test',
        execute: () => {}
      });

      // Cleanup should not throw even if some cleanup fails
      await expect(api.cleanup(pluginId)).resolves.not.toThrow();
    });
  });

  describe('Event Propagation', () => {
    it('should emit events when registering components', () => {
      const commandSpy = vi.fn();
      const panelSpy = vi.fn();

      api.commands.on('command_registered', commandSpy);
      api.ui.on('panel_added', panelSpy);

      // Register command
      const disposable = api.commands.register({
        id: 'test.event',
        title: 'Event Test',
        execute: () => {}
      });
      disposables.push(disposable);

      // Add panel
      api.ui.addPanel({
        id: 'test-panel',
        title: 'Test Panel',
        position: 'sidebar-left',
        component: 'div'
      });

      expect(commandSpy).toHaveBeenCalled();
      expect(panelSpy).toHaveBeenCalled();
    });
  });

  describe('Permission Checking', () => {
    it('should verify plugin permissions are registered', () => {
      const permissions = api.getPluginPermissions(pluginId);

      expect(permissions.has('terminal')).toBe(true);
      expect(permissions.has('ui')).toBe(true);
    });

    it('should check specific permissions', () => {
      expect(api.hasPermission(pluginId, 'terminal')).toBe(true);
      expect(api.hasPermission(pluginId, 'network')).toBe(false);
    });
  });
});
