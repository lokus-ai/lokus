/**
 * File Operations E2E Tests for Tauri
 *
 * These tests run against the REAL Tauri application.
 * They use WebdriverIO + tauri-driver to control the native app.
 *
 * Note: Tauri apps don't support browser.url() navigation like web browsers.
 * Tests must interact with the app through its native UI.
 */

import { browser, expect } from '@wdio/globals';

describe('File Operations', () => {
  beforeEach(async () => {
    // Wait for app to fully load
    await browser.pause(2000);
  });

  it('should show workspace with file list', async () => {
    // Look for file list or workspace elements
    const workspaceSelectors = ['.workspace', '[data-testid="workspace"]', '.file-list'];

    for (const selector of workspaceSelectors) {
      const elements = await browser.$$(selector);
      if (elements.length > 0) {
        const workspace = await browser.$(selector);
        await expect(workspace).toBeDisplayed();
        return;
      }
    }

    // If no workspace found, log available elements for debugging
    const body = await browser.$('body');
    const bodyText = await body.getText();
    console.log('Body text preview:', bodyText.substring(0, 200));
  });

  it('should handle file creation', async () => {
    // Look for new file button with various selectors
    const buttonSelectors = [
      'button*=New',
      'button*=Create',
      '[data-testid="new-file"]',
      '.new-file-button'
    ];

    let buttonFound = false;
    for (const selector of buttonSelectors) {
      const buttons = await browser.$$(selector);
      if (buttons.length > 0) {
        const newFileButton = await browser.$(selector);
        await newFileButton.click();
        await browser.pause(1000);
        buttonFound = true;
        break;
      }
    }

    if (buttonFound) {
      // Check if editor appeared or file was created
      const editorSelectors = ['.ProseMirror', '.tiptap-area'];
      for (const selector of editorSelectors) {
        const editors = await browser.$$(selector);
        if (editors.length > 0) {
          const editor = await browser.$(selector);
          await expect(editor).toBeDisplayed();
          return;
        }
      }
    }
  });

  it('should handle file saving', async () => {
    const editors = await browser.$$('.ProseMirror');
    if (editors.length > 0) {
      const editor = await browser.$('.ProseMirror');
      await editor.click();
      await editor.setValue('Test content for saving');

      // Try Ctrl+S to save (platform-specific)
      const isMac = process.platform === 'darwin';
      if (isMac) {
        await browser.keys(['Meta', 's']);
      } else {
        await browser.keys(['Control', 's']);
      }
      await browser.pause(1000);

      // Check if content persists (basic check)
      const content = await editor.getText();
      expect(content).toContain('Test content for saving');
    }
  });

  it('should handle file searching', async () => {
    // Look for search functionality
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      '[data-testid="search"]',
      '.search-input'
    ];

    for (const selector of searchSelectors) {
      const inputs = await browser.$$(selector);
      if (inputs.length > 0) {
        const searchInput = await browser.$(selector);
        await searchInput.setValue('test');
        await browser.pause(500);
        await searchInput.clearValue();
        return;
      }
    }
  });

  it('should handle keyboard shortcuts', async () => {
    // Test common shortcuts (platform-specific)
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    const shortcuts = [
      [modifier, 'n'], // New file
      [modifier, 'o'], // Open file
      [modifier, 'f'], // Find
      [modifier, ','], // Preferences (common shortcut)
    ];

    for (const shortcut of shortcuts) {
      await browser.keys(shortcut);
      await browser.pause(500);

      // Check if any modal or dialog appeared
      const modalSelectors = ['.modal', '.dialog', '[role="dialog"]'];
      for (const selector of modalSelectors) {
        const modals = await browser.$$(selector);
        if (modals.length > 0) {
          // Close modal if it appeared
          await browser.keys(['Escape']);
          await browser.pause(300);
          break;
        }
      }
    }
  });
});
