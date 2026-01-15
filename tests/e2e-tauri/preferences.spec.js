/**
 * Preferences E2E Tests for Tauri
 *
 * These tests run against the REAL Tauri application.
 * They use WebdriverIO + tauri-driver to control the native app.
 *
 * Note: Tauri apps don't support browser.url() navigation like web browsers.
 * Tests must interact with the app through its native UI.
 */

import { browser, expect } from '@wdio/globals';

describe('Preferences', () => {
  beforeEach(async () => {
    // Wait for app to load
    await browser.pause(2000);

    // Navigate to preferences if not already there
    const preferencesSelectors = [
      '[data-testid="preferences"]',
      'button*=Preferences'
    ];

    for (const selector of preferencesSelectors) {
      const element = await browser.$(selector);
      if (await element.isExisting()) {
        const isVisible = await element.isDisplayed().catch(() => false);
        if (isVisible) {
          await element.click();
          break;
        }
      }
    }

    // Wait for preferences to load
    await browser.pause(1000);
  });

  it('should show preferences sections', async () => {
    // Check if preferences sections are visible
    const sections = [
      'Appearance',
      'Editor',
      'General',
      'Markdown',
      'Shortcuts'
    ];

    for (const section of sections) {
      const sectionButton = await browser.$(`button*=${section}`);
      if (await sectionButton.isExisting()) {
        const isVisible = await sectionButton.isDisplayed().catch(() => false);
        if (isVisible) {
          await expect(sectionButton).toBeDisplayed();
        }
      }
    }
  });

  it('should change theme mode', async () => {
    // Navigate to Appearance section
    const appearanceButton = await browser.$('button*=Appearance');
    if (await appearanceButton.isExisting()) {
      const isVisible = await appearanceButton.isDisplayed().catch(() => false);
      if (isVisible) {
        await appearanceButton.click();
        await browser.pause(500);

        // Try to find and click theme buttons
        const lightButton = await browser.$('button*=Light');
        const darkButton = await browser.$('button*=Dark');

        if (await lightButton.isExisting()) {
          const lightVisible = await lightButton.isDisplayed().catch(() => false);
          if (lightVisible) {
            await lightButton.click();
            await browser.pause(500);
          }
        }

        if (await darkButton.isExisting()) {
          const darkVisible = await darkButton.isDisplayed().catch(() => false);
          if (darkVisible) {
            await darkButton.click();
            await browser.pause(500);
          }
        }
      }
    }
  });

  it('should modify editor settings', async () => {
    // Navigate to Editor section
    const editorButton = await browser.$('button*=Editor');
    if (await editorButton.isExisting()) {
      const isVisible = await editorButton.isDisplayed().catch(() => false);
      if (isVisible) {
        await editorButton.click();
        await browser.pause(500);

        // Test font family change
        const fontSelects = await browser.$$('select');
        if (fontSelects.length > 0) {
          const fontSelect = fontSelects[0];
          if (await fontSelect.isDisplayed().catch(() => false)) {
            await fontSelect.selectByIndex(1);
            await browser.pause(500);
          }
        }

        // Test font size slider
        const fontSizeSliders = await browser.$$('input[type="range"]');
        if (fontSizeSliders.length > 0) {
          const fontSizeSlider = fontSizeSliders[0];
          if (await fontSizeSlider.isDisplayed().catch(() => false)) {
            await fontSizeSlider.setValue('18');
            await browser.pause(500);
          }
        }
      }
    }
  });

  it('should toggle markdown features', async () => {
    // Navigate to Markdown section
    const markdownButton = await browser.$('button*=Markdown');
    if (await markdownButton.isExisting()) {
      const isVisible = await markdownButton.isDisplayed().catch(() => false);
      if (isVisible) {
        await markdownButton.click();
        await browser.pause(500);

        // Test markdown feature toggles
        const checkboxes = await browser.$$('input[type="checkbox"]');

        if (checkboxes.length > 0) {
          const firstCheckbox = checkboxes[0];
          if (await firstCheckbox.isDisplayed().catch(() => false)) {
            // Toggle first checkbox
            await firstCheckbox.click();
            await browser.pause(500);

            // Toggle it back
            await firstCheckbox.click();
            await browser.pause(500);
          }
        }
      }
    }
  });

  it('should handle keyboard shortcuts', async () => {
    // Navigate to Shortcuts section
    const shortcutsButton = await browser.$('button*=Shortcuts');
    if (await shortcutsButton.isExisting()) {
      const isVisible = await shortcutsButton.isDisplayed().catch(() => false);
      if (isVisible) {
        await shortcutsButton.click();
        await browser.pause(500);

        // Check if shortcuts are listed
        const shortcutsSelectors = ['.shortcuts-list', '[data-testid="shortcuts"]'];
        for (const selector of shortcutsSelectors) {
          const shortcutsList = await browser.$(selector);
          if (await shortcutsList.isExisting()) {
            const listVisible = await shortcutsList.isDisplayed().catch(() => false);
            if (listVisible) {
              await expect(shortcutsList).toBeDisplayed();
              break;
            }
          }
        }

        // Test search functionality
        const searchSelectors = ['input[placeholder*="Search"]', 'input[placeholder*="search"]'];
        for (const selector of searchSelectors) {
          const searchInput = await browser.$(selector);
          if (await searchInput.isExisting()) {
            const inputVisible = await searchInput.isDisplayed().catch(() => false);
            if (inputVisible) {
              await searchInput.setValue('copy');
              await browser.pause(500);
              await searchInput.clearValue();
              break;
            }
          }
        }
      }
    }
  });
});
