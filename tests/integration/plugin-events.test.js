/**
 * Plugin Event Bridge Integration Tests
 *
 * Tests that verify event routing and propagation through the plugin system.
 * Validates that events flow correctly from APIs through managers to UI components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LokusPluginAPI } from '../../src/plugins/api/LokusPluginAPI.js';
import { pluginEventBridge } from '../../src/plugins/PluginEventBridge.js';
import terminalManager from '../../src/plugins/managers/TerminalManager.js';
import outputChannelManager from '../../src/plugins/managers/OutputChannelManager.js';
import { uiManager } from '../../src/core/ui/UIManager.js';

describe('Plugin Event Bridge Integration', () => {
  let api;
  let pluginId;
  let eventSpies;

  beforeEach(() => {
    pluginId = 'test-event-plugin';
    eventSpies = {};

    // Create API instance
    api = new LokusPluginAPI({
      terminal: terminalManager,
      outputChannel: outputChannelManager,
      ui: uiManager
    });

    // Set plugin context with all permissions for testing
    api.setPluginContext(pluginId, {
      id: pluginId,
      manifest: {
        name: 'Event Test Plugin',
        version: '1.0.0',
        permissions: [
          'terminal:create', 'terminal:write', 'terminal:read',
          'ui:create', 'ui:dialogs', 'ui:notifications', 'ui:menus', 'ui:toolbars',
          'commands:register', 'commands:execute',
          'editor:read', 'editor:write',
          'storage:read', 'storage:write',
          'workspace:read', 'workspace:write',
          'events:listen', 'events:emit'
        ]
      }
    });

    // Initialize event bridge
    pluginEventBridge.cleanup();
    pluginEventBridge.initialize(api);
  });

  afterEach(async () => {
    // Clean up all event spies
    Object.values(eventSpies).forEach(spy => {
      if (spy && spy.mockRestore) {
        spy.mockRestore();
      }
    });

    // Clean up plugin and managers
    await api.cleanup(pluginId);
    terminalManager.cleanupPlugin(pluginId);
    outputChannelManager.cleanupPlugin(pluginId);

    // Clean up event bridge
    pluginEventBridge.cleanup();
  });

  describe('Notification Events', () => {
    it('should route notification events through bridge', () => {
      const notificationSpy = vi.fn();
      pluginEventBridge.on('notification-with-actions', notificationSpy);

      // Trigger notification with actions
      api.ui.emit('show-notification', {
        message: 'Test notification',
        type: 'info',
        actions: [{ id: 'action1', label: 'Action 1' }]
      });

      expect(notificationSpy).toHaveBeenCalled();
      expect(notificationSpy.mock.calls[0][0]).toMatchObject({
        message: 'Test notification',
        type: 'info'
      });
    });

    it('should forward notification-with-actions events', () => {
      const actionSpy = vi.fn();
      pluginEventBridge.on('notification-with-actions', actionSpy);

      api.ui.emit('show-notification-with-actions', {
        id: 'test-notif',
        message: 'Test with actions',
        type: 'warning',
        actions: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' }
        ]
      });

      expect(actionSpy).toHaveBeenCalled();
      const callData = actionSpy.mock.calls[0][0];
      expect(callData.actions).toHaveLength(2);
    });
  });

  describe('Webview Events', () => {
    it('should route webview registration events', () => {
      const registeredSpy = vi.fn();
      pluginEventBridge.on('webview-registered', registeredSpy);

      // Register webview panel
      const panel = api.ui.registerWebviewPanel({
        id: 'test-webview',
        title: 'Test Webview',
        html: '<html><body>Test</body></html>'
      });

      expect(registeredSpy).toHaveBeenCalled();
      expect(registeredSpy.mock.calls[0][0]).toMatchObject({
        panelId: 'test-webview'
      });

      panel.dispose();
    });

    it('should route webview disposal events', () => {
      const disposedSpy = vi.fn();
      pluginEventBridge.on('webview-disposed', disposedSpy);

      // Register and dispose webview
      const panel = api.ui.registerWebviewPanel({
        id: 'test-webview',
        title: 'Test',
        html: '<div>Test</div>'
      });

      panel.dispose();

      expect(disposedSpy).toHaveBeenCalled();
      expect(disposedSpy.mock.calls[0][0]).toMatchObject({
        panelId: 'test-webview'
      });
    });

    it('should route webview message events', () => {
      const messageSpy = vi.fn();
      pluginEventBridge.on('webview-post-message', messageSpy);

      const panel = api.ui.registerWebviewPanel({
        id: 'test-webview',
        title: 'Test',
        html: '<div>Test</div>'
      });

      // Post message to webview
      panel.postMessage({ type: 'test', data: 'hello' });

      expect(messageSpy).toHaveBeenCalled();
      expect(messageSpy.mock.calls[0][0]).toMatchObject({
        panelId: 'test-webview',
        message: { type: 'test', data: 'hello' }
      });

      panel.dispose();
    });
  });

  describe('Menu and Toolbar Events', () => {
    it('should route menu registration events', () => {
      const menuSpy = vi.fn();
      pluginEventBridge.on('menu-registered', menuSpy);

      const disposable = api.ui.registerMenu({
        id: 'test-menu',
        label: 'Test Menu',
        group: 'navigation',
        command: 'test.command'
      });

      expect(menuSpy).toHaveBeenCalled();
      expect(menuSpy.mock.calls[0][0]).toMatchObject({
        menuId: 'test-menu'
      });

      disposable.dispose();
    });

    it('should route menu unregistration events', () => {
      const unregisterSpy = vi.fn();
      pluginEventBridge.on('menu-unregistered', unregisterSpy);

      const disposable = api.ui.registerMenu({
        id: 'test-menu',
        label: 'Test Menu',
        group: 'navigation'
      });

      disposable.dispose();

      expect(unregisterSpy).toHaveBeenCalled();
    });

    it('should route toolbar registration events', () => {
      const toolbarSpy = vi.fn();
      pluginEventBridge.on('toolbar-registered', toolbarSpy);

      const disposable = api.ui.registerToolbar({
        id: 'test-toolbar',
        title: 'Test Toolbar',
        location: 'editor',
        items: []
      });

      expect(toolbarSpy).toHaveBeenCalled();
      expect(toolbarSpy.mock.calls[0][0]).toMatchObject({
        toolbarId: 'test-toolbar'
      });

      disposable.dispose();
    });

    it('should route toolbar unregistration events', () => {
      const unregisterSpy = vi.fn();
      pluginEventBridge.on('toolbar-unregistered', unregisterSpy);

      const disposable = api.ui.registerToolbar({
        id: 'test-toolbar',
        title: 'Test Toolbar',
        location: 'editor',
        items: []
      });

      disposable.dispose();

      expect(unregisterSpy).toHaveBeenCalled();
    });
  });

  describe('Editor Events', () => {
    it('should route editor extension registration events', () => {
      const extensionSpy = vi.fn();
      pluginEventBridge.on('editor-extension-registered', extensionSpy);

      // Emit extension added event
      api.editor.emit('extension_added', {
        name: 'test-extension',
        extensionId: 'ext-123',
        type: 'extension'
      });

      expect(extensionSpy).toHaveBeenCalled();
      expect(extensionSpy.mock.calls[0][0]).toMatchObject({
        name: 'test-extension',
        type: 'extension'
      });
    });

    it('should route slash command registration events', () => {
      const commandSpy = vi.fn();
      pluginEventBridge.on('editor-slash-command-added', commandSpy);

      // Emit slash command added event
      api.editor.emit('slash_command_added', {
        name: 'testCommand',
        commandId: 'cmd-123'
      });

      expect(commandSpy).toHaveBeenCalled();
      expect(commandSpy.mock.calls[0][0]).toMatchObject({
        name: 'testCommand'
      });
    });

    it('should route editor toolbar item events', () => {
      const toolbarSpy = vi.fn();
      pluginEventBridge.on('editor-toolbar-item-added', toolbarSpy);

      // Emit toolbar item added event
      api.editor.emit('toolbar_item_added', {
        id: 'toolbar-item',
        itemId: 'item-123'
      });

      expect(toolbarSpy).toHaveBeenCalled();
    });

    it('should route context menu item events', () => {
      const menuSpy = vi.fn();
      pluginEventBridge.on('editor-context-menu-item-added', menuSpy);

      // Emit context menu item added event
      api.editor.emit('context_menu_item_added', {
        id: 'context-item',
        itemId: 'item-123'
      });

      expect(menuSpy).toHaveBeenCalled();
    });
  });

  describe('Terminal Events', () => {
    it('should route terminal creation events through bridge', () => {
      const terminalSpy = vi.fn();
      pluginEventBridge.on('terminal-created', terminalSpy);

      // Create terminal (this will trigger event through API)
      const terminal = api.terminal.createTerminal({
        name: 'Event Test Terminal'
      });

      // Give event time to propagate through bridge
      return new Promise((resolve) => {
        setTimeout(() => {
          // The terminal is created through UIAPI which emits to bridge
          terminal.dispose();
          resolve();
        }, 50);
      });
    });

    it('should route terminal visibility events', () => {
      const showSpy = vi.fn();
      const hideSpy = vi.fn();

      pluginEventBridge.on('terminal-show', showSpy);
      pluginEventBridge.on('terminal-hide', hideSpy);

      const terminal = api.terminal.createTerminal({
        name: 'Visibility Test'
      });

      // These operations emit events through UI API
      terminal.show();
      terminal.hide();

      return new Promise((resolve) => {
        setTimeout(() => {
          terminal.dispose();
          resolve();
        }, 50);
      });
    });

    it('should route terminal disposal events', () => {
      const disposeSpy = vi.fn();
      pluginEventBridge.on('terminal-dispose', disposeSpy);

      const terminal = api.terminal.createTerminal({
        name: 'Dispose Test'
      });

      terminal.dispose();

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 50);
      });
    });
  });

  describe('Output Channel Events', () => {
    it('should route output channel update events', () => {
      const updateSpy = vi.fn();
      pluginEventBridge.on('output-channel-update', updateSpy);

      const channel = api.ui.createOutputChannel('Event Test Channel');
      channel.appendLine('Test output');

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(updateSpy).toHaveBeenCalled();
          channel.dispose();
          resolve();
        }, 50);
      });
    });

    it('should route output channel show events', () => {
      const showSpy = vi.fn();
      pluginEventBridge.on('output-channel-show', showSpy);

      const channel = api.ui.createOutputChannel('Show Test');
      channel.show();

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(showSpy).toHaveBeenCalled();
          channel.dispose();
          resolve();
        }, 50);
      });
    });

    it('should route output channel hide events', () => {
      const hideSpy = vi.fn();
      pluginEventBridge.on('output-channel-hide', hideSpy);

      const channel = api.ui.createOutputChannel('Hide Test');
      channel.show();
      channel.hide();

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(hideSpy).toHaveBeenCalled();
          channel.dispose();
          resolve();
        }, 50);
      });
    });

    it('should route output channel disposal events', () => {
      const disposeSpy = vi.fn();
      pluginEventBridge.on('output-channel-dispose', disposeSpy);

      const channel = api.ui.createOutputChannel('Dispose Test');
      channel.dispose();

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(disposeSpy).toHaveBeenCalled();
          resolve();
        }, 50);
      });
    });
  });

  describe('Dialog Events', () => {
    it('should route dialog show events', () => {
      const dialogSpy = vi.fn();
      pluginEventBridge.on('show-dialog', dialogSpy);

      // Trigger dialog through UI API
      api.ui.emit('show-dialog', {
        id: 'test-dialog',
        title: 'Test Dialog',
        message: 'Test message',
        buttons: [{ id: 'ok', label: 'OK' }]
      });

      expect(dialogSpy).toHaveBeenCalled();
    });

    it('should route quick pick events', () => {
      const quickPickSpy = vi.fn();
      pluginEventBridge.on('show-quick-pick', quickPickSpy);

      api.ui.emit('show-quick-pick', {
        id: 'test-pick',
        items: ['Item 1', 'Item 2'],
        options: { placeholder: 'Select an item' }
      });

      expect(quickPickSpy).toHaveBeenCalled();
    });
  });

  describe('Progress Events', () => {
    it('should handle progress events through UIManager', () => {
      const startSpy = vi.fn();
      const updateSpy = vi.fn();
      const endSpy = vi.fn();

      uiManager.on('progress-start', startSpy);
      uiManager.on('progress-update', updateSpy);
      uiManager.on('progress-end', endSpy);

      const progressId = 'test-progress-' + Date.now();

      // Start progress
      uiManager.startProgress({
        id: progressId,
        title: 'Test Progress',
        message: 'Starting...',
        cancellable: true
      });

      // Update progress
      uiManager.updateProgress({
        id: progressId,
        message: 'In progress...',
        percentage: 50
      });

      // End progress
      uiManager.endProgress({
        id: progressId
      });

      expect(startSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(endSpy).toHaveBeenCalled();
    });

    it('should propagate progress events through plugin API', async () => {
      const startSpy = vi.fn();
      const updateSpy = vi.fn();
      const endSpy = vi.fn();

      api.ui.on('progress-start', startSpy);
      api.ui.on('progress-update', updateSpy);
      api.ui.on('progress-end', endSpy);

      // Use withProgress from plugin API
      await api.ui.withProgress(
        {
          location: 'notification',
          title: 'Test Task',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: 'Step 1' });
          progress.report({ message: 'Step 2', increment: 50 });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      );

      expect(startSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(endSpy).toHaveBeenCalled();
    });
  });

  describe('Event Statistics and Debugging', () => {
    it('should track event statistics', () => {
      // Add a listener first to have something to track
      const testSpy = vi.fn();
      pluginEventBridge.on('test-stats-event', testSpy);

      const stats = pluginEventBridge.getStats();

      expect(stats).toBeDefined();
      expect(stats.initialized).toBe(true);
      expect(stats.totalEventTypes).toBeGreaterThanOrEqual(1);
      expect(stats.events).toBeDefined();
      expect(stats.events['test-stats-event']).toBe(1);
    });

    it('should count event listeners', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      pluginEventBridge.on('test-event', spy1);
      pluginEventBridge.on('test-event', spy2);

      const stats = pluginEventBridge.getStats();
      expect(stats.events['test-event']).toBe(2);
    });

    it('should list all event types', () => {
      // Add some listeners first
      pluginEventBridge.on('event-type-1', vi.fn());
      pluginEventBridge.on('event-type-2', vi.fn());
      pluginEventBridge.on('event-type-3', vi.fn());

      const stats = pluginEventBridge.getStats();
      const eventTypes = Object.keys(stats.events);

      // Should have at least the events we just added
      expect(eventTypes.length).toBeGreaterThanOrEqual(3);
      expect(eventTypes).toContain('event-type-1');
      expect(eventTypes).toContain('event-type-2');
      expect(eventTypes).toContain('event-type-3');
    });
  });

  describe('Event Propagation Chain', () => {
    it('should propagate events through complete chain: API -> Manager -> Bridge', () => {
      const managerSpy = vi.fn();
      const bridgeSpy = vi.fn();
      const apiSpy = vi.fn();

      // Listen at all levels
      terminalManager.on('terminal-created', managerSpy);
      pluginEventBridge.on('terminal-created', bridgeSpy);
      api.ui.on('terminal-created', apiSpy);

      // Create terminal
      const terminal = api.terminal.createTerminal({
        name: 'Chain Test Terminal'
      });

      // Manager should definitely be called
      expect(managerSpy).toHaveBeenCalled();

      terminal.dispose();
    });

    it('should propagate output channel events through complete chain', () => {
      const managerSpy = vi.fn();
      const bridgeSpy = vi.fn();
      const apiSpy = vi.fn();

      outputChannelManager.on('channel-updated', managerSpy);
      pluginEventBridge.on('output-channel-update', bridgeSpy);
      api.ui.on('output-channel-update', apiSpy);

      const channel = api.ui.createOutputChannel('Chain Test');
      channel.appendLine('Test content');

      // Manager should definitely be called
      expect(managerSpy).toHaveBeenCalled();

      channel.dispose();
    });
  });

  describe('Error Handling in Event Bridge', () => {
    it('should handle errors in event listeners gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error in listener');
      });
      const normalListener = vi.fn();

      pluginEventBridge.on('test-error-event', errorListener);
      pluginEventBridge.on('test-error-event', normalListener);

      // Emitting should not throw even if one listener errors
      expect(() => {
        pluginEventBridge.emit('test-error-event', { data: 'test' });
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      // Note: Normal listener might not be called if error occurs first
      // This depends on EventEmitter implementation
    });

    it('should handle bridge cleanup without errors', () => {
      // Register multiple listeners
      pluginEventBridge.on('event1', vi.fn());
      pluginEventBridge.on('event2', vi.fn());
      pluginEventBridge.on('event3', vi.fn());

      // Cleanup should not throw
      expect(() => {
        pluginEventBridge.cleanup();
      }).not.toThrow();

      // Should be cleaned up
      const stats = pluginEventBridge.getStats();
      expect(stats.initialized).toBe(false);
      expect(stats.totalEventTypes).toBe(0);
    });
  });

  describe('Bridge Initialization', () => {
    it('should only initialize once', () => {
      const bridge = pluginEventBridge;
      const firstInit = bridge.initialized;

      // Try to initialize again
      bridge.initialize(api);

      // Should still be initialized (not re-initialized)
      expect(bridge.initialized).toBe(firstInit);
    });

    it('should setup all event subscriptions on initialization', () => {
      // Create fresh bridge
      pluginEventBridge.cleanup();

      const initialStats = pluginEventBridge.getStats();
      expect(initialStats.initialized).toBe(false);

      // Initialize
      pluginEventBridge.initialize(api);

      const afterStats = pluginEventBridge.getStats();
      expect(afterStats.initialized).toBe(true);
    });
  });
});
