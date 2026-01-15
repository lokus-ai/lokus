/**
 * Basic App E2E Tests for Tauri
 *
 * These tests run against the REAL Tauri application.
 * They use WebdriverIO + tauri-driver to control the native app.
 *
 * Note: Tauri apps don't support browser.url() navigation like web browsers.
 * Tests must interact with the app through its native UI.
 */

import { browser, expect } from '@wdio/globals';

describe('Basic App Tests', () => {
  it('should load Lokus app', async () => {
    // Wait for app to load
    await browser.pause(2000);

    // Should show Lokus branding
    const lokusText = await browser.$('*=Lokus');
    await lokusText.waitForExist({ timeout: 10000 });
    await expect(lokusText).toBeDisplayed();

    // Take a screenshot for debugging
    await browser.saveScreenshot('test-results/app-loaded.png');
  });

  it('should show launcher screen', async () => {
    await browser.pause(2000);

    // Should show workspace selection
    const workspaceSelectors = [
      '*=Open Workspace',
      '*=Recently Opened',
      '*=Create Workspace',
      'button*=Open'
    ];

    let foundElement = false;
    for (const selector of workspaceSelectors) {
      const element = await browser.$(selector);
      if (await element.isExisting()) {
        const isVisible = await element.isDisplayed().catch(() => false);
        if (isVisible) {
          console.log(`Found: ${selector}`);
          foundElement = true;
          break;
        }
      }
    }

    expect(foundElement).toBe(true);
  });

  it('should handle manual workspace selection', async () => {
    await browser.pause(2000);

    // Try to click open workspace button
    const openBtn = await browser.$('button*=Open Workspace');
    if (await openBtn.isExisting()) {
      const isVisible = await openBtn.isDisplayed().catch(() => false);
      if (isVisible) {
        await openBtn.click();

        // This will open file dialog which we can't automate easily
        // But we can verify the UI responds
        console.log('Open Workspace button clicked');
      }
    }

    // Take screenshot
    await browser.saveScreenshot('test-results/workspace-dialog.png');
  });

  it('should work with environment workspace', async () => {
    // In Tauri, we can't use addInitScript - workspace is set via environment
    const testWorkspace = `/tmp/wdio-test-${Date.now()}`;
    console.log('Test workspace would be:', testWorkspace);

    // Refresh the app
    await browser.refresh();
    await browser.pause(5000);

    // Check if workspace opened automatically
    const workspaceSelectors = [
      '[data-testid="file-tree"]',
      '.workspace-content',
      '.file-explorer'
    ];

    let workspaceOpened = false;
    for (const selector of workspaceSelectors) {
      const element = await browser.$(selector);
      if (await element.isExisting()) {
        const isVisible = await element.isDisplayed().catch(() => false);
        if (isVisible) {
          workspaceOpened = true;
          break;
        }
      }
    }

    if (workspaceOpened) {
      console.log('Workspace opened automatically');
    } else {
      console.log('Workspace did not open automatically');
    }

    await browser.saveScreenshot('test-results/env-workspace.png');
  });
});
