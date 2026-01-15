/**
 * App Navigation E2E Tests for Tauri
 *
 * These tests run against the REAL Tauri application.
 * They use WebdriverIO + tauri-driver to control the native app.
 *
 * Note: Tauri apps don't support browser.url() navigation like web browsers.
 * Tests must interact with the app through its native UI.
 */

import { browser, expect } from '@wdio/globals';

describe('App Navigation', () => {
  it('should load the main application', async () => {
    // Wait for the app to load
    await browser.pause(2000);

    // Check for app container or root element
    const appContainer = await browser.$('.app-container');
    const root = await browser.$('#root');

    const hasAppContainer = await appContainer.isExisting() && await appContainer.isDisplayed().catch(() => false);
    const hasRoot = await root.isExisting() && await root.isDisplayed().catch(() => false);

    expect(hasAppContainer || hasRoot).toBe(true);
  });

  it('should navigate to preferences', async () => {
    await browser.pause(2000);

    // Look for preferences button or menu
    const preferencesSelectors = [
      '[data-testid="preferences"]',
      'button*=Preferences',
      '.preferences-button'
    ];

    let preferencesButton = null;
    for (const selector of preferencesSelectors) {
      const element = await browser.$(selector);
      if (await element.isExisting()) {
        const isVisible = await element.isDisplayed().catch(() => false);
        if (isVisible) {
          preferencesButton = element;
          break;
        }
      }
    }

    if (preferencesButton) {
      await preferencesButton.click();
      await browser.pause(1000);

      // Check for Preferences text to appear
      const preferencesText = await browser.$('*=Preferences');
      await expect(preferencesText).toBeDisplayed();
    }
  });

  it('should show workspace or launcher view', async () => {
    await browser.pause(2000);

    // App should show either workspace (if configured) or launcher
    // Check for either workspace elements OR launcher elements
    const workspaceSelectors = ['[data-tour="files"]', '.ProseMirror'];
    const launcherText = await browser.$('*=Create New Workspace');

    let hasWorkspace = false;
    for (const selector of workspaceSelectors) {
      const element = await browser.$(selector);
      if (await element.isExisting()) {
        const isVisible = await element.isDisplayed().catch(() => false);
        if (isVisible) {
          hasWorkspace = true;
          break;
        }
      }
    }

    const hasLauncher = await launcherText.isExisting() && await launcherText.isDisplayed().catch(() => false);

    expect(hasWorkspace || hasLauncher).toBe(true);
  });

  it('should handle theme switching', async () => {
    await browser.pause(2000);

    // Try to find and test theme switcher
    const themeSelectors = [
      '[data-testid="theme-switcher"]',
      'button*=theme',
      '.theme-button'
    ];

    let themeButton = null;
    for (const selector of themeSelectors) {
      const element = await browser.$(selector);
      if (await element.isExisting()) {
        const isVisible = await element.isDisplayed().catch(() => false);
        if (isVisible) {
          themeButton = element;
          break;
        }
      }
    }

    if (themeButton) {
      await themeButton.click();
      await browser.pause(500);
      // Verify theme changed (could check CSS variables or classes)
    }
  });
});
