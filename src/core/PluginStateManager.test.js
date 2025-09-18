/**
 * Test suite for the unified PluginStateManager
 * Tests the critical enable/disable functionality and state consistency
 */

import { pluginStateManager, PluginState } from './PluginStateManager.js';

// Mock Tauri functions
const mockTauriInvoke = (command, args) => {
  console.log(`Mock Tauri invoke: ${command}`, args);
  
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
      console.log(`✅ Mock: Enabled plugin ${args.name}`);
      return Promise.resolve({ success: true });
      
    case 'disable_plugin':
      console.log(`❌ Mock: Disabled plugin ${args.name}`);
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

/**
 * Test suite runner
 */
class PluginStateManagerTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runAllTests() {
    console.log('🧪 Running Plugin State Manager Tests...\n');

    for (const { name, testFn } of this.tests) {
      try {
        console.log(`🔬 Test: ${name}`);
        await testFn();
        console.log(`✅ PASSED: ${name}\n`);
        this.passed++;
      } catch (error) {
        console.error(`❌ FAILED: ${name}`);
        console.error(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('📊 TEST SUMMARY');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Total: ${this.tests.length}`);
    console.log(`🎯 Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`);
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
  }

  assertType(value, expectedType, message) {
    if (typeof value !== expectedType) {
      throw new Error(`${message}: Expected ${expectedType}, got ${typeof value}`);
    }
  }
}

// Initialize test runner
const tests = new PluginStateManagerTests();

// Test 1: Initialize state manager
tests.test('Initialize state manager', async () => {
  await pluginStateManager.initialize();
  tests.assert(pluginStateManager.isInitialized, 'State manager should be initialized');
});

// Test 2: Load plugins with correct enabled states
tests.test('Load plugins with correct enabled states', async () => {
  const plugins = pluginStateManager.getPlugins();
  
  tests.assert(Array.isArray(plugins), 'Plugins should be an array');
  tests.assertEqual(plugins.length, 2, 'Should have 2 plugins');
  
  // Check plugin 1 (should be enabled)
  const plugin1 = plugins.find(p => p.id === 'test-plugin-1');
  tests.assert(plugin1, 'Plugin 1 should exist');
  tests.assertEqual(plugin1.enabled, true, 'Plugin 1 should be enabled');
  tests.assertType(plugin1.enabled, 'boolean', 'Plugin 1 enabled state should be boolean');
  
  // Check plugin 2 (should be disabled)
  const plugin2 = plugins.find(p => p.id === 'test-plugin-2');
  tests.assert(plugin2, 'Plugin 2 should exist');
  tests.assertEqual(plugin2.enabled, false, 'Plugin 2 should be disabled');
  tests.assertType(plugin2.enabled, 'boolean', 'Plugin 2 enabled state should be boolean');
  
  console.log('   ✓ Plugin states loaded correctly');
});

// Test 3: Test enable plugin functionality
tests.test('Enable plugin functionality', async () => {
  // Enable plugin 2
  await pluginStateManager.togglePlugin('test-plugin-2', true);
  
  const plugin2 = pluginStateManager.getPlugin('test-plugin-2');
  tests.assert(plugin2, 'Plugin 2 should exist after toggle');
  tests.assertEqual(plugin2.enabled, true, 'Plugin 2 should now be enabled');
  tests.assertType(plugin2.enabled, 'boolean', 'Enabled state should be boolean');
  
  const enabledPlugins = pluginStateManager.getEnabledPlugins();
  tests.assert(enabledPlugins.has('test-plugin-2'), 'Plugin 2 should be in enabled set');
  
  console.log('   ✓ Plugin enabled successfully');
});

// Test 4: Test disable plugin functionality
tests.test('Disable plugin functionality', async () => {
  // Disable plugin 1
  await pluginStateManager.togglePlugin('test-plugin-1', false);
  
  const plugin1 = pluginStateManager.getPlugin('test-plugin-1');
  tests.assert(plugin1, 'Plugin 1 should exist after toggle');
  tests.assertEqual(plugin1.enabled, false, 'Plugin 1 should now be disabled');
  tests.assertType(plugin1.enabled, 'boolean', 'Enabled state should be boolean');
  
  const enabledPlugins = pluginStateManager.getEnabledPlugins();
  tests.assert(!enabledPlugins.has('test-plugin-1'), 'Plugin 1 should not be in enabled set');
  
  console.log('   ✓ Plugin disabled successfully');
});

// Test 5: Test invalid inputs are handled
tests.test('Handle invalid inputs gracefully', async () => {
  // Test undefined enabled state
  try {
    await pluginStateManager.togglePlugin('test-plugin-1', undefined);
    tests.assert(false, 'Should have thrown error for undefined enabled state');
  } catch (error) {
    tests.assert(error.message.includes('must be boolean'), 'Should reject undefined enabled state');
    console.log('   ✓ Rejected undefined enabled state');
  }

  // Test invalid plugin ID
  try {
    await pluginStateManager.togglePlugin('', true);
    tests.assert(false, 'Should have thrown error for empty plugin ID');
  } catch (error) {
    tests.assert(error.message.includes('Plugin ID is required'), 'Should reject empty plugin ID');
    console.log('   ✓ Rejected empty plugin ID');
  }

  // Test non-existent plugin
  try {
    await pluginStateManager.togglePlugin('non-existent-plugin', true);
    tests.assert(false, 'Should have thrown error for non-existent plugin');
  } catch (error) {
    tests.assert(error.message.includes('Plugin not found'), 'Should reject non-existent plugin');
    console.log('   ✓ Rejected non-existent plugin');
  }
});

// Test 6: Test state consistency
tests.test('State consistency after multiple operations', async () => {
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
  
  tests.assertEqual(plugin1.enabled, false, 'Plugin 1 should be disabled');
  tests.assertEqual(plugin2.enabled, true, 'Plugin 2 should be enabled');
  
  tests.assert(!enabledPlugins.has('test-plugin-1'), 'Enabled set should not contain plugin 1');
  tests.assert(enabledPlugins.has('test-plugin-2'), 'Enabled set should contain plugin 2');
  
  console.log('   ✓ State consistency maintained');
});

// Test 7: Test statistics and debugging info
tests.test('Statistics and debugging information', async () => {
  const stats = pluginStateManager.getStats();
  
  tests.assert(typeof stats === 'object', 'Stats should be an object');
  tests.assert(typeof stats.total === 'number', 'Total should be a number');
  tests.assert(typeof stats.enabled === 'number', 'Enabled count should be a number');
  tests.assert(Array.isArray(stats.plugins), 'Plugins array should exist');
  
  tests.assertEqual(stats.total, 2, 'Should have 2 total plugins');
  tests.assertEqual(stats.enabled, 1, 'Should have 1 enabled plugin');
  
  // Check plugin details in stats
  const plugin1Stats = stats.plugins.find(p => p.id === 'test-plugin-1');
  const plugin2Stats = stats.plugins.find(p => p.id === 'test-plugin-2');
  
  tests.assert(plugin1Stats, 'Plugin 1 should be in stats');
  tests.assert(plugin2Stats, 'Plugin 2 should be in stats');
  tests.assertEqual(plugin1Stats.enabled, false, 'Plugin 1 should be disabled in stats');
  tests.assertEqual(plugin2Stats.enabled, true, 'Plugin 2 should be enabled in stats');
  
  console.log('   ✓ Statistics accurate and complete');
  console.log('   📊 Current stats:', JSON.stringify(stats, null, 2));
});

// Test 8: Test race condition prevention
tests.test('Race condition prevention', async () => {
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
  tests.assertType(plugin1.enabled, 'boolean', 'Final state should be boolean');
  
  console.log(`   ✓ Race condition handled - final state: ${plugin1.enabled}`);
});

// Export the test runner for manual execution
export { tests as pluginStateManagerTests };

// Auto-run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  tests.runAllTests().catch(console.error);
}

console.log('🔬 Plugin State Manager test suite loaded. Run pluginStateManagerTests.runAllTests() to execute.');