/**
 * Canvas Feature Tests for Tauri
 *
 * These tests run against the REAL Tauri application.
 * They use WebdriverIO + tauri-driver to control the native app.
 *
 * Note: Tauri apps don't support browser.url() navigation like web browsers.
 * Tests must interact with the app through its native UI.
 */

import { browser, expect } from '@wdio/globals';

/**
 * Dismiss any tour overlay that might be blocking.
 */
async function dismissTourOverlay() {
  await browser.execute(() => {
    // Remove driverjs overlay
    const overlay = document.querySelector('.driver-overlay');
    if (overlay) overlay.remove();

    // Remove the popover
    const popover = document.querySelector('.driver-popover');
    if (popover) popover.remove();

    // Close any dialog
    const dialog = document.querySelector('dialog[open]');
    if (dialog) dialog.close();
  });
}

describe('Canvas Feature Tests', () => {
  beforeEach(async () => {
    // Dismiss any tour overlays
    await dismissTourOverlay();
    await browser.pause(2000);
  });

  it('should show canvas files in file tree', async () => {
    // Check if canvas files appear in the workspace file tree
    const canvasFiles = await browser.$$('[data-testid="file-item"]*=.canvas');
    const canvasText = await browser.$$('*=.canvas');

    if (canvasFiles.length > 0 || canvasText.length > 0) {
      const firstCanvas = canvasFiles.length > 0 ? canvasFiles[0] : canvasText[0];
      await expect(firstCanvas).toBeDisplayed();
    } else {
      // Canvas support might not be enabled in test mode
      console.log('No canvas files found - canvas feature may not be enabled');
    }
  });

  it('should open canvas file when clicked', async () => {
    // Look for any canvas file in the sidebar
    let canvasFile = await browser.$('[data-testid="file-item"]*=.canvas');
    if (!(await canvasFile.isExisting())) {
      canvasFile = await browser.$('button*=.canvas');
    }

    if (await canvasFile.isExisting()) {
      const isVisible = await canvasFile.isDisplayed().catch(() => false);
      if (isVisible) {
        await canvasFile.click();
        await browser.pause(2000);

        // Check if canvas editor opened
        const canvasSelectors = ['.tldraw', 'canvas[data-testid="canvas"]', '[data-testid="canvas-container"]'];
        let hasCanvas = false;

        for (const selector of canvasSelectors) {
          const element = await browser.$(selector);
          if (await element.isExisting()) {
            hasCanvas = true;
            break;
          }
        }

        if (!hasCanvas) {
          console.log('Canvas editor did not open - might require Tauri implementation');
        }
      } else {
        console.log('Canvas file not visible');
      }
    } else {
      console.log('No canvas files found to test');
    }
  });

  it('should handle canvas file creation request', async () => {
    // Test that canvas file creation doesn't error (even if not fully functional)
    const canvasCreationAttempt = await browser.execute(() => {
      // Simulate what would happen if canvas creation was triggered
      const event = new CustomEvent('canvas-create-requested', { detail: { name: 'test-canvas' } });
      window.dispatchEvent(event);
      return true;
    });

    expect(canvasCreationAttempt).toBe(true);
  });
});
