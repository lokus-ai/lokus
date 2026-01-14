import { expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 *
 * These tests run against the real Tauri app.
 * The test workspace is created by global-setup.js.
 */

/**
 * Disable the product tour for tests.
 * Call this before navigation to prevent the welcome tour from appearing.
 */
export async function disableTour(page) {
  await page.addInitScript(() => {
    localStorage.setItem('lokus:config', JSON.stringify({ hasSeenProductTour: true }));
  });
}

/**
 * Force dismiss any tour overlay that might be blocking.
 * Call this after page load if tour appears despite being disabled.
 */
export async function dismissTourOverlay(page) {
  await page.evaluate(() => {
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

/**
 * Wait for editor to load
 */
export async function waitForEditorLoad(page, options = {}) {
  const { timeout = 10000 } = options;
  try {
    await page.waitForSelector('.ProseMirror, .tiptap-area', { timeout });
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the editor element
 */
export async function getEditor(page) {
  return page.locator('.ProseMirror').first();
}

/**
 * Type text in the editor
 */
export async function typeInEditor(page, text) {
  const editor = await getEditor(page);
  await editor.click();
  await page.keyboard.type(text);
  return editor;
}

/**
 * Use a slash command in the editor
 */
export async function useSlashCommand(page, command) {
  const editor = await getEditor(page);
  await editor.click();
  await page.keyboard.type(`/${command}`);
  await page.waitForTimeout(500);

  const commandMenu = page.locator('.slash-command-list, .command-menu, [data-testid="slash-menu"]');
  if (await commandMenu.count() > 0) {
    await page.keyboard.press('Enter');
    return true;
  }
  return false;
}

/**
 * Navigate to preferences
 */
export async function navigateToPreferences(page) {
  const preferencesButton = page.locator(
    '[data-testid="preferences"], ' +
    'button:has-text("Preferences"), ' +
    '.preferences-button, ' +
    '[aria-label="Preferences"]'
  );

  if (await preferencesButton.count() > 0) {
    await preferencesButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }

  // Try keyboard shortcut
  await page.keyboard.press('Control+,');
  await page.waitForTimeout(1000);
  return false;
}

/**
 * Save file with Ctrl+S
 */
export async function saveFile(page) {
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);
}

/**
 * Create a new task in the editor
 */
export async function createTask(page, taskText, taskType = 'urgent') {
  const editor = await getEditor(page);
  await editor.click();

  await page.keyboard.type('!task ');
  await page.waitForTimeout(1000);

  const widget = page.locator('.task-input-widget');
  await expect(widget).toBeVisible();

  const typeMap = { urgent: 0, question: 1, progress: 2, todo: 3 };
  const tabCount = typeMap[taskType] || 0;

  for (let i = 0; i < tabCount; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
  }

  const taskInput = page.locator('.task-input-widget input');
  await taskInput.fill(taskText);
  await taskInput.press('Enter');
  await page.waitForTimeout(2000);

  return page.locator('[data-task-text="true"]').last();
}

/**
 * Navigate to the kanban board
 */
export async function navigateToKanban(page) {
  const kanbanTab = page.locator('[data-file="__kanban__"]');
  if (await kanbanTab.count() > 0) {
    await kanbanTab.click();
    await page.waitForTimeout(1000);
    return true;
  }

  const kanbanButton = page.locator('button:has-text("kanban"), button:has-text("Kanban"), [aria-label*="kanban"]');
  if (await kanbanButton.count() > 0) {
    await kanbanButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

export { expect };
