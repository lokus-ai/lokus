import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pluginEventBridge } from '../../../src/plugins/PluginEventBridge.js';
import { LokusPluginAPI } from '../../../src/plugins/api/LokusPluginAPI.js';

describe('PluginEventBridge', () => {
  let mockPluginAPI;
  let mockUIAPI;
  let mockEditorAPI;
  let mockNotificationsAPI;

  beforeEach(() => {
    // Reset the bridge before each test
    pluginEventBridge.cleanup();

    // Create mock APIs with EventEmitter functionality
    mockNotificationsAPI = {
      show: vi.fn(),
      on: vi.fn(),
      emit: vi.fn()
    };

    mockEditorAPI = {
      on: vi.fn(),
      emit: vi.fn()
    };

    mockUIAPI = {
      on: vi.fn(),
      emit: vi.fn()
    };

    mockPluginAPI = {
      ui: mockUIAPI,
      editor: mockEditorAPI,
      notifications: mockNotificationsAPI
    };
  });

  describe('Initialization', () => {
    it('should initialize only once', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      expect(pluginEventBridge.initialized).toBe(true);

      // Call again - should not re-initialize
      pluginEventBridge.initialize(mockPluginAPI);
      expect(pluginEventBridge.initialized).toBe(true);
    });

    it('should set up notification event listeners', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      expect(mockUIAPI.on).toHaveBeenCalledWith('show-notification', expect.any(Function));
    });

    it('should set up webview event listeners', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      expect(mockUIAPI.on).toHaveBeenCalledWith('webview-registered', expect.any(Function));
      expect(mockUIAPI.on).toHaveBeenCalledWith('webview-disposed', expect.any(Function));
    });

    it('should set up menu event listeners', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      expect(mockUIAPI.on).toHaveBeenCalledWith('menu-registered', expect.any(Function));
      expect(mockUIAPI.on).toHaveBeenCalledWith('menu-unregistered', expect.any(Function));
    });

    it('should set up toolbar event listeners', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      expect(mockUIAPI.on).toHaveBeenCalledWith('toolbar-registered', expect.any(Function));
      expect(mockUIAPI.on).toHaveBeenCalledWith('toolbar-unregistered', expect.any(Function));
    });

    it('should set up editor event listeners', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      expect(mockEditorAPI.on).toHaveBeenCalledWith('extension_added', expect.any(Function));
      expect(mockEditorAPI.on).toHaveBeenCalledWith('slash_command_added', expect.any(Function));
    });
  });

  describe('Event Routing', () => {
    it('should forward notification events', () => {
      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler that was registered for 'show-notification'
      const handlers = mockUIAPI.on.mock.calls.filter(call => call[0] === 'show-notification');
      expect(handlers.length).toBeGreaterThan(0);

      const handler = handlers[0][1];

      // Trigger the handler
      handler({ message: 'Test message', type: 'info' });

      // Verify it called the notifications API
      expect(mockNotificationsAPI.show).toHaveBeenCalledWith({
        type: 'info',
        message: 'Test message',
        title: 'Info'
      });
    });

    it('should emit webview-registered event', () => {
      const listener = vi.fn();
      pluginEventBridge.on('webview-registered', listener);

      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler for 'webview-registered'
      const handlers = mockUIAPI.on.mock.calls.filter(call => call[0] === 'webview-registered');
      const handler = handlers[0][1];

      // Trigger the handler
      const webviewData = { panelId: 'test-panel', title: 'Test Webview' };
      handler(webviewData);

      // Verify the event was forwarded
      expect(listener).toHaveBeenCalledWith(webviewData);
    });

    it('should emit menu-registered event', () => {
      const listener = vi.fn();
      pluginEventBridge.on('menu-registered', listener);

      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler for 'menu-registered'
      const handlers = mockUIAPI.on.mock.calls.filter(call => call[0] === 'menu-registered');
      const handler = handlers[0][1];

      // Trigger the handler
      const menuData = { menuId: 'test-menu', label: 'Test Menu' };
      handler(menuData);

      // Verify the event was forwarded
      expect(listener).toHaveBeenCalledWith(menuData);
    });

    it('should emit toolbar-registered event', () => {
      const listener = vi.fn();
      pluginEventBridge.on('toolbar-registered', listener);

      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler for 'toolbar-registered'
      const handlers = mockUIAPI.on.mock.calls.filter(call => call[0] === 'toolbar-registered');
      const handler = handlers[0][1];

      // Trigger the handler
      const toolbarData = { toolbarId: 'test-toolbar', title: 'Test Toolbar' };
      handler(toolbarData);

      // Verify the event was forwarded
      expect(listener).toHaveBeenCalledWith(toolbarData);
    });

    it('should emit editor-extension-registered event', () => {
      const listener = vi.fn();
      pluginEventBridge.on('editor-extension-registered', listener);

      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler for 'extension_added'
      const handlers = mockEditorAPI.on.mock.calls.filter(call => call[0] === 'extension_added');
      const handler = handlers[0][1];

      // Trigger the handler
      const extensionData = { name: 'test-extension', extensionId: 'ext-123' };
      handler(extensionData);

      // Verify the event was forwarded
      expect(listener).toHaveBeenCalledWith(extensionData);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      pluginEventBridge.on('webview-registered', listener1);
      pluginEventBridge.on('webview-registered', listener2);
      pluginEventBridge.on('menu-registered', listener1);

      const stats = pluginEventBridge.getStats();

      expect(stats.initialized).toBe(false); // Not initialized yet
      expect(stats.events['webview-registered']).toBe(2);
      expect(stats.events['menu-registered']).toBe(1);
    });

    it('should show initialized status after initialization', () => {
      pluginEventBridge.initialize(mockPluginAPI);

      const stats = pluginEventBridge.getStats();
      expect(stats.initialized).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should reset bridge state', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      const listener = vi.fn();
      pluginEventBridge.on('test-event', listener);

      pluginEventBridge.cleanup();

      expect(pluginEventBridge.initialized).toBe(false);
      expect(pluginEventBridge.pluginAPI).toBe(null);
      expect(pluginEventBridge.eventNames()).toHaveLength(0);
    });

    it('should allow re-initialization after cleanup', () => {
      pluginEventBridge.initialize(mockPluginAPI);
      pluginEventBridge.cleanup();

      expect(pluginEventBridge.initialized).toBe(false);

      pluginEventBridge.initialize(mockPluginAPI);
      expect(pluginEventBridge.initialized).toBe(true);
    });
  });

  describe('Notification with Actions', () => {
    it('should emit notification-with-actions when actions are provided', () => {
      const listener = vi.fn();
      pluginEventBridge.on('notification-with-actions', listener);

      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler for 'show-notification'
      const handlers = mockUIAPI.on.mock.calls.filter(call => call[0] === 'show-notification');
      const handler = handlers[0][1];

      // Trigger with actions
      const notificationData = {
        message: 'Test message',
        type: 'info',
        actions: [{ id: 'action1', label: 'Action 1' }]
      };
      handler(notificationData);

      // Verify the notification was shown
      expect(mockNotificationsAPI.show).toHaveBeenCalled();

      // Verify the notification-with-actions event was emitted
      expect(listener).toHaveBeenCalledWith(notificationData);
    });

    it('should not emit notification-with-actions when no actions provided', () => {
      const listener = vi.fn();
      pluginEventBridge.on('notification-with-actions', listener);

      pluginEventBridge.initialize(mockPluginAPI);

      // Get the handler for 'show-notification'
      const handlers = mockUIAPI.on.mock.calls.filter(call => call[0] === 'show-notification');
      const handler = handlers[0][1];

      // Trigger without actions
      handler({ message: 'Test message', type: 'info' });

      // Verify the notification was shown but no actions event
      expect(mockNotificationsAPI.show).toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
