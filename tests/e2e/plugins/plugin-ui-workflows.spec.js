import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Plugin Management UI Workflows', () => {
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

  test.describe('Plugin Discovery and Installation', () => {
    test('should discover and display available plugins', async ({ page }) => {
      // Navigate to plugin management
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Wait for plugin management panel
      await page.waitForSelector('[data-testid="plugin-manager"]')
      
      // Should show plugins section
      await expect(page.locator('[data-testid="available-plugins-section"]')).toBeVisible()
      await expect(page.locator('[data-testid="installed-plugins-section"]')).toBeVisible()
      
      // Should show plugin discovery status
      await expect(page.locator('[data-testid="plugin-discovery-status"]')).toBeVisible()
    })

    test('should install plugin from URL', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Open install dialog
      await page.click('[data-testid="install-plugin-button"]')
      await page.waitForSelector('[data-testid="plugin-install-dialog"]')
      
      // Test URL installation
      await page.click('[data-testid="install-from-url-tab"]')
      await page.fill('[data-testid="plugin-url-input"]', 'https://example.com/plugin.zip')
      
      // Verify install button state
      await expect(page.locator('[data-testid="confirm-install-button"]')).toBeEnabled()
      
      // Cancel installation
      await page.click('[data-testid="cancel-install-button"]')
      await expect(page.locator('[data-testid="plugin-install-dialog"]')).not.toBeVisible()
    })

    test('should validate plugin manifest during installation', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="install-plugin-button"]')
      await page.fill('[data-testid="plugin-path-input"]', '/invalid/path')
      await page.click('[data-testid="confirm-install-button"]')
      
      // Should show validation error
      await expect(page.locator('[data-testid="installation-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="installation-error"]'))
        .toContainText('Invalid plugin manifest')
    })

    test('should show installation progress and completion', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="install-plugin-button"]')
      await page.fill('[data-testid="plugin-path-input"]', testPluginPath)
      
      // Start installation
      await page.click('[data-testid="confirm-install-button"]')
      
      // Should show progress
      await expect(page.locator('[data-testid="installation-progress"]')).toBeVisible()
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible()
      
      // Wait for completion
      await page.waitForSelector('[data-testid="installation-complete"]', { timeout: 10000 })
      
      // Should show success message
      await expect(page.locator('[data-testid="installation-success"]'))
        .toContainText('Plugin installed successfully')
      
      // Plugin should appear in installed list
      await expect(page.locator('[data-testid="installed-plugin-test-plugin"]')).toBeVisible()
    })
  })

  test.describe('Plugin Management Operations', () => {
    test.beforeEach(async ({ page }) => {
      // Install test plugin first
      await installTestPlugin(page, testPluginPath)
    })

    test('should enable and disable plugins', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Plugin should be active by default
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Active')
      
      // Disable plugin
      await page.click('[data-testid="plugin-toggle-test-plugin"]')
      
      // Should show confirmation dialog
      await expect(page.locator('[data-testid="plugin-disable-confirmation"]')).toBeVisible()
      await page.click('[data-testid="confirm-disable-button"]')
      
      // Status should update
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Inactive')
      
      // Enable plugin again
      await page.click('[data-testid="plugin-toggle-test-plugin"]')
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Active')
    })

    test('should show plugin details and configuration', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Click plugin details
      await page.click('[data-testid="plugin-details-test-plugin"]')
      
      // Should show plugin detail panel
      await expect(page.locator('[data-testid="plugin-detail-panel"]')).toBeVisible()
      
      // Should show plugin information
      await expect(page.locator('[data-testid="plugin-name"]')).toContainText('Test Plugin')
      await expect(page.locator('[data-testid="plugin-version"]')).toContainText('1.0.0')
      await expect(page.locator('[data-testid="plugin-description"]')).toBeVisible()
      
      // Should show plugin permissions
      await expect(page.locator('[data-testid="plugin-permissions"]')).toBeVisible()
      
      // Should show plugin settings if available
      if (await page.locator('[data-testid="plugin-settings-section"]').isVisible()) {
        await expect(page.locator('[data-testid="plugin-settings-section"]')).toBeVisible()
      }
    })

    test('should uninstall plugins with confirmation', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Open plugin menu
      await page.click('[data-testid="plugin-menu-test-plugin"]')
      await page.click('[data-testid="uninstall-plugin-option"]')
      
      // Should show uninstall confirmation
      await expect(page.locator('[data-testid="uninstall-confirmation-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="uninstall-warning"]'))
        .toContainText('This action cannot be undone')
      
      // Confirm uninstall
      await page.click('[data-testid="confirm-uninstall-button"]')
      
      // Should show uninstall progress
      await expect(page.locator('[data-testid="uninstall-progress"]')).toBeVisible()
      
      // Plugin should be removed from list
      await page.waitForSelector('[data-testid="installed-plugin-test-plugin"]', { 
        state: 'detached',
        timeout: 10000 
      })
    })

    test('should handle plugin dependency warnings', async ({ page }) => {
      // This test assumes we have plugins with dependencies in fixtures
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Try to disable a plugin that other plugins depend on
      await page.click('[data-testid="plugin-menu-core-plugin"]')
      await page.click('[data-testid="disable-plugin-option"]')
      
      // Should show dependency warning
      await expect(page.locator('[data-testid="dependency-warning-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="dependent-plugins-list"]')).toBeVisible()
      
      // Should offer to disable dependent plugins
      await expect(page.locator('[data-testid="disable-dependents-option"]')).toBeVisible()
      
      // Cancel operation
      await page.click('[data-testid="cancel-dependency-operation"]')
    })
  })

  test.describe('Plugin Marketplace Integration', () => {
    test('should browse available plugins in marketplace', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Navigate to marketplace
      await page.click('[data-testid="plugin-marketplace-tab"]')
      
      // Should show marketplace interface
      await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible()
      
      // Should show search functionality
      await expect(page.locator('[data-testid="marketplace-search"]')).toBeVisible()
      
      // Should show plugin categories
      await expect(page.locator('[data-testid="plugin-categories"]')).toBeVisible()
      
      // Should show featured plugins
      await expect(page.locator('[data-testid="featured-plugins"]')).toBeVisible()
    })

    test('should search for plugins in marketplace', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      await page.click('[data-testid="plugin-marketplace-tab"]')
      
      // Search for plugins
      await page.fill('[data-testid="marketplace-search"]', 'editor')
      await page.press('[data-testid="marketplace-search"]', 'Enter')
      
      // Should show search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible()
      await expect(page.locator('[data-testid="search-results-count"]')).toBeVisible()
      
      // Should filter by category
      await page.click('[data-testid="category-editor"]')
      await expect(page.locator('[data-testid="category-filter-active"]')).toBeVisible()
    })

    test('should show plugin details in marketplace', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      await page.click('[data-testid="plugin-marketplace-tab"]')
      
      // Click on a plugin
      await page.click('[data-testid="marketplace-plugin-item"]:first-child')
      
      // Should show plugin detail modal
      await expect(page.locator('[data-testid="marketplace-plugin-detail"]')).toBeVisible()
      
      // Should show plugin information
      await expect(page.locator('[data-testid="plugin-title"]')).toBeVisible()
      await expect(page.locator('[data-testid="plugin-author"]')).toBeVisible()
      await expect(page.locator('[data-testid="plugin-rating"]')).toBeVisible()
      await expect(page.locator('[data-testid="plugin-downloads"]')).toBeVisible()
      
      // Should show install button
      await expect(page.locator('[data-testid="install-from-marketplace-button"]')).toBeVisible()
      
      // Should show screenshots if available
      if (await page.locator('[data-testid="plugin-screenshots"]').isVisible()) {
        await expect(page.locator('[data-testid="plugin-screenshots"]')).toBeVisible()
      }
    })
  })

  test.describe('Plugin Configuration and Settings', () => {
    test.beforeEach(async ({ page }) => {
      await installTestPlugin(page, testPluginPath)
    })

    test('should modify plugin settings', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Open plugin settings
      await page.click('[data-testid="plugin-details-test-plugin"]')
      await page.click('[data-testid="plugin-settings-tab"]')
      
      // Should show settings form
      await expect(page.locator('[data-testid="plugin-settings-form"]')).toBeVisible()
      
      // Modify a setting
      await page.fill('[data-testid="setting-theme-preference"]', 'dark')
      await page.check('[data-testid="setting-enable-notifications"]')
      
      // Save settings
      await page.click('[data-testid="save-plugin-settings"]')
      
      // Should show success message
      await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible()
      
      // Settings should persist after page reload
      await page.reload()
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      await page.click('[data-testid="plugin-details-test-plugin"]')
      await page.click('[data-testid="plugin-settings-tab"]')
      
      await expect(page.locator('[data-testid="setting-theme-preference"]')).toHaveValue('dark')
      await expect(page.locator('[data-testid="setting-enable-notifications"]')).toBeChecked()
    })

    test('should validate plugin settings', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="plugin-details-test-plugin"]')
      await page.click('[data-testid="plugin-settings-tab"]')
      
      // Enter invalid setting value
      await page.fill('[data-testid="setting-max-items"]', '-1')
      await page.click('[data-testid="save-plugin-settings"]')
      
      // Should show validation error
      await expect(page.locator('[data-testid="settings-validation-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="settings-validation-error"]'))
        .toContainText('Value must be positive')
      
      // Fix the value
      await page.fill('[data-testid="setting-max-items"]', '10')
      await page.click('[data-testid="save-plugin-settings"]')
      
      // Should save successfully
      await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible()
    })

    test('should reset plugin settings to defaults', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      await page.click('[data-testid="plugin-details-test-plugin"]')
      await page.click('[data-testid="plugin-settings-tab"]')
      
      // Modify settings
      await page.fill('[data-testid="setting-theme-preference"]', 'dark')
      await page.click('[data-testid="save-plugin-settings"]')
      
      // Reset to defaults
      await page.click('[data-testid="reset-plugin-settings"]')
      
      // Should show confirmation
      await expect(page.locator('[data-testid="reset-settings-confirmation"]')).toBeVisible()
      await page.click('[data-testid="confirm-reset-settings"]')
      
      // Settings should be reset
      await expect(page.locator('[data-testid="setting-theme-preference"]')).toHaveValue('')
      await expect(page.locator('[data-testid="settings-reset-message"]')).toBeVisible()
    })
  })

  test.describe('Plugin Error Handling and Recovery', () => {
    test('should handle plugin loading errors gracefully', async ({ page }) => {
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Try to install a corrupted plugin
      await page.click('[data-testid="install-plugin-button"]')
      await page.fill('[data-testid="plugin-path-input"]', '/path/to/corrupted/plugin')
      await page.click('[data-testid="confirm-install-button"]')
      
      // Should show error state
      await expect(page.locator('[data-testid="plugin-error-state"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]'))
        .toContainText('Failed to load plugin')
      
      // Should offer retry option
      await expect(page.locator('[data-testid="retry-plugin-load"]')).toBeVisible()
      
      // Should offer remove option
      await expect(page.locator('[data-testid="remove-failed-plugin"]')).toBeVisible()
    })

    test('should handle plugin runtime errors', async ({ page }) => {
      // This test assumes we have a plugin that can trigger runtime errors
      await installTestPlugin(page, testPluginPath)
      
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Trigger a plugin error (this would be plugin-specific)
      await page.click('[data-testid="trigger-plugin-error"]')
      
      // Should show error notification
      await expect(page.locator('[data-testid="plugin-error-notification"]')).toBeVisible()
      
      // Plugin should be marked as having an error
      await expect(page.locator('[data-testid="plugin-status-test-plugin"]'))
        .toHaveText('Error')
      
      // Should offer options to restart or disable plugin
      await page.click('[data-testid="plugin-menu-test-plugin"]')
      await expect(page.locator('[data-testid="restart-plugin-option"]')).toBeVisible()
      await expect(page.locator('[data-testid="disable-plugin-option"]')).toBeVisible()
    })

    test('should provide plugin diagnostic information', async ({ page }) => {
      await installTestPlugin(page, testPluginPath)
      
      await page.click('[data-testid="menu-button"]')
      await page.click('[data-testid="plugins-menu-item"]')
      
      // Open plugin diagnostics
      await page.click('[data-testid="plugin-menu-test-plugin"]')
      await page.click('[data-testid="plugin-diagnostics-option"]')
      
      // Should show diagnostic panel
      await expect(page.locator('[data-testid="plugin-diagnostics-panel"]')).toBeVisible()
      
      // Should show plugin health information
      await expect(page.locator('[data-testid="plugin-health-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="plugin-memory-usage"]')).toBeVisible()
      await expect(page.locator('[data-testid="plugin-event-log"]')).toBeVisible()
      
      // Should show plugin API usage statistics
      await expect(page.locator('[data-testid="api-usage-stats"]')).toBeVisible()
    })
  })
})

// Helper function to install test plugin
async function installTestPlugin(page, pluginPath) {
  await page.click('[data-testid="menu-button"]')
  await page.click('[data-testid="plugins-menu-item"]')
  await page.click('[data-testid="install-plugin-button"]')
  await page.fill('[data-testid="plugin-path-input"]', pluginPath)
  await page.click('[data-testid="confirm-install-button"]')
  await page.waitForSelector('[data-testid="installation-complete"]', { timeout: 10000 })
  await page.click('[data-testid="close-install-dialog"]')
}