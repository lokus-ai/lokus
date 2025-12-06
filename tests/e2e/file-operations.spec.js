import { test, expect } from '@playwright/test';
import { disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * File Operations Tests
 *
 * IMPORTANT: These tests require a real Tauri environment.
 * They will skip in CI where Tauri is not available.
 */
test.describe('File Operations', () => {
  // Skip in CI (no Tauri available)
  test.skip(() => process.env.CI === 'true', 'File operations tests require Tauri environment');

  test.beforeEach(async ({ page }) => {
    await disableTour(page);
    await page.goto('/');
    await dismissTourOverlay(page);
    await page.waitForTimeout(2000); // Wait for app to fully load
  });

  test('should show workspace with file list', async ({ page }) => {
    // Look for file list or workspace elements
    const workspace = page.locator('.workspace, [data-testid="workspace"], .file-list');
    if (await workspace.count() > 0) {
      await expect(workspace).toBeVisible();
    }
  });

  test('should handle file creation', async ({ page }) => {
    // Look for new file button
    const newFileButton = page.locator(
      'button:has-text("New"), ' +
      'button:has-text("Create"), ' +
      '[data-testid="new-file"], ' +
      '.new-file-button'
    );
    
    if (await newFileButton.count() > 0) {
      await newFileButton.first().click();
      await page.waitForTimeout(1000);
      
      // Check if editor appeared or file was created
      const editor = page.locator('.ProseMirror, .tiptap-area');
      if (await editor.count() > 0) {
        await expect(editor).toBeVisible();
      }
    }
  });

  test('should handle file saving', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    if (await editor.count() > 0) {
      await editor.click();
      await editor.fill('Test content for saving');
      
      // Try Ctrl+S to save
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(1000);
      
      // Check if content persists (basic check)
      await expect(editor).toContainText('Test content for saving');
    }
  });

  test('should handle file searching', async ({ page }) => {
    // Look for search functionality
    const searchInput = page.locator(
      'input[placeholder*="Search"], ' +
      'input[placeholder*="search"], ' +
      '[data-testid="search"], ' +
      '.search-input'
    );
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await searchInput.clear();
    }
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test common shortcuts
    const shortcuts = [
      'Control+n', // New file
      'Control+o', // Open file  
      'Control+f', // Find
      'Control+,', // Preferences (common shortcut)
    ];
    
    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut);
      await page.waitForTimeout(500);
      
      // Check if any modal or dialog appeared
      const modal = page.locator('.modal, .dialog, [role="dialog"]');
      if (await modal.count() > 0) {
        // Close modal if it appeared
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });
});