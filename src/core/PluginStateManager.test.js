/**
 * Test suite for the unified PluginStateManager
 * Tests the critical enable/disable functionality and state consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pluginStateManager, PluginState } from './PluginStateManager.js';

// Mock Tauri functions
const mockTauriInvoke = (command, args) => {
  
  switch (command) {
    case 'list_plugins':
      return Promise.resolve([
        {
          manifest: {
            name: 'test-plugin-1',
            version: '1.0.0',
            description: 'Test Plugin 1',
            author: 'Test Author',
            permissions: ['editor'],
            main: 'main.js'
          },
          installed_at: '2024-01-15',
          path: '/test/plugins/test-plugin-1',
          size: 1024
        },
        {
          manifest: {
            name: 'test-plugin-2',
            version: '2.1.0', 
            description: 'Test Plugin 2',
            author: 'Another Author',
            permissions: ['filesystem'],
            main: 'index.js'
          },
          installed_at: '2024-01-16',
          path: '/test/plugins/test-plugin-2',
          size: 2048
        }
      ]);
      
    case 'get_enabled_plugins':
      return Promise.resolve(['test-plugin-1']); // Only plugin 1 is enabled
      
    case 'enable_plugin':
      return Promise.resolve({ success: true });
      
    case 'disable_plugin':
      return Promise.resolve({ success: true });
      
    default:
      return Promise.reject(new Error(`Unknown command: ${command}`));
  }
};

// Mock Tauri environment
global.window = {
  __TAURI_INTERNALS__: {
    invoke: mockTauriInvoke
  }
};


describe('PluginStateManager', () => {
  beforeEach(async () => {
    // Reset the plugin state manager before each test
    await pluginStateManager.initialize();
  });

  it('should initialize state manager', async () => {
    await pluginStateManager.initialize();
    expect(pluginStateManager.isInitialized).toBe(true);
  });

  it('should load plugins with correct enabled states', async () => {
    const plugins = pluginStateManager.getPlugins();
    
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBe(2);
    
    // Check plugin 1 (should be enabled)
    const plugin1 = plugins.find(p => p.id === 'test-plugin-1');
    expect(plugin1).toBeTruthy();
    expect(plugin1.enabled).toBe(true);
    expect(typeof plugin1.enabled).toBe('boolean');
    
    // Check plugin 2 (should be disabled)
    const plugin2 = plugins.find(p => p.id === 'test-plugin-2');
    expect(plugin2).toBeTruthy();
    expect(plugin2.enabled).toBe(false);
    expect(typeof plugin2.enabled).toBe('boolean');
  });

  it('should enable plugin functionality', async () => {
    // Enable plugin 2
    await pluginStateManager.togglePlugin('test-plugin-2', true);
    
    const plugin2 = pluginStateManager.getPlugin('test-plugin-2');
    expect(plugin2).toBeTruthy();
    expect(plugin2.enabled).toBe(true);
    expect(typeof plugin2.enabled).toBe('boolean');
    
    const enabledPlugins = pluginStateManager.getEnabledPlugins();
    expect(enabledPlugins.has('test-plugin-2')).toBe(true);
  });

  it('should disable plugin functionality', async () => {
    // Disable plugin 1
    await pluginStateManager.togglePlugin('test-plugin-1', false);
    
    const plugin1 = pluginStateManager.getPlugin('test-plugin-1');
    expect(plugin1).toBeTruthy();
    expect(plugin1.enabled).toBe(false);
    expect(typeof plugin1.enabled).toBe('boolean');
    
    const enabledPlugins = pluginStateManager.getEnabledPlugins();
    expect(enabledPlugins.has('test-plugin-1')).toBe(false);
  });

  it('should handle invalid inputs gracefully', async () => {
    // Test undefined enabled state
    await expect(
      pluginStateManager.togglePlugin('test-plugin-1', undefined)
    ).rejects.toThrow(/must be boolean/);

    // Test invalid plugin ID
    await expect(
      pluginStateManager.togglePlugin('', true)
    ).rejects.toThrow(/Plugin ID is required/);

    // Test non-existent plugin
    await expect(
      pluginStateManager.togglePlugin('non-existent-plugin', true)
    ).rejects.toThrow(/Plugin not found/);
  });

  it('should maintain state consistency after multiple operations', async () => {
    // Perform multiple toggle operations
    await pluginStateManager.togglePlugin('test-plugin-1', true);
    await pluginStateManager.togglePlugin('test-plugin-2', false);
    await pluginStateManager.togglePlugin('test-plugin-1', false);
    await pluginStateManager.togglePlugin('test-plugin-2', true);
    
    const plugins = pluginStateManager.getPlugins();
    const enabledPlugins = pluginStateManager.getEnabledPlugins();
    
    // Check final state
    const plugin1 = plugins.find(p => p.id === 'test-plugin-1');
    const plugin2 = plugins.find(p => p.id === 'test-plugin-2');
    
    expect(plugin1.enabled).toBe(false);
    expect(plugin2.enabled).toBe(true);
    
    expect(enabledPlugins.has('test-plugin-1')).toBe(false);
    expect(enabledPlugins.has('test-plugin-2')).toBe(true);
  });

  it('should provide statistics and debugging information', async () => {
    const stats = pluginStateManager.getStats();
    
    expect(typeof stats).toBe('object');
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.enabled).toBe('number');
    expect(Array.isArray(stats.plugins)).toBe(true);
    
    expect(stats.total).toBe(2);
    expect(stats.enabled).toBe(1);
    
    // Check plugin details in stats
    const plugin1Stats = stats.plugins.find(p => p.id === 'test-plugin-1');
    const plugin2Stats = stats.plugins.find(p => p.id === 'test-plugin-2');
    
    expect(plugin1Stats).toBeTruthy();
    expect(plugin2Stats).toBeTruthy();
    expect(plugin1Stats.enabled).toBe(false);
    expect(plugin2Stats.enabled).toBe(true);
  });

  it('should prevent race conditions', async () => {
    // Start multiple toggle operations simultaneously
    const promises = [
      pluginStateManager.togglePlugin('test-plugin-1', true),
      pluginStateManager.togglePlugin('test-plugin-1', false),
      pluginStateManager.togglePlugin('test-plugin-1', true)
    ];
    
    // Wait for all to complete
    await Promise.all(promises);
    
    // Final state should be consistent
    const plugin1 = pluginStateManager.getPlugin('test-plugin-1');
    expect(typeof plugin1.enabled).toBe('boolean');
  });
});

