/**
 * Helper functions for WebdriverIO E2E tests
 * Handles workspace setup and common test operations
 */

import { browser } from '@wdio/globals';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Default test workspace path
const TEST_WORKSPACE = process.env.LOKUS_E2E_WORKSPACE || '/tmp/lokus-e2e-workspace';

/**
 * Ensure the test workspace exists with required files
 */
export function ensureTestWorkspace() {
  if (!existsSync(TEST_WORKSPACE)) {
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  }

  // Create .lokus config directory
  const lokusDir = join(TEST_WORKSPACE, '.lokus');
  if (!existsSync(lokusDir)) {
    mkdirSync(lokusDir, { recursive: true });
  }

  // Create config file
  writeFileSync(join(lokusDir, 'config.json'), JSON.stringify({ version: '1.0' }));

  // Create test files
  writeFileSync(join(TEST_WORKSPACE, 'test-note.md'), '# Test Note\n\nThis is a test note for E2E testing.');
  writeFileSync(join(TEST_WORKSPACE, 'README.md'), '# README\n\nTest workspace for E2E tests.');

  return TEST_WORKSPACE;
}

/**
 * Check if we're on the launcher screen
 */
export async function isOnLauncher() {
  const body = await browser.$('body');
  const text = await body.getText();
  return text.includes('Create New Workspace') || text.includes('Open Existing Workspace');
}

/**
 * Check if we're in the editor/workspace view
 */
export async function isInWorkspace() {
  // Check for workspace indicators
  const fileTree = await browser.$('[data-tour="files"], .file-tree, .sidebar');
  const editor = await browser.$('.ProseMirror, .tiptap-area');

  return (await fileTree.isExisting()) || (await editor.isExisting());
}

/**
 * Wait for the app to be ready (either launcher or workspace)
 */
export async function waitForAppReady(timeout = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const onLauncher = await isOnLauncher();
    const inWorkspace = await isInWorkspace();

    if (onLauncher || inWorkspace) {
      return { onLauncher, inWorkspace };
    }

    await browser.pause(500);
  }

  throw new Error('App did not become ready within timeout');
}

/**
 * Open a workspace from the launcher
 * Note: In Tauri, we can't directly navigate to a path - we need to use the native dialog
 * This helper clicks "Open Existing Workspace" and waits for the dialog
 */
export async function openWorkspaceFromLauncher() {
  // Check if we're on the launcher
  const onLauncher = await isOnLauncher();
  if (!onLauncher) {
    console.log('Not on launcher, skipping workspace open');
    return false;
  }

  // Find and click "Open Existing Workspace" button
  const openButton = await browser.$('button*=Open Existing');
  if (await openButton.isExisting()) {
    await openButton.click();
    await browser.pause(1000);

    // Note: Native file dialog will open - we can't control it from WebDriver
    // The test workspace needs to be pre-configured or the dialog canceled
    console.log('Clicked Open Existing Workspace - native dialog should appear');
    return true;
  }

  return false;
}

/**
 * Get the editor element, waiting for it to appear
 */
export async function getEditor(timeout = 5000) {
  const editor = await browser.$('.ProseMirror');
  await editor.waitForExist({ timeout });
  return editor;
}

/**
 * Get the file tree element
 */
export async function getFileTree(timeout = 5000) {
  const fileTree = await browser.$('[data-tour="files"], .file-tree, .sidebar');
  await fileTree.waitForExist({ timeout });
  return fileTree;
}

/**
 * Click on a file in the file tree by name
 */
export async function clickFile(filename) {
  const fileItem = await browser.$(`*=${filename}`);
  if (await fileItem.isExisting()) {
    await fileItem.click();
    await browser.pause(500);
    return true;
  }
  return false;
}

/**
 * Double-click to open a file in the editor
 */
export async function openFile(filename) {
  const fileItem = await browser.$(`*=${filename}`);
  if (await fileItem.isExisting()) {
    await fileItem.doubleClick();
    await browser.pause(1000);

    // Wait for editor to appear
    const editor = await browser.$('.ProseMirror');
    await editor.waitForExist({ timeout: 5000 });
    return editor;
  }
  return null;
}

/**
 * Type text into the editor
 */
export async function typeInEditor(text) {
  const editor = await browser.$('.ProseMirror');
  await editor.click();

  // Type character by character for reliability
  for (const char of text) {
    await browser.keys([char]);
  }

  await browser.pause(200);
}

/**
 * Press keyboard shortcut
 */
export async function pressShortcut(...keys) {
  await browser.keys(keys);
  await browser.pause(300);
}

/**
 * Dismiss any tour overlays or dialogs
 */
export async function dismissDialogs() {
  // Try to find and close any dialogs
  const closeButtons = await browser.$$('button*=Close, button*=Dismiss, button*=Skip, [aria-label="Close"]');

  for (const btn of closeButtons) {
    if (await btn.isDisplayed()) {
      await btn.click();
      await browser.pause(200);
    }
  }

  // Press Escape to close any modals
  await browser.keys(['Escape']);
  await browser.pause(200);
}
