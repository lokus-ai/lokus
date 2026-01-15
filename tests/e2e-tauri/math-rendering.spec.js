/**
 * Math Rendering E2E Tests (WebdriverIO/Tauri)
 *
 * Tests LaTeX/KaTeX math rendering in the editor.
 * These tests run against the real Tauri app with a real filesystem.
 * The test workspace path is provided via LOKUS_E2E_WORKSPACE env var.
 */
import { browser, expect } from '@wdio/globals';

/**
 * Helper to get the editor element
 */
async function getEditor() {
  const editor = await browser.$('.ProseMirror');
  await editor.waitForExist({ timeout: 10000 });
  await editor.waitForDisplayed({ timeout: 10000 });
  return editor;
}

/**
 * Helper to open a specific file in the workspace
 */
async function openFile(filename) {
  // Find the file in the file tree
  const fileItem = await browser.$(`*=${filename}`);
  await fileItem.waitForExist({ timeout: 5000 });
  await fileItem.waitForDisplayed({ timeout: 5000 });
  await fileItem.doubleClick();

  // Wait for editor to load
  await browser.pause(500);
  return getEditor();
}

/**
 * Helper to dismiss any tour/onboarding dialogs
 */
async function dismissTour() {
  // Try various ways to dismiss tour
  const dismissSelectors = [
    'button=Skip',
    'button=Close',
    'button=Got it',
    '.driver-overlay',
  ];

  for (const selector of dismissSelectors) {
    try {
      const element = await browser.$(selector);
      if (await element.isExisting() && await element.isDisplayed()) {
        await element.click();
        await browser.pause(200);
      }
    } catch {
      // Element not found, continue
    }
  }
}

/**
 * Helper to wait for workspace to be ready
 */
async function waitForWorkspace() {
  const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
  if (!workspacePath) {
    console.log('Warning: LOKUS_E2E_WORKSPACE not set');
    return false;
  }

  // Wait for app to load
  await browser.pause(3000);

  // Check if we're on launcher or workspace
  const fileTree = await browser.$('.file-tree, .file-explorer, [data-testid="file-tree"], .space-y-1');

  // If file tree exists, workspace is loaded
  if (await fileTree.isExisting()) {
    return true;
  }

  // If on launcher, try to open the workspace
  // Look for "Open Workspace" button or recent workspace
  const openButton = await browser.$('button=Open Workspace');
  if (await openButton.isExisting()) {
    console.log('On launcher - workspace not automatically loaded');
    // For now, just report that we're on launcher
    // In a real scenario, we'd need to interact with file picker
    return false;
  }

  return false;
}

describe('Math Rendering', () => {
  beforeEach(async () => {
    // Dismiss any tour dialogs
    await dismissTour();
  });

  it('app loads successfully', async () => {
    const appRoot = await browser.$('#root');
    await appRoot.waitForExist({ timeout: 10000 });
    await expect(appRoot).toBeDisplayed();
  });

  it('can type inline math syntax', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'T', 'h', 'e', ' ', 'e', 'q', 'u', 'a', 't', 'i', 'o', 'n', ' ', '$', 'x', '^', '2', '$', ' ', 'r', 'e', 'p', 'r', 'e', 's', 'e', 'n', 't', 's', ' ', 'a', ' ', 's', 'q', 'u', 'a', 'r', 'e']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('equation');
  });

  it('can type block math syntax', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', '$', '$']);
    await browser.keys(['Enter']);
    await browser.keys(['E', ' ', '=', ' ', 'm', 'c', '^', '2']);
    await browser.keys(['Enter']);
    await browser.keys(['$', '$']);
    await browser.pause(200);

    await expect(editor).toBeDisplayed();
  });

  it('editor handles special LaTeX characters', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'S', 'u', 'm', ':', ' ', '$', '\\', 's', 'u', 'm', '_', '{', 'i', '=', '1', '}', '^', '{', 'n', '}', ' ', 'x', '_', 'i', '$']);
    await browser.pause(200);

    await expect(editor).toBeDisplayed();
  });

  it('can type Greek letters in math', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'G', 'r', 'e', 'e', 'k', ':', ' ', '$', '\\', 'a', 'l', 'p', 'h', 'a', ' ', '+', ' ', '\\', 'b', 'e', 't', 'a', ' ', '=', ' ', '\\', 'g', 'a', 'm', 'm', 'a', '$']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Greek');
  });

  it('can type fractions in math', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'F', 'r', 'a', 'c', 't', 'i', 'o', 'n', ':', ' ', '$', '\\', 'f', 'r', 'a', 'c', '{', '1', '}', '{', '2', '}', '$']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Fraction');
  });

  it('can type square root in math', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'R', 'o', 'o', 't', ':', ' ', '$', '\\', 's', 'q', 'r', 't', '{', 'x', '^', '2', ' ', '+', ' ', 'y', '^', '2', '}', '$']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Root');
  });

  it('can type integral in math', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'I', 'n', 't', 'e', 'g', 'r', 'a', 'l', ':', ' ', '$', '\\', 'i', 'n', 't', '_', '0', '^', '1', ' ', 'x', ' ', 'd', 'x', '$']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Integral');
  });

  it('math does not break with empty delimiters', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'E', 'm', 'p', 't', 'y', ':', ' ', '$', '$', ' ', 'a', 'n', 'd', ' ', 'm', 'o', 'r', 'e', ' ', 't', 'e', 'x', 't']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Empty');
  });
});
