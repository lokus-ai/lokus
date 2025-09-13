import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Plugin Management E2E', () => {
  let testPluginPath

  test.beforeAll(async () => {
    // Set up test plugin directory
    testPluginPath = path.join(__dirname, '../../fixtures/plugins/test-plugin')
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
    
    // Wait for app to fully initialize
    await page.waitForSelector('[data-testid="editor"]', { timeout: 10000 })
  })

  test.describe('Plugin Installation', () => {
    test('should install plugin from local directory', async ({ page }) => {
      // Open plugin management
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Wait for plugin management panel
      await page.waitForSelector('[data-testid="plugin-manager"]')
      
      // Install from local directory
      await page.click('[data-testid="install-local-plugin"]')
      await page.fill('[data-testid="plugin-path-input"]', testPluginPath)
      await page.click('[data-testid="install-plugin-button"]')
      
      // Verify installation success
      await expect(page.locator('[data-testid="plugin-list"]'))
        .toContainText('Test Plugin')
      
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Active')
    })

    test('should show installation progress', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="install-local-plugin"]')
      await page.fill('[data-testid="plugin-path-input"]', testPluginPath)
      
      // Start installation
      await page.click('[data-testid="install-plugin-button"]')
      
      // Check for progress indicator
      await expect(page.locator('[data-testid="installation-progress"]'))
        .toBeVisible()
      
      // Wait for completion
      await page.waitForSelector('[data-testid="installation-complete"]')
      
      await expect(page.locator('[data-testid="installation-complete"]'))
        .toContainText('Plugin installed successfully')
    })

    test('should handle invalid plugin installation', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="install-local-plugin"]')
      await page.fill('[data-testid="plugin-path-input"]', '/invalid/plugin/path')
      await page.click('[data-testid="install-plugin-button"]')
      
      // Verify error message
      await expect(page.locator('[data-testid="installation-error"]'))
        .toContainText('Plugin installation failed')
    })
  })

  test.describe('Plugin Activation/Deactivation', () => {
    test.beforeEach(async ({ page }) => {
      // Install test plugin first
      await installTestPlugin(page, testPluginPath)
    })

    test('should activate and deactivate plugins', async ({ page }) => {
      // Open plugin manager
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Deactivate plugin
      await page.click('[data-testid="plugin-toggle-test-plugin"]')
      
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Inactive')
      
      // Reactivate plugin
      await page.click('[data-testid="plugin-toggle-test-plugin"]')
      
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Active')
    })

    test('should show plugin functionality when active', async ({ page }) => {
      // Verify plugin command is available
      await page.keyboard.press('Meta+K') // Open command palette
      await page.fill('[data-testid="command-search"]', 'Test Plugin Command')
      
      await expect(page.locator('[data-testid="command-list"]'))
        .toContainText('Test Plugin Command')
    })

    test('should hide plugin functionality when inactive', async ({ page }) => {
      // Deactivate plugin
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      await page.click('[data-testid="plugin-toggle-test-plugin"]')
      
      // Check command is not available
      await page.keyboard.press('Meta+K')
      await page.fill('[data-testid="command-search"]', 'Test Plugin Command')
      
      await expect(page.locator('[data-testid="command-list"]'))
        .not.toContainText('Test Plugin Command')
    })
  })

  test.describe('Plugin Configuration', () => {
    test.beforeEach(async ({ page }) => {
      await installTestPlugin(page, testPluginPath)
    })

    test('should open plugin settings', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Open plugin settings
      await page.click('[data-testid="plugin-settings-test-plugin"]')
      
      await expect(page.locator('[data-testid="plugin-settings-dialog"]'))
        .toBeVisible()
      
      await expect(page.locator('[data-testid="plugin-settings-title"]'))
        .toContainText('Test Plugin Settings')
    })

    test('should update plugin configuration', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      await page.click('[data-testid="plugin-settings-test-plugin"]')
      
      // Update setting
      await page.fill('[data-testid="setting-theme"]', 'dark')
      await page.check('[data-testid="setting-auto-save"]')
      
      await page.click('[data-testid="save-settings"]')
      
      // Verify settings saved
      await expect(page.locator('[data-testid="settings-saved"]'))
        .toContainText('Settings saved successfully')
    })
  })

  test.describe('Plugin UI Integration', () => {
    test.beforeEach(async ({ page }) => {
      await installTestPlugin(page, testPluginPath)
    })

    test('should display plugin panels', async ({ page }) => {
      // Plugin should register a custom panel
      await expect(page.locator('[data-testid="plugin-panel-test-plugin"]'))
        .toBeVisible()
      
      await expect(page.locator('[data-testid="plugin-panel-title"]'))
        .toContainText('Test Plugin Panel')
    })

    test('should execute plugin commands from editor', async ({ page }) => {
      // Click in editor
      await page.click('[data-testid="editor"]')
      
      // Type slash command
      await page.type('[data-testid="editor"]', '/test-command')
      
      // Select from slash menu
      await page.click('[data-testid="slash-command-test-command"]')
      
      // Verify command executed
      await expect(page.locator('[data-testid="editor"]'))
        .toContainText('Test plugin content inserted')
    })

    test('should show plugin keyboard shortcuts', async ({ page }) => {
      // Open help/shortcuts panel
      await page.keyboard.press('Meta+/')
      
      await expect(page.locator('[data-testid="shortcuts-list"]'))
        .toContainText('Ctrl+Shift+T: Test Plugin Action')
    })

    test('should execute plugin via keyboard shortcut', async ({ page }) => {
      await page.click('[data-testid="editor"]')
      
      // Execute plugin shortcut
      await page.keyboard.press('Control+Shift+T')
      
      // Verify plugin action executed
      await expect(page.locator('[data-testid="notification"]'))
        .toContainText('Test plugin action executed')
    })
  })

  test.describe('Plugin Error Handling', () => {
    test('should handle plugin activation errors', async ({ page }) => {
      // Try to install a plugin that will fail to activate
      const faultyPluginPath = path.join(__dirname, '../../fixtures/plugins/faulty-plugin')
      
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="install-local-plugin"]')
      await page.fill('[data-testid="plugin-path-input"]', faultyPluginPath)
      await page.click('[data-testid="install-plugin-button"]')
      
      // Should show error message
      await expect(page.locator('[data-testid="plugin-error"]'))
        .toContainText('Plugin activation failed')
      
      // App should remain stable
      await expect(page.locator('[data-testid="editor"]'))
        .toBeVisible()
    })

    test('should isolate plugin runtime errors', async ({ page }) => {
      await installTestPlugin(page, testPluginPath)
      
      // Trigger a plugin command that will error
      await page.click('[data-testid="editor"]')
      await page.type('[data-testid="editor"]', '/error-command')
      await page.click('[data-testid="slash-command-error-command"]')
      
      // Should show error but not crash app
      await expect(page.locator('[data-testid="plugin-error-notification"]'))
        .toContainText('Plugin command failed')
      
      await expect(page.locator('[data-testid="editor"]'))
        .toBeVisible()
    })
  })

  test.describe('Plugin Uninstallation', () => {
    test.beforeEach(async ({ page }) => {
      await installTestPlugin(page, testPluginPath)
    })

    test('should uninstall plugin completely', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Uninstall plugin
      await page.click('[data-testid="plugin-uninstall-test-plugin"]')
      
      // Confirm uninstallation
      await page.click('[data-testid="confirm-uninstall"]')
      
      // Verify plugin removed
      await expect(page.locator('[data-testid="plugin-list"]'))
        .not.toContainText('Test Plugin')
      
      // Verify plugin functionality removed
      await page.keyboard.press('Meta+K')
      await page.fill('[data-testid="command-search"]', 'Test Plugin Command')
      
      await expect(page.locator('[data-testid="command-list"]'))
        .not.toContainText('Test Plugin Command')
    })

    test('should show uninstall confirmation', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="plugin-uninstall-test-plugin"]')
      
      await expect(page.locator('[data-testid="uninstall-confirmation"]'))
        .toContainText('Are you sure you want to uninstall Test Plugin?')
      
      // Cancel uninstall
      await page.click('[data-testid="cancel-uninstall"]')
      
      // Plugin should still be there
      await expect(page.locator('[data-testid="plugin-list"]'))
        .toContainText('Test Plugin')
    })
  })

  // Helper function
  async function installTestPlugin(page, pluginPath) {
    await page.click('[data-testid="menu-button"]')
    await page.click('[data-testid="plugins-menu-item"]')
    await page.click('[data-testid="install-local-plugin"]')
    await page.fill('[data-testid="plugin-path-input"]', pluginPath)
    await page.click('[data-testid="install-plugin-button"]')
    await page.waitForSelector('[data-testid="installation-complete"]')
  }
})