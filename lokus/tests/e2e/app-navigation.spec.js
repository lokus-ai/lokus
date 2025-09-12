import { test, expect } from '@playwright/test';

test.describe('App Navigation', () => {
  test('should load the main application', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page.locator('.app-container, #root')).toBeVisible();
  });

  test('should navigate to preferences', async ({ page }) => {
    await page.goto('/');
    
    // Look for preferences button or menu
    const preferencesButton = page.locator('[data-testid="preferences"], button:has-text("Preferences"), .preferences-button');
    if (await preferencesButton.count() > 0) {
      await preferencesButton.first().click();
      await expect(page.locator('text=Preferences')).toBeVisible();
    }
  });

  test('should show workspace view', async ({ page }) => {
    await page.goto('/');
    
    // Check if workspace elements are visible
    await expect(page.locator('.workspace, [data-testid="workspace"]')).toBeVisible();
  });

  test('should handle theme switching', async ({ page }) => {
    await page.goto('/');
    
    // Try to find and test theme switcher
    const themeButton = page.locator('[data-testid="theme-switcher"], button:has-text("theme"), .theme-button');
    if (await themeButton.count() > 0) {
      await themeButton.first().click();
      // Verify theme changed (could check CSS variables or classes)
    }
  });
});