/**
 * Test Fixtures for Lokus E2E Tests
 *
 * Provides:
 * - workspacePath: The path to the test workspace (created by global-setup.js)
 * - workspacePage: A page that's already navigated to the workspace
 *
 * Usage in tests:
 *   import { test, expect } from '../setup/test-workspace.js';
 *
 *   test('my test', async ({ workspacePage }) => {
 *     // workspacePage is already at the workspace, editor ready
 *     const editor = workspacePage.locator('.ProseMirror');
 *     await editor.click();
 *   });
 */

import { test as base, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Path where global-setup.js stores the workspace path
const WORKSPACE_PATH_FILE = join(tmpdir(), 'lokus-e2e-workspace-path.txt');

/**
 * Read the workspace path created by global-setup.js
 */
async function getWorkspacePath() {
  try {
    const path = await fs.readFile(WORKSPACE_PATH_FILE, 'utf-8');
    return path.trim();
  } catch (error) {
    throw new Error(
      `Could not read workspace path from ${WORKSPACE_PATH_FILE}. ` +
      `Make sure global-setup.js ran successfully. Error: ${error.message}`
    );
  }
}

/**
 * Extended Playwright test with workspace fixtures
 */
export const test = base.extend({
  /**
   * The path to the test workspace (shared across all tests)
   */
  workspacePath: async ({}, use) => {
    const path = await getWorkspacePath();
    await use(path);
  },

  /**
   * A page that's already navigated to the workspace with editor ready
   */
  workspacePage: async ({ page, workspacePath }, use) => {
    // Navigate to workspace using URL parameter with testMode for E2E bypass
    // testMode=true tells the app to skip Tauri validation (needed for browser-based tests)
    const url = `/?testMode=true&workspacePath=${encodeURIComponent(workspacePath)}`;

    // Retry navigation multiple times - Tauri backend might not be ready yet
    let workspaceLoaded = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        console.log(`Workspace not ready, retrying (attempt ${attempt + 1}/5)...`);
        await page.waitForTimeout(3000); // Wait 3s between retries
      }

      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Wait a bit for React to render and Tauri to respond
      await page.waitForTimeout(1000);

      // Check if workspace loaded (file tree visible) or still on launcher
      const fileTree = page.locator('.file-tree, .file-explorer, [data-testid="file-tree"], .space-y-1');
      const launcher = page.locator('text=Open Workspace, text=Recently Opened');

      try {
        await fileTree.first().waitFor({ state: 'visible', timeout: 5000 });
        workspaceLoaded = true;
        break;
      } catch {
        // Check if we're on launcher - might need to wait for Tauri
        const isOnLauncher = await launcher.first().isVisible().catch(() => false);
        if (isOnLauncher) {
          console.log('Still on launcher - Tauri backend may not be ready');
        }
      }
    }

    if (!workspaceLoaded) {
      console.warn('Workspace may not have loaded after 5 attempts - check if Tauri is running');
    }

    // Small delay for UI to stabilize
    await page.waitForTimeout(500);

    await use(page);
  },

  /**
   * A page at the launcher (for testing launcher-specific features)
   */
  launcherPage: async ({ page }, use) => {
    // Navigate without workspace parameter to get launcher
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for launcher to be visible
    await page.waitForSelector(
      'text=Open Workspace, text=Recently Opened, text=Create Workspace',
      { timeout: 10000 }
    ).catch(() => {
      // Launcher should be visible
    });

    await use(page);
  },
});

export { expect };

/**
 * Helper to get the editor element
 */
export async function getEditor(page) {
  const editor = page.locator('.ProseMirror').first();
  await editor.waitFor({ state: 'visible', timeout: 10000 });
  return editor;
}

/**
 * Helper to open a specific file in the workspace
 */
export async function openFile(page, filename) {
  // Find the file in the file tree
  const fileItem = page.locator(`text=${filename}`).first();
  await fileItem.waitFor({ state: 'visible', timeout: 5000 });
  await fileItem.dblclick();

  // Wait for editor to load
  await page.waitForTimeout(500);
  return getEditor(page);
}

/**
 * Helper to create a new file
 */
export async function createNewFile(page, filename) {
  // Look for new file button
  const newBtn = page.locator('button:has-text("New"), [title*="New"], [aria-label*="New"]').first();
  await newBtn.click();

  // If a dialog appears, enter filename
  const input = page.locator('input[placeholder*="name"], input[type="text"]').first();
  if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
    await input.fill(filename);
    await input.press('Enter');
  }

  await page.waitForTimeout(500);
  return getEditor(page);
}

/**
 * Helper to wait for file tree to be ready
 */
export async function waitForFileTree(page) {
  await page.waitForSelector(
    '.file-tree, .file-explorer, [data-testid="file-tree"]',
    { timeout: 10000 }
  );
}

/**
 * Helper to dismiss any tour/onboarding dialogs
 */
export async function dismissTour(page) {
  // Try various ways to dismiss tour
  const dismissSelectors = [
    'button:has-text("Skip")',
    'button:has-text("Close")',
    'button:has-text("Got it")',
    '.driver-overlay',
    'dialog button:has-text("×")',
  ];

  for (const selector of dismissSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
      await element.click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }
}
