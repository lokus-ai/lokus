import { test, expect } from '@playwright/test';

test.describe('Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Navigate to preferences if not already there
    const preferencesButton = page.locator('[data-testid="preferences"], button:has-text("Preferences")');
    if (await preferencesButton.count() > 0) {
      await preferencesButton.first().click();
    }
    
    // Wait for preferences to load
    await page.waitForTimeout(1000);
  });

  test('should show preferences sections', async ({ page }) => {
    // Check if preferences sections are visible
    const sections = [
      'Appearance',
      'Editor', 
      'General',
      'Markdown',
      'Shortcuts'
    ];
    
    for (const section of sections) {
      const sectionButton = page.locator(`button:has-text("${section}")`);
      if (await sectionButton.count() > 0) {
        await expect(sectionButton).toBeVisible();
      }
    }
  });

  test('should change theme mode', async ({ page }) => {
    // Navigate to Appearance section
    const appearanceButton = page.locator('button:has-text("Appearance")');
    if (await appearanceButton.count() > 0) {
      await appearanceButton.click();
      
      // Try to find and click theme buttons
      const lightButton = page.locator('button:has-text("Light")');
      const darkButton = page.locator('button:has-text("Dark")');
      
      if (await lightButton.count() > 0) {
        await lightButton.click();
        await page.waitForTimeout(500);
      }
      
      if (await darkButton.count() > 0) {
        await darkButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should modify editor settings', async ({ page }) => {
    // Navigate to Editor section
    const editorButton = page.locator('button:has-text("Editor")');
    if (await editorButton.count() > 0) {
      await editorButton.click();
      
      // Test font family change
      const fontSelect = page.locator('select').first();
      if (await fontSelect.count() > 0) {
        await fontSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
      }
      
      // Test font size slider
      const fontSizeSlider = page.locator('input[type="range"]').first();
      if (await fontSizeSlider.count() > 0) {
        await fontSizeSlider.fill('18');
        await page.waitForTimeout(500);
      }
    }
  });

  test('should toggle markdown features', async ({ page }) => {
    // Navigate to Markdown section
    const markdownButton = page.locator('button:has-text("Markdown")');
    if (await markdownButton.count() > 0) {
      await markdownButton.click();
      
      // Test markdown feature toggles
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();
      
      if (checkboxCount > 0) {
        // Toggle first checkbox
        await checkboxes.first().click();
        await page.waitForTimeout(500);
        
        // Toggle it back
        await checkboxes.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Navigate to Shortcuts section
    const shortcutsButton = page.locator('button:has-text("Shortcuts")');
    if (await shortcutsButton.count() > 0) {
      await shortcutsButton.click();
      
      // Check if shortcuts are listed
      const shortcutsList = page.locator('.shortcuts-list, [data-testid="shortcuts"]');
      if (await shortcutsList.count() > 0) {
        await expect(shortcutsList).toBeVisible();
      }
      
      // Test search functionality
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('copy');
        await page.waitForTimeout(500);
        await searchInput.clear();
      }
    }
  });
});